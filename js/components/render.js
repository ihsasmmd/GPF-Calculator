import { REV_DATES, RATE_TABLE, BPS_LIST } from "../data/rateTable.js";
import { fyLabel } from "../lib/gpfCalc.js";

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export function renderHeader(activeEmployee, finalClosing, pinLockOn) {
  return `
    <div class="gpf-header">
      <div class="gpf-crest">📗</div>
      <div>
        <div class="gpf-title">GENERAL PROVIDENT FUND</div>
        <div class="gpf-subtitle">Personal Passbook &amp; Ledger</div>
      </div>
      ${activeEmployee ? `
        <div class="gpf-balance">
          <div class="gpf-balance-label">Current Balance</div>
          <div class="gpf-balance-value" data-role="header-balance">Rs. ${finalClosing.toLocaleString()}</div>
        </div>` : ""}
      <button class="gpf-icon-btn" data-action="toggle-lock" title="App lock">${pinLockOn ? "🔒" : "🔓"}</button>
    </div>`;
}

export function renderEmployeeBar(employees, activeId) {
  if (!employees.length) return "";
  return `
    <div class="gpf-employee-bar">
      ${employees.map((e) => `
        <button class="gpf-employee-chip ${e.id === activeId ? "active" : ""}" data-action="switch-employee" data-id="${e.id}">
          👤 ${esc(e.name || "Unnamed")}
        </button>`).join("")}
      <button class="gpf-employee-chip" data-action="add-employee">+ Add Employee</button>
    </div>`;
}

export function renderTabs(tab, hasEmployee) {
  const t = (id, icon, label) => `
    <button class="gpf-tab-btn ${tab === id ? "active" : ""}" data-action="switch-tab" data-tab="${id}" ${(id === "ledger" || id === "report") && !hasEmployee ? "disabled" : ""}>
      <span>${icon}</span><span>${label}</span>
    </button>`;
  return `<div class="gpf-tabs">${t("cover", "🖋", "Cover")}${t("rates", "📜", "Rate Chart")}${t("ledger", "🏦", "Ledger")}${t("report", "📈", "Final Report")}</div>`;
}

export function renderCoverTab(draft, hasLedger) {
  return `
    <div style="padding-top:6px;">
      <div class="gpf-card">
        <div class="gpf-seal">GPF</div>
        <div class="gpf-card-title">${draft.name ? esc(draft.name) : "New Account"}</div>
        <div class="gpf-rule"></div>
        <div class="gpf-form-grid">
          <label class="gpf-field-label">Employee Name
            <input class="gpf-input" data-role="draft-field" data-field="name" value="${esc(draft.name)}" placeholder="Full name" />
          </label>
          <label class="gpf-field-label">Personal Number
            <input class="gpf-input" data-role="draft-field" data-field="perNo" value="${esc(draft.perNo)}" placeholder="e.g. 85326974" />
          </label>
          <label class="gpf-field-label">GPF Reference No.
            <input class="gpf-input" data-role="draft-field" data-field="gpfNo" value="${esc(draft.gpfNo)}" placeholder="e.g. Edu/BWN/85214" />
          </label>
          <label class="gpf-field-label">Starting BPS
            <select class="gpf-input" data-role="draft-field" data-field="startBps">
              ${BPS_LIST.map((b) => `<option value="${b}" ${Number(draft.startBps) === b ? "selected" : ""}>BPS ${String(b).padStart(2, "0")}</option>`).join("")}
            </select>
          </label>
          <label class="gpf-field-label">First Fiscal Year (starts July)
            <input type="number" class="gpf-input" data-role="draft-field" data-field="startYear" value="${esc(draft.startYear)}" placeholder="e.g. 2001" />
            <div class="gpf-hint">Fund opens as ${fyLabel(Number(draft.startYear) || 0)}</div>
          </label>
        </div>
        ${!hasLedger
          ? `<button id="open-passbook-btn" class="gpf-btn-primary" style="margin-top:20px;" data-action="start-ledger" ${!draft.name.trim() ? "disabled" : ""}>Open Passbook →</button>`
          : `<button class="gpf-btn-primary" style="margin-top:20px;" data-action="switch-tab" data-tab="ledger">Continue Ledger →</button>`}
      </div>
      <p class="gpf-note">
        Monthly subscription is auto-filled from the BPS rate chart based on the pay-scale revision in effect for each
        fiscal year, and can be overridden per month. Interest is computed as the average of the twelve monthly balances
        multiplied by that year's rate — the standard GPF method.
      </p>
    </div>`;
}

export function renderRatesTab() {
  return `
    <div class="gpf-panel">
      <div class="gpf-panel-title">GPF Monthly Subscription — Rate Chart</div>
      <div class="gpf-table-scroll">
        <table class="gpf-table">
          <thead><tr><th class="left">BPS</th>${REV_DATES.map((d) => `<th>${d.label}</th>`).join("")}</tr></thead>
          <tbody>
            ${BPS_LIST.map((bps) => `
              <tr>
                <td class="left">${String(bps).padStart(2, "0")}</td>
                ${RATE_TABLE[bps].map((v, i) => `<td class="${i === RATE_TABLE[bps].length - 1 ? "latest" : ""}">${v.toLocaleString()}</td>`).join("")}
              </tr>`).join("")}
          </tbody>
        </table>
      </div>
    </div>`;
}

export function renderLedgerTab(years, computed, activeYearIdx) {
  const yr = years[activeYearIdx];
  const c = computed[activeYearIdx];
  if (!yr || !c) return `<div class="gpf-empty">No ledger yet.</div>`;

  return `
    <div class="gpf-panel">
      <div class="gpf-year-strip">
        ${years.map((y, i) => `<button class="gpf-year-chip ${i === activeYearIdx ? "active" : ""}" data-action="switch-year" data-idx="${i}">${y.fy}</button>`).join("")}
        <button class="gpf-btn-ghost" data-action="add-year">+ Next Year</button>
        ${years.length > 1 ? `<button class="gpf-btn-danger" data-action="remove-year">🗑</button>` : ""}
      </div>

      <div class="gpf-ledger-controls">
        <label class="gpf-field-label">BPS
          <select class="gpf-input" data-role="year-field" data-field="bps">
            ${BPS_LIST.map((b) => `<option value="${b}" ${yr.bps === b ? "selected" : ""}>BPS ${String(b).padStart(2, "0")}</option>`).join("")}
          </select>
        </label>
        <label class="gpf-field-label">Interest Rate (%)
          <input type="number" step="0.01" class="gpf-input" data-role="year-field" data-field="interestRate" value="${yr.interestRate}" />
        </label>
        <button class="gpf-btn-secondary" data-action="apply-rate">Apply chart rate to all months</button>
        <div class="gpf-opening-badge">Opening Balance: <b data-role="opening-balance">Rs. ${c.opening.toLocaleString()}</b></div>
      </div>

      <div class="gpf-table-scroll">
        <table class="gpf-table">
          <thead><tr><th class="left">Month</th><th>Subscription</th><th>Refund</th><th>Transfer</th><th>Withdrawal</th><th>Balance</th></tr></thead>
          <tbody>
            ${yr.months.map((m, mi) => `
              <tr>
                <td class="left">${m.month}</td>
                <td><input type="number" class="gpf-cell-input" data-role="month-field" data-field="subscription" data-month="${mi}" value="${m.subscription}" /></td>
                <td><input type="number" class="gpf-cell-input" data-role="month-field" data-field="refund" data-month="${mi}" value="${m.refund}" /></td>
                <td><input type="number" class="gpf-cell-input" data-role="month-field" data-field="transfer" data-month="${mi}" value="${m.transfer}" /></td>
                <td><input type="number" class="gpf-cell-input" data-role="month-field" data-field="withdrawal" data-month="${mi}" value="${m.withdrawal}" /></td>
                <td class="balance" data-role="balance" data-month="${mi}">${c.rows[mi].balance.toLocaleString()}</td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>

      <div class="gpf-summary-grid">
        ${summaryCell("Total Subscription", "totalSub", c.totalSub)}
        ${summaryCell("Refunds + Transfers", "refundTransfer", c.totalRefund + c.totalTransfer)}
        ${summaryCell("Withdrawals", "withdrawal", c.totalWithdrawal)}
        ${summaryCell("Interest Credited", "interest", Math.round(c.profit))}
        ${summaryCell("Closing Balance", "closing", c.closing, true)}
      </div>
    </div>`;
}

function summaryCell(label, key, value, hi) {
  return `
    <div class="gpf-summary-cell ${hi ? "hi" : ""}" data-role="summary-cell" data-key="${key}">
      <div class="gpf-summary-label">${label}</div>
      <div class="gpf-summary-value" data-role="summary-value" data-key="${key}">Rs. ${value.toLocaleString()}</div>
    </div>`;
}

export function renderReportTab(employee, years, computed, msg) {
  if (!computed.length) return `<div class="gpf-empty">No data yet.</div>`;
  const finalClosing = computed[computed.length - 1].closing;
  return `
    <div class="gpf-panel">
      <div class="gpf-panel-title">GPF Final Re-calculation Report</div>
      <div class="gpf-report-meta">
        <span>${esc(employee.name)}</span>
        ${employee.perNo ? `<span> · Per# ${esc(employee.perNo)}</span>` : ""}
        ${employee.gpfNo ? `<span> · ${esc(employee.gpfNo)}</span>` : ""}
      </div>
      <div class="gpf-toolbar">
        <button class="gpf-btn-secondary" data-action="export-pdf">⬇ Export PDF</button>
        <button class="gpf-btn-secondary" data-action="export-backup">☁ Backup Data</button>
        <button class="gpf-btn-secondary" data-action="restore-backup">⬆ Restore Backup</button>
      </div>
      ${msg ? `<div class="gpf-msg" data-role="report-msg">${esc(msg)}</div>` : `<div class="gpf-msg" data-role="report-msg" style="display:none;"></div>`}
      <div class="gpf-table-scroll">
        <table class="gpf-table">
          <thead><tr><th class="left">Fiscal Year</th><th>BPS</th><th>Opening</th><th>Subscription</th><th>Refund/Transfer</th><th>Withdrawal</th><th>Interest</th><th>Closing Balance</th></tr></thead>
          <tbody>
            ${years.map((y, i) => {
              const c = computed[i];
              return `
                <tr>
                  <td class="left">${y.fy}</td>
                  <td>${String(y.bps).padStart(2, "0")}</td>
                  <td>${c.opening.toLocaleString()}</td>
                  <td>${c.totalSub.toLocaleString()}</td>
                  <td>${(c.totalRefund + c.totalTransfer).toLocaleString()}</td>
                  <td>${c.totalWithdrawal.toLocaleString()}</td>
                  <td>${Math.round(c.profit).toLocaleString()}</td>
                  <td class="balance">${c.closing.toLocaleString()}</td>
                </tr>`;
            }).join("")}
          </tbody>
        </table>
      </div>
      <div class="gpf-stamp">
        <div class="gpf-stamp-label">GPF Final Balance</div>
        <div class="gpf-stamp-value">Rs. ${finalClosing.toLocaleString()}</div>
      </div>
    </div>`;
}

export function renderLockScreen(mode, digits, error) {
  // mode: "enter" (unlock) or "setup" (choosing a new PIN)
  const dots = Array.from({ length: 4 }).map((_, i) => `<div class="gpf-lock-dot ${i < digits.length ? "filled" : ""}"></div>`).join("");
  const keys = [1,2,3,4,5,6,7,8,9,"",0,"⌫"];
  return `
    <div class="gpf-lock-screen">
      <div style="width:64px;height:64px;border-radius:50%;border:2px solid #A8792E;display:flex;align-items:center;justify-content:center;font-size:26px;">🔒</div>
      <div>
        <div style="font-family:'Cormorant Garamond',serif;font-size:22px;font-weight:700;">
          ${mode === "setup" ? "Set a PIN to lock GPF Passbook" : "GPF Passbook is locked"}
        </div>
        <div style="font-size:12.5px;opacity:.75;margin-top:6px;">${mode === "setup" ? "Choose a 4-digit PIN" : "Enter your PIN to continue"}</div>
      </div>
      <div class="gpf-lock-dots">${dots}</div>
      ${error ? `<div style="color:#E38B8B;font-size:12.5px;">${esc(error)}</div>` : ""}
      <div class="gpf-keypad">
        ${keys.map((k) => k === "" ? `<div></div>` : `<button class="gpf-key" data-action="pin-key" data-key="${k}">${k}</button>`).join("")}
      </div>
    </div>`;
}
