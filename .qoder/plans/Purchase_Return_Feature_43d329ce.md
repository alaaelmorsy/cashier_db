# Purchase Return Feature Implementation

## Overview
Add a purchase return feature that allows users to select items from existing purchase invoices and create return invoices (similar to sales credit notes). Returns will use a `doc_type` column in the existing tables, have their own PR- sequential numbering, and immediately adjust inventory.

## Architecture Decisions
- **Database**: Add `doc_type` ENUM('invoice','return') column to `purchase_invoices` table (like sales uses for credit notes)
- **Inventory**: Decrease stock immediately when return is saved
- **UI**: New third tab "المشتريات المرتجعة" (Purchase Returns)
- **Numbering**: Separate PR- sequence (PR-00001, PR-00002, etc.)
- **Reference**: Store `ref_base_purchase_id` and `ref_base_invoice_no` to link returns to original invoices

## Implementation Steps

### Step 1: Database Schema Updates
**File**: `d:/PLUS/copy/cashier/src/main/purchase_invoices.js`

In `ensureTables()` function, add:

1. Add `doc_type` column to `purchase_invoices`:
```javascript
const [colDocType] = await conn.query("SHOW COLUMNS FROM purchase_invoices LIKE 'doc_type'");
if(!colDocType.length){
  await conn.query("ALTER TABLE purchase_invoices ADD COLUMN doc_type ENUM('invoice','return') NOT NULL DEFAULT 'invoice' AFTER invoice_no");
}
```

2. Add reference columns for linking returns to original invoices:
```javascript
const [colRefId] = await conn.query("SHOW COLUMNS FROM purchase_invoices LIKE 'ref_base_purchase_id'");
if(!colRefId.length){
  await conn.query("ALTER TABLE purchase_invoices ADD COLUMN ref_base_purchase_id INT NULL AFTER doc_type");
}

const [colRefNo] = await conn.query("SHOW COLUMNS FROM purchase_invoices LIKE 'ref_base_invoice_no'");
if(!colRefNo.length){
  await conn.query("ALTER TABLE purchase_invoices ADD COLUMN ref_base_invoice_no VARCHAR(32) NULL AFTER ref_base_purchase_id");
}
```

3. Initialize return sequence counter in `app_counters`:
```javascript
// In ensureTables, after purchase_invoice_seq initialization
await conn.query(`INSERT IGNORE INTO app_counters (name, value) SELECT 'purchase_return_seq', 0`);
```

### Step 2: Backend IPC - Return Invoice Creation
**File**: `d:/PLUS/copy/cashier/src/main/purchase_invoices.js`

Add new IPC handler `purchase_invoices:create_return`:

```javascript
ipcMain.handle('purchase_invoices:create_return', async (_e, payload) => {
  const p = payload || {};
  const originalInvoiceId = Number(p.original_invoice_id||0);
  if(!originalInvoiceId) return { ok:false, error:'رقم الفاتورة الأصلية مطلوب' };
  
  const selectedItems = p.items || [];
  if(!selectedItems.length) return { ok:false, error:'لا توجد أصناف للإرجاع' };
  
  try{
    const conn = await dbAdapter.getConnection();
    try{
      await ensureTables(conn);
      await conn.beginTransaction();
      
      // Fetch original invoice
      const [[original]] = await conn.query('SELECT * FROM purchase_invoices WHERE id=? AND doc_type=?', [originalInvoiceId, 'invoice']);
      if(!original) { await conn.rollback(); return { ok:false, error:'الفاتورة الأصلية غير موجودة' }; }
      
      // Fetch original items
      const [originalItems] = await conn.query('SELECT * FROM purchase_invoice_details WHERE purchase_id=?', [originalInvoiceId]);
      
      // Calculate already-returned quantities per product
      const [existingReturns] = await conn.query(
        'SELECT id FROM purchase_invoices WHERE ref_base_purchase_id=? AND doc_type=?',
        [originalInvoiceId, 'return']
      );
      
      const returnedQty = {};
      if(existingReturns.length > 0){
        const returnIds = existingReturns.map(r => r.id);
        const [returnedItems] = await conn.query(
          'SELECT product_id, SUM(qty) as total_returned FROM purchase_invoice_details WHERE purchase_id IN (?) GROUP BY product_id',
          [returnIds]
        );
        returnedItems.forEach(ri => {
          returnedQty[ri.product_id] = Number(ri.total_returned||0);
        });
      }
      
      // Validate return quantities
      for(const item of selectedItems){
        const originalItem = originalItems.find(oi => oi.product_id === item.product_id);
        if(!originalItem) {
          await conn.rollback();
          return { ok:false, error:`الصنف ${item.product_id} غير موجود في الفاتورة الأصلية` };
        }
        
        const originalQty = Number(originalItem.qty||0);
        const alreadyReturned = returnedQty[item.product_id] || 0;
        const availableForReturn = originalQty - alreadyReturned;
        
        if(Number(item.qty||0) > availableForReturn){
          await conn.rollback();
          return { ok:false, error:`الكمية المرتجعة للمنتج ${item.product_id} (${item.qty}) تتجاوز الكمية المتاحة للإرجاع (${availableForReturn})` };
        }
      }
      
      // Generate return invoice number
      await conn.query(
        `UPDATE app_counters SET value = LAST_INSERT_ID(value + 1) WHERE name = 'purchase_return_seq'`
      );
      const [[row]] = await conn.query(`SELECT LAST_INSERT_ID() AS seq`);
      const returnNo = 'PR-' + String(row.seq).padStart(5, '0');
      
      // Compute return totals (negative values)
      let subTotal = 0;
      const returnLines = selectedItems.map(item => {
        const originalItem = originalItems.find(oi => oi.product_id === item.product_id);
        const qty = Number(item.qty||0);
        const unitCost = Number(originalItem.unit_cost||0);
        const lineTotal = qty * unitCost;
        subTotal += lineTotal;
        
        return {
          product_id: item.product_id,
          description: originalItem.description,
          qty: qty,
          unit_cost: unitCost,
          discount_line: 0,
          line_total: lineTotal,
          ui_unit_cost: Number(originalItem.ui_unit_cost||0),
          ui_line_total: Number(originalItem.ui_line_total||0)
        };
      });
      
      subTotal = Number(subTotal.toFixed(2));
      const vatPercent = Number(original.vat_percent||0);
      const vatTotal = Number((subTotal * (vatPercent/100)).toFixed(2));
      const grandTotal = Number((subTotal + vatTotal).toFixed(2));
      
      // Create return invoice
      const atStr = toAtString(p.return_dt);
      const [res] = await conn.query(
        `INSERT INTO purchase_invoices (invoice_no, doc_type, ref_base_purchase_id, ref_base_invoice_no, invoice_at, supplier_id, payment_method, price_mode, reference_no, notes, sub_total, discount_general, discount_general_ui, vat_percent, vat_total, grand_total, amount_paid, amount_due)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [returnNo, 'return', originalInvoiceId, original.invoice_no, atStr, original.supplier_id, original.payment_method, original.price_mode, null, p.reason||null, -subTotal, 0, 0, vatPercent, -vatTotal, -grandTotal, 0, 0]
      );
      
      const returnId = res.insertId;
      
      // Insert return details (negative quantities)
      for(const ln of returnLines){
        await conn.query(
          `INSERT INTO purchase_invoice_details (purchase_id, product_id, description, qty, unit_cost, discount_line, line_total, ui_unit_cost, ui_line_total) VALUES (?,?,?,?,?,?,?,?,?)`,
          [returnId, ln.product_id, ln.description, -ln.qty, ln.unit_cost, ln.discount_line, -ln.line_total, ln.ui_unit_cost, ln.ui_line_total]
        );
        
        // Decrease stock immediately
        await conn.query(`UPDATE products SET stock = stock - ? WHERE id = ?`, [ln.qty, ln.product_id]);
      }
      
      // Adjust supplier balance (reverse credit if original was credit)
      const origMethod = String(original.payment_method).toLowerCase();
      if(origMethod === 'credit' || origMethod === 'آجل'){
        await conn.query(`UPDATE suppliers SET balance = balance - ? WHERE id = ?`, [grandTotal, original.supplier_id]);
      }
      
      await conn.commit();
      
      // Notify other windows
      try{ 
        const { BrowserWindow } = require('electron'); 
        BrowserWindow.getAllWindows().forEach(w => w.webContents.send('products:changed', { action:'stock-decreased', return_id: returnId })); 
      }catch(_){ }
      
      return { ok:true, id: returnId, invoice_no: returnNo };
    }catch(e){ 
      try{ await conn.rollback(); }catch(_){ } 
      console.error('purchase_invoices:create_return failed', e); 
      return { ok:false, error:'فشل إنشاء فاتورة المرتجع' }; 
    }
    finally{ conn.release(); }
  }catch(e){ 
    console.error(e); 
    return { ok:false, error:'فشل الاتصال بقاعدة البيانات' }; 
  }
});
```

### Step 3: Backend IPC - Get Original Invoice for Return
**File**: `d:/PLUS/copy/cashier/src/main/purchase_invoices.js`

Add handler to fetch invoice by number and calculate available quantities:

```javascript
ipcMain.handle('purchase_invoices:get_for_return', async (_e, invoiceNo) => {
  if(!invoiceNo) return { ok:false, error:'رقم الفاتورة مطلوب' };
  
  try{
    const conn = await dbAdapter.getConnection();
    try{
      await ensureTables(conn);
      
      // Find invoice by invoice_no
      const [[inv]] = await conn.query('SELECT * FROM purchase_invoices WHERE invoice_no=? AND doc_type=?', [String(invoiceNo), 'invoice']);
      if(!inv) return { ok:false, error:'الفاتورة غير موجودة' };
      
      // Get original items
      const [items] = await conn.query('SELECT * FROM purchase_invoice_details WHERE purchase_id=?', [inv.id]);
      
      // Calculate already-returned quantities
      const [existingReturns] = await conn.query(
        'SELECT id FROM purchase_invoices WHERE ref_base_purchase_id=? AND doc_type=?',
        [inv.id, 'return']
      );
      
      const availableItems = items.map(item => {
        let returnedQty = 0;
        if(existingReturns.length > 0){
          const returnIds = existingReturns.map(r => r.id);
          // Sum returned quantities for this product
          const [returned] = await conn.query(
            'SELECT SUM(ABS(qty)) as returned FROM purchase_invoice_details WHERE purchase_id IN (?) AND product_id=?',
            [returnIds, item.product_id]
          );
          returnedQty = Number(returned[0]?.returned||0);
        }
        
        // Fetch product name
        const [[product]] = await conn.query('SELECT name FROM products WHERE id=?', [item.product_id]);
        
        return {
          product_id: item.product_id,
          name: product?.name || `#${item.product_id}`,
          original_qty: Number(item.qty||0),
          returned_qty: returnedQty,
          available_qty: Number(item.qty||0) - returnedQty,
          unit_cost: Number(item.unit_cost||0),
          ui_unit_cost: Number(item.ui_unit_cost||0),
          description: item.description || ''
        };
      });
      
      return { ok:true, invoice: inv, items: availableItems };
    }finally{ conn.release(); }
  }catch(e){ 
    console.error(e); 
    return { ok:false, error:'تعذر جلب بيانات الفاتورة' }; 
  }
});
```

### Step 4: Update Existing List Handler
**File**: `d:/PLUS/copy/cashier/src/main/purchase_invoices.js`

Modify the `purchase_invoices:list` handler to support filtering by `doc_type`:

```javascript
// In the list handler, add:
if(query.doc_type){ 
  where.push('doc_type = ?'); 
  params.push(String(query.doc_type)); 
}
```

### Step 5: Frontend - Add Returns Tab
**File**: `d:/PLUS/copy/cashier/src/renderer/purchase_invoices/index.html`

1. Add third tab button (around line 1852):
```html
<div id="tabBtnReturns" class="tab">
  <span>↩️</span>
  المشتريات المرتجعة
</div>
```

2. Add returns tab content after `tab_saved` (around line 2200):
```html
<div id="tab_returns" class="tab-content">
  <!-- Return Invoice Input Section -->
  <div class="card">
    <div class="pad">
      <div class="section-header-row">
        <div class="section-title-group">
          <div class="section-icon">↩️</div>
          <div>
            <div class="section-title">إنشاء فاتورة مرتجع مشتريات</div>
            <div class="section-subtitle">أدخل رقم الفاتورة الأصلية لإنشاء مرتجع</div>
          </div>
        </div>
      </div>
      
      <div class="form-row">
        <div class="form-group" style="flex: 2;">
          <label>رقم الفاتورة المرتجعة</label>
          <input id="return_inv_no" type="text" placeholder="أدخل رقم الفاتورة الأصلية" />
        </div>
        <div class="form-group" style="flex: 0 0 auto;">
          <label>&nbsp;</label>
          <button id="btnProcessReturn" class="btn btn-primary" style="height: 40px;">
            <span>⚙️</span> معالجة
          </button>
        </div>
      </div>
      
      <!-- Return Items Display (hidden initially) -->
      <div id="returnItemsSection" style="display:none; margin-top: 20px;">
        <h3 style="margin-bottom: 12px;">أصناف الفاتورة الأصلية - حدد الكميات المرتجعة</h3>
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th style="width: 50px; text-align: center;">تحديد</th>
                <th>المنتج</th>
                <th style="text-align: center;">الكمية الأصلية</th>
                <th style="text-align: center;">الكمية المرتجعة سابقاً</th>
                <th style="text-align: center;">المتاح للإرجاع</th>
                <th style="text-align: center;">الكمية المرتجعة</th>
                <th style="text-align: center;">سعر الوحدة</th>
                <th style="text-align: center;">الإجمالي</th>
              </tr>
            </thead>
            <tbody id="returnItemsBody">
            </tbody>
          </table>
        </div>
        
        <!-- Reason for return -->
        <div class="form-row" style="margin-top: 16px;">
          <div class="form-group">
            <label>سبب الإرجاع</label>
            <input id="return_reason" type="text" placeholder="سبب المرتجع (اختياري)" />
          </div>
        </div>
        
        <!-- Return totals -->
        <div style="margin-top: 16px; text-align: left; padding: 16px; background: #f8fafc; border-radius: 8px;">
          <div style="font-size: 1.1rem; font-weight: 700;">
            إجمالي المرتجع: <span id="returnGrandTotal" style="color: #dc2626;">0.00 ﷼</span>
          </div>
        </div>
        
        <!-- Save return button -->
        <div style="margin-top: 16px; text-align: center;">
          <button id="btnSaveReturn" class="btn btn-success" style="padding: 12px 32px; font-size: 1rem;">
            <span>💾</span> حفظ وطباعة المرتجع
          </button>
        </div>
      </div>
    </div>
  </div>
  
  <!-- Saved Returns List (similar to saved invoices) -->
  <div class="card" style="margin-top: 20px;">
    <div class="pad">
      <div class="section-header-row">
        <div class="section-title-group">
          <div class="section-icon">📋</div>
          <div>
            <div class="section-title">فواتير المرتجعات المحفوظة</div>
            <div class="section-subtitle">عرض جميع فواتير المرتجعات</div>
          </div>
        </div>
      </div>
      
      <!-- Filters -->
      <div class="form-row">
        <div class="form-group">
          <label>من تاريخ</label>
          <input id="return_filter_from" type="date" />
        </div>
        <div class="form-group">
          <label>إلى تاريخ</label>
          <input id="return_filter_to" type="date" />
        </div>
        <div class="form-group">
          <label>رقم المرتجع</label>
          <input id="return_filter_no" type="text" placeholder="PR-..." />
        </div>
        <div class="form-group">
          <label>&nbsp;</label>
          <button id="btnFilterReturns" class="btn btn-primary">بحث</button>
        </div>
      </div>
      
      <!-- Returns table -->
      <div class="table-wrapper" style="margin-top: 16px;">
        <table>
          <thead>
            <tr>
              <th>التاريخ</th>
              <th>رقم المرتجع</th>
              <th>رقم الفاتورة الأصلية</th>
              <th>المورد</th>
              <th>الإجمالي</th>
              <th>إجراءات</th>
            </tr>
          </thead>
          <tbody id="tbodyReturns">
            <tr><td colspan="6">
              <div class="empty-state">
                <div class="icon">↩️</div>
                <div class="message">لا توجد مرتجعات</div>
                <div class="hint">أنشئ مرتجع جديد من الأعلى</div>
              </div>
            </td></tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</div>
```

### Step 6: Frontend - Returns Logic
**File**: `d:/PLUS/copy/cashier/src/renderer/purchase_invoices/renderer.js`

Add returns tab handling and logic:

```javascript
// Elements
const tabBtnReturns = document.getElementById('tabBtnReturns');
const tabReturns = document.getElementById('tab_returns');
const returnInvNo = document.getElementById('return_inv_no');
const btnProcessReturn = document.getElementById('btnProcessReturn');
const returnItemsSection = document.getElementById('returnItemsSection');
const returnItemsBody = document.getElementById('returnItemsBody');
const returnReason = document.getElementById('return_reason');
const returnGrandTotal = document.getElementById('returnGrandTotal');
const btnSaveReturn = document.getElementById('btnSaveReturn');
const tbodyReturns = document.getElementById('tbodyReturns');

let currentReturnInvoice = null;
let returnItems = [];

// Tab switching
function switchTab(which){
  if(which==='make'){
    tabMake.classList.add('active'); 
    tabSaved.classList.remove('active'); 
    tabReturns.classList.remove('active');
    tabBtnMake.classList.add('active'); 
    tabBtnSaved.classList.remove('active');
    tabBtnReturns.classList.remove('active');
  }else if(which==='saved'){
    tabMake.classList.remove('active'); 
    tabSaved.classList.add('active');
    tabReturns.classList.remove('active');
    tabBtnMake.classList.remove('active'); 
    tabBtnSaved.classList.add('active');
    tabBtnReturns.classList.remove('active');
  }else if(which==='returns'){
    tabMake.classList.remove('active'); 
    tabSaved.classList.remove('active');
    tabReturns.classList.add('active');
    tabBtnMake.classList.remove('active'); 
    tabBtnSaved.classList.remove('active');
    tabBtnReturns.classList.add('active');
  }
}

tabBtnReturns?.addEventListener('click', ()=> switchTab('returns'));

// Process return - fetch invoice
btnProcessReturn?.addEventListener('click', async ()=>{
  const invNo = String(returnInvNo.value||'').trim();
  if(!invNo){
    showToast('يرجى إدخال رقم الفاتورة', 'warning');
    return;
  }
  
  btnProcessReturn.disabled = true;
  btnProcessReturn.innerHTML = '⏳ جاري المعالجة...';
  
  try{
    const result = await window.api.purchase_invoices_get_for_return(invNo);
    
    if(!result || !result.ok){
      showToast(result?.error || 'الفاتورة غير موجودة', 'error');
      returnItemsSection.style.display = 'none';
      return;
    }
    
    currentReturnInvoice = result.invoice;
    returnItems = result.items;
    
    // Render items
    returnItemsBody.innerHTML = '';
    returnItems.forEach((item, idx) => {
      if(item.available_qty <= 0) return; // Skip fully returned items
      
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="text-align: center;">
          <input type="checkbox" class="return-select" data-idx="${idx}" />
        </td>
        <td>${item.name}</td>
        <td style="text-align: center;">${item.original_qty}</td>
        <td style="text-align: center;">${item.returned_qty}</td>
        <td style="text-align: center; color: #0ea5e9; font-weight: 700;">${item.available_qty}</td>
        <td style="text-align: center;">
          <input type="number" class="return-qty" data-idx="${idx}" 
                 min="0" max="${item.available_qty}" step="0.001" 
                 value="0" style="width: 100px; text-align: center;" 
                 disabled />
        </td>
        <td style="text-align: center;">${item.ui_unit_cost.toFixed(2)}</td>
        <td style="text-align: center;" class="return-line-total">0.00</td>
      `;
      returnItemsBody.appendChild(tr);
    });
    
    // Bind checkbox events
    returnItemsBody.querySelectorAll('.return-select').forEach(cb => {
      cb.addEventListener('change', (e) => {
        const idx = Number(e.target.dataset.idx);
        const qtyInput = returnItemsBody.querySelector(`.return-qty[data-idx="${idx}"]`);
        qtyInput.disabled = !e.target.checked;
        if(e.target.checked){
          qtyInput.value = item.available_qty;
          qtyInput.focus();
        } else {
          qtyInput.value = 0;
        }
        updateReturnTotals();
      });
    });
    
    // Bind quantity input events
    returnItemsBody.querySelectorAll('.return-qty').forEach(input => {
      input.addEventListener('input', (e) => {
        const idx = Number(e.target.dataset.idx);
        const item = returnItems[idx];
        const qty = Math.min(Number(e.target.value||0), item.available_qty);
        e.target.value = qty;
        
        const lineTotal = qty * item.ui_unit_cost;
        const lineTotalCell = returnItemsBody.querySelector(`tr:nth-child(${idx + 1}) .return-line-total`);
        if(lineTotalCell) lineTotalCell.textContent = lineTotal.toFixed(2);
        
        updateReturnTotals();
      });
    });
    
    returnItemsSection.style.display = 'block';
    showToast('تم جلب بيانات الفاتورة بنجاح', 'success');
    
  }catch(e){
    console.error(e);
    showToast('حدث خطأ أثناء جلب البيانات', 'error');
  }finally{
    btnProcessReturn.disabled = false;
    btnProcessReturn.innerHTML = '<span>⚙️</span> معالجة';
  }
});

function updateReturnTotals(){
  let total = 0;
  returnItemsBody.querySelectorAll('.return-qty').forEach(input => {
    const idx = Number(input.dataset.idx);
    const item = returnItems[idx];
    const qty = Number(input.value||0);
    total += qty * item.ui_unit_cost;
  });
  returnGrandTotal.textContent = total.toFixed(2) + ' ﷼';
}

// Save return
btnSaveReturn?.addEventListener('click', async ()=>{
  // Collect selected items
  const selectedItems = [];
  returnItemsBody.querySelectorAll('.return-qty').forEach(input => {
    const qty = Number(input.value||0);
    if(qty > 0){
      const idx = Number(input.dataset.idx);
      const item = returnItems[idx];
      selectedItems.push({
        product_id: item.product_id,
        qty: qty
      });
    }
  });
  
  if(!selectedItems.length){
    showToast('يرجى تحديد أصناف للإرجاع', 'warning');
    return;
  }
  
  btnSaveReturn.disabled = true;
  btnSaveReturn.innerHTML = '⏳ جاري الحفظ...';
  
  try{
    const payload = {
      original_invoice_id: currentReturnInvoice.id,
      items: selectedItems,
      reason: String(returnReason.value||'').trim(),
      return_dt: new Date().toISOString()
    };
    
    const result = await window.api.purchase_invoices_create_return(payload);
    
    if(!result || !result.ok){
      showToast(result?.error || 'فشل حفظ المرتجع', 'error');
      return;
    }
    
    showToast('تم إنشاء فاتورة المرتجع بنجاح', 'success');
    
    // Open print window
    try{
      const w = 900, h = 1000;
      const view = window.open(
        `./print-a4.html?id=${encodeURIComponent(result.id)}`,
        'PURCHASE_RETURN_PRINT',
        `width=${w},height=${h},menubar=no,toolbar=no,location=no,status=no`
      );
      let tries = 0;
      const t = setInterval(()=>{
        tries++;
        try{
          if(view && view.sessionStorage){
            view.sessionStorage.setItem('purchase_invoice_id', String(result.id));
            clearInterval(t);
          }
        }catch(_){}
        if(tries>30) clearInterval(t);
      }, 100);
    }catch(e){
      console.error('تعذر فتح المعاينة:', e);
    }
    
    // Reset form
    returnInvNo.value = '';
    returnReason.value = '';
    returnItemsSection.style.display = 'none';
    returnItemsBody.innerHTML = '';
    currentReturnInvoice = null;
    returnItems = [];
    
    // Load returns list
    await loadReturns();
    
  }catch(e){
    console.error(e);
    showToast('حدث خطأ أثناء الحفظ', 'error');
  }finally{
    btnSaveReturn.disabled = false;
    btnSaveReturn.innerHTML = '<span>💾</span> حفظ وطباعة المرتجع';
  }
});

// Load saved returns
async function loadReturns(){
  const q = { doc_type: 'return' };
  
  if(return_filter_from?.value) q.from = dateToDbRange(return_filter_from.value, false);
  if(return_filter_to?.value) q.to = dateToDbRange(return_filter_to.value, true);
  if(return_filter_no?.value) q.invoice_no = String(return_filter_no.value).trim();
  
  tbodyReturns.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:40px;">⏳ جاري التحميل...</td></tr>';
  
  const r = await window.api.purchase_invoices_list(q);
  tbodyReturns.innerHTML = '';
  
  if(!r || !r.ok || !r.items.length){
    tbodyReturns.innerHTML = `
      <tr><td colspan="6">
        <div class="empty-state">
          <div class="icon">↩️</div>
          <div class="message">لا توجد مرتجعات</div>
          <div class="hint">أنشئ مرتجع جديد من الأعلى</div>
        </div>
      </td></tr>
    `;
    return;
  }
  
  // Render returns (similar to loadSaved but simpler)
  const suppliersCache = {};
  try{
    const suppResult = await window.api.suppliers_list?.();
    if(suppResult && suppResult.ok && suppResult.items){
      for(const s of suppResult.items) suppliersCache[s.id] = s.name;
    }
  }catch(e){}
  
  for(const ret of r.items){
    const tr = document.createElement('tr');
    const supplierName = suppliersCache[ret.supplier_id] || `#${ret.supplier_id}`;
    
    tr.innerHTML = `
      <td>${new Date(ret.invoice_at).toLocaleDateString('ar-SA')}</td>
      <td><span class="invoice-number">↩️ ${ret.invoice_no}</span></td>
      <td>${ret.ref_base_invoice_no || '-'}</td>
      <td>${supplierName}</td>
      <td style="color: #dc2626;">${Math.abs(Number(ret.grand_total||0)).toFixed(2)} ﷼</td>
      <td style="text-align:center">
        <button class="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium btn-view-return">👁 عرض</button>
      </td>
    `;
    
    tr.querySelector('.btn-view-return').addEventListener('click', async ()=>{
      try{
        const w = 900, h = 1000;
        const view = window.open(
          `./print-a4.html?id=${encodeURIComponent(ret.id)}`,
          'PURCHASE_RETURN_PRINT',
          `width=${w},height=${h},menubar=no,toolbar=no,location=no,status=no`
        );
        let tries = 0;
        const t = setInterval(()=>{
          tries++;
          try{
            if(view && view.sessionStorage){
              view.sessionStorage.setItem('purchase_invoice_id', String(ret.id));
              clearInterval(t);
            }
          }catch(_){}
          if(tries>30) clearInterval(t);
        }, 100);
      }catch(e){
        alert('تعذر فتح العرض: ' + (e?.message||String(e)));
      }
    });
    
    tbodyReturns.appendChild(tr);
  }
}

btnFilterReturns?.addEventListener('click', ()=> loadReturns());
```

### Step 7: Update Print Template
**File**: `d:/PLUS/copy/cashier/src/renderer/purchase_invoices/print-a4.html`

Modify the print template to detect and display returns:

```javascript
// After loading invoice data, check doc_type
const isReturn = String(invoice.doc_type||'') === 'return' || String(invoice.invoice_no||'').startsWith('PR-');

if(isReturn){
  // Change title badge
  document.querySelector('.invoice-type-ar').textContent = 'مرتجع مشتريات';
  
  // Add reference to original invoice
  const metaGrid = document.querySelector('.invoice-meta-grid');
  const refCell = document.createElement('div');
  refCell.className = 'invoice-meta-cell';
  refCell.innerHTML = `<strong>الفاتورة الأصلية:</strong> <span>${invoice.ref_base_invoice_no || '-'}</span>`;
  metaGrid.appendChild(refCell);
  
  // Show negative amounts in red
  document.querySelectorAll('.invoice-totals-table td:last-child').forEach(td => {
    const val = Number(td.textContent.replace(/[^\d.-]/g, ''));
    if(val < 0){
      td.style.color = '#dc2626';
    }
  });
}
```

### Step 8: Register IPC Handlers
**File**: `d:/PLUS/copy/cashier/src/main/main.js`

Ensure the new IPC handlers are registered (should be automatic if `purchase_invoices.js` is already imported).

## Testing Checklist

1. Create a purchase invoice with multiple items
2. Navigate to "المشتريات المرتجعة" tab
3. Enter the invoice number and click "معالجة"
4. Verify items display with correct available quantities
5. Select some items and specify return quantities
6. Click "حفظ وطباعة المرتجع"
7. Verify:
   - Return invoice created with PR- numbering
   - Stock decreased for returned items
   - Print window opens
   - Return appears in saved returns list
   - Supplier balance adjusted if original was credit
8. Try to return more than available - should show error
9. Try to return from already-returned invoice - should validate correctly

## Files Modified

1. `d:/PLUS/copy/cashier/src/main/purchase_invoices.js` - Database schema + IPC handlers
2. `d:/PLUS/copy/cashier/src/renderer/purchase_invoices/index.html` - UI for returns tab
3. `d:/PLUS/copy/cashier/src/renderer/purchase_invoices/renderer.js` - Returns logic
4. `d:/PLUS/copy/cashier/src/renderer/purchase_invoices/print-a4.html` - Print template updates
