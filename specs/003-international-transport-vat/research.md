# Phase 0 Research: International Transport at 0% VAT

## Decision 1: Model this as zero-rated, not exempt or out of scope

**Decision**: Use tax treatment `international_transport_zero_rate`, VAT category `Z`, rate `0`, and reason code `VATEX-SA-34-1` for qualifying transport of goods from Saudi Arabia to a destination outside Saudi Arabia.

**Rationale**: Article 34 of the Saudi VAT Implementing Regulations treats qualifying international transport as zero-rated. The ZATCA XML implementation standard identifies international transport of goods with `VATEX-SA-34-1`; a zero-rated VAT breakdown requires a reason code.

**Alternatives rejected**: Reusing `products.is_vat_exempt`, using category `E`, or treating the invoice as outside scope would misstate the legal treatment. Inferring it from `vat_total = 0` cannot distinguish legacy, exempt, or accidentally zero invoices.

**Sources**: [ZATCA VAT Implementing Regulations, Article 34](https://zatca.gov.sa/en/RulesRegulations/Taxes/Documents/Implmenting%20Regulations%20of%20the%20VAT%20Law_EN.pdf), [ZATCA Electronic Invoice XML Implementation Standard](https://zatca.gov.sa/ar/E-Invoicing/SystemsDevelopers/Documents/20220624_ZATCA_Electronic_Invoice_XML_Implementation_Standard_vF.pdf), [ZATCA E-Invoice Specifications](https://www.zatca.gov.sa/en/e-invoicing/systemsdevelopers/pages/e-invoice-specifications.aspx)

## Decision 2: Persist an immutable per-sale tax snapshot

**Decision**: Keep `sales.doc_type` unchanged and add a constitution-required treatment ENUM, applied rate, official reason, fixed `SA` origin country, non-`SA` destination country, route labels, and shipment reference to every invoice/credit note.

**Rationale**: Current settings and product metadata can change after sale. Printing, ZATCA resubmission, refunds, and reports need the original facts without recomputation.

**Alternatives rejected**: Adding a new `doc_type` would break invoice/credit-note filters. Deriving treatment from the current global VAT setting or from a zero amount would corrupt historical behavior.

## Decision 3: Mark eligible products explicitly and reject mixed invoices

**Decision**: Add `products.is_international_transport_service`, require every sale line in the zero-rated invoice to reference an eligible product, and snapshot that eligibility on `sales_items` for audit.

**Rationale**: The first release does not support mixed tax categories. A backend product lookup prevents a forged renderer payload from applying 0% to local supplies.

**Alternatives rejected**: Product category names are mutable and unreliable. The existing exemption flag has different tax semantics. Trusting a request flag is insufficient.

## Decision 4: Keep zero-rate mutations on primary-device IPC

**Decision**: Extract Electron-independent validation/snapshot functions and call them from primary-device `sales:create` inside the transaction. Do not extend the REST compatibility server with zero-rate setting or sale mutations. Secondary devices may read, report, and print the persisted fields but do not expose this invoice type for creation in the first release.

**Rationale**: The constitution requires mutations through IPC and requires `api-server.js` to remain read-only. Primary-side validation still closes the race where the feature is disabled while a cart is open.

**Alternatives rejected**: Renderer-only validation is tamperable. Extending the existing HTTP insert would deepen a known constitutional violation. Full remote mutation support requires a separate architecture decision.

## Decision 5: Use a dedicated privileged toggle mutation with append-only audit

**Decision**: Expose a narrow primary-device setting mutation. Bind the authenticated user to the invoking `webContents.id`, validate the existing settings-management permission in the main process, update the flag, append old/new values and actor in one transaction using `id INT` and `created_by_user_id INT` with explicit `ON DELETE SET NULL`, and broadcast `ui:settings_changed` after commit.

**Rationale**: Existing settings save authorization is mostly UI-side and the generic timestamp changes for unrelated settings. FR-018 and FR-019 require authoritative permission checking and feature-specific history.

**Alternatives rejected**: Extending only the generic `settings:save` payload would leave spoofable identity and an ambiguous audit timestamp. A process-global current-user variable is unsafe across windows. Logging only the last change would not provide an audit trail.

## Decision 6: Complete zero-rated XML before signing

**Decision**: Update the direct mapper to emit `Z` and 0%, then use an idempotent repo-local XML helper to add `TaxExemptionReasonCode` and its official text to each zero-rated VAT breakdown before hashing/signing. The helper fails closed if expected XML structure is absent.

**Rationale**: `@talha7k/zatca` accepts category `Z` in types but version 0.11.1 does not serialize the exemption-reason elements. The current pipeline already applies compatible XML transforms before signing.

**Alternatives rejected**: Editing `node_modules` is not durable. Carrying a broad dependency fork is disproportionate for the missing fields. Injecting after signing would invalidate the hash/signature.

## Decision 7: Keep QR invoice-specific, including VAT 0.00

**Decision**: Prefer the stored signed ZATCA QR, retain the existing valid fallback policy, and gate display by the persisted sale treatment/status rather than global VAT or `vat_total > 0`. QR/render failures block internal preview readiness, thermal/A4 printing, available export, WhatsApp customer delivery, and ZATCA transmission at the stage where a valid QR is required.

**Rationale**: QR tag 5 can validly contain `0.00`. Current templates accidentally depend on global VAT and can mark Base64 fallback text as ready.

**Alternatives rejected**: Hiding QR when VAT is zero contradicts the requirement. Generating from current settings makes reprints unstable.

## Decision 8: Preserve treatment on full and partial credit notes

**Decision**: Copy all tax and route snapshot fields from the source invoice. Partial-refund math uses the source applied rate rather than the current global setting.

**Rationale**: The current partial return path recalculates with global VAT and would add 15% to a zero-rated return.

**Alternatives rejected**: Re-evaluating current eligibility could make a credit note inconsistent with its legally linked invoice.

## Decision 9: Report by treatment, not amount

**Decision**: Add treatment-aware signed aggregation for invoice/credit-note rows and expose standard and zero-rated supply totals separately in daily and period reports. Include treatment in detailed rows and read-only invoice APIs.

**Rationale**: A zero VAT amount alone is not a safe classification key, and credit notes must net with the correct sign.

**Alternatives rejected**: A UI-only label would not provide auditable totals. Grouping only by product cannot split transactions across treatments.

## Decision 10: Legacy ZATCA path must be equivalent or fail closed

**Decision**: Fail closed for this treatment on the legacy Java mediator by default. Enable it only after a contract test proves equivalent category `Z`, rate `0`, reason `VATEX-SA-34-1`, totals, and QR output; otherwise instruct the operator to use the direct route.

**Rationale**: The legacy builder currently hardcodes standard-rate assumptions. Silently submitting it would be incorrect.

**Alternatives rejected**: Sending a category `S` invoice with zero amounts is not acceptable. Silent fallback is unsafe.
