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

// عرض رسائل التنبيه في منتصف الشاشة
function showAlert(message, type='info'){
  const existing = document.getElementById('zatca-toast');
  if(existing) existing.remove();

  const colors = {
    success: { bg: '#22c55e', icon: '✅' },
    error:   { bg: '#ef4444', icon: '❌' },
    info:    { bg: '#3b82f6', icon: 'ℹ️' },
  };
  const c = colors[type] || colors.info;

  const toast = document.createElement('div');
  toast.id = 'zatca-toast';
  toast.style.cssText = [
    'position:fixed',
    'top:50%',
    'left:50%',
    'transform:translate(-50%,-50%) scale(0.85)',
    'background:' + c.bg,
    'color:#fff',
    'padding:28px 48px',
    'border-radius:16px',
    'font-size:22px',
    'font-weight:700',
    'text-align:center',
    'z-index:99999',
    'box-shadow:0 8px 40px rgba(0,0,0,0.35)',
    'opacity:0',
    'transition:opacity 0.25s ease, transform 0.25s ease',
    'pointer-events:none',
    'min-width:260px',
  ].join(';');
  toast.innerHTML = `<div style="font-size:40px;margin-bottom:10px">${c.icon}</div>${message}`;
  document.body.appendChild(toast);

  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translate(-50%,-50%) scale(1)';
  });

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translate(-50%,-50%) scale(0.85)';
    setTimeout(() => { if(toast.parentNode) toast.remove(); }, 280);
  }, 3000);
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