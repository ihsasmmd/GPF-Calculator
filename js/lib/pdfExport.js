import { jsPDF } from "https://cdn.jsdelivr.net/npm/jspdf@2.5.2/+esm";
import autoTable from "https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.4/+esm";
import { computeAllYears } from "./gpfCalc.js";

const INK = [22, 48, 31]; // #16301F
const BRASS = [168, 121, 46]; // #A8792E

export function buildEmployeePdf(employee) {
  const computed = computeAllYears(employee.years);
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFillColor(...INK);
  doc.rect(0, 0, pageWidth, 70, "F");
  doc.setTextColor(240, 231, 201);
  doc.setFont("times", "bold");
  doc.setFontSize(18);
  doc.text("GENERAL PROVIDENT FUND", 40, 32);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Personal Passbook & Ledger Report", 40, 48);

  doc.setTextColor(...INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(employee.name || "Unnamed Employee", 40, 96);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  const details = [
    employee.perNo ? `Personal No: ${employee.perNo}` : null,
    employee.gpfNo ? `GPF Reference No: ${employee.gpfNo}` : null,
    `Fund opened: ${employee.years[0] ? employee.years[0].fy : "-"}`,
  ].filter(Boolean);
  doc.text(details.join("   |   "), 40, 112);

  const rows = employee.years.map((y, i) => {
    const c = computed[i];
    return [
      y.fy,
      String(y.bps).padStart(2, "0"),
      c.opening.toLocaleString(),
      c.totalSub.toLocaleString(),
      (c.totalRefund + c.totalTransfer).toLocaleString(),
      c.totalWithdrawal.toLocaleString(),
      Math.round(c.profit).toLocaleString(),
      c.closing.toLocaleString(),
    ];
  });

  autoTable(doc, {
    startY: 130,
    head: [["Fiscal Year", "BPS", "Opening", "Subscription", "Refund/Transfer", "Withdrawal", "Interest", "Closing Balance"]],
    body: rows,
    styles: { font: "helvetica", fontSize: 8.5, cellPadding: 5 },
    headStyles: { fillColor: INK, textColor: [240, 231, 201] },
    alternateRowStyles: { fillColor: [247, 241, 225] },
    columnStyles: { 0: { fontStyle: "bold" } },
    margin: { left: 40, right: 40 },
  });

  const finalY = doc.lastAutoTable.finalY || 140;
  const finalClosing = computed.length ? computed[computed.length - 1].closing : 0;

  doc.setDrawColor(...BRASS);
  doc.setLineWidth(1.2);
  doc.roundedRect(40, finalY + 24, 220, 48, 6, 6);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...BRASS);
  doc.text("GPF FINAL BALANCE", 52, finalY + 42);
  doc.setFontSize(16);
  doc.text(`Rs. ${finalClosing.toLocaleString()}`, 52, finalY + 62);

  doc.setTextColor(140, 140, 140);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text(`Generated ${new Date().toLocaleDateString()} — GPF Passbook`, 40, doc.internal.pageSize.getHeight() - 24);

  return doc;
}

export function pdfToBase64(doc) {
  return doc.output("datauristring").split(",")[1];
}
