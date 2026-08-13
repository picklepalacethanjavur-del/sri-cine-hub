# Sri Cine Hub P1 V4

P1 implementation:
- Start/Return calendar popups with separate time selection
- Public availability + quote request
- Private internal rate card
- Staff quotation generation with itemized rates and discounts
- Serialized camera/accessory registry with QR + RFID fields
- Equipment kits
- New future reservation form with overlap checks
- Phone-camera QR scanning (BarcodeDetector where browser supports it) + manual QR fallback
- Checkout chain of custody: QR verification, camera hours, condition, mandatory photo
- Return workflow: hours, condition, photo, damage/late/other charges
- Final receipt generation at return
- P2 RFID-ready schema; no hardware dependency in P1

No digital agreement included.

Deploy:
1. Replace repository contents with this project, preserving `.env` only in Vercel (never commit secrets).
2. Push to main.
3. Vercel redeploys automatically.
4. Keep NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY configured.
