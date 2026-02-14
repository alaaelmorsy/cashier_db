const { ipcMain } = require('electron');
const axios = require('axios');
const path = require('path');
const fs = require('fs/promises');
const { app } = require('electron');

// Resolve a writable path for ZATCA config in dev/prod
function getZatcaConfigPath(){
  try{
    const userData = app.getPath('userData');
    return path.join(userData, '.zatca-config.json');
  }catch(_){
    return path.join(process.cwd(), '.zatca-config.json');
  }
}
const crypto = require('crypto');
const { dbAdapter, DB_NAME } = require('../db/db-adapter');

class LocalZatcaBridge {
  async updateSaleZatcaData(sale_id, zatca_data){
    // Reuse existing IPC used by preload to update sales ZATCA fields
    const { BrowserWindow, ipcMain } = require('electron');
    try{
      const conn = await dbAdapter.getConnection();
      try{
        await conn.query(
          `UPDATE sales SET zatca_uuid=?, zatca_hash=?, zatca_qr=?, zatca_submitted = NOW(), zatca_status='submitted' WHERE id=?`,
          [ zatca_data?.uuid || null, zatca_data?.invoiceHash || null, zatca_data?.qrCode || null, Number(sale_id) ]
        );
      } finally { conn.release(); }
    }catch(_){ }
  }
  constructor() {
    // Singleton
    if (!LocalZatcaBridge._instance) { LocalZatcaBridge._instance = this; }
    // Default endpoint; can be overridden via .zatca-config.json -> { "localApi": { "endpoint": "http://...", "paramName": "invoiceIO" } }
    this.endpoint = 'http://localhost:8080/zatca_2/api/customerInvoice/submitInvoice';
    this.paramName = 'invoiceJO';
    this.paramAliases = ['invoiceJO','invoiceIO','invoiceIo','invoiceJson','invoice','data','payload'];
    this._lastAttempt = null; // track last HTTP attempt for clear error reporting
    setImmediate(async () => {
      try{
        const cfg = await this.loadZatcaConfig();
        if(cfg?.localApi?.endpoint){ this.endpoint = cfg.localApi.endpoint; }
        if(cfg?.localApi?.paramName){ this.paramName = cfg.localApi.paramName; }
        if(Array.isArray(cfg?.localApi?.paramAliases) && cfg.localApi.paramAliases.length){
          this.paramAliases = Array.from(new Set(cfg.localApi.paramAliases.concat(this.paramAliases)));
        }
        if(this.paramName && !this.paramAliases.includes(this.paramName)){
          this.paramAliases.unshift(this.paramName);
        }
        this.preferredMode = cfg?.localApi?.preferredMode || 'json-raw'; // default to raw JSON; will fallback across other modes automatically
        // Allow disabling text/plain fallback to avoid final 415 noise on strict servers (default: disabled)
        this.enableTextPlain = (cfg?.localApi?.enableTextPlain ?? false) ? true : false;
      }catch(_){ }
      if(!LocalZatcaBridge._ipcRegistered){
        this.setupIpc();
        LocalZatcaBridge._ipcRegistered = true;
      }
    });
  }

  static getInstance(){
    return LocalZatcaBridge._instance || new LocalZatcaBridge();
  }

  setupIpc() {
    // Submit to local ZATCA-like API
    ipcMain.handle('zatca:submitLocal', async (_e, payload) => {
      try {
        const { sale_id, body } = payload || {};
        let finalBody = body;
        if (!finalBody) {
          if (!sale_id) return { success: false, message: 'sale_id أو body مطلوب' };
          finalBody = await this.buildBodyFromSaleId(sale_id);
        }

        const res = await this.sendWithFallback(finalBody);

        // Update sale with uuid and hashes if we can
        try {
          if (payload?.sale_id && finalBody?.uuid) {
            let respData = res && res.data;
            let invoiceHash = null;
            let qrCode = null;
            try{
              const obj = (typeof respData === 'string') ? JSON.parse(respData) : respData;
              invoiceHash = obj?.invoiceHash || obj?.data?.invoiceHash || null;
              qrCode = obj?.qrCode || obj?.data?.qrCode || null;
            }catch(_){ }
            // Persist status depending on response content; treat NOT_REPORTED as rejection
            try{
              const conn = await dbAdapter.getConnection();
              try{
                const rawResp = (typeof respData==='string'? respData : JSON.stringify(respData));
                let obj = null; try{ obj = (typeof respData==='string') ? JSON.parse(respData) : respData; }catch(_){ obj = null; }
                const notReported = /NOT[_\s-]?REPORTED/i.test(rawResp) || (obj && (obj.statusCode==='NOT_REPORTED' || obj.status==='NOT_REPORTED' || obj?.data?.status==='NOT_REPORTED'));
                if(notReported){
                  await conn.query(
                    `UPDATE sales SET zatca_uuid=?, zatca_hash=NULL, zatca_qr=NULL, zatca_status='rejected', zatca_rejection_reason='NOT_REPORTED', zatca_response=? WHERE id=?`,
                    [ finalBody.uuid || null, rawResp, Number(payload.sale_id) ]
                  );
                }else{
                  await conn.query(
                    `UPDATE sales SET zatca_uuid=?, zatca_hash=?, zatca_qr=?, zatca_submitted=NOW(), zatca_status='submitted', zatca_rejection_reason=NULL, zatca_response=? WHERE id=?`,
                    [ finalBody.uuid || null, invoiceHash || null, qrCode || null, rawResp, Number(payload.sale_id) ]
                  );
                }
              }finally{ conn.release(); }
            }catch(_){ }
            // Do not call legacy updater here to avoid overriding rejected status
          }
        } catch (_) {}

        return { success: true, data: res.data, sent: finalBody };
      } catch (error) {
        // Build rich error context for clear display in UI
        const status = error?.response?.status;
        const respData = error?.response?.data;
        const meta = error?._meta || this._lastAttempt || {};
        const endpoint = meta.endpoint || this.endpoint;
        const mode = meta.mode || 'unknown';
        const key = meta.key || this.paramName;
        const baseMsg = typeof respData === 'string' ? respData : (respData ? JSON.stringify(respData) : (error?.message || String(error)));
        const trail = Array.isArray(error?._attemptTrail)? `\nAttempts: ${error._attemptTrail.map(t=>`[${t.mode}${t.param?`:${t.param}`:''} -> ${t.status||'ERR'}]`).join(' ')}` : '';
        const pretty = `HTTP ${status||'ERR'} at ${endpoint} | mode=${mode}${key?`, param=${key}`:''}\n${baseMsg}${trail}`;
        // إذا كانت الفاتورة معروفة ولدينا sale_id، خزّن سبب الرفض والرد الكامل في قاعدة البيانات
        try{
          if(payload?.sale_id){
            const conn = await dbAdapter.getConnection();
            try{
              const respStr = (typeof respData==='string') ? respData : (respData ? JSON.stringify(respData) : '');
              await conn.query(
                `UPDATE sales SET zatca_status='rejected', zatca_rejection_reason=?, zatca_response=? WHERE id=?`,
                [ baseMsg, respStr, Number(payload.sale_id) ]
              );
            }finally{ conn.release(); }
          }
        }catch(_){ }
        return {
          success: false,
          message: pretty,
          details: {
            status: status||null,
            endpoint,
            mode,
            param: key,
            response: respData||null
          }
        };
      }
    });
  }

  // Submit one sale by id using the same logic as IPC
  async submitSaleById(sale_id){
    try {
      const body = await this.buildBodyFromSaleId(sale_id);
      const res = await this.sendWithFallback(body);
      
      // حفظ الرد في قاعدة البيانات (نفس منطق zatca:submitLocal)
      try{
        let respData = res && res.data;
        let invoiceHash = null;
        let qrCode = null;
        try{
          const obj = (typeof respData === 'string') ? JSON.parse(respData) : respData;
          invoiceHash = obj?.invoiceHash || obj?.data?.invoiceHash || null;
          qrCode = obj?.qrCode || obj?.data?.qrCode || null;
        }catch(_){ }
        
        // حفظ حالة الفاتورة والرد الكامل من الهيئة
        const conn = await dbAdapter.getConnection();
        try{
          const rawResp = (typeof respData==='string'? respData : JSON.stringify(respData));
          let obj = null; 
          try{ obj = (typeof respData==='string') ? JSON.parse(respData) : respData; }catch(_){ obj = null; }
          const notReported = /NOT[_\s-]?REPORTED/i.test(rawResp) || (obj && (obj.statusCode==='NOT_REPORTED' || obj.status==='NOT_REPORTED' || obj?.data?.status==='NOT_REPORTED'));
          
          if(notReported){
            await conn.query(
              `UPDATE sales SET zatca_uuid=?, zatca_hash=NULL, zatca_qr=NULL, zatca_status='rejected', zatca_rejection_reason='NOT_REPORTED', zatca_response=? WHERE id=?`,
              [ body.uuid || null, rawResp, Number(sale_id) ]
            );
          } else {
            await conn.query(
              `UPDATE sales SET zatca_uuid=?, zatca_hash=?, zatca_qr=?, zatca_submitted=NOW(), zatca_status='submitted', zatca_rejection_reason=NULL, zatca_response=? WHERE id=?`,
              [ body.uuid || null, invoiceHash || null, qrCode || null, rawResp, Number(sale_id) ]
            );
          }
        } finally { conn.release(); }
      }catch(_){ }
      
      return res;
    } catch (error) {
      // حفظ سبب الفشل في قاعدة البيانات
      try{
        const conn = await dbAdapter.getConnection();
        try{
          const status = error?.response?.status;
          const respData = error?.response?.data;
          const baseMsg = typeof respData === 'string' ? respData : (respData ? JSON.stringify(respData) : (error?.message || String(error)));
          const respStr = (typeof respData==='string') ? respData : (respData ? JSON.stringify(respData) : '');
          
          await conn.query(
            `UPDATE sales SET zatca_status='rejected', zatca_rejection_reason=?, zatca_response=? WHERE id=?`,
            [ baseMsg, respStr, Number(sale_id) ]
          );
        } finally { conn.release(); }
      }catch(_){ }
      
      throw error;
    }
  }

  async sendWithFallback(body){
    const tryPost = async (data, headers, meta) => {
      this._lastAttempt = { endpoint: this.endpoint, ...meta };
      return await axios.post(this.endpoint, data, { headers, transformRequest: headers['Content-Type']?.includes('application/json') ? [(d)=> typeof d==='string'? d : JSON.stringify(d)] : undefined });
    };

    const allModes = ['json-raw','json-wrapped','json-wrapped-string','form','multipart', ...(this.enableTextPlain ? ['text-plain'] : [])];
    const modes = this.preferredMode ? [this.preferredMode, ...allModes.filter(m => m !== this.preferredMode)] : allModes;

    // Collect attempt logs to help diagnose failures
    const attemptTrail = [];

    const tryMode = async (mode) => {
      if(mode === 'json-raw'){
        return await tryPost(body, { 'Content-Type': 'application/json; charset=utf-8', 'Accept': 'application/json,text/plain,*/*' }, { mode:'json-raw' });
      }
      if(mode === 'json-wrapped'){
        for(const key of this.paramAliases){
          try{
            const jsonWrapper = { [key]: body };
            return await tryPost(jsonWrapper, { 'Content-Type': 'application/json; charset=utf-8', 'Accept': 'application/json,text/plain,*/*' }, { mode:'json-wrapped', key });
          }catch(err){ if(err?.response){ err._meta = this._lastAttempt; } const status = err?.response?.status; const msg = (err?.response?.data && JSON.stringify(err.response.data)) || ''; if(status !== 415 && !/Missing\s+invoice(?:JO|IO)/i.test(msg)) throw err; }
        }
      }
      if(mode === 'json-wrapped-string'){
        for(const key of this.paramAliases){
          try{
            const jsonWrapperString = { [key]: JSON.stringify(body) };
            return await tryPost(jsonWrapperString, { 'Content-Type': 'application/json; charset=utf-8', 'Accept': 'application/json,text/plain,*/*' }, { mode:'json-wrapped-string', key });
          }catch(err){ if(err?.response){ err._meta = this._lastAttempt; } const status = err?.response?.status; const msg = (err?.response?.data && JSON.stringify(err.response.data)) || ''; if(status !== 415 && !/Missing\s+invoice(?:JO|IO)/i.test(msg)) throw err; }
        }
      }
      if(mode === 'form'){
        for(const key of this.paramAliases){
          try{
            const params = new URLSearchParams();
            params.set(key, JSON.stringify(body));
            return await tryPost(params.toString(), { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json,text/plain,*/*' }, { mode:'form-urlencoded', key });
          }catch(err){ if(err?.response){ err._meta = this._lastAttempt; } const status = err?.response?.status; const msg = (err?.response?.data && JSON.stringify(err.response.data)) || ''; if(status !== 415 && !/Missing\s+invoice(?:JO|IO)/i.test(msg)) throw err; }
        }
      }
      if(mode === 'multipart'){
        for(const key of this.paramAliases){
          try {
            const mp = this._buildMultipart({ [key]: JSON.stringify(body) });
            return await tryPost(mp.body, { 'Content-Type': mp.contentType, 'Accept': 'application/json,text/plain,*/*' }, { mode:'multipart', key });
          } catch (err){ if(err?.response){ err._meta = this._lastAttempt; } const status = err?.response?.status; const msg = (err?.response?.data && JSON.stringify(err.response.data)) || ''; if(status !== 415 && !/Missing\s+invoice(?:JO|IO)/i.test(msg)) throw err; }
        }
      }
      if(mode === 'text-plain'){
        return await tryPost(JSON.stringify(body), { 'Content-Type': 'text/plain; charset=utf-8', 'Accept': 'application/json,text/plain,*/*' }, { mode:'text-plain' });
      }
      throw new Error('Unsupported mode');
    };

    let lastErr = null;
    for(const m of modes){
      try{ return await tryMode(m); }catch(e){
        lastErr = e;
        const status = e?.response?.status || null;
        const data = e?.response?.data;
        const msg = typeof data === 'string' ? data : (data ? JSON.stringify(data) : (e?.message || String(e)));
        attemptTrail.push({ mode: (e?._meta?.mode)||m, param: (e?._meta?.key)||null, status, msg });
      }
    }
    if(lastErr){ lastErr._attemptTrail = attemptTrail; }
    throw lastErr || new Error('All submission modes failed');
  }

  _buildMultipart(fields){
    // Build a simple multipart/form-data body without external deps
    const boundary = '----ZaTcABoundary' + Math.random().toString(16).slice(2);
    const crlf = '\r\n';
    let chunks = '';
    for (const [key, value] of Object.entries(fields)){
      chunks += `--${boundary}` + crlf;
      chunks += `Content-Disposition: form-data; name="${key}"` + crlf + crlf;
      // Do not emit Content-Type per part; many Java servers infer text/plain default
      chunks += String(value) + crlf;
    }
    chunks += `--${boundary}--` + crlf;
    return {
      body: Buffer.from(chunks, 'utf8'),
      contentType: `multipart/form-data; boundary=${boundary}`
    };
  }

  async loadZatcaConfig() {
    try {
      const cfgPath = getZatcaConfigPath();
      const data = await fs.readFile(cfgPath, 'utf8');
      return JSON.parse(data);
    } catch (_) {
      return {};
    }
  }

  mapPaymentType(method) {
    // Map internal methods to your numeric codes (adjust if you have exact codes)
    const m = String(method || '').toLowerCase();
    if (m === 'cash' || m === 'كاش') return 10;
    if (m.includes('card') || m.includes('network') || m.includes('mada') || m === 'شبكة') return 20;
    if (m.includes('transfer') || m.includes('bank')) return 30;
    if (m.includes('mixed')) return 40;
    return 10;
  }

  async buildBodyFromSaleId(saleId) {
    const conn = await dbAdapter.getConnection();
    try {
      const [[sale]] = await conn.query('SELECT * FROM sales WHERE id=?', [Number(saleId)]);
      if (!sale) throw new Error('الفاتورة غير موجودة');
      const [items] = await conn.query('SELECT * FROM sales_items WHERE sale_id=?', [Number(saleId)]);

      // Load company/branch data from ZATCA config if available
      const zcfg = await this.loadZatcaConfig();
      const company = zcfg.companyData || {};

      // قراءة معدل الضريبة من إعدادات النظام (15% أو 5%) لضمان التوافق مع الهيئة
      const [[settings]] = await conn.query('SELECT vat_percent FROM app_settings WHERE id=1 LIMIT 1');
      const taxRate = Number(settings?.vat_percent || 15);

      // Totals
      const subTotal = Math.abs(Number(sale.sub_total || 0));
      const discount = Math.abs(Number(sale.discount_amount || 0));
      const totalWithoutVAT = Number(sale.total_after_discount != null ? sale.total_after_discount : (subTotal - discount));
      const vatTotal = Math.abs(Number(sale.vat_total || 0));
      const grandTotal = Math.abs(Number(sale.grand_total || (totalWithoutVAT + vatTotal)));

      // UUID: prefer existing ZATCA UUID if stored, else generate a new one
      const uuid = sale.zatca_uuid && String(sale.zatca_uuid).trim().length > 0 ? sale.zatca_uuid : crypto.randomUUID();

      // Payment type
      const payment_type = this.mapPaymentType(sale.payment_method);

      // Document type
      const type_inv = sale.doc_type === 'credit_note' ? '381' : '388';

      // Split invoice-level discount proportionally across items (before VAT)
      const itemsMapped = [];
      const sumPreVat = items.reduce((acc, it) => acc + Math.abs(Number(it.price || 0)) * Math.abs(Number(it.qty || it.quantity || 0)), 0);
      for (const it of items) {
        const qty = Math.abs(Number(it.qty || it.quantity || 1));
        const unitPrice = Math.abs(Number(it.price || 0));
        const linePreVat = unitPrice * qty;
        const share = sumPreVat > 0 ? (linePreVat / sumPreVat) : 0;
        const lineDiscount = Number((discount * share).toFixed(2));
        const lineAfterDisPreVat = Math.max(0, linePreVat - lineDiscount);
        const lineTax = Number((lineAfterDisPreVat * (taxRate / 100)).toFixed(2));
        const lineAfterDisWithVat = Number((lineAfterDisPreVat + lineTax).toFixed(2));

        itemsMapped.push({
          count: qty,
          name: it.name || 'Product',
          id: it.product_id || it.id || 0,
          tax: lineTax,
          price: unitPrice,
          dis_val: lineDiscount,
          tax_rate: taxRate,
          selling_price: unitPrice,
          total_selling_after_dis: Number(lineAfterDisPreVat.toFixed(2)),
          total_price_after_dis: lineAfterDisWithVat,
          tax_val: lineTax
        });
      }

      // Customer snapshot (fallback to cash customer)
      const customerNameAr = sale.customer_name || 'عميل نقدي';
      const customer = {
        id: sale.customer_id || 0,
        ar_name: customerNameAr,
        en_name: 'Cash Customer',
        ar_address: 'جدة، شارع فلسطين',
        build_number: '1305',
        additional_number: 'B205',
        subdivision: 'City Center',
        zip: '21577',
        tax_number: sale.customer_vat || '300000000000003',
        country: { en_name: 'Saudi Arabia', ar_name: 'السعودية' },
        city: { en_name: 'Jeddah', ar_name: 'جدة' }
      };

      // Credit note helpers and branch/company
      const isCredit = String(sale.doc_type||'') === 'credit_note';
      const reasonCode = sale.credit_reason_code || '01';
      const reasonText = sale.credit_reason || sale.notes || 'Credit note';

      const branch = {
        ar_name: company.organizationName || 'المنشأة',
        en_name: company.organizationNameEn || 'Company',
        branch_name: company.branchName || 'Main Branch',
        ar_address: (company.address && company.address.street) || 'مدينة الرياض',
        en_address: (company.address && company.address.streetEn) || 'Riyadh',
        tax_number: company.vatNumber || '300000000000003',
        commercial_num: company.commercialRegistration || '1010220507',
        build_number: company.address?.buildNumber || 1501,
        additional_number: company.address?.additionalNumber || 3003,
        subdivision: company.address?.subdivision || 'Business Area',
        zip: company.address?.zip || 21577,
        reason_code: isCredit ? reasonCode : '',
        reason_text: isCredit ? reasonText : '',
        email: company.email || 'example@example.com',
        businessCategory: company.businessCategory || 'tech',
        city: { name: 'Riyadh', en_name: 'Riyadh', ar_name: 'الرياض' },
        country: { name: 'Saudi Arabia', en_name: 'Saudi Arabia', ar_name: 'السعودية' }
      };

      // Normalize totals: credit notes must be positive amounts
      const sumNoVat = Number(totalWithoutVAT.toFixed(2));
      const vatVal = Number(vatTotal.toFixed(2));
      const grandVal = Number(grandTotal.toFixed(2));
      const usedSum = isCredit ? Math.abs(sumNoVat) : sumNoVat;
      const usedVat = isCredit ? Math.abs(vatVal) : vatVal;
      const usedGrand = isCredit ? Math.abs(grandVal) : grandVal;
      const usedDiscount = Math.abs(Number(discount||0));

      // Build final body
      const body = {
        id: Number(sale.id),
        uuid,
        payment_type,
        total: usedGrand,
        wanted_amount: 0,
        invoice_date: this.formatDateTime(sale.created_at),
        return_id: isCredit ? (sale.ref_base_sale_id || null) : null,
        return_invoices: isCredit && sale.ref_base_invoice_no ? [String(sale.ref_base_invoice_no)] : [],
        tax_rate: taxRate,
        tax: usedVat,
        discount: usedDiscount,
        delivery_date: null,
        shipping_price: 0,
        shipping_tax: 0,
        type_inv,
        type_invoice: '0200000',
        sum: usedSum,
        total_without_tax: usedSum,
        total_with_tax: usedGrand,
        paid: isCredit ? 0 : usedGrand,
        customer,
        branch,
        products: itemsMapped
      };

      return body;
    } finally {
      conn.release();
    }
  }

  formatDateTime(dt) {
    const d = dt ? new Date(dt) : new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const yyyy = d.getFullYear();
    const MM = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    const hh = pad(d.getHours());
    const mm = pad(d.getMinutes());
    const ss = pad(d.getSeconds());
    return `${yyyy}-${MM}-${dd} ${hh}:${mm}:${ss}`;
  }

  async updateSaleZatcaData(saleId, data) {
    try {
      const conn = await dbAdapter.getConnection();
      try {
        await conn.query(
          `UPDATE sales SET zatca_uuid = COALESCE(?, zatca_uuid), zatca_status = 'submitted', zatca_submitted = NOW() WHERE id = ?`,
          [data?.uuid || null, Number(saleId)]
        );
      } finally { conn.release(); }
    } catch (_) {}
  }
}

module.exports = LocalZatcaBridge;