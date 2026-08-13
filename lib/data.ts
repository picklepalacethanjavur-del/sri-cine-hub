import type { Booking, EquipmentItem } from "./types";

export const equipment: EquipmentItem[] = [
  { id: "arri-cameras", name: "ARRI Cameras", category: "Cameras", description: "ARRI cinema camera packages for feature, commercial and high-end digital productions.", featured: true },
  { id: "red-helium", name: "RED Helium (DCSM2) 8K", category: "Cameras", description: "High-resolution RED cinema body for commercial and narrative work." },
  { id: "red-gemini", name: "RED Gemini 5K", category: "Cameras", description: "Dual-sensitivity RED platform suited for controlled and low-light productions." },
  { id: "red-komodo", name: "RED Komodo 6K", category: "Cameras", description: "Compact cinema camera package for gimbal, vehicle and lightweight builds." },
  { id: "sony-fx3", name: "Sony FX3 4K", category: "Cameras", description: "Compact full-frame cinema camera for run-and-gun and small crew productions." },
  { id: "canon-r5", name: "Canon R5", category: "Cameras", description: "High-resolution hybrid camera package." },
  { id: "sony-a7s3", name: "Sony A7S III", category: "Cameras", description: "Low-light capable full-frame production camera." },
  { id: "ultra-prime", name: "Ultra Prime", category: "Lenses", description: "Cinema prime lens set. Exact focal lengths subject to availability.", featured: true },
  { id: "cp3-cp2", name: "CP3 / CP2 Zoom", category: "Lenses", description: "Cinema lens options for flexible production packages." },
  { id: "otus", name: "Otus", category: "Lenses", description: "Premium still/cine-oriented optical package." },
  { id: "alura", name: "Alura", category: "Lenses", description: "ARRI/FUJINON cinema zoom option." },
  { id: "hr", name: "HR", category: "Lenses", description: "Lens package; exact focal lengths confirmed at quote stage." },
  { id: "canon-lens", name: "Canon Lens", category: "Lenses", description: "Canon lens options for EF/RF camera builds." },
  { id: "gmaster", name: "Sony G-Master Lens", category: "Lenses", description: "Sony G Master lens options for E-mount camera packages." },
  { id: "tokina", name: "Tokina 11–16", category: "Lenses", description: "Wide-angle zoom option." },
  { id: "micro", name: "100 Micro Lens", category: "Lenses", description: "Macro lens option for product and detail work." },
  { id: "zeiss", name: "Carl Zeiss", category: "Lenses", description: "Zeiss lens options subject to package configuration." },
  { id: "samyang", name: "Samyang", category: "Lenses", description: "Prime lens options for lightweight production packages." },
  { id: "m-series", name: "M40 / M18 / M8", category: "Lights", description: "High-output cinema lighting options.", featured: true },
  { id: "skypanel", name: "SkyPanel S60", category: "Lights", description: "ARRI LED softlight for studio and location work." },
  { id: "4bank", name: "4 Bank LED", category: "Lights", description: "Soft LED fixture options in multiple sizes." },
  { id: "pavo", name: "RGB Pavo Tube", category: "Lights", description: "RGB tube lighting for practicals, effects and accent work." },
  { id: "aputure", name: "Aputure 1200d / 600c / 300c", category: "Lights", description: "Aputure high-output LED fixtures for production use." },
  { id: "forza", name: "Forza 500 / Forza 60B", category: "Lights", description: "Nanlite Forza fixture options." },
  { id: "nucleus", name: "Wireless Nucleus M / N", category: "Accessories", description: "Wireless follow focus systems." },
  { id: "hollyland", name: "Hollyland Mars", category: "Accessories", description: "Wireless video transmission options." },
  { id: "crane", name: "Crane 3S Pro", category: "Accessories", description: "Stabilization/gimbal package." },
  { id: "lapel", name: "Lapel Mic E4", category: "Accessories", description: "Lapel microphone option." },
  { id: "wireless-mic", name: "Wireless S02 Mic", category: "Accessories", description: "Wireless microphone option." },
  { id: "track", name: "Track & Trolley", category: "Grip", description: "Track and trolley grip package." },
  { id: "slider", name: "Slider", category: "Grip", description: "Camera slider options." },
  { id: "grip-kit", name: "C-Stands / Flags / Frames / Apple Boxes", category: "Grip", description: "Core grip equipment and rigging support." },
  { id: "tempo", name: "Tempo Traveller with 40KV Genset", category: "Transport", description: "Production transport with generator support." },
  { id: "eeco", name: "Eeco Vehicle", category: "Transport", description: "Compact production transport." },
  { id: "genset", name: "7KV / 45KV Genset Options", category: "Genset", description: "Generator options with production transport configurations." },
  { id: "editing", name: "Editing Studio", category: "Post Production", description: "Editorial suite for post-production workflows.", featured: true },
  { id: "dubbing", name: "Dubbing Studio", category: "Post Production", description: "Dubbing and voice recording facility." },
  { id: "di", name: "DI Studio", category: "Post Production", description: "Digital intermediate and grading facility." },
  { id: "sound", name: "Sound Production", category: "Post Production", description: "Sound production and mix facility." }
];

export const phones = ["95000 72167", "96008 55167", "84283 26126", "95000 72644"];
export const address = "104, Brindavan Main Road, Valasaravakkam, Chennai - 600087 · Opp. Reliance Digital";

export const cameras = [
  { id: "CAM-001", name: "ARRI ALEXA 35", serial: "Pending", status: "OUT", hours: 1370, current: "S35-2026-0001" },
  { id: "CAM-002", name: "RED Helium 8K", serial: "Pending", status: "AVAILABLE", hours: 0, current: "" },
  { id: "CAM-003", name: "Sony FX3", serial: "Pending", status: "AVAILABLE", hours: 0, current: "" }
];

export const bookings: Booking[] = [
  { id: "S35-2026-0001", client: "Kumaravel unit", project: "Movie", start: "2026-08-11T17:00:00+05:30", end: "2026-08-12T17:00:00+05:30", status: "CHECKED_OUT", cameraIds: ["CAM-001"], total: 18000, balance: 18000 },
  { id: "BK-2026-0002", client: "Sample Production", project: "Commercial", start: "2026-08-20T08:00:00+05:30", end: "2026-08-22T20:00:00+05:30", status: "RESERVED", cameraIds: ["CAM-002"], total: 24000, balance: 12000 }
];
