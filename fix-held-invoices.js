// إصلاح الفواتير المعلقة التالفة
const { dbAdapter } = require('./src/db/db-adapter');

async function fixHeldInvoices() {
  try {
    const conn = await dbAdapter.getConnection();
    try {
      console.log('جاري فحص الفواتير المعلقة...\n');
      
      const [rows] = await conn.query('SELECT id, invoice_data FROM held_invoices');
      console.log(`تم العثور على ${rows.length} فاتورة معلقة\n`);
      
      let validCount = 0;
      let invalidCount = 0;
      const invalidIds = [];
      
      for (const row of rows) {
        try {
          const parsed = JSON.parse(row.invoice_data);
          
          // التحقق من وجود السلة وأنها صحيحة
          if (!parsed.cart || !Array.isArray(parsed.cart) || parsed.cart.length === 0) {
            console.log(`❌ فاتورة #${row.id}: السلة فارغة أو غير صحيحة`);
            invalidIds.push(row.id);
            invalidCount++;
          } else {
            console.log(`✓ فاتورة #${row.id}: صحيحة (${parsed.cart.length} منتج)`);
            validCount++;
          }
        } catch (e) {
          console.log(`❌ فاتورة #${row.id}: خطأ في تحليل JSON - ${e.message}`);
          invalidIds.push(row.id);
          invalidCount++;
        }
      }
      
      console.log(`\n=================`);
      console.log(`الفواتير الصحيحة: ${validCount}`);
      console.log(`الفواتير التالفة: ${invalidCount}`);
      console.log(`=================\n`);
      
      if (invalidIds.length > 0) {
        console.log('الفواتير التالفة التي سيتم حذفها:', invalidIds.join(', '));
        console.log('\nجاري حذف الفواتير التالفة...');
        
        for (const id of invalidIds) {
          await conn.query('DELETE FROM held_invoices WHERE id = ?', [id]);
        }
        
        console.log(`\n✓ تم حذف ${invalidIds.length} فاتورة تالفة بنجاح`);
      } else {
        console.log('✓ جميع الفواتير المعلقة صحيحة');
      }
      
    } finally {
      conn.release();
    }
    
    process.exit(0);
  } catch (e) {
    console.error('خطأ:', e);
    process.exit(1);
  }
}

fixHeldInvoices();
