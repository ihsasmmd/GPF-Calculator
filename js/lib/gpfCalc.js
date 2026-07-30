import { REV_DATES, RATE_TABLE, DEFAULT_INTEREST, MONTHS } from "../data/rateTable.js";

export function fyLabel(startYear) {
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;
}

/** Index into RATE_TABLE columns for the revision in effect on (year, month). */
export function columnIndexFor(year, month) {
  let idx = 0;
  for (let i = 0; i < REV_DATES.length; i++) {
    const d = REV_DATES[i];
    if (year > d.year || (year === d.year && month >= d.month)) idx = i;
  }
  return idx;
}

/** Monthly subscription rate for a BPS in the fiscal year starting July of fyStartYear. */
export function rateFor(bps, fyStartYear) {
  const idx = columnIndexFor(fyStartYear, 7);
  return (RATE_TABLE[bps] || [])[idx] ?? 0;
}

export function blankMonths(subscription) {
  return MONTHS.map((m) => ({ month: m, subscription, refund: 0, transfer: 0, withdrawal: 0 }));
}

export function newYearRecord(fyStartYear, bps, prevInterestGuess) {
  const fy = fyLabel(fyStartYear);
  return {
    fyStartYear,
    fy,
    bps,
    interestRate: DEFAULT_INTEREST[fy] ?? prevInterestGuess ?? 0,
    months: blankMonths(rateFor(bps, fyStartYear)),
  };
}

/**
 * Compute one fiscal year's ledger given its opening balance.
 * Interest = (sum of the 12 monthly progressive balances / 12) * rate% —
 * the standard GPF average-balance method.
 */
export function computeYear(yr, opening) {
  let running = opening;
  const rows = yr.months.map((m) => {
    running =
      running +
      (Number(m.subscription) || 0) +
      (Number(m.refund) || 0) +
      (Number(m.transfer) || 0) -
      (Number(m.withdrawal) || 0);
    return { ...m, balance: running };
  });
  const totalSub = rows.reduce((s, r) => s + (Number(r.subscription) || 0), 0);
  const totalRefund = rows.reduce((s, r) => s + (Number(r.refund) || 0), 0);
  const totalTransfer = rows.reduce((s, r) => s + (Number(r.transfer) || 0), 0);
  const totalWithdrawal = rows.reduce((s, r) => s + (Number(r.withdrawal) || 0), 0);
  const sumBalances = rows.reduce((s, r) => s + r.balance, 0);
  const totalDeposits = totalSub + totalRefund;
  const profit = (sumBalances / 12) * ((Number(yr.interestRate) || 0) / 100);
  const closing = Math.round(opening + totalDeposits + totalTransfer - totalWithdrawal + profit);
  return { rows, totalSub, totalRefund, totalTransfer, totalWithdrawal, profit, closing, opening };
}

/** Compute every year in sequence, threading opening/closing balances together. */
export function computeAllYears(years) {
  let opening = 0;
  const out = [];
  for (const yr of years) {
    const c = computeYear(yr, opening);
    out.push(c);
    opening = c.closing;
  }
  return out;
}
