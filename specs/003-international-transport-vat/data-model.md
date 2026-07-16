# Phase 1 Data Model

## Constants

- `STANDARD = 'standard'`
- `INTERNATIONAL_TRANSPORT_ZERO_RATE = 'international_transport_zero_rate'`
- ZATCA category: `Z`
- ZATCA reason code: `VATEX-SA-34-1`
- Applied VAT percent: `0.00`

These are controlled application values, not free-form user input.

## app_settings

| Field | Type | Rules |
|---|---|---|
| `international_transport_zero_rate_enabled` | `TINYINT(1) NOT NULL DEFAULT 0` | Controls availability for new invoices only |

The setting does not alter existing invoices and does not replace `vat_percent`.

## settings_audit_log

| Field | Type | Rules |
|---|---|---|
| `id` | `INT AUTO_INCREMENT PRIMARY KEY` | Append-only identity, matching project table conventions |
| `setting_key` | `VARCHAR(100) NOT NULL` | Fixed to the feature setting for this operation |
| `old_value` | `VARCHAR(255) NOT NULL` | Normalized `0` or `1` |
| `new_value` | `VARCHAR(255) NOT NULL` | Normalized `0` or `1` |
| `created_by_user_id` | `INT NULL` | Verified actor; FK to `users.id` with `ON DELETE SET NULL` |
| `created_by_user_name` | `VARCHAR(255) NOT NULL` | Immutable display/audit snapshot if the user is later deleted |
| `created_at` | `DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP` | Server/database time for the audited transition |

Indexes: `(setting_key, created_at)` and `created_by_user_id`. Do not insert a row when the normalized value did not change.

## products

| Field | Type | Rules |
|---|---|---|
| `is_international_transport_service` | `TINYINT(1) NOT NULL DEFAULT 0` | Explicit eligibility marker; independent of `is_vat_exempt` |

Only authorized product-management users can change it. Historical invoices do not derive eligibility from the current product row.

## sales

| Field | Type | Rules |
|---|---|---|
| `tax_treatment` | `ENUM('standard','international_transport_zero_rate') NOT NULL DEFAULT 'standard'` | Explicit controlled status values required by the constitution |
| `tax_percent_applied` | `DECIMAL(5,2) NOT NULL` | Snapshot of configured standard rate or `0.00` |
| `zero_rate_reason_code` | `VARCHAR(32) NULL` | Required and fixed for international treatment |
| `zero_rate_reason` | `VARCHAR(255) NULL` | Official display/XML text snapshot |
| `transport_origin` | `VARCHAR(255) NULL` | Required, trimmed; Saudi place label |
| `transport_origin_country_code` | `CHAR(2) NULL` | Required and fixed to `SA` for international treatment |
| `transport_destination` | `VARCHAR(255) NULL` | Required, trimmed; human-readable destination |
| `transport_destination_country_code` | `CHAR(2) NULL` | Uppercase ISO alpha-2; required and must not equal `SA` |
| `shipment_reference` | `VARCHAR(128) NULL` | Required, trimmed transport/shipment document reference |

Index: `(tax_treatment, created_at)`. Keep `doc_type` as `invoice` or `credit_note`.

### International invoice invariants

1. Feature setting is enabled at initial invoice save time.
2. Origin is present, origin country is exactly `SA`, destination and non-`SA` destination country code are present, and shipment reference is present.
3. Every line resolves to a product currently marked eligible.
4. `tax_percent_applied = 0.00`, `vat_total = 0.00`, and the official reason fields match the controlled constants.
5. Net, discounts/fees, grand total, tenders, and change satisfy the existing decimal/rounding invariants with no standard-VAT extraction from inclusive prices.
6. All snapshot fields are written in the same transaction before ZATCA auto-submission is queued.

### Standard invoice invariants

Treatment is `standard`; applied rate is snapshotted from `app_settings.vat_percent`; international route/reason fields are null. Enabling the feature does not change this default.

## sales_items

| Field | Type | Rules |
|---|---|---|
| `is_international_transport_service_snapshot` | `TINYINT(1) NOT NULL DEFAULT 0` | Audit snapshot copied after backend product lookup |

Do not reuse `is_vat_exempt`; an eligible line in this feature is zero-rated, not exempt.

## Credit-note relationship and transition

```text
standard invoice -> standard full/partial credit note
international zero-rate invoice -> international zero-rate full/partial credit note
```

The credit note copies treatment, rate, reason, origin, origin country code, destination, destination country code, shipment reference, and item eligibility snapshots from the original. It never requires the feature to remain enabled and never re-evaluates current product eligibility. Existing original-invoice linkage remains authoritative.

## Setting state transition

```text
disabled (default) --authorized enable--> enabled
enabled --authorized disable--> disabled
```

Each changed transition updates the singleton setting and appends an audit row atomically. Disabling prevents new saves and hides the selector; it does not alter display, reprint, reporting, refunds, or ZATCA retry of historical documents.

After commit, the main process broadcasts `ui:settings_changed` with the normalized feature state. Only renderer windows whose `webContents.id` has an authenticated session may invoke the mutation. Logout or destruction of that `webContents` clears its session binding.

## Device capability

- Primary device: authorized setting mutation and new international-transport sale mutation are available through IPC.
- Secondary device: zero-rate mutation capability is false; read-only invoice/report responses include the persisted snapshot for display, print, and reporting.
- `api-server.js` does not create/alter feature schema and receives no new feature mutation behavior.

## Read models

- Invoice list/detail and read-only API include treatment, applied rate, reason, route, and shipment reference.
- Report detail includes `tax_treatment`.
- Report summary returns signed `standard_supply_total` and `zero_rated_supply_total`; credit notes reduce their source category.
- Print models use persisted fields only and expose a derived `isInternationalTransportZeroRate` predicate.

## Migration rules

- All columns are additive and idempotently ensured on primary, eager/bootstrap, reset/create, and internal branch API paths.
- Historical sales default to `standard`; never backfill based on `vat_total = 0`.
- Historical sales should receive a safe `tax_percent_applied` backfill from their stored amounts only when unambiguous; otherwise retain a documented legacy value while `tax_treatment = standard`. New records always store it explicitly.
- `tax_treatment` uses the constitution-required ENUM values. Any future treatment requires an explicit guarded ENUM migration and corresponding application validation update.
