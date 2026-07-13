require('dotenv').config();

const Module = require('module');
const mysql = require('mysql2/promise');

const handlers = new Map();
const originalLoad = Module._load;
Module._load = function mockElectron(request, parent, isMain) {
  if (request === 'electron') {
    return {
      ipcMain: { handle: (channel, callback) => handlers.set(channel, callback) },
      BrowserWindow: { getAllWindows: () => [] },
    };
  }
  return originalLoad.call(this, request, parent, isMain);
};

const { registerPurchaseInvoicesIPC } = require('../src/main/purchase_invoices');
registerPurchaseInvoicesIPC();

const invoke = async (channel, ...args) => {
  const handler = handlers.get(channel);
  if (!handler) throw new Error(`Missing IPC handler: ${channel}`);
  return handler({}, ...args);
};
const money = (amount) => Number(Number(amount || 0).toFixed(2));
const assertEqual = (actual, expected, label) => {
  if (money(actual) !== money(expected)) throw new Error(`${label}: expected ${expected}, received ${actual}`);
};

async function run() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
  });
  let supplierId;
  let productId;
  const invoiceIds = [];
  try {
    const marker = `CODEX-PI-E2E-${Date.now()}`;
    const [supplier] = await connection.query('INSERT INTO suppliers (name, phone, balance) VALUES (?,?,0)', [marker, '0000000000']);
    supplierId = supplier.insertId;
    const [product] = await connection.query('INSERT INTO products (name, barcode, price, cost, stock) VALUES (?,?,?,?,0)', [marker, marker, 1000, 0]);
    productId = product.insertId;

    const basePayload = {
      supplier_id: supplierId,
      items: [{ product_id: productId, qty: 2, unit_cost: 100, discount_line: 0 }],
      discount_general: 20,
      vat_percent: 15,
      price_mode: 'exclusive',
      invoice_dt: '2026-07-13T20:00',
      notes: marker,
    };

    const cashAdd = await invoke('purchase_invoices:add', { ...basePayload, payment_method: 'cash' });
    if (!cashAdd.ok) throw new Error(cashAdd.error);
    invoiceIds.push(cashAdd.id);
    const cashInvoice = await invoke('purchase_invoices:get', { id: cashAdd.id });
    assertEqual(cashInvoice.item.sub_total, 180, 'cash net exclusive');
    assertEqual(cashInvoice.item.vat_total, 27, 'cash VAT');
    assertEqual(cashInvoice.item.grand_total, 207, 'cash grand total');
    assertEqual(cashInvoice.item.amount_paid, 207, 'cash paid');
    assertEqual(cashInvoice.item.amount_due, 0, 'cash due');
    const cashDelete = await invoke('purchase_invoices:delete', { id: cashAdd.id });
    if (!cashDelete.ok) throw new Error(cashDelete.error);
    invoiceIds.splice(invoiceIds.indexOf(cashAdd.id), 1);

    const creditAdd = await invoke('purchase_invoices:add', { ...basePayload, items: [{ product_id: productId, qty: 4, unit_cost: 100 }], discount_general: 40, payment_method: 'credit' });
    if (!creditAdd.ok) throw new Error(creditAdd.error);
    invoiceIds.push(creditAdd.id);
    const payment = await invoke('purchase_invoices:pay', { purchase_id: creditAdd.id, amount: 100, note: marker });
    if (!payment.ok) throw new Error(payment.error);
    assertEqual(payment.new_paid, 100, 'partial paid');
    assertEqual(payment.new_due, 314, 'partial due');

    const creditUpdate = await invoke('purchase_invoices:update', { id: creditAdd.id }, {
      ...basePayload,
      items: [{ product_id: productId, qty: 5, unit_cost: 100 }],
      discount_general: 50,
      payment_method: 'credit',
    });
    if (!creditUpdate.ok) throw new Error(creditUpdate.error);
    const updated = await invoke('purchase_invoices:get', { id: creditAdd.id });
    assertEqual(updated.item.grand_total, 517.5, 'updated grand total');
    assertEqual(updated.item.amount_paid, 100, 'updated preserved paid');
    assertEqual(updated.item.amount_due, 417.5, 'updated due');

    const purchaseReturn = await invoke('purchase_invoices:create_return', {
      original_invoice_id: creditAdd.id,
      items: [{ product_id: productId, qty: 1 }],
      return_dt: '2026-07-13T21:00',
      reason: marker,
    });
    if (!purchaseReturn.ok) throw new Error(purchaseReturn.error);
    invoiceIds.push(purchaseReturn.id);
    const returned = await invoke('purchase_invoices:get', { id: purchaseReturn.id });
    assertEqual(Math.abs(returned.item.sub_total), 90, 'return net exclusive');
    assertEqual(Math.abs(returned.item.vat_total), 13.5, 'return VAT');
    assertEqual(Math.abs(returned.item.grand_total), 103.5, 'return grand total');

    const blockedEdit = await invoke('purchase_invoices:update', { id: creditAdd.id }, { ...basePayload, payment_method: 'credit' });
    if (blockedEdit.ok) throw new Error('Invoice with a linked return was editable');
    const blockedDelete = await invoke('purchase_invoices:delete', { id: creditAdd.id });
    if (blockedDelete.ok) throw new Error('Paid invoice was deletable');

    const [[productState]] = await connection.query('SELECT stock, cost FROM products WHERE id=?', [productId]);
    const [[supplierState]] = await connection.query('SELECT balance FROM suppliers WHERE id=?', [supplierId]);
    assertEqual(productState.stock, 4, 'stock after update and return');
    assertEqual(productState.cost, 115, 'stored inclusive product cost');
    assertEqual(supplierState.balance, 314, 'supplier balance after payment, edit and return');

    console.log(JSON.stringify({
      ok: true,
      cashInvoice: { pre: 180, vat: 27, grand: 207, paid: 207, due: 0 },
      creditInvoice: { grand: 517.5, paid: 100, due: 417.5 },
      purchaseReturn: { pre: 90, vat: 13.5, grand: 103.5 },
      finalState: { stock: Number(productState.stock), productCost: Number(productState.cost), supplierBalance: Number(supplierState.balance) },
      protections: { editAfterReturnBlocked: true, deletePaidInvoiceBlocked: true },
    }, null, 2));
  } finally {
    if (invoiceIds.length) {
      await connection.query('DELETE FROM purchase_invoice_details WHERE purchase_id IN (?)', [invoiceIds]);
      await connection.query('DELETE FROM purchase_payments WHERE purchase_id IN (?)', [invoiceIds]);
      await connection.query('DELETE FROM purchase_invoices WHERE id IN (?)', [invoiceIds]);
    }
    if (productId) await connection.query('DELETE FROM products WHERE id=?', [productId]);
    if (supplierId) await connection.query('DELETE FROM suppliers WHERE id=?', [supplierId]);
    await connection.end();
  }
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
