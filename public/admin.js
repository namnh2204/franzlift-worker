// Franz Lift — admin CRUD console.
// Single source of truth: window.__CONTENT__ (loaded from data/content.json).
// All edits mutate the in-memory `data` object; "Lưu thay đổi" POSTs the whole
// object to /api/content. Images upload to /api/upload (server emits webp +
// records dimensions), and we store the returned URL on the record.
(function () {
  'use strict';

  let data = window.__CONTENT__ || {};
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const el = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
  const esc = (s = '') => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  // ---- helpers ----
  function slugify(s) {
    return String(s || '').toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  }
  function uniqueSlug(base, arr, skipIdx) {
    let slug = base || 'item', n = 2;
    const taken = (s) => arr.some((it, i) => i !== skipIdx && it.slug === s);
    while (taken(slug)) slug = base + '-' + (n++);
    return slug;
  }
  function toast(msg, isErr) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.toggle('err', !!isErr);
    t.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove('show'), 2800);
  }

  // ---- data access ----
  function arr(key) { if (!Array.isArray(data[key])) data[key] = []; return data[key]; }

  const defaultAdvImages = [
    '/assets-local/06-8c3cfe6ed48e0d4939b790419bf12d84.png',
    '/assets-local/07-399adc95948b507d47e4fe295d45e492.png',
    '/assets-local/08-b83d8158bc0dfa9fd0a1443de5583b53.png',
    '/assets-local/09-54086bca79dd4a4376e87b9e84913998.png',
  ];

  function ensureHomeImages() {
    arr('homeAdvantages').forEach((row, idx) => {
      if (Array.isArray(row) && !row[2]) row[2] = defaultAdvImages[idx % defaultAdvImages.length];
    });
  }

  // ---- image upload ----
  async function uploadImage(file, nameHint) {
    const fd = new FormData();
    fd.append('image', file);
    if (nameHint) fd.append('name', nameHint);
    const res = await fetch('/api/upload', { method: 'POST', body: fd });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Upload thất bại');
    return json.url;
  }

  function youtubeEmbedUrl(input) {
    try {
      const url = new URL(String(input || '').trim());
      let id = '';
      if (url.hostname.includes('youtu.be')) id = url.pathname.split('/').filter(Boolean)[0] || '';
      else if (url.pathname.startsWith('/shorts/')) id = url.pathname.split('/').filter(Boolean)[1] || '';
      else if (url.pathname.startsWith('/embed/')) id = url.pathname.split('/').filter(Boolean)[1] || '';
      else id = url.searchParams.get('v') || '';
      id = id.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32);
      return id ? `https://www.youtube.com/embed/${id}` : '';
    } catch (_e) { return ''; }
  }

  function richButtonStyles(type, buttonColor, textColor) {
    const outline = type === 'outline';
    return [
      'display:inline-block',
      `background-color:${outline ? 'transparent' : buttonColor}`,
      `color:${textColor}`,
      `border:2px solid ${buttonColor}`,
      'border-radius:9999px',
      'padding:12px 24px',
      'font-weight:700',
      'line-height:1.4',
      'text-decoration:none',
    ].join(';');
  }

  function selectedRichButton(editor) {
    const node = editor.selection.getNode();
    return editor.dom.getParent(node, 'a[data-rich-button]');
  }

  function openRichButtonDialog(editor, onChange) {
    const button = selectedRichButton(editor);
    const container = button && editor.dom.getParent(button, 'p');
    const currentBorder = button ? editor.dom.getStyle(button, 'border-color', true) : '';
    const currentBackground = button ? editor.dom.getStyle(button, 'background-color', true) : '';
    const currentType = button ? editor.dom.getAttrib(button, 'data-button-type') || 'solid' : 'solid';
    const initialData = {
      text: button ? button.textContent : 'Xem thêm',
      url: button ? editor.dom.getAttrib(button, 'href') : '',
      type: currentType,
      buttonColor: currentBorder || currentBackground || '#419AC2',
      textColor: button ? editor.dom.getStyle(button, 'color', true) || '#FFFFFF' : '#FFFFFF',
      align: container ? editor.dom.getStyle(container, 'text-align', true) || 'left' : 'left',
      motion: button ? editor.dom.getAttrib(button, 'data-button-motion') || 'none' : 'none',
      newTab: button ? editor.dom.getAttrib(button, 'target') === '_blank' : false,
    };

    editor.windowManager.open({
      title: button ? 'Chỉnh sửa nút' : 'Chèn nút',
      size: 'normal',
      body: {
        type: 'panel',
        items: [
          { type: 'input', name: 'text', label: 'Nội dung nút' },
          { type: 'input', name: 'url', label: 'URL khi bấm', placeholder: 'https://... hoặc /lien-he' },
          { type: 'selectbox', name: 'type', label: 'Kiểu nút', items: [
            { text: 'Nền màu', value: 'solid' },
            { text: 'Viền màu', value: 'outline' },
          ] },
          { type: 'colorinput', name: 'buttonColor', label: 'Màu nút' },
          { type: 'colorinput', name: 'textColor', label: 'Màu chữ' },
          { type: 'selectbox', name: 'align', label: 'Căn nút', items: [
            { text: 'Trái', value: 'left' },
            { text: 'Giữa', value: 'center' },
            { text: 'Phải', value: 'right' },
          ] },
          { type: 'selectbox', name: 'motion', label: 'Hiệu ứng thu hút chú ý', items: [
            { text: 'Không hiệu ứng', value: 'none' },
            { text: 'Nhịp nhẹ', value: 'pulse' },
            { text: 'Nâng nhẹ', value: 'lift' },
            { text: 'Lắc nhẹ', value: 'nudge' },
          ] },
          { type: 'checkbox', name: 'newTab', label: 'Mở trong tab mới' },
        ],
      },
      initialData,
      buttons: [
        { type: 'cancel', text: 'Hủy' },
        { type: 'submit', text: button ? 'Cập nhật' : 'Chèn nút', buttonType: 'primary' },
      ],
      onSubmit(api) {
        const values = api.getData();
        const text = String(values.text || '').trim();
        const url = String(values.url || '').trim();
        if (!text || !url) return toast('Nhập nội dung nút và URL', true);

        const attrs = {
          href: url,
          'data-rich-button': 'true',
          'data-button-type': values.type,
          'data-button-motion': values.motion,
          style: richButtonStyles(values.type, values.buttonColor || '#419AC2', values.textColor || '#FFFFFF'),
        };
        if (values.newTab) {
          attrs.target = '_blank';
          attrs.rel = 'noopener';
        }
        if (button) {
          editor.dom.setAttribs(button, attrs);
          if (!values.newTab) {
            editor.dom.setAttrib(button, 'target', null);
            editor.dom.setAttrib(button, 'rel', null);
          }
          button.textContent = text;
          if (container) editor.dom.setStyle(container, 'text-align', values.align);
          editor.selection.select(button);
        } else {
          const anchor = editor.dom.createHTML('a', attrs, editor.dom.encode(text));
          editor.insertContent(`<p style="text-align:${values.align}">${anchor}</p>`);
        }
        onChange(editor.getContent());
        api.close();
      },
    });
  }

  // image field: preview + upload button + manual URL. onChange(url) persists.
  function imageField(label, current, onChange, hint) {
    const wrap = el(`<div class="field">
      <label>${esc(label)}</label>
      <div class="imgpick">
        <img class="pv ${current ? '' : 'empty'}" ${current ? `src="${esc(current)}"` : ''} alt="">
        <div style="flex:1">
          <input type="file" accept="image/*" style="display:none">
          <div class="row" style="gap:8px">
            <button type="button" class="btn sm">Tải ảnh lên</button>
            <button type="button" class="btn sm ghost" data-clear>Xóa ảnh</button>
          </div>
          <input type="url" placeholder="hoặc dán URL ảnh" value="${esc(current || '')}" style="margin-top:8px">
          <p class="muted" style="margin:6px 0 0">${esc(hint || 'PNG/JPG/WebP — tự nén sang WebP khi tải lên.')}</p>
        </div>
      </div></div>`);
    const pv = $('.pv', wrap), file = $('input[type=file]', wrap), url = $('input[type=url]', wrap);
    const setVal = (v) => { onChange(v || ''); if (v) { pv.src = v; pv.classList.remove('empty'); } else { pv.removeAttribute('src'); pv.classList.add('empty'); } };
    $('.btn.sm', wrap).addEventListener('click', () => file.click());
    $('[data-clear]', wrap).addEventListener('click', () => { url.value = ''; setVal(''); });
    url.addEventListener('change', () => setVal(url.value.trim()));
    file.addEventListener('change', async () => {
      if (!file.files[0]) return;
      try { toast('Đang tải ảnh…'); const u = await uploadImage(file.files[0], hint); url.value = u; setVal(u); toast('Đã tải ảnh lên'); }
      catch (e) { toast(e.message, true); }
      file.value = '';
    });
    return wrap;
  }

  function textField(label, val, onChange, opts = {}) {
    const tag = opts.area ? 'textarea' : 'input';
    const wrap = el(`<div class="field"><label>${esc(label)}</label>${opts.area
      ? `<textarea rows="${opts.rows || 4}" placeholder="${esc(opts.ph || '')}">${esc(val || '')}</textarea>`
      : `<input type="${opts.type || 'text'}" placeholder="${esc(opts.ph || '')}" value="${esc(val || '')}">`}</div>`);
    $(tag, wrap).addEventListener('input', (e) => onChange(e.target.value));
    return wrap;
  }

  function richTextField(label, val, onChange) {
    const id = 'rich-' + Math.random().toString(36).slice(2);
    const wrap = el(`<div class="field"><label>${esc(label)}</label><textarea id="${id}" class="rich-editor" rows="10">${esc(val || '')}</textarea><p class="muted" style="margin:6px 0 0">Hỗ trợ tiêu đề, định dạng chữ, list, bảng, ảnh, video, link và nút tùy chỉnh.</p></div>`);
    const textarea = $('textarea', wrap);
    textarea.addEventListener('input', (e) => onChange(e.target.value));
    setTimeout(() => {
      if (!window.tinymce) return;
      window.tinymce.init({
        selector: '#' + id,
        license_key: 'gpl',
        menubar: false,
        branding: false,
        height: 360,
        plugins: 'image link lists table code',
        toolbar: 'undo redo | blocks fontfamily fontsize | bold italic underline | alignleft aligncenter alignright alignjustify | bullist numlist | table | uploadimage youtube image link unlink richbutton | removeformat code',
        paste_data_images: true,
        automatic_uploads: true,
        file_picker_types: 'image',
        file_picker_callback(callback, _value, meta) {
          if (meta.filetype !== 'image') return;
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = 'image/*';
          input.addEventListener('change', async () => {
            const file = input.files && input.files[0];
            if (!file) return;
            const suggested = file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ');
            const alt = prompt('Nhập ALT ảnh:', suggested) || suggested;
            try {
              toast('Đang tải ảnh…');
              const url = await uploadImage(file, alt || suggested);
              callback(url, { alt, title: alt });
              toast('Đã tải ảnh lên');
            } catch (e) { toast(e.message, true); }
          });
          input.click();
        },
        images_upload_handler: async (blobInfo) => {
          const file = blobInfo.blob();
          const name = blobInfo.filename() || 'pasted-image';
          return uploadImage(file, name);
        },
        block_formats: 'Đoạn=p; Heading 1=h1; Heading 2=h2; Heading 3=h3',
        font_size_formats: '12px 14px 16px 18px 20px 24px 28px 32px 40px',
        font_family_formats: 'Inter=Inter,Arial,sans-serif; Arial=arial,helvetica,sans-serif; Times New Roman=times new roman,times,serif; Georgia=georgia,palatino,serif; Courier New=courier new,courier,monospace',
        content_style: 'body{font-family:Inter,Arial,sans-serif;font-size:16px;line-height:1.7;color:#17212b} table{border-collapse:collapse;width:100%} td,th{border:1px solid #d8e3ea;padding:10px} a[data-rich-button]{display:inline-block;padding:12px 24px;font-weight:700;line-height:1.4;text-decoration:none}a[data-button-motion="pulse"]{animation:ctaPulse 2.4s ease-in-out infinite}a[data-button-motion="lift"]{animation:ctaLift 2.8s ease-in-out infinite}a[data-button-motion="nudge"]{animation:ctaNudge 4s ease-in-out infinite}@keyframes ctaPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.035)}}@keyframes ctaLift{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}@keyframes ctaNudge{0%,80%,100%{transform:translateX(0)}85%{transform:translateX(-3px)}90%{transform:translateX(3px)}95%{transform:translateX(-2px)}}',
        setup(editor) {
          editor.ui.registry.addButton('uploadimage', {
            text: 'Tải ảnh',
            tooltip: 'Tải ảnh lên và chèn vào bài viết',
            onAction() {
              const input = document.createElement('input');
              input.type = 'file';
              input.accept = 'image/*';
              input.addEventListener('change', async () => {
                const file = input.files && input.files[0];
                if (!file) return;
                const suggested = file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ');
                const alt = prompt('Nhập ALT ảnh:', suggested) || suggested;
                try {
                  toast('Đang tải ảnh…');
                  const url = await uploadImage(file, alt || suggested);
                  editor.insertContent(`<p><img src="${esc(url)}" alt="${esc(alt)}"></p>`);
                  onChange(editor.getContent());
                  toast('Đã chèn ảnh');
                } catch (e) { toast(e.message, true); }
              });
              input.click();
            }
          });
          editor.ui.registry.addButton('youtube', {
            text: 'YouTube',
            tooltip: 'Dán link YouTube để chèn video',
            onAction() {
              const src = youtubeEmbedUrl(prompt('Dán link YouTube:'));
              if (!src) return toast('Link YouTube không hợp lệ', true);
              editor.insertContent(`<p><iframe src="${src}" width="560" height="315" title="YouTube video" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></p>`);
              onChange(editor.getContent());
            }
          });
          editor.ui.registry.addButton('richbutton', {
            text: 'Nút',
            tooltip: 'Chèn hoặc chỉnh sửa nút tùy chỉnh',
            onAction() { openRichButtonDialog(editor, onChange); },
          });
          editor.ui.registry.addContextToolbar('richbutton', {
            predicate: (node) => node.nodeName.toLowerCase() === 'a' && editor.dom.getAttrib(node, 'data-rich-button') === 'true',
            items: 'richbutton unlink',
            position: 'node',
            scope: 'node',
          });
          editor.on('change keyup undo redo', () => onChange(editor.getContent()));
        }
      });
    }, 0);
    return wrap;
  }

  // ---- collapsible record card (products / posts) ----
  function recordCard(key, idx, cfg) {
    const list = arr(key);
    const rec = list[idx];
    const card = el(`<div class="item">
      <div class="item-head">
        <span class="chev">▶</span>
        <img ${rec[cfg.image] ? `src="${esc(rec[cfg.image])}"` : ''} alt="">
        <div class="t"><b>${esc(rec[cfg.title] || '(chưa có tiêu đề)')}</b><span>${esc(rec.slug || '')}</span></div>
        <div class="row" style="gap:6px">
          <button class="btn sm ghost" data-up title="Lên">↑</button>
          <button class="btn sm ghost" data-down title="Xuống">↓</button>
          <button class="btn sm danger" data-del>Xóa</button>
        </div>
      </div>
      <div class="item-body"></div></div>`);

    $('.item-head', card).addEventListener('click', (e) => { if (e.target.closest('button')) return; card.classList.toggle('open'); });
    $('[data-up]', card).addEventListener('click', (e) => { e.stopPropagation(); if (idx > 0) { [list[idx - 1], list[idx]] = [list[idx], list[idx - 1]]; renderView(); } });
    $('[data-down]', card).addEventListener('click', (e) => { e.stopPropagation(); if (idx < list.length - 1) { [list[idx + 1], list[idx]] = [list[idx], list[idx + 1]]; renderView(); } });
    $('[data-del]', card).addEventListener('click', (e) => { e.stopPropagation(); if (confirm('Xóa mục này?')) { list.splice(idx, 1); renderView(); } });

    const body = $('.item-body', card);
    cfg.fields(body, rec, list, idx);
    return card;
  }

  // ---- views ----
  const views = {};

  views.products = () => {
    const list = arr('productItems');
    const box = el('<div></div>');
    list.forEach((_, idx) => box.appendChild(recordCard('productItems', idx, {
      title: 'name', image: 'image',
      fields(body, rec, arrRef, i) {
        body.appendChild(textField('Tên sản phẩm', rec.name, (v) => { rec.name = v; refreshHead(body, rec.name); if (!rec._slugTouched) { rec.slug = uniqueSlug(slugify(v), arrRef, i); slugInput.value = rec.slug; } }));
        const slugWrap = textField('Đường dẫn (slug)', rec.slug, (v) => { rec._slugTouched = true; rec.slug = slugify(v); });
        const slugInput = $('input', slugWrap);
        slugWrap.appendChild(el(`<p class="muted" style="margin:6px 0 0">URL: /san-pham/<b>${esc(rec.slug || '')}</b></p>`));
        slugInput.addEventListener('input', () => { $('p b', slugWrap).textContent = slugify(slugInput.value); });
        body.appendChild(slugWrap);
        body.appendChild(textField('Mô tả ngắn', rec.summary, (v) => rec.summary = v, { area: true, rows: 2 }));
        body.appendChild(richTextField('Nội dung chi tiết', rec.body, (v) => rec.body = v));
        body.appendChild(imageField('Ảnh đại diện', rec.image, (u) => { rec.image = u; refreshThumb(body, u); }, 'product'));
        body.appendChild(galleryField(rec));
      }
    })));
    if (!list.length) box.appendChild(el('<div class="empty">Chưa có sản phẩm. Bấm “Thêm sản phẩm”.</div>'));
    return box;
  };

  views.posts = () => {
    const list = arr('postItems');
    const box = el('<div></div>');
    list.forEach((_, idx) => box.appendChild(recordCard('postItems', idx, {
      title: 'title', image: 'image',
      fields(body, rec, arrRef, i) {
        body.appendChild(textField('Tiêu đề bài viết', rec.title, (v) => { rec.title = v; refreshHead(body, rec.title); if (!rec._slugTouched) { rec.slug = uniqueSlug(slugify(v), arrRef, i); slugInput.value = rec.slug; } }));
        const slugWrap = textField('Đường dẫn (slug)', rec.slug, (v) => { rec._slugTouched = true; rec.slug = slugify(v); });
        const slugInput = $('input', slugWrap);
        slugWrap.appendChild(el(`<p class="muted" style="margin:6px 0 0">URL: /tin-tuc/<b>${esc(rec.slug || '')}</b></p>`));
        slugInput.addEventListener('input', () => { $('p b', slugWrap).textContent = slugify(slugInput.value); });
        body.appendChild(slugWrap);
        body.appendChild(textField('Ngày đăng', rec.date, (v) => rec.date = v, { ph: 'dd/mm/yyyy' }));
        body.appendChild(textField('Tóm tắt', rec.excerpt, (v) => rec.excerpt = v, { area: true, rows: 2 }));
        body.appendChild(richTextField('Nội dung bài viết', rec.body, (v) => rec.body = v));
        body.appendChild(imageField('Ảnh đại diện', rec.image, (u) => { rec.image = u; refreshThumb(body, u); }, 'post'));
      }
    })));
    if (!list.length) box.appendChild(el('<div class="empty">Chưa có bài viết. Bấm “Thêm bài viết”.</div>'));
    return box;
  };

  function refreshHead(body, title) { const b = $('.item-head .t b', body.closest('.item')); if (b) b.textContent = title || '(chưa có tiêu đề)'; }
  function refreshThumb(body, url) { const img = $('.item-head img', body.closest('.item')); if (img && url) img.src = url; }

  // gallery editor (products)
  function galleryField(rec) {
    if (!Array.isArray(rec.gallery)) rec.gallery = [];
    const wrap = el(`<div class="field"><label>Thư viện ảnh (hiển thị ở cuối trang sản phẩm)</label>
      <div class="gal"></div>
      <div class="row" style="gap:8px;margin-top:8px"><input type="file" accept="image/*" style="display:none"><button type="button" class="btn sm">+ Thêm ảnh</button></div></div>`);
    const gal = $('.gal', wrap), file = $('input[type=file]', wrap);
    const draw = () => {
      gal.innerHTML = '';
      rec.gallery.forEach((g, i) => {
        const cell = el(`<div class="g"><img src="${esc(g)}" alt=""><button type="button" title="Xóa">×</button></div>`);
        $('button', cell).addEventListener('click', () => { rec.gallery.splice(i, 1); draw(); });
        gal.appendChild(cell);
      });
    };
    $('.btn.sm', wrap).addEventListener('click', () => file.click());
    file.addEventListener('change', async () => {
      if (!file.files[0]) return;
      try { toast('Đang tải ảnh…'); const u = await uploadImage(file.files[0], 'gallery'); rec.gallery.push(u); draw(); toast('Đã thêm ảnh'); }
      catch (e) { toast(e.message, true); }
      file.value = '';
    });
    draw();
    return wrap;
  }

  function rowGalleryField(row, opts = {}) {
    if (!Array.isArray(row[3])) row[3] = [];
    const label = opts.label || 'Ảnh bổ sung (tự chuyển trên trang chủ)';
    const hint = opts.hint || 'Ảnh chính ở trên vẫn là ảnh đầu tiên. Các ảnh bổ sung sẽ tự đổi sau vài giây.';
    const uploadName = opts.uploadName || 'gallery';
    const wrap = el(`<div class="field"><label>${esc(label)}</label>
      <div class="gallery-grid"></div>
      <div class="row" style="margin-top:10px"><input type="file" accept="image/*"><button class="btn sm" type="button">Tải ảnh</button></div>
      <p class="muted" style="margin:6px 0 0">${esc(hint)}</p>
    </div>`);
    const grid = $('.gallery-grid', wrap);
    const file = $('input', wrap);
    const btn = $('button', wrap);
    const draw = () => {
      grid.innerHTML = '';
      row[3].forEach((url, i) => {
        const cell = el(`<div class="gallery-cell"><img src="${esc(url)}" alt=""><button type="button">×</button></div>`);
        $('button', cell).addEventListener('click', () => { row[3].splice(i, 1); draw(); });
        grid.appendChild(cell);
      });
    };
    btn.addEventListener('click', async () => {
      if (!file.files || !file.files[0]) return toast('Chọn ảnh trước', true);
      try { toast('Đang tải ảnh…'); const u = await uploadImage(file.files[0], uploadName); row[3].push(u); draw(); toast('Đã thêm ảnh'); }
      catch (e) { toast(e.message, true); }
      file.value = '';
    });
    draw();
    return wrap;
  }

  const caseGalleryField = (row) => rowGalleryField(row, { uploadName: 'case-gallery' });
  const projectGalleryField = (row) => rowGalleryField(row, {
    label: 'Ảnh bổ sung (tự chuyển trên trang dự án)',
    hint: 'Ảnh chính ở trên vẫn là ảnh đầu tiên. Các ảnh bổ sung sẽ tự đổi trong thẻ dự án.',
    uploadName: 'project-gallery',
  });

  // simple [title, desc] array editor (services, features, techItems, projects)
  function pairListView(key, labels, hasImage) {
    return () => {
      const list = arr(key);
      const box = el('<div></div>');
      list.forEach((row, idx) => {
        if (!Array.isArray(row)) list[idx] = row = [String(row || '')];
        const card = el(`<div class="card"><div class="row between"><b style="font-size:13px;color:#9fb3c2">#${idx + 1}</b><div class="row" style="gap:6px"><button class="btn sm ghost" data-up>↑</button><button class="btn sm ghost" data-down>↓</button><button class="btn sm danger" data-del>Xóa</button></div></div><div class="body" style="margin-top:12px"></div></div>`);
        const b = $('.body', card);
        b.appendChild(textField(labels[0], row[0], (v) => row[0] = v));
        if (labels[1]) b.appendChild(textField(labels[1], row[1], (v) => row[1] = v, { area: true, rows: 2 }));
        if (hasImage) b.appendChild(imageField('Ảnh', row[2], (u) => row[2] = u, key));
        $('[data-up]', card).addEventListener('click', () => { if (idx > 0) { [list[idx - 1], list[idx]] = [list[idx], list[idx - 1]]; renderView(); } });
        $('[data-down]', card).addEventListener('click', () => { if (idx < list.length - 1) { [list[idx + 1], list[idx]] = [list[idx], list[idx + 1]]; renderView(); } });
        $('[data-del]', card).addEventListener('click', () => { if (confirm('Xóa mục này?')) { list.splice(idx, 1); renderView(); } });
        box.appendChild(card);
      });
      if (!list.length) box.appendChild(el('<div class="empty">Chưa có mục nào.</div>'));
      return box;
    };
  }

  function homeCasesView() {
    const list = arr('homeCases');
    const box = el('<div></div>');
    list.forEach((row, idx) => {
      if (!Array.isArray(row)) list[idx] = row = [String(row || ''), '', '', []];
      if (!Array.isArray(row[3])) row[3] = [];
      const card = el(`<div class="card"><div class="row between"><b style="font-size:13px;color:#9fb3c2">#${idx + 1}</b><div class="row" style="gap:6px"><button class="btn sm ghost" data-up>↑</button><button class="btn sm ghost" data-down>↓</button><button class="btn sm danger" data-del>Xóa</button></div></div><div class="body" style="margin-top:12px"></div></div>`);
      const b = $('.body', card);
      b.appendChild(textField('Tên công trình', row[0], (v) => row[0] = v));
      b.appendChild(textField('Mô tả ngắn', row[1], (v) => row[1] = v, { area: true, rows: 2 }));
      b.appendChild(imageField('Ảnh chính', row[2], (u) => row[2] = u, 'homeCases'));
      b.appendChild(caseGalleryField(row));
      $('[data-up]', card).addEventListener('click', () => { if (idx > 0) { [list[idx - 1], list[idx]] = [list[idx], list[idx - 1]]; renderView(); } });
      $('[data-down]', card).addEventListener('click', () => { if (idx < list.length - 1) { [list[idx + 1], list[idx]] = [list[idx], list[idx + 1]]; renderView(); } });
      $('[data-del]', card).addEventListener('click', () => { if (confirm('Xóa công trình này?')) { list.splice(idx, 1); renderView(); } });
      box.appendChild(card);
    });
    if (!list.length) box.appendChild(el('<div class="empty">Chưa có công trình nào.</div>'));
    return box;
  }

  function projectsView() {
    const list = arr('projects');
    const box = el('<div></div>');
    list.forEach((row, idx) => {
      if (!Array.isArray(row)) list[idx] = row = [String(row || ''), '', '', []];
      if (!Array.isArray(row[3])) row[3] = [];
      const card = el(`<div class="card"><div class="row between"><b style="font-size:13px;color:#9fb3c2">#${idx + 1}</b><div class="row" style="gap:6px"><button class="btn sm ghost" data-up>↑</button><button class="btn sm ghost" data-down>↓</button><button class="btn sm danger" data-del>Xóa</button></div></div><div class="body" style="margin-top:12px"></div></div>`);
      const b = $('.body', card);
      b.appendChild(textField('Tên dự án', row[0], (v) => row[0] = v));
      b.appendChild(textField('Mô tả', row[1], (v) => row[1] = v, { area: true, rows: 2 }));
      b.appendChild(imageField('Ảnh chính', row[2], (u) => row[2] = u, 'projects'));
      b.appendChild(projectGalleryField(row));
      $('[data-up]', card).addEventListener('click', () => { if (idx > 0) { [list[idx - 1], list[idx]] = [list[idx], list[idx - 1]]; renderView(); } });
      $('[data-down]', card).addEventListener('click', () => { if (idx < list.length - 1) { [list[idx + 1], list[idx]] = [list[idx], list[idx + 1]]; renderView(); } });
      $('[data-del]', card).addEventListener('click', () => { if (confirm('Xóa dự án này?')) { list.splice(idx, 1); renderView(); } });
      box.appendChild(card);
    });
    if (!list.length) box.appendChild(el('<div class="empty">Chưa có dự án nào.</div>'));
    return box;
  }

  // key/value text editor for a set of content[...] string keys
  function fieldsView(defs) {
    return () => {
      const box = el('<div class="card"></div>');
      defs.forEach((d) => box.appendChild(textField(d.label, data[d.key], (v) => data[d.key] = v, { area: d.area, rows: d.rows, type: d.type, ph: d.ph })));
      return box;
    };
  }

  // ---- tab registry ----
  const TABS = [
    { grp: 'Nội dung động' },
    { id: 'products', label: 'Sản phẩm', addLabel: 'Thêm sản phẩm', add: () => arr('productItems').unshift({ slug: uniqueSlug('san-pham', arr('productItems')), name: 'Sản phẩm mới', summary: '', body: '', image: '', gallery: [] }), render: views.products },
    { id: 'posts', label: 'Tin tức', addLabel: 'Thêm bài viết', add: () => arr('postItems').unshift({ slug: uniqueSlug('bai-viet', arr('postItems')), title: 'Bài viết mới', excerpt: '', body: '', image: '', date: new Date().toLocaleDateString('vi-VN') }), render: views.posts },
    { id: 'projects', label: 'Dự án', addLabel: 'Thêm dự án', add: () => arr('projects').unshift(['Dự án mới', '', '', []]), render: projectsView },
    { id: 'services', label: 'Dịch vụ', addLabel: 'Thêm dịch vụ', add: () => arr('services').unshift(['Dịch vụ mới', '']), render: pairListView('services', ['Tên dịch vụ', 'Mô tả']) },
    { grp: 'Trang & cấu hình' },
    { id: 'home', label: 'Trang chủ', render: fieldsView([
      { key: 'home.title', label: 'Tiêu đề trang (title/SEO)' },
      { key: 'home.metaDescription', label: 'Mô tả SEO (meta description)', area: true, rows: 2 },
      { key: 'home.h1', label: 'Tiêu đề H1 (hero slide 1)', area: true, rows: 2 },
      { key: 'home.heroSlide2', label: 'Hero slide 2', area: true, rows: 2 },
      { key: 'home.heroSlide3', label: 'Hero slide 3', area: true, rows: 2 },
      { key: 'home.heroSlide4', label: 'Hero slide 4', area: true, rows: 2 },
      { key: 'home.craftTitle', label: 'Tiêu đề mục “Tinh thần thủ công”', area: true, rows: 2 },
      { key: 'home.craftText1', label: 'Đoạn 1', area: true },
      { key: 'home.craftText2', label: 'Đoạn 2', area: true },
      { key: 'home.productTitle', label: 'Tiêu đề mục sản phẩm' },
      { key: 'home.vrTitle', label: 'Tiêu đề mục 360°' },
      { key: 'home.vrText', label: 'Mô tả mục 360°', area: true },
      { key: 'home.advantageEyebrow', label: 'Nhãn mục ưu điểm' },
      { key: 'home.advantageTitle', label: 'Tiêu đề mục ưu điểm' },
      { key: 'home.caseEyebrow', label: 'Nhãn mục công trình' },
      { key: 'home.caseTitle', label: 'Tiêu đề mục công trình', area: true, rows: 2 },
      { key: 'home.serviceEyebrow', label: 'Nhãn mục dịch vụ' },
      { key: 'home.serviceTitle', label: 'Tiêu đề mục dịch vụ' },
      { key: 'home.newsTitle', label: 'Tiêu đề mục tin tức' },
      { key: 'home.newsIntro', label: 'Mô tả mục tin tức', area: true },
      { key: 'home.messageTitle', label: 'Tiêu đề form tư vấn' },
      { key: 'home.messageIntro', label: 'Mô tả form tư vấn', area: true },
    ]) },
    { id: 'homeAdvantages', label: 'Giải pháp trọn gói', render: () => {
      ensureHomeImages();
      const box = el('<div></div>');
      box.appendChild(el('<div class="card"><b>Giải pháp trọn gói</b><p class="muted" style="margin:8px 0 0">Chỉnh tiêu đề, mô tả và ảnh từng ô ưu điểm trên trang chủ.</p></div>'));
      const advAdd = el('<button class="btn primary" style="margin:0 0 12px">+ Thêm ưu điểm</button>');
      advAdd.addEventListener('click', () => { arr('homeAdvantages').push(['Ưu điểm mới', '', '']); renderView(); });
      box.appendChild(advAdd);
      box.appendChild(pairListView('homeAdvantages', ['Tiêu đề', 'Mô tả'], true)());
      return box;
    } },
    { id: 'homeCases', label: 'Công trình tiêu biểu', render: () => {
      const box = el('<div></div>');
      box.appendChild(el('<div class="card"><b>Công trình tiêu biểu</b><p class="muted" style="margin:8px 0 0">Chỉnh tên, mô tả ngắn và ảnh từng công trình trên slider trang chủ.</p></div>'));
      const caseAdd = el('<button class="btn primary" style="margin:0 0 12px">+ Thêm công trình</button>');
      caseAdd.addEventListener('click', () => { arr('homeCases').push(['Công trình mới', '', '', []]); renderView(); });
      box.appendChild(caseAdd);
      box.appendChild(homeCasesView());
      return box;
    } },
    { id: 'homeServices', label: 'Dịch vụ đồng hành', render: () => {
      const box = el('<div></div>');
      box.appendChild(el('<div class="card"><b>Dịch vụ đồng hành</b><p class="muted" style="margin:8px 0 0">Chỉnh tiêu đề và mô tả từng dịch vụ trên trang chủ.</p></div>'));
      const serviceAdd = el('<button class="btn primary" style="margin:0 0 12px">+ Thêm dịch vụ</button>');
      serviceAdd.addEventListener('click', () => { arr('homeServices').push(['Dịch vụ mới', '']); renderView(); });
      box.appendChild(serviceAdd);
      box.appendChild(pairListView('homeServices', ['Tên dịch vụ', 'Mô tả'])());
      return box;
    } },
    { id: 'vr', label: '360 độ', render: () => {
      const box = el('<div></div>');
      box.appendChild(fieldsView([
        { key: 'home.vrTitle', label: 'Trang chủ — tiêu đề mục 360°' },
        { key: 'home.vrText', label: 'Trang chủ — mô tả mục 360°', area: true },
        { key: 'vr.eyebrow', label: 'Trang 360° — nhãn nhỏ' },
        { key: 'vr.title', label: 'Trang 360° — tiêu đề' },
        { key: 'vr.button', label: 'Trang 360° — chữ nút' },
        { key: 'vr.url', label: 'Link trải nghiệm 360°', type: 'url' },
        { key: 'vr.cabinEyebrow', label: 'Nhãn mục cabin' },
        { key: 'vr.cabinTitle', label: 'Tiêu đề mục cabin' },
      ])());
      const add = el('<button class="btn primary" style="margin:0 0 12px">+ Thêm cabin</button>');
      add.addEventListener('click', () => { arr('vrCabins').push(['Mẫu cabin mới', '', '']); renderView(); });
      box.appendChild(el('<div class="head"><div><h2>Mẫu cabin 360°</h2><p>Chỉnh tên, mô tả và ảnh từng mẫu cabin.</p></div></div>'));
      box.appendChild(add);
      box.appendChild(pairListView('vrCabins', ['Tên cabin', 'Mô tả'], true)());
      return box;
    } },
    { id: 'listmeta', label: 'Tiêu đề trang con', render: fieldsView([
      { key: 'products.title', label: 'Sản phẩm — tiêu đề' },
      { key: 'products.intro', label: 'Sản phẩm — mô tả', area: true },
      { key: 'blog.title', label: 'Tin tức — tiêu đề' },
      { key: 'blog.intro', label: 'Tin tức — mô tả', area: true },
      { key: 'projects.title', label: 'Dự án — tiêu đề' },
      { key: 'projects.intro', label: 'Dự án — mô tả', area: true },
      { key: 'services.title', label: 'Dịch vụ — tiêu đề' },
      { key: 'services.intro', label: 'Dịch vụ — mô tả', area: true },
    ]) },
    { id: 'about', label: 'Giới thiệu', render: fieldsView([
      { key: 'about.title', label: 'Tiêu đề' },
      { key: 'about.p1', label: 'Đoạn 1', area: true },
      { key: 'about.p2', label: 'Đoạn 2', area: true },
      { key: 'about.story1', label: 'Câu chuyện 1', area: true },
      { key: 'about.story2', label: 'Câu chuyện 2', area: true },
      { key: 'about.vision', label: 'Tầm nhìn', area: true },
      { key: 'about.mission', label: 'Sứ mệnh', area: true },
    ]) },
    { id: 'contact', label: 'Liên hệ & CTA', render: fieldsView([
      { key: 'contact.salesPhone', label: 'SĐT Kinh doanh', ph: '0939612555' },
      { key: 'contact.techPhone', label: 'SĐT Kỹ thuật', ph: '0902218255' },
      { key: 'contact.email', label: 'Email', type: 'email' },
      { key: 'contact.address', label: 'Địa chỉ showroom', area: true, rows: 2 },
      { key: 'contact.zalo', label: 'Link Zalo OA', type: 'url', ph: 'https://zalo.me/0939612555' },
      { key: 'contact.facebook', label: 'Link Fanpage Facebook', type: 'url', ph: 'https://www.facebook.com/...' },
      { key: 'contact.facebookName', label: 'Tên hiển thị Fanpage', ph: 'Franz Home Lift Vietnam' },
      { key: 'contact.facebookCover', label: 'Ảnh cover Fanpage', type: 'url', ph: '/uploads/cover.webp' },
      { key: 'contact.facebookAvatar', label: 'Ảnh đại diện Fanpage', type: 'url', ph: '/uploads/avatar.webp' },
      { key: 'contact.title', label: 'Tiêu đề trang liên hệ' },
      { key: 'contact.intro', label: 'Mô tả trang liên hệ', area: true },
    ]) },
    { id: 'tech', label: 'Công nghệ', addLabel: 'Thêm mục', add: () => arr('techItems').unshift(['Mục mới', '']), render: pairListView('techItems', ['Tiêu đề', 'Mô tả']) },
    { id: 'features', label: 'Thông số (trang SP)', addLabel: 'Thêm thông số', add: () => arr('features').unshift(['Tiêu đề', '']), render: pairListView('features', ['Tiêu đề', 'Mô tả']) },
  ];

  let activeTab = 'products';

  function renderTabs() {
    const nav = $('#tabs');
    nav.innerHTML = '';
    TABS.forEach((tab) => {
      if (tab.grp) { nav.appendChild(el(`<div class="grp">${esc(tab.grp)}</div>`)); return; }
      const b = el(`<button data-tab="${tab.id}">${esc(tab.label)}</button>`);
      if (tab.id === activeTab) b.classList.add('active');
      b.addEventListener('click', () => { activeTab = tab.id; renderTabs(); renderView(); });
      nav.appendChild(b);
    });
  }

  function renderView() {
    if (window.tinymce) window.tinymce.remove('.rich-editor');
    const tab = TABS.find((t) => t.id === activeTab);
    const view = $('#view');
    view.innerHTML = '';
    const head = el(`<div class="head"><div><h2>${esc(tab.label)}</h2><p>${tab.add ? 'Thêm, sửa, xóa và sắp xếp thứ tự hiển thị.' : 'Chỉnh sửa nội dung hiển thị trên website.'}</p></div></div>`);
    if (tab.add) {
      const addBtn = el(`<button class="btn primary" style="margin-left:auto">+ ${esc(tab.addLabel)}</button>`);
      addBtn.addEventListener('click', () => { tab.add(); renderView(); });
      head.appendChild(addBtn);
    }
    view.appendChild(head);
    view.appendChild(tab.render());
  }

  // ---- persistence ----
  function cleanup(obj) {
    // strip transient UI flags before saving
    (obj.productItems || []).forEach((p) => delete p._slugTouched);
    (obj.postItems || []).forEach((p) => delete p._slugTouched);
    return obj;
  }

  const App = {
    async save() {
      if (window.tinymce) window.tinymce.triggerSave();
      $('#saving').classList.add('show');
      try {
        const res = await fetch('/api/content', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cleanup(data)) });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Lưu thất bại');
        toast('Đã lưu. Thay đổi đã hiển thị trên website.');
      } catch (e) { toast(e.message, true); }
      finally { $('#saving').classList.remove('show'); }
    },
    async reload() {
      if (!confirm('Tải lại từ máy chủ? Mọi thay đổi chưa lưu sẽ mất.')) return;
      const res = await fetch('/api/content');
      data = await res.json();
      renderView();
      toast('Đã tải lại nội dung.');
    },
  };
  window.App = App;

  renderTabs();
  renderView();
})();
