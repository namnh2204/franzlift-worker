import { mkdtemp, rm, writeFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');
const remote = process.argv.includes('--remote');
if (!remote) {
  console.error('Refusing to migrate without --remote. Local data is production-like and must not be imported accidentally.');
  process.exit(1);
}
if (!process.env.CLOUDFLARE_API_TOKEN) {
  console.error('CLOUDFLARE_API_TOKEN is required.');
  process.exit(1);
}

function run(args) {
  return new Promise((resolve, reject) => {
    const child = spawn('npx', ['wrangler', ...args], { cwd: root, stdio: 'inherit', env: process.env });
    child.on('error', reject);
    child.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`wrangler exited with ${code}`)));
  });
}

const sqlString = (value) => `'${String(value).replaceAll("'", "''")}'`;
const temporary = await mkdtemp(path.join(tmpdir(), 'franzlift-migrate-'));
try {
  const [{ readFile }, content, sourceUploadsMap] = await Promise.all([
    import('node:fs/promises'),
    import('../data/content.json', { with: { type: 'json' } }).then((module) => module.default),
    import('../data/uploads-map.json', { with: { type: 'json' } }).then((module) => module.default),
  ]);
  const uploadsDir = path.join(root, 'data', 'uploads');
  const files = await readdir(uploadsDir, { withFileTypes: true });
  const uploadFiles = files.filter((item) => item.isFile());
  const uploadNames = new Set(uploadFiles.map((entry) => entry.name));
  const uploadsMap = {};
  const skippedMapEntries = [];
  for (const [url, entry] of Object.entries(sourceUploadsMap)) {
    const missingObjects = [];
    for (const url of [entry.webp, ...(entry.srcset || []).map((variant) => variant.url)]) {
      const name = typeof url === 'string' && url.startsWith('/uploads/') ? url.slice('/uploads/'.length) : null;
      if (name && !uploadNames.has(name)) missingObjects.push(name);
    }
    if (missingObjects.length) skippedMapEntries.push({ url, missingObjects });
    else uploadsMap[url] = entry;
  }
  if (skippedMapEntries.length) {
    console.warn(`Skipping ${skippedMapEntries.length} broken upload-map entry or entries whose source files are absent.`);
  }
  const seed = [
    `INSERT INTO app_data (key, value) VALUES ('content', ${sqlString(JSON.stringify(content))}) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP;`,
    `INSERT INTO app_data (key, value) VALUES ('uploads_map', ${sqlString(JSON.stringify(uploadsMap))}) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP;`,
  ].join('\n');
  const seedPath = path.join(temporary, 'seed.sql');
  await writeFile(seedPath, seed, { mode: 0o600 });
  await run(['d1', 'migrations', 'apply', 'franzlift', '--remote']);
  await run(['d1', 'execute', 'franzlift', '--remote', '--file', seedPath]);

  for (const [index, entry] of uploadFiles.entries()) {
    const filePath = path.join(uploadsDir, entry.name);
    const signature = await readFile(filePath).then((buffer) => buffer.subarray(0, 12));
    const contentType = signature.subarray(8, 12).toString() === 'WEBP' ? 'image/webp' : 'application/octet-stream';
    await run(['r2', 'object', 'put', `franzlift-uploads/${entry.name}`, '--remote', '--file', filePath, '--content-type', contentType]);
    if ((index + 1) % 50 === 0) console.log(`Uploaded ${index + 1} objects`);
  }
  console.log('Cloudflare data migration complete.');
} finally {
  await rm(temporary, { recursive: true, force: true });
}
