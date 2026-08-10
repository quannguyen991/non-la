/* Rà các hàm bị gọi mà không còn định nghĩa trong một module.
   Dùng sau khi vá file bằng thay-thế-chuỗi: kiểu vá đó có thể xoá
   nhầm hàm nằm trong đoạn bị thay, và lỗi chỉ lộ ra lúc chạy.
   Chạy: node tools/scan-undefined.mjs <file...>                   */
import { readFileSync } from "fs";

const KW = new Set([
  "if", "for", "while", "switch", "catch", "return", "function", "typeof",
  "new", "await", "of", "in", "do", "else", "try", "parseFloat", "parseInt",
  "setTimeout", "clearTimeout", "clearInterval", "setInterval", "isFinite",
  "requestAnimationFrame", "cancelAnimationFrame", "encodeURIComponent",
  "decodeURIComponent", "isNaN", "res", "rej", "resolve", "reject", "fetch",
  "structuredClone", "queueMicrotask", "getComputedStyle", "not", "matchMedia",
  // hàm CSS nằm trong chuỗi — không phải lời gọi JS
  "scale", "translate", "translateX", "translateY", "rotate", "var", "rgba",
  "rgb", "calc", "min", "max", "clamp", "url", "blur", "linear", "cubic",
  // phương thức gọi trên biến cục bộ mà bộ rà thô không lần ra chủ thể
  "add", "clear", "has", "get", "set", "delete", "push", "map", "filter",
  "key", "async", "then", "catch",
]);

let bad = 0;
for (const file of process.argv.slice(2)) {
  const src = readFileSync(file, "utf8");
  const defined = new Set();
  const add = (re, g = 1) => {
    for (const m of src.matchAll(re)) {
      if (g === "list") m[1].split(",").forEach((x) => defined.add(x.trim().split(/\s+as\s+/).pop()));
      else defined.add(m[g]);
    }
  };
  add(/(?:^|\n)\s*(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g);
  // khai báo nhiều biến một dòng: `const R = 6371000, rad = (x) => ...`
  // — bắt cả biến sau dấu phẩy, không chỉ biến đầu.
  add(/(?:(?:^|\n)\s*(?:export\s+)?(?:const|let|var)\s+|,\s*)([A-Za-z_$][\w$]*)\s*=/g);
  add(/\bclass\s+([A-Za-z_$][\w$]*)/g);
  add(/\bget\s+([a-z_$][\w$]*)\s*\(/g);
  add(/import\s*\{([^}]+)\}/g, "list");
  // tham số hàm và biến cục bộ trong ngoặc: coi như đã định nghĩa
  add(/(?:function\s*[\w$]*\s*|\()\s*([a-z_$][\w$]*)\s*(?:,|\)|=)/g);
  // phương thức của lớp và method shorthand trong object literal:
  //   fit(a, b) {   ·   async load() {   ·   toScreen(p) {
  // Thiếu mẫu này thì mọi phương thức bị báo là "không có định nghĩa".
  add(/(?:^|\n)\s{2,}(?:async\s+|\*\s*)?([a-z_$][\w$]*)\s*\([^()]*\)\s*\{/g);

  // Rà lời gọi trên bản ĐÃ BỎ CHÚ THÍCH. Chú thích tiếng Việt trong dự án
  // này hay viết "hàm paint() chạy khi…", và bộ rà thô đọc đó là lời gọi
  // thật rồi báo động giả — đủ nhiều để người ta bỏ qua cả báo động thật.
  const bare = new Map();
  const lines = src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    // Tách theo /\r?\n/ chứ không phải "\n": file ở đây có kết thúc dòng CRLF,
    // mà `.` trong regex JS KHÔNG khớp \r (nó là ký tự xuống dòng). Để sót \r
    // thì `//.*$` trượt ở mọi dòng và chú thích không hề bị bỏ.
    .split(/\r?\n/)
    .map((ln) => ln.replace(/\/\/.*$/, ""));
  lines.forEach((ln, i) => {
    // Loại cả ký tự Việt có dấu khỏi vị trí đứng trước. `\w` chỉ tính ASCII,
    // nên "cố định (CLS)" trong một chuỗi tiếng Việt bị đọc thành lời gọi
    // `nh(` — chữ `ị` không chặn được match nếu không kể ra ở đây.
    for (const m of ln.matchAll(/(^|[^.\w$'"`À-ɏḀ-ỿ])([a-z_$][\w$]*)\s*\(/g)) {
      if (!bare.has(m[2])) bare.set(m[2], i + 1);
    }
  });

  const missing = [...bare].filter(([n]) => !defined.has(n) && !KW.has(n));
  if (missing.length) {
    bad += missing.length;
    console.log(`\n${file}`);
    for (const [n, ln] of missing) console.log(`  dòng ${ln}: ${n}() không có định nghĩa`);
  } else {
    console.log(`${file}: ok`);
  }
}
process.exit(bad ? 1 : 0);
