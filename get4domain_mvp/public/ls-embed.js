/*
 * Get4Domain LeadSpace embed. Adds ONLY the purpose layer to a page you already have: one sticky button and a request form that opens over the page.
 * It never reads, changes or removes anything that is already on the page. Everything it draws lives in its own shadow root.
 *
 *   <script src="https://get4domain.com/ls-embed.js" data-slug="your-page-slug" data-api="https://gapi.get4domain.com" defer></script>
 */
(function () {
  var tag = document.currentScript || document.querySelector('script[data-slug][src*="ls-embed"]');
  if (!tag) return;
  var slug = tag.getAttribute('data-slug');
  var api = (tag.getAttribute('data-api') || 'https://gapi.get4domain.com').replace(/\/+$/, '');
  if (!slug || document.getElementById('g4d-leadspace-host')) return;

  function beacon(kind) {
    try {
      var body = JSON.stringify({ slug: slug, kind: kind });
      if (navigator.sendBeacon) navigator.sendBeacon(api + '/leadspace/public/track', new Blob([body], { type: 'application/json' }));
      else fetch(api + '/leadspace/public/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body, keepalive: true });
    } catch (e) { /* never get in the way of the page */ }
  }
  function send(path, payload) {
    return fetch(api + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) throw new Error(j.message || 'Something went wrong. Please try again in a minute.');
        return j.data;
      });
    });
  }
  function device() {
    try { var k = 'ls_device'; var v = localStorage.getItem(k); if (!v) { v = Date.now().toString(36) + Math.random().toString(36).slice(2, 10); localStorage.setItem(k, v); } return v; } catch (e) { return ''; }
  }
  function el(name, attrs, kids) {
    var n = document.createElement(name);
    Object.keys(attrs || {}).forEach(function (k) { if (k === 'text') n.textContent = attrs[k]; else n.setAttribute(k, attrs[k]); });
    (kids || []).forEach(function (c) { n.appendChild(c); });
    return n;
  }

  fetch(api + '/leadspace/public/page/' + encodeURIComponent(slug)).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
    var m = j && j.data;
    if (!m) return;
    beacon('view');
    var accent = (m.theme && m.theme.accent) || '#2563eb';
    var host = el('div', { id: 'g4d-leadspace-host' });
    var root = host.attachShadow({ mode: 'open' });
    var style = el('style');
    style.textContent = [
      ':host{all:initial}',
      '*{box-sizing:border-box;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif}',
      '.bar{position:fixed;left:0;right:0;bottom:0;z-index:2147483000;padding:10px 12px;background:#fff;border-top:1px solid #e2e8f0}',
      '.btn{display:block;width:100%;border:0;border-radius:12px;padding:14px 16px;font-size:16px;font-weight:600;color:#fff;background:' + accent + ';cursor:pointer}',
      '.veil{position:fixed;inset:0;z-index:2147483001;background:rgba(15,23,42,.55);display:none;align-items:flex-end;justify-content:center}',
      '.veil.on{display:flex}',
      '.card{background:#fff;width:100%;max-width:480px;max-height:92vh;overflow:auto;border-radius:16px 16px 0 0;padding:18px}',
      'label{display:block;margin:10px 0 4px;font-size:14px;color:#334155}',
      'input,select,textarea{width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:11px;font-size:16px;color:#0f172a;background:#fff}',
      '.consent{display:flex;gap:8px;margin:12px 0;font-size:12px;color:#475569}.consent input{width:auto;margin-top:2px}',
      '.err{color:#dc2626;font-size:14px;margin:8px 0}.x{float:right;background:none;border:0;font-size:24px;line-height:1;cursor:pointer;color:#475569}',
      '.ok{text-align:center;padding:12px 0;color:#0f172a}'
    ].join('');
    var bar = el('div', { class: 'bar' });
    var open = el('button', { class: 'btn', type: 'button', text: m.stickyCta.label });
    bar.appendChild(open);
    var veil = el('div', { class: 'veil' });
    var card = el('div', { class: 'card' });
    veil.appendChild(card);
    root.appendChild(style); root.appendChild(bar); root.appendChild(veil);

    var values = {}; var consentOn = false; var otpId = null;
    function field(f) {
      var wrap = document.createElement('div');
      var lab = el('label', { text: f.label + (f.required ? '' : ' (optional)') });
      var input;
      if (f.kind === 'textarea') input = el('textarea', { rows: '3', maxlength: '1000', placeholder: f.hint || '' });
      else if (f.kind === 'select') { input = el('select'); input.appendChild(el('option', { value: '', text: 'Choose' })); (f.options || []).forEach(function (o) { input.appendChild(el('option', { value: o, text: o })); }); }
      else if (f.kind === 'date') input = el('input', { type: 'date', min: new Date().toISOString().slice(0, 10) });
      else if (f.kind === 'cart') { input = el('textarea', { rows: '3', placeholder: 'One item per line, for example: Rice 5kg x 2' }); lab.textContent = 'Your items' + (f.required ? '' : ' (optional)'); }
      else input = el('input', { type: f.kind === 'tel' ? 'tel' : 'text', maxlength: f.kind === 'tel' ? '15' : '120', inputmode: f.kind === 'tel' ? 'numeric' : 'text' });
      input.addEventListener('input', function () { values[f.key] = input.value; });
      wrap.appendChild(lab); wrap.appendChild(input);
      return wrap;
    }
    function items(text) {
      return String(text || '').split(/\r?\n/).map(function (line) {
        var mm = /^(.*?)(?:\s*[x*]\s*(\d{1,2}))?\s*$/i.exec(line.trim());
        return mm && mm[1] ? { name: mm[1].trim(), qty: mm[2] ? parseInt(mm[2], 10) : 1 } : null;
      }).filter(Boolean);
    }
    function renderDetails() {
      card.textContent = '';
      var close = el('button', { class: 'x', type: 'button', 'aria-label': 'Close', text: '×' });
      close.addEventListener('click', function () { veil.classList.remove('on'); });
      card.appendChild(close);
      card.appendChild(el('strong', { text: m.business.name }));
      m.form.fields.forEach(function (f) { card.appendChild(field(f)); });
      var consent = el('label', { class: 'consent' });
      var cb = el('input', { type: 'checkbox' });
      cb.addEventListener('change', function () { consentOn = cb.checked; });
      consent.appendChild(cb); consent.appendChild(el('span', { text: m.form.consentText }));
      var err = el('div', { class: 'err', role: 'alert' });
      var go = el('button', { class: 'btn', type: 'button', text: m.form.submitLabel });
      card.appendChild(consent); card.appendChild(err); card.appendChild(go);
      var started = false;
      card.addEventListener('input', function () { if (!started) { started = true; beacon('form'); } });
      go.addEventListener('click', function () {
        err.textContent = '';
        if (!consentOn) { err.textContent = 'Please tick the box to agree before we send a code.'; return; }
        for (var i = 0; i < m.form.fields.length; i++) { var f = m.form.fields[i]; if (f.required && !(values[f.key] || '').trim()) { err.textContent = 'Please fill in: ' + f.label + '.'; return; } }
        go.disabled = true;
        send('/leadspace/public/otp', { slug: slug, phone: values.phone, consent: true, deviceId: device() }).then(function (r) { otpId = r.otpId; renderCode(); }).catch(function (e) { err.textContent = e.message; go.disabled = false; });
      });
    }
    function renderCode() {
      card.textContent = '';
      card.appendChild(el('p', { text: 'We sent a 6-digit code to your WhatsApp number. Enter it to send your request.' }));
      var code = el('input', { type: 'text', inputmode: 'numeric', maxlength: '6', autocomplete: 'one-time-code', 'aria-label': 'Verification code' });
      var err = el('div', { class: 'err', role: 'alert' });
      var go = el('button', { class: 'btn', type: 'button', text: 'Confirm and send' });
      card.appendChild(code); card.appendChild(err); card.appendChild(go);
      go.addEventListener('click', function () {
        err.textContent = '';
        if (!/^\d{6}$/.test(code.value.trim())) { err.textContent = 'Enter the 6-digit code from WhatsApp.'; return; }
        go.disabled = true;
        var p = {};
        m.form.fields.forEach(function (f) { if (f.key === 'name' || f.key === 'phone') return; if (f.kind === 'cart') p.items = items(values[f.key]); else if (values[f.key]) p[f.key] = values[f.key]; });
        send('/leadspace/public/event', { slug: slug, name: values.name, phone: values.phone, payload: p, otpId: otpId, code: code.value.trim(), idempotencyKey: 'ls:' + slug + ':' + otpId, source: 'embed', deviceId: device() })
          .then(function (r) { card.textContent = ''; card.appendChild(el('div', { class: 'ok' }, [el('strong', { text: 'Request received' }), el('p', { text: r.message })])); })
          .catch(function (e) { err.textContent = e.message; go.disabled = false; });
      });
    }
    open.addEventListener('click', function () { beacon('cta'); renderDetails(); veil.classList.add('on'); });
    document.body.appendChild(host);
  }).catch(function () { /* the page the visitor came for keeps working */ });
})();
