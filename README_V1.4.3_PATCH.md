# GUVEL General System v1.4.3

## Performance / responsiveness
- Master-data mutations now update the local application state immediately after Supabase confirms the write.
- Production capture updates local production state without a full database reload.
- Scrap and downtime events update local state immediately.
- Navigation to Runs no longer triggers the full `loadAll()` query bundle every time.
- This removes the previous need to press Refresh repeatedly after adding machines, defects, downtime reasons, operations, shifts, etc.

## Ordering
- Data is loaded and rendered newest-first by `created_at`.
- Production, Quality/Scrap, Maintenance/Downtime, Clients, Parts, Machines, Personnel, Operations, Defects, Shifts and related master-data lists now follow the same newest-first principle where timestamps exist.

## Dark mode
- Completed dark-mode styling for Users, Runs, nested cards, tables, role cards, run details and other secondary surfaces.

## ES / EN
- Expanded translation coverage, including the Users module and common navigation, role, status, CRUD and operational labels.

## Catalog
- Reduced the defect/downtime entry form footprint to keep the catalog screen denser and more business-oriented.

## Supabase
No SQL migration is required.
Keep the existing `config.js`.
