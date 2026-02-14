// تحويل الفواتير المعلقة من الصيغة القديمة إلى الصيغة الجديدة
const { dbAdapter } = require('./src/db/db-adapter');

async function migrateHeldInvoices() {
  try {
    const conn = await dbAdapter.getConnection();
    try {
      console.log('جاري تحويل الفواتير المعلقة من الصيغة القديمة إلى الصيغة الجديدة...\n');
      
      const [rows] = await conn.query('SELECT id, invoice_data FROM held_invoices');
      console.log(`تم العثور على ${rows.length} فاتورة معلقة\n`);
      
      let successCount = 0;
      let failedCount = 0;
      let alreadyMigratedCount = 0;
      
      for (const row of rows) {
        try {
          const oldData = JSON.parse(row.invoice_data);
          
          // التحقق إذا كانت البيانات بالصيغة الجديدة بالفعل
          if (oldData.cart && Array.isArray(oldData.cart)) {
            console.log(`⏭️  فاتورة #${row.id}: بالصيغة الجديدة بالفعل (تم تخطيها)`);
            alreadyMigratedCount++;
            continue;
          }
          
          // التحقق من وجود البيانات القديمة
          if (!oldData.items || !Array.isArray(oldData.items) || oldData.items.length === 0) {
            console.log(`❌ فاتورة #${row.id}: لا توجد منتجات للتحويل`);
            failedCount++;
            continue;
          }
          
          // تحويل البيانات إلى الصيغة الجديدة
          const newData = {
            timestamp: oldData.metadata?.bill_date || new Date().toISOString(),
            cart: oldData.items.map(item => ({
              id: item.type_id || 0,
              name: item.type_name || 'منتج غير معروف',
              barcode: item.type_barcode || '',
              price: parseFloat(item.type_cost) || 0,
              qty: parseFloat(item.type_count) || 1,
              total: parseFloat(item.type_total_cost) || 0,
              description: '',
              unit_name: item.sell_unit || 'قطعة',
              unit_multiplier: 1,
              operation_id: null,
              operation_name: null,
              employee_id: null,
              vat_enabled: item.type_is_vat !== false
            })),
            customer: oldData.customer?.id ? String(oldData.customer.id) : '',
            driver: '',
            paymentMethod: oldData.payment?.payment_method || 'cash',
            cashReceived: '',
            discountType: 'none',
            discountValue: '',
            extraValue: '',
            coupon: null,
            notes: oldData.metadata?.bill_comment || '',
            couponCode: ''
          };
          
          // حفظ البيانات المحولة
          const newInvoiceData = JSON.stringify(newData);
          await conn.query(
            'UPDATE held_invoices SET invoice_data = ? WHERE id = ?',
            [newInvoiceData, row.id]
          );
          
          console.log(`✓ فاتورة #${row.id}: تم التحويل بنجاح (${newData.cart.length} منتج) - العميل: ${oldData.customer?.name || 'غير محدد'}`);
          successCount++;
          
        } catch (e) {
          console.error(`❌ فاتورة #${row.id}: خطأ في التحويل - ${e.message}`);
          failedCount++;
        }
      }
      
      console.log(`\n=================`);
      console.log(`الفواتير المحولة بنجاح: ${successCount}`);
      console.log(`الفواتير بالصيغة الجديدة (تم تخطيها): ${alreadyMigratedCount}`);
      console.log(`الفواتير الفاشلة: ${failedCount}`);
      console.log(`=================\n`);
      
      if (successCount > 0) {
        console.log('✓ تم التحويل بنجاح! يمكنك الآن استرجاع الفواتير من البرنامج');
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

migrateHeldInvoices();
