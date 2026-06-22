<!--
Sync Impact Report
==================
Version change: 1.0.0 → 2.0.0
Bump rationale: MAJOR — complete rewrite; backward-incompatible structural expansion
  from 5 high-level principles to 16 fully-specified governance sections derived
  from deep codebase audit. All prior placeholder content replaced.

Modified principles:
  I.   Desktop-First / Offline-Capable        → retained & expanded
  II.  KSA/ZATCA Compliance                   → retained & expanded
  III. Security & Data Integrity              → retained & substantially expanded
  IV.  Simplicity & Maintainability           → retained & expanded
  V.   Testability                            → retained & expanded

Added sections:
  - System Overview
  - Architecture Design
  - Technology Stack
  - Coding Standards
  - Naming Conventions
  - Database Design Rules
  - API Design Rules
  - Frontend / UI Rules
  - Security Model (expanded from principle III)
  - Performance Rules
  - Testing Strategy
  - Deployment & Environment
  - Business Logic Rules
  - Hard Constraints
  - Tech Debt & Risks
  - Final Constitution Rules

Removed sections: N/A (v1 sections preserved and expanded)

Templates requiring updates:
  - .specify/templates/plan-template.md  ✅ Constitution Check section references live constitution
  - .specify/templates/spec-template.md  ✅ No structural changes required
  - .specify/templates/tasks-template.md ✅ No structural changes required

Follow-up TODOs:
  - TODO(RATIFICATION_DATE): confirm exact original project adoption date
  - TODO(SECURITY_ROADMAP): plain-text password migration plan for existing users
  - TODO(API_AUTH): define token/key strategy for port-4310 API before any
    network-exposed deployment
-->

# الرابط كاشير (Al-Rabt Cashier) — Project Constitution

---

## 1. System Overview

**What the system does (derived from code only):**

Al-Rabt Cashier (`pos1`, package version `1.0.121`) is an Electron desktop
Point-of-Sale (POS) application for KSA retail. It provides:

- Sales invoicing with ZATCA (Saudi e-invoicing) compliance
- Product management (master, variants, units, operations/subcategories)
- Customer management with custom pricing and credit tracking
- Shift/session management for cashiers
- Purchase invoice and expense tracking
- Offer, coupon, and promotion engine
- WhatsApp invoice delivery via Baileys
- Customer-facing display and kitchen printer routing
- Multi-location secondary-device sync via embedded REST API
- Auto-update via GitHub Releases

**Main modules / components:**

| Module | Entry Point | Responsibility |
|--------|------------|----------------|
| Main Process | `src/main/main.js` | App lifecycle, IPC hub, window management |
| Sales | `src/main/sales.js` | Invoicing, payments, refunds, ZATCA |
| Products | `src/main/products.js` | Product CRUD, variants, units, operations |
| Customers | `src/main/customers.js` | Customer CRUD, credit, custom pricing |
| Shifts | `src/main/shifts.js` | Shift open/close, reconciliation |
| Purchase Invoices | `src/main/purchase_invoices.js` | Vendor bills, payments |
| Offers | `src/main/offers.js` | Promotions, coupons, qty rules |
| ZATCA | `src/main/zatca.js` + helpers | e-Invoice CSR, signing, submission |
| WhatsApp | `src/main/whatsapp-service.js` | Baileys session, send text/file |
| API Server | `src/main/api-server.js` | Express REST on :4310 for secondary devices |
| Customer Display | `src/main/customer-display.js` | Serial-port display communication |
| Kitchen | `src/main/kitchen.js` | Kitchen printer routing |
| DB | `src/db/connection.js`, `db-adapter.js` | MySQL pool, transaction wrapper |
| Renderer | `src/renderer/*/` | Per-page HTML + renderer JS |

**High-level architecture:**

```
┌─────────────────────────────────────────────────────────┐
│  Electron Renderer Process (BrowserWindow × N)          │
│  HTML + Vanilla JS + Tailwind CSS                       │
│  contextIsolation=true, no direct Node access           │
└──────────────────┬──────────────────────────────────────┘
                   │ ipcRenderer (preload bridge)
┌──────────────────▼──────────────────────────────────────┐
│  Electron Main Process (Node.js)                        │
│  ├── IPC handlers (200+ channels, namespace:action)     │
│  ├── Business logic modules (sales, products, …)        │
│  ├── ZATCA, WhatsApp, scheduler, backup                 │
│  ├── Express API server (:4310)                         │
│  └── electron-updater (GitHub Releases)                 │
└──────────────────┬──────────────────────────────────────┘
                   │ mysql2/promise pool
┌──────────────────▼──────────────────────────────────────┐
│  MySQL 5.7+ (local or remote)                           │
│  cashier_db  ~30 tables                                 │
└─────────────────────────────────────────────────────────┘
```

---

## 2. Architecture Design

**Architecture pattern:** Monolithic Electron desktop application.
Single process boundary (main/renderer split); no microservices.

**Folder structure:**

```
cashier/
├── src/
│   ├── main/          # Main process: IPC handlers, business logic, server
│   ├── renderer/      # Renderer process: HTML pages + per-page JS
│   └── db/            # DB connection pool and adapter
├── __tests__/         # Jest test files
├── assets/            # Icons, fonts, product images, binaries
├── scripts/           # Build/packaging utilities
└── .specify/          # Speckit configuration and memory
```

**Module boundaries:**

- `src/renderer/*` MUST NOT import Node.js modules directly.
  All Node/DB access MUST go through IPC (preload bridge).
- `src/db/*` MUST NOT contain business logic; it provides the pool and
  a transaction wrapper only.
- `src/main/*.js` modules are the only location where DB queries and
  business rules live. They MUST NOT import renderer code.
- `api-server.js` MUST only READ data; it MUST NOT mutate state directly
  (mutations go through the same business-logic modules).

**Dependency rules:**

```
renderer → (preload IPC bridge) → main modules → db adapter → MySQL
                                             → external services (WhatsApp, ZATCA, email)
```

No circular dependencies across these layers.

---

## 3. Technology Stack

**Frontend (renderer):**
- Vanilla HTML5 + vanilla JS (no framework)
- Tailwind CSS v4 (compiled, MUST NOT hand-edit `tailwind-output.css`)
- No npm packages imported directly in renderer JS

**Backend (main process):**
- Node.js (Electron 28, Node 18-compatible)
- Express 5 (REST API, port 4310)
- mysql2/promise (DB pool)
- bcryptjs (legacy password hashing)
- node-forge (X.509 / ZATCA signing)
- @whiskeysockets/baileys (WhatsApp Web protocol)
- electron-updater (auto-update)
- nodemailer (SMTP email)
- serialport (kitchen display / customer display)
- systeminformation (hardware fingerprint)
- axios (HTTP client for ZATCA API)
- xml2js (XML parsing)
- xlsx (Excel import/export)
- qrcode (QR generation)
- uuid, moment-timezone, compression, cors, helmet, morgan

**Database:** MySQL 5.7+ (`cashier_db`, UTF8MB4)

**External services:**
- ZATCA (Saudi e-invoicing API) — axios
- WhatsApp — Baileys (no API key, WA Web protocol)
- GitHub Releases — electron-updater
- SMTP server — nodemailer (configurable in `app_settings`)

**Build tools:**
- electron-builder (NSIS, MSI, portable)
- electron-rebuild (native modules: serialport, sharp)
- Tailwind CSS CLI
- png-to-ico, sharp (icon/image processing)
- Jest (test runner)

**Dev tools:**
- VS Code (`.vscode/`)
- `.continue/` AI config

---

## 4. Coding Standards

**Code style:**
- ES2020+ syntax (async/await, destructuring, optional chaining)
- No TypeScript — plain JS throughout
- No linter config found (UNDETERMINED whether ESLint/Prettier is enforced)
- Two-space indentation observed in most files

**Async pattern (MUST):**
- Use `async/await` as the primary async pattern
- Callbacks are forbidden in new code
- Promise chains (`.then/.catch`) are acceptable only for fire-and-forget
  side effects
- MySQL connections MUST be released in `finally` blocks:
  ```javascript
  const conn = await pool.getConnection();
  try { … } finally { conn.release(); }
  ```
- Transactions MUST use `dbAdapter.transaction(async (conn) => { … })`;
  never manage BEGIN/COMMIT/ROLLBACK manually

**Error handling (MUST):**
- IPC handlers MUST return `{ ok: false, error: <string> }` on failure
- IPC handlers MUST return `{ ok: true, … }` on success
- Never return raw exception objects to renderer (scrub before returning)
- Try-catch with empty catch `catch(_) {}` is FORBIDDEN in new code;
  always log or propagate
- Background fire-and-forget tasks MUST log failures to electron-log

**Reusable patterns:**
- DB queries: parameterized placeholders (`?`), NEVER string concatenation
- Table-existence guard: per-module `__tablesEnsured` flag + `ensureTables()`
- IPC broadcast for data changes: `webContents.send('ui:X_changed')`
- Settings read: always use `getSettings(conn)` helper, never ad-hoc queries
- Image storage: check `image_blob` first, fall back to `image_path`

---

## 5. Naming Conventions

**Files:** `kebab-case.js` for multi-word modules (e.g., `whatsapp-service.js`,
`api-server.js`); single-word modules use the noun directly (e.g., `sales.js`).

**Functions:** `camelCase`. Internal/private helpers use underscore prefix
(`_helperName`). Long-lived singleton-state variables use double underscore
(`__mainWindow`, `__tablesEnsured`).

**IPC channels:** `namespace:action` using snake_case after the colon
(e.g., `sales:create`, `products:get_by_barcode`, `customer_display:send_text`).
Sub-operations: `namespace:sub_operation` (e.g., `sales:zatca_generate`).

**Express routes:** kebab-case path segments (`/api/purchase-invoices`,
`/api/credit-notes`, `/api/sales-items-summary`).

**Database tables:** plural `snake_case` (e.g., `sales_items`, `user_permissions`,
`purchase_invoice_details`).

**Database columns:** `snake_case`. Booleans: `is_*` prefix (e.g., `is_active`,
`is_vat_exempt`). Foreign keys: `{singular_table}_id` (e.g., `sale_id`,
`user_id`). Status/enum columns: short lowercase values (`open`, `closed`,
`paid`, `unpaid`, `partial`).

**Permission keys:** dot-separated `module.action` (e.g., `sales.discount`,
`products.add`, `permissions.manage`).

---

## 6. Database Design Rules

**Engine & charset:** MySQL 5.7+, UTF8MB4, `cashier_db`.

**Schema structure:**
- Every table MUST have an `id INT AUTO_INCREMENT PRIMARY KEY` unless
  the primary key is a natural key (e.g., `permissions.perm_key`,
  `app_counters.name`, `app_state.k`).
- Every table that records user actions MUST have `created_at DATETIME`
  and `created_by_user_id INT` columns.
- Status columns MUST use ENUM with explicitly defined values; no magic
  integer codes.

**Denormalization rule:** Invoice tables (`sales`, `sales_items`) MUST store
a snapshot of customer and product names at creation time (denormalized).
Do NOT rely on JOINs to customer/product tables for historical reporting.

**Relationships:**
- All FKs MUST be declared with explicit `ON DELETE` behavior:
  - Cascade delete for child records (`sales_items`, `payment_transactions`,
    `purchase_invoice_details`)
  - `SET NULL` where the parent's deletion should not destroy the child
    (`sales.shift_id`, `sales.customer_id`)
- Junction tables MUST use composite PK (`user_id + perm_key`)

**Indexing:**
- `sales`: composite indexes on `(created_at DESC, doc_type, payment_status)`,
  `(customer_id, created_at DESC)`, `(created_by_user_id, created_at DESC)`;
  full-text on `(customer_name, customer_phone, invoice_no, customer_vat)`
- `products`: index on `barcode`, `category`
- New high-cardinality tables MUST add indexes for every column used in
  WHERE, JOIN, or ORDER BY clauses before first production use

**Migration strategy:**
- No formal migration framework is in use; each module's `ensureTables()`
  function creates tables with `CREATE TABLE IF NOT EXISTS`.
- Schema changes MUST be applied via `ALTER TABLE` inside `ensureTables()`
  guarded by `SHOW COLUMNS FROM … LIKE '…'` checks.
- Destructive migrations (DROP COLUMN, DROP TABLE) MUST be documented and
  coordinated with the backup process.

---

## 7. API Design Rules

**Scope:** The Express server on port 4310 is a read-only data-sync API
for secondary devices. It MUST NOT accept write operations from external
HTTP clients (all mutations go through IPC from the primary device renderer).

**Endpoint structure:**
- Base prefix: `/api`
- Resource plural + kebab-case: `/api/purchase-invoices`, `/api/credit-notes`
- ID parameter: `/api/invoices/:id`
- Nested resource: `/api/invoices/:id/employees`
- Batch / custom action: `/api/products-images-batch`, `/api/period-summary`

**Request / response format:**
- All responses: `application/json`
- Success: `{ ok: true, data: … }` or `{ ok: true, items: […], total: N }`
- Error: `{ ok: false, error: "<message>" }`
- Pagination: `limit` + `offset` query params; response includes `total`
- Filtering: `date_from`, `date_to` (ISO date strings), `payment_status`,
  `user_id`, `search` as query params

**Authentication:** UNDETERMINED — no auth middleware currently on `/api/*`.
TODO(API_AUTH): Before any network-exposed deployment, ALL `/api/*` routes
MUST be protected by a token or API-key middleware.

**Versioning:** No versioning in current routes. Future breaking changes
MUST add a `/v2/` prefix rather than modifying existing routes.

---

## 8. Frontend / UI Rules

**Component structure:**
- Each page lives in its own subdirectory: `src/renderer/<module>/`
- Each subdirectory contains: `index.html` + `renderer.js` (+ optional helpers)
- No shared component library — duplication is acceptable over premature
  abstraction for renderer pages

**State management:**
- No framework state (no React/Vue/Redux)
- Page state lives in module-level variables inside `renderer.js`
- Cross-page state changes MUST trigger IPC broadcast (`ui:X_changed`) from
  main; renderer subscribes via `ipcRenderer.on`

**Styling system:**
- Tailwind CSS v4 ONLY
- MUST run `npm run build:css` after adding new Tailwind classes
  (or `npm run watch:css` during development)
- MUST NOT hand-edit `tailwind-output.css`
- RTL layout is required for Arabic; use Tailwind's `rtl:` modifier or
  explicit `dir="rtl"` on root elements

**UI patterns:**
- Modals/dialogs: vanilla HTML `<dialog>` or div-based overlay
- Tables: plain `<table>` with Tailwind classes
- Forms: standard HTML with IPC submit
- Printer output: pre-warm BrowserWindow pool (`_prewarmPrintWin`)
- Product images: served via custom `product-img://id` protocol (registered
  in main process); fallback to default image if not found

---

## 9. Security Model

**Authentication:**
- Login: username + password via `auth:login` IPC
- Password comparison:
  - If stored hash starts with `$2*` → bcryptjs.compare()
  - Otherwise → plain-text comparison (LEGACY ONLY)
- New users MUST have passwords hashed with bcryptjs (min cost 10)
- TODO(SECURITY_ROADMAP): migrate all existing plain-text passwords to bcrypt
  on next login (re-hash on successful plain-text auth)

**Authorization roles:**
- `admin` — full access by default
- `cashier` — access gated by explicit entries in `user_permissions`
- Permission hierarchy: dot-separated keys (`module.action`);
  parent permission grants all children

**IPC security:**
- `contextIsolation: true` MUST remain enabled — never disable
- `nodeIntegration: false` MUST remain — never enable
- Preload script is the ONLY bridge between renderer and main
- Every sensitive IPC handler MUST verify the caller's role before executing
  (query `user_permissions` or check `role === 'admin'`)

**Input validation:**
- All IPC payloads MUST be validated before DB interaction (type, range,
  required fields); use manual checks or a validation library
- File path inputs from renderer (`fs:import_image`, `products:import_excel`)
  MUST be validated with `path.resolve()` and checked for path traversal
- SQL MUST always use parameterized placeholders (`?`); string interpolation
  into SQL is FORBIDDEN

**API security:**
- The Express API (`/api/*`) MUST require authentication before any
  network-exposed deployment (TODO(API_AUTH))
- Helmet middleware is configured and MUST remain active
- Port 4310 MUST bind to `127.0.0.1` unless secondary-device mode is
  explicitly enabled by the user

**Data protection:**
- `.env` MUST be in `.gitignore` and never committed
- `db-config.json`, `.zatca-config.json`, `whatsapp-tokens/` MUST be
  stored in `app.getPath('userData')` and MUST NOT be bundled in the
  installer
- ZATCA private key and WhatsApp session tokens are stored in plaintext;
  encryption at rest is a recommended future improvement

**Known security risks (must not worsen):**
- Hardcoded DB password fallback in `src/db/connection.js` (line 24):
  change via `.env`, not by hard-coding a new value
- Default admin credentials (`admin` / `123456`, `superAdmin` / `LearnTech`)
  MUST be force-changed on first productive use
- License secret `'POS_SA_LICENSE_SECRET_v1'` is in source; treat the
  binary as potentially reversible — never rely on this alone for security

---

## 10. Performance Rules

**Pre-warm print window:**
- A pool of hidden BrowserWindows (`__printWinPool`) is maintained for fast
  invoice printing. MUST NOT be disabled or removed.

**DB connection pooling:**
- Use the shared pool from `src/db/connection.js`; MUST NOT create ad-hoc
  connections per request.
- Connection MUST be released in `finally`; connection leaks cause pool
  exhaustion under load.

**Indexes:**
- Sales queries MUST use the composite indexes on `sales`
  (see Section 6). Adding unindexed WHERE/ORDER BY on large tables
  without a corresponding index is FORBIDDEN.

**Batch operations:**
- Image fetches MUST use `products:images_batch` / `GET /api/products-images-batch`
  rather than per-product requests.
- Product-operations batch: `prod_ops:list_batch` MUST be used for
  bulk initialisation screens.

**Schema initialisation:**
- Per-module `__tablesEnsured` guard MUST be used to avoid re-running
  `CREATE TABLE IF NOT EXISTS` on every IPC call. Ensure once per session,
  not once per request.

**Lazy loading:**
- Sales screen initialisation (`sales:init` / `GET /api/sales-init`) MUST
  defer heavy data (large product lists, images) to separate calls to keep
  the screen interactive.

**Bottlenecks identified:**
- Full product list with images in a single query on large catalogs
- ZATCA XML generation + signing is CPU-intensive; MUST remain fire-and-forget
  (`setImmediate`) to not block the IPC response

---

## 11. Testing Strategy

**Framework:** Jest (v30), test environment: `node`

**Test location:** `__tests__/`

**Current coverage areas:**
- `sales-cart-integration.test.js` — Cart state, category preservation, payload
- `sales-categories-ui.test.js` — Category/subcategory UI rendering
- `sales-payload-structure.test.js` — Checkout payload validation

**Rules:**
- New business-logic functions (pricing, VAT, discount calculation) MUST have
  Jest unit tests before merging.
- Tests MUST run with `npm test` without Electron context (no `electron` import
  in tested modules).
- Integration tests that require a live MySQL MUST be gated by
  `RUN_INTEGRATION_TESTS=1` environment variable.
- Tests MUST NOT hard-code absolute file paths.
- Coverage for `src/main/electron.js` and `src/db/**` is explicitly excluded
  (per `jest.collectCoverageFrom` in `package.json`).

**Recommended additions (not yet enforced):**
- Unit tests for ZATCA VAT calculation and invoice XML structure
- Unit tests for offer/coupon discount engine
- Unit tests for shift reconciliation arithmetic

---

## 12. Deployment & Environment

**Target platform:** Windows 10/11 (x64), single-machine install
(NSIS or MSI), or portable EXE.

**Environment variables (`.env`):**

```
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASS=<password>       # MUST be set; never rely on hardcoded fallback
DB_NAME=cashier_db
APP_LOCALE=ar-SA
MYSQLDUMP_PATH=<path>    # Required for backup feature
```

**Runtime config files (all in `app.getPath('userData')`):**
- `db-config.json` — DB host/credentials (overrides `.env` at runtime)
- `.zatca-config.json` — ZATCA certificate, private key, environment
- `app-locale.json` — Language preference
- `app-zoom.json` — Zoom level
- `saved-accounts.json` — Previously logged-in users
- `branches.json` — Multi-location setup

**Build commands:**

```bash
npm run build:css          # Compile Tailwind (MUST run before packaging)
npm run dist:win           # NSIS + MSI installer (production)
npm run dist:portable      # Portable EXE (debug/demo)
```

**Release process:**
1. Bump `version` in `package.json` (semver)
2. Run `npm run build:css`
3. Run `npm run dist:win` (calls `clean-dist.js` + `gen-ico.js` first)
4. Upload installer to GitHub Releases on `alaaelmorsy/cashier_db`
5. electron-updater on client machines detects the new release

**CI/CD:** UNDETERMINED — no CI configuration file found in repository.

**Auto-update logic:**
- `autoDownload: false` (user-initiated)
- `autoInstallOnAppQuit: true`
- Support-end-date check: if `app_settings.support_end_date < today`,
  update download is blocked with a user message.

---

## 13. Business Logic Rules

**VAT:**
- VAT rate is stored in `app_settings.vat_percent` (typically 15 % for KSA).
  MUST NOT be hardcoded; always read from settings.
- Items with `is_vat_exempt = 1` are excluded from VAT calculation.
- Prices in `products` are stored BOTH as `price` (ex-VAT) and
  `price_with_vat`; always keep both in sync on create/update.

**Invoice creation (MUST follow this flow):**
1. Open or verify a current shift exists.
2. Validate all line items (product exists, price ≥ min_price).
3. Apply offers/discounts in order: customer-specific → offer engine → coupon.
4. Snapshot customer fields into `sales` row (denormalized).
5. Insert `sales` + `sales_items` in a single transaction.
6. Insert `payment_transactions` record.
7. Decrement `products.stock` for each sold item.
8. Fire ZATCA submission asynchronously (setImmediate).
9. Broadcast `ui:sales_changed`.

**Refund / credit note:**
- A refund creates a new `sales` row with `doc_type = 'credit_note'` and
  `ref_base_sale_id` pointing to the original.
- Stock MUST be restored on refund.
- Original invoice `payment_status` MUST be updated to reflect the credit.

**Shift reconciliation:**
- A shift MUST be open before any sale is recorded (`shift_id` on `sales`).
- Closing a shift computes: `cash_difference = closing_cash - expected_cash`.
- A shift CANNOT be re-opened once closed.

**Customer balance:**
- `customers.balance` represents outstanding credit (positive = owes money).
- Every partial payment MUST update `sales.remaining_amount` and
  `customers.balance` atomically.

**ZATCA submission:**
- Every invoice with `zatca_enabled = 1` in settings MUST eventually be
  submitted to ZATCA.
- Retry logic: the hourly scheduler re-submits invoices where
  `zatca_submitted = 0` and status is not `rejected`.
- Rejection reason MUST be stored in `sales.zatca_rejection_reason`.

**WhatsApp delivery:**
- Failure to send a WhatsApp message MUST NOT prevent or roll back a sale.
- Message count MUST be incremented in `app_settings.whatsapp_messages_sent`
  after each successful send.
- When `whatsapp_messages_sent >= whatsapp_messages_limit`, sending MUST
  be blocked with a user-visible error.

---

## 14. Hard Constraints

These rules MUST NEVER be broken:

1. **contextIsolation MUST remain `true`** and `nodeIntegration` MUST
   remain `false` in all BrowserWindow configurations.

2. **SQL MUST use parameterized queries** (`?` placeholders via mysql2).
   String interpolation into SQL query text is strictly forbidden.

3. **Mutations MUST go through IPC**, not directly through the REST API.
   The Express API is read-only.

4. **Shift MUST exist before recording a sale.** No `sale` row may be
   inserted without a valid open `shift_id`.

5. **Customer snapshot MUST be stored on every invoice.** Do NOT rely on
   `customers.name` / `customers.vat_number` at reporting time; use the
   denormalized fields in `sales`.

6. **ZATCA submission MUST be asynchronous.** Never block the IPC response
   waiting for ZATCA API round-trip.

7. **Tailwind CSS MUST be compiled.** The raw `tailwind-input.css` MUST NOT
   be served directly; always use the compiled `tailwind-output.css`.

8. **`version` in `package.json` is the single source of truth** for the
   application version. It MUST be incremented before every release build.

9. **`.env` and runtime config files MUST NOT be committed to version control.**

10. **Empty catch blocks `catch(_) {}` are FORBIDDEN in new code.** Exceptions
    MUST be logged or re-thrown.

11. **DB connections MUST be released in `finally` blocks.** Leaking
    connections is forbidden.

12. **Product images MUST be accessed via the `product-img://` custom
    protocol**, not via `file://` or direct filesystem paths in renderer code.

13. **The Arabic language (RTL) MUST remain supported** in all new UI pages.
    Every new page MUST include `dir="rtl"` or equivalent Tailwind RTL
    configuration.

14. **VAT rate MUST be read from `app_settings.vat_percent`**, not hardcoded
    anywhere in business logic.

---

## 15. Tech Debt & Risks

**Critical security risks:**
- Plain-text password storage for new users (see Section 9)
- Default credentials (`admin`/`123456`, `superAdmin`/`LearnTech`) in source
- Hardcoded DB password fallback in `src/db/connection.js`
- `/api/*` endpoints unauthenticated (open on LAN if port 4310 is exposed)
- ZATCA private key stored in plaintext in `userData`
- License secret hardcoded in source (`'POS_SA_LICENSE_SECRET_v1'`)

**Bad patterns (must not replicate):**
- `catch(_) {}` silently swallowing exceptions
- Missing `await` on async side-effects in some older handlers
- Inconsistent IPC channel naming (some use `.`, some use `:`, some `_`)
- Renderer code that uses `window.X` globals instead of proper module scope

**Missing architecture:**
- No CI/CD pipeline
- No formal database migration framework
- No API authentication layer
- No request validation library (manual ad-hoc checks only)
- No global uncaught-promise-rejection handler
- No structured logging strategy (electron-log used sparsely)

**Performance risks:**
- Full product catalog loaded into memory on sales screen init — may degrade
  on large catalogs (1000+ products)
- No query result caching for frequently-read settings/permissions

---

## 16. Final Constitution Rules

### MUST DO

- Use `async/await` for all asynchronous code in the main process.
- Release DB connections in `finally` blocks.
- Return `{ ok: true/false, … }` from all IPC handlers.
- Log all caught exceptions to `electron-log` before swallowing them.
- Use parameterized SQL queries exclusively.
- Store and read VAT rate from `app_settings.vat_percent`.
- Snapshot customer data into every `sales` row at creation time.
- Open/verify a shift before recording any sale.
- Process ZATCA submission asynchronously (fire-and-forget via `setImmediate`).
- Compile Tailwind CSS before packaging (`npm run build:css`).
- Bump `package.json` version before every release.
- Keep `contextIsolation: true` and `nodeIntegration: false`.
- Gate new integration tests behind `RUN_INTEGRATION_TESTS=1`.
- Hash passwords with bcryptjs (cost ≥ 10) for all new user creation.
- Include RTL support on every new renderer page.

### MUST NOT DO

- Hard-code SQL with string interpolation.
- Write empty catch blocks `catch(_) {}` in new code.
- Import Node.js modules directly in renderer code.
- Perform mutations via the Express REST API.
- Commit `.env`, `db-config.json`, `.zatca-config.json`, or
  `whatsapp-tokens/` to version control.
- Block the IPC response on ZATCA API calls.
- Hard-code the VAT rate anywhere in business logic.
- Insert a `sales` row without a valid open `shift_id`.
- Disable Helmet middleware on the Express server.
- Edit `tailwind-output.css` by hand.
- Introduce a new DB connection pool instead of using the shared one.
- Serve renderer pages with `nodeIntegration: true`.

### RECOMMENDED PRACTICES

- Add a migration to re-hash plain-text passwords to bcrypt on next login.
- Add token/API-key authentication to `/api/*` before any network-exposed deployment.
- Introduce a request validation library (zod, joi) for IPC payload validation.
- Set up CI (GitHub Actions) running `npm test` on every push.
- Add a global `process.on('unhandledRejection', …)` handler that logs to electron-log.
- Rotate the hardcoded license secret to an environment variable or remote service.
- Add indexes to new tables before first production use.
- Keep WhatsApp and ZATCA failures user-visible (toast/notification) rather than silent.
- Document every new IPC channel in a central registry comment in `main.js`.

---

## Governance

This constitution supersedes all other development practices in the repository.
Amendments require:
1. A written rationale referencing the affected section.
2. A version bump following semver:
   - MAJOR: removal or redefinition of Hard Constraints (Section 14)
   - MINOR: new principle, section, or materially expanded guidance
   - PATCH: clarification, wording, typo fixes
3. Updating `LAST_AMENDED_DATE` to the amendment date (ISO 8601).
4. Updating the Sync Impact Report HTML comment at the top of this file.

All feature plans MUST include a "Constitution Check" section verifying
compliance with Sections 9, 13, and 14 before Phase 0 research begins.
Complexity violations MUST be justified in the plan's Complexity Tracking table.

**Version**: 2.0.0 | **Ratified**: TODO(RATIFICATION_DATE): confirm original adoption date | **Last Amended**: 2026-06-18
