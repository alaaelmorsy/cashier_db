# Contract: HTTP API لتطبيق cashier-web

خادم Express واحد يقدّم الصفحات الثابتة + API. المنفذ الافتراضي `4300` (env: `PORT`).

## 1. المصادقة والجلسة

| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/api/auth/login` | `{ username, password }` | `{ ok:true, user:{ id, username, role, permissions:[…] } }` أو `{ ok:false, error }` |
| POST | `/api/auth/logout` | — | `{ ok:true }` |
| GET | `/api/auth/session` | — | `{ ok:true, user }` أو 401 |

- كل المسارات الأخرى (وكل صفحات `pages/*` عدا login) تتطلب جلسة صالحة؛ بدونها: صفحات → redirect إلى `/pages/login/`، API → `401 { ok:false, error:"unauthorized" }`.
- العمليات الحساسة تمر بفحص صلاحيات `module.action` من `user_permissions` (admin يمر دائمًا) — نفس منطق الأصل. فشل الصلاحية: `403 { ok:false, error }`.

## 2. جسر RPC (بديل IPC)

**`POST /api/rpc/:namespace/:action`** — body هو نفس payload قناة IPC الأصلية `namespace:action`، والاستجابة هي نفس ما كانت ترجعه دالة المعالج `{ ok: true|false, … }` بلا تغيير.

أمثلة تعيين (1:1 مع قنوات الأصل):

| قناة IPC الأصلية | مسار الويب |
|---|---|
| `sales:create` | `POST /api/rpc/sales/create` |
| `sales:init` | `POST /api/rpc/sales/init` |
| `products:get_by_barcode` | `POST /api/rpc/products/get_by_barcode` |
| `shifts:open` / `shifts:close` | `POST /api/rpc/shifts/open` / `…/close` |
| `customers:list` | `POST /api/rpc/customers/list` |
| `settings:get` | `POST /api/rpc/settings/get` |

- الأخطاء لا تُرجع exceptions خام؛ دائمًا `{ ok:false, error:"<string>" }` (دستور §4).
- كل namespace يُسجَّل عند نقل صفحته؛ استدعاء action غير مسجل: `404 { ok:false, error:"unknown action" }`.

## 3. بث الأحداث (بديل `ui:X_changed`)

**`GET /api/events`** — Server-Sent Events. كل رسالة: `event: <name>` + `data: <json>` بنفس أسماء أحداث الأصل (`ui:sales_changed`, `ui:products_changed`, …).

## 4. الأصول

| Method | Path | السلوك |
|---|---|---|
| GET | `/img/product/:id` | صورة المنتج: `image_blob` أولًا ثم `image_path` ثم الافتراضية (بديل `product-img://`) |
| GET | `/pages/<module>/` | صفحات التطبيق المنقولة |
| GET | `/shared/*` | api-shim.js، tailwind-output.css، theme.js |

## 5. عقد `window.api` (api-shim.js)

الـ shim يوفر للمتصفح نفس الواجهة التي وفرها preload لـ renderer.js، بحد أدنى:

```js
window.api = {
  invoke(channel, payload),   // 'ns:action' → fetch POST /api/rpc/ns/action → json
  on(eventName, callback),    // اشتراك SSE بنفس أسماء ui:X_changed
  off(eventName, callback),
};
```

أي دوال إضافية كان preload يكشفها لصفحة معيّنة تُضاف للـ shim عند نقل تلك الصفحة، بنفس الأسماء والتواقيع.

## 6. عقد نقل الصفحة (يتكرر لكل صفحة)

لكل صفحة `<module>` تُعتبر "تمام" عندما:
1. `public/pages/<module>/` تحتوي HTML + renderer.js منقولين بأقل تعديل (استبدال IPC بالـ shim فقط + مسارات الأصول).
2. كل قنوات IPC التي تستدعيها الصفحة مسجلة في RPC وتستدعي منطق `src/modules/<module>.js` المنقول.
3. الصفحة تعرض وتكتب نفس بيانات نسخة Electron على `cashier_db` (تحقق متقاطع بين النسختين).
4. RTL والعربية والشكل مطابقون للأصل.
5. **المستخدم راجعها واعتمدها** — عندها فقط تبدأ الصفحة التالية.
