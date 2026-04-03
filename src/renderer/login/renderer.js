// Renderer script for login page with Remember Me (supports multiple accounts)
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const loginBtn = document.getElementById('loginBtn');
const rememberCheck = document.getElementById('rememberCheck');
const errorDiv = document.getElementById('error');
const savedWrap = document.getElementById('savedWrap');
const savedUsersDiv = document.getElementById('savedUsers');
const toggleEye = document.getElementById('toggleEye');
const savedUsersList = document.getElementById('savedUsersList');
const deleteSavedBtn = document.getElementById('deleteSavedBtn');


// Local storage helpers
const STORAGE_KEY = 'pos_saved_accounts';
function loadSavedAccounts() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch (e) { return []; }
}
function saveAccounts(list) { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); }

function upsertAccount(username, password) {
  const list = loadSavedAccounts();
  const idx = list.findIndex(x => x.username === username);
  const entry = { username, password, ts: Date.now() };
  if (idx >= 0) list[idx] = entry; else list.push(entry);
  saveAccounts(list);
  // Persist fallback file as well
  try { window.api.saved_accounts_set && window.api.saved_accounts_set(list); } catch (_) { }
}
function removeAccount(username) {
  const list = loadSavedAccounts().filter(x => x.username !== username);
  saveAccounts(list);
  // Update fallback file
  try { window.api.saved_accounts_set && window.api.saved_accounts_set(list); } catch (_) { }
}

async function syncSavedAccounts() {
  try {
    if (!(window.api && window.api.saved_accounts_get)) return;
    const res = await window.api.saved_accounts_get();
    if (!(res && res.ok)) return;
    const local = loadSavedAccounts();
    const mergedMap = new Map();
    // Put local first
    for (const acc of Array.isArray(local) ? local : []) { mergedMap.set(acc.username, acc); }
    // Merge remote (take most recent ts)
    for (const acc of Array.isArray(res.list) ? res.list : []) {
      const cur = mergedMap.get(acc.username);
      if (!cur || (acc.ts && acc.ts > (cur.ts || 0))) { mergedMap.set(acc.username, acc); }
    }
    const merged = Array.from(mergedMap.values());
    saveAccounts(merged);
    try { window.api.saved_accounts_set && window.api.saved_accounts_set(merged); } catch (_) { }
  } catch (_) { }
}

function renderSavedAccounts() {
  const list = loadSavedAccounts()
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 10); // آخر 10
  // أخفِ قسم الحسابات المحفوظة أسفل زر الدخول دائماً
  if (savedWrap) savedWrap.style.display = 'none';
  // لا نعرض أي chips
  if (savedUsersDiv) savedUsersDiv.innerHTML = '';
  // عبّي قائمة datalist لحقل اسم المستخدم
  if (savedUsersList) {
    savedUsersList.innerHTML = '';
    list.forEach(acc => {
      const opt = document.createElement('option');
      opt.value = acc.username;
      savedUsersList.appendChild(opt);
    });
  }
  // إذا كان هناك مستخدم واحد فقط محفوظ، عبّي الحقول مباشرة
  // وإذا كان هناك أكثر من مستخدم، أظهر القائمة المنسدلة للاختيار
  if (list.length === 1) {
    const acc = list[0];
    if (usernameInput) usernameInput.value = acc.username;
    if (passwordInput) passwordInput.value = acc.password || '';
    if (rememberCheck) rememberCheck.checked = true;
    // أخفِ القائمة المنسدلة في حالة المستخدم الواحد
    if (savedUsersList) savedUsersList.innerHTML = '';
  }
}

renderSavedAccounts();

// Sync with fallback file then re-render options
(async () => {
  try {
    await syncSavedAccounts();
  } catch (_) { }
  try {
    // After syncing, re-render which will auto-fill if single account
    renderSavedAccounts();
    updateDeleteBtn();
  } catch (_) { }
})();

function isSaved(username) {
  return loadSavedAccounts().some(x => x.username === username);
}

function updateDeleteBtn() {
  if (!deleteSavedBtn) return;
  const u = usernameInput.value.trim();
  deleteSavedBtn.style.display = u && isSaved(u) ? 'inline-block' : 'none';
}

// تعبئة الحقول إذا كان المستخدم المدخل محفوظاً (بدون دخول تلقائي)
function fillSavedIfExists(username) {
  try {
    const list = loadSavedAccounts();
    const acc = list.find(x => x.username === username);
    if (!acc) return;
    usernameInput.value = acc.username;
    passwordInput.value = acc.password || '';
    rememberCheck.checked = true;
  } catch (_) { }
}
if (savedUsersList && usernameInput) {
  usernameInput.addEventListener('change', () => {
    fillSavedIfExists(usernameInput.value.trim());
    updateDeleteBtn();
  });
  usernameInput.addEventListener('input', () => {
    updateDeleteBtn();
  });
}

if (deleteSavedBtn) {
  deleteSavedBtn.addEventListener('click', () => {
    const u = usernameInput.value.trim();
    if (!u) return;
    removeAccount(u);
    // امسح كلمة المرور إن كانت معبأة من الحساب المحذوف
    if (passwordInput.value && !isSaved(u)) {
      passwordInput.value = '';
    }
    renderSavedAccounts();
    updateDeleteBtn();
  });
}

// Load support end date and render professional badge
(async () => {
  try {
    const r = await window.api.settings_get();
    const st = r && r.ok ? (r.item || {}) : {};

    // عرض/إخفاء نص النسخة التجريبية بناءً على قاعدة البيانات
    const trialNotice = document.getElementById('trialNotice');
    if (trialNotice) {
      // إذا كان show_trial_notice = 1 في الإعدادات، يظهر النص
      if (st.show_trial_notice == 1) {
        trialNotice.classList.add('show');
      } else {
        trialNotice.classList.remove('show');
      }
    }

    // عرض اسم الفرع إن وُجد
    const branchDisplay = document.getElementById('branchDisplay');
    if (branchDisplay && st.branch_name) {
      branchDisplay.textContent = st.branch_name;
      branchDisplay.classList.add('show');
    }

    // Render support info if date present
    const wrap = document.getElementById('supportInfo');
    const dateEl = document.getElementById('supportEndDate');
    const badgeEl = document.getElementById('supportDaysLeft');
    if (st.support_end_date && wrap && dateEl && badgeEl) {
      // show and animate bar using flex for stable alignment
      wrap.style.display = 'flex';
      wrap.style.alignItems = 'center';
      wrap.style.justifyContent = 'space-between';
      requestAnimationFrame(() => wrap.classList.add('show'));
      // Format as YYYY-MM-DD (numbers only) with robust parsing
      try {
        const raw = String(st.support_end_date || '').trim();
        let ymd = null;
        const m = raw.match(/^(\d{4})[-\/.](\d{2})[-\/.](\d{2})$/);
        if (m) { ymd = `${m[1]}-${m[2]}-${m[3]}`; }
        dateEl.textContent = ymd || raw;
      } catch (_) { dateEl.textContent = String(st.support_end_date || ''); }
      // Days diff (use parsed parts if available)
      try {
        const raw = String(st.support_end_date || '').trim();
        const mm = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        const end = mm ? new Date(Number(mm[1]), Number(mm[2]) - 1, Number(mm[3])) : new Date(raw + 'T00:00:00');
        const today = new Date();
        const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const diffDays = Math.ceil((end - base) / (1000 * 60 * 60 * 24));
        if (!isNaN(diffDays)) {
          // reset status classes for animation
          badgeEl.classList.remove('status-ok', 'status-warn', 'status-expired');
          if (diffDays > 30) {
            badgeEl.textContent = `متبقي ${diffDays} يومًا`;
            badgeEl.style.background = '#e0f2fe'; badgeEl.style.color = '#075985'; badgeEl.style.border = '1px solid #bae6fd';
            badgeEl.classList.add('status-ok');
          } else if (diffDays >= 0) {
            badgeEl.textContent = `متبقي ${diffDays} يومًا`;
            badgeEl.style.background = '#fef9c3'; badgeEl.style.color = '#854d0e'; badgeEl.style.border = '1px solid #fde68a';
            badgeEl.classList.add('status-warn');
          } else {
            badgeEl.textContent = 'انتهت فترة الدعم';
            badgeEl.style.background = '#fee2e2'; badgeEl.style.color = '#991b1b'; badgeEl.style.border = '1px solid #fecaca';
            badgeEl.classList.add('status-expired');
          }
        }
      } catch (_) { /* ignore */ }
    }

  } catch (_) { }
})();

// دالة مقارنة الإصدارات (semantic versioning)
function compareVersions(v1, v2) {
  const v1Parts = String(v1).split('.').map(Number);
  const v2Parts = String(v2).split('.').map(Number);
  
  for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
    const v1Part = v1Parts[i] || 0;
    const v2Part = v2Parts[i] || 0;
    
    if (v1Part > v2Part) return 1;
    if (v1Part < v2Part) return -1;
  }
  
  return 0;
}

// Toggle password visibility
let visible = false;
function updateEye() { toggleEye.textContent = visible ? '🙈' : '👁️'; }
updateEye();

toggleEye.addEventListener('click', () => {
  visible = !visible;
  passwordInput.type = visible ? 'text' : 'password';
  updateEye();
});

async function doLogin() {
  errorDiv.textContent = '';
  loginBtn.disabled = true;
  try {
    const username = usernameInput.value.trim();
    const password = passwordInput.value;
    if (!username || !password) { errorDiv.textContent = 'يرجى إدخال اسم المستخدم وكلمة المرور'; return; }

    const res = await window.api.login(username, password);
    if (!res.ok) {
      errorDiv.textContent = res.error || 'حدث خطأ';
      return;
    }

    // Remember Me (اخزن اكتر من مستخدم)
    if (rememberCheck.checked) {
      // ملاحظة: التخزين محلي على الجهاز بصيغة نصية، ولبيئات إنتاجية يُنصح بالتشفير/نظام مفاتيح
      upsertAccount(username, password);
    }

    // Save logged-in user for later (waiter name in kitchen tickets)
    try { localStorage.setItem('pos_user', JSON.stringify(res.user || {})); } catch (_) { }

    // Fetch and store user permissions for UI control, then redirect accordingly
    let userPerms = [];
    try {
      const permsRes = await window.api.perms_get_for_user(res.user.id);
      if (permsRes && permsRes.ok) { userPerms = permsRes.keys || []; localStorage.setItem('pos_perms', JSON.stringify(userPerms)); }
    } catch (_) { /* ignore */ }

    // Check shifts setting; bypass shift screens when disabled
    try {
      const settingsRes = await window.api.settings_get();
      const st = settingsRes && settingsRes.ok ? (settingsRes.item || {}) : {};
      if (st.show_shifts === 0 || st.show_shifts === false) {
        window.location.href = '../sales/index.html';
        return;
      }
    } catch (_) { }

    // Check if user has an open shift
    try {
      const shiftRes = await window.api.shift_get_current(res.user.id);
      if (shiftRes && shiftRes.ok && shiftRes.shift) {
        localStorage.setItem('current_shift', JSON.stringify(shiftRes.shift));
        window.location.href = '../sales/index.html';
      } else {
        window.location.href = '../shift-open/index.html';
      }
    } catch (err) {
      console.error('Shift check error:', err);
      window.location.href = '../shift-open/index.html';
    }
  } catch (e) {
    console.error(e);
    errorDiv.textContent = 'تعذر الاتصال بالتطبيق';
  } finally {
    loginBtn.disabled = false;
  }
}

loginBtn.addEventListener('click', doLogin);

// Submit on Enter
[usernameInput, passwordInput].forEach(el => el.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') loginBtn.click();
}));

// التحقق من التحديثات عند تحميل الصفحة
(async function checkForUpdatesOnLoad() {
  try {
    // انتظر قليلاً قبل التحقق من التحديثات لتحسين تجربة المستخدم
    await new Promise(resolve => setTimeout(resolve, 2000));

    const result = await window.api.invoke('check-for-updates');

    // معالجة النتيجة مباشرة إذا كانت موجودة - عرض إشعار فقط عند وجود تحديث
    if (result && result.success && result.result) {
      const updateResult = result.result;
      
      // التحقق من وجود تحديث متاح والتأكد أنه إصدار أعلى
      if (updateResult.updateInfo && updateResult.updateInfo.version) {
        const currentVersion = await window.api.invoke('get-app-version');
        const newVersion = updateResult.updateInfo.version;
        
        // مقارنة الإصدارات
        if (compareVersions(currentVersion, newVersion) < 0) {
          console.log('Login: Update available -', newVersion, '(current:', currentVersion + ')');
          showUpdateAvailableNotification(updateResult.updateInfo);
        } else {
          console.log('Login: No update available - running latest version', currentVersion);
        }
      } else {
        console.log('Login: No update available - running latest version');
      }
    }
  } catch (error) {
    console.error('Error checking for updates:', error);
  }
})();

// الاستماع لأحداث التحديث من main process
window.api?.on?.('update-status', (payload) => {
  // التحقق من وجود البيانات قبل معالجتها
  if (!payload || typeof payload !== 'object' || !payload.status) {
    return;
  }
  
  const { status, data: statusData } = payload;

  if (status === 'update-available') {
    // إظهار إشعار التحديث فقط عندما يكون هناك تحديث متاح
    console.log('Update available:', statusData?.version);
    showUpdateAvailableNotification(statusData);
  } else if (status === 'update-not-available') {
    // لا يوجد تحديث - لا نفعل شيء
    console.log('Login: No update available - current version is latest');
  }
});

// دالة لإظهار إشعار التحديث المتوفر
function showUpdateAvailableNotification(updateInfo) {
  const updateNotification = document.getElementById('updateNotification');
  if (!updateNotification) return;

  const version = updateInfo?.version || 'جديد';
  
  console.log('Showing update notification for version:', version);

  // تعيين محتوى الإشعار
  updateNotification.querySelector('.icon').textContent = '🎉';
  updateNotification.querySelector('#updateTitle').textContent = 'يتوفر تحديث جديد!';
  updateNotification.querySelector('#updateMessage').textContent = `الإصدار ${version} متاح الآن. توجه إلى الإعدادات للتحديث`;
  updateNotification.classList.remove('expired');
  
  // إظهار الإشعار
  updateNotification.style.display = 'flex';
  requestAnimationFrame(() => {
    updateNotification.classList.add('show');
  });
  
  // إخفاء الإشعار بعد 6 ثوان
  setTimeout(() => {
    updateNotification.classList.remove('show');
    // إخفاء نهائياً بعد انتهاء الـ transition
    setTimeout(() => {
      updateNotification.style.display = 'none';
    }, 500);
  }, 6000);
}


