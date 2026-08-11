# GUVEL General System v1.4.3 — Patch

## Fixes
1. Production capture no longer sends the shift row UUID to Supabase. It sends the configured `shift_code` (A/B/C), which is what `register_production_run` validates. This fixes the `Shift is not configured` error when a valid shift such as `A · Primer Turno` exists.
2. Expanded ES/EN coverage for static and dynamically generated labels/messages across capture, master data, runs, data, audit, users, settings and dashboards.
3. Completed dark-mode styling for forms, edit panels, lists, traceability, run details, scanner, validation blocks, audit cards and nested surfaces so newly opened/created records remain readable.

## Supabase
No SQL migration is required for this patch.

The existing shift configuration is preserved. If your active shift is:
- Code: `A`
- Name: `Primer Turno`

the capture now submits `A`, not the UUID of that row.

## Deployment
Replace:
- `index.html`
- `assets/`

Keep your existing `config.js`.
