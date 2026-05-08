import bundled from "@/data/prom.json";

export type PromTable = Record<string, Record<string, number>>;

const KEY = "prom_overrides_v1";
const EVENT = "prom-store-changed";

function readOverrides(): PromTable {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as PromTable) : {};
  } catch {
    return {};
  }
}

function writeOverrides(t: PromTable) {
  localStorage.setItem(KEY, JSON.stringify(t));
  window.dispatchEvent(new Event(EVENT));
}

/**
 * Merge bundled defaults with user overrides. A star present in overrides
 * fully replaces the bundled entry (so users can add/remove letters cleanly).
 * A star explicitly stored as an empty object {} is treated as deleted.
 */
export function getPromTable(): PromTable {
  const ov = readOverrides();
  const out: PromTable = {};
  for (const [name, letters] of Object.entries(bundled as PromTable)) {
    if (name in ov) continue;
    out[name] = { ...letters };
  }
  for (const [name, letters] of Object.entries(ov)) {
    if (letters && Object.keys(letters).length === 0 && !(name in (bundled as PromTable))) continue;
    if (letters && Object.keys(letters).length === 0) continue; // tombstone for bundled
    out[name] = { ...letters };
  }
  return out;
}

export function getPromStar(name: string): Record<string, number> | undefined {
  return getPromTable()[name];
}

export function upsertPromStar(name: string, letters: Record<string, number>) {
  const ov = readOverrides();
  ov[name] = letters;
  writeOverrides(ov);
}

export function renamePromStar(oldName: string, newName: string) {
  if (oldName === newName) return;
  const ov = readOverrides();
  const current = getPromTable()[oldName];
  if (!current) return;
  // Tombstone old (only matters if it was in bundled)
  if (oldName in (bundled as PromTable)) ov[oldName] = {};
  else delete ov[oldName];
  ov[newName] = current;
  writeOverrides(ov);
}

export function deletePromStar(name: string) {
  const ov = readOverrides();
  if (name in (bundled as PromTable)) {
    ov[name] = {}; // tombstone
  } else {
    delete ov[name];
  }
  writeOverrides(ov);
}

export function resetPromOverrides() {
  localStorage.removeItem(KEY);
  window.dispatchEvent(new Event(EVENT));
}

export function exportPromJSON(): string {
  return JSON.stringify(getPromTable(), null, 2);
}

export function importPromJSON(json: string) {
  const parsed = JSON.parse(json) as PromTable;
  // Store as full overrides so user-imported set takes precedence
  const ov: PromTable = {};
  // Tombstone bundled stars not present in import
  for (const name of Object.keys(bundled as PromTable)) {
    if (!(name in parsed)) ov[name] = {};
  }
  for (const [name, letters] of Object.entries(parsed)) {
    ov[name] = letters;
  }
  writeOverrides(ov);
}

export function subscribePromStore(cb: () => void): () => void {
  const handler = () => cb();
  window.addEventListener(EVENT, handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(EVENT, handler);
    window.removeEventListener("storage", handler);
  };
}