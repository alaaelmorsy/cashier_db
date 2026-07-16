# Tasks: International Transport at 0% VAT

**Input**: Design documents from `/specs/003-international-transport-vat/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/ipc-api.md`, `quickstart.md`

**Tests**: Included because the feature changes VAT calculations, sale persistence, ZATCA XML/QR, credit notes, and financial reports; the project constitution requires Jest coverage for new business logic.

**Organization**: Tasks are grouped by user story. Within each story, tests are written first and must fail for the intended reason before implementation begins.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it touches different files and has no dependency on another incomplete task in the same batch.
- **[Story]**: Maps the task to US1, US2, US3, or US4 from `spec.md`.
- Every task names the exact file or files it changes.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish feature constants and reusable test data without changing runtime behavior.

- [X] T001 Create reusable standard, eligible-zero-rate, mixed-cart, and credit-note fixtures in `__tests__/helpers/international-transport-fixtures.cjs`
- [X] T002 [P] Create the feature constants/error-code module skeleton for `standard`, `international_transport_zero_rate`, `Z`, and `VATEX-SA-34-1` in `src/shared/international-transport-tax.js`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Add the pure rules, trusted actor context, and additive schema needed by every user story.

**⚠️ CRITICAL**: Complete this phase before any user-story implementation.

- [X] T003 Write failing unit tests for treatment normalization, origin country fixed to `SA`, non-`SA` destination validation, eligible-only carts, immutable snapshots, and decimal zero-rate totals in `__tests__/international-transport-tax.test.js`
- [X] T004 Implement the Electron-independent validators, snapshot builder, effective-rate calculation, and controlled error codes in `src/shared/international-transport-tax.js`
- [X] T005 [P] Add idempotent `app_settings.international_transport_zero_rate_enabled` plus append-only `settings_audit_log` with `id INT`, `created_at`, `created_by_user_id INT`, `ON DELETE SET NULL`, actor-name snapshot, and required indexes to every settings bootstrap path in `src/main/settings.js`
- [X] T006 [P] Add the idempotent `products.is_international_transport_service` column and normalization to product schema bootstrap paths in `src/main/products.js`
- [X] T007 Add idempotent `tax_treatment ENUM('standard','international_transport_zero_rate')`, fixed-origin-country/route snapshot columns, item eligibility snapshot, historical-safe defaults, and `(tax_treatment, created_at)` index to every primary sales bootstrap path in `src/main/sales.js`
- [X] T008 Add read-only feature capability plus settings, product, invoice, credit-note, and report projections without schema or mutation logic in `src/main/api-server.js`
- [X] T009 Bind authenticated users to `webContents.id` on login, clear bindings on logout/sender destruction, and expose a sender-aware main-process role/permission assertion without trusting renderer identity in `src/main/auth.js` and `src/main/permissions.js`
- [X] T010 Expose sender-bound logout/session cleanup, the narrow setting mutation, `ui:settings_changed` subscription, and existing extended product/sale reads through the context-isolated bridge in `src/main/preload.js`

**Checkpoint**: Shared rules import without Electron, migrations are repeatable on MySQL 5.7+, and sensitive operations can resolve a trusted actor.

---

## Phase 3: User Story 1 — Enable the international invoice type (Priority: P1) 🎯 MVP

**Goal**: An authorized administrator can enable or disable the off-by-default invoice type; the sales selector follows the saved state while historical documents remain unaffected.

**Independent Test**: Start with a fresh/migrated database, verify the type is hidden, reject unauthorized and secondary-device toggles, enable it as an authorized primary-device admin, restart and verify it appears, then disable it and verify one audited transition per actual state change plus a post-commit live update in another window.

### Tests for User Story 1

- [X] T011 [P] [US1] Write failing tests for default-off migration, boolean capability normalization, sender-bound authorization, primary-only changes, no-op saves, constitutional audit columns/FK, atomic audit rows, post-commit broadcast, and secondary read parity in `__tests__/international-transport-settings.test.js`
- [X] T012 [P] [US1] Write failing renderer source/DOM tests for the Arabic RTL setting control and conditional sales invoice selector in `__tests__/international-transport-settings-ui.test.js`

### Implementation for User Story 1

- [X] T013 [US1] Seed and resolve the existing settings-management permission needed by the dedicated toggle operation in `src/main/permissions.js`
- [X] T014 [US1] Implement primary-only `settings:set_international_transport_zero_rate` with sender-bound actor authorization, parameterized SQL, transaction-safe setting/audit writes, no-op detection, logged errors, and post-commit `ui:settings_changed` broadcast in `src/main/settings.js`
- [X] T015 [P] [US1] Add the off-by-default Arabic RTL checkbox and explanatory zero-rated—not exempt—copy to `src/renderer/settings/index.html`
- [X] T016 [US1] Load, normalize, and save the toggle through the dedicated bridge operation with permission-aware feedback in `src/renderer/settings/renderer.js`
- [X] T017 [P] [US1] Add the hidden invoice-treatment selector container with standard selected by default to `src/renderer/sales/index.html`
- [X] T018 [US1] Read the saved capability/toggle, hide mutation controls on secondary devices, subscribe to `ui:settings_changed`, and reset hidden/disabled carts to standard treatment in `src/renderer/sales/renderer.js`

**Checkpoint**: User Story 1 passes independently; enabling availability never converts a sale automatically.

---

## Phase 4: User Story 2 — Issue a compliant international transport invoice (Priority: P1)

**Goal**: A cashier can select the feature for an eligible all-transport cart, enter Saudi origin/non-Saudi destination/shipment reference, and save an immutable invoice with VAT `0.00` while ordinary invoices retain configured VAT.

**Independent Test**: Mark one product eligible, complete a primary-device Saudi-to-foreign invoice and verify its persisted treatment/rate/reason/route/totals; then prove non-`SA` origin, missing fields, `SA` destination, disabled setting, unmarked product, mixed cart, forged totals, concurrent disable, and secondary mutation attempts are rejected or unavailable.

### Tests for User Story 2

- [X] T019 [P] [US2] Write failing product persistence and read-contract tests for the eligibility flag without changing `is_vat_exempt` in `__tests__/international-transport-products.test.js`
- [X] T020 [P] [US2] Write failing renderer calculation/payload tests for inclusive/exclusive prices, discounts, fees, duplicated checkout paths, standard reset, held carts, and room carts in `__tests__/international-transport-sales-ui.test.js`
- [X] T021 [P] [US2] Write failing primary backend sale-contract tests for origin `SA`, non-`SA` destination, authoritative validation, product re-read, zero totals, immutable snapshot insert, open-shift preservation, and asynchronous ZATCA queueing in `__tests__/international-transport-sales.test.js`
- [X] T022 [P] [US2] Write failing device-capability tests proving primary IPC creation, secondary mutation unavailability, and secondary read/print/report projection parity in `__tests__/international-transport-branch-parity.test.js`

### Implementation for User Story 2

- [X] T023 [US2] Persist, normalize, and return `is_international_transport_service` in product create/update/list/get operations using parameterized queries in `src/main/products.js`
- [X] T024 [US2] Add the eligible-international-transport checkbox and zero-rated guidance to the RTL product form in `src/renderer/products/index.html`
- [X] T025 [US2] Bind the product eligibility flag across add, edit, reset, list, and validation flows in `src/renderer/products/renderer.js`
- [X] T026 [US2] Add a fixed visible origin-country value `SA`, origin place, destination, ISO destination-country code, shipment reference inputs, and qualified-only cart guidance to the international treatment panel in `src/renderer/sales/index.html`
- [X] T027 [US2] Route every cart/checkout calculation and fallback through one effective applied-rate path, preserve transport state in held/room carts, emit the contracted payload, and reset to standard after complete/cancel in `src/renderer/sales/renderer.js`
- [X] T028 [US2] Integrate shared validation into primary IPC `sales:create`, require origin country `SA`, re-read setting/products inside the transaction, authoritatively verify totals, and atomically persist sale/item snapshots before queuing ZATCA in `src/main/sales.js`
- [X] T029 [US2] Return `international_transport_zero_rate_can_mutate=false` and persisted international invoice fields from secondary read-only sales-init/invoice views without extending HTTP POST behavior in `src/main/api-server.js`
- [X] T030 [US2] Return normalized treatment, applied rate, reason, route, reference, and eligibility snapshots from sale/product read models in `src/main/sales.js` and `src/main/api-server.js`
- [X] T031 [US2] Add user-visible Arabic mappings for all contracted international-transport validation codes without swallowing backend details in `src/renderer/sales/renderer.js`

**Checkpoint**: User Story 2 passes independently with the feature enabled; all standard invoice regression tests remain unchanged.

---

## Phase 5: User Story 3 — Print and submit with a valid QR (Priority: P1)

**Goal**: Thermal and A4 invoices clearly show the zero-rated treatment and route, ZATCA XML uses category `Z` with the official reason, and a readable QR contains invoice total and VAT `0.00`.

**Independent Test**: Generate one international invoice, assert pre-sign XML category/rate/reason/totals, decode its QR, verify internal preview, thermal, A4, and each available export, reprint after changing settings, and prove QR failure blocks presentation readiness, WhatsApp delivery, and ZATCA transmission at the QR-required stage.

### Tests for User Story 3

- [X] T032 [P] [US3] Replace the zero-rate rejection expectation with failing `Z/0/VATEX-SA-34-1` invoice and credit-note mapping cases while retaining standard `S` regressions in `__tests__/zatca-direct/mapper.test.js`
- [X] T033 [P] [US3] Write failing XML reason-injection tests covering element order, escaping, idempotence, Z-only targeting, and fail-closed structure changes in `__tests__/zatca-direct/xml.test.js`
- [X] T034 [P] [US3] Add failing phase-one/phase-two QR tests that decode and verify grand total plus VAT `0.00` in `__tests__/zatca-direct/crypto-runtime.test.js`
- [X] T035 [P] [US3] Write failing internal-preview/thermal/A4/available-export source and DOM tests for sale-specific labels, route/reference, VAT row, stored QR preference, historical reprint, and per-channel render-failure blocking in `__tests__/international-transport-print.test.js`
- [X] T036 [P] [US3] Write failing router tests proving the legacy path emits an equivalent zero-rate contract or returns `LEGACY_ZATCA_ZERO_RATE_UNSUPPORTED` without submission in `__tests__/zatca-direct/router.test.js`

### Implementation for User Story 3

- [X] T037 [US3] Make invoice and credit-note mapping use the persisted treatment snapshot, emitting `S` for standard or `Z`, 0%, zero tax, and official reason metadata for international transport in `src/main/zatca/mapper.js`
- [X] T038 [US3] Implement the escaped, idempotent, Z-subtotal-only exemption-reason XML injector with explicit structural failures in `src/main/zatca/xml.js`
- [X] T039 [US3] Invoke zero-rate reason injection after XML generation and before hashing/signing while preserving asynchronous submission and stored signed QR behavior in `src/main/zatca/directService.js`
- [X] T040 [US3] Fail closed with `LEGACY_ZATCA_ZERO_RATE_UNSUPPORTED` by default and enable legacy zero-rate routing only behind a passing category/rate/reason/totals/QR equivalence contract in `src/main/local-zatca.js` and `src/main/zatca/router.js`
- [X] T041 [US3] Drive thermal invoice label, VAT `0.00`, route/reference, and QR visibility from the persisted sale snapshot and block readiness on QR failure in `src/renderer/sales/print.html`
- [X] T042 [US3] Apply the same sale-specific zero-rated display, stored QR preference, and fail-closed readiness rules to A4 output in `src/renderer/sales/print-a4.html`
- [X] T043 [US3] Ensure internal preview, thermal/A4 print, every available export, WhatsApp customer delivery, and ZATCA handoff surface QR errors and never send a document before its required QR-ready stage in `src/renderer/sales/renderer.js`

**Checkpoint**: User Story 3 passes independently and the selected ZATCA route produces or enforces a provably correct zero-rated document.

---

## Phase 6: User Story 4 — Reports and credit notes (Priority: P2)

**Goal**: Full/partial credit notes inherit the source invoice treatment, and daily/period reports distinguish signed standard supplies from signed zero-rated supplies.

**Independent Test**: Create standard and international invoices, issue full and partial credit notes, then verify zero VAT and inherited route/reason on the credits plus exact separate/netted totals in daily and period reports on primary and secondary reads.

### Tests for User Story 4

- [X] T044 [P] [US4] Write failing full/partial credit-note inheritance tests covering source snapshots, zero VAT, original linkage, stock restoration, and toggle-disabled refunds in `__tests__/international-transport-credit-notes.test.js`
- [X] T045 [P] [US4] Add failing treatment-aware signed aggregation cases for standard/zero-rated invoices and credits in `__tests__/report-accounting.test.js`
- [X] T046 [P] [US4] Add failing report detail/summary and primary/secondary parity cases keyed by persisted treatment rather than `vat_total = 0` in `__tests__/report-branch-parity.test.js` and `__tests__/report-item-sign-parity.test.js`

### Implementation for User Story 4

- [X] T047 [US4] Copy all sale/item tax and transport snapshots into full credit notes while preserving existing stock/payment linkage behavior in `src/main/sales.js`
- [X] T048 [US4] Make partial credit-note calculations use the source `tax_percent_applied`, inherit all snapshots, and persist VAT `0.00` for international transport in `src/main/sales.js`
- [X] T049 [US4] Add treatment-aware signed standard and zero-rated supply aggregation without inferring classification from amounts in `src/shared/report-accounting.js`
- [X] T050 [P] [US4] Display separate standard and zero-rated totals/badges and include them in daily report print/export data in `src/renderer/reports/daily.js` and `src/renderer/reports/daily.html`
- [X] T051 [P] [US4] Display separate standard and zero-rated totals/badges and include them in period report print/export data in `src/renderer/reports/period.js` and `src/renderer/reports/period.html`
- [X] T052 [US4] Add `tax_treatment` to detailed report queries and group treatment-sensitive summaries correctly for invoice/credit-note signs in `src/main/sales.js` and `src/main/api-server.js`
- [X] T053 [US4] Expose the inherited treatment and route on credit-note detail/reprint views without allowing callers to override it in `src/renderer/credit_notes/renderer.js`

**Checkpoint**: User Story 4 passes independently; report totals reconcile with persisted sales and credit notes in both device modes.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Prove regression safety, operational behavior, and release readiness across all stories.

- [ ] T054 [P] Add gated MySQL integration coverage for repeatable primary migrations, ENUM treatment, constitutional audit PK/actor FK, transactional rollback, and local sale/credit persistence under `RUN_INTEGRATION_TESTS=1` in `__tests__/international-transport-mysql.integration.test.js`
- [X] T055 [P] Add historical compatibility cases for legacy rows with zero VAT that must remain `standard` and must never be backfilled as international transport in `__tests__/international-transport-history.test.js`
- [X] T056 Compile new Tailwind classes with `npm run build:css` and verify only generated `src/renderer/tailwind-output.css` changes from the build command
- [X] T057 Run the focused suites and the full `npm test -- --runInBand` regression commands documented in `specs/003-international-transport-vat/quickstart.md`
- [ ] T058 Execute all four manual validation flows, enumerate and verify every available presentation/delivery channel, decode QR values, validate the direct ZATCA route in sandbox, and record results in `specs/003-international-transport-vat/quickstart.md`
- [ ] T059 Run the timed SC-001 administrator flow and SC-009 first-attempt cashier flow with unfamiliar authorized participants and record elapsed times/results in `specs/003-international-transport-vat/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 — Setup**: No dependency.
- **Phase 2 — Foundational**: Depends on Phase 1 and blocks all stories.
- **US1 (Phase 3)**: Depends on Phase 2.
- **US2 (Phase 4)**: Depends on Phase 2 for rules/schema and US1 for the saved availability toggle and selector shell.
- **US3 (Phase 5)**: Depends on US2 because XML, QR, and print consume persisted sale snapshots.
- **US4 (Phase 6)**: Depends on US2; it can run in parallel with US3 after the sale snapshot contract is stable.
- **Phase 7 — Polish**: Depends on every story included in the release.

### User Story Dependency Graph

```text
Setup -> Foundation -> US1 -> US2 -> US3
                            |
                            +-----> US4
US3 and US4 may proceed in parallel after US2
```

### Within Each User Story

1. Write the listed tests and confirm they fail for the intended missing behavior.
2. Complete schema/model work before transactional services.
3. Complete main-process behavior before renderer integration that consumes it.
4. Run the story tests and its independent manual test at the checkpoint.
5. Do not infer historical treatment from zero VAT and do not use `is_vat_exempt` for this feature.

### Parallel Opportunities

- T001 and T002 can run together.
- T005 and T006 can run together after T004 work is isolated; T008 follows T007 because the read-only projection must match the primary schema contract without creating it.
- Tests marked `[P]` in each story touch separate test files and can be authored together before implementation.
- US1 HTML (T015/T017) can run in parallel after its tests; renderer tasks remain ordered behind their markup/IPC contracts.
- US2 product UI/backend work can proceed separately from sales markup until payload integration.
- US3 mapper/XML/direct-service work and print-template work can proceed as two streams after their tests.
- US4 daily and period UI tasks T050/T051 can run together after aggregation T049.
- After US2, US3 and US4 can be assigned to separate implementers.

---

## Parallel Execution Examples

### User Story 1

```text
Task T011: settings persistence/authorization/audit tests
Task T012: settings and sales selector UI tests

After backend contract is stable:
Task T015: settings HTML
Task T017: sales selector HTML
```

### User Story 2

```text
Task T019: product eligibility contract tests
Task T020: renderer calculation/payload tests
Task T021: local backend sale tests
Task T022: branch parity tests
```

### User Story 3

```text
Task T032: mapper tests
Task T033: XML injector tests
Task T034: QR decode tests
Task T035: print template tests
Task T036: legacy router tests
```

### User Story 4

```text
Task T044: credit-note tests
Task T045: accounting aggregation tests
Task T046: report parity/detail tests

After T049:
Task T050: daily report UI
Task T051: period report UI
```

---

## Implementation Strategy

### Configuration MVP — User Story 1

1. Complete Setup and Foundational phases.
2. Implement US1 and verify default-off, permission, persistence, audit, and conditional visibility independently.
3. Demonstrate administration behavior without permitting production zero-rated sales yet.

### Operational MVP — All P1 Stories

1. Complete US1 for controlled availability.
2. Complete US2 for authoritative eligible invoice creation.
3. Complete US3 for correct ZATCA XML, QR, and printing.
4. Stop and validate the complete P1 flow before enabling the feature for customers.

US1 alone is independently testable but is not a releasable tax feature; production enablement requires US1–US3 together.

### Incremental Delivery

1. Setup + Foundation → shared rules and schema ready.
2. US1 → controlled setting and visibility.
3. US2 → correct zero-rated sales lifecycle.
4. US3 → electronic invoice, QR, and print compliance.
5. US4 → accounting reports and credit notes.
6. Polish → integration, historical, CSS, full regression, and sandbox evidence.

---

## Notes

- `[P]` means the listed files and prerequisites do not overlap; tasks editing `src/main/sales.js` are deliberately sequential.
- All SQL uses placeholders and shared pooled connections released in `finally`.
- Sensitive IPC obtains actor identity from the trusted main-process session and checks permissions.
- ZATCA submission remains asynchronous and no print/send path may declare readiness without a valid QR image.
- Standard VAT always comes from `app_settings.vat_percent`; only the controlled international treatment applies the explicit legal zero rate.
- Do not add feature mutation or schema logic to `api-server.js`; secondary devices receive only capability and persisted read projections in this release.
