// شاشة مبسطة لإعدادات الربط مع هيئة الزكاة (ZATCA)
let currentConfig = {};

function goBack(){
  try{
    if(window.electronAPI?.navigation?.goTo){ window.electronAPI.navigation.goTo('main'); return; }
  }catch(_){ }
  // Fallback
  window.location.href = '../main/index.html';
}

// تهيئة الصفحة
document.addEventListener('DOMContentLoaded', async () => {
  await loadConfig();
  setupEventHandlers();
});

// تحميل الإعدادات الحالية
async function loadConfig(){
  try{
    const result = await window.electronAPI.zatca.getConfig();
    currentConfig = result || {};
    populateSettingsForm();
  }catch(e){ console.error('خطأ في تحميل الإعدادات:', e); showAlert('خطأ في تحميل الإعدادات','error'); }
}

// ملء نموذج الإعدادات
function populateSettingsForm(){
  const form = document.getElementById('zatca-settings-form');
  if(!form) return;
  const cd = currentConfig.companyData || {};
  setValue('company-name', cd.organizationName || '');
  setValue('vat-number', cd.vatNumber || '');
  setValue('commercial-registration', cd.commercialRegistration || '');
  setValue('business-category', cd.businessCategory || 'Supply activities');
  setValue('branch-name', cd.branchName || '');
  setValue('email', cd.email || '');
  setValue('street', cd.address?.street || '');
  setValue('building', cd.address?.building || '');
  setValue('city', cd.address?.city || 'الرياض');
  setValue('postal-code', cd.address?.postalCode || '');
  setValue('district', cd.address?.district || '');
}

function setValue(id, val){ const el = document.getElementById(id); if(el) el.value = val; }

// إعداد معالجات الأحداث
function setupEventHandlers(){
  const form = document.getElementById('zatca-settings-form');
  if(form){ form.addEventListener('submit', handleSettingsSubmit); }
}

// حفظ الإعدادات
async function handleSettingsSubmit(ev){
  ev.preventDefault();
  const fd = new FormData(ev.target);
  const settings = {
    companyData: {
      organizationName: fd.get('companyName'),
      vatNumber: fd.get('vatNumber'),
      commercialRegistration: fd.get('commercialRegistration'),
      businessCategory: fd.get('businessCategory') || 'Supply activities',
      branchName: fd.get('branchName') || undefined,
      email: fd.get('email') || undefined,
      address: {
        street: fd.get('street')||'',
        building: fd.get('building')||'',
        city: fd.get('city')||'الرياض',
        postalCode: fd.get('postalCode')||'',
        district: fd.get('district')||'',
        country: 'SA'
      }
    }
  };
  try{
    showLoading(true);
    const res = await window.electronAPI.zatca.saveConfig(settings);
    if(res && res.success){ showAlert('تم حفظ الإعدادات بنجاح','success'); await loadConfig(); }
    else{ showAlert((res && res.message)||'فشل حفظ الإعدادات','error'); }
  }catch(e){ console.error('خطأ في حفظ الإعدادات:', e); showAlert('خطأ في حفظ الإعدادات','error'); }
  finally{ showLoading(false); }
}

// عرض رسائل التنبيه
function showAlert(message, type='info'){
  const existing = document.querySelector('.alert');
  if(existing) existing.remove();
  const div = document.createElement('div');
  div.className = `alert alert-${type}`;
  div.textContent = message;
  const container = document.getElementById('settings-content');
  if(container){ container.insertBefore(div, container.firstChild); setTimeout(()=>{ if(div.parentNode) div.remove(); }, 5000); }
}

// شاشة تحميل بسيطة
function showLoading(show){
  let overlay = document.getElementById('loading-overlay');
  if(show){
    if(!overlay){
      overlay = document.createElement('div');
      overlay.id = 'loading-overlay';
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);display:flex;justify-content:center;align-items:center;z-index:9999';
      overlay.innerHTML = '<div style="background:#fff;padding:30px;border-radius:10px;text-align:center"><div class="spinner"></div><div>جارٍ المعالجة...</div></div>';
      document.body.appendChild(overlay);
    }
    overlay.style.display='flex';
  }else if(overlay){ overlay.style.display='none'; }
}