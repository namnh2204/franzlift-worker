import ejs from 'ejs';
import sanitizeHtml from 'sanitize-html';
import siteTemplate from '../views/site.ejs';
import adminTemplate from '../views/admin.ejs';
import initialContent from '../data/content.json';
import buildImageMap from '../data/image-map.json';

const SITE_ORIGIN = 'https://franzlift.vn';
const MAX_CONTENT_BYTES = 20 * 1024 * 1024;
const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
const WIDTHS = [480, 768, 1280, 1920];
const PAGE_ROUTES = new Map([
  ['/', ['home', '/']],
  ['/gioi-thieu', ['about', '/gioi-thieu']],
  ['/san-pham', ['products', '/san-pham']],
  ['/dich-vu', ['services', '/dich-vu']],
  ['/du-an', ['projects', '/du-an']],
  ['/tin-tuc', ['blog', '/tin-tuc']],
  ['/cong-nghe', ['tech', '/cong-nghe']],
  ['/360vr', ['vr', '/360VR']],
  ['/lien-he', ['contact', '/lien-he']],
]);
const REDIRECTS = new Map([
  ['/about', '/gioi-thieu'],
  ['/products', '/san-pham'],
  ['/services', '/dich-vu'],
  ['/projects', '/du-an'],
  ['/blog', '/tin-tuc'],
  ['/technology', '/cong-nghe'],
  ['/contact', '/lien-he'],
]);
const STATIC_PAGES = [
  ['/', '1.0'], ['/gioi-thieu', '0.7'], ['/san-pham', '0.9'],
  ['/dich-vu', '0.8'], ['/du-an', '0.8'], ['/tin-tuc', '0.7'],
  ['/cong-nghe', '0.7'], ['/360VR', '0.6'], ['/lien-he', '0.6'],
];

const renderSite = ejs.compile(siteTemplate, { filename: 'views/site.ejs' });
const renderAdmin = ejs.compile(adminTemplate, { filename: 'views/admin.ejs' });

function secureHeaders(headers = new Headers()) {
  headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('X-Frame-Options', 'SAMEORIGIN');
  headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  return headers;
}

function response(body, init = {}) {
  return new Response(body, { ...init, headers: secureHeaders(new Headers(init.headers)) });
}

function json(data, status = 200) {
  return response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

function redirect(location) {
  return response(null, { status: 301, headers: { Location: location } });
}

async function getRecord(env, key, fallback) {
  const row = await env.DB.prepare('SELECT value FROM app_data WHERE key = ?1').bind(key).first();
  return row ? JSON.parse(row.value) : fallback;
}

async function putRecord(env, key, value) {
  await env.DB.prepare(
    `INSERT INTO app_data (key, value, updated_at) VALUES (?1, ?2, CURRENT_TIMESTAMP)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
  ).bind(key, JSON.stringify(value)).run();
}

const getContent = (env) => getRecord(env, 'content', initialContent);
const getUploadMap = (env) => getRecord(env, 'uploads_map', {});

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
    transformTags: { a: sanitizeHtml.simpleTransform('a', { rel: 'noopener' }, true) },
  });
}

function sanitizeContent(content) {
  for (const item of [...(content.productItems || []), ...(content.postItems || [])]) {
    if (typeof item.body === 'string') item.body = sanitizeRichHtml(item.body);
  }
  return content;
}

function validateContent(content) {
  if (!content || typeof content !== 'object' || Array.isArray(content)) return 'Invalid content payload';
  for (const key of ['productItems', 'postItems']) {
    if (content[key] !== undefined && !Array.isArray(content[key])) return `${key} must be an array`;
    const slugs = new Set();
    for (const item of content[key] || []) {
      if (!item || typeof item !== 'object' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.slug || '')) return `Invalid slug in ${key}`;
      if (slugs.has(item.slug)) return `Duplicate slug in ${key}: ${item.slug}`;
      slugs.add(item.slug);
    }
  }
  return null;
}

function serializeForScript(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function htmlDocument(html, status = 200) {
  return response(html, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

async function renderPage(env, page, canonical, extra = {}, status = 200) {
  const [content, uploadsMap] = await Promise.all([getContent(env), getUploadMap(env)]);
  return htmlDocument(renderSite({
    page, canonical, content, imageMap: { ...buildImageMap, ...uploadsMap },
    origin: SITE_ORIGIN, rich: sanitizeRichHtml, ...extra,
  }), status);
}

function xmlEscape(value) {
  return String(value).replace(/[<>&'"]/g, (character) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[character]);
}

function checkWriteOrigin(request) {
  const origin = request.headers.get('Origin');
  return !origin || origin === new URL(request.url).origin;
}

async function serveUpload(env, pathname, method) {
  let key;
  try { key = decodeURIComponent(pathname.slice('/uploads/'.length)); }
  catch { return response('Bad request', { status: 400 }); }
  if (!key || key.includes('/') || key.includes('\\') || key.includes('..')) return response('Not found', { status: 404 });
  const object = await env.UPLOADS.get(key);
  if (!object) return response('Not found', { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('ETag', object.httpEtag);
  headers.set('Cache-Control', 'public, max-age=604800');
  return response(method === 'HEAD' ? null : object.body, { headers });
}

function slugifyName(value) {
  return String(value || 'img').toLowerCase().normalize('NFD')
    .replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'img';
}

async function uploadImage(request, env) {
  if (!checkWriteOrigin(request)) return json({ error: 'Invalid request origin' }, 403);
  const declaredLength = Number(request.headers.get('Content-Length') || 0);
  if (declaredLength > MAX_UPLOAD_BYTES + 1024 * 1024) return json({ error: 'Upload quá lớn' }, 413);
  const form = await request.formData();
  const file = form.get('image');
  if (!(file instanceof File)) return json({ error: 'Thiếu file ảnh' }, 400);
  if (file.size > MAX_UPLOAD_BYTES) return json({ error: 'Upload quá lớn' }, 413);
  if (!/^image\/(png|jpe?g|webp|gif)$/i.test(file.type)) return json({ error: 'Chỉ chấp nhận ảnh PNG/JPG/WebP/GIF' }, 400);

  const info = await env.IMAGES.info(file.stream());
  const fullWidth = info.width || 1280;
  const targets = [...new Set(WIDTHS.filter((width) => width < fullWidth).concat(fullWidth))].sort((a, b) => a - b);
  const base = `${slugifyName(form.get('name') || file.name.replace(/\.[^.]+$/, ''))}-${Date.now()}`;
  const srcset = [];
  for (const width of targets) {
    const suffix = width === fullWidth ? '' : `-${width}`;
    const name = `${base}${suffix}.webp`;
    const transformed = await env.IMAGES.input(file.stream()).transform({ width }).output({ format: 'image/webp', quality: 80 });
    const transformedResponse = transformed.response();
    await env.UPLOADS.put(name, transformedResponse.body, { httpMetadata: { contentType: 'image/webp' } });
    srcset.push({ w: width, url: `/uploads/${name}` });
  }

  const url = `/uploads/${base}.webp`;
  const map = await getUploadMap(env);
  map[url] = { width: info.width, height: info.height, webp: url, srcset };
  await putRecord(env, 'uploads_map', map);
  return json({ ok: true, url, width: info.width, height: info.height });
}

async function handleRequest(request, env) {
  const url = new URL(request.url);
  const method = request.method.toUpperCase();
  const pathname = url.pathname;
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  const lowerPath = normalized.toLowerCase();

  if (url.hostname.toLowerCase() === 'www.franzlift.vn') return redirect(SITE_ORIGIN + pathname + url.search);
  if (pathname.startsWith('/uploads/') && (method === 'GET' || method === 'HEAD')) return serveUpload(env, pathname, method);

  if (method === 'GET' || method === 'HEAD') {
    const asset = await env.ASSETS.fetch(request);
    if (asset.status !== 404) {
      const headers = secureHeaders(new Headers(asset.headers));
      if (pathname.startsWith('/vendor/') || pathname.startsWith('/assets-local/')) headers.set('Cache-Control', 'public, max-age=31536000, immutable');
      return new Response(method === 'HEAD' ? null : asset.body, { status: asset.status, statusText: asset.statusText, headers });
    }
  }

  if (REDIRECTS.has(lowerPath) && (method === 'GET' || method === 'HEAD')) return redirect(REDIRECTS.get(lowerPath));
  if (PAGE_ROUTES.has(lowerPath) && (method === 'GET' || method === 'HEAD')) {
    const [page, canonical] = PAGE_ROUTES.get(lowerPath);
    const rendered = await renderPage(env, page, canonical);
    return method === 'HEAD' ? response(null, { status: rendered.status, headers: rendered.headers }) : rendered;
  }

  if (lowerPath === '/admin' && (method === 'GET' || method === 'HEAD')) {
    const content = await getContent(env);
    const rendered = htmlDocument(renderAdmin({ content, serializedContent: serializeForScript(content) }));
    return method === 'HEAD' ? response(null, { headers: rendered.headers }) : rendered;
  }

  if (lowerPath === '/robots.txt' && (method === 'GET' || method === 'HEAD')) {
    const body = `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\n\nSitemap: ${SITE_ORIGIN}/sitemap.xml\n`;
    return response(method === 'HEAD' ? null : body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }

  if (lowerPath === '/sitemap.xml' && (method === 'GET' || method === 'HEAD')) {
    const content = await getContent(env);
    const today = new Date().toISOString().slice(0, 10);
    const urls = [
      ...STATIC_PAGES,
      ...(content.productItems || []).map((item) => [`/san-pham/${item.slug}`, '0.8']),
      ...(content.postItems || []).map((item) => [`/tin-tuc/${item.slug}`, '0.6']),
    ];
    const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(([loc, priority]) => `  <url>\n    <loc>${xmlEscape(SITE_ORIGIN + loc)}</loc>\n    <lastmod>${today}</lastmod>\n    <priority>${priority}</priority>\n  </url>`).join('\n')}\n</urlset>\n`;
    return response(method === 'HEAD' ? null : body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
  }

  if (lowerPath === '/api/content' && method === 'GET') return json(await getContent(env));
  if (lowerPath === '/api/content' && method === 'POST') {
    if (!checkWriteOrigin(request)) return json({ error: 'Invalid request origin' }, 403);
    const declaredLength = Number(request.headers.get('Content-Length') || 0);
    if (declaredLength > MAX_CONTENT_BYTES) return json({ error: 'Content payload too large' }, 413);
    const text = await request.text();
    if (new TextEncoder().encode(text).byteLength > MAX_CONTENT_BYTES) return json({ error: 'Content payload too large' }, 413);
    let content;
    try { content = JSON.parse(text); }
    catch { return json({ error: 'Invalid JSON payload' }, 400); }
    const validationError = validateContent(content);
    if (validationError) return json({ error: validationError }, 400);
    sanitizeContent(content);
    await putRecord(env, 'content', content);
    return json({ ok: true, savedAt: new Date().toISOString() });
  }
  if (lowerPath === '/api/upload' && method === 'POST') return uploadImage(request, env);

  const productMatch = normalized.match(/^\/san-pham\/([^/]+)$/i);
  if (productMatch && (method === 'GET' || method === 'HEAD')) {
    const content = await getContent(env);
    const index = (content.productItems || []).findIndex((item) => item.slug === productMatch[1]);
    const rendered = index === -1
      ? await renderPage(env, 'notfound', pathname, {}, 404)
      : await renderPage(env, 'productDetail', `/san-pham/${productMatch[1]}`, { productIndex: index });
    return method === 'HEAD' ? response(null, { status: rendered.status, headers: rendered.headers }) : rendered;
  }

  const postMatch = normalized.match(/^\/tin-tuc\/([^/]+)$/i);
  if (postMatch && (method === 'GET' || method === 'HEAD')) {
    const content = await getContent(env);
    const index = (content.postItems || []).findIndex((item) => item.slug === postMatch[1]);
    const rendered = index === -1
      ? await renderPage(env, 'notfound', pathname, {}, 404)
      : await renderPage(env, 'postDetail', `/tin-tuc/${postMatch[1]}`, { postIndex: index });
    return method === 'HEAD' ? response(null, { status: rendered.status, headers: rendered.headers }) : rendered;
  }

  if (/^\/(youjiasG1|youjiatG2|yijia|Rli|sx)\/\d+$/i.test(normalized) && (method === 'GET' || method === 'HEAD')) {
    const content = await getContent(env);
    const item = (content.productItems || []).find((product) => product.legacyPath === normalized);
    if (item) return redirect(`/san-pham/${item.slug}`);
  }

  return response('Not Found', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}

export default {
  async fetch(request, env) {
    try {
      return await handleRequest(request, env);
    } catch (error) {
      console.error(error);
      return json({ error: 'Internal server error' }, 500);
    }
  },
};
