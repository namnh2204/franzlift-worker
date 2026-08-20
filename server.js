import express from 'express';
import { readFile, writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import sharp from 'sharp';
import sanitizeHtml from 'sanitize-html';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

const dataDir = path.join(__dirname, 'data');
const contentPath = path.join(dataDir, 'content.json');
const uploadsDir = path.join(dataDir, 'uploads');
const uploadsMapPath = path.join(dataDir, 'uploads-map.json');
const buildMapPath = path.join(dataDir, 'image-map.json');

const CANONICAL_HOST = 'franzlift.vn';
const SITE_ORIGIN = 'https://' + CANONICAL_HOST;
const REDIRECT_HOSTS = new Set(['www.franzlift.vn']);

app.disable('x-powered-by');

const STATIC_PAGES = [
  { loc: '/', priority: '1.0' },
  { loc: '/gioi-thieu', priority: '0.7' },
  { loc: '/san-pham', priority: '0.9' },
  { loc: '/dich-vu', priority: '0.8' },
  { loc: '/du-an', priority: '0.8' },
  { loc: '/tin-tuc', priority: '0.7' },
  { loc: '/cong-nghe', priority: '0.7' },
  { loc: '/360VR', priority: '0.6' },
  { loc: '/lien-he', priority: '0.6' },
];

const PAGE_ROUTES = [
  { page: 'about', vi: '/gioi-thieu', old: '/about' },
  { page: 'products', vi: '/san-pham', old: '/products' },
  { page: 'services', vi: '/dich-vu', old: '/services' },
  { page: 'projects', vi: '/du-an', old: '/projects' },
  { page: 'blog', vi: '/tin-tuc', old: '/blog' },
  { page: 'tech', vi: '/cong-nghe', old: '/technology' },
  { page: 'contact', vi: '/lien-he', old: '/contact' },
];

function canonicalRedirect(req, res, next) {
  const host = (req.hostname || '').toLowerCase();
  if (REDIRECT_HOSTS.has(host)) {
    return res.redirect(301, SITE_ORIGIN + req.originalUrl);
  }
  const proto = (req.headers['x-forwarded-proto'] || req.protocol || '').toLowerCase();
  if (proto === 'http') {
    return res.redirect(301, SITE_ORIGIN + req.originalUrl);
  }
  return next();
}

function securityHeaders(_req, res, next) {
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  next();
}

async function getContent() {
  return JSON.parse(await readFile(contentPath, 'utf8'));
}

// Build-time image map (baked, read once). Uploads map lives on the data volume
// and is read per request so admin-added images render without a restart.
let buildMap = {};
try {
  buildMap = JSON.parse(await readFile(buildMapPath, 'utf8'));
} catch {
  console.warn('image-map.json not found; run `npm run optimize:images`');
}
async function getUploadsMap() {
  try { return JSON.parse(await readFile(uploadsMapPath, 'utf8')); }
  catch { return {}; }
}
async function getImageMap() {
  return { ...buildMap, ...(await getUploadsMap()) };
}

app.set('trust proxy', true);
app.use(canonicalRedirect);
app.use(securityHeaders);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));
app.use(express.static(path.join(__dirname, 'public')));
// Uploaded media served from the data volume (survives image rebuilds).
app.use('/uploads', express.static(uploadsDir, { maxAge: '7d' }));

const render = async (res, opts) => {
  const [content, imageMap] = await Promise.all([getContent(), getImageMap()]);
  res.render('site', { canonical: '/', ...opts, content, imageMap, origin: SITE_ORIGIN, rich: sanitizeRichHtml });
};

app.get('/', (_req, res, next) => render(res, { page: 'home', canonical: '/' }).catch(next));
PAGE_ROUTES.forEach((route) => {
  app.get(route.vi, (_req, res, next) => render(res, { page: route.page, canonical: route.vi }).catch(next));
  app.get(route.old, (_req, res) => res.redirect(301, route.vi));
});
app.get('/360VR', (_req, res, next) => render(res, { page: 'vr', canonical: '/360VR' }).catch(next));

// Product detail by slug (data-driven; admin-added products work immediately).
app.get('/san-pham/:slug', async (req, res, next) => {
  try {
    const content = await getContent();
    const items = content.productItems || [];
    const idx = items.findIndex((p) => p.slug === req.params.slug);
    if (idx === -1) return res.status(404).render('site', { page: 'notfound', canonical: req.path, content, imageMap: await getImageMap(), origin: SITE_ORIGIN, rich: sanitizeRichHtml });
    const imageMap = await getImageMap();
    res.render('site', { page: 'productDetail', productIndex: idx, canonical: '/san-pham/' + req.params.slug, content, imageMap, origin: SITE_ORIGIN, rich: sanitizeRichHtml });
  } catch (err) { next(err); }
});

// Post detail by slug.
app.get('/tin-tuc/:slug', async (req, res, next) => {
  try {
    const content = await getContent();
    const items = content.postItems || [];
    const idx = items.findIndex((p) => p.slug === req.params.slug);
    if (idx === -1) return res.status(404).render('site', { page: 'notfound', canonical: req.path, content, imageMap: await getImageMap(), origin: SITE_ORIGIN, rich: sanitizeRichHtml });
    const imageMap = await getImageMap();
    res.render('site', { page: 'postDetail', postIndex: idx, canonical: '/tin-tuc/' + req.params.slug, content, imageMap, origin: SITE_ORIGIN, rich: sanitizeRichHtml });
  } catch (err) { next(err); }
});

// Legacy product URLs → new slug (301), resolved from data.
app.get(/^\/(youjiasG1|youjiatG2|yijia|Rli|sx)\/\d+$/, async (req, res, next) => {
  try {
    const content = await getContent();
    const items = content.productItems || [];
    const hit = items.find((p) => p.legacyPath === req.path);
    if (hit) return res.redirect(301, '/san-pham/' + hit.slug);
    next();
  } catch (err) { next(err); }
});

app.get('/admin', async (_req, res, next) => {
  try { res.render('admin', { content: await getContent() }); }
  catch (err) { next(err); }
});

app.get('/robots.txt', (_req, res) => {
  res.type('text/plain').send(
    'User-agent: *\n' +
    'Allow: /\n' +
    'Disallow: /admin\n' +
    'Disallow: /api/\n\n' +
    'Sitemap: ' + SITE_ORIGIN + '/sitemap.xml\n'
  );
});

app.get('/sitemap.xml', async (_req, res, next) => {
  try {
    const content = await getContent();
    const today = new Date().toISOString().slice(0, 10);
    const urls = [
      ...STATIC_PAGES.map((p) => ({ loc: p.loc, priority: p.priority })),
      ...(content.productItems || []).map((p) => ({ loc: '/san-pham/' + p.slug, priority: '0.8' })),
      ...(content.postItems || []).map((p) => ({ loc: '/tin-tuc/' + p.slug, priority: '0.6' })),
    ];
    const body =
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
      urls.map((u) =>
        '  <url>\n' +
        '    <loc>' + SITE_ORIGIN + u.loc + '</loc>\n' +
        '    <lastmod>' + today + '</lastmod>\n' +
        '    <priority>' + u.priority + '</priority>\n' +
        '  </url>'
      ).join('\n') +
      '\n</urlset>\n';
    res.type('application/xml').send(body);
  } catch (err) { next(err); }
});

app.get('/api/content', async (_req, res) => {
  try { res.json(await getContent()); }
  catch (err) { res.status(500).json({ error: 'Cannot read content', detail: err.message }); }
});

app.post('/api/content', async (req, res) => {
  try {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) return res.status(400).json({ error: 'Invalid content payload' });
    sanitizeContentPayload(req.body);
    await writeFile(contentPath, JSON.stringify(req.body, null, 2) + '\n', 'utf8');
    res.json({ ok: true, savedAt: new Date().toISOString() });
  } catch (err) { res.status(500).json({ error: 'Cannot save content', detail: err.message }); }
});

function sanitizeContentPayload(payload) {
  const richKeys = ['body'];
  [...(payload.productItems || []), ...(payload.postItems || [])].forEach((item) => {
    richKeys.forEach((key) => {
      if (typeof item[key] === 'string') item[key] = sanitizeRichHtml(item[key]);
    });
  });
}

function sanitizeRichHtml(html) {
  return sanitizeHtml(html || '', {
    allowedTags: ['h1', 'h2', 'h3', 'p', 'br', 'strong', 'b', 'em', 'i', 'u', 'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'a', 'span', 'img', 'iframe'],
    allowedAttributes: { a: ['href', 'target', 'rel', 'style', 'data-rich-button', 'data-button-type', 'data-button-motion'], img: ['src', 'alt', 'title', 'width', 'height'], iframe: ['src', 'width', 'height', 'title', 'frameborder', 'allow', 'allowfullscreen'], span: ['style'], p: ['style'], h1: ['style'], h2: ['style'], h3: ['style'], td: ['style'], th: ['style'] },
    allowedStyles: {
      '*': {
        'font-size': [/^\d+(\.\d+)?(px|rem|em|%)$/],
        'font-family': [/^[a-zA-Z0-9\s,"'-]+$/],
        'text-align': [/^(left|center|right|justify)$/],
      },
      a: {
        'display': [/^inline-block$/],
        'background-color': [/^(transparent|#[0-9a-fA-F]{3,8}|rgba?\([\d\s,.%]+\))$/],
        'color': [/^(#[0-9a-fA-F]{3,8}|rgba?\([\d\s,.%]+\))$/],
        'border': [/^2px solid (#[0-9a-fA-F]{3,8}|rgba?\([\d\s,.%]+\))$/],
        'border-radius': [/^9999px$/],
        'padding': [/^12px 24px$/],
        'font-weight': [/^700$/],
        'line-height': [/^1\.4$/],
        'text-decoration': [/^none$/],
      },
    },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    allowedSchemesByTag: { a: ['http', 'https', 'mailto', 'tel'], img: ['http', 'https'], iframe: ['https'] },
    allowedIframeHostnames: ['www.youtube.com', 'youtube.com', 'www.youtube-nocookie.com', 'youtube-nocookie.com'],
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', { rel: 'noopener' }, true),
    },
  });
}

// ---- Image upload: accept one image, emit webp variants + map entry ----
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/^image\/(png|jpe?g|webp|gif)$/i.test(file.mimetype)) return cb(null, true);
    cb(new Error('Chỉ chấp nhận ảnh PNG/JPG/WebP/GIF'));
  },
});

const WIDTHS = [480, 768, 1280, 1920];
const slugifyName = (s) => String(s || 'img').toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'img';

app.post('/api/upload', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Thiếu file ảnh' });
    await mkdir(uploadsDir, { recursive: true });
    const base = slugifyName(req.body.name || path.parse(req.file.originalname).name) + '-' + Date.now();
    const input = sharp(req.file.buffer, { failOn: 'none' });
    const meta = await input.metadata();
    const fullW = meta.width || 1280;

    const targets = [...new Set(WIDTHS.filter((w) => w < fullW).concat(fullW))].sort((a, b) => a - b);
    const srcset = [];
    for (const w of targets) {
      const suffix = w === fullW ? '' : '-' + w;
      const outName = base + suffix + '.webp';
      await sharp(req.file.buffer, { failOn: 'none' }).resize({ width: w }).webp({ quality: 80, effort: 4 }).toFile(path.join(uploadsDir, outName));
      srcset.push({ w, url: '/uploads/' + outName });
    }
    const url = '/uploads/' + base + '.webp';
    const entry = { width: meta.width, height: meta.height, webp: url, srcset };

    const map = await getUploadsMap();
    map[url] = entry;
    await writeFile(uploadsMapPath, JSON.stringify(map, null, 2) + '\n', 'utf8');

    res.json({ ok: true, url, width: meta.width, height: meta.height });
  } catch (err) {
    res.status(500).json({ error: 'Upload thất bại', detail: err.message });
  }
});

app.listen(PORT, HOST, () => console.log(`FranzLift running: http://${HOST}:${PORT}`));
