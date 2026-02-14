const si = require('systeminformation');

async function testSystemInformation() {
  console.log('='.repeat(50));
  console.log('اختبار مكتبة systeminformation');
  console.log('='.repeat(50));
  
  try {
    console.log('\n1️⃣ جلب معلومات المازربورد (Baseboard):');
    const baseboard = await si.baseboard();
    console.log('   - المصنع:', baseboard.manufacturer);
    console.log('   - الموديل:', baseboard.model);
    console.log('   - الرقم التسلسلي:', baseboard.serial || 'غير متوفر');
    console.log('   - الإصدار:', baseboard.version);
    
    console.log('\n2️⃣ جلب معلومات شبكات Ethernet:');
    const networkInterfaces = await si.networkInterfaces();
    const ethernetAdapters = networkInterfaces.filter(iface => 
      iface.iface && iface.iface.toLowerCase().includes('ethernet')
    );
    
    if (ethernetAdapters.length > 0) {
      ethernetAdapters.forEach((adapter, index) => {
        console.log(`\n   محول #${index + 1}:`);
        console.log('   - الاسم:', adapter.iface);
        console.log('   - MAC Address:', adapter.mac);
        console.log('   - عنوان IP:', adapter.ip4);
        console.log('   - الحالة:', adapter.operstate);
      });
    } else {
      console.log('   ⚠️ لم يتم العثور على محولات Ethernet');
    }
    
    console.log('\n3️⃣ جلب معلومات الهارد ديسك (Disk):');
    const diskLayout = await si.diskLayout();
    if (diskLayout && diskLayout.length > 0) {
      diskLayout.forEach((disk, index) => {
        console.log(`\n   هارد ديسك #${index + 1}:`);
        console.log('   - النوع:', disk.type);
        console.log('   - الاسم:', disk.name);
        console.log('   - الحجم:', (disk.size / (1024**3)).toFixed(2), 'GB');
        console.log('   - الرقم التسلسلي:', disk.serialNum || 'غير متوفر');
        console.log('   - الواجهة:', disk.interfaceType);
      });
    } else {
      console.log('   ⚠️ لم يتم العثور على أقراص صلبة');
    }
    
    console.log('\n4️⃣ اختبار الدوال المستخدمة في البرنامج:');
    
    const baseboardResult = baseboard.serial 
      ? { ok: true, serial: baseboard.serial }
      : { ok: false, error: 'فشل قراءة رقم المازربورد' };
    console.log('   - نتيجة hw:get_baseboard_serial:', baseboardResult);
    
    const ethernetAdapter = networkInterfaces.find(iface => 
      iface.iface && iface.iface.toLowerCase().includes('ethernet') && iface.mac
    );
    const macResult = ethernetAdapter && ethernetAdapter.mac
      ? { ok: true, mac: ethernetAdapter.mac }
      : { ok: false, error: 'فشل قراءة MAC لـ Ethernet' };
    console.log('   - نتيجة hw:get_mac_ethernet:', macResult);
    
    const diskResult = diskLayout && diskLayout.length > 0 && diskLayout[0].serialNum
      ? { ok: true, serial: diskLayout[0].serialNum }
      : { ok: false, error: 'فشل قراءة رقم الهارد ديسك' };
    console.log('   - نتيجة hw:get_disk_serial:', diskResult);
    
    console.log('\n✅ الاختبار اكتمل بنجاح!');
    console.log('='.repeat(50));
    
  } catch (error) {
    console.error('\n❌ حدث خطأ أثناء الاختبار:');
    console.error(error);
    console.log('='.repeat(50));
  }
}

testSystemInformation();
