export type CatalogEntry = {
  id: string;
  type: "camera" | "accessory";
  code: string;
  name: string;
  rate: number;
};

export type ParsedEquipmentItem = {
  key: string;
  rawLine: string;
  description: string;
  item_type: "camera" | "accessory" | "manual";
  item_id: string;
  matchedName: string;
  matchScore: number;
  quantity: number;
  rental_days: number;
  rate: number;
};

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function matchScore(query: string, target: string): number {
  const q = norm(query);
  const t = norm(target);
  if (!q || !t) return 0;
  if (t === q) return 1;
  if (t.includes(q) || q.includes(t)) return 0.9;
  const qw = q.split(" ").filter((w) => w.length > 2);
  const tw = t.split(" ");
  if (!qw.length) return 0;
  const hits = qw.filter((w) => tw.some((tw) => tw.includes(w) || w.includes(tw)));
  return hits.length / Math.max(qw.length, tw.length);
}

function isSectionHeader(line: string): boolean {
  const t = line.trim();
  if (/^[-=_]{3,}\s*$/.test(t)) return true;
  if (/^[*•#]/.test(t) || /^\d+[.)]\s/.test(t) || /^\d+\.\S/.test(t)) return false;
  return /^[A-Za-z]+$/.test(t) && t.length <= 25;
}

export function parseEquipmentText(text: string, catalog: CatalogEntry[]): ParsedEquipmentItem[] {
  const SKIP = /^(hi|hello|dear|regards|thanks|please|note[:\s]|from[:\s]|to[:\s]|date[:\s]|subject[:\s]|re[:\s]|\d{10}|https?:)/i;

  const lines = text
    .split(/\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 2 && !SKIP.test(l) && !isSectionHeader(l));

  const results: ParsedEquipmentItem[] = [];

  for (const line of lines) {
    let raw = line;
    let qty = 1;
    let days = 1;

    // Strip numbered list prefix "1. " "2) " "3." — NOT product digits like "4x4", "7.5kw"
    raw = raw.replace(/^\d+[.)]\s*/, "").trim();
    // Strip symbol markers * • # - at start
    raw = raw.replace(/^[*•#\-]\s*/, "").trim();
    if (!raw || raw.length < 2) continue;

    // Strip trailing parenthetical notes "(gimbal & softbox)", "(satin chimera black"
    raw = raw.replace(/\s*\([^)]*\)?\s*$/, "").trim();

    // Strip large-number price suffixes "= 11000" (3+ digits = price, not qty)
    raw = raw.replace(/\s*=\s*\d{3,}.*$/, "").trim();

    // Extract trailing qty: "- 2 no's", "– 3 Nos.", "= 1 no", "- 4", "- 8no's"
    const trailingQty = raw.match(/\s*[-–=]\s*(\d+)\.?\s*(?:no'?s?\.?|nos?\.?|pcs?\.?|units?\.?)?\s*$/i);
    if (trailingQty && trailingQty.index !== undefined) {
      qty = parseInt(trailingQty[1]);
      raw = raw.slice(0, trailingQty.index).trim();
    }

    // Extract leading / inline qty
    if (qty === 1) {
      const qPatterns: [RegExp, number][] = [
        [/^(\d+)\s*[x×]\s+/i, 1],
        [/\s+[x×]\s*(\d+)\s*$/i, 1],
        [/^(\d+)\s+(?:no'?s?|nos?|pcs?|units?)\s+/i, 1],
        [/\((\d+)\s*(?:no'?s?|nos?|pcs?|units?)?\)\s*$/, 1],
        [/^qty\s*[:\-]?\s*(\d+)\s*/i, 1],
      ];
      for (const [pat, grp] of qPatterns) {
        const m = raw.match(pat);
        if (m) { qty = parseInt(m[grp]); raw = raw.replace(m[0], "").trim(); break; }
      }
    }

    // Extract rental days
    const dm = raw.match(/\bfor\s+(\d+)\s+days?\b|\b(\d+)\s+days?\b/i);
    if (dm) { days = parseInt(dm[1] || dm[2]); raw = raw.replace(dm[0], "").trim(); }

    raw = raw.trim();
    if (!raw || raw.length < 2) continue;

    // Fuzzy match against catalog
    let best: CatalogEntry | null = null;
    let bestScore = 0;
    for (const item of catalog) {
      const s = matchScore(raw, item.name);
      if (s > bestScore) { bestScore = s; best = item; }
    }

    const matched = bestScore >= 0.35 && best;
    results.push({
      key: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      rawLine: line,
      description: matched ? best!.name : raw,
      item_type: matched ? best!.type : "manual",
      item_id: matched ? best!.id : "",
      matchedName: matched ? `${best!.code} · ${best!.name}` : "",
      matchScore: bestScore,
      quantity: qty,
      rental_days: days,
      rate: matched ? best!.rate : 0,
    });
  }
  return results;
}
