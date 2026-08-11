# GUVEL General System v1.4.3

## Changes
1. Expanded ES/EN translation coverage across Users, Audit History, Data, Runs and dynamically generated labels.
2. Stabilized the top shell and page toolbar height/alignment so Dashboard, Runs and the other modules do not visually jump.
3. Added Light/Dark mode.
   - Stored in browser localStorage as `guvel_theme`.
   - No Supabase migration required.
   - Dark mode keeps GUVEL cyan/red identity and uses an industrial dark neutral palette.

## Deploy
Replace:
- index.html
- assets/

Keep:
- config.js

No SQL migration is required for v1.4.3.
