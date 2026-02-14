# ملخص شامل لجزء إرسال الفاتورة عبر WhatsApp

## 📋 نظرة عامة

نظام إرسال الفواتير عبر WhatsApp مبني على مكتبة `@wppconnect-team/wppconnect` ويتكون من:
1. **Backend Service** (Node.js) - خدمة WhatsApp الرئيسية
2. **IPC Handlers** (Electron Main Process) - معالجات الاتصال
3. **WhatsApp Management UI** - شاشة إدارة WhatsApp
4. **Invoice Print Screen Integration** - التكامل مع شاشة الفاتورة

---

## 🏗️ البنية المعمارية

### 1. Backend Service (`src/main/whatsapp-service.js`)

**المكتبة المستخدمة:**
```javascript
const wppconnect = require('@wppconnect-team/wppconnect');
```

**الخصائص الرئيسية:**
```javascript
class WhatsAppService {
  constructor() {
    this.client = null;              // عميل wppconnect
    this.isConnected = false;        // حالة الاتصال
    this.qrCode = null;             // QR Code للربط
    this.sessionDir = path.join(app.getPath('userData'), 'whatsapp-tokens'); // مسار حفظ الجلسة
  }
}
```

**الوظائف الأساسية:**

#### 1.1 التهيئة والاتصال (`initialize()`)
```javascript
async initialize() {
  // إعدادات wppconnect
  const createOptions = {
    session: 'pos-session',
    catchQR: (base64Qr, asciiQR, attempts, urlCode) => {
      this.qrCode = base64Qr;  // حفظ QR Code
    },
    statusFind: (statusSession, session) => {
      this.isConnected = statusSession === 'isLogged' || 
                         statusSession === 'qrReadSuccess' || 
                         statusSession === 'inChat';
    },
    folderNameToken: this.sessionDir,
    headless: true,              // تشغيل Chrome في الخلفية
    devtools: false,
    useChrome: true,
    debug: false,
    logQR: false,
    autoClose: 0,
    userDataDir: this.sessionDir,
    browserArgs: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu',
      // ... المزيد من الخيارات لتحسين الأداء
    ],
    disableWelcome: true,
    updatesLog: false
  };

  // البحث عن Chrome في المسارات الشائعة
  const chromePaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    // ... المزيد من المسارات
  ];

  // إنشاء العميل
  this.client = await wppconnect.create(createOptions);

  // مراقبة تغيرات الحالة
  this.client.onStateChange((state) => {
    this.isConnected = state === 'CONNECTED';
  });

  return { success: true, connected: this.isConnected };
}
```

#### 1.2 إرسال ملف PDF (`sendFile()`)
```javascript
async sendFile(phone, filePath, filename, caption = '') {
  // التحقق من الاتصال
  if (!this.client) {
    return { success: false, error: 'WhatsApp client not initialized' };
  }

  const status = await this.getConnectionStatus();
  if (!status.connected) {
    return { success: false, error: 'WhatsApp not connected' };
  }

  // تنسيق رقم الجوال
  const formattedPhone = this.formatPhoneNumber(phone);
  
  // التحقق من وجود الملف
  const fileExists = await fs.access(filePath).then(() => true).catch(() => false);
  if (!fileExists) {
    return { success: false, error: 'File not found: ' + filePath };
  }

  // إرسال الملف
  const result = await this.client.sendFile(
    formattedPhone,
    filePath,
    filename,
    caption
  );

  return { success: true, result };
}
```

#### 1.3 تنسيق رقم الجوال (`formatPhoneNumber()`)
```javascript
formatPhoneNumber(phone) {
  let cleaned = phone.replace(/[^\d+]/g, ''); // إزالة الأحرف غير الرقمية
  
  // تحويل الأرقام السعودية 05xxxxxxxx إلى 9665xxxxxxxx
  if (/^05\d{8}$/.test(cleaned)) {
    cleaned = '966' + cleaned.slice(1);
  }
  
  // إضافة @c.us للرقم
  if (!cleaned.includes('@')) {
    cleaned = cleaned + '@c.us';
  }
  
  return cleaned;
}
```

#### 1.4 الحصول على QR Code (`getQRCode()`)
```javascript
async getQRCode() {
  return this.qrCode; // Base64 QR Code
}
```

#### 1.5 التحقق من حالة الاتصال (`getConnectionStatus()`)
```javascript
async getConnectionStatus() {
  if (!this.client) {
    return { connected: false };
  }
  const state = await this.client.getConnectionState();
  const isConnected = state === 'CONNECTED' || this.isConnected;
  return { connected: isConnected, state };
}
```

#### 1.6 قطع الاتصال (`disconnect()`)
```javascript
async disconnect() {
  if (this.client) {
    await this.client.close();
    
    // قتل عملية المتصفح بالقوة
    const browser = await this.client.pupBrowser;
    if (browser && browser.process()) {
      browser.process().kill('SIGKILL');
    }
    
    this.client = null;
    this.isConnected = false;
    this.qrCode = null;
  }
  
  // قتل أي عمليات Chrome معلقة
  exec('taskkill /F /IM chrome.exe /FI "WINDOWTITLE eq WhatsApp*"');
  
  return { success: true };
}
```

#### 1.7 تسجيل الخروج (`logout()`)
```javascript
async logout() {
  if (this.client) {
    await this.client.logout();
    await this.client.close();
    
    // حذف ملفات الجلسة
    const tokenPath = path.join(this.sessionDir, 'pos-session');
    await fs.rm(tokenPath, { recursive: true, force: true });
  }
  
  return { success: true };
}
```

---

### 2. IPC Handlers (`src/main/main.js`)

```javascript
const whatsappService = require('./whatsapp-service');

function registerWhatsAppIPC() {
  // تهيئة WhatsApp
  ipcMain.handle('whatsapp:initialize', async () => {
    try {
      const result = await whatsappService.initialize();
      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // الحصول على QR Code
  ipcMain.handle('whatsapp:get_qr', async () => {
    try {
      const qr = await whatsappService.getQRCode();
      return { success: true, qr };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // التحقق من حالة الاتصال
  ipcMain.handle('whatsapp:status', async () => {
    try {
      const status = await whatsappService.getConnectionStatus();
      return { success: true, ...status };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // إرسال رسالة نصية
  ipcMain.handle('whatsapp:send_text', async (event, phone, message) => {
    try {
      const result = await whatsappService.sendTextMessage(phone, message);
      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // إرسال ملف
  ipcMain.handle('whatsapp:send_file', async (event, phone, filePath, filename, caption) => {
    try {
      const result = await whatsappService.sendFile(phone, filePath, filename, caption);
      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // قطع الاتصال
  ipcMain.handle('whatsapp:disconnect', async () => {
    try {
      const result = await whatsappService.disconnect();
      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // تسجيل الخروج
  ipcMain.handle('whatsapp:logout', async () => {
    try {
      const result = await whatsappService.logout();
      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
}

// استدعاء التسجيل
registerWhatsAppIPC();
```

---

### 3. Preload API (`src/main/preload.js`)

```javascript
contextBridge.exposeInMainWorld('api', {
  // WhatsApp APIs
  whatsapp_initialize: () => ipcRenderer.invoke('whatsapp:initialize'),
  whatsapp_get_qr: () => ipcRenderer.invoke('whatsapp:get_qr'),
  whatsapp_status: () => ipcRenderer.invoke('whatsapp:status'),
  whatsapp_send_text: (phone, message) => ipcRenderer.invoke('whatsapp:send_text', phone, message),
  whatsapp_send_file: (phone, filePath, filename, caption) => 
    ipcRenderer.invoke('whatsapp:send_file', phone, filePath, filename, caption),
  whatsapp_disconnect: () => ipcRenderer.invoke('whatsapp:disconnect'),
  whatsapp_logout: () => ipcRenderer.invoke('whatsapp:logout'),
  
  // Other APIs...
  pdf_export: (html, options) => ipcRenderer.invoke('pdf:export', html, options),
  settings_get: () => ipcRenderer.invoke('settings:get'),
});
```

---

## 🎨 واجهة المستخدم

### 1. شاشة إدارة WhatsApp (`src/renderer/whatsapp/index.html`)

#### 1.1 التصميم الرئيسي

**الألوان والـ Gradient:**
```css
/* الخلفية */
.bg-gradient-to-br {
  background: linear-gradient(to bottom right, #f9fafb, #d1fae5, #bbf7d0);
}

/* أزرار اللون الأخضر (Primary) */
.btn-primary {
  background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
}
.btn-primary:hover {
  background: linear-gradient(135deg, #16a34a 0%, #15803d 100%);
  transform: translateY(-2px);
  box-shadow: 0 12px 24px rgba(34, 197, 94, 0.3);
}

/* أزرار اللون الأزرق (Secondary) */
.btn-secondary {
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
}

/* أزرار اللون الأحمر (Danger) */
.btn-danger {
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
}

/* مؤشر حالة الاتصال */
.status-connected {
  background: #22c55e;
  box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7);
  animation: pulse-ring 2s ease-in-out infinite;
}

/* حاوية QR Code */
.qr-container {
  min-height: 320px;
  background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
  border: 3px dashed #22c55e;
  border-radius: 16px;
  padding: 24px;
}
```

**الـ Animations:**
```css
@keyframes pulse-ring {
  0% {
    box-shadow: 0 0 0 0 currentColor;
  }
  50% {
    box-shadow: 0 0 0 8px rgba(0, 0, 0, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(0, 0, 0, 0);
  }
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

#### 1.2 الهيكل HTML

**Header:**
```html
<header class="bg-white shadow-lg sticky top-0 z-50 border-b-4 border-emerald-500">
  <div class="container mx-auto px-6 py-4">
    <div class="flex items-center justify-between">
      <!-- Brand -->
      <div class="flex items-center gap-4">
        <div class="w-14 h-14 bg-gradient-to-br from-emerald-500 to-green-600 rounded-2xl flex items-center justify-center shadow-xl">
          <span class="text-4xl">📱</span>
        </div>
        <div>
          <h1 class="text-2xl font-black text-gray-800">إدارة WhatsApp</h1>
          <p class="text-sm text-gray-500 font-bold">ربط حساب WhatsApp لإرسال الفواتير تلقائياً</p>
        </div>
      </div>

      <!-- Back Button -->
      <button onclick="window.location.href='../main/index.html'" 
              class="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-black rounded-xl hover:from-blue-600 hover:to-blue-700">
        ⬅ العودة للرئيسية
      </button>
    </div>
  </div>
</header>
```

**Alert Messages:**
```html
<!-- Error Message -->
<div id="errorDiv" class="hidden mb-6 p-5 bg-red-50 border-2 border-red-500 text-red-700 rounded-2xl font-black shadow-lg animate-fade-in">
  <div class="flex items-center gap-3">
    <span class="text-3xl">❌</span>
    <span id="errorText"></span>
  </div>
</div>

<!-- Success Message -->
<div id="successDiv" class="hidden mb-6 p-5 bg-emerald-50 border-2 border-emerald-500 text-emerald-700 rounded-2xl font-black shadow-lg animate-fade-in">
  <div class="flex items-center gap-3">
    <span class="text-3xl">✅</span>
    <span id="successText"></span>
  </div>
</div>
```

**Connection Status & QR Card:**
```html
<div class="card-hover bg-white rounded-2xl shadow-2xl p-8 border-2 border-emerald-100 animate-fade-in">
  <div class="flex items-center justify-between mb-6 pb-4 border-b-2 border-gray-100">
    <h2 class="text-2xl font-black text-gray-800 flex items-center gap-2">
      <span class="text-3xl">🔗</span>
      حالة الاتصال
    </h2>
    <div class="flex items-center gap-3 bg-gray-50 px-4 py-2 rounded-xl">
      <span id="statusText" class="text-base font-black text-gray-700">غير متصل</span>
      <span id="statusIndicator" class="status-indicator status-disconnected"></span>
    </div>
  </div>

  <!-- QR Container -->
  <div id="qrSection" class="mb-6">
    <div class="qr-container" id="qrContainer">
      <div class="text-center">
        <div class="whatsapp-icon mb-4">📱</div>
        <p class="text-gray-600 font-black mb-6 text-lg">انقر على "ربط WhatsApp" لبدء الاتصال</p>
        <button onclick="initializeWhatsApp()" 
                class="btn-primary px-8 py-4 text-white rounded-xl font-black shadow-xl text-lg">
          🚀 ربط WhatsApp الآن
        </button>
      </div>
    </div>
  </div>

  <!-- Action Buttons -->
  <div class="flex gap-4">
    <button onclick="checkStatus()" 
            class="flex-1 btn-secondary px-5 py-4 text-white rounded-xl font-black shadow-lg">
      🔄 تحديث الحالة
    </button>
    <button onclick="logout()" 
            class="flex-1 btn-danger px-5 py-4 text-white rounded-xl font-black shadow-lg">
      🚪 تسجيل خروج
    </button>
  </div>
</div>
```

**Test Sending Card:**
```html
<div class="card-hover bg-white rounded-2xl shadow-2xl p-8 border-2 border-blue-100 animate-fade-in" 
     style="animation-delay: 0.1s;">
  <h2 class="text-2xl font-black text-gray-800 mb-6 pb-4 border-b-2 border-gray-100 flex items-center gap-2">
    <span class="text-3xl">📤</span>
    اختبار الإرسال
  </h2>
  
  <div class="mb-5">
    <label class="block text-base font-black text-gray-700 mb-3">📞 رقم الجوال</label>
    <input type="text" id="testPhone" 
           placeholder="05xxxxxxxx أو 9665xxxxxxxx" 
           class="w-full px-5 py-4 border-2 border-gray-200 rounded-xl font-black focus:outline-none focus:ring-4 focus:ring-blue-300 focus:border-blue-500 text-lg">
    <p class="text-sm text-gray-500 mt-2 font-bold">💡 مثال: 0501234567 أو 966501234567</p>
  </div>

  <div class="mb-6">
    <label class="block text-base font-black text-gray-700 mb-3">💬 الرسالة</label>
    <textarea id="testMessage" rows="4" 
              placeholder="اكتب رسالة تجريبية..."
              class="w-full px-5 py-4 border-2 border-gray-200 rounded-xl font-black focus:outline-none focus:ring-4 focus:ring-blue-300 focus:border-blue-500 text-base resize-none">
    </textarea>
  </div>

  <button onclick="sendTestMessage()" 
          class="btn-primary w-full px-6 py-4 text-white rounded-xl font-black shadow-xl text-lg mb-6">
    🚀 إرسال رسالة تجريبية
  </button>

  <div class="p-5 bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl">
    <div class="flex items-start gap-3">
      <span class="text-2xl">💡</span>
      <div>
        <h3 class="text-base font-black text-blue-900 mb-2">ملاحظة مهمة</h3>
        <p class="text-sm text-blue-700 font-bold leading-relaxed">
          بعد ربط WhatsApp بنجاح، سيتم إرسال الفواتير تلقائياً كملفات PDF للعملاء حسب الإعدادات.
        </p>
      </div>
    </div>
  </div>
</div>
```

**Instructions Card:**
```html
<div class="card-hover bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl shadow-2xl p-8 text-white animate-fade-in" 
     style="animation-delay: 0.2s;">
  <h3 class="text-2xl font-black mb-6 flex items-center gap-3">
    <span class="text-4xl">📋</span>
    طريقة ربط WhatsApp
  </h3>
  <ol class="space-y-4">
    <li class="flex items-start gap-4 p-4 bg-white/10 rounded-xl backdrop-blur-sm">
      <span class="flex-shrink-0 w-10 h-10 bg-white/20 rounded-full flex items-center justify-center font-black text-xl">1</span>
      <span class="font-black text-lg">انقر على زر "ربط WhatsApp الآن" أعلاه</span>
    </li>
    <li class="flex items-start gap-4 p-4 bg-white/10 rounded-xl backdrop-blur-sm">
      <span class="flex-shrink-0 w-10 h-10 bg-white/20 rounded-full flex items-center justify-center font-black text-xl">2</span>
      <span class="font-black text-lg">انتظر ظهور رمز QR (قد يستغرق بضع ثوانٍ)</span>
    </li>
    <li class="flex items-start gap-4 p-4 bg-white/10 rounded-xl backdrop-blur-sm">
      <span class="flex-shrink-0 w-10 h-10 bg-white/20 rounded-full flex items-center justify-center font-black text-xl">3</span>
      <span class="font-black text-lg">افتح تطبيق WhatsApp على هاتفك المحمول</span>
    </li>
    <li class="flex items-start gap-4 p-4 bg-white/10 rounded-xl backdrop-blur-sm">
      <span class="flex-shrink-0 w-10 h-10 bg-white/20 rounded-full flex items-center justify-center font-black text-xl">4</span>
      <span class="font-black text-lg">انتقل إلى: الإعدادات ← الأجهزة المرتبطة ← ربط جهاز</span>
    </li>
    <li class="flex items-start gap-4 p-4 bg-white/10 rounded-xl backdrop-blur-sm">
      <span class="flex-shrink-0 w-10 h-10 bg-white/20 rounded-full flex items-center justify-center font-black text-xl">5</span>
      <span class="font-black text-lg">امسح رمز QR الظاهر على الشاشة بالكاميرا</span>
    </li>
    <li class="flex items-start gap-4 p-4 bg-white/10 rounded-xl backdrop-blur-sm">
      <span class="flex-shrink-0 w-10 h-10 bg-white/20 rounded-full flex items-center justify-center font-black text-xl">6</span>
      <span class="font-black text-lg">انتظر رسالة التأكيد "تم الاتصال بنجاح" ✅</span>
    </li>
  </ol>
</div>
```

**Logout Confirmation Modal:**
```html
<div id="logoutModal" class="modal-overlay" onclick="if(event.target === this) closeLogoutModal()">
  <div class="modal-content">
    <div class="text-center mb-6">
      <div class="w-20 h-20 bg-gradient-to-br from-red-500 to-red-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-xl">
        <span class="text-5xl">⚠️</span>
      </div>
      <h2 class="text-2xl font-black text-gray-900 mb-3">تأكيد تسجيل الخروج</h2>
      <p class="text-base text-gray-700 font-bold leading-relaxed">
        سيتم قطع الاتصال وحذف جميع بيانات الجلسة الحالية.
      </p>
      <p class="text-base text-gray-700 font-bold leading-relaxed mt-2">
        ستحتاج إلى إعادة مسح رمز QR للربط مرة أخرى.
      </p>
    </div>
    
    <div class="flex gap-4">
      <button onclick="confirmLogout()" 
              class="flex-1 px-6 py-4 text-white font-black rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 text-lg" 
              style="background: #dc2626;">
        🚪 نعم، تسجيل الخروج
      </button>
      <button onclick="closeLogoutModal()" 
              class="flex-1 px-6 py-4 text-gray-800 font-black rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 text-lg" 
              style="background: #e5e7eb; border: 2px solid #9ca3af;">
        ❌ إلغاء
      </button>
    </div>
  </div>
</div>
```

#### 1.3 JavaScript Functions

**تهيئة WhatsApp:**
```javascript
async function initializeWhatsApp() {
  try {
    setError('');
    setSuccess('');
    updateStatus(false, 'connecting');
    
    const qrContainer = document.getElementById('qrContainer');
    qrContainer.innerHTML = `
      <div class="text-center">
        <div class="animate-spin text-6xl mb-4">⏳</div>
        <p class="text-gray-600 font-black text-lg">جاري التهيئة والاتصال بخادم WhatsApp...</p>
      </div>
    `;

    // بدء polling للـ QR
    startQRPolling();

    // استدعاء التهيئة
    setSuccess('تم بدء الاتصال، انتظر ظهور رمز QR...');
    
    window.api.whatsapp_initialize().then(result => {
      if (!result.success) {
        setError('خطأ في التهيئة: ' + (result.error || 'فشل التهيئة'));
      }
    }).catch(error => {
      setError('خطأ في التهيئة: ' + (error.message || error));
    });

  } catch (error) {
    setError('خطأ في التهيئة: ' + (error.message || error));
    updateStatus(false);
  }
}
```

**QR Code Polling:**
```javascript
function startQRPolling() {
  if (qrCheckInterval) {
    clearInterval(qrCheckInterval);
  }
  
  qrCheckInterval = setInterval(async () => {
    try {
      // الحصول على QR Code
      const qrResult = await window.api.whatsapp_get_qr();
      
      if (qrResult.success && qrResult.qr) {
        const qrContainer = document.getElementById('qrContainer');
        qrContainer.innerHTML = `
          <div class="text-center">
            <p class="text-emerald-600 font-black mb-4 text-xl">📱 امسح هذا الرمز من تطبيق WhatsApp</p>
            <img src="${qrResult.qr}" alt="QR Code" class="mx-auto">
            <p class="text-gray-500 font-bold mt-4 text-sm">⏱ ينتهي خلال دقيقتين</p>
          </div>
        `;
      }

      // التحقق من حالة الاتصال
      const statusResult = await window.api.whatsapp_status();
      if (statusResult.success && statusResult.connected) {
        clearInterval(qrCheckInterval);
        updateStatus(true);
        const qrContainer = document.getElementById('qrContainer');
        qrContainer.innerHTML = `
          <div class="text-center">
            <div class="text-8xl mb-6">✅</div>
            <p class="text-emerald-600 font-black text-3xl mb-3">تم الاتصال بنجاح!</p>
            <p class="text-gray-600 font-bold text-lg">WhatsApp جاهز للاستخدام الآن</p>
          </div>
        `;
      }
    } catch (error) {
      console.error('QR polling error:', error);
    }
  }, 2000); // كل ثانيتين
}
```

**تحديث حالة الاتصال:**
```javascript
function updateStatus(connected, state = '') {
  const statusText = document.getElementById('statusText');
  const statusIndicator = document.getElementById('statusIndicator');
  
  if (connected) {
    statusText.textContent = 'متصل ✅';
    statusText.className = 'text-base font-black text-emerald-600';
    statusIndicator.className = 'status-indicator status-connected';
    setSuccess('تم الاتصال بنجاح! يمكنك الآن إرسال الفواتير عبر WhatsApp');
  } else {
    if (state === 'connecting') {
      statusText.textContent = 'جاري الاتصال...';
      statusText.className = 'text-base font-black text-amber-600';
      statusIndicator.className = 'status-indicator status-connecting';
    } else {
      statusText.textContent = 'غير متصل';
      statusText.className = 'text-base font-black text-red-600';
      statusIndicator.className = 'status-indicator status-disconnected';
    }
  }
}
```

**إرسال رسالة تجريبية:**
```javascript
async function sendTestMessage() {
  try {
    setError('');
    setSuccess('');

    const phone = document.getElementById('testPhone').value.trim();
    const message = document.getElementById('testMessage').value.trim();

    if (!phone) {
      setError('⚠️ يرجى إدخال رقم الجوال أولاً');
      return;
    }

    if (!message) {
      setError('⚠️ يرجى كتابة الرسالة أولاً');
      return;
    }

    setSuccess('⏳ جاري إرسال الرسالة...');

    const result = await window.api.whatsapp_send_text(phone, message);
    
    if (result.success) {
      setSuccess('✅ تم إرسال الرسالة بنجاح!');
      document.getElementById('testMessage').value = '';
    } else {
      setError('❌ فشل الإرسال: ' + (result.error || 'خطأ غير معروف'));
    }
  } catch (error) {
    setError('❌ خطأ في الإرسال: ' + (error.message || error));
  }
}
```

**تسجيل الخروج:**
```javascript
async function confirmLogout() {
  closeLogoutModal();
  
  try {
    setError('');
    setSuccess('⏳ جاري تسجيل الخروج وحذف بيانات الجلسة...');
    
    await window.api.whatsapp_disconnect();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const result = await window.api.whatsapp_logout();
    
    if (result.success) {
      setSuccess('✅ تم تسجيل الخروج بنجاح. جاري إعادة تحميل الصفحة...');
      updateStatus(false);
      if (qrCheckInterval) clearInterval(qrCheckInterval);
      
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } else {
      setError('❌ فشل تسجيل الخروج: ' + (result.error || 'خطأ غير معروف'));
    }
  } catch (error) {
    setError('❌ خطأ في تسجيل الخروج: ' + (error.message || error));
  }
}
```

---

### 2. التكامل مع شاشة الفاتورة (`src/renderer/sales/print.html`)

#### 2.1 زر إرسال واتساب

**HTML:**
```html
<button class="whats-btn" id="whatsBtn" style="display:none">إرسال واتساب</button>
```

**CSS للزر:**
```css
.whats-btn {
  position: fixed;
  bottom: 120px;
  right: 20px;
  padding: 12px 24px;
  background: linear-gradient(135deg, #25d366, #128c7e);
  color: white;
  border: none;
  border-radius: 12px;
  font-weight: 900;
  font-size: 16px;
  cursor: pointer;
  box-shadow: 0 8px 24px rgba(37, 211, 102, 0.3);
  z-index: 9998;
}
```

#### 2.2 إظهار/إخفاء الزر حسب الإعدادات

```javascript
// Show/hide WhatsApp button by DB flag
const whatsBtn = document.getElementById('whatsBtn');
try { 
  whatsBtn.style.display = (settings && settings.show_whatsapp_controls) ? '' : 'none'; 
} catch(_) { }
```

#### 2.3 معالج حدث النقر على الزر

```javascript
if(whatsBtn){
  whatsBtn.addEventListener('click', () => {
    // Quick validation then send in background (non-blocking)
    (async () => {
      try{
        // 1. التحقق من اتصال WhatsApp
        const statusCheck = await api.whatsapp_status();
        if(!statusCheck || !statusCheck.success || !statusCheck.connected){
          alert('❌ WhatsApp غير متصل! يرجى الذهاب إلى إدارة WhatsApp وربط الحساب أولاً.');
          return;
        }

        // 2. التحقق من رقم العميل
        let rawPhone = String(window.__CUST_PHONE__ || '').trim();
        if(/^05\d{8}$/.test(rawPhone)){ 
          rawPhone = '966' + rawPhone.slice(1); 
        }
        rawPhone = rawPhone.replace(/[^\d+]/g,'');
        if(!rawPhone){ 
          alert('لا يوجد رقم جوال للعميل'); 
          return; 
        }

        // 3. بدء عملية الإرسال في الخلفية
        console.log('⏳ جاري إرسال الفاتورة عبر واتساب في الخلفية...');

        // Continue in background without blocking
        (async () => {
          try{
            // 4. إنشاء PDF من HTML
            const root = document.documentElement.cloneNode(true);
            Array.from(root.querySelectorAll('script')).forEach(s=>s.remove());
            Array.from(root.querySelectorAll('.reprint-btn, .export-btn, .whats-btn')).forEach(el=>el.remove());
            
            // Fix logo path for PDF
            try{
              const img = root.querySelector('#logo');
              if(img && settings.logo_path){
                let absLogo = '';
                if(String(settings.logo_path).startsWith('assets/')){
                  const rp = await api.resolve_path(settings.logo_path);
                  if(rp && rp.ok){ 
                    absLogo = 'file:///' + String(rp.abs||'').replace(/\\/g,'/'); 
                  }
                }else{
                  absLogo = 'file:///' + String(settings.logo_path||'').replace(/\\/g,'/');
                }
                if(absLogo){ img.src = absLogo; }
              }
            }catch(_){ }

            const html = '<!doctype html>' + root.outerHTML;
            const fname = `invoice-${sale.invoice_no}.pdf`;
            
            // 5. تصدير PDF إلى ملف مؤقت
            // IMPORTANT: openAfterSave: false لمنع فتح PDF
            const pdfResult = await api.pdf_export(html, { 
              printBackground: true, 
              saveMode: 'auto', 
              filename: fname,
              openAfterSave: false  // منع فتح الملف تلقائيًا
            });
            
            if(!pdfResult || !pdfResult.ok){ 
              console.error('❌ تعذر إنشاء PDF للفاتورة');
              alert('❌ فشل في إنشاء ملف PDF للفاتورة');
              return; 
            }

            // 6. إرسال PDF عبر WhatsApp
            console.log('PDF created at:', pdfResult.path);
            const company = (settings && settings.seller_legal_name) ? 
                           settings.seller_legal_name : 'فاتورة';
            const invNo = String(sale.invoice_no||'');
            const caption = `فاتورة رقم ${invNo} من ${company}`;
            
            console.log('Sending to phone:', rawPhone);
            console.log('PDF path:', pdfResult.path);
            
            const sendResult = await api.whatsapp_send_file(
              rawPhone, 
              pdfResult.path, 
              fname, 
              caption
            );

            // 7. عرض النتيجة
            if(sendResult && sendResult.success){
              console.log('✅ تم إرسال الفاتورة عبر WhatsApp بنجاح!');
              alert('✅ تم إرسال الفاتورة عبر WhatsApp بنجاح!');
            } else {
              const errMsg = sendResult?.error || 'خطأ غير معروف';
              console.error('❌ فشل الإرسال:', errMsg);
              alert('❌ فشل إرسال الفاتورة: ' + errMsg);
            }

          }catch(e){ 
            console.error('❌ خطأ في إرسال الفاتورة:', e);
            alert('❌ خطأ في إرسال الفاتورة: ' + (e.message || e));
          }
        })(); // Execute in background

      }catch(e){ 
        console.error('WhatsApp validation error:', e);
        alert('تعذر التحقق من إعدادات WhatsApp: ' + (e.message || e)); 
      }
    })();
  });
}
```

#### 2.4 الإرسال التلقائي بعد الطباعة

```javascript
// Auto-send PDF to WhatsApp after manual print completes
// IMPORTANT: Runs in background to not block UI or slow down printing
window.addEventListener('afterprint', () => {
  // Fire and forget - run in background without blocking
  if(!window.__WA_SENT__ && settings && settings.whatsapp_on_print){
    window.__WA_SENT__ = true;
    console.log('⏳ بدء إرسال الفاتورة عبر واتساب في الخلفية...');
    
    // Run async operation in background (no await here - non-blocking)
    (async () => {
      try{
        // 1. التحقق من اتصال WhatsApp
        const statusCheck = await api.whatsapp_status();
        if(!statusCheck || !statusCheck.success || !statusCheck.connected){
          console.log('WhatsApp not connected, skipping auto-send');
          return;
        }

        // 2. التحقق من رقم العميل
        let rawPhone = String(window.__CUST_PHONE__ || '').trim();
        if(/^05\d{8}$/.test(rawPhone)){ 
          rawPhone = '966' + rawPhone.slice(1); 
        }
        rawPhone = rawPhone.replace(/[^\d+]/g,'');
        if(!rawPhone){ 
          console.log('No customer phone, skipping WhatsApp send');
          return; 
        }

        // 3. إنشاء PDF
        const root = document.documentElement.cloneNode(true);
        Array.from(root.querySelectorAll('script')).forEach(s=>s.remove());
        Array.from(root.querySelectorAll('.reprint-btn, .export-btn, .whats-btn')).forEach(el=>el.remove());
        
        // Fix logo path for PDF
        try{
          const img = root.querySelector('#logo');
          if(img && settings.logo_path){
            let absLogo = '';
            if(String(settings.logo_path).startsWith('assets/')){
              const rp = await api.resolve_path(settings.logo_path);
              if(rp && rp.ok){ 
                absLogo = 'file:///' + String(rp.abs||'').replace(/\\/g,'/'); 
              }
            }else{
              absLogo = 'file:///' + String(settings.logo_path||'').replace(/\\/g,'/');
            }
            if(absLogo){ img.src = absLogo; }
          }
        }catch(_){ }

        const html = '<!doctype html>' + root.outerHTML;
        const fname = `invoice-${sale.invoice_no}.pdf`;
        
        // 4. Export PDF without opening it
        const pdfResult = await api.pdf_export(html, { 
          printBackground: true, 
          saveMode: 'auto', 
          filename: fname,
          openAfterSave: false
        });
        
        if(!pdfResult || !pdfResult.ok){ 
          console.error('❌ Failed to generate PDF for auto-send');
          return; 
        }

        // 5. Send PDF via WhatsApp
        const company = (settings && settings.seller_legal_name) ? 
                       settings.seller_legal_name : 'فاتورة';
        const invNo = String(sale.invoice_no||'');
        const caption = `فاتورة رقم ${invNo} من ${company}`;
        
        const sendResult = await api.whatsapp_send_file(
          rawPhone, 
          pdfResult.path, 
          fname, 
          caption
        );

        if(sendResult && sendResult.success){
          console.log('✅ تم إرسال الفاتورة عبر واتساب تلقائيًا');
        } else {
          console.error('❌ فشل الإرسال التلقائي:', sendResult?.error);
        }
      }catch(e){ 
        console.error('❌ خطأ في الإرسال التلقائي عبر واتساب:', e);
      }
    })(); // Execute immediately but don't wait for result
  }
});
```

---

## 🔧 إعدادات قاعدة البيانات

### حقول WhatsApp في جدول `app_settings`

```sql
-- إظهار/إخفاء أزرار WhatsApp
show_whatsapp_controls TINYINT NOT NULL DEFAULT 1

-- الإرسال التلقائي بعد الطباعة
whatsapp_on_print TINYINT NOT NULL DEFAULT 0

-- رسالة WhatsApp المخصصة (غير مستخدمة حالياً)
whatsapp_message TEXT NULL
```

**الاستعلامات:**
```sql
-- تفعيل/إيقاف أزرار WhatsApp
UPDATE app_settings SET show_whatsapp_controls = 1 WHERE id = 1;  -- تفعيل
UPDATE app_settings SET show_whatsapp_controls = 0 WHERE id = 1;  -- إيقاف

-- تفعيل/إيقاف الإرسال التلقائي بعد الطباعة
UPDATE app_settings SET whatsapp_on_print = 1 WHERE id = 1;  -- تفعيل
UPDATE app_settings SET whatsapp_on_print = 0 WHERE id = 1;  -- إيقاف
```

---

## 📝 ملاحظات تقنية مهمة

### 1. معالجة الأرقام السعودية
```javascript
// تحويل 05xxxxxxxx إلى 9665xxxxxxxx
if(/^05\d{8}$/.test(rawPhone)){ 
  rawPhone = '966' + rawPhone.slice(1); 
}
```

### 2. صيغة رقم WhatsApp
```javascript
// الصيغة النهائية: 9665xxxxxxxx@c.us
formattedPhone = rawPhone + '@c.us';
```

### 3. إنشاء PDF
- استنساخ DOM بالكامل
- إزالة كل الـ scripts
- إزالة الأزرار (reprint, export, whats)
- تحويل مسار الشعار إلى مسار مطلق `file:///`

### 4. الإرسال في الخلفية
- عدم انتظار النتيجة (non-blocking)
- عدم فتح PDF بعد التصدير (`openAfterSave: false`)
- استخدام IIFE async للتنفيذ الفوري

### 5. التعامل مع الأخطاء
- التحقق من الاتصال قبل كل عملية
- رسائل واضحة للمستخدم
- Logging تفصيلي في console

---

## 🎯 سيناريوهات الاستخدام

### السيناريو 1: ربط WhatsApp لأول مرة
1. المستخدم يفتح شاشة إدارة WhatsApp
2. ينقر على "ربط WhatsApp الآن"
3. يظهر QR Code بعد ثوانٍ
4. يمسح QR من تطبيق WhatsApp على الجوال
5. تظهر رسالة "تم الاتصال بنجاح"

### السيناريو 2: إرسال فاتورة يدوياً
1. في شاشة الفاتورة، بعد الطباعة
2. المستخدم ينقر زر "إرسال واتساب"
3. النظام يتحقق من الاتصال
4. النظام يتحقق من رقم العميل
5. يُنشئ PDF في الخلفية
6. يرسل PDF عبر WhatsApp
7. تظهر رسالة "تم الإرسال بنجاح"

### السيناريو 3: إرسال تلقائي بعد الطباعة
1. المستخدم يطبع الفاتورة (Ctrl+P أو زر طباعة)
2. بعد إغلاق نافذة الطباعة (afterprint event)
3. إذا كان `whatsapp_on_print = 1`
4. النظام يرسل تلقائياً بدون تدخل المستخدم
5. Logging في console فقط (silent)

---

## 🔐 متطلبات التشغيل

1. **Google Chrome مثبت** في أحد المسارات:
   - `C:\Program Files\Google\Chrome\Application\chrome.exe`
   - `C:\Program Files (x86)\Google\Chrome\Application\chrome.exe`

2. **Node Modules المطلوبة:**
   - `@wppconnect-team/wppconnect`
   - `electron`

3. **الصلاحيات:**
   - صلاحية `whatsapp` في جدول permissions
   - المستخدم يجب أن يكون لديه صلاحية الوصول

4. **إعدادات قاعدة البيانات:**
   - جدول `app_settings` يحتوي على الحقول المطلوبة
   - `seller_legal_name` للشركة
   - رقم جوال العميل في بيانات الفاتورة

---

## 📦 ملفات المشروع المتعلقة

```
src/
├── main/
│   ├── whatsapp-service.js        # خدمة WhatsApp الرئيسية
│   ├── main.js                    # IPC Handlers
│   └── preload.js                 # Context Bridge APIs
├── renderer/
│   ├── whatsapp/
│   │   └── index.html             # شاشة إدارة WhatsApp
│   └── sales/
│       └── print.html             # شاشة الفاتورة + التكامل
└── db/
    └── connection.js              # schema للحقول المطلوبة
```

---

## ✨ نصائح للتطوير

1. **استخدم نفس الألوان والـ Gradients**
2. **احتفظ بنفس البنية HTML**
3. **استخدم نفس أسماء الـ Classes**
4. **حافظ على Animations**
5. **التزم بنفس Error/Success Messages**
6. **استخدم نفس الـ Icons (Emoji)**
7. **اختبر مع أرقام سعودية (05xxxxxxxx)**
8. **تأكد من Chrome مثبت**

---

هذا الملخص الشامل يحتوي على كل التفاصيل التقنية والتصميمية لنظام إرسال الفواتير عبر WhatsApp! 🚀
