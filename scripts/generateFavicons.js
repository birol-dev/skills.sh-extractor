import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const SVG_CONTENT = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#18181b"/>
      <stop offset="100%" stop-color="#09090b"/>
    </linearGradient>
    <linearGradient id="topFill" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#27272a"/>
      <stop offset="100%" stop-color="#141417"/>
    </linearGradient>
  </defs>

  <!-- Base Squircle with Safe Padding for Google Circular Crop -->
  <rect x="24" y="24" width="464" height="464" rx="108" fill="url(#bgGrad)" stroke="#3f3f46" stroke-width="12"/>

  <!-- Top Layer Rhombus -->
  <polygon points="256,115 390,180 256,245 122,180" fill="url(#topFill)" stroke="#ffffff" stroke-width="26" stroke-linejoin="round"/>

  <!-- Middle Layer Chevron -->
  <path d="M 122,250 L 256,315 L 390,250" fill="none" stroke="#ffffff" stroke-width="26" stroke-linecap="round" stroke-linejoin="round"/>

  <!-- Bottom Layer Chevron -->
  <path d="M 122,320 L 256,385 L 390,320" fill="none" stroke="#d4d4d8" stroke-width="26" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
`;

function createIco(buffers) {
  // buffers = array of { width, height, buffer }
  const count = buffers.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type 1 = ICO
  header.writeUInt16LE(count, 4); // number of images

  let currentOffset = 6 + count * 16;
  const entries = [];
  const imageBuffers = [];

  for (const img of buffers) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(img.width >= 256 ? 0 : img.width, 0);
    entry.writeUInt8(img.height >= 256 ? 0 : img.height, 1);
    entry.writeUInt8(0, 2); // palette count
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(img.buffer.length, 8); // image size
    entry.writeUInt32LE(currentOffset, 12); // image offset

    entries.push(entry);
    imageBuffers.push(img.buffer);
    currentOffset += img.buffer.length;
  }

  return Buffer.concat([header, ...entries, ...imageBuffers]);
}

async function main() {
  const publicDir = path.resolve('public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  // 1. Write favicon.svg
  const svgPath = path.join(publicDir, 'favicon.svg');
  fs.writeFileSync(svgPath, SVG_CONTENT.trim() + '\n', 'utf8');
  console.log('Created favicon.svg');

  const svgBuffer = Buffer.from(SVG_CONTENT);

  // 2. Generate PNGs: 16, 32, 48, 96, 180, 192, 512
  const sizes = [
    { size: 16, file: null },
    { size: 32, file: 'favicon-32x32.png' },
    { size: 48, file: 'favicon-48x48.png' },
    { size: 96, file: 'favicon-96x96.png' },
    { size: 180, file: 'apple-touch-icon.png' },
    { size: 192, file: 'web-app-manifest-192x192.png' },
    { size: 512, file: 'web-app-manifest-512x512.png' }
  ];

  const renderedBuffers = {};

  for (const s of sizes) {
    const buf = await sharp(svgBuffer)
      .resize(s.size, s.size)
      .png({ compressionLevel: 9 })
      .toBuffer();
    renderedBuffers[s.size] = buf;
    if (s.file) {
      fs.writeFileSync(path.join(publicDir, s.file), buf);
      console.log(`Created ${s.file} (${s.size}x${s.size})`);
    }
  }

  // Also duplicate apple-touch-icon with 180x180 precomposed if needed
  fs.copyFileSync(
    path.join(publicDir, 'apple-touch-icon.png'),
    path.join(publicDir, 'apple-touch-icon-precomposed.png')
  );

  // 3. Generate favicon.ico containing 16x16, 32x32, 48x48
  const icoBuffer = createIco([
    { width: 16, height: 16, buffer: renderedBuffers[16] },
    { width: 32, height: 32, buffer: renderedBuffers[32] },
    { width: 48, height: 48, buffer: renderedBuffers[48] }
  ]);
  fs.writeFileSync(path.join(publicDir, 'favicon.ico'), icoBuffer);
  console.log('Created favicon.ico (16, 32, 48 multi-resolution)');

  // 4. Generate site.webmanifest
  const manifest = {
    name: 'Skill Extractor',
    short_name: 'Skill Extractor',
    description: 'WebAssembly AI Agent Playbook Compiler',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#09090b',
    theme_color: '#09090b',
    icons: [
      {
        src: '/web-app-manifest-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable any'
      },
      {
        src: '/web-app-manifest-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable any'
      }
    ]
  };
  fs.writeFileSync(
    path.join(publicDir, 'site.webmanifest'),
    JSON.stringify(manifest, null, 2) + '\n',
    'utf8'
  );
  console.log('Created site.webmanifest');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
