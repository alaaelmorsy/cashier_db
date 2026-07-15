// شاشة الربط الإلكتروني المباشر مع ZATCA — تستهلك window.electronAPI.zatcaDirect.*
(function(){
  const $ = (id) => document.getElementById(id);
  const api = window.electronAPI && window.electronAPI.zatcaDirect;

  let currentStatus = null;

  function fallbackToast(message, ok){
    const el = $('toast');
    el.textContent = message;
    el.className = ok ? 'toast-success' : 'toast-error';
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 5000);
  }

  function notify(message, ok = true, title){
    if(window.Swal && typeof window.Swal.fire === 'function'){
      return window.Swal.fire({
        icon: ok ? 'success' : 'error',
        title: title || (ok ? 'تم بنجاح' : 'تعذر إكمال العملية'),
        text: String(message || ''),
        confirmButtonText: 'حسناً',
        confirmButtonColor: ok ? '#087f6a' : '#c62828',
      });
    }
    fallbackToast(message, ok);
    return Promise.resolve();
  }

  async function confirmAction(title, text, icon = 'warning'){
    if(window.Swal && typeof window.Swal.fire === 'function'){
      const result = await window.Swal.fire({
        icon,
        title,
        text,
        showCancelButton: true,
        confirmButtonText: 'نعم، متابعة',
        cancelButtonText: 'إلغاء',
        confirmButtonColor: '#087f6a',
        cancelButtonColor: '#64748b',
        reverseButtons: true,
        focusCancel: true,
      });
      return result.isConfirmed === true;
    }
    fallbackToast('مكتبة التأكيد غير متاحة. لم يتم تنفيذ الإجراء حفاظاً على الأمان.', false);
    return false;
  }

  async function call(promise, busyBtn){
    if(busyBtn){ busyBtn.disabled = true; busyBtn.classList.add('opacity-60'); }
    try{
      const res = await promise;
      if(!res || res.success !== true) throw new Error((res && res.message) || 'حدث خطأ غير متوقع');
      return res;
    } finally {
      if(busyBtn){ busyBtn.disabled = false; busyBtn.classList.remove('opacity-60'); }
    }
  }

  const MODE_LABELS = { unlinked: 'غير مربوط', legacy: 'الوضع القديم (وسيط محلي)', direct: 'الربط المباشر' };
  const ENV_LABELS = { sandbox: 'تجريبية', simulation: 'محاكاة', production: 'إنتاج' };

  function renderStatus(st){
    currentStatus = st;
    // مبدّل الوضع: التحويل للقديم متاح ما لم يكن الجهاز عليه أصلًا،
    // والتحويل للمباشر متاح فقط بعد شهادة إنتاج قائمة.
    $('modeLabel').textContent = MODE_LABELS[st.mode] || st.mode;
    $('btnUseLegacy').classList.toggle('hidden', st.mode === 'legacy');
    const canDirect = st.status === 'production_ready' && st.mode !== 'direct';
    $('btnUseDirect').classList.toggle('hidden', !canDirect);
    if(st.environment) $('f_env').value = st.environment;
    // تمييز الخطوة الحالية
    const order = ['csr_generated', 'compliance_issued', 'compliance_passed', 'production_ready'];
    const idx = order.indexOf(st.status);
    const steps = [['stepCsr', 0], ['stepOtp', 1], ['stepChecks', 2], ['stepProd', 3]];
    for(const [id, i] of steps){
      const el = $(id);
      el.classList.remove('step-done', 'step-active');
      if(idx >= i) el.classList.add('step-done');
      else if(idx === i - 1 || (idx === -1 && i === 0)) el.classList.add('step-active');
    }
    const prerequisites = [true, idx >= 0, idx >= 1, idx >= 2];
    const actions = [['stepCsr', 'btnCsr', null], ['stepOtp', 'btnOtp', 'otp'], ['stepChecks', 'btnChecks', 'checks'], ['stepProd', 'btnProd', 'prod']];
    actions.forEach(([stepId, buttonId, lockKey], i) => {
      const unlocked = prerequisites[i];
      $(buttonId).disabled = !unlocked;
      $(stepId).classList.toggle('locked', !unlocked);
      if(lockKey){
        const note = document.querySelector(`[data-lock="${lockKey}"]`);
        if(note) note.textContent = unlocked ? '' : 'أكمل الخطوة السابقة أولاً لفتح هذا الإجراء.';
      }
    });
  }

  function renderSettings(s){
    if(!s) return;
    $('f_company').value = s.companyName || '';
    $('f_vat').value = s.vatNumber || '';
    $('f_cr').value = s.commercialRegistration || '';
    $('f_branch').value = s.branchName || '';
    $('f_category').value = s.businessCategory || 'Supply activities';
    $('f_email').value = s.email || '';
    const a = s.address || {};
    $('f_street').value = a.street || '';
    $('f_building').value = a.building || '';
    $('f_district').value = a.district || '';
    $('f_city').value = a.city || 'الرياض';
    $('f_postal').value = a.postalCode || '';
    $('f_start_date').value = s.sendStartDate || '';
  }

  async function refresh(){
    try{
      const st = await call(api.getStatus());
      renderStatus(st);
    }catch(e){ notify(e.message, false); }
  }

  async function init(){
    if(!api){ notify('واجهة الربط المباشر غير متاحة', false); return; }
    await refresh();
    try{
      const res = await call(api.getSettings());
      renderSettings(res.settings);
    }catch(e){ notify(e.message, false); }
  }

  $('btnBack').addEventListener('click', () => { window.electronAPI.navigation.goTo('main'); });
  $('btnOpenLegacyScreen').addEventListener('click', () => { window.electronAPI.navigation.goTo('zatca'); });

  $('btnUseLegacy').addEventListener('click', async (ev) => {
    if(!await confirmAction('التحويل إلى الوضع القديم', 'ستُرسل الفواتير الجديدة عبر الوسيط المحلي على المنفذ 8080. تبقى شهادات الربط المباشر محفوظة ويمكن العودة إليها في أي وقت.')) return;
    try{
      await call(api.setMode('legacy'), ev.currentTarget);
      notify('تم التحويل إلى الوضع القديم', true);
      await refresh();
    }catch(e){ notify(e.message, false); }
  });

  $('btnUseDirect').addEventListener('click', async (ev) => {
    if(!await confirmAction('تفعيل الربط المباشر', 'ستُرسل الفواتير الجديدة مباشرة إلى الهيئة بشهادة الإنتاج القائمة، دون وسيط محلي.')) return;
    try{
      await call(api.setMode('direct'), ev.currentTarget);
      notify('تم التحويل إلى الربط المباشر', true);
      await refresh();
    }catch(e){ notify(e.message, false); }
  });

  $('btnSaveSettings').addEventListener('click', async (ev) => {
    try{
      await call(api.saveSettings({
        companyName: $('f_company').value,
        vatNumber: $('f_vat').value,
        commercialRegistration: $('f_cr').value,
        businessCategory: $('f_category').value,
        branchName: $('f_branch').value,
        email: $('f_email').value,
        sendStartDate: $('f_start_date').value || null,
        address: {
          street: $('f_street').value,
          building: $('f_building').value,
          district: $('f_district').value,
          city: $('f_city').value,
          postalCode: $('f_postal').value,
        },
      }), ev.currentTarget);
      notify('تم حفظ بيانات المنشأة', true);
    }catch(e){ notify(e.message, false); }
  });

  $('btnCsr').addEventListener('click', async (ev) => {
    const env = $('f_env').value;
    const warn = currentStatus && currentStatus.status !== 'not_started'
      ? '\nتنبيه: توليد CSR جديد يمسح الشهادات الحالية.' : '';
    if(!await confirmAction('توليد طلب شهادة جديد', `سيتم إنشاء CSR على بيئة «${ENV_LABELS[env]}».${warn}`)) return;
    try{
      await call(api.generateCsr({ environment: env }), ev.currentTarget);
      notify('تم توليد CSR بنجاح — تابع بخطوة OTP', true);
      await refresh();
    }catch(e){ notify(e.message, false); }
  });

  $('btnOtp').addEventListener('click', async (ev) => {
    const otp = $('f_otp').value.trim();
    if(!otp){ notify('أدخل رمز OTP أولًا', false, 'بيانات مطلوبة'); return; }
    try{
      await call(api.requestComplianceCsid(otp), ev.currentTarget);
      notify('صدرت شهادة الامتثال — شغّل اختبارات الامتثال', true);
      await refresh();
    }catch(e){ notify(e.message, false); }
  });

  $('btnChecks').addEventListener('click', async (ev) => {
    const box = $('checksResult');
    box.classList.remove('hidden');
    const loading = document.createElement('div');
    loading.className = 'check-line';
    loading.textContent = 'جاري تنفيذ الاختبارات الستة...';
    box.replaceChildren(loading);
    try{
      await call(api.runComplianceChecks(), ev.currentTarget);
      const successLine = document.createElement('div');
      successLine.className = 'check-line ok';
      successLine.textContent = 'تم';
      box.replaceChildren(successLine);
      notify('اجتازت كل اختبارات الامتثال — أصدر شهادة الإنتاج', true);
      await refresh();
    }catch(e){
      box.classList.add('hidden');
      box.replaceChildren();
      notify(e.message, false);
    }
  });

  $('btnProd').addEventListener('click', async (ev) => {
    // تأكيد صريح — خاصةً للانتقال الطوعي من الوضع القديم (FR-003)
    const legacyNote = currentStatus && currentStatus.mode === 'legacy'
      ? '\n\nهذا الجهاز يعمل حاليًا بالوضع القديم. بعد إصدار شهادة الإنتاج سيتحول نهائيًا إلى الربط المباشر ويبدأ سلسلة فواتير جديدة لدى الهيئة (الفواتير السابقة تبقى كما هي).'
      : '';
    if(!await confirmAction('إصدار شهادة الإنتاج', 'سيكتمل الربط ويُفعّل الإرسال المباشر للهيئة.' + legacyNote)) return;
    try{
      const res = await call(api.requestProductionCsid(), ev.currentTarget);
      notify(`اكتمل الربط بنجاح — الشهادة سارية حتى ${String(res.expiresAt || '').slice(0, 10)}`, true);
      await refresh();
    }catch(e){ notify(e.message, false); }
  });

  init();
})();
