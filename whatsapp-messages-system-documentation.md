# نظام التحكم في عدد رسائل الواتساب - دليل التنفيذ الكامل

## نظرة عامة
نظام شامل لإدارة عدد رسائل الواتساب المسموح بإرسالها في تطبيق POS مع واجهة مستخدم احترافية ونظام إشعارات.

---

## 1. قاعدة البيانات

### الحقول المطلوبة في جدول `app_settings`:
```sql
whatsapp_messages_limit INT NOT NULL DEFAULT 0
whatsapp_messages_sent INT NOT NULL DEFAULT 0
```

### استعلامات SQL للدعم الفني:

#### 1.1 عرض الإحصائيات الحالية:
```sql
SELECT whatsapp_messages_limit AS 'الحد_الأقصى', whatsapp_messages_sent AS 'المستخدم', (whatsapp_messages_limit - whatsapp_messages_sent) AS 'المتبقي' FROM app_settings WHERE id = 1;
```

#### 1.2 تجديد الباقة (تحديد عدد جديد + تصفير العداد):
```sql
UPDATE app_settings SET whatsapp_messages_limit = 500, whatsapp_messages_sent = 0 WHERE id = 1;
```
**ملاحظة:** غيّر `500` للعدد المطلوب

#### 1.3 إعادة تعيين العداد فقط:
```sql
UPDATE app_settings SET whatsapp_messages_sent = 0 WHERE id = 1;
```

#### 1.4 زيادة الحد بمقدار محدد:
```sql
UPDATE app_settings SET whatsapp_messages_limit = whatsapp_messages_limit + 100 WHERE id = 1;
```

---

## 2. Backend (Node.js)

### 2.1 في ملف `whatsapp-service.js`:

#### دالة الحصول على الإحصائيات:
```javascript
async getMessagesStats() {
  try {
    console.log('WhatsApp Service: Getting messages stats from DB...');
    const pool = await getPool();
    const conn = await pool.getConnection();
    try {
      await conn.query(`USE \`${DB_NAME}\``);
      
      const checkColumn = async (colName) => {
        const [cols] = await conn.query('SHOW COLUMNS FROM app_settings LIKE ?', [colName]);
        return cols.length > 0;
      };
      
      if (!(await checkColumn('whatsapp_messages_limit'))) {
        console.log('WhatsApp Service: Adding whatsapp_messages_limit column');
        await conn.query('ALTER TABLE app_settings ADD COLUMN whatsapp_messages_limit INT NOT NULL DEFAULT 0');
      }
      
      if (!(await checkColumn('whatsapp_messages_sent'))) {
        console.log('WhatsApp Service: Adding whatsapp_messages_sent column');
        await conn.query('ALTER TABLE app_settings ADD COLUMN whatsapp_messages_sent INT NOT NULL DEFAULT 0');
      }
      
      const [existingRows] = await conn.query('SELECT id FROM app_settings WHERE id=1 LIMIT 1');
      if (existingRows.length === 0) {
        console.log('WhatsApp Service: No settings row found, creating with defaults');
        await conn.query(
          "INSERT INTO app_settings (id, vat_percent, prices_include_vat, currency_code, currency_symbol, currency_symbol_position, whatsapp_messages_limit, whatsapp_messages_sent) VALUES (1, 15.00, 1, 'SAR', '﷼', 'after', 0, 0)"
        );
      }
      
      const [rows] = await conn.query('SELECT whatsapp_messages_limit, whatsapp_messages_sent FROM app_settings WHERE id=1');
      console.log('WhatsApp Service: Query result:', rows);
      
      const settings = rows[0];
      if (!settings) {
        console.log('WhatsApp Service: No settings found after insert, using defaults');
        return { limit: 0, sent: 0, remaining: 0 };
      }
      
      const limit = Number(settings.whatsapp_messages_limit != null ? settings.whatsapp_messages_limit : 0);
      const sent = Number(settings.whatsapp_messages_sent != null ? settings.whatsapp_messages_sent : 0);
      const remaining = Math.max(0, limit - sent);
      console.log(`WhatsApp Service: Calculated stats - limit: ${limit}, sent: ${sent}, remaining: ${remaining}`);
      return { limit, sent, remaining };
    } finally {
      conn.release();
    }
  } catch (error) {
    console.error('WhatsApp Service: Error getting messages stats:', error);
    return { limit: 0, sent: 0, remaining: 0, error: error.message };
  }
}
```

#### دالة زيادة عداد الرسائل المرسلة:
```javascript
async incrementMessagesSent() {
  try {
    const pool = await getPool();
    const conn = await pool.getConnection();
    try {
      await conn.query(`USE \`${DB_NAME}\``);
      
      const [rows] = await conn.query('SELECT whatsapp_messages_sent FROM app_settings WHERE id=1');
      if (rows.length === 0) {
        console.log('No settings row found in incrementMessagesSent');
        return { success: false, error: 'Settings row not found' };
      }
      
      await conn.query('UPDATE app_settings SET whatsapp_messages_sent = whatsapp_messages_sent + 1 WHERE id=1');
      return { success: true };
    } finally {
      conn.release();
    }
  } catch (error) {
    console.error('Error incrementing messages sent:', error);
    return { success: false, error: error.message };
  }
}
```

#### دالة التحقق من وجود رصيد:
```javascript
async checkMessagesLimit() {
  const stats = await this.getMessagesStats();
  return stats.remaining > 0;
}
```

#### تعديل دالة إرسال الرسائل (sendTextMessage):
```javascript
async sendTextMessage(phone, message) {
  try {
    // التحقق من الحد الأقصى أولاً
    const hasLimit = await this.checkMessagesLimit();
    if (!hasLimit) {
      const stats = await this.getMessagesStats();
      return { 
        success: false, 
        error: 'تم انتهاء عدد الرسائل المتاحة. يرجى التجديد.',
        limitReached: true,
        stats
      };
    }

    if (!this.client || !this.isConnected) {
      return { success: false, error: 'WhatsApp not connected' };
    }

    const formattedPhone = this.formatPhoneNumber(phone);
    const result = await this.client.sendText(formattedPhone, message);
    
    // زيادة العداد بعد الإرسال الناجح
    await this.incrementMessagesSent();
    
    return { success: true, result };
  } catch (error) {
    console.error('Error sending text message:', error);
    return { success: false, error: error.message };
  }
}
```

**ملاحظة:** نفس المنطق ينطبق على `sendFile` وأي دالة أخرى لإرسال رسائل واتساب.

### 2.2 في ملف `main.js` - IPC Handlers:

```javascript
// Get messages stats
ipcMain.handle('whatsapp:get_messages_stats', async () => {
  try {
    if (!whatsappService) {
      return { success: false, error: 'WhatsApp service not initialized' };
    }
    const stats = await whatsappService.getMessagesStats();
    return { success: true, ...stats };
  } catch (error) {
    console.error('Error getting messages stats:', error);
    return { success: false, error: error.message };
  }
});

// Update messages limit (للاستخدام من واجهة المستخدم إذا لزم الأمر)
ipcMain.handle('whatsapp:update_messages_limit', async (event, limit) => {
  try {
    const { getPool, DB_NAME } = require('../db/connection');
    const pool = await getPool();
    const conn = await pool.getConnection();
    try {
      await conn.query(`USE \`${DB_NAME}\``);
      await conn.query('UPDATE app_settings SET whatsapp_messages_limit = ? WHERE id=1', [limit]);
      return { success: true };
    } finally {
      conn.release();
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Reset messages count
ipcMain.handle('whatsapp:reset_messages_count', async () => {
  try {
    const { getPool, DB_NAME } = require('../db/connection');
    const pool = await getPool();
    const conn = await pool.getConnection();
    try {
      await conn.query(`USE \`${DB_NAME}\``);
      await conn.query('UPDATE app_settings SET whatsapp_messages_sent = 0 WHERE id=1');
      return { success: true };
    } finally {
      conn.release();
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
});
```

---

## 3. Frontend (HTML/CSS/JavaScript)

### 3.1 نظام Toast للإشعارات:

#### HTML:
```html
<!-- Toast Notification for Messages Limit -->
<div id="messagesLimitToast" class="toast-notification hidden">
  <div class="p-4 bg-gradient-to-r from-red-500 to-red-600 border-2 border-red-700 text-white rounded-xl font-black shadow-2xl">
    <div class="flex items-center gap-3">
      <span class="text-3xl">⚠️</span>
      <div>
        <div class="text-lg font-black mb-1">انتهى عدد الرسائل المتاحة!</div>
        <div class="text-sm font-bold opacity-90">يرجى التواصل مع الدعم الفني للتجديد</div>
      </div>
      <button onclick="hideToast()" class="mr-auto bg-white/20 hover:bg-white/30 rounded-lg p-2 transition-all">
        <span class="text-2xl">✕</span>
      </button>
    </div>
  </div>
</div>
```

#### CSS:
```css
.toast-notification {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 9999;
  animation: slideInRight 0.4s ease-out;
  max-width: 400px;
}

.toast-notification.hidden {
  display: none;
}

.toast-notification.hiding {
  animation: slideOutRight 0.4s ease-out;
}

@keyframes slideInRight {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

@keyframes slideOutRight {
  from {
    transform: translateX(0);
    opacity: 1;
  }
  to {
    transform: translateX(100%);
    opacity: 0;
  }
}
```

### 3.2 عرض الإحصائيات - 3 بطاقات:

#### HTML:
```html
<div id="messagesCounterBanner" class="mb-6">
  <div class="grid grid-cols-3 gap-4">
    <!-- عدد الرسائل (الحد الأقصى) -->
    <div class="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-4 text-white">
      <div class="flex items-center justify-between mb-2">
        <span class="text-2xl">📊</span>
        <div class="bg-white/20 px-2 py-1 rounded text-xs font-bold">إجمالي</div>
      </div>
      <div class="text-center">
        <div id="totalMessages" class="text-4xl font-black mb-1">-</div>
        <div class="text-xs font-bold opacity-90">عدد الرسائل</div>
      </div>
    </div>

    <!-- الرسائل المتبقية -->
    <div id="remainingCard" class="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-lg p-4 text-white">
      <div class="flex items-center justify-between mb-2">
        <span class="text-2xl">💬</span>
        <div class="bg-white/20 px-2 py-1 rounded text-xs font-bold">متبقي</div>
      </div>
      <div class="text-center">
        <div id="remainingMessages" class="text-4xl font-black mb-1">-</div>
        <div class="text-xs font-bold opacity-90">الرسائل المتبقية</div>
      </div>
    </div>

    <!-- الرسائل المستخدمة -->
    <div class="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl shadow-lg p-4 text-white">
      <div class="flex items-center justify-between mb-2">
        <span class="text-2xl">✅</span>
        <div class="bg-white/20 px-2 py-1 rounded text-xs font-bold">مُرسل</div>
      </div>
      <div class="text-center">
        <div id="sentMessages" class="text-4xl font-black mb-1">-</div>
        <div class="text-xs font-bold opacity-90">الرسائل المستخدمة</div>
      </div>
    </div>
  </div>
</div>
```

### 3.3 JavaScript - دوال التحكم:

```javascript
let qrCheckInterval = null;
let toastTimeout = null;
let toastShownOnLoad = false;

// إظهار Toast
function showToast() {
  const toast = document.getElementById('messagesLimitToast');
  toast.classList.remove('hidden', 'hiding');
  
  if (toastTimeout) {
    clearTimeout(toastTimeout);
  }
  
  toastTimeout = setTimeout(() => {
    hideToast();
  }, 8000); // يختفي بعد 8 ثوان
}

// إخفاء Toast
function hideToast() {
  const toast = document.getElementById('messagesLimitToast');
  toast.classList.add('hiding');
  
  setTimeout(() => {
    toast.classList.add('hidden');
    toast.classList.remove('hiding');
  }, 400);
  
  if (toastTimeout) {
    clearTimeout(toastTimeout);
    toastTimeout = null;
  }
}

// تحميل إحصائيات الرسائل
async function loadMessagesStats(isInitialLoad = false) {
  try {
    console.log('Loading messages stats...');
    const result = await window.api.whatsapp_get_messages_stats();
    console.log('Messages stats result:', result);
    
    if (result && result.success) {
      const { limit, sent, remaining } = result;
      console.log(`Stats - Limit: ${limit}, Sent: ${sent}, Remaining: ${remaining}`);
      
      // تحديث الأرقام
      document.getElementById('remainingMessages').textContent = remaining !== undefined ? remaining : '-';
      document.getElementById('totalMessages').textContent = limit !== undefined ? limit : '-';
      document.getElementById('sentMessages').textContent = sent !== undefined ? sent : '-';
      
      // تغيير لون البطاقة الوسطى حسب العدد المتبقي
      const remainingCard = document.getElementById('remainingCard');
      if (remaining !== undefined) {
        if (remaining <= 10 && remaining > 0) {
          // برتقالي: 10 رسائل أو أقل
          remainingCard.className = 'bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl shadow-lg p-4 text-white';
        } else if (remaining <= 0) {
          // أحمر: صفر رسائل
          remainingCard.className = 'bg-gradient-to-br from-red-500 to-red-600 rounded-xl shadow-lg p-4 text-white';
          // إظهار Toast فقط عند التحميل الأول
          if (isInitialLoad && !toastShownOnLoad) {
            showToast();
            toastShownOnLoad = true;
          }
        } else {
          // بنفسجي: أكثر من 10 رسائل
          remainingCard.className = 'bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-lg p-4 text-white';
        }
      }
    } else {
      console.error('Failed to load stats:', result ? result.error : 'No result returned');
      document.getElementById('remainingMessages').textContent = '0';
      document.getElementById('totalMessages').textContent = '0';
      document.getElementById('sentMessages').textContent = '0';
    }
  } catch (error) {
    console.error('Error loading messages stats:', error);
    document.getElementById('remainingMessages').textContent = 'خطأ';
    document.getElementById('totalMessages').textContent = 'خطأ';
    document.getElementById('sentMessages').textContent = 'خطأ';
  }
}

// دالة إرسال رسالة (مع التحقق من الحد)
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
      await loadMessagesStats();
    } else {
      if (result.limitReached) {
        // إظهار Toast عند محاولة الإرسال بدون رصيد
        showToast();
        await loadMessagesStats();
      } else {
        setError('❌ فشل الإرسال: ' + (result.error || 'خطأ غير معروف'));
      }
    }
  } catch (error) {
    console.error(error);
    setError('❌ خطأ في الإرسال: ' + (error.message || error));
  }
}

// عند تحميل الصفحة
checkStatus();

// تحميل الإحصائيات مع تأخير بسيط
setTimeout(() => {
  console.log('Calling loadMessagesStats...');
  loadMessagesStats(true); // true = التحميل الأول
}, 500);

// تحديث تلقائي كل 30 ثانية (بدون إظهار Toast)
setInterval(loadMessagesStats, 30000);
```

---

## 4. آلية العمل

### 4.1 التدفق الكامل:

1. **عند تشغيل التطبيق:**
   - يتم التحقق من وجود الحقول `whatsapp_messages_limit` و `whatsapp_messages_sent`
   - إذا لم تكن موجودة، يتم إنشاؤها بقيمة افتراضية `0`

2. **عند فتح صفحة الواتساب:**
   - يتم استدعاء `loadMessagesStats(true)` لعرض الإحصائيات
   - إذا كان الرصيد = 0، يظهر Toast **مرة واحدة فقط**
   - يتم تغيير لون البطاقة الوسطى حسب العدد المتبقي:
     - **بنفسجي**: أكثر من 10 رسائل
     - **برتقالي**: 10 رسائل أو أقل
     - **أحمر**: صفر رسائل

3. **عند محاولة إرسال رسالة:**
   - يتم التحقق من `checkMessagesLimit()` أولاً
   - إذا كان `remaining > 0`:
     - يتم إرسال الرسالة
     - يتم استدعاء `incrementMessagesSent()` تلقائياً
     - يتم تحديث العرض
   - إذا كان `remaining = 0`:
     - يتم رفض الإرسال
     - يظهر Toast التحذير
     - يتم إرجاع `{ success: false, limitReached: true }`

4. **التحديث التلقائي:**
   - كل 30 ثانية يتم تحديث الإحصائيات **بدون إظهار Toast**

### 4.2 التجديد:
- **فقط عبر SQL** من الدعم الفني
- **لا يوجد تجديد تلقائي**
- **لا يوجد واجهة للمستخدم للتعديل**

---

## 5. الألوان والتصميم

### نظام الألوان:
- **البطاقة الأولى (إجمالي)**: `from-blue-500 to-blue-600` - أزرق
- **البطاقة الثانية (متبقي)**: 
  - `from-purple-500 to-purple-600` - بنفسجي (أكثر من 10)
  - `from-orange-500 to-orange-600` - برتقالي (10 أو أقل)
  - `from-red-500 to-red-600` - أحمر (صفر)
- **البطاقة الثالثة (مُرسل)**: `from-emerald-500 to-emerald-600` - أخضر

### الأيقونات:
- **إجمالي**: 📊
- **متبقي**: 💬
- **مُرسل**: ✅
- **Toast**: ⚠️

---

## 6. ملاحظات مهمة

1. ✅ النظام يبدأ بـ **0 رسالة** افتراضياً
2. ✅ التجديد **فقط عبر SQL** من الدعم الفني
3. ✅ العداد يزيد تلقائياً بعد كل رسالة ناجحة
4. ✅ Toast يظهر:
   - مرة واحدة عند فتح الصفحة إذا الرصيد = 0
   - عند محاولة إرسال رسالة بدون رصيد
   - **لا يظهر** في التحديث التلقائي كل 30 ثانية
5. ✅ Toast يختفي تلقائياً بعد 8 ثوان
6. ✅ يمكن إغلاق Toast يدوياً بالضغط على ✕
7. ✅ الواجهة للقراءة فقط - لا يمكن للمستخدم التعديل

---

## 7. أمثلة على الاستخدام

### مثال 1: تجديد الباقة بـ 1000 رسالة
```sql
UPDATE app_settings SET whatsapp_messages_limit = 1000, whatsapp_messages_sent = 0 WHERE id = 1;
```

### مثال 2: إضافة 500 رسالة للرصيد الحالي
```sql
UPDATE app_settings SET whatsapp_messages_limit = whatsapp_messages_limit + 500 WHERE id = 1;
```

### مثال 3: عرض الإحصائيات الحالية
```sql
SELECT whatsapp_messages_limit AS 'الحد_الأقصى', whatsapp_messages_sent AS 'المستخدم', (whatsapp_messages_limit - whatsapp_messages_sent) AS 'المتبقي' FROM app_settings WHERE id = 1;
```

---

## 8. الملفات المتأثرة

1. `src/main/whatsapp-service.js` - منطق الخدمة
2. `src/main/main.js` - IPC Handlers
3. `src/renderer/whatsapp/index.html` - الواجهة والمنطق
4. `database-updates/whatsapp-messages-limit.sql` - استعلامات SQL

---

**تاريخ الإنشاء:** 2026
**الإصدار:** 1.0
**الحالة:** مكتمل وجاهز للاستخدام
