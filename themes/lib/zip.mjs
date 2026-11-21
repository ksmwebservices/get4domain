// A small, dependency-free ZIP writer and reader (node:zlib only).
// Writer: deterministic (sorted entries, fixed timestamps, fixed attributes) so the same files always give the same bytes and hash.
// Reader: only LISTS and lazily INFLATES entries; it never touches the disk and never runs anything. Every problem is reported, not thrown.
import zlib from 'node:zlib';

const SIG_LOCAL = 0x04034b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_END = 0x06054b50;
const DOS_TIME = 0;
const DOS_DATE = (0 << 9) | (1 << 5) | 1; // 1980-01-01

let CRC_TABLE;
export function crc32(buf) {
  if (!CRC_TABLE) {
    CRC_TABLE = new Uint32Array(256);
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; CRC_TABLE[n] = c >>> 0; }
  }
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** A path a package may contain: relative, forward slashes only, no empty/./.. segments, no drive letter, no NUL. */
export function isSafePath(p) {
  if (typeof p !== 'string' || p.length === 0 || p.length > 240) return false;
  if (p.includes('\0') || p.includes('\\') || p.startsWith('/') || /^[a-zA-Z]:/.test(p)) return false;
  return p.split('/').every((seg) => seg !== '' && seg !== '.' && seg !== '..');
}

/**
 * @param {{path:string,data:Buffer,symlink?:boolean}[]} entries
 * @param {{store?:boolean,allowUnsafePaths?:boolean,allowDuplicates?:boolean}} [opts] the allow* flags exist only so tests can build bad packages
 */
export function writeZip(entries, opts = {}) {
  const list = [...entries].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  const seen = new Set();
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const e of list) {
    if (!opts.allowUnsafePaths && !isSafePath(e.path)) throw new Error(`Unsafe path in package: ${JSON.stringify(e.path)}`);
    if (!opts.allowDuplicates && seen.has(e.path)) throw new Error(`Duplicate path in package: ${e.path}`);
    seen.add(e.path);
    const name = Buffer.from(e.path, 'utf8');
    const data = Buffer.isBuffer(e.data) ? e.data : Buffer.from(e.data);
    const method = opts.store || data.length < 64 ? 0 : 8;
    const body = method === 8 ? zlib.deflateRawSync(data, { level: 9 }) : data;
    const crc = crc32(data);

    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(SIG_LOCAL, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x0800, 6); lh.writeUInt16LE(method, 8);
    lh.writeUInt16LE(DOS_TIME, 10); lh.writeUInt16LE(DOS_DATE, 12); lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(body.length, 18); lh.writeUInt32LE(data.length, 22); lh.writeUInt16LE(name.length, 26); lh.writeUInt16LE(0, 28);
    locals.push(lh, name, body);

    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(SIG_CENTRAL, 0); ch.writeUInt16LE((3 << 8) | 20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0x0800, 8); ch.writeUInt16LE(method, 10);
    ch.writeUInt16LE(DOS_TIME, 12); ch.writeUInt16LE(DOS_DATE, 14); ch.writeUInt32LE(crc, 16);
    ch.writeUInt32LE(body.length, 20); ch.writeUInt32LE(data.length, 24); ch.writeUInt16LE(name.length, 28);
    ch.writeUInt32LE(((e.symlink ? 0o120777 : 0o100644) << 16) >>> 0, 38); ch.writeUInt32LE(offset, 42);
    centrals.push(ch, name);
    offset += lh.length + name.length + body.length;
  }
  const centralBuf = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(SIG_END, 0); end.writeUInt16LE(list.length, 8); end.writeUInt16LE(list.length, 10);
  end.writeUInt32LE(centralBuf.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, centralBuf, end]);
}

/**
 * @param {Buffer} buf
 * @returns {{entries:{path:string,size:number,csize:number,method:number,symlink:boolean,read:(limit?:number)=>Buffer}[], problems:string[]}}
 */
export function readZip(buf) {
  const problems = [];
  const entries = [];
  if (!Buffer.isBuffer(buf) || buf.length < 22) return { entries, problems: ['not a zip file (too short)'] };
  let end = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65535); i--) { if (buf.readUInt32LE(i) === SIG_END) { end = i; break; } }
  if (end < 0) return { entries, problems: ['not a zip file (no end-of-archive record)'] };
  const count = buf.readUInt16LE(end + 10);
  const cdSize = buf.readUInt32LE(end + 12);
  const cdOffset = buf.readUInt32LE(end + 16);
  if (count === 0xffff || cdOffset === 0xffffffff) return { entries, problems: ['zip64 archives are not accepted'] };
  if (cdOffset + cdSize > buf.length) return { entries, problems: ['corrupt zip (central directory outside the file)'] };

  let p = cdOffset;
  for (let i = 0; i < count; i++) {
    if (p + 46 > buf.length || buf.readUInt32LE(p) !== SIG_CENTRAL) { problems.push('corrupt zip (bad central directory entry)'); break; }
    const madeBy = buf.readUInt16LE(p + 4);
    const flags = buf.readUInt16LE(p + 8);
    const method = buf.readUInt16LE(p + 10);
    const csize = buf.readUInt32LE(p + 20);
    const size = buf.readUInt32LE(p + 24);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const ext = buf.readUInt32LE(p + 38);
    const lhOffset = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    p += 46 + nameLen + extraLen + commentLen;
    if (flags & 1) { problems.push(`encrypted entry refused: ${name}`); continue; }
    if (method !== 0 && method !== 8) { problems.push(`unsupported compression in ${name}`); continue; }
    const unixMode = madeBy >> 8 === 3 ? (ext >>> 16) & 0o170000 : 0;
    const symlink = unixMode === 0o120000;
    entries.push({
      path: name, size, csize, method, symlink,
      read(limit = size) {
        if (lhOffset + 30 > buf.length || buf.readUInt32LE(lhOffset) !== SIG_LOCAL) throw new Error(`corrupt zip (bad local header for ${name})`);
        const n = buf.readUInt16LE(lhOffset + 26);
        const x = buf.readUInt16LE(lhOffset + 28);
        const start = lhOffset + 30 + n + x;
        if (start + csize > buf.length) throw new Error(`corrupt zip (data outside the file for ${name})`);
        const body = buf.subarray(start, start + csize);
        if (method === 0) return Buffer.from(body);
        return zlib.inflateRawSync(body, { maxOutputLength: Math.max(1, limit) });
      },
    });
  }
  return { entries, problems };
}
