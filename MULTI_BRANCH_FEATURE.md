# ميزة تعدد الفروع (Multi-Branch) — دليل التطبيق الشامل

دليل كامل لإعادة بناء ميزة "تعدد الفروع مع جهاز رئيسي/فرعي" في برنامج آخر بنفس التصميم والاستايل.

---

## 1. نظرة عامة على الميزة

البرنامج يدعم وضعين للجهاز:

- **Primary (جهاز رئيسي)**: يحتوي على قاعدة بيانات MySQL محلية + يشغل API server (افتراضياً المنفذ `4310`).
- **Secondary (جهاز فرعي)**: لا يحتوي على قاعدة بيانات محلية، بل يتصل عبر الشبكة بقاعدة بيانات MySQL على الجهاز الرئيسي + يستخدم الـ API الخاص به.

عند إعداد **أكثر من فرع** في الجهاز الفرعي، يظهر للمستخدم **شاشة اختيار الفرع** عند بدء تشغيل البرنامج، فيختار الفرع الذي يريد الاتصال به ثم ينتقل إلى صفحة تسجيل الدخول.

تخزن قائمة الفروع محلياً في ملف JSON داخل `userData`، ويتم تخزين وضع الجهاز (Primary/Secondary) وعنوان الـ API في ملف JSON آخر.

---

## 2. تدفق التشغيل (Boot Flow)

عند تشغيل البرنامج (`createMainWindow` في `src/main/main.js`):

```
START
  │
  ▼
هل ملف branches.json موجود وفيه فروع نشطة (is_active != 0)؟
  ├─ نعم ──► افتح صفحة branch-selection/index.html
  │
  └─ لا ──► هل host = localhost / 127.0.0.1 ؟
              ├─ نعم ──► اختبر اتصال DB المحلي
              │            ├─ نجح + branches في DB > 1 ──► branch-selection
              │            ├─ نجح + license OK ──────────► login
              │            ├─ نجح + license مفقود ──────► activation
              │            └─ فشل ─────────────────────► activation
              │
              └─ لا (Remote) ──► login مباشرة
```

### كود اختيار صفحة البدء (`src/main/main.js` ~ سطر 471):

```js
async function createMainWindow() {
  const activationPage      = path.join(__dirname, '../renderer/activation/index.html');
  const loginPage           = path.join(__dirname, '../renderer/login/index.html');
  const branchSelectionPage = path.join(__dirname, '../renderer/branch-selection/index.html');

  const startPagePromise = (async () => {
    let startPage = loginPage;
    try {
      // 1) إن وُجد ملف branches.json بفروع نشطة => شاشة اختيار الفرع
      try {
        const branchesFile = path.join(app.getPath('userData'), 'branches.json');
        if (fs.existsSync(branchesFile)) {
          const raw = fs.readFileSync(branchesFile, 'utf-8') || '[]';
          const branchesData = JSON.parse(raw);
          const activeBranches = Array.isArray(branchesData)
            ? branchesData.filter(b => b.is_active !== 0) : [];
          if (activeBranches.length > 0) return branchSelectionPage;
        }
      } catch (_) {}

      // 2) فحص الاتصال بقاعدة البيانات المحلية
      const cfg = getConfig();
      const isLocalhost = !cfg.host || cfg.host === '127.0.0.1' || cfg.host.toLowerCase() === 'localhost';
      if (isLocalhost) {
        // ... TCP probe على cfg.host:cfg.port (انظر النص الكامل أدناه)
        // إن نجح: تحقق إن كان عدد الفروع في جدول branches > 1
        //        أو من صلاحية الترخيص => اختر الصفحة المناسبة
      } else {
        startPage = loginPage;  // Remote DB - تخطّى التفعيل
      }
    } catch (_) {}
    return startPage;
  })();
  // ... ثم BrowserWindow.loadFile(await startPagePromise)
}
```

---

## 3. هيكل الملفات المطلوب إنشاؤها/تعديلها

```
src/
├── main/
│   ├── main.js              ← منطق اختيار صفحة البدء (boot flow)
│   ├── preload.js           ← exposing IPC bridges عبر contextBridge
│   ├── settings.js          ← IPC handlers للفروع + قراءة/كتابة branches.json
│   └── api-client.js        ← إدارة وضع الجهاز (device-config.json)
└── renderer/
    ├── activation/
    │   └── index.html       ← شاشة التفعيل + Modal إدارة الفروع
    └── branch-selection/
        └── index.html       ← شاشة اختيار الفرع
```

ملفات JSON تُنشأ تلقائياً في `app.getPath('userData')`:
- `branches.json` — قائمة الفروع
- `device-config.json` — وضع الجهاز Primary/Secondary + api_host + api_port
- `db-config.json` — إعدادات الاتصال بـ MySQL

---

## 4. شكل بيانات الفروع (Schema)

### `branches.json`
```json
[
  {
    "id": 1,
    "name": "الفرع الرئيسي",
    "host": "192.168.1.100",
    "port": 3306,
    "api_port": 4310,
    "is_active": 1,
    "created_at": "2025-04-01T10:00:00.000Z",
    "updated_at": "2025-04-01T10:00:00.000Z"
  }
]
```

### `device-config.json`
```json
{
  "mode": "secondary",
  "api_host": "192.168.1.100",
  "api_port": 4310
}
```

### `db-config.json`
```json
{
  "host": "192.168.1.100",
  "port": 3306,
  "user": "root",
  "password": "Db2@dm1n2022",
  "name": "pos1"
}
```

---

## 5. كود الـ Backend (Main Process)

### 5.1 `src/main/api-client.js` — إدارة وضع الجهاز

```js
const fs = require('fs');
const path = require('path');

const DEFAULT_MODE = 'primary';
const DEFAULT_API_HOST = '127.0.0.1';
const DEFAULT_API_PORT = 4310;

let CONFIG_PATH;
try {
  const { app } = require('electron');
  CONFIG_PATH = app ? path.join(app.getPath('userData'), 'device-config.json') : null;
} catch (_) { CONFIG_PATH = null; }
if (!CONFIG_PATH) {
  CONFIG_PATH = path.join(path.resolve(__dirname, '..', '..'), 'app', 'device-config.json');
}

let deviceConfig = { mode: DEFAULT_MODE, api_host: DEFAULT_API_HOST, api_port: DEFAULT_API_PORT };

function loadDeviceConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const saved = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
      deviceConfig = { ...deviceConfig, ...saved };
    }
  } catch (_) {}
}
function saveDeviceConfig() {
  try {
    fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(deviceConfig, null, 2), 'utf-8');
  } catch (_) {}
}
loadDeviceConfig();

function getDeviceMode() { return deviceConfig.mode || DEFAULT_MODE; }
function setDeviceMode(mode, api_host, api_port) {
  deviceConfig.mode = mode || DEFAULT_MODE;
  if (api_host) deviceConfig.api_host = api_host;
  if (api_port) deviceConfig.api_port = api_port;
  saveDeviceConfig();
  return deviceConfig;
}
function isPrimaryDevice()   { return getDeviceMode() === 'primary'; }
function isSecondaryDevice() { return getDeviceMode() === 'secondary'; }

module.exports = {
  getDeviceMode, setDeviceMode,
  isPrimaryDevice, isSecondaryDevice,
  getDeviceConfig: () => deviceConfig,
};
```

### 5.2 `src/main/settings.js` — قراءة/كتابة branches.json + IPC

```js
const fs = require('fs');
const path = require('path');
const { ipcMain, app } = require('electron');

const BRANCHES_PATH = path.join(app.getPath('userData'), 'branches.json');

function safeReadJSON(p)  { try { return JSON.parse(fs.readFileSync(p, 'utf-8')); } catch (_) { return null; } }
function safeWriteJSON(p, obj) {
  try {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify(obj, null, 2), 'utf-8');
  } catch (_) {}
}
function readBranches()  { const d = safeReadJSON(BRANCHES_PATH); return Array.isArray(d) ? d : []; }
function writeBranches(b){ safeWriteJSON(BRANCHES_PATH, Array.isArray(b) ? b : []); }

function registerBranchesIPC() {
  // GET — استرجاع قائمة الفروع النشطة فقط
  ipcMain.handle('branches:get', async () => {
    try {
      const rows = readBranches();
      const active = rows
        .filter(r => r.is_active !== 0)
        .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'ar'));
      return { ok: true, branches: active };
    } catch (e) { return { ok: false, error: String(e && e.message || e) }; }
  });

  // SAVE — إضافة فرع جديد أو تعديل قائم
  ipcMain.handle('branches:save', async (_e, payload) => {
    try {
      const { id, name, host, port, api_port } = payload || {};
      if (!name || !host) return { ok: false, error: 'اسم الفرع وعنوان IP مطلوبان' };

      let branches = readBranches();
      const now = new Date().toISOString();
      if (id) {
        const idx = branches.findIndex(b => b.id === id);
        if (idx >= 0) {
          branches[idx] = { ...branches[idx], name, host, port: port || 3306, api_port: api_port || 4310, is_active: 1, updated_at: now };
        } else {
          branches.push({ id, name, host, port: port || 3306, api_port: api_port || 4310, is_active: 1, created_at: now, updated_at: now });
        }
      } else {
        const maxId = branches.reduce((m, b) => Math.max(m, Number(b.id) || 0), 0);
        branches.push({ id: maxId + 1, name, host, port: port || 3306, api_port: api_port || 4310, is_active: 1, created_at: now, updated_at: now });
      }
      writeBranches(branches);
      return { ok: true };
    } catch (e) { return { ok: false, error: String(e && e.message || e) }; }
  });

  // DELETE — حذف ناعم (is_active = 0)
  ipcMain.handle('branches:delete', async (_e, payload) => {
    try {
      const { id } = payload || {};
      let branches = readBranches();
      const idx = branches.findIndex(b => b.id === id || b.id === Number(id));
      if (idx >= 0) {
        branches[idx].is_active = 0;
        branches[idx].updated_at = new Date().toISOString();
        writeBranches(branches);
      }
      return { ok: true };
    } catch (e) { return { ok: false, error: String(e && e.message || e) }; }
  });

  // TEST — اختبار الاتصال بقاعدة بيانات الفرع
  ipcMain.handle('branches:test_connection', async (_e, payload) => {
    try {
      const { host, port } = payload || {};
      const mysql = require('mysql2/promise');
      const conn = await mysql.createConnection({
        host, port: port || 3306,
        user: 'root', password: 'Db2@dm1n2022',
        connectTimeout: 5000,
      });
      await conn.end();
      return { ok: true };
    } catch (e) { return { ok: false, error: String(e && e.message || e) }; }
  });

  // Device Mode IPC
  const { getDeviceMode, setDeviceMode, getDeviceConfig } = require('./api-client');
  ipcMain.handle('device:get_mode', async () => {
    try { return { ok: true, mode: getDeviceMode(), config: getDeviceConfig() }; }
    catch (e) { return { ok: false, error: String(e && e.message || e) }; }
  });
  ipcMain.handle('device:set_mode', async (_e, payload) => {
    try {
      const { mode, api_host, api_port } = payload || {};
      const config = setDeviceMode(mode, api_host, api_port);
      return { ok: true, config };
    } catch (e) { return { ok: false, error: String(e && e.message || e) }; }
  });
}

module.exports = { registerBranchesIPC };
```

### 5.3 `src/main/preload.js` — تعريض IPC للواجهة

```js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Branches
  branches_get:             ()        => ipcRenderer.invoke('branches:get'),
  branches_save:            (payload) => ipcRenderer.invoke('branches:save', payload),
  branches_delete:          (payload) => ipcRenderer.invoke('branches:delete', payload),
  branches_test_connection: (payload) => ipcRenderer.invoke('branches:test_connection', payload),

  // DB config
  db_get_config: ()    => ipcRenderer.invoke('db:get_config'),
  db_test:       (cfg) => ipcRenderer.invoke('db:test', cfg),
  db_apply:      (cfg) => ipcRenderer.invoke('db:apply', cfg),

  // Device mode
  device_get_mode: ()        => ipcRenderer.invoke('device:get_mode'),
  device_set_mode: (payload) => ipcRenderer.invoke('device:set_mode', payload),

  // Window control
  window_set_size: (opts) => ipcRenderer.invoke('window:set_size', opts),

  // App control
  app_quit:    () => ipcRenderer.invoke('app:quit'),
  app_restart: () => ipcRenderer.invoke('app:restart'),
});
```

### 5.4 IPC مساعدة لقاعدة البيانات (في `main.js`)

```js
const { updateConfig, getConfig, testConnection } = require('../db/connection');

ipcMain.handle('db:get_config', async () => {
  try { return { ok: true, config: getConfig() }; }
  catch (e) { return { ok: false, error: String(e && e.message || e) }; }
});
ipcMain.handle('db:test', async (_e, cfg) => {
  try { await testConnection(cfg || {}); return { ok: true }; }
  catch (e) { return { ok: false, error: String(e && e.message || e) }; }
});
ipcMain.handle('db:apply', async (_e, cfg) => {
  try { const applied = await updateConfig(cfg || {}); return { ok: true, config: applied }; }
  catch (e) { return { ok: false, error: String(e && e.message || e) }; }
});

// Window resize
ipcMain.handle('window:set_size', (event, opts) => {
  const { BrowserWindow } = require('electron');
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win || !opts) return;
  const { width, height, resizable, center } = opts;
  if (typeof resizable === 'boolean') win.setResizable(resizable);
  if (width && height) win.setSize(width, height);
  if (center !== false) win.center();
});

// App quit/restart
ipcMain.handle('app:quit',    () => app.quit());
ipcMain.handle('app:restart', () => { app.relaunch(); app.exit(0); });
```

---

## 6. شاشة اختيار الفرع (Frontend)

**الموقع:** `src/renderer/branch-selection/index.html`

### الخصائص الرئيسية:
- نافذة بحجم **460×560** (غير قابلة للتغيير).
- خط **Cairo** بثلاثة أوزان (Regular / Bold / Black).
- خلفية `#f8fafc` مع شعار `POS` بتدرج أزرق.
- قائمة الفروع قابلة للتمرير (max-height: 200px).
- زر "الاتصال بالفرع المحدد" + زر "العودة للتفعيل".
- نظام Toast notifications (success / error).
- اللغة عربية / RTL.

### استايل الـ Branch Item (الأهم بصرياً):
```css
.branch-item {
  display: flex; align-items: center; gap: 12px;
  padding: 12px 14px;
  border: 1.5px solid #e2e8f0;
  border-radius: 10px;
  cursor: pointer; background: #fff;
  transition: border-color .15s, box-shadow .15s, background .15s !important;
}
.branch-item:hover { border-color: #3b82f6; box-shadow: 0 2px 8px rgba(59,130,246,.12); }
.branch-item.selected {
  border-color: #2563eb; background: #eff6ff;
  box-shadow: 0 0 0 3px rgba(37,99,235,.15);
}
.branch-icon {
  width: 38px; height: 38px; border-radius: 9px;
  background: linear-gradient(135deg, #2563eb, #60a5fa);
  display: flex; align-items: center; justify-content: center;
  font-size: 17px; flex-shrink: 0;
}
.btn-connect {
  background: linear-gradient(135deg, #2563eb, #3b82f6);
  color: #fff; border: none; border-radius: 10px;
  padding: 11px 0; width: 100%;
  font-family: inherit; font-size: 14px; font-weight: 700;
  cursor: pointer;
  transition: opacity .15s, transform .15s !important;
}
.btn-connect:hover:not(:disabled) { opacity: .92; transform: translateY(-1px); }
.btn-connect:disabled { opacity: .45; cursor: not-allowed; }
.logo-box {
  width: 52px; height: 52px; border-radius: 14px;
  background: linear-gradient(135deg, #1d4ed8, #3b82f6);
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-weight: 900; font-size: 15px;
  letter-spacing: .5px;
  box-shadow: 0 4px 14px rgba(37,99,235,.35);
  margin: 0 auto 14px;
}
```

### بنية HTML (مختصرة):
```html
<body>
  <div id="toastContainer" class="toast-container"></div>

  <div style="padding:28px 28px 22px; display:flex; flex-direction:column; height:100%;">
    <div class="logo-box">POS</div>

    <div style="text-align:center; margin-bottom:20px;">
      <h1 style="font-size:20px; font-weight:900; color:#0f172a; margin-bottom:4px;">اختيار الفرع</h1>
      <p style="font-size:12.5px; color:#64748b;">اختر الفرع الذي تريد الاتصال به</p>
    </div>

    <div id="branchesScroll" style="flex:1; display:flex; flex-direction:column; gap:8px; margin-bottom:18px;"></div>

    <div style="display:flex; flex-direction:column; gap:8px; margin-bottom:14px;">
      <button id="selectBtn" class="btn-connect" disabled>الاتصال بالفرع المحدد</button>
      <button id="backBtn" class="btn-back">العودة للتفعيل</button>
    </div>

    <div style="background:#f0f9ff; border:1px solid #bae6fd; border-radius:9px; padding:9px 13px; text-align:center;">
      <p style="font-size:11.5px; color:#0369a1; font-weight:600;">ℹ️ سيتم حفظ اختيارك حتى يتم تغييره يدوياً</p>
    </div>
  </div>
</body>
```

### منطق JavaScript:
```js
(async function () {
  let branches = [];
  let selectedBranchId = null;

  const branchesScroll = document.getElementById('branchesScroll');
  const selectBtn      = document.getElementById('selectBtn');
  const backBtn        = document.getElementById('backBtn');

  try { await window.api.window_set_size({ width: 460, height: 560 }); } catch (_) {}

  function renderBranches() {
    branchesScroll.innerHTML = '';
    if (branches.length === 0) {
      branchesScroll.innerHTML = '<p style="color:#94a3b8;text-align:center;padding:20px 0;font-size:13px;">لا توجد فروع متاحة</p>';
      selectBtn.disabled = true; return;
    }
    branches.forEach(branch => {
      const el = document.createElement('div');
      el.className = `branch-item${selectedBranchId === branch.id ? ' selected' : ''}`;
      el.innerHTML = `
        <div class="branch-icon">🏢</div>
        <div style="flex:1; min-width:0;">
          <div style="font-size:13.5px; font-weight:700; color:#1e293b;">${branch.name}</div>
          <div style="font-size:11.5px; color:#64748b; margin-top:2px;">${branch.host}:${branch.port} · API: ${branch.api_port}</div>
        </div>
        ${selectedBranchId === branch.id ? '<div style="color:#2563eb;font-size:18px;">✓</div>' : ''}
      `;
      el.addEventListener('click', () => {
        selectedBranchId = branch.id;
        renderBranches();
        selectBtn.disabled = false;
      });
      branchesScroll.appendChild(el);
    });
  }

  async function loadBranches() {
    const result = await window.api.branches_get();
    if (result && result.ok) {
      branches = result.branches || [];

      // Pre-select الفرع المحفوظ سابقاً (إن وُجد)
      try {
        const modeRes = await window.api.device_get_mode();
        if (modeRes && modeRes.ok && modeRes.config && modeRes.config.mode === 'secondary') {
          const match = branches.find(b =>
            String(b.host) === String(modeRes.config.api_host) &&
            Number(b.api_port) === Number(modeRes.config.api_port));
          if (match) { selectedBranchId = match.id; selectBtn.disabled = false; }
        }
      } catch (_) {}
      renderBranches();
    }
  }

  selectBtn.addEventListener('click', async () => {
    if (!selectedBranchId) return;
    const branch = branches.find(b => b.id === selectedBranchId);
    if (!branch) return;

    selectBtn.textContent = 'جاري الاتصال...';
    selectBtn.disabled = true;
    try {
      // 1) حفظ إعدادات DB
      const a = await window.api.db_apply({ host: branch.host, port: branch.port });
      if (!a || !a.ok) throw new Error(a.error || 'فشل حفظ إعدادات قاعدة البيانات');

      // 2) ضبط وضع الجهاز كـ Secondary
      const m = await window.api.device_set_mode({
        mode: 'secondary', api_host: branch.host, api_port: branch.api_port
      });
      if (!m || !m.ok) throw new Error(m.error || 'فشل حفظ إعدادات الجهاز');

      // 3) إعادة تكبير النافذة + الانتقال إلى تسجيل الدخول
      setTimeout(async () => {
        try { await window.api.window_set_size({ width: 1200, height: 760, resizable: true, center: false }); } catch (_) {}
        window.location.href = '../login/index.html';
      }, 1800);
    } catch (err) {
      selectBtn.textContent = 'الاتصال بالفرع المحدد';
      selectBtn.disabled = false;
    }
  });

  backBtn.addEventListener('click', () => {
    window.location.href = '../activation/index.html?from=branch-selection';
  });

  await loadBranches();
})();
```

---

## 7. شاشة التفعيل + Modal إدارة الفروع

**الموقع:** `src/renderer/activation/index.html`

تتألف من:
- **MainView**: شعار + قسم تفعيل (input كود + زر تفعيل) + زر "إعداد الاتصال بالجهاز الرئيسي" + زر خروج.
- **Modal**: إدارة قائمة الفروع (إضافة / تعديل / حذف / اختبار جميع الاتصالات / حفظ).

### استايل المفاتيح:
```css
html, body { font-family: "Cairo", system-ui, sans-serif; background: #f1f5f9; height: 100%; overflow: hidden; }

.logo-box {
  width: 56px; height: 56px; border-radius: 15px;
  background: linear-gradient(135deg, #1d4ed8, #3b82f6);
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-weight: 900; font-size: 15px;
  box-shadow: 0 6px 18px rgba(29,78,216,.32);
  margin-bottom: 14px;
}
.field-input {
  width: 100%; padding: 10px 14px;
  border: 1.5px solid #e2e8f0; border-radius: 9px;
  font-family: inherit; font-size: 14px; color: #1e293b;
  background: #fff; outline: none;
  transition: border-color .15s, box-shadow .15s !important;
}
.field-input:focus { border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59,130,246,.12); }
.btn-primary {
  width: 100%; padding: 11px 0;
  background: linear-gradient(135deg, #1d4ed8, #3b82f6);
  color: #fff; border: none; border-radius: 10px;
  font-family: inherit; font-size: 14px; font-weight: 700;
  cursor: pointer;
  transition: opacity .15s, transform .15s !important;
}
.btn-outline-blue {
  width: 100%; padding: 10px 0;
  background: #fff; color: #2563eb;
  border: 1.5px solid #bfdbfe; border-radius: 10px;
  font-size: 13px; font-weight: 700; cursor: pointer;
}
.modal-overlay { position: fixed; inset: 0; z-index: 1000; background: rgba(15,23,42,.45); display: none; align-items: center; justify-content: center; padding: 20px; }
.modal-overlay.open { display: flex; }
.modal-box { background:#fff; border-radius:14px; box-shadow:0 20px 60px rgba(0,0,0,.18); width:100%; max-width:600px; max-height:80vh; display:flex; flex-direction:column; overflow:hidden; }
.modal-header { display:flex; align-items:center; justify-content:space-between; padding:16px 20px; border-bottom:1px solid #e2e8f0; background:#f8fafc; }
.modal-body   { flex:1; overflow-y:auto; padding:20px; display:flex; flex-direction:column; gap:16px; }
.modal-footer { display:flex; gap:10px; padding:14px 20px; border-top:1px solid #e2e8f0; background:#f8fafc; }

.branch-row { display:flex; align-items:center; justify-content:space-between; padding:11px 14px; background:#f8fafc; border:1.5px solid #e2e8f0; border-radius:10px; }
.btn-add-branch { display:flex; align-items:center; gap:6px; padding:7px 14px; border-radius:8px; background:#10b981; color:#fff; border:none; font-size:12px; font-weight:700; cursor:pointer; }
.btn-edit   { padding:5px 12px; border-radius:7px; background:#eff6ff; color:#2563eb; border:1px solid #bfdbfe; font-size:11.5px; font-weight:700; cursor:pointer; }
.btn-delete { padding:5px 12px; border-radius:7px; background:#fef2f2; color:#dc2626; border:1px solid #fecaca; font-size:11.5px; font-weight:700; cursor:pointer; }
#branchForm { background:#f8fafc; border:1.5px solid #e2e8f0; border-radius:11px; padding:16px; display:none; flex-direction:column; gap:12px; }
#branchForm.visible { display:flex; }
.form-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
.notice-box { background:#fffbeb; border:1px solid #fde68a; border-radius:9px; padding:12px 14px; font-size:11.5px; color:#78350f; line-height:1.7; }
.btn-test     { flex:1; padding:10px 0; background:#10b981; color:#fff; border:none; border-radius:9px; font-size:13px; font-weight:700; cursor:pointer; }
.btn-save-all { flex:1; padding:10px 0; background:linear-gradient(135deg,#1d4ed8,#3b82f6); color:#fff; border:none; border-radius:9px; font-size:13px; font-weight:700; cursor:pointer; }
```

### Modal HTML:
```html
<div id="connModal" class="modal-overlay">
  <div class="modal-box">
    <div class="modal-header">
      <span class="modal-title">⚙️ إعدادات المزامنة مع الجهاز الرئيسي</span>
      <button id="connClose" class="btn-modal-close">✕ إغلاق</button>
    </div>

    <div class="modal-body">
      <div>
        <div class="section-head">
          <span class="section-label">الفروع المضافة</span>
          <button id="addBranchBtn" class="btn-add-branch">
            <span style="font-size:15px;">+</span> إضافة فرع جديد
          </button>
        </div>
        <div id="branchesContainer" style="display:flex; flex-direction:column; gap:8px;"></div>
      </div>

      <div id="branchForm">
        <div class="form-title">إضافة / تعديل فرع</div>
        <input type="hidden" id="branchId" />
        <div class="form-grid">
          <div><label class="field-label">اسم الفرع</label>
               <input id="branchName" placeholder="مثال: الفرع الرئيسي" class="field-input" /></div>
          <div><label class="field-label">عنوان IP للجهاز الرئيسي</label>
               <input id="branchHost" placeholder="192.168.1.100" class="field-input" /></div>
          <div><label class="field-label">منفذ قاعدة البيانات</label>
               <input id="branchPort" type="number" value="3306" class="field-input" /></div>
          <div><label class="field-label">منفذ API</label>
               <input id="branchApiPort" type="number" value="4310" class="field-input" /></div>
        </div>
        <div style="display:flex; gap:8px;">
          <button id="saveBranchBtn" class="btn-save-branch">💾 حفظ الفرع</button>
          <button id="cancelBranchBtn" class="btn-cancel-branch">إلغاء</button>
        </div>
      </div>

      <div class="notice-box">
        <div class="notice-title">⚠️ ملاحظة هامة:</div>
        <ul style="padding-right:16px; list-style:disc;">
          <li>يمكنك إضافة عدة فروع للاتصال بها</li>
          <li>عند حفظ الفروع، سيظهر شاشة اختيار الفرع عند بدء التشغيل</li>
          <li>الجهاز الفرعي <strong>لا يحتاج</strong> إلى كود تفعيل</li>
          <li>يجب <strong>إعادة تشغيل البرنامج</strong> بعد الحفظ لتفعيل التغييرات</li>
        </ul>
      </div>
      <div id="connMsg"></div>
    </div>

    <div class="modal-footer">
      <button id="testAllBtn" class="btn-test">اختبار جميع الاتصالات</button>
      <button id="saveAllBtn" class="btn-save-all">💾 حفظ الإعدادات</button>
    </div>
  </div>
</div>
```

### منطق JS الأساسي للـ Modal:
```js
let branches = [];

function loadBranches() {
  window.api.branches_get().then(result => {
    if (result && result.ok) { branches = result.branches || []; renderBranches(); }
  });
}

function renderBranches() {
  const container = document.getElementById('branchesContainer');
  container.innerHTML = '';
  if (branches.length === 0) {
    container.innerHTML = '<p style="color:#94a3b8;text-align:center;padding:16px 0;font-size:13px;">لا توجد فروع مضافة</p>';
    return;
  }
  branches.forEach(branch => {
    const el = document.createElement('div');
    el.className = 'branch-row';
    el.innerHTML = `
      <div>
        <div class="branch-row-name">${branch.name}</div>
        <div class="branch-row-info">${branch.host}:${branch.port} · API: ${branch.api_port}</div>
      </div>
      <div class="branch-row-actions">
        <button class="btn-edit"   data-id="${branch.id}">تعديل</button>
        <button class="btn-delete" data-id="${branch.id}">حذف</button>
      </div>`;
    container.appendChild(el);
  });
  // ربط أحداث التعديل/الحذف...
}

document.getElementById('saveBranchBtn').addEventListener('click', async () => {
  const id      = document.getElementById('branchId').value;
  const name    = document.getElementById('branchName').value.trim();
  const host    = document.getElementById('branchHost').value.trim();
  const port    = parseInt(document.getElementById('branchPort').value)    || 3306;
  const apiPort = parseInt(document.getElementById('branchApiPort').value) || 4310;
  if (!name || !host) return;
  const result = await window.api.branches_save({
    id: id ? parseInt(id) : null, name, host, port, api_port: apiPort
  });
  if (result && result.ok) { loadBranches(); /* hideForm(); */ }
});

document.getElementById('testAllBtn').addEventListener('click', async () => {
  for (const b of branches) {
    await window.api.branches_test_connection({ host: b.host, port: b.port });
  }
});

document.getElementById('saveAllBtn').addEventListener('click', () => {
  setTimeout(() => window.api.app_restart(), 2000);
});
```

### عند الدخول من شاشة اختيار الفرع (`?from=branch-selection`):
```js
const params = new URLSearchParams(window.location.search);
const fromBranchSelection = params.get('from') === 'branch-selection';
if (fromBranchSelection) {
  showActivation();
  setTimeout(() => openModal(), 120);  // افتح Modal الفروع تلقائياً
}
```

---

## 8. لوحة الألوان (Design Tokens)

| العنصر | اللون |
|---|---|
| الخلفية الرئيسية | `#f1f5f9` / `#f8fafc` |
| النص الأساسي | `#0f172a` / `#1e293b` |
| النص الثانوي | `#64748b` / `#475569` |
| النص الباهت | `#94a3b8` |
| الحدود | `#e2e8f0` |
| التدرج الأزرق الأساسي | `linear-gradient(135deg, #1d4ed8, #3b82f6)` |
| التدرج الأزرق الفاتح | `linear-gradient(135deg, #2563eb, #60a5fa)` |
| Hover أزرق | `#3b82f6` / `#2563eb` |
| التحديد (selected) | خلفية `#eff6ff` + حدود `#2563eb` + حلقة `rgba(37,99,235,.15)` |
| النجاح (success) | `#10b981` (Toast) / `#166534` على `#f0fdf4` |
| الخطأ (error) | `#ef4444` (Toast) / `#dc2626` على `#fef2f2` |
| التحذير (warning) | `#92400e` على `#fff7ed` / `#fffbeb` + حدود `#fde68a` |
| المعلومات (info) | `#0369a1` على `#f0f9ff` + حدود `#bae6fd` |

**الخط:** Cairo (Regular 400 / Bold 700 / Black 900) — ملفات TTF محلية في `assets/fonts/`.
**الاتجاه:** `dir="rtl"` و `lang="ar"`.
**Border Radius:** `7-15px` (الأزرار 9-10، الحقول 9، البطاقات 10-11، Modal 14).

---

## 9. خطوات التطبيق في برنامج آخر

1. **انسخ ملفات الفونت** من `assets/fonts/Cairo-*.ttf` إلى المشروع الجديد.
2. **أنشئ `src/main/api-client.js`** بمحتوى القسم 5.1 (إدارة device-config.json).
3. **أنشئ/عدّل `src/main/settings.js`** لإضافة دوال `readBranches`, `writeBranches`, و IPC handlers من القسم 5.2.
4. **أضف في `src/main/preload.js`** الـ bridges من القسم 5.3 ضمن `contextBridge.exposeInMainWorld('api', { ... })`.
5. **أضف في `src/main/main.js`**:
   - منطق اختيار صفحة البدء من القسم 2.
   - IPC handlers للـ DB config + window control + app control من القسم 5.4.
6. **أنشئ `src/renderer/branch-selection/index.html`** كاملاً (القسم 6).
7. **أنشئ/عدّل `src/renderer/activation/index.html`** ليتضمن Modal إدارة الفروع (القسم 7).
8. **تأكد** أن `src/db/connection.js` يدعم `getConfig()` / `updateConfig(partial)` / `testConnection(cfg)` ويحفظ في `userData/db-config.json`.
9. **اختبر السيناريو الكامل**:
   - افتح activation → افتح Modal → أضف فرعين → احفظ → أعد التشغيل.
   - يجب أن تظهر شاشة اختيار الفرع → اختر فرعاً → ينتقل للـ login.
   - أعد التشغيل → يفتح مباشرة على شاشة اختيار الفرع.
10. **للعودة لوضع Primary**: احذف يدوياً ملفي `branches.json` و `device-config.json` من `userData`، أو أضف زراً في الإعدادات يستدعي `window.api.device_set_mode({ mode: 'primary', api_host: '127.0.0.1', api_port: 4310 })`.

---

## 10. ملخص نقاط مهمة

- **التخزين**: ملفات JSON في `app.getPath('userData')` — لا يحتاج جداول DB لتعمل الميزة.
- **الحذف ناعم**: `is_active = 0` بدل الحذف الفعلي (يحفظ السجل).
- **اختبار الاتصال**: يستخدم `mysql2/promise` مع timeout 5 ثوانٍ.
- **حجم النوافذ**: 460×560 لاختيار الفرع، 460×520/600 للتفعيل، 720×680 لـ Modal الفروع، 1200×760 بعد الدخول.
- **التحقق من Pre-selection**: يقارن `device-config.json` (api_host + api_port) مع قائمة الفروع لتحديد الفرع المختار سابقاً.
- **بعد حفظ الفروع**: يجب `app.relaunch()` ليعيد قراءة الإعدادات.
- **الجهاز الفرعي**: لا يطلب كود تفعيل.
