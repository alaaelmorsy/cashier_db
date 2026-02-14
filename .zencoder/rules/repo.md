# Repository Overview

- Name: pos1
- Type: Electron desktop app (Node.js + MySQL)
- Entry: src/main/main.js
- Start: npm start (electron .)

## Backend (Main process)
- Database: MySQL (mysql2/promise), database ensured/created via src/db/connection.js
- IPC modules:
  - users, permissions
  - products (with category, is_tobacco, operations mapping)
  - operations, product_operations
  - inventory + BOM
  - rooms, drivers, kitchen
  - sales, sales_items (support doc_type invoice/credit_note)
  - purchases
  - types (main_types)
  - offers, coupons, customer_pricing
  - reports endpoints via IPC from renderer

### Key sales report IPC
- sales:items_summary(from,to) -> SUM qty and amount per product
- sales:items_detailed(from,to,only_tobacco) -> detailed line items joined with sales (invoice_no, created_at, doc_type, payment_method) and products (category, is_tobacco)

## Frontend (Renderer)
- Reports under src/renderer/reports/
- Types report (types.html/types.js):
  - Shows summary by category
  - Shows per-category product breakdown
  - Tobacco section: now includes summary by (category, operation_name) and detailed rows with date, invoice number, doc type, product, category, operation, qty, price, total

## Notable behaviors
- Product categories sourced from main_types names
- Sub-type is represented by operation (operation_name) per product (large/small etc.)
- Credit notes are represented in sales with doc_type='credit_note' and are included in detailed report

## Run/Dev
- npm install
- npm start (requires MySQL configured via .env)

## .env
- DB_HOST, DB_PORT, DB_USER, DB_PASS, DB_NAME