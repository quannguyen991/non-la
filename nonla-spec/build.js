const fs = require("fs");
const L = require("./lib");
const d = L.d;
const {
  Document, Packer, Paragraph, TextRun, AlignmentType, LevelFormat,
  Footer, PageNumber, TableOfContents, BorderStyle, PageBreak,
} = d;

const { BRAND, BRAND_DARK, TEXT, MUTED } = L;

/* ---------- Trang bìa ---------- */
function cover() {
  const c = [];
  c.push(new Paragraph({ spacing: { after: 1300 }, children: [] }));

  c.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 100 },
    children: [new TextRun({ text: "ĐẶC TẢ SẢN PHẨM AI", bold: true, size: 28, color: MUTED, font: "Calibri", characterSpacing: 80 })],
  }));
  c.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 60 },
    children: [new TextRun({ text: "NÓN LÁ", bold: true, size: 88, color: BRAND_DARK, font: "Calibri" })],
  }));
  c.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 60 },
    children: [new TextRun({ text: "Lớp tự tin cho hành trình Việt Nam", size: 26, color: BRAND, font: "Calibri" })],
  }));
  c.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 400 },
    children: [new TextRun({ text: "“Đi Việt Nam mà không phải đoán.”", italics: true, size: 24, color: MUTED, font: "Calibri" })],
  }));

  c.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    border: { top: { style: BorderStyle.SINGLE, size: 8, color: BRAND, space: 10 } },
    spacing: { before: 200, after: 200 },
    children: [],
  }));

  c.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 120 },
    children: [new TextRun({ text: "Đặc tả triển khai — 28 tính năng · 6 engine · 6 tuần", bold: true, size: 24, color: TEXT, font: "Calibri" })],
  }));
  c.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 500 },
    children: [new TextRun({ text: "Phát triển từ đề bài “Tourist shield” — Vietnam AI Innovation Challenge · Đại học Duy Tân", size: 20, color: MUTED, font: "Calibri", italics: true })],
  }));

  c.push(L.table([25, 25, 25, 25], [
    ["Định vị", "Người dùng", "Phạm vi MVP", "Nền tảng"],
    [
      { t: "Hạ tầng làm du lịch Việt Nam đáng tin cậy hơn", size: 18 },
      { t: "Khách quốc tế, người bán tử tế, và người Việt bản địa", size: 18 },
      { t: "Hội An, Hoàn Kiếm Hà Nội, Quận 1 TP.HCM", size: 18 },
      { t: "Mobile camera-first, chạy được offline", size: 18 },
    ],
  ]));

  c.push(new Paragraph({ spacing: { after: 600 }, children: [] }));
  c.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "Tài liệu nội bộ — 2026", size: 20, color: MUTED, font: "Calibri" })],
  }));

  c.push(new Paragraph({ children: [new PageBreak()] }));
  return c;
}

function toc() {
  return [
    L.h1("Mục lục"),
    new Paragraph({ spacing: { after: 200 }, children: [] }),
    new TableOfContents("Mục lục", { hyperlink: true, headingStyleRange: "1-2" }),
    new Paragraph({ children: [new PageBreak()] }),
  ];
}

const doc = new Document({
  creator: "Nón Lá",
  title: "Nón Lá — Đặc tả sản phẩm",
  description: "28 tính năng, 6 engine, kế hoạch 6 tuần",
  styles: {
    default: { document: { run: { font: "Calibri", size: 21, color: TEXT } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { font: "Calibri", size: 32, bold: true, color: BRAND_DARK } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { font: "Calibri", size: 26, bold: true, color: BRAND } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { font: "Calibri", size: 23, bold: true, color: TEXT } },
    ],
  },
  numbering: {
    config: [
      {
        reference: "bullets",
        levels: [
          { level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 380, hanging: 220 } }, run: { color: BRAND, bold: true } } },
          { level: 1, format: LevelFormat.BULLET, text: "–", alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 760, hanging: 220 } }, run: { color: BRAND } } },
        ],
      },
      {
        reference: "numbers",
        levels: [
          { level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 400, hanging: 240 } }, run: { color: BRAND, bold: true } } },
        ],
      },
    ],
  },
  sections: [{
    properties: { page: { margin: { top: 1300, right: 1440, bottom: 1300, left: 1440 } } },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          border: { top: { style: BorderStyle.SINGLE, size: 4, color: "DCE8E1" }, },
          children: [
            new TextRun({ text: "Nón Lá · Đặc tả sản phẩm  —  ", size: 17, color: MUTED, font: "Calibri" }),
            new TextRun({ children: [PageNumber.CURRENT], size: 17, color: MUTED, font: "Calibri" }),
          ],
        })],
      }),
    },
    children: [
      ...cover(),
      ...toc(),
      ...require("./content1")(),
      ...require("./content2")(),
      ...require("./content3")(),
    ],
  }],
});

Packer.toBuffer(doc).then((buf) => {
  const out = process.argv[2] || "D:/Non_La_Dac_Ta_San_Pham.docx";
  fs.writeFileSync(out, buf);
  console.log("OK ->", out, (buf.length / 1024).toFixed(1) + " KB");
});
