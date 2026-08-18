# Sri Cine Hub V6.1 — Checkout Scan Hotfix

- QR/manual codes are normalized before matching.
- Extracts `SCH-CAM-*` or `SCH-ACC-*` from QR payloads/URLs.
- Manual code entry works with Enter or Use code.
- Shows required equipment with VERIFIED/PENDING status.
- Records matched QR/manual scans in `asset_scan_events`.
- Adds audited Manual checkout override for damaged/unreadable QR labels.
- Override requires a reason and records missing verification in the audit table.
- Existing checkout evidence/hours workflow is retained.
