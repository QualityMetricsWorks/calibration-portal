# Production Traceability Design

### Scanned barcode conventions supported
- Part: `871276PSP` or `NP:871276PSP`
- Lot: `250807-A01` or `LOT:250807-A01`
- Quantity: `600` or `QTY:600`

### System-owned values
Users do not enter:
- Date
- Time
- Shift

Supabase calculates these values at confirmation using company timezone and shift schedules.

### Default shifts created by migration
- A: 06:00–14:00
- B: 14:00–22:00
- C: 22:00–06:00

These are data-driven in `shift_schedules` and can be changed later per company.

### Partial logic
One open partial per:
Part + Operation + Machine + Date + Shift.

Partial quantity is cumulative. It can increase but not decrease.
A completed capture on the same context finalizes the partial, preventing duplicate production.
