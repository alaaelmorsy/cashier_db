# Implementation Plan: International Transport at 0% VAT

**Branch**: `main` | **Date**: 2026-07-16 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-international-transport-vat/spec.md`

## Summary

Add an off-by-default primary-device setting that exposes a per-sale `International transport – 0% VAT` choice while leaving standard VAT as the default. Eligible products are explicitly marked as international-transport services. The main process remains authoritative: it validates origin country `SA`, a non-`SA` destination, a shipment reference, feature state, product eligibility, and zero-tax totals before persisting an immutable tax snapshot. Printing and ZATCA mapping use that snapshot, emit category `Z` with reason `VATEX-SA-34-1`, and keep a readable QR whose VAT total is `0.00`. Credit notes inherit the snapshot and reports separate zero-rated from standard supplies. Secondary devices receive the read model only in this release.

## Technical Context

**Language/Version**: JavaScript on Node.js 18-compatible runtime, Electron 28, HTML/CSS renderer  
**Primary Dependencies**: Electron IPC/preload bridge, `mysql2/promise`, `@talha7k/zatca` 0.11.1, QRCode, Express branch API  
**Storage**: MySQL 5.7+ with additive, idempotent schema upgrades  
**Testing**: Jest 30, pure unit tests plus source/contract and MySQL-backed integration tests where available  
**Target Platform**: Windows Electron desktop; feature mutations on the primary device, read/print/report parity on secondary devices  
**Project Type**: Desktop POS with Electron main/renderer processes and a branch HTTP compatibility layer  
**Performance Goals**: No perceptible change to cart calculation; validation and persistence remain within the existing sale transaction; period reports retain current response time with treatment/date indexing  
**Constraints**: Arabic RTL UI; renderer has no direct Node/database access; MySQL 5.7 compatibility; standard invoices must not regress; ZATCA generation stays asynchronous; historical invoices must not depend on current settings; all feature mutations use primary-device IPC; `api-server.js` remains read-only  
**Scale/Scope**: One settings toggle, product eligibility flag, sales and credit-note lifecycle, internal/thermal/A4/available-export presentation, direct ZATCA route, fail-closed legacy route, daily/period reporting, and secondary read parity

## Constitution Check

*GATE: Passed before Phase 0 and re-checked after Phase 1 design.*

- **Architecture — PASS**: UI changes stay in vanilla renderer code and privileged validation/database work stays behind preload IPC on the primary device. Secondary parity is read-only and does not add REST mutations.
- **Schema evolution — PASS**: all new fields are additive with safe defaults and are ensured idempotently on every existing bootstrap path; no destructive migration or historical inference is required.
- **Security and permissions — PASS**: the toggle mutation is a dedicated privileged operation bound to the invoking `webContents.id`, checked in the main process, recorded in an append-only audit table, and broadcast only after commit. Sale eligibility and totals are revalidated server-side.
- **Financial integrity — PASS**: `doc_type` remains `invoice|credit_note`; monetary calculations use decimal-safe existing conventions; the treatment/rate/reason/route are immutable sale snapshots; credit notes inherit the original snapshot.
- **ZATCA — PASS**: submission remains asynchronous. XML is completed with category `Z`, percentage `0`, and the official reason before signing; QR contains the persisted total and zero VAT.
- **API boundary — PASS**: no feature write or schema mutation is added to `api-server.js`; secondary devices only receive capability and invoice/report read fields. New zero-rate settings and invoices are primary-device IPC operations.
- **Testing — PASS**: business rules are extracted into Electron-independent helpers and covered by Jest; mapper/XML, refunds, reports, primary/secondary parity, printing, and QR failure behavior receive regression tests.
- **Post-design re-check — PASS**: data model and contracts preserve every gate above; no constitution exception is required.

## Project Structure

### Documentation (this feature)

```text
specs/003-international-transport-vat/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── ipc-api.md
└── tasks.md                  # generated later by /speckit-tasks
```

### Source Code (repository root)

```text
src/
├── main/
│   ├── settings.js          # toggle persistence, authorization and audit
│   ├── products.js          # eligible-service marker
│   ├── sales.js             # authoritative create/refund validation and snapshots
│   ├── api-server.js        # read-only capability and invoice/report projections
│   ├── preload.js           # narrow settings/product/sales contracts
│   ├── local-zatca.js       # legacy-route zero-rate handling or explicit fail-closed gate
│   └── zatca/
│       ├── mapper.js        # S/standard versus Z/zero-rated mapping
│       ├── directService.js # inject metadata before signing
│       └── xml.js           # idempotent zero-rate reason injection
├── renderer/
│   ├── settings/            # admin toggle
│   ├── products/            # eligibility checkbox
│   ├── sales/               # invoice selector, route fields and effective-rate calculation
│   └── reports/             # treatment-aware daily/period summaries
└── shared/
    ├── international-transport-tax.js # pure validation/calculation constants
    └── report-accounting.js           # treatment-aware signed aggregation

__tests__/
├── zatca-direct/            # mapper, XML and QR tests
├── report-accounting.test.js
├── report-branch-parity.test.js
├── sales-payload-structure.test.js
└── international-transport-*.test.js
```

**Structure Decision**: Extend the existing Electron single-project layout. A small shared, pure business-rule module keeps primary IPC validation deterministic, while secondary devices receive only read projections and all privileged orchestration remains in `src/main`.

## Implementation Strategy

1. Add shared constants and pure validators for ENUM treatments, fixed `SA` origin, non-`SA` destination, product eligibility, immutable snapshot creation, and zero-rated totals. Add idempotent primary-module migrations for settings, products, sales, sales items, the constitution-compliant audit log, and report index.
2. Add the authorized primary-device settings toggle, `webContents.id` session binding, post-commit settings broadcast, and product eligibility UI/contracts. Keep the toggle off and standard invoices selected by default; secondary capability remains read-only.
3. Add the sales selector and route inputs, drive every renderer calculation through one effective-rate helper, and revalidate/recalculate in the primary main process immediately before insert. Do not extend the REST mutation paths; secondary devices only consume the stored read model.
4. Make full and partial credit notes copy the original treatment snapshot. Update reports and read models to classify by persisted treatment rather than `vat_total = 0`.
5. Map standard sales to `S` and international transport to `Z/0/VATEX-SA-34-1`. Inject the missing reason elements before signing. Keep the legacy mediator fail-closed unless its contract test proves full category/reason/totals/QR equivalence.
6. Make internal preview, thermal, A4, available export, WhatsApp delivery, and ZATCA readiness gates sale-specific. Show the zero-rated label, route/reference and VAT `0.00`; never relabel it exempt. Fail closed wherever a valid QR is required.
7. Run unit, contract, read-parity, refund, report, XML/QR and presentation regressions, then execute the timed usability and manual flows in `quickstart.md`, including historical reprint after disabling the feature.

## Complexity Tracking

No constitution violations require justification.
