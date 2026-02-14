// Sales IPC: persist invoices and items
const { ipcMain } = require('electron');
const { dbAdapter, DB_NAME } = require('../db/db-adapter');
const { isSecondaryDevice, fetchFromAPI } = require('./api-client');
const LocalZatcaBridge = require('./local-zatca');

function registerSalesIPC(){
  // Cache flag: check invoice counter only once per session
  let invoiceCounterChecked = false;
  
  async function autoSubmitZatcaIfEnabled(saleId){
    try{
      const conn = await dbAdapter.getConnection();
      try{
        const [[s]] = await conn.query('SELECT zatca_enabled FROM app_settings WHERE id=1');
        if(!s || !s.zatca_enabled) return;
      } finally { conn.release(); }
      try{
        const bridge = LocalZatcaBridge.getInstance ? LocalZatcaBridge.getInstance() : new LocalZatcaBridge();
        setImmediate(async()=>{ try{ await bridge.submitSaleById(saleId); }catch(_){ } });
      }catch(_){ }
    }catch(_){ }
  }
  
  async function ensureTables(conn){
    await conn.query(`
      CREATE TABLE IF NOT EXISTS sales (
        id INT AUTO_INCREMENT PRIMARY KEY,
        invoice_no VARCHAR(32) UNIQUE,
        customer_id INT NULL,
        customer_name VARCHAR(255) NULL,
        payment_method VARCHAR(32) NOT NULL,
        payment_status ENUM('unpaid','paid') NOT NULL DEFAULT 'paid',
        sub_total DECIMAL(12,2) NOT NULL,
        vat_total DECIMAL(12,2) NOT NULL,
        grand_total DECIMAL(12,2) NOT NULL,
        total_after_discount DECIMAL(12,2) NULL,
        discount_type VARCHAR(16) NULL,
        discount_value DECIMAL(12,2) NULL,
        discount_amount DECIMAL(12,2) NULL,
        notes VARCHAR(255) NULL,
        settled_at DATETIME NULL,
        settled_method VARCHAR(32) NULL,
        settled_cash DECIMAL(12,2) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Upgrade older schemas: add/relax discount columns
    // Ensure extra_value column exists and is nullable
    const [colExtraUp] = await conn.query("SHOW COLUMNS FROM sales LIKE 'extra_value'");
    if(!colExtraUp.length){ await conn.query("ALTER TABLE sales ADD COLUMN extra_value DECIMAL(12,2) NULL AFTER sub_total"); }

    const [colTad] = await conn.query("SHOW COLUMNS FROM sales LIKE 'total_after_discount'");
    if(!colTad.length){
      await conn.query("ALTER TABLE sales ADD COLUMN total_after_discount DECIMAL(12,2) NULL AFTER grand_total");
    } else {
      const col = colTad[0];
      if(String(col.Null).toUpperCase() === 'NO'){
        await conn.query("ALTER TABLE sales MODIFY total_after_discount DECIMAL(12,2) NULL");
      }
    }
    const [colDT] = await conn.query("SHOW COLUMNS FROM sales LIKE 'discount_type'");
    if(!colDT.length){ await conn.query("ALTER TABLE sales ADD COLUMN discount_type VARCHAR(16) NULL AFTER total_after_discount"); }
    const [colDV] = await conn.query("SHOW COLUMNS FROM sales LIKE 'discount_value'");
    if(!colDV.length){ await conn.query("ALTER TABLE sales ADD COLUMN discount_value DECIMAL(12,2) NULL AFTER discount_type"); }
    const [colDA] = await conn.query("SHOW COLUMNS FROM sales LIKE 'discount_amount'");
    if(!colDA.length){ await conn.query("ALTER TABLE sales ADD COLUMN discount_amount DECIMAL(12,2) NULL AFTER discount_value"); }

    // Ensure customer snapshot columns exist inside sales (to search by data stored in invoice)
    const [colCustPhone] = await conn.query("SHOW COLUMNS FROM sales LIKE 'customer_phone'");
    if(!colCustPhone.length){ await conn.query("ALTER TABLE sales ADD COLUMN customer_phone VARCHAR(64) NULL AFTER customer_name"); }
    const [colCustVat] = await conn.query("SHOW COLUMNS FROM sales LIKE 'customer_vat'");
    if(!colCustVat.length){ await conn.query("ALTER TABLE sales ADD COLUMN customer_vat VARCHAR(32) NULL AFTER customer_phone"); }
    const [colCustEmail] = await conn.query("SHOW COLUMNS FROM sales LIKE 'customer_email'");
    if(!colCustEmail.length){ await conn.query("ALTER TABLE sales ADD COLUMN customer_email VARCHAR(255) NULL AFTER customer_vat"); }
    const [colCustAddr] = await conn.query("SHOW COLUMNS FROM sales LIKE 'customer_address'");
    if(!colCustAddr.length){ await conn.query("ALTER TABLE sales ADD COLUMN customer_address VARCHAR(255) NULL AFTER customer_email"); }
    const [colCustCR] = await conn.query("SHOW COLUMNS FROM sales LIKE 'customer_cr_number'");
    if(!colCustCR.length){ await conn.query("ALTER TABLE sales ADD COLUMN customer_cr_number VARCHAR(32) NULL AFTER customer_address"); }
    const [colCustNat] = await conn.query("SHOW COLUMNS FROM sales LIKE 'customer_national_address'");
    if(!colCustNat.length){ await conn.query("ALTER TABLE sales ADD COLUMN customer_national_address VARCHAR(255) NULL AFTER customer_cr_number"); }
    const [colCustPostal] = await conn.query("SHOW COLUMNS FROM sales LIKE 'customer_postal_code'");
    if(!colCustPostal.length){ await conn.query("ALTER TABLE sales ADD COLUMN customer_postal_code VARCHAR(16) NULL AFTER customer_national_address"); }
    const [colCustStreet] = await conn.query("SHOW COLUMNS FROM sales LIKE 'customer_street_number'");
    if(!colCustStreet.length){ await conn.query("ALTER TABLE sales ADD COLUMN customer_street_number VARCHAR(32) NULL AFTER customer_postal_code"); }
    const [colCustSub] = await conn.query("SHOW COLUMNS FROM sales LIKE 'customer_sub_number'");
    if(!colCustSub.length){ await conn.query("ALTER TABLE sales ADD COLUMN customer_sub_number VARCHAR(32) NULL AFTER customer_street_number"); }
    const [colCustNotes] = await conn.query("SHOW COLUMNS FROM sales LIKE 'customer_notes'");
    if(!colCustNotes.length){ await conn.query("ALTER TABLE sales ADD COLUMN customer_notes TEXT NULL AFTER customer_sub_number"); }

    // Ensure settlement columns (for legacy)
    const [colPS] = await conn.query("SHOW COLUMNS FROM sales LIKE 'payment_status'");
    if(!colPS.length){ await conn.query("ALTER TABLE sales ADD COLUMN payment_status ENUM('unpaid','paid') NOT NULL DEFAULT 'paid' AFTER payment_method"); }
    const [colSetAt] = await conn.query("SHOW COLUMNS FROM sales LIKE 'settled_at'");
    if(!colSetAt.length){ await conn.query("ALTER TABLE sales ADD COLUMN settled_at DATETIME NULL AFTER notes"); }
    const [colSetMeth] = await conn.query("SHOW COLUMNS FROM sales LIKE 'settled_method'");
    if(!colSetMeth.length){ await conn.query("ALTER TABLE sales ADD COLUMN settled_method VARCHAR(32) NULL AFTER settled_at"); }
    const [colSetCash] = await conn.query("SHOW COLUMNS FROM sales LIKE 'settled_cash'");
    if(!colSetCash.length){ await conn.query("ALTER TABLE sales ADD COLUMN settled_cash DECIMAL(12,2) NULL AFTER settled_method"); }

    // Ensure split payment amount columns for reports (cash/card)
    const [colPayCash] = await conn.query("SHOW COLUMNS FROM sales LIKE 'pay_cash_amount'");
    if(!colPayCash.length){ await conn.query("ALTER TABLE sales ADD COLUMN pay_cash_amount DECIMAL(12,2) NULL AFTER settled_cash"); }
    const [colPayCard] = await conn.query("SHOW COLUMNS FROM sales LIKE 'pay_card_amount'");
    if(!colPayCard.length){ await conn.query("ALTER TABLE sales ADD COLUMN pay_card_amount DECIMAL(12,2) NULL AFTER pay_cash_amount"); }

    // Ensure document type column (invoice|credit_note) exists and default to 'invoice'
    const [colDocTypeEnsure] = await conn.query("SHOW COLUMNS FROM sales LIKE 'doc_type'");
    if(!colDocTypeEnsure.length){
      await conn.query("ALTER TABLE sales ADD COLUMN doc_type ENUM('invoice','credit_note') NOT NULL DEFAULT 'invoice' AFTER invoice_no");
      try{ await conn.query("UPDATE sales SET doc_type='invoice' WHERE doc_type IS NULL"); }catch(_){ }
    }

    // Ensure per-invoice order number (resets daily by closing hour) column exists
    const [colOrderNo] = await conn.query("SHOW COLUMNS FROM sales LIKE 'order_no'");
    if(!colOrderNo.length){ await conn.query("ALTER TABLE sales ADD COLUMN order_no INT NULL AFTER invoice_no"); }

    // إضافة حقول ZATCA للفاتورة الإلكترونية
    const [colZatcaUuid] = await conn.query("SHOW COLUMNS FROM sales LIKE 'zatca_uuid'");
    if(!colZatcaUuid.length){ await conn.query("ALTER TABLE sales ADD COLUMN zatca_uuid VARCHAR(255) NULL AFTER order_no"); }
    
    const [colZatcaHash] = await conn.query("SHOW COLUMNS FROM sales LIKE 'zatca_hash'");
    if(!colZatcaHash.length){ await conn.query("ALTER TABLE sales ADD COLUMN zatca_hash VARCHAR(255) NULL AFTER zatca_uuid"); }
    
    const [colZatcaQr] = await conn.query("SHOW COLUMNS FROM sales LIKE 'zatca_qr'");
    if(!colZatcaQr.length){ await conn.query("ALTER TABLE sales ADD COLUMN zatca_qr TEXT NULL AFTER zatca_hash"); }
    
    const [colZatcaSubmitted] = await conn.query("SHOW COLUMNS FROM sales LIKE 'zatca_submitted'");
    if(!colZatcaSubmitted.length){ await conn.query("ALTER TABLE sales ADD COLUMN zatca_submitted DATETIME NULL AFTER zatca_qr"); }
    
    const [colZatcaStatus] = await conn.query("SHOW COLUMNS FROM sales LIKE 'zatca_status'");
    if(!colZatcaStatus.length){ await conn.query("ALTER TABLE sales ADD COLUMN zatca_status ENUM('pending','submitted','accepted','rejected') NULL DEFAULT 'pending' AFTER zatca_submitted"); }

    // سبب الرفض من هيئة الزكاة (نخزنه لعرضه لاحقًا)
    const [colZatcaRej] = await conn.query("SHOW COLUMNS FROM sales LIKE 'zatca_rejection_reason'");
    if(!colZatcaRej.length){ await conn.query("ALTER TABLE sales ADD COLUMN zatca_rejection_reason TEXT NULL AFTER zatca_status"); }
    
    // آخر رد من هيئة الزكاة (للرجوع إليه سواء نجاح أو فشل)
    const [colZatcaResp] = await conn.query("SHOW COLUMNS FROM sales LIKE 'zatca_response'");
    if(!colZatcaResp.length){ await conn.query("ALTER TABLE sales ADD COLUMN zatca_response LONGTEXT NULL AFTER zatca_rejection_reason"); }

    // Track user who created the sale (for deletion constraints)
    const [colCById] = await conn.query("SHOW COLUMNS FROM sales LIKE 'created_by_user_id'");
    if(!colCById.length){ await conn.query("ALTER TABLE sales ADD COLUMN created_by_user_id INT NULL AFTER order_no"); }
    const [colCByName] = await conn.query("SHOW COLUMNS FROM sales LIKE 'created_by_username'");
    if(!colCByName.length){ await conn.query("ALTER TABLE sales ADD COLUMN created_by_username VARCHAR(64) NULL AFTER created_by_user_id"); }

    const [colPS2] = await conn.query("SHOW COLUMNS FROM sales LIKE 'payment_status'");
    if(colPS2.length){
      const col = colPS2[0];
      if(!String(col.Type).includes('partial')){
        await conn.query("ALTER TABLE sales MODIFY payment_status ENUM('unpaid','partial','paid') NOT NULL DEFAULT 'paid'");
      }
    }

    const [colPaidAmt] = await conn.query("SHOW COLUMNS FROM sales LIKE 'paid_amount'");
    if(!colPaidAmt.length){ 
      await conn.query("ALTER TABLE sales ADD COLUMN paid_amount DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER grand_total");
      await conn.query("UPDATE sales SET paid_amount = grand_total WHERE payment_status = 'paid'");
      await conn.query("UPDATE sales SET paid_amount = 0 WHERE payment_status = 'unpaid'");
    }
    const [colRemAmt] = await conn.query("SHOW COLUMNS FROM sales LIKE 'remaining_amount'");
    if(!colRemAmt.length){ 
      await conn.query("ALTER TABLE sales ADD COLUMN remaining_amount DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER paid_amount");
      await conn.query("UPDATE sales SET remaining_amount = 0 WHERE payment_status = 'paid'");
      await conn.query("UPDATE sales SET remaining_amount = grand_total WHERE payment_status = 'unpaid'");
    }

    // Link sales to shifts
    const [colShiftId] = await conn.query("SHOW COLUMNS FROM sales LIKE 'shift_id'");
    if(!colShiftId.length){
      await conn.query("ALTER TABLE sales ADD COLUMN shift_id INT NULL AFTER id");
      try{
        await conn.query("ALTER TABLE sales ADD CONSTRAINT fk_sales_shift FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE SET NULL");
        await conn.query("CREATE INDEX idx_shift_id ON sales(shift_id)");
      }catch(_){}
    }

    await conn.query(`
      CREATE TABLE IF NOT EXISTS payment_transactions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        sale_id INT NOT NULL,
        amount DECIMAL(12,2) NOT NULL,
        payment_method VARCHAR(32) NOT NULL,
        cash_received DECIMAL(12,2) NULL,
        notes VARCHAR(255) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_by_user_id INT NULL,
        created_by_username VARCHAR(64) NULL,
        FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
        INDEX idx_sale_id (sale_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Optimized composite indexes for common queries (900k+ invoices)
    // These replace single-column indexes for better performance
    try{
      const [idxDateDocType] = await conn.query("SHOW INDEX FROM sales WHERE Key_name='idx_date_doctype_status'");
      if(!idxDateDocType.length){ 
        await conn.query("CREATE INDEX idx_date_doctype_status ON sales(created_at DESC, doc_type, payment_status)"); 
      }
    }catch(_){ }
    
    try{
      const [idxInvoiceNo] = await conn.query("SHOW INDEX FROM sales WHERE Key_name='idx_invoice_no'");
      if(!idxInvoiceNo.length){ await conn.query("CREATE INDEX idx_invoice_no ON sales(invoice_no)"); }
    }catch(_){ }
    
    try{
      const [idxCustomerIdDate] = await conn.query("SHOW INDEX FROM sales WHERE Key_name='idx_customer_id_date'");
      if(!idxCustomerIdDate.length){ 
        await conn.query("CREATE INDEX idx_customer_id_date ON sales(customer_id, created_at DESC)"); 
      }
    }catch(_){ }
    
    try{
      const [idxPaymentStatus] = await conn.query("SHOW INDEX FROM sales WHERE Key_name='idx_payment_status_date'");
      if(!idxPaymentStatus.length){ 
        await conn.query("CREATE INDEX idx_payment_status_date ON sales(payment_status, created_at DESC)"); 
      }
    }catch(_){ }
    
    try{
      const [idxUserId] = await conn.query("SHOW INDEX FROM sales WHERE Key_name='idx_user_id_date'");
      if(!idxUserId.length){ 
        await conn.query("CREATE INDEX idx_user_id_date ON sales(created_by_user_id, created_at DESC)"); 
      }
    }catch(_){ }
    
    // Legacy single-column indexes cleanup (can be removed after composite indexes are in place)
    try{ await conn.query("DROP INDEX idx_created_at ON sales"); }catch(_){ }
    try{ await conn.query("DROP INDEX idx_created_by_user_id ON sales"); }catch(_){ }
    try{ await conn.query("DROP INDEX idx_doc_type ON sales"); }catch(_){ }
    try{ await conn.query("DROP INDEX idx_customer_id ON sales"); }catch(_){ }
    try{ await conn.query("DROP INDEX idx_customer_phone ON sales"); }catch(_){ }
    try{ await conn.query("DROP INDEX idx_customer_name ON sales"); }catch(_){ }
    try{ await conn.query("DROP INDEX idx_customer_vat ON sales"); }catch(_){ }
    try{ await conn.query("DROP INDEX idx_payment_method ON sales"); }catch(_){ }
    try{ await conn.query("DROP INDEX idx_payment_status ON sales"); }catch(_){ }
    try{ await conn.query("DROP INDEX idx_zatca_status ON sales"); }catch(_){ }
    try{ await conn.query("DROP INDEX idx_customer_date ON sales"); }catch(_){ }

    await conn.query(`
      CREATE TABLE IF NOT EXISTS sales_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        sale_id INT NOT NULL,
        product_id INT NOT NULL,
        name VARCHAR(255) NOT NULL,
        description VARCHAR(255) NULL,
        unit_name VARCHAR(64) NULL,
        unit_multiplier DECIMAL(12,3) NOT NULL DEFAULT 1,
        price DECIMAL(12,2) NOT NULL,
        qty DECIMAL(12,3) NOT NULL,
        line_total DECIMAL(12,2) NOT NULL,
        operation_id INT NULL,
        operation_name VARCHAR(128) NULL,
        FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    // ترقية الجداول القديمة: إضافة عمود الوصف/الوحدة إن لم تكن موجودة
    const [colDesc] = await conn.query("SHOW COLUMNS FROM sales_items LIKE 'description'");
    if(!colDesc.length){
      await conn.query("ALTER TABLE sales_items ADD COLUMN description VARCHAR(255) NULL AFTER name");
    }
    const [colUnitName] = await conn.query("SHOW COLUMNS FROM sales_items LIKE 'unit_name'");
    if(!colUnitName.length){
      await conn.query("ALTER TABLE sales_items ADD COLUMN unit_name VARCHAR(64) NULL AFTER description");
    }
    const [colUnitMult] = await conn.query("SHOW COLUMNS FROM sales_items LIKE 'unit_multiplier'");
    if(!colUnitMult.length){
      await conn.query("ALTER TABLE sales_items ADD COLUMN unit_multiplier DECIMAL(12,3) NOT NULL DEFAULT 1 AFTER unit_name");
    }
    // تأكد من وجود أعمدة العملية عند الترقية القديمة
    const [colOpIdEnsure] = await conn.query("SHOW COLUMNS FROM sales_items LIKE 'operation_id'");
    if(!colOpIdEnsure.length){ await conn.query("ALTER TABLE sales_items ADD COLUMN operation_id INT NULL AFTER line_total"); }
    const [colOpNameEnsure] = await conn.query("SHOW COLUMNS FROM sales_items LIKE 'operation_name'");
    if(!colOpNameEnsure.length){ await conn.query("ALTER TABLE sales_items ADD COLUMN operation_name VARCHAR(128) NULL AFTER operation_id"); }
    // تأكد من وجود عمود الموظف المرتبط بالصنف
    const [colEmpIdEnsure] = await conn.query("SHOW COLUMNS FROM sales_items LIKE 'employee_id'");
    if(!colEmpIdEnsure.length){ await conn.query("ALTER TABLE sales_items ADD COLUMN employee_id INT NULL AFTER operation_name"); }
    // ترقية عمود الكمية ليكون عشري بثلاث منازل إذا كان قديمًا (INT)
    try{
      const [colQty] = await conn.query("SHOW COLUMNS FROM sales_items LIKE 'qty'");
      if(colQty && colQty.length){
        const t = String(colQty[0].Type||'').toLowerCase();
        if(!t.includes('decimal')){
          await conn.query("ALTER TABLE sales_items MODIFY qty DECIMAL(12,3) NOT NULL");
        }
      }
    }catch(_){ /* ignore */ }
    
    // Add indexes to sales_items for performance
    try{
      const [idxSaleId] = await conn.query("SHOW INDEX FROM sales_items WHERE Key_name='idx_sale_id'");
      if(!idxSaleId.length){ await conn.query("CREATE INDEX idx_sale_id ON sales_items(sale_id)"); }
    }catch(_){ }
    
    try{
      const [idxProductId] = await conn.query("SHOW INDEX FROM sales_items WHERE Key_name='idx_product_id'");
      if(!idxProductId.length){ await conn.query("CREATE INDEX idx_product_id ON sales_items(product_id)"); }
    }catch(_){ }
  }

  async function getNextSequentialNo(conn){
    // Ensure a tiny key-value table to store running counters
    await conn.query(`CREATE TABLE IF NOT EXISTS app_counters (
      name VARCHAR(64) PRIMARY KEY,
      value INT NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);
    // Initialize if missing
    await conn.query(`INSERT IGNORE INTO app_counters (name, value) VALUES ('invoice_seq', 0)`);
    
    // Auto-fix: ensure counter is not behind existing invoices (for imported data)
    // Check only once per session to avoid performance impact
    if (!invoiceCounterChecked) {
      const [[maxRow]] = await conn.query(`
        SELECT COALESCE(MAX(CAST(invoice_no AS UNSIGNED)), 0) as max_invoice
        FROM sales 
        WHERE invoice_no REGEXP '^[0-9]+$'
      `);
      const maxInvoice = Number(maxRow.max_invoice || 0);
      // If counter is behind, update it to max invoice number
      await conn.query(`UPDATE app_counters SET value = GREATEST(value, ?) WHERE name='invoice_seq'`, [maxInvoice]);
      invoiceCounterChecked = true; // Mark as checked
    }
    
    // Atomically increment and fetch
    await conn.query(`UPDATE app_counters SET value = value + 1 WHERE name='invoice_seq'`);
    const [[row]] = await conn.query(`SELECT value FROM app_counters WHERE name='invoice_seq'`);
    return Number(row.value || 1);
  }

  async function getNextOrderNo(conn){
    // Order number that resets ONLY when the next occurrence of the configured closing hour is reached
    // Persist anchor (last reset start) and current value in a small state table
    await conn.query(`CREATE TABLE IF NOT EXISTS app_state (
      k VARCHAR(64) PRIMARY KEY,
      sval VARCHAR(255) NULL,
      ival INT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);

    // read closing hour (HH:MM) from settings or default to 00:00
    let closing = '00:00';
    try{
      const [[st]] = await conn.query('SELECT closing_hour FROM app_settings WHERE id=1');
      if(st && st.closing_hour){ closing = String(st.closing_hour).slice(0,5); }
    }catch(_){ }
    const [hh, mm] = (closing||'00:00').split(':').map(v=>Number(v||0));

    // lock/read state rows (works safely inside outer transaction)
    const [rows] = await conn.query("SELECT k, sval, ival FROM app_state WHERE k IN ('order_seq_anchor','order_seq_value') FOR UPDATE");
    const map = new Map(rows.map(r => [r.k, r]));
    const now = new Date();

    function dateAtHHMM(date, H, M){ const d = new Date(date); d.setHours(H||0, M||0, 0, 0); return d; }

    // initialize anchor if missing (use the same logic as old behavior but store it once)
    let anchorStr = map.get('order_seq_anchor')?.sval || null;
    let anchor = anchorStr ? new Date(anchorStr) : null;
    if(!anchor || isNaN(anchor.getTime())){
      const todayClosing = dateAtHHMM(now, hh, mm);
      anchor = (now < todayClosing) ? new Date(todayClosing.getTime() - 24*60*60*1000) : todayClosing;
      await conn.query("INSERT INTO app_state (k, sval, ival) VALUES ('order_seq_anchor', ?, NULL) ON DUPLICATE KEY UPDATE sval=VALUES(sval)", [anchor.toISOString()]);
      map.set('order_seq_anchor', { k:'order_seq_anchor', sval: anchor.toISOString(), ival: null });
    }

    // compute next boundary according to CURRENT closing hour, but do not reset until we actually reach it
    let boundary = dateAtHHMM(anchor, hh, mm);
    if(boundary <= anchor){ boundary = new Date(boundary.getTime() + 24*60*60*1000); }

    // get current counter value
    let curVal = Number(map.get('order_seq_value')?.ival || 0);

    // if we have crossed the boundary, reset (and move anchor forward to that boundary)
    if(now >= boundary){
      anchor = boundary; // start of new cycle
      curVal = 0;
      await conn.query("INSERT INTO app_state (k, sval, ival) VALUES ('order_seq_anchor', ?, NULL) ON DUPLICATE KEY UPDATE sval=VALUES(sval)", [anchor.toISOString()]);
      await conn.query("INSERT INTO app_state (k, sval, ival) VALUES ('order_seq_value', NULL, 0) ON DUPLICATE KEY UPDATE ival=VALUES(ival)");
    }

    // increment and persist
    curVal = Number(curVal) + 1;
    await conn.query("INSERT INTO app_state (k, sval, ival) VALUES ('order_seq_value', NULL, ?) ON DUPLICATE KEY UPDATE ival=VALUES(ival)", [curVal]);
    return curVal;
  }

  function genInvoiceNoFromSeq(seq){
    // Simple sequential number starting from 1 (no padding)
    return String(seq);
  }

  // Reset all sales and restart invoice sequence with options
  ipcMain.handle('sales:reset_all', async (_evt, options) => {
    const opts = options || {};
    const resetSales = opts.resetSales === true;
    const resetPurchaseInvoices = opts.resetPurchaseInvoices === true;
    const resetPurchases = opts.resetPurchases === true;
    const resetSupplierBalance = opts.resetSupplierBalance === true;
    const resetProducts = opts.resetProducts === true;
    const resetCustomers = opts.resetCustomers === true;
    const resetQuotations = opts.resetQuotations === true;
    const resetShifts = opts.resetShifts === true;
    
    try{
      const conn = await dbAdapter.getConnection();
      try{
        await ensureTables(conn);
        await conn.beginTransaction();
        
        // Delete sales if selected
        if(resetSales){
          await conn.query('DELETE FROM sales');
          try{ await conn.query('ALTER TABLE sales AUTO_INCREMENT = 1'); }catch(_){ }
          try{ await conn.query('ALTER TABLE sales_items AUTO_INCREMENT = 1'); }catch(_){ }
          await conn.query(`CREATE TABLE IF NOT EXISTS app_counters (name VARCHAR(64) PRIMARY KEY, value INT NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);
          await conn.query(`INSERT IGNORE INTO app_counters (name, value) VALUES ('invoice_seq', 0)`);
          await conn.query(`UPDATE app_counters SET value = 0 WHERE name='invoice_seq'`);
          try{ 
            await conn.query(`DELETE FROM vouchers WHERE voucher_type = 'receipt'`);
            await conn.query(`DELETE FROM voucher_counters WHERE voucher_type = 'receipt'`);
          }catch(_){}
        }
        
        // Delete purchase invoices if selected
        if(resetPurchaseInvoices){
          await conn.query('DELETE FROM purchase_payments');
          await conn.query('DELETE FROM purchase_invoice_details');
          await conn.query('DELETE FROM purchase_invoices');
          await conn.query('ALTER TABLE purchase_invoices AUTO_INCREMENT = 1');
          await conn.query('ALTER TABLE purchase_invoice_details AUTO_INCREMENT = 1');
          await conn.query('ALTER TABLE purchase_payments AUTO_INCREMENT = 1');
          try{ 
            await conn.query(`DELETE FROM vouchers WHERE voucher_type = 'payment'`);
            await conn.query(`DELETE FROM voucher_counters WHERE voucher_type = 'payment'`);
          }catch(_){}
        }
        
        // Delete simple purchases if selected
        if(resetPurchases){
          await conn.query('DELETE FROM purchases');
          await conn.query('ALTER TABLE purchases AUTO_INCREMENT = 1');
        }
        
        // Reset supplier balance if selected
        if(resetSupplierBalance){
          await conn.query('UPDATE suppliers SET balance = 0');
        }
        
        // Delete products if selected
        if(resetProducts){
          await conn.query('SET FOREIGN_KEY_CHECKS = 0');
          try{ await conn.query('DELETE FROM product_operations'); }catch(_){}
          try{ await conn.query('DELETE FROM operations'); }catch(_){}
          try{ await conn.query('DELETE FROM product_variants'); }catch(_){}
          try{ await conn.query('DELETE FROM product_units'); }catch(_){}
          try{ await conn.query('DELETE FROM products'); }catch(_){}
          try{ await conn.query('DELETE FROM main_types'); }catch(_){}
          await conn.query('SET FOREIGN_KEY_CHECKS = 1');
          try{ await conn.query('ALTER TABLE product_operations AUTO_INCREMENT = 1'); }catch(_){}
          try{ await conn.query('ALTER TABLE operations AUTO_INCREMENT = 1'); }catch(_){}
          try{ await conn.query('ALTER TABLE product_variants AUTO_INCREMENT = 1'); }catch(_){}
          try{ await conn.query('ALTER TABLE product_units AUTO_INCREMENT = 1'); }catch(_){}
          try{ await conn.query('ALTER TABLE products AUTO_INCREMENT = 1'); }catch(_){}
          try{ await conn.query('ALTER TABLE main_types AUTO_INCREMENT = 1'); }catch(_){}
        }
        
        // Delete customers if selected
        if(resetCustomers){
          await conn.query('DELETE FROM customers');
          await conn.query('ALTER TABLE customers AUTO_INCREMENT = 1');
        }
        
        // Delete quotations if selected
        if(resetQuotations){
          try{ 
            await conn.query('DELETE FROM quotations');
            await conn.query('ALTER TABLE quotations AUTO_INCREMENT = 1');
          }catch(_){}
        }
        
        // Delete shifts if selected
        if(resetShifts){
          try{ 
            await conn.query('DELETE FROM shifts');
            await conn.query('ALTER TABLE shifts AUTO_INCREMENT = 1');
          }catch(_){}
        }
        
        await conn.commit();
        return { ok:true };
      } catch(e){ await conn.rollback(); throw e; }
      finally { conn.release(); }
    }catch(e){ console.error(e); return { ok:false, error:'فشل تنفيذ العملية' }; }
  });

  ipcMain.handle('sales:create', async (_e, payload) => {
    const p = payload || {};
    if(!Array.isArray(p.items) || p.items.length===0){ return { ok:false, error:'لا توجد عناصر' }; }
    if(!p.payment_method){ return { ok:false, error:'طريقة الدفع مطلوبة' }; }
    try{
      const conn = await dbAdapter.getConnection();
      try{
        await ensureTables(conn);

        // قراءة إعداد السماح بالبيع عند المخزون = 0 (0 = منع، 1 = سماح)
        let allowZero = 0;
        try{
          const [[s]] = await conn.query('SELECT allow_sell_zero_stock FROM app_settings WHERE id=1');
          allowZero = s ? Number(s.allow_sell_zero_stock||0) : 0;
        }catch(_){ allowZero = 0; }
        // قفل/بدء معاملة لضمان سلامة المخزون
        await conn.beginTransaction();

        // تحقق من توافر مخزون المنتج ثم خصمه — دعم الوحدات (qty_display * multiplier)
        // عند وجود صنف (variant_id) يتم ضرب كمية الخصم في معامل خصم مخزون الصنف stock_deduct_multiplier
        for(const it of p.items){
          const pid = Number(it.product_id||0);
          // qty في الحمولة هو كمية العرض في الوحدة المختارة؛ حولها إلى الأساس بالمضاعف إن وُجد
          const qtyDisplay = Number(it.qty||1);
          const unitMult = (it && it.unit_multiplier!=null) ? Number(it.unit_multiplier||1) : 1;

          // معامل خصم المخزون للصنف (إن وُجد)، افتراضيًا 1
          let variantMult = 1;
          try{
            const vid = Number(it.variant_id||0);
            if(vid){
              const [[vr]] = await conn.query('SELECT stock_deduct_multiplier FROM product_variants WHERE id=? LIMIT 1', [vid]);
              if(vr && vr.stock_deduct_multiplier != null){
                const m = Number(vr.stock_deduct_multiplier);
                // لا تسمح بقيم سالبة/غير رقمية؛ استخدم 1 كافتراضي
                variantMult = (Number.isFinite(m) && m > 0) ? m : 1;
              }
            }
          }catch(_){ /* في حال فشل الجلب، نُبقي المعامل = 1 */ }

          const qtyBase = Number((qtyDisplay * unitMult * variantMult).toFixed(3));
          if(!pid || qtyBase<=0) continue;
          // احجز الصف أثناء القراءة لضمان الدقة في التوازي
          const [[prod]] = await conn.query('SELECT id, name, stock FROM products WHERE id=? FOR UPDATE', [pid]);
          if(!prod){ await conn.rollback(); return { ok:false, error:`المنتج غير موجود (ID ${pid})` }; }
          const cur = Number(prod.stock||0);
          const after = cur - qtyBase;
          // إذا كان السماح بالبيع عند الصفر غير مُفعّل، امنع عندما يصبح المخزون < 0
          if(!allowZero && after < 0){ await conn.rollback(); return { ok:false, error:`لا يمكن إتمام البيع لعدم كفاية المخزون: - ID ${pid} (المتاح ${cur} / المطلوب ${qtyBase})` }; }
          // خصم المخزون (يسمح بالسالب فقط إذا allowZero مفعّل ويجوز أن ينزل تحت الصفر)
          await conn.query('UPDATE products SET stock = stock - ? WHERE id=?', [qtyBase, pid]);
        }

        // تأكد من وجود عمود extra_value
        const [colExtra] = await conn.query("SHOW COLUMNS FROM sales LIKE 'extra_value'");
        if(!colExtra.length){
          await conn.query("ALTER TABLE sales ADD COLUMN extra_value DECIMAL(12,2) NULL AFTER sub_total");
        }
        const seq = await getNextSequentialNo(conn);
        const invoiceNo = genInvoiceNoFromSeq(seq);
        const orderNo = await getNextOrderNo(conn);
        // Ensure coupon columns exist
        const [colCCode] = await conn.query("SHOW COLUMNS FROM sales LIKE 'coupon_code'");
        if(!colCCode.length){ await conn.query("ALTER TABLE sales ADD COLUMN coupon_code VARCHAR(64) NULL AFTER discount_amount"); }
        const [colCMode] = await conn.query("SHOW COLUMNS FROM sales LIKE 'coupon_mode'");
        if(!colCMode.length){ await conn.query("ALTER TABLE sales ADD COLUMN coupon_mode VARCHAR(16) NULL AFTER coupon_code"); }
        const [colCVal] = await conn.query("SHOW COLUMNS FROM sales LIKE 'coupon_value'");
        if(!colCVal.length){ await conn.query("ALTER TABLE sales ADD COLUMN coupon_value DECIMAL(12,2) NULL AFTER coupon_mode"); }
        
        // Ensure global offer columns exist
        const [colGOMode] = await conn.query("SHOW COLUMNS FROM sales LIKE 'global_offer_mode'");
        if(!colGOMode.length){ await conn.query("ALTER TABLE sales ADD COLUMN global_offer_mode VARCHAR(16) NULL AFTER coupon_value"); }
        const [colGOVal] = await conn.query("SHOW COLUMNS FROM sales LIKE 'global_offer_value'");
        if(!colGOVal.length){ await conn.query("ALTER TABLE sales ADD COLUMN global_offer_value DECIMAL(12,2) NULL AFTER global_offer_mode"); }

        // Snapshot customer fields inside invoice for reliable search
        let snapName = (p.customer_name || null);
        let snapPhone = null;
        let snapVat = null;
        let snapEmail = null;
        let snapAddress = null;
        let snapCR = null;
        let snapNatAddr = null;
        let snapPostal = null;
        let snapStreet = null;
        let snapSub = null;
        let snapNotes = null;
        if(p.customer_id){
          try{
            const [[cust]] = await conn.query('SELECT name, phone, vat_number, email, address, cr_number, national_address, postal_code, street_number, sub_number, notes FROM customers WHERE id=? LIMIT 1', [p.customer_id]);
            if(cust){
              if(!snapName) snapName = cust.name || null;
              snapPhone = cust.phone || null;
              snapVat = cust.vat_number || null;
              snapEmail = cust.email || null;
              snapAddress = cust.address || null;
              snapCR = cust.cr_number || null;
              snapNatAddr = cust.national_address || null;
              snapPostal = cust.postal_code || null;
              snapStreet = cust.street_number || null;
              snapSub = cust.sub_number || null;
              snapNotes = cust.notes || null;
            }
          }catch(_){ /* ignore */ }
        }

        // derive payment_status based on method (credit -> unpaid, otherwise paid)
        const payStatus = (String(p.payment_method).toLowerCase()==='credit') ? 'unpaid' : 'paid';

        // Ensure tobacco fee column exists
        const [colTobacco] = await conn.query("SHOW COLUMNS FROM sales LIKE 'tobacco_fee'");
        if(!colTobacco.length){ await conn.query("ALTER TABLE sales ADD COLUMN tobacco_fee DECIMAL(12,2) NULL AFTER extra_value"); }

        // Ensure driver columns exist
        const [colDrvIdIns] = await conn.query("SHOW COLUMNS FROM sales LIKE 'driver_id'");
        if(!colDrvIdIns.length){ await conn.query("ALTER TABLE sales ADD COLUMN driver_id INT NULL AFTER customer_vat"); }
        const [colDrvNameIns] = await conn.query("SHOW COLUMNS FROM sales LIKE 'driver_name'");
        if(!colDrvNameIns.length){ await conn.query("ALTER TABLE sales ADD COLUMN driver_name VARCHAR(255) NULL AFTER driver_id"); }
        const [colDrvPhoneIns] = await conn.query("SHOW COLUMNS FROM sales LIKE 'driver_phone'");
        if(!colDrvPhoneIns.length){ await conn.query("ALTER TABLE sales ADD COLUMN driver_phone VARCHAR(64) NULL AFTER driver_name"); }

        // snapshot driver
        let drvName = null, drvPhone = null; let drvId = (p.driver_id || null);
        if(p.driver_id){
          try{
            const [[drv]] = await conn.query('SELECT id, name, phone FROM drivers WHERE id=? LIMIT 1', [Number(p.driver_id)]);
            if(drv){ drvName = drv.name || null; drvPhone = drv.phone || null; }
          }catch(_){ }
        }

        // التحقق من عدم وجود رقم فاتورة مكرر، وإذا كان مكرراً نولد رقم جديد
        let finalInvoiceNo = invoiceNo;
        let attempts = 0;
        const maxAttempts = 50;
        while(attempts < maxAttempts){
          const [[existing]] = await conn.query('SELECT id FROM sales WHERE invoice_no = ? LIMIT 1', [finalInvoiceNo]);
          if(!existing) break;
          attempts++;
          const newSeq = await getNextSequentialNo(conn);
          finalInvoiceNo = genInvoiceNoFromSeq(newSeq);
        }
        if(attempts >= maxAttempts){
          await conn.rollback();
          return { ok:false, error:'فشل توليد رقم فاتورة فريد بعد عدة محاولات' };
        }

        let shiftId = (p.shift_id != null ? Number(p.shift_id) : null);
        if(!shiftId && p.created_by_user_id){
          try{
            const [[openShift]] = await conn.query('SELECT id FROM shifts WHERE user_id = ? AND status = "open" ORDER BY opened_at DESC LIMIT 1', [p.created_by_user_id]);
            if(openShift) shiftId = openShift.id;
          }catch(_){}
        }

        const [res] = await conn.query(`INSERT INTO sales (shift_id, invoice_no, order_no, created_by_user_id, created_by_username, customer_id, customer_name, customer_phone, customer_vat, customer_email, customer_address, customer_cr_number, customer_national_address, customer_postal_code, customer_street_number, customer_sub_number, customer_notes, driver_id, driver_name, driver_phone, payment_method, payment_status, sub_total, extra_value, tobacco_fee, vat_total, grand_total, total_after_discount, notes, discount_type, discount_value, discount_amount, coupon_code, coupon_mode, coupon_value, global_offer_mode, global_offer_value, pay_cash_amount, pay_card_amount) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
          shiftId,
          finalInvoiceNo,
          Number(orderNo||1),
          (p.created_by_user_id != null ? Number(p.created_by_user_id) : null),
          (p.created_by_username || null),
          (p.customer_id || null),
          snapName,
          snapPhone,
          snapVat,
          snapEmail,
          snapAddress,
          snapCR,
          snapNatAddr,
          snapPostal,
          snapStreet,
          snapSub,
          snapNotes,
          drvId,
          drvName,
          drvPhone,
          p.payment_method,
          payStatus,
          Number(p.sub_total||0),
          (p.extra_value != null ? Number(p.extra_value) : null),
          (p.tobacco_fee != null ? Number(p.tobacco_fee) : null),
          Number(p.vat_total||0),
          Number(p.grand_total||0),
          (p.sub_after_discount != null ? Number(p.sub_after_discount) : null),
          p.notes || null,
          (p.discount_type || null),
          (p.discount_value != null ? Number(p.discount_value) : null),
          (p.discount_amount != null ? Number(p.discount_amount) : null),
          (p.coupon?.code || null),
          (p.coupon?.mode || null),
          (p.coupon?.value != null ? Number(p.coupon.value) : null),
          (p.global_offer?.mode || null),
          (p.global_offer?.value != null ? Number(p.global_offer.value) : null),
          (p.pay_cash_amount != null ? Number(p.pay_cash_amount) : null),
          (p.pay_card_amount != null ? Number(p.pay_card_amount) : null)
        ]);
        const saleId = res.insertId;
        // تأكد من أعمدة العملية في جدول البنود
        const [colOpId] = await conn.query("SHOW COLUMNS FROM sales_items LIKE 'operation_id'");
        if(!colOpId.length){ await conn.query("ALTER TABLE sales_items ADD COLUMN operation_id INT NULL AFTER description"); }
        const [colOpName] = await conn.query("SHOW COLUMNS FROM sales_items LIKE 'operation_name'");
        if(!colOpName.length){ await conn.query("ALTER TABLE sales_items ADD COLUMN operation_name VARCHAR(128) NULL AFTER operation_id"); }
        const items = p.items.map(it => [
          saleId,
          it.product_id,
          it.name,
          (it.description || null),
          (it.unit_name || null),
          Number(it.unit_multiplier ?? 1),
          Number(it.price||0),
          Number(it.qty||1),
          Number(it.line_total||0),
          (it.operation_id || null),
          (it.operation_name || null),
          (it.employee_id || null)
        ]);
        if(items.length){
          await conn.query(`INSERT INTO sales_items (sale_id, product_id, name, description, unit_name, unit_multiplier, price, qty, line_total, operation_id, operation_name, employee_id) VALUES ?`, [items]);
        }

        // لا يوجد BOM: لا نستخدم product_bom أو inventory_items هنا

        // Update shift totals if linked to a shift
        if(shiftId){
          try{
            const grandTotal = Number(p.grand_total || 0);
            let cashAmount = 0;
            let cardAmount = 0;
            
            if(p.payment_method === 'cash'){
              cashAmount = grandTotal;
            } else if(p.payment_method === 'card' || p.payment_method === 'tamara' || p.payment_method === 'tabby'){
              cardAmount = grandTotal;
            } else if(p.payment_method === 'mixed'){
              cashAmount = Number(p.pay_cash_amount || 0);
              cardAmount = Number(p.pay_card_amount || 0);
            }
            
            await conn.query(`
              UPDATE shifts 
              SET 
                total_invoices = total_invoices + 1,
                total_sales = total_sales + ?,
                cash_sales = cash_sales + ?,
                card_sales = card_sales + ?
              WHERE id = ?
            `, [grandTotal, cashAmount, cardAmount, shiftId]);
          }catch(updateErr){
            console.error('Failed to update shift totals:', updateErr);
          }
        }

        await conn.commit();
        // Notify all windows that sales changed (new invoice)
        try{
          const { BrowserWindow } = require('electron');
          BrowserWindow.getAllWindows().forEach(w => w.webContents.send('sales:changed', { action: 'created', sale_id: saleId, invoice_no: finalInvoiceNo }));
        }catch(_){ }
        return { ok:true, invoice_no: finalInvoiceNo, sale_id: saleId, order_no: Number(orderNo||null) || null };
      } catch (e) {
        try{ await conn.rollback(); }catch(_){ }
        throw e;
      } finally { conn.release(); }
    }catch(e){ console.error(e); return { ok:false, error:'فشل حفظ الفاتورة' }; }
  });

  ipcMain.handle('sales:list', async (_e, query) => {
    // If Secondary device, fetch from API
    if (isSecondaryDevice()) {
      try {
        const result = await fetchFromAPI('/invoices', query || {});
        return { ok: true, items: result.invoices || [], total: result.invoices?.length || 0 };
      } catch (err) {
        return { ok: false, error: err.message };
      }
    }

    // Primary device: execute SQL query
    const q = query || {};
    const terms = [];
    const params = [];
    // Pagination parameters
    const page = Math.max(1, Number(q.page) || 1);
    let pageSize = Number(q.pageSize);
    if (pageSize === 0) {
      // 0 means get all records (for export)
      pageSize = 0;
    } else if (!pageSize || pageSize < 0) {
      pageSize = 20;
    } else if (pageSize > 100000) {
      pageSize = 100000;
    }
    const offset = (page - 1) * (pageSize || 0);
    // extra customer_q filter (phone/name/tax) — search inside invoice snapshot and customers
    if(q.customer_q){
      const v = '%' + String(q.customer_q).trim() + '%';
      terms.push('(s.customer_phone LIKE ? OR s.customer_vat LIKE ? OR s.customer_name LIKE ? OR c.phone LIKE ? OR c.name LIKE ? OR c.vat_number LIKE ?)');
      params.push(v, v, v, v, v, v);
    }
    // backward-compat: explicit invoice_no filter
    if(q.invoice_no){
      terms.push('s.invoice_no LIKE ?');
      params.push('%' + q.invoice_no + '%');
    }
    // filter by document type if requested
    if(q.type === 'credit'){
      terms.push("s.doc_type='credit_note'");
    } else if(q.type === 'invoice'){
      terms.push("(s.doc_type IS NULL OR s.doc_type='invoice')");
    }
    // filter by customer id if provided
    if(q.customer_id){ terms.push('s.customer_id = ?'); params.push(Number(q.customer_id)); }
    // filter by user id (creator) if provided
    if(q.user_id){ terms.push('s.created_by_user_id = ?'); params.push(Number(q.user_id)); }
    // only customers: include invoices that have a customer linked (by id or name snapshot)
    if(q.customers_only){ terms.push('(s.customer_id IS NOT NULL OR s.customer_name IS NOT NULL)'); }
    try{
      const conn = await dbAdapter.getConnection();
      try{
        await ensureTables(conn);

        // If free-text provided
        if(q.q){
          const toAsciiDigits = (s) => String(s||'').replace(/[\u0660-\u0669]/g, d => String(d.charCodeAt(0) - 0x0660)).replace(/[\u06F0-\u06F9]/g, d => String(d.charCodeAt(0) - 0x06F0));
          const raw = String(q.q).trim();
          const qstr = toAsciiDigits(raw);
          const digitsOnly = /^[0-9]+$/.test(qstr);
          if(digitsOnly){
            // Try invoice exact match first
            const [exRows] = await conn.query('SELECT s.*, c.name AS disp_customer_name, c.phone AS disp_customer_phone FROM sales s LEFT JOIN customers c ON c.id = s.customer_id WHERE s.invoice_no = ? LIMIT 1', [qstr]);
            if(exRows.length){ return { ok:true, items: exRows, total: 1, page, pageSize }; }
            // numeric equality ignoring leading zeros
            const n = Number(qstr);
            if(!Number.isNaN(n)){
              const [exCast] = await conn.query('SELECT s.*, c.name AS disp_customer_name, c.phone AS disp_customer_phone FROM sales s LEFT JOIN customers c ON c.id = s.customer_id WHERE CAST(s.invoice_no AS UNSIGNED) = ? LIMIT 1', [n]);
              if(exCast.length){ return { ok:true, items: exCast, total: 1, page, pageSize }; }
            }
            // No invoice exact match -> fallback to fuzzy (to allow phone search by digits)
            const v = '%' + qstr + '%';
            terms.push('(s.invoice_no LIKE ? OR s.payment_method LIKE ? OR s.customer_name LIKE ? OR s.customer_phone LIKE ? OR s.customer_vat LIKE ? OR c.phone LIKE ? OR c.name LIKE ? OR c.vat_number LIKE ?)');
            params.push(v, v, v, v, v, v, v, v);
          } else {
            // Fuzzy across multiple fields (text search)
            const v = '%' + qstr + '%';
            terms.push('(s.invoice_no LIKE ? OR s.payment_method LIKE ? OR s.customer_name LIKE ? OR s.customer_phone LIKE ? OR s.customer_vat LIKE ? OR c.phone LIKE ? OR c.name LIKE ? OR c.vat_number LIKE ?)');
            params.push(v, v, v, v, v, v, v, v);
          }
        }

        // datetime filters (from/to). Accepts 'YYYY-MM-DD' or full 'YYYY-MM-DD HH:MM' formats
        if(q.date_from){ terms.push('s.created_at >= ?'); params.push(q.date_from); }
        if(q.date_to){ terms.push('s.created_at <= ?'); params.push(q.date_to); }
        const where = terms.length ? ('WHERE ' + terms.join(' AND ')) : '';
        
        // Optimized count strategy for large tables (300k+ records)
        const hasFilters = q.q || q.customer_q || q.invoice_no || q.customer_id || q.user_id || q.date_from || q.date_to || q.customers_only;
        const needsJoinForCount = q.customer_q && String(q.customer_q).trim();
        let total = 0;
        
        if (!hasFilters && q.type === 'invoice') {
          // Ultra-fast estimation: use MySQL table stats for unfiltered invoice list
          // This is approximate but instant for large tables
          const [statsRows] = await conn.query(`
            SELECT TABLE_ROWS 
            FROM information_schema.TABLES 
            WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'sales'
          `, [DB_NAME]);
          total = Math.floor((statsRows[0]?.TABLE_ROWS || 0) * 0.95);
        } else if (needsJoinForCount) {
          // Need JOIN because search includes customer table fields
          const countSql = `SELECT COUNT(DISTINCT s.id) as total FROM sales s LEFT JOIN customers c ON c.id = s.customer_id ${where}`;
          const [countRows] = await conn.query(countSql, params);
          total = countRows[0]?.total || 0;
        } else {
          // Fast count: only sales table (no JOIN needed)
          // Build count query with only sales table conditions
          const countTerms = [];
          const countParams = [];
          
          if(q.invoice_no){
            countTerms.push('s.invoice_no LIKE ?');
            countParams.push('%' + q.invoice_no + '%');
          }
          if(q.type === 'credit'){
            countTerms.push("s.doc_type='credit_note'");
          } else if(q.type === 'invoice'){
            countTerms.push("(s.doc_type IS NULL OR s.doc_type='invoice')");
          }
          if(q.customer_id){ countTerms.push('s.customer_id = ?'); countParams.push(Number(q.customer_id)); }
          if(q.user_id){ countTerms.push('s.created_by_user_id = ?'); countParams.push(Number(q.user_id)); }
          if(q.customers_only){ countTerms.push('(s.customer_id IS NOT NULL OR s.customer_name IS NOT NULL)'); }
          if(q.date_from){ countTerms.push('s.created_at >= ?'); countParams.push(q.date_from); }
          if(q.date_to){ countTerms.push('s.created_at <= ?'); countParams.push(q.date_to); }
          
          // Add free-text search if exists (only sales fields)
          if(q.q){
            const toAsciiDigits = (s) => String(s||'').replace(/[\u0660-\u0669]/g, d => String(d.charCodeAt(0) - 0x0660)).replace(/[\u06F0-\u06F9]/g, d => String(d.charCodeAt(0) - 0x06F0));
            const qstr = toAsciiDigits(String(q.q).trim());
            const v = '%' + qstr + '%';
            countTerms.push('(s.invoice_no LIKE ? OR s.payment_method LIKE ? OR s.customer_name LIKE ? OR s.customer_phone LIKE ? OR s.customer_vat LIKE ?)');
            countParams.push(v, v, v, v, v);
          }
          
          const countWhere = countTerms.length ? ('WHERE ' + countTerms.join(' AND ')) : '';
          const countSql = `SELECT COUNT(*) as total FROM sales s ${countWhere}`;
          const [countRows] = await conn.query(countSql, countParams);
          total = countRows[0]?.total || 0;
        }
        
        // Get paginated data - use STRAIGHT_JOIN hint for better performance with large tables
        let sql = `SELECT s.*, c.name AS disp_customer_name, c.phone AS disp_customer_phone
                   FROM sales s 
                   LEFT JOIN customers c ON c.id = s.customer_id 
                   ${where} 
                   ORDER BY s.id DESC`;
        if (pageSize > 0) {
          sql += ` LIMIT ? OFFSET ?`;
          const [rows] = await conn.query(sql, [...params, pageSize, offset]);
          return { ok:true, items: rows, total, page, pageSize };
        } else {
          // Get all records (no pagination)
          const [rows] = await conn.query(sql, params);
          return { ok:true, items: rows, total, page: 1, pageSize: 0 };
        }
      } finally { conn.release(); }
    }catch(e){ console.error(e); return { ok:false, error:'تعذر تحميل الفواتير' }; }
  });

  // List invoices by user with optional date range and aggregation
  ipcMain.handle('sales:list_by_user', async (_e, query) => {
    const q = query || {};
    const params = [];
    const terms = [];
    // Optional filter by creator user id
    if(q.user_id){ terms.push('s.created_by_user_id = ?'); params.push(Number(q.user_id)); }
    // Normalize date-only inputs to full-day bounds
    const normFrom = q.date_from && /^\d{4}-\d{2}-\d{2}$/.test(q.date_from) ? (q.date_from + ' 00:00:00') : q.date_from;
    const normTo = q.date_to && /^\d{4}-\d{2}-\d{2}$/.test(q.date_to) ? (q.date_to + ' 23:59:59') : q.date_to;
    if(normFrom){ terms.push('s.created_at >= ?'); params.push(normFrom); }
    if(normTo){ terms.push('s.created_at <= ?'); params.push(normTo); }
    // Include invoices and credit notes
    terms.push("(s.doc_type IS NULL OR s.doc_type IN ('invoice','credit_note'))");
    const where = terms.length ? ('WHERE ' + terms.join(' AND ')) : '';
    try{
      const conn = await dbAdapter.getConnection();
      try{
        await ensureTables(conn);
        // Detailed list
        const sqlItems = `SELECT s.id, s.invoice_no, s.created_at, s.doc_type, s.payment_method, s.payment_status,
                                 s.grand_total, s.total_after_discount, s.pay_cash_amount, s.pay_card_amount,
                                 s.created_by_user_id, s.created_by_username
                          FROM sales s ${where}
                          ORDER BY s.created_at DESC, s.id DESC
                          LIMIT 1000`;
        const [items] = await conn.query(sqlItems, params);
        // Aggregation by user
        const sqlAgg = `SELECT s.created_by_user_id, s.created_by_username,
                               COUNT(*) AS invoices_count,
                               SUM(CASE WHEN s.doc_type='credit_note' THEN 0 ELSE 1 END) AS normal_count,
                               SUM(s.grand_total) AS total_grand,
                               SUM(CASE WHEN s.doc_type='credit_note' THEN s.grand_total ELSE 0 END) AS total_credit_notes,
                               SUM(CASE WHEN s.doc_type='credit_note' THEN 0 ELSE s.grand_total END) AS total_invoices,
                               SUM(s.pay_cash_amount) AS total_cash,
                               SUM(s.pay_card_amount) AS total_card
                        FROM sales s ${where}
                        GROUP BY s.created_by_user_id, s.created_by_username
                        ORDER BY total_grand DESC`;
        const [summary] = await conn.query(sqlAgg, params);
        return { ok:true, items, summary };
      } finally { conn.release(); }
    }catch(e){ console.error(e); return { ok:false, error:'تعذر تحميل تقرير المستخدمين' }; }
  });
  
  // List credit invoices with filters
  // Mode: by default returns unpaid (credit) invoices. If q.settled_only=true, returns processed (paid) former-credit invoices filtered by settled_at.
  ipcMain.handle('sales:list_credit', async (_e, query) => {
    // If Secondary device, fetch from API
    if (isSecondaryDevice()) {
      try {
        const result = await fetchFromAPI('/credit-invoices', query || {});
        return { ok: true, items: result.invoices || [], total: result.invoices?.length || 0 };
      } catch (err) {
        return { ok: false, error: err.message };
      }
    }

    const q = query || {};
    const settledOnly = (q.settled_only === true || q.settled_only === 'true');
    const terms = ["s.doc_type='invoice'"];
    if(settledOnly){
      terms.push("s.payment_status='paid'");
      terms.push("s.settled_method IS NOT NULL");
    } else {
      terms.push("s.payment_method='credit'");
      terms.push("(s.payment_status='unpaid' OR s.payment_status='partial')");
    }
    let pageSize = Number(q.pageSize) || 500;
    if (pageSize <= 0) pageSize = 500;
    if (pageSize > 100000) pageSize = 100000;
    const params = [];
    try{
      const conn = await dbAdapter.getConnection();
      try{
        await ensureTables(conn);

        // If free-text provided
        if(q.q){
          const toAsciiDigits = (s) => String(s||'').replace(/[\u0660-\u0669]/g, d => String(d.charCodeAt(0) - 0x0660)).replace(/[\u06F0-\u06F9]/g, d => String(d.charCodeAt(0) - 0x06F0));
          const raw = String(q.q).trim();
          const qstr = toAsciiDigits(raw);
          const digitsOnly = /^[0-9]+$/.test(qstr);
          const baseWhere = settledOnly ? "AND s.payment_status='paid' AND s.settled_method IS NOT NULL" : "AND s.payment_method='credit' AND s.payment_status='unpaid'";
          if(digitsOnly){
            // Try exact invoice within scope
            const [exRows] = await conn.query(`SELECT s.* FROM sales s WHERE s.invoice_no = ? ${baseWhere} LIMIT 1`, [qstr]);
            if(exRows.length){ return { ok:true, items: exRows }; }
            const n = Number(qstr);
            if(!Number.isNaN(n)){
              const [exCast] = await conn.query(`SELECT s.* FROM sales s WHERE CAST(s.invoice_no AS UNSIGNED) = ? ${baseWhere} LIMIT 1`, [n]);
              if(exCast.length){ return { ok:true, items: exCast }; }
            }
            // Fallback fuzzy
            const v = '%' + qstr + '%';
            terms.push('(s.invoice_no LIKE ? OR s.customer_name LIKE ? OR s.customer_phone LIKE ? OR s.customer_vat LIKE ?)');
            params.push(v, v, v, v);
          } else {
            const v = '%' + qstr + '%';
            terms.push('(s.invoice_no LIKE ? OR s.customer_name LIKE ? OR s.customer_phone LIKE ? OR s.customer_vat LIKE ?)');
            params.push(v, v, v, v);
          }
        }

        if(q.customer_q){
          const v2 = '%' + String(q.customer_q).trim() + '%';
          terms.push('(s.customer_phone LIKE ? OR s.customer_vat LIKE ? OR s.customer_name LIKE ?)');
          params.push(v2, v2, v2);
        }
        // Normalize date-only inputs to full-day bounds
        const normFrom = q.date_from && /^\d{4}-\d{2}-\d{2}$/.test(q.date_from) ? (q.date_from + ' 00:00:00') : q.date_from;
        const normTo = q.date_to && /^\d{4}-\d{2}-\d{2}$/.test(q.date_to) ? (q.date_to + ' 23:59:59') : q.date_to;
        if(settledOnly){
          if(normFrom){ terms.push('s.settled_at >= ?'); params.push(normFrom); }
          if(normTo){ terms.push('s.settled_at <= ?'); params.push(normTo); }
        } else {
          if(normFrom){ terms.push('s.created_at >= ?'); params.push(normFrom); }
          if(normTo){ terms.push('s.created_at <= ?'); params.push(normTo); }
        }
        const where = 'WHERE ' + terms.join(' AND ');

        const sql = `SELECT s.* FROM sales s ${where} ORDER BY s.id DESC LIMIT ?`;
        const [rows] = await conn.query(sql, [...params, pageSize]);
        return { ok:true, items: rows };
      } finally { conn.release(); }
    }catch(e){ console.error(e); return { ok:false, error:'تعذر تحميل فواتير الآجل' }; }
  });

  // List credit notes (CN) with base invoice details within a date range
  ipcMain.handle('sales:list_credit_notes', async (_e, query) => {
    // If Secondary device, fetch from API
    if (isSecondaryDevice()) {
      try {
        const result = await fetchFromAPI('/credit-notes', query || {});
        return { ok: true, items: result.credit_notes || [], total: result.credit_notes?.length || 0 };
      } catch (err) {
        return { ok: false, error: err.message };
      }
    }

    const q = query || {};
    const terms = ["(s.doc_type='credit_note' OR s.invoice_no LIKE 'CN-%')"];
    let pageSize = Number(q.pageSize) || 500;
    if (pageSize <= 0) pageSize = 500;
    if (pageSize > 100000) pageSize = 100000;
    const params = [];
    try{
      const conn = await dbAdapter.getConnection();
      try{
        await ensureTables(conn);
        // check if ref_base_sale_id exists to enable base join
        let hasRef = true;
        try{
          const [cols] = await conn.query("SHOW COLUMNS FROM sales LIKE 'ref_base_sale_id'");
          hasRef = Array.isArray(cols) && cols.length > 0;
        }catch(_){ hasRef = false; }

        // Free-text search across CN and base (if available)
        if(q.q){
          const toAsciiDigits = (s) => String(s||'').replace(/[\u0660-\u0669]/g, d => String(d.charCodeAt(0) - 0x0660)).replace(/[\u06F0-\u06F9]/g, d => String(d.charCodeAt(0) - 0x06F0));
          const raw = String(q.q).trim();
          const qstr = toAsciiDigits(raw);
          const v = '%' + qstr + '%';
          if(hasRef){
            terms.push('(s.invoice_no LIKE ? OR s.customer_name LIKE ? OR s.customer_phone LIKE ? OR s.customer_vat LIKE ? OR base.invoice_no LIKE ? OR base.customer_name LIKE ? OR base.customer_phone LIKE ? OR base.customer_vat LIKE ?)');
            params.push(v, v, v, v, v, v, v, v);
          } else {
            terms.push('(s.invoice_no LIKE ? OR s.customer_name LIKE ? OR s.customer_phone LIKE ? OR s.customer_vat LIKE ?)');
            params.push(v, v, v, v);
          }
        }

        if(q.customer_q){
          const v2 = '%' + String(q.customer_q).trim() + '%';
          if(hasRef){
            terms.push('(s.customer_phone LIKE ? OR s.customer_vat LIKE ? OR s.customer_name LIKE ? OR base.customer_phone LIKE ? OR base.customer_vat LIKE ? OR base.customer_name LIKE ?)');
            params.push(v2, v2, v2, v2, v2, v2);
          } else {
            terms.push('(s.customer_phone LIKE ? OR s.customer_vat LIKE ? OR s.customer_name LIKE ?)');
            params.push(v2, v2, v2);
          }
        }

        // Date filters on CN creation time (reporting period)
        const normFrom = q.date_from && /^\d{4}-\d{2}-\d{2}$/.test(q.date_from) ? (q.date_from + ' 00:00:00') : q.date_from;
        const normTo = q.date_to && /^\d{4}-\d{2}-\d{2}$/.test(q.date_to) ? (q.date_to + ' 23:59:59') : q.date_to;
        if(normFrom){ terms.push('s.created_at >= ?'); params.push(normFrom); }
        if(normTo){ terms.push('s.created_at <= ?'); params.push(normTo); }

        const where = 'WHERE ' + terms.join(' AND ');
        const baseSelect = hasRef ? ", base.invoice_no AS base_invoice_no, base.created_at AS base_created_at, base.grand_total AS base_grand_total, base.id AS base_id" : ", NULL AS base_invoice_no, NULL AS base_created_at, NULL AS base_grand_total, NULL AS base_id";
        const join = hasRef ? 'LEFT JOIN sales base ON base.id = s.ref_base_sale_id' : '';
        const sql = `SELECT s.* ${baseSelect} FROM sales s ${join} ${where} ORDER BY s.id DESC LIMIT ?`;
        const [rows] = await conn.query(sql, [...params, pageSize]);
        return { ok:true, items: rows };
      } finally { conn.release(); }
    }catch(e){ console.error(e); return { ok:false, error:'تعذر تحميل إشعارات الدائن' }; }
  });

  ipcMain.handle('sales:settle_partial', async (_e, payload) => {
    try{
      const p = payload || {};
      const id = Number(p.sale_id||0);
      const amount = Number(p.amount||0);
      const method = String(p.method||'').toLowerCase();
      const okMethod = ['cash','card','tamara','tabby'].includes(method);
      const cash = (method==='cash') ? Number(p.cash_received||0) : null;
      const notes = String(p.notes||'').trim() || null;
      const userId = p.user_id || null;
      const username = p.username || null;
      
      if(!id){ return { ok:false, error:'رقم الفاتورة مفقود' }; }
      if(!okMethod){ return { ok:false, error:'طريقة سداد غير صالحة' }; }
      if(!amount || amount <= 0){ return { ok:false, error:'المبلغ غير صحيح' }; }
      
      const conn = await dbAdapter.getConnection();
      try{
        await ensureTables(conn);
        await conn.beginTransaction();
        
        const [[sale]] = await conn.query('SELECT * FROM sales WHERE id=? LIMIT 1', [id]);
        if(!sale){ await conn.rollback(); return { ok:false, error:'الفاتورة غير موجودة' }; }
        if(String(sale.payment_method).toLowerCase() !== 'credit'){ await conn.rollback(); return { ok:false, error:'ليست فاتورة آجل' }; }
        if(String(sale.payment_status||'paid') === 'paid'){ await conn.rollback(); return { ok:false, error:'الفاتورة مدفوعة بالكامل' }; }
        
        const grandTotal = Number(sale.grand_total||0);
        const currentPaid = Number(sale.paid_amount||0);
        const currentRemaining = Number(sale.remaining_amount||0);
        const actualRemaining = currentRemaining > 0 ? currentRemaining : (grandTotal - currentPaid);
        
        if(amount > actualRemaining + 0.01){ 
          await conn.rollback(); 
          return { ok:false, error: `المبلغ أكبر من المتبقي (${actualRemaining.toFixed(2)} ريال)` }; 
        }
        
        const newPaid = currentPaid + amount;
        const newRemaining = grandTotal - newPaid;
        const newStatus = (newRemaining <= 0.01) ? 'paid' : 'partial';
        
        await conn.query(
          'INSERT INTO payment_transactions (sale_id, amount, payment_method, cash_received, notes, created_by_user_id, created_by_username) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [id, amount, method, cash, notes, userId, username]
        );
        
        await conn.query(
          'UPDATE sales SET paid_amount=?, remaining_amount=?, payment_status=? WHERE id=?',
          [newPaid, newRemaining, newStatus, id]
        );
        
        if(newStatus === 'paid'){
          // تحويل الفاتورة من آجل إلى طريقة الدفع المستخدمة (كاش، شبكة، إلخ)
          await conn.query('UPDATE sales SET payment_method=?, settled_at=NOW(), settled_method=? WHERE id=?', [method, method, id]);
          // تحديث حقول الدفع المنفصلة (للتقارير)
          if(method==='cash'){
            await conn.query('UPDATE sales SET pay_cash_amount = grand_total, pay_card_amount = NULL WHERE id=?', [id]);
          } else if(method==='card' || method==='tamara' || method==='tabby'){
            await conn.query('UPDATE sales SET pay_cash_amount = NULL, pay_card_amount = grand_total WHERE id=?', [id]);
          }
        }
        
        await conn.commit();
        
        try{
          const { BrowserWindow } = require('electron');
          BrowserWindow.getAllWindows().forEach(w => w.webContents.send('sales:changed', { action: 'partial_payment', sale_id: id, amount, method }));
        }catch(_){ }
        
        return { ok:true, sale_id: id, amount, new_paid: newPaid, new_remaining: newRemaining, status: newStatus };
      } catch(err){
        await conn.rollback();
        throw err;
      } finally { conn.release(); }
    }catch(e){ console.error(e); return { ok:false, error:'تعذر تسجيل الدفعة' }; }
  });

  ipcMain.handle('sales:get_payments', async (_e, saleId) => {
    try{
      const id = Number(saleId||0);
      if(!id){ return { ok:false, error:'رقم الفاتورة مفقود' }; }
      
      const conn = await dbAdapter.getConnection();
      try{
        await ensureTables(conn);
        
        const [payments] = await conn.query(
          'SELECT * FROM payment_transactions WHERE sale_id=? ORDER BY created_at DESC',
          [id]
        );
        
        return { ok:true, payments };
      } finally { conn.release(); }
    }catch(e){ console.error(e); return { ok:false, error:'تعذر تحميل سجل الدفعات' }; }
  });

  // List payment transactions within a date range (for reports)
  ipcMain.handle('sales:list_payments', async (_e, q) => {
    try{
      const query = q || {};
      const from = query.date_from ? String(query.date_from) : null;
      const to = query.date_to ? String(query.date_to) : null;
      const saleId = query.sale_id ? Number(query.sale_id) : null;
      const methods = Array.isArray(query.methods) ? query.methods.map(m => String(m).toLowerCase()) : null;

      const conn = await dbAdapter.getConnection();
      try{
        await ensureTables(conn);
        const terms = [];
        const params = [];
        if(from){ terms.push('created_at >= ?'); params.push(from); }
        if(to){ terms.push('created_at <= ?'); params.push(to); }
        if(saleId){ terms.push('sale_id = ?'); params.push(saleId); }
        if(methods && methods.length){
          terms.push(`LOWER(payment_method) IN (${methods.map(()=>'?').join(',')})`);
          params.push(...methods);
        }
        const where = terms.length ? ('WHERE ' + terms.join(' AND ')) : '';
        const sql = `SELECT * FROM payment_transactions ${where} ORDER BY created_at ASC`;
        const [rows] = await conn.query(sql, params);
        return { ok:true, items: rows };
      } finally { conn.release(); }
    }catch(e){ console.error(e); return { ok:false, error:'تعذر تحميل الدفعات' }; }
  });

  // Settle a credit invoice fully (convert to immediate method)
  ipcMain.handle('sales:settle_full', async (_e, payload) => {
    try{
      const p = payload || {}; const id = Number(p.sale_id||0);
      const method = String(p.method||'').toLowerCase();
      const okMethod = ['cash','card','tamara','tabby'].includes(method);
      if(!id){ return { ok:false, error:'رقم الفاتورة مفقود' }; }
      if(!okMethod){ return { ok:false, error:'طريقة سداد غير صالحة' }; }
      const cash = (method==='cash') ? Math.max(0, Number(p.cash||0)) : null;
      const conn = await dbAdapter.getConnection();
      try{
        await ensureTables(conn);
        const [[sale]] = await conn.query('SELECT * FROM sales WHERE id=? LIMIT 1', [id]);
        if(!sale){ return { ok:false, error:'الفاتورة غير موجودة' }; }
        if(String(sale.payment_method).toLowerCase() !== 'credit'){ return { ok:false, error:'ليست فاتورة آجل' }; }
        if(String(sale.payment_status||'paid') === 'paid'){ return { ok:false, error:'الفاتورة مدفوعة مسبقًا' }; }
        // For CASH settlement, store amount in settled_cash. For CARD/Tamara/Tabby, set to NULL.
        // Update method and settlement info
        await conn.query('UPDATE sales SET payment_method=?, payment_status="paid", settled_at=NOW(), settled_method=?, settled_cash=?, paid_amount=grand_total, remaining_amount=0 WHERE id=?', [method, method, (method==='cash'?cash:null), id]);
        // Also set split fields for simple methods to aid reports
        if(method==='cash'){
          await conn.query('UPDATE sales SET pay_cash_amount = grand_total, pay_card_amount = NULL WHERE id=?', [id]);
        } else if(method==='card' || method==='tamara' || method==='tabby'){
          await conn.query('UPDATE sales SET pay_cash_amount = NULL, pay_card_amount = grand_total WHERE id=?', [id]);
        }
        // Notify update
        try{
          const { BrowserWindow } = require('electron');
          BrowserWindow.getAllWindows().forEach(w => w.webContents.send('sales:changed', { action: 'settled', sale_id: id, method, cash: (cash||0) }));
        }catch(_){ }
        return { ok:true, sale_id: id, method, cash: (cash||0) };
      } finally { conn.release(); }
    }catch(e){ console.error(e); return { ok:false, error:'تعذر تسوية الفاتورة' }; }
  });

  ipcMain.handle('sales:get', async (_e, id) => {
    const sid = (id && id.id) ? id.id : id;
    if(!sid) return { ok:false, error:'معرّف مفقود' };

    // If Secondary device, fetch from API
    if (isSecondaryDevice()) {
      try {
        const result = await fetchFromAPI(`/invoices/${sid}`);
        if (!result.ok) return { ok: false, error: result.error || 'فشل جلب الفاتورة' };
        return { ok: true, invoice: result.invoice, items: result.items || [] };
      } catch (err) {
        return { ok: false, error: err.message };
      }
    }

    try{
      const conn = await dbAdapter.getConnection();
      try{
        await ensureTables(conn);
        // ensure driver columns exist
        const [colDrvId] = await conn.query("SHOW COLUMNS FROM sales LIKE 'driver_id'");
        if(!colDrvId.length){ await conn.query("ALTER TABLE sales ADD COLUMN driver_id INT NULL AFTER customer_vat"); }
        const [colDrvName] = await conn.query("SHOW COLUMNS FROM sales LIKE 'driver_name'");
        if(!colDrvName.length){ await conn.query("ALTER TABLE sales ADD COLUMN driver_name VARCHAR(255) NULL AFTER driver_id"); }
        const [colDrvPhone] = await conn.query("SHOW COLUMNS FROM sales LIKE 'driver_phone'");
        if(!colDrvPhone.length){ await conn.query("ALTER TABLE sales ADD COLUMN driver_phone VARCHAR(64) NULL AFTER driver_name"); }

        const [[sale]] = await conn.query('SELECT * FROM sales WHERE id=? LIMIT 1', [sid]);
        // backward-compat: if order_no is null and this is a normal invoice, try to infer a reasonable order_no from date bucket
        try{
          if(sale && (sale.order_no == null) && (String(sale.doc_type||'invoice') !== 'credit_note')){
            // derive closing hour
            let closing = '00:00';
            try{ const [[st]] = await conn.query('SELECT closing_hour FROM app_settings WHERE id=1'); if(st && st.closing_hour){ closing = String(st.closing_hour).slice(0,5); } }catch(_){ }
            const [hh, mm] = (closing||'00:00').split(':').map(v=>Number(v||0));
            const created = new Date(sale.created_at);
            const curStart = new Date(created); curStart.setHours(hh||0, mm||0, 0, 0);
            let dayStart = curStart; if(created < curStart){ dayStart = new Date(curStart); dayStart.setDate(curStart.getDate()-1); }
            // count number of invoices since that dayStart
            const y = dayStart.getFullYear(); const m = String(dayStart.getMonth()+1).padStart(2,'0'); const d = String(dayStart.getDate()).padStart(2,'0');
            const startStr = `${y}-${m}-${d} ${String(hh||0).toString().padStart(2,'0')}:${String(mm||0).toString().padStart(2,'0')}:00`;
            const [[cnt]] = await conn.query("SELECT COUNT(*) AS c FROM sales WHERE (doc_type IS NULL OR doc_type='invoice') AND created_at >= ? AND id <= ?", [startStr, Number(sid)]);
            const ord = Number(cnt?.c||0);
            if(ord > 0){ sale.order_no = ord; }
          }
        }catch(_){ }
        if(!sale) return { ok:false, error:'الفاتورة غير موجودة' };
        const [items] = await conn.query('SELECT si.*, p.is_tobacco, p.category, p.name_en, COALESCE(pv.barcode, p.barcode) AS barcode, e.name as employee_name FROM sales_items si LEFT JOIN products p ON p.id = si.product_id LEFT JOIN product_variants pv ON pv.id = si.operation_id LEFT JOIN employees e ON e.id = si.employee_id WHERE si.sale_id=?', [sid]);
        return { ok:true, sale, items };
      } finally { conn.release(); }
    }catch(e){ console.error(e); return { ok:false, error:'تعذر جلب الفاتورة' }; }
  });

  // Get refunded quantities for a sale
  ipcMain.handle('sales:get_refunded_quantities', async (_e, saleId) => {
    const sid = Number(saleId||0);
    if(!sid) return { ok:false, error:'معرّف مفقود' };
    try{
      const conn = await dbAdapter.getConnection();
      try{
        await ensureTables(conn);
        
        // جلب كل credit notes المرتبطة بهذه الفاتورة
        const [creditNotes] = await conn.query('SELECT id FROM sales WHERE ref_base_sale_id=? AND doc_type=?', [sid, 'credit_note']);
        
        if(!creditNotes.length) return { ok:true, refunded: {} };
        
        const cnIds = creditNotes.map(cn => cn.id);
        
        // جلب كل أصناف credit notes
        const [items] = await conn.query('SELECT product_id, qty, operation_id, unit_multiplier, price FROM sales_items WHERE sale_id IN (?)', [cnIds]);
        
        // حساب الكميات المرتجعة لكل منتج/عملية/وحدة/سعر (القيم سالبة في credit notes، نحولها لموجبة)
        const refunded = {};
        const keyOf = (it) => {
          const pid = Number(it.product_id||0);
          const op = (it.operation_id==null) ? 'null' : String(it.operation_id);
          const mult = Number(it.unit_multiplier ?? 1);
          const price = Math.abs(Number(it.price||0));
          return `${pid}|${op}|${mult}|${price}`;
        };
        items.forEach(item => {
          const key = keyOf(item);
          const qty = Math.abs(Number(item.qty||0));
          refunded[key] = (refunded[key]||0) + qty;
        });
        
        return { ok:true, refunded };
      } finally { conn.release(); }
    }catch(e){ console.error(e); return { ok:false, error:'تعذر جلب الكميات المرتجعة' }; }
  });

  // Check if an invoice already has a credit note
  ipcMain.handle('sales:has_credit_for_invoice', async (_e, payload) => {
    try{
      const inv = String((payload && (payload.invoice_no||payload.no||payload.q)) || '').trim();
      if(!inv){ return { ok:false, error:'رقم الفاتورة مفقود' }; }
      const conn = await dbAdapter.getConnection();
      try{
        await ensureTables(conn);
        // حاول المطابقة الدقيقة أولاً
        const [[sale]] = await conn.query('SELECT * FROM sales WHERE invoice_no = ? LIMIT 1', [inv]);
        if(!sale){ return { ok:false, error:'لم يتم العثور على الفاتورة' }; }
        const credit_unpaid = (String(sale.payment_method).toLowerCase()==='credit' && String(sale.payment_status||'paid')!=='paid');
        // افحص وجود إشعارات دائن مرتبطة بهذه الفاتورة
        const [creditNotes] = await conn.query("SELECT id, invoice_no FROM sales WHERE doc_type='credit_note' AND ref_base_sale_id=?", [Number(sale.id)]);
        if(creditNotes.length){
          const cnIds = creditNotes.map(cn => cn.id);
          const [refItems] = await conn.query('SELECT product_id, qty, operation_id, unit_multiplier, price FROM sales_items WHERE sale_id IN (?)', [cnIds]);
          const refunded = {};
          const keyOf = (it) => {
            const pid = Number(it.product_id||0);
            const op = (it.operation_id==null) ? 'null' : String(it.operation_id);
            const mult = Number(it.unit_multiplier ?? 1);
            const price = Number(it.price||0);
            return `${pid}|${op}|${mult}|${price}`;
          };
          refItems.forEach(item => {
            const key = keyOf(item);
            const qty = Math.abs(Number(item.qty||0));
            refunded[key] = (refunded[key]||0) + qty;
          });
          const [baseItems] = await conn.query('SELECT product_id, qty, operation_id, unit_multiplier, price FROM sales_items WHERE sale_id=?', [Number(sale.id)]);
          let fullyRefunded = baseItems.length ? true : true;
          baseItems.forEach(item => {
            const key = keyOf(item);
            const originalQty = Math.abs(Number(item.qty||0));
            const remaining = originalQty - Number(refunded[key]||0);
            if(remaining > 0){ fullyRefunded = false; }
          });
          const firstCn = creditNotes[0];
          if(fullyRefunded){
            return { ok:true, processed:true, credit_id: firstCn.id, credit_invoice_no: firstCn.invoice_no, base_id: sale.id, payment_method: sale.payment_method, payment_status: sale.payment_status, credit_unpaid };
          }
          return { ok:true, processed:false, credit_id: firstCn.id, credit_invoice_no: firstCn.invoice_no, base_id: sale.id, payment_method: sale.payment_method, payment_status: sale.payment_status, credit_unpaid };
        }
        return { ok:true, processed:false, base_id: sale.id, payment_method: sale.payment_method, payment_status: sale.payment_status, credit_unpaid };
      } finally { conn.release(); }
    }catch(e){ console.error(e); return { ok:false, error:'فشل التحقق من حالة الفاتورة' }; }
  });

  // Summarize sold items (qty and amount) within a period
  ipcMain.handle('sales:items_summary', async (_e, query) => {
    const q = query || {};
    // Accept either date_from/date_to or from_at/to_at
    const from = q.date_from || q.from_at || null;
    const to = q.date_to || q.to_at || null;
    const terms = [];
    const params = [];
    if(from){ terms.push('s.created_at >= ?'); params.push(from); }
    if(to){ terms.push('s.created_at <= ?'); params.push(to); }
    // Treat NULL doc_type as 'invoice'
    terms.push("(s.doc_type IS NULL OR s.doc_type IN ('invoice','credit_note'))");
    const where = terms.length ? ('WHERE ' + terms.join(' AND ')) : '';
    try{
      const conn = await dbAdapter.getConnection();
      try{
        await ensureTables(conn);
        const sql = `SELECT si.product_id, si.name, SUM(si.qty) AS qty_total, SUM(si.line_total) AS amount_total
                     FROM sales_items si INNER JOIN sales s ON s.id = si.sale_id
                     ${where}
                     GROUP BY si.product_id, si.name
                     ORDER BY SUM(si.qty) DESC`;
        const [rows] = await conn.query(sql, params);
        return { ok:true, items: rows };
      } finally { conn.release(); }
    }catch(e){ console.error(e); return { ok:false, error:'تعذر تجميع أصناف المبيعات' }; }
  });

  // Detailed sold items within a period, with optional tobacco-only filter
  ipcMain.handle('sales:items_detailed', async (_e, query) => {
    const q = query || {};
    const from = q.date_from || q.from_at || null;
    const to = q.date_to || q.to_at || null;
    const onlyTobacco = !!q.only_tobacco;
    const terms = [];
    const params = [];
    if(from){ terms.push('s.created_at >= ?'); params.push(from); }
    if(to){ terms.push('s.created_at <= ?'); params.push(to); }
    terms.push("(s.doc_type IS NULL OR s.doc_type IN ('invoice','credit_note'))");
    if(onlyTobacco){ terms.push('(p.is_tobacco = 1)'); }
    const where = terms.length ? ('WHERE ' + terms.join(' AND ')) : '';
    try{
      const conn = await dbAdapter.getConnection();
      try{
        await ensureTables(conn);
        const sql = `
          SELECT si.id, si.sale_id, s.invoice_no, s.created_at, s.doc_type, s.payment_method,
                 si.product_id, si.name, si.description, si.operation_name, si.price, si.qty, si.line_total,
                 p.category, p.is_tobacco
          FROM sales_items si
          INNER JOIN sales s ON s.id = si.sale_id
          LEFT JOIN products p ON p.id = si.product_id
          ${where}
          ORDER BY s.created_at DESC, s.id DESC, si.id ASC`;
        const [rows] = await conn.query(sql, params);
        return { ok:true, items: rows };
      } finally { conn.release(); }
    }catch(e){ console.error(e); return { ok:false, error:'تعذر جلب تفصيل الأصناف' }; }
  });

  // Refund full invoice: restock and create negative sale entry (credit note)
  ipcMain.handle('sales:refund_full', async (_e, payload) => {
    const p = payload || {}; const id = Number(p.sale_id||0);
    if(!id) return { ok:false, error:'رقم الفاتورة مفقود' };
    try{
      const conn = await dbAdapter.getConnection();
      try{
        await ensureTables(conn);
        await conn.beginTransaction();

        const [[sale]] = await conn.query('SELECT * FROM sales WHERE id=? FOR UPDATE', [id]);
        if(!sale){ await conn.rollback(); return { ok:false, error:'الفاتورة غير موجودة' }; }

        // منع معالجة الإشعارات الدائنة
        if(String(sale.doc_type||'invoice') === 'credit_note'){
          await conn.rollback();
          return { ok:false, error:'لا يمكن معالجة إشعار دائن. يمكن فقط معالجة الفواتير العادية' };
        }

        const [items] = await conn.query('SELECT * FROM sales_items WHERE sale_id=?', [id]);
        // إعادة المخزون للمنتجات (بدون BOM)
        for(const it of items){
          const pid = Number(it.product_id||0);
          const qtyDisp = Number(it.qty||0);
          const mult = (it.unit_multiplier!=null) ? Number(it.unit_multiplier||1) : 1;
          const qtyBase = Number((qtyDisp * mult).toFixed(3));
          if(!pid || qtyBase<=0) continue;
          await conn.query('UPDATE products SET stock = stock + ? WHERE id=?', [qtyBase, pid]);
        }

        // أنشئ قيد فاتورة سالبة كإشعار دائن
        // منع التكرار وربط الإشعار بالفاتورة الأساسية
        const [colRefId] = await conn.query("SHOW COLUMNS FROM sales LIKE 'ref_base_sale_id'");
        if(!colRefId.length){ await conn.query("ALTER TABLE sales ADD COLUMN ref_base_sale_id INT NULL AFTER doc_type"); }
        const [colRefNo] = await conn.query("SHOW COLUMNS FROM sales LIKE 'ref_base_invoice_no'");
        if(!colRefNo.length){ await conn.query("ALTER TABLE sales ADD COLUMN ref_base_invoice_no VARCHAR(32) NULL AFTER ref_base_sale_id"); }
        
        // حذف UNIQUE INDEX القديم إذا كان موجوداً (لم يعد مطلوباً مع دعم المعالجة الجزئية المتعددة)
        try{
          const [idx] = await conn.query("SHOW INDEX FROM sales WHERE Key_name='uniq_ref_base_sale'");
          if(idx.length){ await conn.query("DROP INDEX uniq_ref_base_sale ON sales"); }
        }catch(_){ /* ignore index errors */ }
        
        const [[already]] = await conn.query("SELECT id FROM sales WHERE doc_type='credit_note' AND ref_base_sale_id=? LIMIT 1", [Number(sale.id||id)]);
        if(already){ await conn.rollback(); return { ok:false, error:'تم عمل معالجة كاملة لهذه الفاتورة من قبل (استخدم المعالجة الجزئية للإرجاعات المتعددة)' }; }
        // منع معالجة فاتورة آجل غير مسددة
        const isCreditUnpaid = (String(sale.payment_method).toLowerCase()==='credit' && String(sale.payment_status||'paid')!=='paid');
        if(isCreditUnpaid){ await conn.rollback(); return { ok:false, error:'هذه فاتورة آجل غير مسددة ولا يمكن عمل معالجة لها قبل السداد' }; }
        // تسلسل خاص بإشعارات الدائن يبدأ من 1
        const [[cnRow]] = await conn.query("SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_no, 4) AS UNSIGNED)), 0) AS max_no FROM sales WHERE doc_type='credit_note' AND invoice_no LIKE 'CN-%'");
        const cnNo = String(Number(cnRow?.max_no||0) + 1);
        // تأكد من الأعمدة الإضافية في sales
        const [colExtra] = await conn.query("SHOW COLUMNS FROM sales LIKE 'extra_value'"); if(!colExtra.length){ await conn.query("ALTER TABLE sales ADD COLUMN extra_value DECIMAL(12,2) NULL AFTER sub_total"); }
        const [colTob] = await conn.query("SHOW COLUMNS FROM sales LIKE 'tobacco_fee'"); if(!colTob.length){ await conn.query("ALTER TABLE sales ADD COLUMN tobacco_fee DECIMAL(12,2) NULL AFTER extra_value"); }
        const [colCouponCode] = await conn.query("SHOW COLUMNS FROM sales LIKE 'coupon_code'"); if(!colCouponCode.length){ await conn.query("ALTER TABLE sales ADD COLUMN coupon_code VARCHAR(64) NULL AFTER discount_amount"); }
        const [colCouponMode] = await conn.query("SHOW COLUMNS FROM sales LIKE 'coupon_mode'"); if(!colCouponMode.length){ await conn.query("ALTER TABLE sales ADD COLUMN coupon_mode VARCHAR(16) NULL AFTER coupon_code"); }
        const [colCouponVal] = await conn.query("SHOW COLUMNS FROM sales LIKE 'coupon_value'"); if(!colCouponVal.length){ await conn.query("ALTER TABLE sales ADD COLUMN coupon_value DECIMAL(12,2) NULL AFTER coupon_mode"); }
        const [colPayStat] = await conn.query("SHOW COLUMNS FROM sales LIKE 'payment_status'"); if(!colPayStat.length){ await conn.query("ALTER TABLE sales ADD COLUMN payment_status ENUM('unpaid','paid') NOT NULL DEFAULT 'paid' AFTER payment_method"); }
        const [colSetAt] = await conn.query("SHOW COLUMNS FROM sales LIKE 'settled_at'"); if(!colSetAt.length){ await conn.query("ALTER TABLE sales ADD COLUMN settled_at DATETIME NULL AFTER notes"); }
        const [colSetMeth] = await conn.query("SHOW COLUMNS FROM sales LIKE 'settled_method'"); if(!colSetMeth.length){ await conn.query("ALTER TABLE sales ADD COLUMN settled_method VARCHAR(32) NULL AFTER settled_at"); }

        // ضمان وجود حقل نوع المستند (فاتورة/إشعار دائن) لتقارير واضحة
        const [colDocType] = await conn.query("SHOW COLUMNS FROM sales LIKE 'doc_type'");
        if(!colDocType.length){ await conn.query("ALTER TABLE sales ADD COLUMN doc_type ENUM('invoice','credit_note') NOT NULL DEFAULT 'invoice' AFTER invoice_no"); }

        const [ins] = await conn.query(`INSERT INTO sales (invoice_no, doc_type, ref_base_sale_id, ref_base_invoice_no, shift_id, customer_id, customer_name, customer_phone, customer_vat, payment_method, payment_status, sub_total, extra_value, tobacco_fee, vat_total, grand_total, total_after_discount, notes, discount_type, discount_value, discount_amount, coupon_code, coupon_mode, coupon_value, settled_at, settled_method, pay_cash_amount, pay_card_amount)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
          'CN-' + cnNo,
          'credit_note',
          Number(sale.id||id),
          String(sale.invoice_no||''),
          sale.shift_id || null,
          sale.customer_id, sale.customer_name, sale.customer_phone, sale.customer_vat,
          sale.payment_method, 'paid',
          -Number(sale.sub_total||0),
          (sale.extra_value!=null ? -Number(sale.extra_value||0) : null),
          (sale.tobacco_fee!=null ? -Number(sale.tobacco_fee||0) : null),
          -Number(sale.vat_total||0),
          -Number(sale.grand_total||0),
          (sale.total_after_discount!=null ? -Number(sale.total_after_discount||0) : null),
          null,
          sale.discount_type, (sale.discount_value!=null ? -Number(sale.discount_value||0) : null), (sale.discount_amount!=null ? -Number(sale.discount_amount||0) : null),
          sale.coupon_code||null, sale.coupon_mode||null, (sale.coupon_value!=null ? -Number(sale.coupon_value||0) : null),
          new Date(), 'refund',
          (sale.pay_cash_amount!=null ? -Number(sale.pay_cash_amount||0) : null),
          (sale.pay_card_amount!=null ? -Number(sale.pay_card_amount||0) : null)
        ]);
        const newId = ins.insertId;
        if(items.length){
          const rows = items.map(it => [
            newId,
            it.product_id,
            it.name,
            (it.description||null),
            (it.unit_name || null),
            Number(it.unit_multiplier ?? 1),
            -Number(it.price||0),
            -Number(it.qty||0),
            -Number(it.line_total||0),
            (it.operation_id||null),
            (it.operation_name||null),
            (it.employee_id||null)
          ]);
          // تأكد من أعمدة العملية
          const [colOpId] = await conn.query("SHOW COLUMNS FROM sales_items LIKE 'operation_id'");
          if(!colOpId.length){ await conn.query("ALTER TABLE sales_items ADD COLUMN operation_id INT NULL AFTER line_total"); }
          const [colOpName] = await conn.query("SHOW COLUMNS FROM sales_items LIKE 'operation_name'");
          if(!colOpName.length){ await conn.query("ALTER TABLE sales_items ADD COLUMN operation_name VARCHAR(128) NULL AFTER operation_id"); }
          await conn.query('INSERT INTO sales_items (sale_id, product_id, name, description, unit_name, unit_multiplier, price, qty, line_total, operation_id, operation_name, employee_id) VALUES ?', [rows]);
        }

        await conn.commit();
        try{ await autoSubmitZatcaIfEnabled(newId); }catch(_){ }
        try{
          const { BrowserWindow } = require('electron');
          BrowserWindow.getAllWindows().forEach(w => w.webContents.send('sales:changed', { action: 'refunded', credit_sale_id: newId, base_sale_id: Number(sale.id||id) }));
        }catch(_){ }
        return { ok:true, credit_sale_id: newId, base_sale_id: Number(sale.id||id), base_invoice_no: String(sale.invoice_no||''), base_payment_method: String(sale.payment_method||'') };
      } catch (e) {
        try{ await conn.rollback(); }catch(_){ }
        throw e;
      } finally { conn.release(); }
    }catch(e){ console.error(e); return { ok:false, error:'تعذر إنشاء إشعار دائن' }; }
  });

  ipcMain.handle('sales:refund_partial', async (_e, payload) => {
    const p = payload || {}; 
    const saleId = Number(p.sale_id||0);
    const items = Array.isArray(p.items) ? p.items : [];
    const reason = String(p.reason||'').trim();
    const notes = String(p.notes||'').trim() || null;
    
    if(!saleId) return { ok:false, error:'رقم الفاتورة مفقود' };
    if(!items.length) return { ok:false, error:'لا توجد أصناف للإرجاع' };
    if(!reason) return { ok:false, error:'سبب الإرجاع مطلوب' };
    
    try{
      const conn = await dbAdapter.getConnection();
      try{
        await ensureTables(conn);
        await conn.beginTransaction();

        const [[sale]] = await conn.query('SELECT * FROM sales WHERE id=? FOR UPDATE', [saleId]);
        if(!sale){ await conn.rollback(); return { ok:false, error:'الفاتورة غير موجودة' }; }

        // منع معالجة الإشعارات الدائنة
        if(String(sale.doc_type||'invoice') === 'credit_note'){
          await conn.rollback();
          return { ok:false, error:'لا يمكن معالجة إشعار دائن. يمكن فقط معالجة الفواتير العادية' };
        }

        const [originalItems] = await conn.query('SELECT * FROM sales_items WHERE sale_id=?', [saleId]);
        const keyOf = (it) => {
          const pid = Number(it.product_id||0);
          const op = (it.operation_id==null) ? 'null' : String(it.operation_id);
          const mult = Number(it.unit_multiplier ?? 1);
          const price = Math.abs(Number(it.price||0));
          return `${pid}|${op}|${mult}|${price}`;
        };
        
        const isCreditUnpaid = (String(sale.payment_method).toLowerCase()==='credit' && String(sale.payment_status||'paid')!=='paid');
        if(isCreditUnpaid){ await conn.rollback(); return { ok:false, error:'هذه فاتورة آجل غير مسددة ولا يمكن عمل معالجة لها قبل السداد' }; }

        // منع المعالجة الجزئية للفواتير التي تحتوي على خصم أو إضافي
        const hasDiscount = sale.discount_type && String(sale.discount_type) !== 'none' && Number(sale.discount_amount||0) > 0;
        const hasExtra = Number(sale.extra_value||0) > 0;
        if(hasDiscount || hasExtra){ 
          await conn.rollback(); 
          return { ok:false, error:'لا يمكن عمل معالجة جزئية لفاتورة تحتوي على خصم أو إضافي. استخدم معالجة كامل الفاتورة' }; 
        }

        const [colRefId] = await conn.query("SHOW COLUMNS FROM sales LIKE 'ref_base_sale_id'");
        if(!colRefId.length){ await conn.query("ALTER TABLE sales ADD COLUMN ref_base_sale_id INT NULL AFTER doc_type"); }
        const [colRefNo] = await conn.query("SHOW COLUMNS FROM sales LIKE 'ref_base_invoice_no'");
        if(!colRefNo.length){ await conn.query("ALTER TABLE sales ADD COLUMN ref_base_invoice_no VARCHAR(32) NULL AFTER ref_base_sale_id"); }

        // حذف UNIQUE INDEX القديم إذا كان موجوداً (لم يعد مطلوباً مع دعم المعالجة الجزئية المتعددة)
        try{
          const [idx] = await conn.query("SHOW INDEX FROM sales WHERE Key_name='uniq_ref_base_sale'");
          if(idx.length){ await conn.query("DROP INDEX uniq_ref_base_sale ON sales"); }
        }catch(_){ /* ignore index errors */ }

        // حساب الكميات المتاحة للإرجاع لكل نوع صنف (إجمالي الأصلي - إجمالي المرتجع)
        const availableQty = {};
        
        // 1. تجميع الكميات الأصلية
        originalItems.forEach(item => {
          const key = keyOf(item);
          const qty = Math.abs(Number(item.qty||0));
          availableQty[key] = (availableQty[key]||0) + qty;
        });
        
        // 2. خصم الكميات المرتجعة سابقاً
        const [creditNotes] = await conn.query('SELECT id FROM sales WHERE ref_base_sale_id=? AND doc_type=?', [saleId, 'credit_note']);
        if(creditNotes.length > 0){
          const cnIds = creditNotes.map(cn => cn.id);
          const [refundedItems] = await conn.query('SELECT product_id, qty, operation_id, unit_multiplier, price FROM sales_items WHERE sale_id IN (?)', [cnIds]);
          refundedItems.forEach(ri => {
            const key = keyOf(ri);
            const qty = Math.abs(Number(ri.qty||0));
            // خصم المرتجع من المتاح
            if(availableQty[key]) {
              availableQty[key] = Math.max(0, availableQty[key] - qty);
            }
          });
        }

        let totalExclusiveRefund = 0;
        const itemsToInsert = [];
        
        for(const refundItem of items){
          const pid = Number(refundItem.product_id||0);
          const qtyToRefund = Number(refundItem.qty||0);
          if(!pid || qtyToRefund<=0) continue;

          const opId = (refundItem.operation_id==null || refundItem.operation_id==='') ? null : Number(refundItem.operation_id);
          const unitMult = Number(refundItem.unit_multiplier ?? 1);
          const price = Number(refundItem.price||0);
          
          // العثور على أي سطر مطابق لجلب البيانات الوصفية (الاسم، الوصف، إلخ)
          const origItem = originalItems.find(x =>
            Number(x.product_id)===pid &&
            ((x.operation_id==null || x.operation_id==='') ? null : Number(x.operation_id)) === opId &&
            Number(x.unit_multiplier ?? 1) === unitMult &&
            Number(x.price||0) === price
          );
          
          if(!origItem){ await conn.rollback(); return { ok:false, error:`المنتج ${pid} غير موجود في الفاتورة الأصلية` }; }

          const key = keyOf(origItem);
          const currentAvailable = Number(availableQty[key]||0);
          
          if(qtyToRefund > currentAvailable + 0.001){ // Tolerance for float
            await conn.rollback(); 
            return { ok:false, error:`الكمية المرتجعة للمنتج ${origItem.name} (${qtyToRefund}) تتجاوز الكمية المتاحة (${currentAvailable})` }; 
          }

          // خصم الكمية من المتاح لضمان عدم تجاوز الإجمالي في نفس الطلب
          availableQty[key] -= qtyToRefund;

          const pricePerUnit = Number(origItem.price||0);
          const lineTotal = Number((pricePerUnit * qtyToRefund).toFixed(2));
          totalExclusiveRefund += lineTotal;

          const mult = (origItem.unit_multiplier!=null) ? Number(origItem.unit_multiplier||1) : 1;
          const qtyBase = Number((qtyToRefund * mult).toFixed(3));
          await conn.query('UPDATE products SET stock = stock + ? WHERE id=?', [qtyBase, pid]);

          itemsToInsert.push([
            origItem.product_id,
            origItem.name,
            (origItem.description||null),
            (origItem.unit_name || null),
            Number(origItem.unit_multiplier ?? 1),
            -pricePerUnit,
            -qtyToRefund,
            -lineTotal,
            (origItem.operation_id||null),
            (origItem.operation_name||null),
            (origItem.employee_id||null)
          ]);
        }

        if(!itemsToInsert.length){ await conn.rollback(); return { ok:false, error:'لا توجد أصناف صالحة للإرجاع' }; }

        const vatPercent = Number(sale.vat_total||0) / (Number(sale.sub_total||0) || 1) * 100;
        const vatForRefund = Number((totalExclusiveRefund * (vatPercent/100)).toFixed(2));
        const grandTotalRefund = Number((totalExclusiveRefund + vatForRefund).toFixed(2));

        const [[cnRow]] = await conn.query("SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_no, 4) AS UNSIGNED)), 0) AS max_no FROM sales WHERE doc_type='credit_note' AND invoice_no LIKE 'CN-%'");
        const cnNo = String(Number(cnRow?.max_no||0) + 1);

        const [colExtra] = await conn.query("SHOW COLUMNS FROM sales LIKE 'extra_value'"); 
        if(!colExtra.length){ await conn.query("ALTER TABLE sales ADD COLUMN extra_value DECIMAL(12,2) NULL AFTER sub_total"); }
        const [colTob] = await conn.query("SHOW COLUMNS FROM sales LIKE 'tobacco_fee'"); 
        if(!colTob.length){ await conn.query("ALTER TABLE sales ADD COLUMN tobacco_fee DECIMAL(12,2) NULL AFTER extra_value"); }
        const [colDocType] = await conn.query("SHOW COLUMNS FROM sales LIKE 'doc_type'");
        if(!colDocType.length){ await conn.query("ALTER TABLE sales ADD COLUMN doc_type ENUM('invoice','credit_note') NOT NULL DEFAULT 'invoice' AFTER invoice_no"); }

        const [ins] = await conn.query(`INSERT INTO sales (invoice_no, doc_type, ref_base_sale_id, ref_base_invoice_no, shift_id, customer_id, customer_name, customer_phone, customer_vat, payment_method, payment_status, sub_total, extra_value, tobacco_fee, vat_total, grand_total, notes, settled_at, settled_method)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
          'CN-' + cnNo,
          'credit_note',
          Number(sale.id||saleId),
          String(sale.invoice_no||''),
          sale.shift_id || null,
          sale.customer_id, sale.customer_name, sale.customer_phone, sale.customer_vat,
          sale.payment_method, 'paid',
          -totalExclusiveRefund,
          null,
          null,
          -vatForRefund,
          -grandTotalRefund,
          reason + (notes ? (' | ' + notes) : ''),
          new Date(), 'refund'
        ]);
        
        const newId = ins.insertId;
        const rowsWithSaleId = itemsToInsert.map(row => [newId, ...row]);
        
        const [colOpId] = await conn.query("SHOW COLUMNS FROM sales_items LIKE 'operation_id'");
        if(!colOpId.length){ await conn.query("ALTER TABLE sales_items ADD COLUMN operation_id INT NULL AFTER line_total"); }
        const [colOpName] = await conn.query("SHOW COLUMNS FROM sales_items LIKE 'operation_name'");
        if(!colOpName.length){ await conn.query("ALTER TABLE sales_items ADD COLUMN operation_name VARCHAR(128) NULL AFTER operation_id"); }
        
        await conn.query('INSERT INTO sales_items (sale_id, product_id, name, description, unit_name, unit_multiplier, price, qty, line_total, operation_id, operation_name, employee_id) VALUES ?', [rowsWithSaleId]);

        await conn.commit();
        try{ await autoSubmitZatcaIfEnabled(newId); }catch(_){ }
        
        try{
          const { BrowserWindow } = require('electron');
          BrowserWindow.getAllWindows().forEach(w => w.webContents.send('sales:changed', { action: 'refunded_partial', credit_sale_id: newId, base_sale_id: Number(sale.id||saleId) }));
        }catch(_){ }
        
        return { ok:true, credit_sale_id: newId, base_sale_id: Number(sale.id||saleId), base_invoice_no: String(sale.invoice_no||''), base_payment_method: String(sale.payment_method||'') };
      } catch (e) {
        try{ await conn.rollback(); }catch(_){ }
        throw e;
      } finally { conn.release(); }
    }catch(e){ console.error(e); return { ok:false, error:'تعذر إنشاء إشعار دائن جزئي: ' + e.message }; }
  });

  // ZATCA Integration handlers
  ipcMain.handle('sales:zatca_generate', async (_e, saleData) => {
    try {
      const ZatcaSalesIntegration = require('./zatca-sales-integration');
      const zatcaIntegration = new ZatcaSalesIntegration();
      return await zatcaIntegration.generateZatcaInvoice(saleData);
    } catch (error) {
      console.error('خطأ في إنشاء فاتورة ZATCA:', error);
      return { success: false, message: error.message };
    }
  });

  ipcMain.handle('sales:zatca_submit', async (_e, invoiceData) => {
    try {
      const ZatcaSalesIntegration = require('./zatca-sales-integration');
      const zatcaIntegration = new ZatcaSalesIntegration();
      return await zatcaIntegration.submitZatcaInvoice(invoiceData);
    } catch (error) {
      console.error('خطأ في إرسال فاتورة ZATCA:', error);
      return { success: false, message: error.message };
    }
  });

  ipcMain.handle('sales:zatca_status', async () => {
    try {
      const ZatcaSalesIntegration = require('./zatca-sales-integration');
      const zatcaIntegration = new ZatcaSalesIntegration();
      return await zatcaIntegration.getZatcaStatus();
    } catch (error) {
      console.error('خطأ في قراءة حالة ZATCA:', error);
      return { enabled: false, configured: false, message: 'خطأ في النظام' };
    }
  });

  ipcMain.handle('sales:update_zatca_data', async (_e, payload) => {
    try {
      const { sale_id, zatca_data } = payload;
      if (!sale_id || !zatca_data) {
        return { success: false, message: 'بيانات ناقصة' };
      }

      const conn = await dbAdapter.getConnection();
      try {
        await conn.query(`
          UPDATE sales 
          SET zatca_uuid = ?, zatca_hash = ?, zatca_qr = ?, zatca_submitted = NOW(), zatca_status = 'submitted'
          WHERE id = ?
        `, [
          zatca_data.uuid,
          zatca_data.invoiceHash,
          zatca_data.qrCode,
          sale_id
        ]);

        return { success: true, message: 'تم تحديث بيانات ZATCA بنجاح' };
      } finally {
        conn.release();
      }
    } catch (error) {
      console.error('خطأ في تحديث بيانات ZATCA:', error);
      return { success: false, message: error.message };
    }
  });

  ipcMain.handle('sales:employee_report', async (_e, query) => {
    try {
      const conn = await dbAdapter.getConnection();
      try {
        
        const employeeId = Number(query.employee_id || 0);
        const fromDate = query.from_date || '';
        const toDate = query.to_date || '';
        
        if (!employeeId) {
          return { ok: false, error: 'معرف الموظف مطلوب' };
        }
        if (!fromDate || !toDate) {
          return { ok: false, error: 'الفترة الزمنية مطلوبة' };
        }
        
        const fromDatetime = fromDate.includes(':') ? fromDate : (fromDate + ' 00:00:00');
        const toDatetime = toDate.includes(':') ? toDate : (toDate + ' 23:59:59');
        
        const [invoices] = await conn.query(`
          SELECT DISTINCT
            s.id,
            s.invoice_no,
            s.grand_total,
            s.payment_method,
            s.created_at,
            s.settled_cash,
            s.pay_cash_amount,
            c.name as customer_name,
            GROUP_CONCAT(DISTINCT si.name SEPARATOR ', ') as products_list,
            SUM(si.line_total) as employee_total
          FROM sales s
          INNER JOIN sales_items si ON si.sale_id = s.id AND si.employee_id = ?
          LEFT JOIN customers c ON c.id = s.customer_id
          WHERE s.doc_type = 'invoice'
            AND s.created_at >= ?
            AND s.created_at <= ?
          GROUP BY s.id
          ORDER BY s.created_at DESC
        `, [employeeId, fromDatetime, toDatetime]);
        
        const [products] = await conn.query(`
          SELECT 
            si.product_id,
            si.name as product_name,
            SUM(si.qty) as total_qty,
            AVG(si.price) as avg_price,
            SUM(si.line_total) as total_amount
          FROM sales_items si
          INNER JOIN sales s ON s.id = si.sale_id
          WHERE si.employee_id = ?
            AND s.doc_type = 'invoice'
            AND s.created_at >= ?
            AND s.created_at <= ?
          GROUP BY si.product_id, si.name
          ORDER BY total_amount DESC
        `, [employeeId, fromDatetime, toDatetime]);
        
        const [creditNotes] = await conn.query(`
          SELECT DISTINCT
            s.id,
            s.invoice_no,
            s.grand_total,
            s.payment_method,
            s.created_at,
            s.settled_cash,
            s.pay_cash_amount,
            s.ref_base_invoice_no,
            c.name as customer_name,
            GROUP_CONCAT(DISTINCT si.name SEPARATOR ', ') as products_list,
            SUM(si.line_total) as employee_total
          FROM sales s
          INNER JOIN sales_items si ON si.sale_id = s.id AND si.employee_id = ?
          LEFT JOIN customers c ON c.id = s.customer_id
          WHERE s.doc_type = 'credit_note'
            AND s.created_at >= ?
            AND s.created_at <= ?
          GROUP BY s.id
          ORDER BY s.created_at DESC
        `, [employeeId, fromDatetime, toDatetime]);
        
        const [creditProducts] = await conn.query(`
          SELECT 
            si.product_id,
            si.name as product_name,
            SUM(si.qty) as total_qty,
            AVG(si.price) as avg_price,
            SUM(si.line_total) as total_amount
          FROM sales_items si
          INNER JOIN sales s ON s.id = si.sale_id
          WHERE si.employee_id = ?
            AND s.doc_type = 'credit_note'
            AND s.created_at >= ?
            AND s.created_at <= ?
          GROUP BY si.product_id, si.name
          ORDER BY total_amount DESC
        `, [employeeId, fromDatetime, toDatetime]);
        
        return {
          ok: true,
          data: {
            invoices: invoices || [],
            products: products || [],
            creditNotes: creditNotes || [],
            creditProducts: creditProducts || []
          }
        };
      } finally {
        conn.release();
      }
    } catch (error) {
      console.error('sales:employee_report error:', error);
      return { ok: false, error: 'حدث خطأ أثناء جلب التقرير' };
    }
  });
}

// eager ensure
(async () => {
  try{
    const conn = await dbAdapter.getConnection();
    try{
      await conn.query(`
        CREATE TABLE IF NOT EXISTS sales (
          id INT AUTO_INCREMENT PRIMARY KEY,
          invoice_no VARCHAR(32) UNIQUE,
          order_no INT NULL,
          customer_id INT NULL,
          customer_name VARCHAR(255) NULL,
          payment_method VARCHAR(32) NOT NULL,
          sub_total DECIMAL(12,2) NOT NULL,
          extra_value DECIMAL(12,2) NULL,
          vat_total DECIMAL(12,2) NOT NULL,
          grand_total DECIMAL(12,2) NOT NULL,
          total_after_discount DECIMAL(12,2) NULL,
          discount_type VARCHAR(16) NULL,
          discount_value DECIMAL(12,2) NULL,
          discount_amount DECIMAL(12,2) NULL,
          notes VARCHAR(255) NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      // Ensure discount columns
      if(!(await dbAdapter.columnExists('sales', 'total_after_discount'))){
        try{ await conn.query("ALTER TABLE sales ADD COLUMN total_after_discount DECIMAL(12,2) NULL AFTER grand_total"); }catch(_){}
      }
      if(!(await dbAdapter.columnExists('sales', 'discount_type'))){
        try{ await conn.query("ALTER TABLE sales ADD COLUMN discount_type VARCHAR(16) NULL AFTER total_after_discount"); }catch(_){}
      }
      if(!(await dbAdapter.columnExists('sales', 'discount_value'))){
        try{ await conn.query("ALTER TABLE sales ADD COLUMN discount_value DECIMAL(12,2) NULL AFTER discount_type"); }catch(_){}
      }
      if(!(await dbAdapter.columnExists('sales', 'discount_amount'))){
        try{ await conn.query("ALTER TABLE sales ADD COLUMN discount_amount DECIMAL(12,2) NULL AFTER discount_value"); }catch(_){}
      }

      await conn.query(`
        CREATE TABLE IF NOT EXISTS sales_items (
          id INT AUTO_INCREMENT PRIMARY KEY,
          sale_id INT NOT NULL,
          product_id INT NOT NULL,
          name VARCHAR(255) NOT NULL,
          description VARCHAR(255) NULL,
          price DECIMAL(12,2) NOT NULL,
          qty INT NOT NULL,
          line_total DECIMAL(12,2) NOT NULL,
          FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);
      // ترقية عمود الوصف إن لم يكن موجودًا
      const [colDesc] = await conn.query("SHOW COLUMNS FROM sales_items LIKE 'description'");
      if(!colDesc.length){
        await conn.query("ALTER TABLE sales_items ADD COLUMN description VARCHAR(255) NULL AFTER name");
      }

      // Renumber existing credit notes once to start from CN-1 sequentially
      try{
        // ensure app_settings and flag column exist
        await conn.query("CREATE TABLE IF NOT EXISTS app_settings (id INT PRIMARY KEY)");
        const [hasFlagCol] = await conn.query("SHOW COLUMNS FROM app_settings LIKE 'credit_notes_renumbered'");
        if(!hasFlagCol.length){ await conn.query("ALTER TABLE app_settings ADD COLUMN credit_notes_renumbered TINYINT NOT NULL DEFAULT 0"); }
        const [existsRow] = await conn.query("SELECT id FROM app_settings WHERE id=1");
        if(!existsRow.length){ await conn.query("INSERT INTO app_settings (id, credit_notes_renumbered) VALUES (1, 0) ON DUPLICATE KEY UPDATE id=VALUES(id)"); }
        const [[flag]] = await conn.query("SELECT credit_notes_renumbered AS f FROM app_settings WHERE id=1");
        if(Number(flag?.f||0) === 0){
          await conn.beginTransaction();
          const [cnRows] = await conn.query("SELECT id FROM sales WHERE doc_type='credit_note' AND invoice_no LIKE 'CN-%' ORDER BY created_at, id");
          // phase 1: set temporary unique values to avoid UNIQUE collisions
          for(const r of cnRows){ await conn.query("UPDATE sales SET invoice_no=? WHERE id=?", [ `CN-TMP-${r.id}`, r.id ]); }
          // phase 2: assign CN-1.. sequentially
          let n = 1; for(const r of cnRows){ await conn.query("UPDATE sales SET invoice_no=? WHERE id=?", [ `CN-${n++}`, r.id ]); }
          await conn.query("UPDATE app_settings SET credit_notes_renumbered=1 WHERE id=1");
          await conn.commit();
        }
      }catch(migErr){ try{ await conn.rollback(); }catch(_){} console.error('credit notes renumber migration failed', migErr); }
    } finally { conn.release(); }
  }catch(e){ /* silently ignore - tables will be created on first connection */ }
})();

module.exports = { registerSalesIPC };