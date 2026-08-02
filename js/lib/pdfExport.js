import { SimplePdf } from "./pdfWriter.js";
import { computeAllYears } from "./gpfCalc.js";

const INK = [22, 48, 31]; // #16301F
const CREAM = [240, 231, 201]; // #F0E7C9
const BRASS = [168, 121, 46]; // #A8792E
const MUTED = [140, 140, 140];
const ALT_ROW = [247, 241, 225];

const MARGIN_L = 40;
const MARGIN_R = 40;

// Right edge x-position for each right-aligned column, plus the left x for
// the (left-aligned) fiscal year column.
const COLS = [
  { key: "fy", label: "Fiscal Year", x: MARGIN_L, align: "left" },
  { key: "bps", label: "BPS", x: 155, align: "right" },
  { key: "opening", label: "Opening", x: 235, align: "right" },
  { key: "sub", label: "Subscription", x: 330, align: "right" },
  { key: "refund", label: "Refund/Transfer", x: 425, align: "right" },
  { key: "withdrawal", label: "Withdrawal", x: 480, align: "right" },
  { key: "interest", label: "Interest", x: 522, align: "right" },
  { key: "closing", label: "Closing Balance", x: 555, align: "right" },
];

const ROW_H = 15;
const TABLE_TOP = 140;
const PAGE_BOTTOM_MARGIN = 130; // leave room for the final-balance stamp / footer

export function buildEmployeePdf(employee) {
  const computed = computeAllYears(employee.years);
  const doc = new SimplePdf();
  const pageW = doc.pageWidth;
  const pageH = doc.pageHeight;

  function drawHeader() {
    doc.setFillColor(...INK);
    doc.rect(0, 0, pageW, 70, "F");
    doc.setFillColor(...CREAM);
    doc.text(MARGIN_L, 32, "GENERAL PROVIDENT FUND", { font: "Helvetica-Bold", size: 17 });
    doc.text(MARGIN_L, 48, "Personal Passbook & Ledger Report", { font: "Helvetica", size: 10 });
  }

  function drawEmployeeInfo() {
    doc.setFillColor(...INK);
    doc.text(MARGIN_L, 96, employee.name || "Unnamed Employee", { font: "Helvetica-Bold", size: 12.5 });
    const details = [
      employee.perNo ? `Personal No: ${employee.perNo}` : null,
      employee.gpfNo ? `GPF Reference No: ${employee.gpfNo}` : null,
      `Fund opened: ${employee.years[0] ? employee.years[0].fy : "-"}`,
    ]
      .filter(Boolean)
      .join("     |     ");
    doc.setFillColor(90, 90, 90);
    doc.text(MARGIN_L, 112, details, { font: "Helvetica", size: 9.5 });
  }

  function drawTableHeaderRow(y) {
    doc.setFillColor(...INK);
    doc.rect(MARGIN_L - 5, y - 12, pageW - MARGIN_L - MARGIN_R + 10, 18, "F");
    doc.setFillColor(...CREAM);
    COLS.forEach((c) => doc.text(c.x, y, c.label, { font: "Helvetica-Bold", size: 8, align: c.align }));
  }

  drawHeader();
  drawEmployeeInfo();
  drawTableHeaderRow(TABLE_TOP);

  let y = TABLE_TOP + ROW_H;
  let rowIndex = 0;

  employee.years.forEach((yr, i) => {
    const c = computed[i];
    if (y > pageH - PAGE_BOTTOM_MARGIN) {
      doc.addPage();
      drawTableHeaderRow(TABLE_TOP - 60);
      y = TABLE_TOP - 60 + ROW_H;
      rowIndex = 0;
    }

    if (rowIndex % 2 === 1) {
      doc.setFillColor(...ALT_ROW);
      doc.rect(MARGIN_L - 5, y - 11, pageW - MARGIN_L - MARGIN_R + 10, ROW_H, "F");
    }

    const values = {
      fy: yr.fy,
      bps: String(yr.bps).padStart(2, "0"),
      opening: c.opening.toLocaleString(),
      sub: c.totalSub.toLocaleString(),
      refund: (c.totalRefund + c.totalTransfer).toLocaleString(),
      withdrawal: c.totalWithdrawal.toLocaleString(),
      interest: Math.round(c.profit).toLocaleString(),
      closing: c.closing.toLocaleString(),
    };
    doc.setFillColor(...INK);
    COLS.forEach((col) => {
      doc.text(col.x, y, values[col.key], {
        font: col.key === "fy" ? "Helvetica-Bold" : "Courier",
        size: 8.5,
        align: col.align,
      });
    });

    y += ROW_H;
    rowIndex += 1;
  });

  // Final balance stamp
  if (y > pageH - PAGE_BOTTOM_MARGIN + 40) {
    doc.addPage();
    y = TABLE_TOP - 60;
  }
  const stampY = y + 30;
  const finalClosing = computed.length ? computed[computed.length - 1].closing : 0;
  doc.setStrokeColor(...BRASS);
  doc.setLineWidth(1.2);
  doc.rect(MARGIN_L, stampY, 230, 50, "S");
  doc.setFillColor(...BRASS);
  doc.text(MARGIN_L + 14, stampY + 18, "GPF FINAL BALANCE", { font: "Helvetica-Bold", size: 9 });
  doc.text(MARGIN_L + 14, stampY + 40, `Rs. ${finalClosing.toLocaleString()}`, { font: "Helvetica-Bold", size: 17 });

  doc.setFillColor(...MUTED);
  doc.text(MARGIN_L, pageH - 24, `Generated ${new Date().toLocaleDateString()} - GPF Passbook`, { font: "Helvetica", size: 7.5 });

  return doc;
}

/** Returns a base64 string of the PDF bytes (for sharing/downloading). */
export function pdfToBase64(doc) {
  const bytes = doc.output();
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
