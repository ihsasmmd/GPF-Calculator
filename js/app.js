import { loadStore, saveStore, serializeForBackup, parseBackup } from "./lib/storage.js";
import { newYearRecord, computeAllYears, rateFor } from "./lib/gpfCalc.js";
import { hashPin, verifyPin } from "./lib/pinLock.js";
import { shareOrDownloadText, shareOrDownloadBinary, pickTextFile } from "./lib/fileExport.js";
import {
  renderHeader, renderTabs, renderCoverTab, renderRatesTab,
  renderLedgerTab, renderReportTab, renderLockScreen,
} from "./components/render.js";

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

// This app tracks a single employee's GPF account. The starting fiscal
// year isn't guessed or defaulted — it's whatever year the employee's
// GPF account actually opened (e.g. 2017, 2022...), entered by hand.
const BLANK_DRAFT = { name: "", perNo: "", gpfNo: "", startBps: 1, startYear: "" };

const state = {
  store: loadStore(),
  draft: { ...BLANK_DRAFT },
  tab: "cover",
  activeYearIdx: 0,
  reportMsg: "",
  // lock overlay state
  lockMode: null, // null | "enter" | "setup" | "disable"
  pinDigits: "",
  lockError: "",
};

if (state.store.employees.length) {
  state.tab = "ledger";
  const emp = state.store.employees[0];
  state.draft = { name: emp.name, perNo: emp.perNo, gpfNo: emp.gpfNo, startBps: emp.startBps, startYear: emp.startYear };
}
if (state.store.settings.pinLock) state.lockMode = "enter";

const root = document.getElementById("root");
let saveTimer = null;
function persist() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveStore(state.store), 300);
}

function activeEmployee() {
  return state.store.employees[0] || null;
}

function computedForActive() {
  const emp = activeEmployee();
  return emp ? computeAllYears(emp.years) : [];
}

function patchEmployee(patchFn) {
  state.store = {
    ...state.store,
    employees: state.store.employees.map((e, i) => (i === 0 ? patchFn(e) : e)),
  };
  persist();
}

/* ---------------- full render ---------------- */
function render() {
  const emp = activeEmployee();
  const computed = computedForActive();
  const finalClosing = computed.length ? computed[computed.length - 1].closing : 0;

  if (state.lockMode) {
    root.innerHTML = renderLockScreen(
      state.lockMode === "enter" ? "enter" : state.lockMode === "setup" ? "setup" : "enter",
      state.pinDigits,
      state.lockError
    );
    return;
  }

  let body = "";
  if (state.tab === "cover") body = renderCoverTab(state.draft, !!emp);
  else if (state.tab === "rates") body = renderRatesTab();
  else if (state.tab === "ledger" && emp) body = renderLedgerTab(emp.years, computed, state.activeYearIdx);
  else if (state.tab === "report" && emp) body = renderReportTab(emp, emp.years, computed, state.reportMsg);

  root.innerHTML = `
    <div class="gpf-app">
      <div class="gpf-spine"></div>
      ${renderHeader(emp, finalClosing, state.store.settings.pinLock)}
      ${renderTabs(state.tab, !!emp)}
      <div class="gpf-body">${body}</div>
    </div>`;
}

/* --------- lightweight patch (no full re-render) for ledger keystrokes --------- */
function patchLedgerDisplays() {
  const emp = activeEmployee();
  if (!emp || state.tab !== "ledger") return;
  const computed = computedForActive();
  const c = computed[state.activeYearIdx];
  if (!c) return;

  const headerBal = root.querySelector('[data-role="header-balance"]');
  if (headerBal) headerBal.textContent = "Rs. " + computed[computed.length - 1].closing.toLocaleString();

  const openingBadge = root.querySelector('[data-role="opening-balance"]');
  if (openingBadge) openingBadge.textContent = "Rs. " + c.opening.toLocaleString();

  c.rows.forEach((r, i) => {
    const cell = root.querySelector(`[data-role="balance"][data-month="${i}"]`);
    if (cell) cell.textContent = r.balance.toLocaleString();
  });

  const map = {
    totalSub: c.totalSub,
    refundTransfer: c.totalRefund + c.totalTransfer,
    withdrawal: c.totalWithdrawal,
    interest: Math.round(c.profit),
    closing: c.closing,
  };
  Object.entries(map).forEach(([key, val]) => {
    const el = root.querySelector(`[data-role="summary-value"][data-key="${key}"]`);
    if (el) el.textContent = "Rs. " + val.toLocaleString();
  });
}

/* ---------------- actions ---------------- */
function startLedger() {
  if (!state.draft.name.trim()) return;
  const existing = activeEmployee();

  if (existing) {
    // Editing an existing (single) employee: only name/perNo/gpfNo are
    // changeable here — startBps/startYear are locked once the ledger exists.
    patchEmployee((emp) => ({ ...emp, name: state.draft.name, perNo: state.draft.perNo, gpfNo: state.draft.gpfNo }));
    state.tab = "ledger";
    render();
    return;
  }

  const startYear = Number(state.draft.startYear);
  if (!startYear || startYear < 1900 || startYear > 2200) return; // needs a real starting year, not guessed
  const startBps = Number(state.draft.startBps);
  const first = newYearRecord(startYear, startBps);
  const employee = { id: uid(), ...state.draft, startYear, startBps, years: [first] };
  state.store = { ...state.store, employees: [employee], activeEmployeeId: employee.id };
  state.activeYearIdx = 0;
  state.tab = "ledger";
  persist();
  render();
}

function resetAllData() {
  const confirmed = window.confirm(
    "This will permanently delete this passbook and every year of ledger data from this device. This cannot be undone.\n\nContinue?"
  );
  if (!confirmed) return;
  state.store = { employees: [], activeEmployeeId: null, settings: { pinLock: false, pinHash: null } };
  state.draft = { ...BLANK_DRAFT };
  state.tab = "cover";
  state.activeYearIdx = 0;
  state.reportMsg = "";
  persist();
  render();
}

function addNextYear() {
  patchEmployee((emp) => {
    const last = emp.years[emp.years.length - 1];
    const nextStart = last ? last.fyStartYear + 1 : emp.startYear;
    const bps = last ? last.bps : emp.startBps;
    const guess = last ? last.interestRate : undefined;
    const rec = newYearRecord(nextStart, bps, guess);
    state.activeYearIdx = emp.years.length; // index of the new year
    return { ...emp, years: [...emp.years, rec] };
  });
  render();
}

function removeLastYear() {
  patchEmployee((emp) => (emp.years.length > 1 ? { ...emp, years: emp.years.slice(0, -1) } : emp));
  state.activeYearIdx = Math.max(0, state.activeYearIdx - 1);
  render();
}

function applyChartRate() {
  patchEmployee((emp) => ({
    ...emp,
    years: emp.years.map((y, i) => {
      if (i !== state.activeYearIdx) return y;
      const rate = rateFor(Number(y.bps), y.fyStartYear);
      return { ...y, months: y.months.map((m) => ({ ...m, subscription: rate })) };
    }),
  }));
  render();
}

async function exportPdf() {
  const emp = activeEmployee();
  if (!emp) return;
  state.reportMsg = "Generating PDF…";
  render();
  try {
    const { buildEmployeePdf, pdfToBase64 } = await import("./lib/pdfExport.js");
    const doc = buildEmployeePdf(emp);
    const base64 = pdfToBase64(doc);
    const filename = `GPF-${(emp.name || "passbook").replace(/\s+/g, "_")}.pdf`;
    await shareOrDownloadBinary(filename, base64, "application/pdf");
    state.reportMsg = "PDF ready — check your downloads or share sheet.";
  } catch (e) {
    state.reportMsg = "Couldn't generate the PDF: " + (e?.message || e);
  }
  render();
}

async function exportBackup() {
  try {
    const text = serializeForBackup(state.store);
    await shareOrDownloadText("gpf-passbook-backup.json", text, "application/json");
    state.reportMsg = "Backup file saved/shared.";
  } catch (e) {
    state.reportMsg = "Backup failed: " + (e?.message || e);
  }
  render();
}

async function restoreBackup() {
  try {
    const text = await pickTextFile();
    const parsed = parseBackup(text);
    // This app is single-employee; if an older multi-employee backup is
    // restored, keep only the first account.
    const employees = parsed.employees.slice(0, 1);
    state.store = { ...parsed, employees, activeEmployeeId: employees[0]?.id ?? null };
    state.tab = employees.length ? "ledger" : "cover";
    state.activeYearIdx = 0;
    if (employees.length) {
      const emp = employees[0];
      state.draft = { name: emp.name, perNo: emp.perNo, gpfNo: emp.gpfNo, startBps: emp.startBps, startYear: emp.startYear };
    } else {
      state.draft = { ...BLANK_DRAFT };
    }
    persist();
    state.reportMsg = "Backup restored.";
  } catch (e) {
    state.reportMsg = "Restore failed: " + (e?.message || e);
  }
  render();
}

/* ---------------- PIN lock flow ---------------- */
function onPinKey(key) {
  if (key === "⌫") {
    state.pinDigits = state.pinDigits.slice(0, -1);
    state.lockError = "";
    render();
    return;
  }
  if (state.pinDigits.length >= 4) return;
  state.pinDigits += String(key);
  state.lockError = "";
  render();

  if (state.pinDigits.length === 4) {
    setTimeout(() => submitPin(), 120);
  }
}

async function submitPin() {
  const pin = state.pinDigits;
  if (state.lockMode === "setup") {
    const hash = await hashPin(pin);
    state.store = { ...state.store, settings: { ...state.store.settings, pinLock: true, pinHash: hash } };
    persist();
    state.lockMode = null;
    state.pinDigits = "";
    render();
    return;
  }
  const ok = await verifyPin(pin, state.store.settings.pinHash);
  if (ok) {
    if (state.lockMode === "disable") {
      state.store = { ...state.store, settings: { ...state.store.settings, pinLock: false, pinHash: null } };
      persist();
    }
    state.lockMode = null;
    state.pinDigits = "";
    state.lockError = "";
  } else {
    state.pinDigits = "";
    state.lockError = "Incorrect PIN, try again";
  }
  render();
}

function toggleLock() {
  state.pinDigits = "";
  state.lockError = "";
  state.lockMode = state.store.settings.pinLock ? "disable" : "setup";
  render();
}

/* ---------------- event delegation (attached once) ---------------- */
root.addEventListener("click", (e) => {
  const el = e.target.closest("[data-action]");
  if (!el) return;
  const action = el.dataset.action;

  if (action === "switch-tab") {
    state.tab = el.dataset.tab;
    if (state.tab === "cover") {
      const emp = activeEmployee();
      if (emp) state.draft = { name: emp.name, perNo: emp.perNo, gpfNo: emp.gpfNo, startBps: emp.startBps, startYear: emp.startYear };
    }
    render();
  }
  else if (action === "start-ledger") startLedger();
  else if (action === "switch-year") { state.activeYearIdx = Number(el.dataset.idx); render(); }
  else if (action === "add-year") addNextYear();
  else if (action === "remove-year") removeLastYear();
  else if (action === "apply-rate") applyChartRate();
  else if (action === "export-pdf") exportPdf();
  else if (action === "export-backup") exportBackup();
  else if (action === "restore-backup") restoreBackup();
  else if (action === "toggle-lock") toggleLock();
  else if (action === "pin-key") onPinKey(el.dataset.key);
  else if (action === "reset-all") resetAllData();
});

function handleFieldChange(el) {
  if (el.dataset.role === "draft-field") {
    const field = el.dataset.field;
    state.draft = { ...state.draft, [field]: field === "startBps" ? Number(el.value) : el.value };
    const btn = document.getElementById("cover-submit-btn");
    if (btn) {
      const isNew = !activeEmployee();
      const yearOk = !isNew || (Number(state.draft.startYear) >= 1900 && Number(state.draft.startYear) <= 2200);
      btn.disabled = !state.draft.name.trim() || !yearOk;
    }
    return;
  }
  if (el.dataset.role === "month-field") {
    const mi = Number(el.dataset.month);
    const field = el.dataset.field;
    const val = el.value === "" ? 0 : Number(el.value);
    patchEmployee((emp) => ({
      ...emp,
      years: emp.years.map((y, i) => {
        if (i !== state.activeYearIdx) return y;
        const months = y.months.map((m, idx) => (idx === mi ? { ...m, [field]: val } : m));
        return { ...y, months };
      }),
    }));
    patchLedgerDisplays();
    return;
  }
  if (el.dataset.role === "year-field") {
    const field = el.dataset.field;
    const val = field === "bps" ? Number(el.value) : el.value === "" ? 0 : Number(el.value);
    patchEmployee((emp) => ({
      ...emp,
      years: emp.years.map((y, i) => (i === state.activeYearIdx ? { ...y, [field]: val } : y)),
    }));
    patchLedgerDisplays();
    return;
  }
}

root.addEventListener("input", (e) => handleFieldChange(e.target));
root.addEventListener("change", (e) => {
  if (e.target.tagName === "SELECT") handleFieldChange(e.target);
});

render();
