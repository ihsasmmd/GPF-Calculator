// A tiny, self-contained PDF byte-writer. No external library, no CDN —
// everything the GPF report needs (rectangles, left/right-aligned text,
// multiple pages) using the PDF spec's built-in "base 14" fonts, which
// every PDF reader supports without any font file being embedded.
//
// This exists so PDF export works fully offline, inside the installed
// PWA/APK, with zero network dependency — a prior version pulled jsPDF
// from a CDN, which silently failed without a live connection.

const PAGE_W = 595.28; // A4 in points
const PAGE_H = 841.89;

// Map a handful of common non-ASCII punctuation marks to their WinAnsi
// (CP1252) byte, since PDF's base14 fonts use single-byte WinAnsiEncoding.
// Anything else outside Latin-1 falls back to "?".
const CHAR_MAP = {
  0x2014: 0x97, // em dash —
  0x2013: 0x96, // en dash –
  0x2018: 0x91, // left single quote
  0x2019: 0x92, // right single quote
  0x201c: 0x93, // left double quote
  0x201d: 0x94, // right double quote
  0x2026: 0x85, // ellipsis …
  0x2022: 0x95, // bullet •
};

function toLatin1Bytes(str) {
  const out = [];
  for (const ch of String(str)) {
    const cp = ch.codePointAt(0);
    if (cp <= 0x7e) out.push(cp);
    else if (CHAR_MAP[cp] !== undefined) out.push(CHAR_MAP[cp]);
    else if (cp <= 0xff) out.push(cp);
    else out.push(0x3f); // "?"
  }
  return out;
}

function escapePdfText(bytes) {
  // Escape ( ) \ inside a PDF literal string.
  let s = "";
  for (const b of bytes) {
    if (b === 0x28 || b === 0x29 || b === 0x5c) s += "\\" + String.fromCharCode(b);
    else s += String.fromCharCode(b);
  }
  return s;
}

const FONT_WIDTH_FACTOR = { Helvetica: 0.5, "Helvetica-Bold": 0.53, Courier: 0.6, "Courier-Bold": 0.6 };

function textWidth(str, font, size) {
  const factor = FONT_WIDTH_FACTOR[font] || 0.5;
  return String(str).length * size * factor;
}

export class SimplePdf {
  constructor() {
    this.pages = []; // each: { commands: [], }
    this.fontsUsed = new Set();
    this._newPage();
  }

  _newPage() {
    this.page = { commands: [] };
    this.pages.push(this.page);
  }

  addPage() {
    this._newPage();
  }

  _cmd(s) {
    this.page.commands.push(s);
  }

  setFillColor(r, g, b) {
    this._cmd(`${(r / 255).toFixed(3)} ${(g / 255).toFixed(3)} ${(b / 255).toFixed(3)} rg`);
  }

  setStrokeColor(r, g, b) {
    this._cmd(`${(r / 255).toFixed(3)} ${(g / 255).toFixed(3)} ${(b / 255).toFixed(3)} RG`);
  }

  setLineWidth(w) {
    this._cmd(`${w} w`);
  }

  /** Rectangle with y measured from the TOP of the page (more intuitive for a report layout). */
  rect(x, yTop, w, h, mode = "S") {
    const y = PAGE_H - yTop - h;
    this._cmd(`${x} ${y} ${w} ${h} re ${mode === "F" ? "f" : mode === "FD" ? "B" : "S"}`);
  }

  setTextColor(r, g, b) {
    this._cmd(`${(r / 255).toFixed(3)} ${(g / 255).toFixed(3)} ${(b / 255).toFixed(3)} rg`);
    this._textColorSet = true;
  }

  /** Text with y measured from the TOP of the page, baseline at that y. align: left|right|center. */
  text(x, yTop, str, { font = "Helvetica", size = 10, align = "left" } = {}) {
    this.fontsUsed.add(font);
    const y = PAGE_H - yTop;
    let drawX = x;
    if (align === "right") drawX = x - textWidth(str, font, size);
    else if (align === "center") drawX = x - textWidth(str, font, size) / 2;
    const bytes = toLatin1Bytes(str);
    const escaped = escapePdfText(bytes);
    this._cmd(`BT /${font} ${size} Tf ${drawX.toFixed(2)} ${y.toFixed(2)} Td (${escaped}) Tj ET`);
  }

  textWidth(str, font = "Helvetica", size = 10) {
    return textWidth(str, font, size);
  }

  get pageWidth() {
    return PAGE_W;
  }
  get pageHeight() {
    return PAGE_H;
  }

  /** Serialize to a Uint8Array containing the full PDF file. */
  output() {
    const objects = []; // array of strings/byte-arrays; index+1 = object number
    const fontNames = ["Helvetica", "Helvetica-Bold", "Courier", "Courier-Bold"];
    const fontObjNums = {};

    // Reserve object 1 = Catalog, 2 = Pages — filled in after we know kid ids.
    objects.push(null); // 1: Catalog placeholder
    objects.push(null); // 2: Pages placeholder

    // Font objects
    fontNames.forEach((name) => {
      const num = objects.length + 1;
      fontObjNums[name] = num;
      objects.push(`<< /Type /Font /Subtype /Type1 /BaseFont /${name} /Encoding /WinAnsiEncoding >>`);
    });

    const resourceDict = `<< /Font << ${fontNames.map((n) => `/${n} ${fontObjNums[n]} 0 R`).join(" ")} >> >>`;

    const pageObjNums = [];
    const contentObjNums = [];
    this.pages.forEach((p) => {
      const stream = p.commands.join("\n");
      const contentObjNum = objects.length + 1;
      objects.push({ stream });
      contentObjNums.push(contentObjNum);

      const pageObjNum = objects.length + 1;
      objects.push(null); // placeholder, filled below once we know parent num
      pageObjNums.push(pageObjNum);
    });

    const pagesObjNum = 2;
    // Fill in page objects now that we know everything
    pageObjNums.forEach((pageObjNum, i) => {
      objects[pageObjNum - 1] =
        `<< /Type /Page /Parent ${pagesObjNum} 0 R /MediaBox [0 0 ${PAGE_W.toFixed(2)} ${PAGE_H.toFixed(2)}] ` +
        `/Resources ${resourceDict} /Contents ${contentObjNums[i]} 0 R >>`;
    });

    objects[0] = `<< /Type /Catalog /Pages ${pagesObjNum} 0 R >>`;
    objects[1] = `<< /Type /Pages /Kids [ ${pageObjNums.map((n) => `${n} 0 R`).join(" ")} ] /Count ${pageObjNums.length} >>`;

    // --- Serialize ---
    const enc = new TextEncoder();
    const chunks = [];
    let offset = 0;
    const offsets = [];

    function push(str) {
      const bytes = enc.encode(str);
      chunks.push(bytes);
      offset += bytes.length;
    }

    push("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");

    objects.forEach((obj, i) => {
      offsets.push(offset);
      const num = i + 1;
      if (obj && typeof obj === "object" && "stream" in obj) {
        const streamBytes = enc.encode(obj.stream);
        push(`${num} 0 obj\n<< /Length ${streamBytes.length} >>\nstream\n`);
        chunks.push(streamBytes);
        offset += streamBytes.length;
        push("\nendstream\nendobj\n");
      } else {
        push(`${num} 0 obj\n${obj}\nendobj\n`);
      }
    });

    const xrefStart = offset;
    let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    offsets.forEach((off) => {
      xref += `${String(off).padStart(10, "0")} 00000 n \n`;
    });
    push(xref);
    push(`trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`);

    const total = chunks.reduce((s, c) => s + c.length, 0);
    const out = new Uint8Array(total);
    let pos = 0;
    for (const c of chunks) {
      out.set(c, pos);
      pos += c.length;
    }
    return out;
  }
}
