// Generate responsive WebP variants + a dimensions map for raster assets.
// Run as part of `npm run build` (before CSS so the map exists at render time).
// For each PNG/JPG under public/assets-local sharp records intrinsic
// width/height and emits WebP variants at a set of widths (never upscaling).
// Templates use the map to build <picture> srcset/sizes + width/height so the
// browser can pick the right file and avoid layout shift.
// Idempotent: skips a variant whose file is newer than its source.
import sharp from 'sharp';
import { readdir, stat, writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const assetsDir = path.join(root, 'public', 'assets-local');
const dataDir = path.join(root, 'data');
const mapPath = path.join(dataDir, 'image-map.json');

const RASTER = /\.(png|jpe?g)$/i;
const WIDTHS = [480, 768, 1280, 1920];

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await walk(full));
    else if (RASTER.test(entry.name)) out.push(full);
  }
  return out;
}

async function newerThan(a, b) {
  try {
    const [sa, sb] = await Promise.all([stat(a), stat(b)]);
    return sa.mtimeMs > sb.mtimeMs;
  } catch {
    return false;
  }
}

const publicDir = path.join(root, 'public');
const files = await walk(assetsDir);
const map = {};

for (const file of files) {
  const rel = '/' + path.relative(publicDir, file).split(path.sep).join('/');
  const meta = await sharp(file).metadata();
  const base = file.replace(RASTER, '');
  const relBase = rel.replace(RASTER, '');

  // Candidate widths that don't upscale, plus the intrinsic width itself.
  const targets = [...new Set(WIDTHS.filter((w) => w < meta.width).concat(meta.width))]
    .sort((a, b) => a - b);

  const srcset = [];
  for (const w of targets) {
    const suffix = w === meta.width ? '' : '-' + w;
    const outFile = base + suffix + '.webp';
    const outRel = relBase + suffix + '.webp';
    srcset.push({ w, url: outRel });
    if (await newerThan(outFile, file)) continue;
    await sharp(file).resize({ width: w }).webp({ quality: 80, effort: 5 }).toFile(outFile);
  }

  map[rel] = {
    width: meta.width,
    height: meta.height,
    webp: srcset[srcset.length - 1].url,
    srcset,
  };
  console.log('webp', rel, meta.width + 'x' + meta.height, '->', srcset.length, 'variants');
}

await mkdir(dataDir, { recursive: true });
await writeFile(mapPath, JSON.stringify(map, null, 2) + '\n', 'utf8');
console.log('image-map.json written:', Object.keys(map).length, 'entries');
