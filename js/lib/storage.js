const STORE_KEY = "gpf-passbook-store-v1";

/**
 * Shape of the persisted store:
 * {
 *   employees: [{ id, name, perNo, gpfNo, startBps, startYear, years: [...] }],
 *   activeEmployeeId: string | null,
 *   settings: { pinLock: boolean, pinHash: string | null }
 * }
 */
const EMPTY_STORE = { employees: [], activeEmployeeId: null, settings: { pinLock: false, pinHash: null } };

export function loadStore() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return { ...EMPTY_STORE };
    const parsed = JSON.parse(raw);
    return { ...EMPTY_STORE, ...parsed, settings: { ...EMPTY_STORE.settings, ...(parsed.settings || {}) } };
  } catch (e) {
    console.error("gpf: load failed", e);
    return { ...EMPTY_STORE };
  }
}

export function saveStore(store) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
    return true;
  } catch (e) {
    console.error("gpf: save failed", e);
    return false;
  }
}

export function serializeForBackup(store) {
  return JSON.stringify({ ...store, exportedAt: new Date().toISOString(), format: "gpf-passbook-backup-v1" }, null, 2);
}

export function parseBackup(text) {
  const parsed = JSON.parse(text);
  if (!parsed || !Array.isArray(parsed.employees)) {
    throw new Error("This file doesn't look like a GPF Passbook backup.");
  }
  return { ...EMPTY_STORE, ...parsed };
}
