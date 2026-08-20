// Copy Swiper + AOS dist files from node_modules into public/vendor so the
// browser can load them without a bundler. Run as part of `npm run build`.
import { mkdir, copyFile, cp } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const out = path.join(root, 'public', 'vendor');

const files = [
  ['node_modules/swiper/swiper-bundle.min.css', 'swiper-bundle.min.css'],
  ['node_modules/swiper/swiper-bundle.min.js', 'swiper-bundle.min.js'],
  ['node_modules/aos/dist/aos.css', 'aos.css'],
  ['node_modules/aos/dist/aos.js', 'aos.js'],
];

await mkdir(out, { recursive: true });
for (const [from, to] of files) {
  await copyFile(path.join(root, from), path.join(out, to));
  console.log(`copied ${to}`);
}
await cp(path.join(root, 'node_modules/tinymce'), path.join(out, 'tinymce'), { recursive: true, force: true });
console.log('copied tinymce');
console.log('vendor copy done');
