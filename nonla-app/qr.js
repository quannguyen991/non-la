/* ═══════════════════════════════════════════════════════════════
   qr.js — bộ mã hoá QR tự viết, chế độ byte, không phụ thuộc gì

   VÌ SAO TỰ VIẾT
   Repo không có bước build và không có node_modules (ràng buộc gốc số
   một trong README). Một thư viện QR chép vào cũng được, nhưng khi đó
   có một tệp dài trong repo mà không ai trong nhóm giải thích được lúc
   giám khảo hỏi. Tệp này ngắn, theo đúng các bước của ISO/IEC 18004:

     1. dữ liệu → chuỗi bit (chế độ byte, UTF-8)
     2. chia khối, sinh mã sửa lỗi Reed–Solomon trên GF(256)
     3. đan khối, đặt vào ma trận quanh các mẫu cố định
     4. thử cả 8 mặt nạ, giữ mặt nạ có điểm phạt thấp nhất

   Chỉ cài chế độ byte: bảng giá là một đường dẫn, không cần chế độ số
   hay chữ-số. Phép thử trong test.mjs đọc ngược ma trận bằng OpenCV
   (tools/doc-qr.py) chứ không so với chính nó — tự so với mình thì
   một lỗi đặt bit sai sẽ đúng ở cả hai phía.
   ═══════════════════════════════════════════════════════════════ */

const ECC = { L: 0, M: 1, Q: 2, H: 3 };
const ECC_BITS = { L: 1, M: 0, Q: 3, H: 2 };

/* Số mã sửa lỗi mỗi khối và số khối, theo phiên bản 1..40, cho L M Q H. */
const EC_PER_BLOCK = [
  [7,10,13,17],[10,16,22,28],[15,26,18,22],[20,18,26,16],[26,24,18,22],
  [18,16,24,28],[20,18,18,26],[24,22,22,26],[30,22,20,24],[18,26,24,28],
  [20,30,28,24],[24,22,26,28],[26,22,24,22],[30,24,20,24],[22,24,30,24],
  [24,28,24,30],[28,28,28,28],[30,26,28,28],[28,26,26,26],[28,26,30,28],
  [28,26,28,30],[28,28,30,24],[30,28,30,30],[30,28,30,30],[26,28,30,30],
  [28,28,28,30],[30,28,30,30],[30,28,30,30],[30,28,30,30],[30,28,30,30],
  [30,28,30,30],[30,28,30,30],[30,28,30,30],[30,28,30,30],[30,28,30,30],
  [30,28,30,30],[30,28,30,30],[30,28,30,30],[30,28,30,30],[30,28,30,30],
];
const NUM_BLOCKS = [
  [1,1,1,1],[1,1,1,1],[1,1,2,2],[1,2,2,4],[1,2,4,4],
  [2,4,4,4],[2,4,6,5],[2,4,6,6],[2,5,8,8],[4,5,8,8],
  [4,5,8,11],[4,8,10,11],[4,9,12,16],[4,9,16,16],[6,10,12,18],
  [6,10,17,16],[6,11,16,19],[6,13,18,21],[7,14,21,25],[8,16,20,25],
  [8,17,23,25],[9,17,23,34],[9,18,25,30],[10,20,27,32],[12,21,29,35],
  [12,23,34,37],[12,25,34,40],[13,26,35,42],[14,28,38,45],[15,29,40,48],
  [16,31,43,51],[17,33,45,54],[18,35,48,57],[19,37,51,60],[19,38,53,63],
  [20,40,56,66],[21,43,59,70],[22,45,62,74],[24,47,65,77],[25,49,68,81],
];

/* Số ô dữ liệu thô (bit) của một phiên bản, trừ mọi mẫu cố định. */
function rawModules(ver) {
  let r = (16 * ver + 128) * ver + 64;
  if (ver >= 2) {
    const n = Math.floor(ver / 7) + 2;
    r -= (25 * n - 10) * n - 55;
    if (ver >= 7) r -= 36;
  }
  return r;
}
const dataCodewords = (ver, e) =>
  Math.floor(rawModules(ver) / 8) - EC_PER_BLOCK[ver - 1][ECC[e]] * NUM_BLOCKS[ver - 1][ECC[e]];

/* ── Reed–Solomon trên GF(256), đa thức 0x11D ── */
function gfMul(x, y) {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z & 0xff;
}
function rsDivisor(deg) {
  const r = new Array(deg).fill(0);
  r[deg - 1] = 1;
  let root = 1;
  for (let i = 0; i < deg; i++) {
    for (let j = 0; j < deg; j++) {
      r[j] = gfMul(r[j], root);
      if (j + 1 < deg) r[j] ^= r[j + 1];
    }
    root = gfMul(root, 2);
  }
  return r;
}
function rsRemainder(data, div) {
  const r = new Array(div.length).fill(0);
  for (const b of data) {
    const f = b ^ r.shift();
    r.push(0);
    div.forEach((c, i) => (r[i] ^= gfMul(c, f)));
  }
  return r;
}

/* ── ma trận ── */
function alignPositions(ver) {
  if (ver === 1) return [];
  const n = Math.floor(ver / 7) + 2;
  const step = ver === 32 ? 26 : Math.ceil((ver * 4 + 4) / (n * 2 - 2)) * 2;
  const out = [6];
  for (let pos = ver * 4 + 10; out.length < n; pos -= step) out.splice(1, 0, pos);
  return out;
}

function baseMatrix(ver) {
  const size = ver * 4 + 17;
  const m = Array.from({ length: size }, () => new Array(size).fill(false));
  const fixed = Array.from({ length: size }, () => new Array(size).fill(false));
  const set = (x, y, v) => { m[y][x] = v; fixed[y][x] = true; };

  for (let i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
  const finder = (cx, cy) => {
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const x = cx + dx, y = cy + dy;
      if (x < 0 || y < 0 || x >= size || y >= size) continue;
      const d = Math.max(Math.abs(dx), Math.abs(dy));
      set(x, y, d !== 2 && d !== 4);
    }
  };
  finder(3, 3); finder(size - 4, 3); finder(3, size - 4);

  const al = alignPositions(ver);
  al.forEach((ax, i) => al.forEach((ay, j) => {
    if ((i === 0 && j === 0) || (i === 0 && j === al.length - 1) || (i === al.length - 1 && j === 0)) return;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++)
      set(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  }));

  /* chỗ dành cho thông tin định dạng — ghi thật sau khi chọn mặt nạ */
  for (let i = 0; i < 9; i++) { fixed[8][i] = true; fixed[i][8] = true; }
  for (let i = 0; i < 8; i++) { fixed[8][size - 1 - i] = true; fixed[size - 1 - i][8] = true; }
  set(8, size - 8, true);                       // ô tối cố định

  if (ver >= 7) {
    let rem = ver;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const bits = (ver << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const b = ((bits >>> i) & 1) === 1;
      const a = size - 11 + (i % 3), c = Math.floor(i / 3);
      set(a, c, b); set(c, a, b);
    }
  }
  return { m, fixed, size };
}

function drawFormat(m, size, e, mask) {
  const data = (ECC_BITS[e] << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  const bits = ((data << 10) | rem) ^ 0x5412;
  const b = (i) => ((bits >>> i) & 1) === 1;
  for (let i = 0; i <= 5; i++) m[i][8] = b(i);
  m[7][8] = b(6); m[8][8] = b(7); m[8][7] = b(8);
  for (let i = 9; i < 15; i++) m[8][14 - i] = b(i);
  for (let i = 0; i < 8; i++) m[8][size - 1 - i] = b(i);
  for (let i = 8; i < 15; i++) m[size - 15 + i][8] = b(i);
  m[size - 8][8] = true;
}

const MASKS = [
  (x, y) => (x + y) % 2 === 0,
  (x, y) => y % 2 === 0,
  (x) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

function penalty(m, size) {
  let p = 0;
  const line = (get) => {
    for (let a = 0; a < size; a++) {
      let run = 1;
      for (let b = 1; b < size; b++) {
        if (get(a, b) === get(a, b - 1)) { run++; if (run === 5) p += 3; else if (run > 5) p++; }
        else run = 1;
      }
      for (let b = 0; b + 10 < size + 4; b++) {
        /* mẫu 1011101 kèm 4 ô sáng một phía (ngoài biên coi là sáng) */
        const g = (k) => (k < 0 || k >= size ? false : get(a, k));
        const core = g(b) && !g(b + 1) && g(b + 2) && g(b + 3) && g(b + 4) && !g(b + 5) && g(b + 6);
        if (!core) continue;
        const before = !g(b - 1) && !g(b - 2) && !g(b - 3) && !g(b - 4);
        const after = !g(b + 7) && !g(b + 8) && !g(b + 9) && !g(b + 10);
        if (before || after) p += 40;
      }
    }
  };
  line((a, b) => m[a][b]);
  line((a, b) => m[b][a]);
  for (let y = 0; y + 1 < size; y++) for (let x = 0; x + 1 < size; x++) {
    const c = m[y][x];
    if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1]) p += 3;
  }
  let dark = 0;
  for (const r of m) for (const c of r) if (c) dark++;
  const total = size * size;
  p += Math.max(0, Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;
  return p;
}

const utf8 = (s) => Array.from(new TextEncoder().encode(s));

/**
 * Mã hoá một chuỗi thành ma trận QR.
 * @returns { size, version, ecc, mask, modules: boolean[][] }  (true = ô tối)
 */
export function encode(text, { ecc = "M", minVersion = 1, mask: ep = null } = {}) {
  const bytes = utf8(String(text));
  let ver = minVersion, cap;
  for (; ver <= 40; ver++) {
    cap = dataCodewords(ver, ecc) * 8;
    const need = 4 + (ver < 10 ? 8 : 16) + bytes.length * 8;
    if (need <= cap) break;
  }
  if (ver > 40) throw new Error("qr: dữ liệu quá dài");

  const bits = [];
  const push = (v, n) => { for (let i = n - 1; i >= 0; i--) bits.push((v >>> i) & 1); };
  push(0b0100, 4);
  push(bytes.length, ver < 10 ? 8 : 16);
  bytes.forEach((b) => push(b, 8));
  push(0, Math.min(4, cap - bits.length));
  push(0, (8 - (bits.length % 8)) % 8);
  for (let pad = 0xec; bits.length < cap; pad ^= 0xec ^ 0x11) push(pad, 8);

  const data = [];
  for (let i = 0; i < bits.length; i += 8) data.push(parseInt(bits.slice(i, i + 8).join(""), 2));

  /* chia khối + sửa lỗi + đan */
  const nb = NUM_BLOCKS[ver - 1][ECC[ecc]];
  const ecLen = EC_PER_BLOCK[ver - 1][ECC[ecc]];
  const raw = Math.floor(rawModules(ver) / 8);
  const shortLen = Math.floor(raw / nb);
  const numShort = nb - (raw % nb);
  const div = rsDivisor(ecLen);
  const blocks = [];
  for (let i = 0, k = 0; i < nb; i++) {
    const len = shortLen - ecLen + (i < numShort ? 0 : 1);
    const d = data.slice(k, k + len); k += len;
    const ec = rsRemainder(d, div);
    if (i < numShort) d.push(null);             // chỗ trống để đan cho đều
    blocks.push(d.concat(ec));
  }
  const final = [];
  for (let i = 0; i < blocks[0].length; i++)
    blocks.forEach((b) => { if (b[i] !== null) final.push(b[i]); });

  /* đặt bit theo đường zig-zag */
  const { m, fixed, size } = baseMatrix(ver);
  let bi = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let v = 0; v < size; v++) for (let j = 0; j < 2; j++) {
      const x = right - j;
      const up = ((right + 1) & 2) === 0;
      const y = up ? size - 1 - v : v;
      if (fixed[y][x]) continue;
      if (bi < final.length * 8) m[y][x] = ((final[bi >>> 3] >>> (7 - (bi & 7))) & 1) === 1;
      bi++;
    }
  }

  let best = null;
  for (let mask = 0; mask < 8; mask++) {
    if (ep != null && mask !== ep) continue;
    const t = m.map((r) => r.slice());
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++)
      if (!fixed[y][x] && MASKS[mask](x, y)) t[y][x] = !t[y][x];
    drawFormat(t, size, ecc, mask);
    const p = penalty(t, size);
    if (!best || p < best.p) best = { p, t, mask };
  }
  return { size, version: ver, ecc, mask: best.mask, modules: best.t };
}

/** SVG vuông, có lề trắng 4 ô như chuẩn đòi. */
export function toSVG(q, { quiet = 4, dark = "#000", light = "#fff" } = {}) {
  const n = q.size + quiet * 2;
  let d = "";
  q.modules.forEach((r, y) => r.forEach((c, x) => { if (c) d += `M${x + quiet} ${y + quiet}h1v1h-1z`; }));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges">`
    + `<rect width="${n}" height="${n}" fill="${light}"/><path d="${d}" fill="${dark}"/></svg>`;
}
