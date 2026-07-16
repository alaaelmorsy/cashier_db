# Phase 1 Quickstart and Verification

## Prerequisites

1. Configure the repository `.env` for a disposable MySQL database.
2. Install dependencies with `npm install` if needed.
3. Use an administrator account with settings and product-management permissions.
4. Keep a QR decoder available and use ZATCA sandbox credentials only for integration validation.

## Automated checks

Run the focused suites during implementation:

```powershell
npx jest --runInBand __tests__/international-transport-tax.test.js
npx jest --runInBand __tests__/zatca-direct/mapper.test.js __tests__/zatca-direct/xml.test.js __tests__/zatca-direct/crypto-runtime.test.js
npx jest --runInBand __tests__/report-accounting.test.js __tests__/report-branch-parity.test.js
npx jest --runInBand __tests__/sales-payload-structure.test.js __tests__/international-transport-print.test.js
```

Then run the full regression suite:

```powershell
npm test -- --runInBand
```

Expected: no test depends on importing Electron into pure business-rule tests, normal 15% invoice tests remain unchanged, primary IPC mutation cases pass, and secondary read-only projections preserve the same stored fields without adding feature writes.

### Automated execution record — 2026-07-16

- `npm run build:css`: passed.
- Focused international transport, ZATCA, print, sales, credit-note, and report suites: passed.
- `npm test -- --runInBand`: 49 suites and 375 tests passed after the checkout-visibility regression fix.
- MySQL integration, live Electron UI, ZATCA sandbox, and timed participant checks remain release-gate manual work and are not claimed by this record.

## Manual flow 1: Default and permissions

1. Start with a migrated database and open Sales: the international type is absent and standard remains selected.
2. Attempt to change the setting with a user lacking settings-management permission: save is rejected and no audit row is created.
3. Enable it as an authorized administrator, restart the app, and verify the setting persists and the type appears.
4. Verify one audit row contains old/new value, verified actor, and change time. Saving the same value again must not create a duplicate transition row.
5. Keep Sales open in another renderer window, change the setting, and verify `ui:settings_changed` updates visibility only after the transaction commits.
6. Log in as two different users in separate renderer senders and verify each audit entry is attributed to the invoking `webContents` session; logout/destruction must clear that binding.

## Manual flow 2: Eligibility and calculations

1. Mark one product as an international-transport service and leave another unmarked.
2. Create a standard invoice for the marked product: it must still use standard VAT.
3. Select international transport. Confirm origin country is fixed to `SA`, then enter the Saudi origin place, non-Saudi country code/destination, and shipment reference.
4. Confirm inclusive prices are not divided by 1.15, VAT is `0.00`, and net/grand totals reconcile.
5. Try missing fields, an origin country other than `SA`, destination `SA`, an unmarked product, and a mixed cart: each must be blocked by both UI and backend with the documented code.
6. Disable the setting while a cart is open, then save: backend must reject it and request standard treatment.

## Manual flow 3: Print, XML and QR

1. Complete an eligible invoice and wait for the normal asynchronous ZATCA processing state.
2. Inspect generated XML before submission/signature tests: lines and breakdown use `Z`, percentage `0`, and reason `VATEX-SA-34-1`; totals show tax `0.00`.
3. Check internal preview, thermal print, A4 print, and every export option currently exposed by Sales. Each must show `نقل دولي – ضريبة 0%`, VAT `0.00`, origin/destination/reference, and a clear QR.
4. Decode QR and match seller, VAT number, timestamp, grand total, and tax `0.00` to the invoice.
5. Simulate QR image-generation/load failure: internal-ready state, thermal/A4 printing, available export, WhatsApp delivery, and ZATCA transmission at the QR-required stage are blocked with an actionable message; Base64 text is not printed.

## Manual flow 4: History, refunds and reports

1. Disable the feature and change the global VAT rate in a test database.
2. Reopen and reprint the earlier invoice: its treatment, 0%, route, reason, totals and QR remain unchanged.
3. Create full and partial credit notes: both inherit treatment and route, remain at VAT `0.00`, and reference the original invoice.
4. Open daily and period reports containing standard and international invoices plus credit notes. Verify separate standard/zero-rated totals and correct signed netting.
5. Repeat reads from a secondary device and read-only invoice API; fields and report classifications must match primary mode.
6. Verify the secondary device does not show the toggle or new-invoice treatment and cannot invoke either feature mutation, while historical display/print/report remains available.

## Timed acceptance flow

1. Recruit at least one authorized administrator unfamiliar with the feature. Start timing when the Settings section opens; enable or disable and save. Record pass only when confirmation appears within 30 seconds.
2. Give a newly authorized cashier only the in-screen guidance for at most two minutes. Record whether the first international invoice attempt succeeds with all required data and no correction cycle.
3. Record elapsed time, first-attempt result, device role, and any confusing label in this guide's execution notes. Both SC-001 and SC-009 require 100% of the acceptance participants to pass before release.

## Release gate

Do not release until the direct ZATCA route proves valid `Z/0/VATEX-SA-34-1` XML in sandbox. The legacy mediator stays fail-closed with `LEGACY_ZATCA_ZERO_RATE_UNSUPPORTED` unless its contract test independently proves category, rate, reason, totals, and QR equivalence.
