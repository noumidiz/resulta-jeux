// GET /api/results?game=loto|euromillions|eurodreams
// Télécharge les archives ZIP officielles publiées par la FDJ, les lit et renvoie les tirages en JSON.
// Aucune clé d'API n'est nécessaire. Le résultat est mis en cache (15 min en mémoire + CDN Vercel).
import { unzipSync } from "fflate";

const BASE = "https://www.sto.api.fdj.fr/anonymous/service-draw-info/v3/documentations/1a2b3c4d-9876-4562-b3fc-2c963f66af";
const UA = "Mozilla/5.0 (compatible; ResultaJeux/1.0; +https://vercel.com)";

// ids = fin de l'identifiant de chaque archive (lien « Télécharger » des pages Historique de fdj.fr)
const GAMES = {
  loto:         { nk: 5, nm: 49, sk: 1, sm: 10, ids: ["p6", "o6", "n6", "m6"] },            // oct. 2008 → aujourd'hui
  euromillions: { nk: 5, nm: 50, sk: 2, sm: 12, ids: ["e6", "d6", "c6", "b6", "a9", "a8"] }, // fév. 2004 → aujourd'hui
  eurodreams:   { nk: 6, nm: 40, sk: 1, sm: 5,  ids: ["a5"] },                              // nov. 2023 → aujourd'hui
};

const cache = {};

function decode(u8) {
  let t = new TextDecoder("utf-8").decode(u8);
  if (t.includes("\uFFFD")) t = new TextDecoder("windows-1252").decode(u8);
  return t.replace(/^\uFEFF/, "");
}

function parseDate(s) {
  s = (s || "").trim();
  let m;
  if ((m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/))) return `${m[3]}-${m[2]}-${m[1]}`;
  if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})/))) return `${m[1]}-${m[2]}-${m[3]}`;
  if ((m = s.match(/^(\d{4})(\d{2})(\d{2})$/))) return `${m[1]}-${m[2]}-${m[3]}`;
  return null;
}

const okSet = (a, k, mx) => a.length === k && a.every((x) => Number.isInteger(x) && x >= 1 && x <= mx) && new Set(a).size === k;
const sortN = (a) => [...a].sort((x, y) => x - y);

export function parseCsv(text, game) {
  const g = GAMES[game];
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const sep = lines[0].includes(";") ? ";" : ",";
  const H = lines[0].toLowerCase().split(sep).map((x) => x.trim());
  const di = H.findIndex((x) => x.includes("date") && !x.includes("forclusion"));
  const idx = (names) => H.findIndex((x) => names.includes(x));
  const bi = Array.from({ length: g.nk }, (_, i) => idx([`boule_${i + 1}`, `n${i + 1}`]));
  let si = [];
  if (game === "euromillions") si = [1, 2].map((k) => idx([`etoile_${k}`, `star_${k}`]));
  else if (game === "loto") si = [H.findIndex((x) => x.includes("chance"))];
  else if (game === "eurodreams") {
    let d = H.indexOf("numero_dream");
    if (d < 0) d = H.findIndex((x) => x.includes("dream") && !x.includes("gagn") && !x.includes("rang"));
    si = [d];
  }
  const mi = game === "loto"
    ? Array.from({ length: 5 }, (_, i) => H.findIndex((x) => x.startsWith(`boule_${i + 1}`) && x.includes("second")))
    : [];
  if (di < 0 || bi.some((x) => x < 0) || si.some((x) => x < 0)) return [];
  const out = [];
  for (const ln of lines.slice(1)) {
    const p = ln.split(sep);
    const d = parseDate(p[di]);
    if (!d) continue;
    const n = bi.map((i) => parseInt(p[i], 10));
    const s = si.map((i) => parseInt(p[i], 10));
    if (!okSet(n, g.nk, g.nm) || !okSet(s, g.sk, g.sm)) continue;
    const o = { d, n: sortN(n), s: sortN(s) };
    if (mi.length && mi.every((i) => i >= 0)) {
      const m = mi.map((i) => parseInt(p[i], 10));
      if (okSet(m, 5, 49)) o.m = sortN(m);
    }
    out.push(o);
  }
  return out;
}

async function loadArchive(suffix) {
  const r = await fetch(BASE + suffix, { headers: { "User-Agent": UA, Accept: "*/*" }, signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`HTTP ${r.status} (${suffix})`);
  const buf = new Uint8Array(await r.arrayBuffer());
  let texts;
  try {
    const files = unzipSync(buf);
    texts = Object.entries(files).filter(([n]) => /\.(csv|txt)$/i.test(n)).map(([, u]) => decode(u));
  } catch {
    texts = [decode(buf)]; // au cas où le fichier ne serait pas compressé
  }
  return texts;
}

export default async function handler(req, res) {
  const game = String((req.query && req.query.game) || "").toLowerCase();
  const g = GAMES[game];
  if (!g) return res.status(400).json({ error: "Paramètre game attendu : loto, euromillions ou eurodreams." });

  const c = cache[game];
  if (c && Date.now() - c.t < 15 * 60 * 1000) {
    res.setHeader("Cache-Control", "public, s-maxage=900, stale-while-revalidate=3600");
    return res.status(200).json(c.data);
  }

  const results = await Promise.allSettled(g.ids.map(loadArchive));
  const errors = [];
  const byDate = new Map();
  results.forEach((r, i) => {
    if (r.status !== "fulfilled") return errors.push(String(r.reason && r.reason.message || r.reason));
    for (const t of r.value) for (const row of parseCsv(t, game)) if (!byDate.has(row.d)) byDate.set(row.d, row);
  });
  const draws = [...byDate.values()].sort((a, b) => (a.d < b.d ? 1 : -1));
  if (!draws.length) return res.status(502).json({ error: "Aucun tirage lu depuis les archives FDJ.", errors });

  const data = { game, source: "Archives officielles FDJ (fdj.fr)", fetchedAt: new Date().toISOString(), count: draws.length, errors, draws };
  cache[game] = { t: Date.now(), data };
  res.setHeader("Cache-Control", "public, s-maxage=900, stale-while-revalidate=3600");
  return res.status(200).json(data);
}
