// فحص البيانات في جدول الفواتير المعلقة
const { dbAdapter } = require('./src/db/db-adapter');

async function checkHeldInvoices() {
  try {
    const conn = await dbAdapter.getConnection();
    try {
      const [rows] = await conn.query('SELECT id, invoice_data FROM held_invoices');
      console.log('إجمالي الفواتير المعلقة:', rows.length);
      console.log('\n=================\n');
      
      let validCount = 0;
      let invalidCount = 0;
      
      rows.forEach((row, index) => {
        console.log(`\nفاتورة #${row.id}:`);
        
        if (index < 3) {
          console.log('البيانات الخام:', row.invoice_data.substring(0, 300));
        }
        
        console.log('---');
        
        try {
          const parsed = JSON.parse(row.invoice_data);
          console.log('حالة البيانات:');
          console.log('  - timestamp:', parsed.timestamp || 'غير موجود');
          console.log('  - customer:', parsed.customer || 'غير موجود');
          console.log('  - نوع cart:', typeof parsed.cart);
          console.log('  - هل cart صحيح؟', Array.isArray(parsed.cart) ? 'نعم' : 'لا');
          console.log('  - عدد المنتجات:', Array.isArray(parsed.cart) ? parsed.cart.length : 'غير صحيح');
          
          if (parsed.cart && Array.isArray(parsed.cart) && parsed.cart.length > 0) {
            console.log('  - ✓ السلة صحيحة');
            if (index < 3) {
              console.log('  - أول منتج:', JSON.stringify(parsed.cart[0], null, 2));
            }
            validCount++;
          } else {
            console.log('  - ❌ السلة فارغة أو غير صحيحة!');
            invalidCount++;
          }
        } catch (e) {
          console.error('  - ❌ خطأ في تحليل JSON:', e.message);
          invalidCount++;
        }
        console.log('\n=================\n');
      });
      
      console.log('\nالملخص النهائي:');
      console.log(`الفواتير الصحيحة: ${validCount}`);
      console.log(`الفواتير التالفة: ${invalidCount}`);
      
    } finally {
      conn.release();
    }
    
    process.exit(0);
  } catch (e) {
    console.error('خطأ:', e);
    process.exit(1);
  }
}

checkHeldInvoices();
