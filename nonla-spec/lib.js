const d = require("docx");
const {
  Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell,
  WidthType, ShadingType, BorderStyle, PageBreak, Footer, PageNumber, TabStopType,
} = d;

const BRAND = "1F8A70";
const BRAND_DARK = "14624F";
const TEXT = "22261F";
const MUTED = "63705F";
const DANGER = "C0392B";
const WARN = "C8842B";
const OK = "1F8A70";
const LIGHT = "EFF7F3";
const GREY = "F7F9F6";

const CONTENT_W = 9020;

function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 400, after: 200 },
    children: [new TextRun({ text, bold: true, size: 32, color: BRAND_DARK, font: "Calibri" })],
    border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: BRAND, space: 6 } },
  });
}

function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 280, after: 140 },
    children: [new TextRun({ text, bold: true, size: 26, color: BRAND, font: "Calibri" })],
  });
}

function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 200, after: 100 },
    children: [new TextRun({ text, bold: true, size: 23, color: TEXT, font: "Calibri" })],
  });
}

// rich text: array of [text, opts]
function rt(parts) {
  return parts.map(([text, opts = {}]) =>
    new TextRun({ text, font: "Calibri", size: 21, color: TEXT, ...opts })
  );
}

function p(text, opts = {}) {
  const { bold, italics, color, size, align, before, after, indent } = opts;
  return new Paragraph({
    alignment: align,
    spacing: { before: before ?? 60, after: after ?? 100, line: 276 },
    indent: indent ? { left: indent } : undefined,
    children: [new TextRun({ text, font: "Calibri", size: size ?? 21, color: color ?? TEXT, bold, italics })],
  });
}

function pr(parts, opts = {}) {
  return new Paragraph({
    alignment: opts.align,
    spacing: { before: opts.before ?? 60, after: opts.after ?? 100, line: 276 },
    indent: opts.indent ? { left: opts.indent } : undefined,
    children: rt(parts),
  });
}

function bullet(text, level = 0) {
  return new Paragraph({
    numbering: { reference: "bullets", level },
    spacing: { before: 30, after: 60, line: 268 },
    children: [new TextRun({ text, font: "Calibri", size: 21, color: TEXT })],
  });
}

function bulletR(parts, level = 0) {
  return new Paragraph({
    numbering: { reference: "bullets", level },
    spacing: { before: 30, after: 60, line: 268 },
    children: rt(parts),
  });
}

function num(text, level = 0) {
  return new Paragraph({
    numbering: { reference: "numbers", level },
    spacing: { before: 30, after: 60, line: 268 },
    children: [new TextRun({ text, font: "Calibri", size: 21, color: TEXT })],
  });
}

function numR(parts, level = 0) {
  return new Paragraph({
    numbering: { reference: "numbers", level },
    spacing: { before: 30, after: 60, line: 268 },
    children: rt(parts),
  });
}

// Callout box
function callout(title, lines, color = BRAND, fill = LIGHT) {
  const kids = [];
  if (title) {
    kids.push(new Paragraph({
      spacing: { before: 40, after: 60 },
      children: [new TextRun({ text: title, bold: true, size: 21, color, font: "Calibri" })],
    }));
  }
  lines.forEach((l, i) => {
    kids.push(new Paragraph({
      spacing: { before: 20, after: i === lines.length - 1 ? 40 : 60, line: 268 },
      children: Array.isArray(l) ? rt(l) : [new TextRun({ text: l, size: 21, color: TEXT, font: "Calibri" })],
    }));
  });
  return new Table({
    columnWidths: [CONTENT_W],
    width: { size: CONTENT_W, type: WidthType.DXA },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 2, color: fill },
      bottom: { style: BorderStyle.SINGLE, size: 2, color: fill },
      right: { style: BorderStyle.SINGLE, size: 2, color: fill },
      left: { style: BorderStyle.SINGLE, size: 24, color },
      insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      insideVertical: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    },
    rows: [new TableRow({
      children: [new TableCell({
        width: { size: CONTENT_W, type: WidthType.DXA },
        shading: { type: ShadingType.CLEAR, fill },
        margins: { top: 120, bottom: 120, left: 180, right: 180 },
        children: kids,
      })],
    })],
  });
}

function code(lines) {
  const kids = lines.map((l, i) => new Paragraph({
    spacing: { before: 0, after: 0, line: 240 },
    children: [new TextRun({ text: l || " ", font: "Consolas", size: 18, color: "23372E" })],
  }));
  return new Table({
    columnWidths: [CONTENT_W],
    width: { size: CONTENT_W, type: WidthType.DXA },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: "DCE8E1" },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: "DCE8E1" },
      left: { style: BorderStyle.SINGLE, size: 4, color: "DCE8E1" },
      right: { style: BorderStyle.SINGLE, size: 4, color: "DCE8E1" },
      insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      insideVertical: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    },
    rows: [new TableRow({
      children: [new TableCell({
        width: { size: CONTENT_W, type: WidthType.DXA },
        shading: { type: ShadingType.CLEAR, fill: "F6FAF8" },
        margins: { top: 140, bottom: 140, left: 180, right: 180 },
        children: kids,
      })],
    })],
  });
}

// rows: array of arrays of strings OR {t, b(old), c(olor), fill}
function table(widths, rows, opts = {}) {
  const total = widths.reduce((a, b) => a + b, 0);
  const scale = CONTENT_W / total;
  const cols = widths.map((w) => Math.round(w * scale));
  // fix rounding
  const diff = CONTENT_W - cols.reduce((a, b) => a + b, 0);
  cols[cols.length - 1] += diff;

  const trs = rows.map((row, ri) => {
    const isHeader = ri === 0 && opts.header !== false;
    return new TableRow({
      tableHeader: isHeader,
      children: row.map((cell, ci) => {
        const o = typeof cell === "string" ? { t: cell } : cell;
        const fill = o.fill || (isHeader ? BRAND : ri % 2 === 0 ? "FFFFFF" : GREY);
        return new TableCell({
          width: { size: cols[ci], type: WidthType.DXA },
          shading: { type: ShadingType.CLEAR, fill },
          margins: { top: 90, bottom: 90, left: 130, right: 130 },
          verticalAlign: d.VerticalAlign.CENTER,
          children: String(o.t).split("|").map((line, li) => new Paragraph({
            spacing: { before: li === 0 ? 0 : 40, after: 0, line: 264 },
            alignment: o.align,
            children: [new TextRun({
              text: line,
              font: "Calibri",
              size: o.size ?? 19,
              bold: o.b ?? isHeader,
              color: o.c ?? (isHeader ? "FFFFFF" : TEXT),
            })],
          })),
        });
      }),
    });
  });

  return new Table({
    columnWidths: cols,
    width: { size: CONTENT_W, type: WidthType.DXA },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: "BFD8CD" },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: "BFD8CD" },
      left: { style: BorderStyle.SINGLE, size: 4, color: "BFD8CD" },
      right: { style: BorderStyle.SINGLE, size: 4, color: "BFD8CD" },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: "DCE8E1" },
      insideVertical: { style: BorderStyle.SINGLE, size: 2, color: "DCE8E1" },
    },
    rows: trs,
  });
}

const spacer = (n = 120) => new Paragraph({ spacing: { after: n }, children: [] });
const pageBreak = () => new Paragraph({ children: [new PageBreak()] });

module.exports = {
  d, BRAND, BRAND_DARK, TEXT, MUTED, DANGER, WARN, OK, LIGHT, GREY, CONTENT_W,
  h1, h2, h3, p, pr, rt, bullet, bulletR, num, numR, callout, code, table, spacer, pageBreak,
  Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell,
  WidthType, ShadingType, BorderStyle, Footer, PageNumber,
};
