// Penulis dan pembaca ZIP sederhana (tanpa kompresi) untuk backup. Tidak butuh pustaka luar.

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function dosTime(d) {
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
    date: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

// entries: [{ name, data: Blob|string }]
export async function createZip(entries) {
  const enc = new TextEncoder();
  const parts = [];
  const central = [];
  let offset = 0;
  const { time, date } = dosTime(new Date());
  for (const e of entries) {
    const name = enc.encode(e.name);
    const bytes = typeof e.data === 'string' ? enc.encode(e.data) : new Uint8Array(await e.data.arrayBuffer());
    const crc = crc32(bytes);
    const h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true);
    h.setUint16(4, 20, true);
    h.setUint16(6, 0x0800, true); // nama file UTF-8
    h.setUint16(8, 0, true);
    h.setUint16(10, time, true);
    h.setUint16(12, date, true);
    h.setUint32(14, crc, true);
    h.setUint32(18, bytes.length, true);
    h.setUint32(22, bytes.length, true);
    h.setUint16(26, name.length, true);
    h.setUint16(28, 0, true);
    parts.push(h.buffer, name, bytes);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true);
    c.setUint16(4, 20, true);
    c.setUint16(6, 20, true);
    c.setUint16(8, 0x0800, true);
    c.setUint16(10, 0, true);
    c.setUint16(12, time, true);
    c.setUint16(14, date, true);
    c.setUint32(16, crc, true);
    c.setUint32(20, bytes.length, true);
    c.setUint32(24, bytes.length, true);
    c.setUint16(28, name.length, true);
    c.setUint32(42, offset, true);
    central.push(c.buffer, name);
    offset += 30 + name.length + bytes.length;
  }
  const centralSize = central.reduce((s, p) => s + p.byteLength, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, entries.length, true);
  end.setUint16(10, entries.length, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, offset, true);
  return new Blob([...parts, ...central, end.buffer], { type: 'application/zip' });
}

// Membaca ZIP buatan aplikasi ini (atau ZIP lain tanpa kompresi). Mengembalikan Map nama -> Blob.
export async function readZip(blob) {
  const buf = new DataView(await blob.arrayBuffer());
  let eocd = -1;
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 65557); i--) {
    if (buf.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('File bukan ZIP yang valid');
  const count = buf.getUint16(eocd + 10, true);
  let p = buf.getUint32(eocd + 16, true);
  const dec = new TextDecoder();
  const out = new Map();
  for (let i = 0; i < count; i++) {
    if (buf.getUint32(p, true) !== 0x02014b50) throw new Error('Struktur ZIP rusak');
    const method = buf.getUint16(p + 10, true);
    const size = buf.getUint32(p + 20, true);
    const nameLen = buf.getUint16(p + 28, true);
    const extraLen = buf.getUint16(p + 30, true);
    const commentLen = buf.getUint16(p + 32, true);
    const local = buf.getUint32(p + 42, true);
    const name = dec.decode(new Uint8Array(buf.buffer, p + 46, nameLen));
    if (method !== 0) throw new Error('ZIP terkompresi belum didukung: ' + name);
    const lNameLen = buf.getUint16(local + 26, true);
    const lExtraLen = buf.getUint16(local + 28, true);
    const start = local + 30 + lNameLen + lExtraLen;
    out.set(name, blob.slice(start, start + size));
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}
