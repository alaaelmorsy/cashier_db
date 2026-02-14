let currentUser = null;
let permissions = new Set();

function hasPermission(key) {
  return permissions.has('shifts') && permissions.has(key);
}

async function loadPermissions() {
  try {
    const user = JSON.parse(localStorage.getItem('pos_user') || 'null');
    if (user && user.id) {
      const result = await window.api.perms_get_for_user(user.id);
      if (result && result.ok) {
        permissions = new Set(result.keys || []);
      }
    }
  } catch (err) {
    console.error('Load permissions error:', err);
  }
}

async function ensureShiftsEnabled() {
  try {
    const r = await window.api.settings_get();
    const s = r && r.ok ? (r.item || {}) : {};
    if (s.show_shifts === 0 || s.show_shifts === false) {
      showError('نظام الشفتات غير مفعل');
      setTimeout(() => {
        window.location.href = '../main/index.html';
      }, 1500);
      return false;
    }
  } catch (_) {
  }
  return true;
}

async function init() {
  try {
    currentUser = JSON.parse(localStorage.getItem('pos_user') || 'null');
    if (!currentUser || !currentUser.id) {
      window.location.href = '../login/index.html';
      return;
    }
    
    const enabled = await ensureShiftsEnabled();
    if (!enabled) return;
    
    await loadPermissions();
    
    if (!hasPermission('shifts.open')) {
      showError('لا تملك صلاحية فتح شفت! سيتم نقلك إلى الشاشة الرئيسية...');
      setTimeout(() => {
        window.location.href = '../main/index.html';
      }, 2000);
      return;
    }
    
    document.getElementById('username').textContent = currentUser.full_name || currentUser.username;
    
    updateDateTime();
    setInterval(updateDateTime, 1000);
    
    const existing = await window.api.shift_get_current(currentUser.id);
    if (existing && existing.ok && existing.shift) {
      showError('لديك شيفت مفتوح بالفعل! سيتم نقلك إلى الشاشة الرئيسية...');
      setTimeout(() => {
        window.location.href = '../main/index.html';
      }, 2000);
      return;
    }
    
  } catch (err) {
    console.error('Init error:', err);
    showError('حدث خطأ أثناء التحميل');
  }
}

function updateDateTime() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  
  let hours24 = now.getHours();
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  
  const ampm = hours24 >= 12 ? 'م' : 'ص';
  let hours12 = hours24 % 12;
  if (hours12 === 0) hours12 = 12;
  const hoursStr = String(hours12).padStart(2, '0');
  
  const formatted = `${year}/${month}/${day} ${hoursStr}:${minutes}:${seconds} ${ampm}`;
  document.getElementById('datetime').textContent = formatted;
}

function showError(msg) {
  const errorDiv = document.getElementById('errorMsg');
  errorDiv.textContent = msg;
  errorDiv.classList.add('show');
  setTimeout(() => {
    errorDiv.classList.remove('show');
  }, 5000);
}

document.getElementById('openShiftForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const submitBtn = document.getElementById('submitBtn');
  const openingCash = parseFloat(document.getElementById('openingCash').value) || 0;
  const openingNotes = document.getElementById('openingNotes').value.trim();
  
  if (openingCash < 0) {
    showError('الرصيد الافتتاحي لا يمكن أن يكون سالباً');
    return;
  }
  
  submitBtn.disabled = true;
  submitBtn.textContent = 'جاري فتح الشيفت...';
  
  try {
    const result = await window.api.shift_open({
      userId: currentUser.id,
      username: currentUser.full_name || currentUser.username,
      openingCash,
      openingNotes: openingNotes || null
    });
    
    if (result && result.ok) {
      localStorage.setItem('current_shift', JSON.stringify(result.shift));
      
      submitBtn.textContent = '✅ تم فتح الشيفت بنجاح';
      submitBtn.style.background = '#4CAF50';
      
      setTimeout(() => {
        window.location.href = '../main/index.html';
      }, 1000);
    } else {
      showError(result.error || 'فشل فتح الشيفت');
      submitBtn.disabled = false;
      submitBtn.textContent = '✅ فتح الشيفت';
    }
  } catch (err) {
    console.error('Open shift error:', err);
    showError('حدث خطأ أثناء فتح الشيفت');
    submitBtn.disabled = false;
    submitBtn.textContent = '✅ فتح الشيفت';
  }
});

document.getElementById('cancelBtn').addEventListener('click', () => {
  const modal = document.getElementById('cancelModal');
  modal.classList.add('show');
});

document.getElementById('modalCancelBtn').addEventListener('click', () => {
  const modal = document.getElementById('cancelModal');
  modal.classList.remove('show');
});

document.getElementById('modalConfirmBtn').addEventListener('click', async () => {
  try {
    await window.api.auth_logout();
  } catch (err) {
    console.error('Logout error:', err);
  }
  window.location.href = '../login/index.html';
});

document.getElementById('openingCash').addEventListener('input', (e) => {
  const val = parseFloat(e.target.value);
  if (val < 0) {
    e.target.value = 0;
  }
});

init();
