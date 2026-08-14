# Sri Cine Hub V5.2 — Public Equipment Picker

Changes:
- Replaces camera-only availability with **Select Equipment**.
- Public availability now covers cameras plus public accessories/equipment.
- Search across equipment name, category, brand and model.
- Category filters and category-grouped inventory list.
- Physical duplicates such as `C-Stand #1...#25` are grouped publicly as `C-Stand` with available quantity.
- Customer never sees internal asset codes, QR IDs, serial numbers or rates.
- Quantity +/- controls select the required number of available serialized assets behind the scenes.
- Sticky selected-items tray with Clear, View Selection and Continue.
- Continue jumps to contact and notes.
- Free-text field renamed **Anything else you need?**.
- Quote submission now sends both camera IDs and accessory IDs through `submit_quote_request_v2`.

Supabase support:
- `public_equipment_availability(start,end)` was applied to project `ucqjgavwncpwrjrmtkfr`.
- Existing `submit_quote_request_v2` is used for cameras + accessories + kits.

Push the contents of this folder to the repository root.
