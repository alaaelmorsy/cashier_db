# Phase 1 Contracts: IPC and Internal API

## Compatibility rules

- Existing method names and standard-invoice payloads remain valid.
- `doc_type` remains `invoice|credit_note`.
- Unknown or missing treatment on a legacy read is normalized to `standard` only for display; new writes always send/store it.
- No feature mutation is added to HTTP. Primary-device IPC is the only supported path for changing the toggle or creating a new international-transport invoice. Secondary HTTP responses expose persisted fields for read/print/report only.

## Read settings

Existing `settings:get` and read-only `GET /api/settings` responses add:

```json
{
  "international_transport_zero_rate_enabled": false,
  "international_transport_zero_rate_can_mutate": false
}
```

Both values are normalized to boolean. On the primary IPC read, capability is true for an authenticated authorized context; on secondary HTTP it is always false.

## Change international-transport setting

Dedicated privileged IPC operation:

```text
settings:set_international_transport_zero_rate
```

Request:

```json
{
  "enabled": true
}
```

The main process resolves the authenticated user from a session bound to the invoking `event.sender.id`/`webContents.id`; actor identity is not accepted from renderer input. Login binds that sender, logout or sender destruction clears it, and the operation verifies the existing settings-management permission. This operation is unavailable on secondary devices.

Success:

```json
{
  "success": true,
  "enabled": true,
  "changed": true,
  "changed_at": "2026-07-16T12:00:00.000Z"
}
```

Errors: `AUTH_REQUIRED`, `PERMISSION_DENIED`, `PRIMARY_DEVICE_REQUIRED`, `INVALID_SETTING_VALUE`, `SETTINGS_SAVE_FAILED`. Setting update and audit insertion are atomic. After commit, main broadcasts `ui:settings_changed` with the normalized state to renderer windows.

## Product contracts

Existing create/update/list/get product contracts add:

```json
{
  "is_international_transport_service": true
}
```

Missing on legacy create/update defaults to false. The server normalizes to `0|1`; reads expose boolean. This field is not an alias for `is_vat_exempt`.

## Create sale

Existing `sales:create` request adds:

```json
{
  "doc_type": "invoice",
  "tax_treatment": "international_transport_zero_rate",
  "transport": {
    "origin": "Riyadh",
    "origin_country_code": "SA",
    "destination": "Dubai",
    "destination_country_code": "AE",
    "shipment_reference": "CMR-2026-1042"
  },
  "items": [
    { "product_id": 42, "qty": 1, "price": 1000 }
  ]
}
```

Client must calculate/display VAT `0.00`, but the primary main process re-reads settings/products and authoritatively validates and calculates the persisted snapshot. `origin_country_code` must be `SA`. The client does not send an arbitrary reason/category. This treatment is unavailable for secondary-device mutation in the first release.

For standard invoices, omit `transport` and use or omit `tax_treatment: "standard"`; current behavior remains the default.

### Validation errors

| Code | Meaning |
|---|---|
| `INTERNATIONAL_TRANSPORT_DISABLED` | Toggle is off at save time |
| `TRANSPORT_ORIGIN_REQUIRED` | Saudi origin label missing |
| `TRANSPORT_ORIGIN_MUST_BE_SA` | Origin country code is not `SA` |
| `TRANSPORT_DESTINATION_REQUIRED` | Destination label/country missing |
| `TRANSPORT_DESTINATION_MUST_BE_OUTSIDE_SA` | Country code is `SA` |
| `SHIPMENT_REFERENCE_REQUIRED` | Supporting reference missing |
| `INELIGIBLE_INTERNATIONAL_TRANSPORT_ITEM` | At least one current product is not marked eligible |
| `INTERNATIONAL_TRANSPORT_MIXED_TAX_NOT_SUPPORTED` | Cart contains an unsupported mixed treatment |
| `SALE_TOTAL_MISMATCH` | Submitted totals differ from authoritative calculation |
| `PRIMARY_DEVICE_REQUIRED` | This treatment was requested from a secondary device |
| `LEGACY_ZATCA_ZERO_RATE_UNSUPPORTED` | Legacy ZATCA route cannot prove equivalent Z/reason output |

Success response keeps the existing shape and returned sale ID/invoice number. Subsequent reads include the immutable snapshot.

## Sale read model

Existing IPC list/detail/get-by-number and read-only HTTP invoice responses add:

```json
{
  "tax_treatment": "international_transport_zero_rate",
  "tax_percent_applied": "0.00",
  "zero_rate_reason_code": "VATEX-SA-34-1",
  "zero_rate_reason": "The international transport of Goods",
  "transport_origin": "Riyadh",
  "transport_origin_country_code": "SA",
  "transport_destination": "Dubai",
  "transport_destination_country_code": "AE",
  "shipment_reference": "CMR-2026-1042"
}
```

Amounts retain existing string/decimal conventions. Sensitive supporting-document content is not introduced; only its reference is returned.

## Credit notes

Existing full and partial credit-note requests do not accept a caller-selected treatment. The server loads the original sale and copies all treatment/route/reason fields. A zero-rated source produces VAT `0.00` and the same category/reason. Disabling the toggle does not block a linked credit note.

## Reports

Treatment-aware summary adds:

```json
{
  "standard_supply_total": "1500.00",
  "zero_rated_supply_total": "800.00"
}
```

Detailed item rows add `tax_treatment`. Invoice rows are positive and credit-note rows negative under the existing sign convention.

## Print and QR contract

- Internal preview, thermal, A4, and available export receive the persisted sale read model.
- International treatment always shows its 0% label, VAT row `0.00`, route/reference, and a QR independent of the current global setting.
- Stored signed QR is preferred; fallback follows existing approved policy and encodes grand total plus VAT `0.00`.
- Renderer signals readiness only after a QR image has loaded successfully. Base64 text is not a valid visual fallback. Failure returns a visible actionable error and blocks internal-ready state, thermal/A4 print, available export, WhatsApp customer delivery, and ZATCA transmission at the stage where the QR is required.

## ZATCA mapper/XML contract

Standard documents remain category `S` at their snapshotted rate. International documents emit category `Z`, percent `0`, tax amount `0`, and VAT breakdown reason code `VATEX-SA-34-1`. XML reason insertion occurs before signing, is idempotent, escapes text, targets only `Z` tax subtotals, and fails closed on unexpected structure.

The legacy mediator rejects this treatment with `LEGACY_ZATCA_ZERO_RATE_UNSUPPORTED` by default. It may be enabled only after contract tests prove category, rate, reason, totals, and QR equivalence to the direct route.
