// Puts a small test image in public/lab-images/test (an Arabic name with a space, like a lab's
// own files) before the build, for tests/e2e/training.images.cjs. Not committed (.gitignore).
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
const W = 24, H = 24;
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2; // 8-bit RGB
const raw = Buffer.alloc((W * 3 + 1) * H);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * (W * 3 + 1) + 1 + x * 3; raw[i] = 13; raw[i + 1] = 148; raw[i + 2] = 136; }
const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
const dir = path.join(__dirname, '..', '..', 'public', 'lab-images', 'test');
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'أنبوب اختبار.png'), png);
console.log('test image written');
