# GUVEL General System — v0.5.0

## Major release
GUVEL Scrap evolves into **GUVEL General System** and introduces a production traceability workflow designed to reduce manual-selection errors.

## New production flow
1. Scan Part Number barcode.
2. Scan Lot.
3. Scan Quantity.
4. Confirm Operation + linked Machine.
5. Select Supervisor + Operator from controlled Personnel catalog.
6. Preview + validation.
7. Confirm.
8. Supabase assigns server timestamp, local production date and shift automatically.

## Manual / partial fallback
Manual capture remains available. The database enforces a maximum of one open partial per:
`Part Number + Operation + Machine + Production Date + Shift`.

If a partial already exists, a new partial submission updates its cumulative quantity instead of creating duplicate production. A completed scan can finalize the same partial.

## Barcode
Part Number detail now renders a Code 128 barcode whose payload is exactly the Part Number (no URL).
Labels generated outside GUVEL also work if the barcode payload matches the Part Number.

## Personnel
New controlled personnel catalog:
- Employee Number
- Full Name
- Operator
- Supervisor
- Both

## Camera
Camera scanning uses `html5-qrcode`. GitHub Pages is HTTPS, so browser camera permissions can be used. USB barcode readers continue to work as keyboard input.

## Before uploading
Run `sql/migrate_to_v0.5.0_traceability.sql` once in Supabase SQL Editor.

Then upload:
- `index.html`
- `assets/`
- `config.js`

No need to recreate the Supabase project.
