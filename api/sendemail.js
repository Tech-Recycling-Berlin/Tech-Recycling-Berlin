// Tech Recycling Berlin — contact form handler (Vercel Node serverless)
// Sends mail via Resend. Set RESEND_API_KEY in the Vercel project env vars.
// Optional env vars:
//   MAIL_TO     — recipient (default: info@techrecycling-berlin.com)
//   MAIL_FROM   — sender    (default: Tech Recycling Berlin <onboarding@resend.dev>)
//
// The internal mail follows the format the enquiry automation parses
// (one `Label: value` line per field, `Geräte:` block, `Nachricht / Message:`
// last). Change labels or option texts only together with the automation.
//
// Response format:
//   - If the client sends `Accept: application/json` (the on-page JS handler does),
//     responds with JSON: { ok, message, fieldErrors? }
//   - Otherwise responds with a styled HTML page (no-JS fallback)

export const config = { runtime: 'nodejs' };

const MESSAGES = {
  de: {
    success: 'Vielen Dank! Ihre Nachricht wurde erfolgreich gesendet. Wir melden uns innerhalb von 24 Stunden.',
    error:   'Beim Senden ist ein Fehler aufgetreten. Bitte versuchen Sie es später erneut oder rufen Sie uns an.',
    invalid: 'Bitte prüfen Sie die markierten Felder.',
    field_name:    'Bitte geben Sie Ihren Namen ein.',
    field_email:   'Bitte geben Sie eine gültige E-Mail-Adresse ein.',
    field_company: 'Bitte geben Sie Ihre Firma an.',
    field_devices: 'Bitte beschreiben Sie kurz die Geräte oder laden Sie eine Liste bzw. Fotos hoch.',
    field_attachments: 'Die Dateien sind zu groß oder haben ein nicht unterstütztes Format (max. 10 Dateien, zusammen 3 MB).',
    field_consent: 'Bitte stimmen Sie der Datenschutzerklärung zu.',
    backBtn:  'Zurück',
    titleOk:  'Nachricht gesendet',
    titleErr: 'Fehler',
    backHome: '/',
    backForm: '/kontakt',
  },
  en: {
    success: 'Thank you! Your message was sent successfully. We will reply within 24 hours.',
    error:   'An error occurred. Please try again later or give us a call.',
    invalid: 'Please check the highlighted fields.',
    field_name:    'Please enter your name.',
    field_email:   'Please enter a valid email address.',
    field_company: 'Please enter your company.',
    field_devices: 'Please briefly describe the devices or upload a list or photos.',
    field_attachments: 'The files are too large or in an unsupported format (max. 10 files, 3 MB in total).',
    field_consent: 'Please agree to the Privacy Policy.',
    backBtn:  'Back',
    titleOk:  'Message sent',
    titleErr: 'Error',
    backHome: '/en/',
    backForm: '/en/contact',
  },
};

// Internal mail subject — always German, the automation expects this wording.
const ADMIN_SUBJECT = 'Neue Anfrage über techrecycling-berlin.com';

// Field labels and option texts for the internal mail. Option texts must stay
// word-for-word identical to the labels on kontakt.html / en/contact.html.
const LABELS = {
  de: {
    salutation: 'Anrede', name: 'Name', company: 'Firma', email: 'E-Mail', phone: 'Telefon',
    service: 'Leistung', carriers: 'Datenträger', location: 'Abholort', date: 'Wunschtermin',
    devices: 'Geräte',
  },
  en: {
    salutation: 'Salutation', name: 'Name', company: 'Company', email: 'Email', phone: 'Phone',
    service: 'Service', carriers: 'Data carriers', location: 'Collection location', date: 'Preferred date',
    devices: 'Devices',
  },
};

const OPTIONS = {
  salutation: {
    frau: { de: 'Frau', en: 'Ms' },
    herr: { de: 'Herr', en: 'Mr' },
  },
  service: {
    entsorgung: { de: 'Entsorgen / recyceln', en: 'Disposal / recycling' },
    ankauf:     { de: 'Ankauf prüfen',        en: 'Check purchase' },
  },
  carriers: {
    loeschen:   { de: 'Daten löschen',                   en: 'Erase data' },
    vernichten: { de: 'Datenträger physisch vernichten', en: 'Physically destroy data carriers' },
    beides:     { de: 'Löschen und zusätzlich vernichten', en: 'Erase and additionally destroy' },
    unklar:     { de: 'Noch unklar — bitte beraten',     en: 'Not sure yet — please advise' },
  },
};

// Attachments arrive base64-encoded in the JSON body. Vercel caps request
// bodies at 4.5 MB, so the decoded total stays at 3 MB (base64 adds ~33 %).
const ATTACHMENT_MAX_FILES = 10;
const ATTACHMENT_MAX_TOTAL = 3_000_000;
const ATTACHMENT_EXTENSIONS = new Set([
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf', 'txt', 'csv', 'tsv',
  'xls', 'xlsx', 'ods', 'doc', 'docx', 'odt',
]);
const BODY_LIMIT = 4_600_000;

function parseForm(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > BODY_LIMIT) { reject(new Error('body too large')); req.destroy(); return; }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        // Decode once at the end so multi-byte characters split across chunks survive.
        const raw = Buffer.concat(chunks).toString('utf8');
        const ct = (req.headers['content-type'] || '').toLowerCase();
        if (ct.includes('application/json')) return resolve(JSON.parse(raw || '{}'));
        const params = new URLSearchParams(raw);
        const obj = {};
        for (const [k, v] of params) {
          if (k in obj) obj[k] = [].concat(obj[k], v);
          else obj[k] = v;
        }
        resolve(obj);
      } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

// ---- Sequential ticket counter ------------------------------------------
// Uses Upstash / Vercel-KV REST API to atomically fetch the next ticket
// number. Bootstrap value = 37552 (set only if the key does not yet exist),
// so the first ticket out of the gate is TRB-37553. If no KV credentials
// are configured (or the call fails for any reason), gracefully fall back
// to a random TRB-NNNNN — the form will keep working, tickets just won't
// be sequential until KV is wired up.
//
// TRB-84000 … TRB-84999 belongs to customer numbers; a ticket in that range
// would be matched to the wrong customer by the automation, so it is skipped.
const TICKET_KEY = 'trb_ticket_seq';
const TICKET_SEED = 37552;
const RESERVED_FROM = 84000;
const RESERVED_TO = 84999;

function isReservedTicket(n) {
  return n >= RESERVED_FROM && n <= RESERVED_TO;
}

async function kvPipeline(url, token, commands) {
  const r = await fetch(url + '/pipeline', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify(commands),
  });
  if (!r.ok) throw new Error('kv http ' + r.status);
  return r.json();
}

function kvNumber(entry) {
  const num = entry && (entry.result ?? entry.response);
  return typeof num === 'number' && Number.isFinite(num) ? num : null;
}

async function getNextTicket() {
  const url   = process.env.KV_REST_API_URL  || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  const fallback = () => {
    let n;
    do { n = 10000 + Math.floor(Math.random() * 90000); } while (isReservedTicket(n));
    return 'TRB-' + n;
  };

  if (!url || !token) return fallback();

  try {
    const data = await kvPipeline(url, token, [
      ['set',  TICKET_KEY, String(TICKET_SEED), 'nx'],
      ['incr', TICKET_KEY],
    ]);
    let num = kvNumber(data && data[1]);
    if (num === null) throw new Error('kv unexpected response: ' + JSON.stringify(data));
    if (isReservedTicket(num)) {
      // Jump past the reserved range. INCRBY is relative and atomic, so
      // concurrent requests still get distinct numbers.
      const jump = await kvPipeline(url, token, [
        ['incrby', TICKET_KEY, String(RESERVED_TO + 1 - num)],
      ]);
      num = kvNumber(jump && jump[0]);
      if (num === null || isReservedTicket(num)) throw new Error('kv unexpected response: ' + JSON.stringify(jump));
    }
    return 'TRB-' + num;
  } catch (e) {
    console.warn('[sendemail] ticket counter fallback to random:', e.message);
    return fallback();
  }
}

// ---- Cloudflare Turnstile verification -----------------------------------
// Verifies the token issued by the widget against Cloudflare's siteverify
// endpoint. If TURNSTILE_SECRET_KEY isn't set (e.g. local dev or pre-config
// deploy), verification is skipped with a warning so the form keeps working.
async function verifyTurnstile(token, ip) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    console.warn('[sendemail] TURNSTILE_SECRET_KEY not set — skipping verification');
    return { ok: true, skipped: true };
  }
  if (!token) return { ok: false, reason: 'missing-token' };
  try {
    const params = new URLSearchParams();
    params.set('secret', secret);
    params.set('response', token);
    if (ip) params.set('remoteip', ip);
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    const data = await r.json().catch(() => ({}));
    if (!data || !data.success) {
      console.warn('[sendemail] turnstile rejected', data && data['error-codes']);
      return { ok: false, reason: (data && data['error-codes']) || 'rejected' };
    }
    return { ok: true };
  } catch (e) {
    console.error('[sendemail] turnstile verify error', e);
    return { ok: false, reason: 'verify-error' };
  }
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c])
  );
}

// ---- Form fields ---------------------------------------------------------
function str(v) {
  return typeof v === 'string' ? v : '';
}

// Single-line value: no line breaks, collapsed whitespace.
function oneLine(v) {
  return str(v).replace(/\s+/g, ' ').trim();
}

// Multi-line value: normalised line endings, trailing spaces removed.
function multiLine(v) {
  return str(v).replace(/\r\n?/g, '\n').split('\n').map(l => l.trimEnd()).join('\n').trim();
}

function pickOption(group, value) {
  return Object.prototype.hasOwnProperty.call(OPTIONS[group], value) ? value : '';
}

// Greeting for the acknowledgement mail. The salutation is never derived
// from the first name — without one we greet with the full name.
function greeting(lang, salutation, name) {
  const lastName = name.split(' ').pop();
  if (lang === 'en') {
    if (salutation === 'frau') return `Dear Ms ${lastName}`;
    if (salutation === 'herr') return `Dear Mr ${lastName}`;
    return name ? `Dear ${name}` : 'Dear customer';
  }
  if (salutation === 'frau') return `Sehr geehrte Frau ${lastName}`;
  if (salutation === 'herr') return `Sehr geehrter Herr ${lastName}`;
  return name ? `Guten Tag ${name}` : 'Guten Tag';
}

// Internal mail body. Empty fields are left out entirely — a placeholder
// like "-" would be read as a value by the automation.
function buildAdminText({ ticket, lang, fields }) {
  const L = LABELS[lang];
  const opt = (group, key) => OPTIONS[group][key][lang];
  const lines = [];
  const add = (label, value) => { if (value) lines.push(`${label}: ${value}`); };

  add(L.salutation, fields.salutation && opt('salutation', fields.salutation));
  add(L.name,     fields.name);
  add(L.company,  fields.company);
  add(L.email,    fields.email);
  add(L.phone,    fields.phone);
  add(L.service,  fields.service.map(k => opt('service', k)).join(', '));
  add(L.carriers, opt('carriers', fields.carriers));
  add(L.location, fields.location);
  add(L.date,     fields.date);
  add('Sprache',  lang);

  let text = `Neue Anfrage / New enquiry — ${ticket}\n\n${lines.join('\n')}\n`;
  if (fields.devices) text += `\n${L.devices}:\n${fields.devices}\n`;
  if (fields.message) text += `\nNachricht / Message:\n${fields.message}\n`;
  return text;
}

// Validates uploaded files. Returns { ok, attachments } in Resend's format.
function parseAttachments(raw) {
  if (raw == null || raw === '') return { ok: true, attachments: [] };
  if (!Array.isArray(raw) || raw.length > ATTACHMENT_MAX_FILES) return { ok: false };
  const attachments = [];
  let total = 0;
  for (const file of raw) {
    const filename = oneLine(file && file.filename).replace(/[\\/:*?"<>|]/g, '_').slice(-120);
    const content = str(file && file.content);
    const ext = (filename.match(/\.([a-z0-9]+)$/i) || [])[1];
    if (!filename || !content || !ext || !ATTACHMENT_EXTENSIONS.has(ext.toLowerCase())) return { ok: false };
    if (!/^[A-Za-z0-9+/]+=*$/.test(content)) return { ok: false };
    total += Buffer.byteLength(content, 'base64');
    if (total > ATTACHMENT_MAX_TOTAL) return { ok: false };
    attachments.push({ filename, content });
  }
  return { ok: true, attachments };
}

// The sending address must stay on our verified domain (SPF/DMARC), so the
// customer goes into the display name and Reply-To.
function senderFor(from, name) {
  const address = (from.match(/<([^>]+)>/) || [])[1] || from.trim();
  const display = name.replace(/["<>\\,;]/g, '').trim();
  return display ? `"${display} via Kontaktformular" <${address}>` : from;
}

// ---- Auto-reply (acknowledgement) email ---------------------------------
// Sent to the form submitter. Bilingual DE/EN, design-matched to the site
// (green primary #3A9E1E, lime accent #bdea5c, dark footer #0f1a0d).
// Inline styles only — most email clients strip <style> blocks.
function renderAckHtml({ ticket, name, salutation }) {
  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Tech Recycling Berlin</title>
</head>
<body style="margin:0;padding:24px 12px;background:#f4faf0;font-family:'Manrope','Helvetica Neue',Arial,sans-serif;color:#0f1a0d;-webkit-font-smoothing:antialiased">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 1px 2px rgba(15,26,13,.06),0 14px 34px -14px rgba(15,26,13,.12)">

        <!-- Top header strip -->
        <tr><td style="background:#3A9E1E;color:#ffffff;padding:30px 32px">
          <div style="font-family:'Manrope','Helvetica Neue',Arial,sans-serif;font-weight:800;font-size:22px;letter-spacing:-.01em;line-height:1.2">Tech Recycling Berlin</div>
          <div style="font-size:14px;line-height:1.5;color:#e8f5e1;margin-top:6px">Ihr Partner für zertifizierte IT-Entsorgung</div>
        </td></tr>

        <!-- Ticket reference bar -->
        <tr><td style="background:#f4faf0;border-bottom:1px solid #e5e9e2;padding:14px 32px;font-size:13px;color:#2a3328">
          <strong style="color:#2d7d16;letter-spacing:.04em;text-transform:uppercase;font-size:11px">Ticket-Referenz</strong>
          &nbsp;&nbsp;
          <code style="font-family:'SFMono-Regular',Consolas,Menlo,monospace;font-size:13px;color:#0f1a0d">${escapeHtml(ticket)}</code>
        </td></tr>

        <!-- DE body -->
        <tr><td style="padding:28px 32px 8px;font-size:15px;line-height:1.6;color:#1b2a19">
          <p style="margin:0 0 12px"><strong>${escapeHtml(greeting('de', salutation, name))},</strong></p>
          <p style="margin:0 0 12px">vielen Dank für Ihre Nachricht. Wir haben Ihre Anfrage erhalten und melden uns innerhalb von <strong>24 Stunden</strong> bei Ihnen mit einem individuellen Angebot.</p>
          <p style="margin:0 0 4px">Bei dringenden Anliegen erreichen Sie uns unter</p>
          <p style="margin:0 0 18px">
            <a href="mailto:info@techrecycling-berlin.com" style="color:#3A9E1E;text-decoration:none;font-weight:600">info@techrecycling-berlin.com</a>
            &nbsp;oder&nbsp;
            <a href="tel:+4915566044719" style="color:#3A9E1E;text-decoration:none;font-weight:600">+49 155 660 44719</a>.
          </p>
        </td></tr>

        <!-- Divider -->
        <tr><td style="padding:0 32px"><div style="border-top:1px solid #e5e9e2"></div></td></tr>

        <!-- EN body -->
        <tr><td style="padding:24px 32px 8px;font-size:15px;line-height:1.6;color:#1b2a19">
          <p style="margin:0 0 12px"><strong>${escapeHtml(greeting('en', salutation, name))},</strong></p>
          <p style="margin:0 0 12px">thank you for your message. We have received your enquiry and will reply within <strong>24 hours</strong> with a tailored offer.</p>
          <p style="margin:0 0 4px">For urgent matters, please contact us at</p>
          <p style="margin:0 0 18px">
            <a href="mailto:info@techrecycling-berlin.com" style="color:#3A9E1E;text-decoration:none;font-weight:600">info@techrecycling-berlin.com</a>
            &nbsp;or&nbsp;
            <a href="tel:+4915566044719" style="color:#3A9E1E;text-decoration:none;font-weight:600">+49 155 660 44719</a>.
          </p>
        </td></tr>

        <!-- Sign-off -->
        <tr><td style="padding:0 32px 28px;font-size:15px;line-height:1.6">
          <p style="margin:0 0 4px;color:#6b7669;font-size:13px">Mit freundlichen Grüßen / Best regards,</p>
          <p style="margin:0;font-weight:700;color:#0f1a0d">Ihr Tech Recycling Team</p>
        </td></tr>

        <!-- Dark footer -->
        <tr><td style="background:#0f1a0d;color:#9aa896;padding:22px 32px;font-size:13px;line-height:1.55">
          <div style="color:#ffffff;font-family:'Manrope','Helvetica Neue',Arial,sans-serif;font-weight:700;font-size:14px;margin-bottom:4px">Tech Recycling Berlin</div>
          <div>Keithstraße 15 &middot; 10787 Berlin &middot; Deutschland</div>
          <div style="margin-top:8px">
            <a href="mailto:info@techrecycling-berlin.com" style="color:#bdea5c;text-decoration:none">info@techrecycling-berlin.com</a>
            &nbsp;&middot;&nbsp;
            <a href="https://techrecycling-berlin.com" style="color:#bdea5c;text-decoration:none">techrecycling-berlin.com</a>
          </div>
          <div style="margin-top:14px;font-size:11px;color:#6e7a6a;line-height:1.5">
            Diese E-Mail wurde automatisch versendet, bitte antworten Sie nicht direkt darauf.<br>
            This is an automated confirmation; please do not reply to this email.
          </div>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function renderAckText({ ticket, name, salutation }) {
  return `Tech Recycling Berlin
Ihr Partner für zertifizierte IT-Entsorgung

Ticket-Referenz: ${ticket}

${greeting('de', salutation, name)},
vielen Dank für Ihre Nachricht. Wir haben Ihre Anfrage erhalten und melden uns innerhalb von 24 Stunden bei Ihnen.
Bei dringenden Anliegen: info@techrecycling-berlin.com oder +49 155 660 44719.

----------------------------------------

${greeting('en', salutation, name)},
thank you for your message. We have received your enquiry and will reply within 24 hours.
For urgent matters: info@techrecycling-berlin.com or +49 155 660 44719.

Mit freundlichen Grüßen / Best regards,
Ihr Tech Recycling Team

—
Tech Recycling Berlin
Keithstraße 15 · 10787 Berlin · Deutschland
info@techrecycling-berlin.com · techrecycling-berlin.com

Diese E-Mail wurde automatisch versendet, bitte antworten Sie nicht darauf.
This is an automated confirmation; please do not reply to this email.
`;
}

function wantsJson(req) {
  const accept = (req.headers.accept || '').toLowerCase();
  if (accept.includes('application/json')) return true;
  const xrw = (req.headers['x-requested-with'] || '').toLowerCase();
  if (xrw === 'xmlhttprequest' || xrw === 'fetch') return true;
  return false;
}

function renderPage({ lang, kind, title, message, backUrl, backLabel }) {
  const ok = kind === 'success';
  const bg   = ok ? '#e7f5ea' : '#fde8e8';
  const line = ok ? '#c9e6cf' : '#f5c7c7';
  const col  = ok ? '#1f7a3a' : '#a61b1b';
  const icon = ok
    ? '<path d="M5 12l5 5L20 7"/>'
    : '<path d="M6 6l12 12M18 6L6 18"/>';
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title>
<link rel="stylesheet" href="/assets/css/style.css?v=20261013">
<link rel="stylesheet" href="/assets/fonts/fonts.css?v=20261013">
</head>
<body>
<section class="section" style="min-height:70vh;display:flex;align-items:center">
  <div class="container" style="max-width:560px;text-align:center">
    <div style="background:#fff;border:1px solid var(--line);border-radius:var(--radius-lg);padding:3rem 2rem">
      <div style="width:64px;height:64px;margin:0 auto 1.5rem;border-radius:50%;background:${bg};border:1px solid ${line};display:flex;align-items:center;justify-content:center">
        <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="${col}" stroke-width="2" stroke-linecap="round">${icon}</svg>
      </div>
      <h2 style="margin:0 0 .75rem">${escapeHtml(title)}</h2>
      <p style="color:var(--ink-soft);margin:0 0 1.75rem">${escapeHtml(message)}</p>
      <a href="${backUrl}" class="btn btn--primary">${escapeHtml(backLabel)}</a>
    </div>
  </div>
</section>
</body>
</html>`;
}

function respond(req, res, { json, status, lang, kind, title, message, backUrl, backLabel, fieldErrors, ticket }) {
  res.statusCode = status;
  if (json) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({
      ok: kind === 'success',
      message,
      fieldErrors: fieldErrors || null,
      ticket: ticket || null,
    }));
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.end(renderPage({ lang, kind, title, message, backUrl, backLabel }));
}

export default async function handler(req, res) {
  const json = wantsJson(req);

  // ---- One-shot ticket counter reset ---------------------------------
  // GET /api/sendemail?reset=trb&seed=37552&secret=<RESEND_API_KEY>
  // Resets the Redis counter so the next INCR returns seed+1. Auth uses
  // the existing RESEND_API_KEY so no extra env-var setup is needed.
  // Returns { ok, value } on success.
  if (req.method === 'GET') {
    const url = new URL(req.url, 'http://x');
    if (url.searchParams.get('reset') === 'trb') {
      const secret = url.searchParams.get('secret') || '';
      const expected = process.env.RESEND_API_KEY || '';
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      if (!expected || secret !== expected) {
        res.statusCode = 401;
        return res.end(JSON.stringify({ ok: false, reason: 'auth' }));
      }
      const seedRaw = url.searchParams.get('seed');
      const seed = Number.parseInt(seedRaw, 10);
      if (!Number.isFinite(seed)) {
        res.statusCode = 400;
        return res.end(JSON.stringify({ ok: false, reason: 'bad seed' }));
      }
      const kvUrl   = process.env.KV_REST_API_URL  || process.env.UPSTASH_REDIS_REST_URL;
      const kvToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
      if (!kvUrl || !kvToken) {
        res.statusCode = 500;
        return res.end(JSON.stringify({ ok: false, reason: 'no kv env vars' }));
      }
      try {
        const r = await fetch(kvUrl + '/set/' + encodeURIComponent(TICKET_KEY) + '/' + encodeURIComponent(String(seed)), {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + kvToken },
        });
        const data = await r.json().catch(() => ({}));
        res.statusCode = r.ok ? 200 : 502;
        return res.end(JSON.stringify({ ok: r.ok, value: seed, kv: data }));
      } catch (e) {
        res.statusCode = 502;
        return res.end(JSON.stringify({ ok: false, error: String(e && e.message || e) }));
      }
    }
  }

  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Content-Type', json ? 'application/json' : 'text/plain');
    return res.end(json ? JSON.stringify({ ok: false, message: 'Method not allowed' }) : 'Method not allowed');
  }

  let body;
  let bodyTooLarge = false;
  try { body = await parseForm(req); }
  catch (e) { body = {}; bodyTooLarge = e.message === 'body too large'; }

  // Language: explicit form field, else referer, else German
  let lang = str(body.lang).toLowerCase() === 'en' ? 'en' : 'de';
  if (!body.lang) {
    const ref = req.headers.referer || req.headers.referrer || '';
    if (/\/en\//.test(ref) || /\/contact(\.html|\b)/.test(ref)) lang = 'en';
  }
  const t = MESSAGES[lang];

  const fields = {
    salutation: pickOption('salutation', str(body.salutation)),
    name:       oneLine(body.name),
    company:    oneLine(body.company),
    email:      oneLine(body.email),
    phone:      oneLine(body.phone),
    service:    [...new Set([].concat(body.service || []))].map(str).filter(k => pickOption('service', k)),
    carriers:   pickOption('carriers', str(body.carriers)) || 'unklar',
    location:   oneLine(`${str(body.zip)} ${str(body.city)}`),
    date:       oneLine(body.date),
    devices:    multiLine(body.devices).split('\n').filter(l => l.trim()).join('\n'),
    message:    multiLine(body.message),
  };
  const consent = !!body.consent;
  const upload = bodyTooLarge ? { ok: false } : parseAttachments(body.attachments);

  // Honeypot — silently treat as success
  if (oneLine(body.website) !== '') {
    return respond(req, res, {
      json, status: 200, lang, kind: 'success',
      title: t.titleOk, message: t.success,
      backUrl: t.backHome, backLabel: t.backBtn,
    });
  }

  // Turnstile — verify before doing any real work
  const turnstileToken = body['cf-turnstile-response'] || body.cf_turnstile_token || '';
  const clientIp = (req.headers['cf-connecting-ip']
                  || (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
                  || req.socket?.remoteAddress
                  || '');
  const turnstile = await verifyTurnstile(turnstileToken, clientIp);
  if (!turnstile.ok) {
    return respond(req, res, {
      json, status: 400, lang, kind: 'error',
      title: t.titleErr,
      message: lang === 'en'
        ? 'Verification failed. Please complete the security challenge and try again.'
        : 'Verifizierung fehlgeschlagen. Bitte schließen Sie die Sicherheitsprüfung ab und versuchen Sie es erneut.',
      backUrl: t.backForm, backLabel: t.backBtn,
    });
  }

  // Field-level validation
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email);
  const fieldErrors = {};
  if (fields.name.length < 2)    fieldErrors.name        = t.field_name;
  if (!fields.company)           fieldErrors.company     = t.field_company;
  if (!emailOk)                  fieldErrors.email       = t.field_email;
  if (!upload.ok)                fieldErrors.attachments = t.field_attachments;
  else if (!fields.devices && !upload.attachments.length) fieldErrors.devices = t.field_devices;
  if (!consent)                  fieldErrors.consent     = t.field_consent;

  if (Object.keys(fieldErrors).length) {
    return respond(req, res, {
      json, status: 400, lang, kind: 'error',
      title: t.titleErr,
      message: t.invalid,
      fieldErrors,
      backUrl: t.backForm, backLabel: t.backBtn,
    });
  }

  const to        = process.env.MAIL_TO      || 'info@techrecycling-berlin.com';
  const from      = process.env.MAIL_FROM    || 'Tech Recycling Berlin <onboarding@resend.dev>';
  const noreplyFrom = process.env.NOREPLY_FROM || from;
  const apiKey    = process.env.RESEND_API_KEY;

  // Ticket reference for both the internal mail and the auto-reply.
  // Sequential when KV is configured, random otherwise — see getNextTicket().
  const ticket = await getNextTicket();

  const adminText = buildAdminText({ ticket, lang, fields });

  if (!apiKey) {
    console.error('[sendemail] RESEND_API_KEY is not set');
    return respond(req, res, {
      json, status: 500, lang, kind: 'error',
      title: t.titleErr, message: t.error,
      backUrl: t.backForm, backLabel: t.backBtn,
    });
  }

  // 1) Admin notification — must succeed for the request to count as "sent"
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        from: senderFor(from, fields.name),
        to: [to],
        reply_to: fields.email,
        subject: `[${ticket}] ${ADMIN_SUBJECT}`,
        text: adminText,
        ...(upload.attachments.length ? { attachments: upload.attachments } : {}),
      }),
    });
    if (!r.ok) {
      const detail = await r.text().catch(() => '');
      console.error('[sendemail] Resend error (admin)', r.status, detail);
      return respond(req, res, {
        json, status: 502, lang, kind: 'error',
        title: t.titleErr, message: t.error,
        backUrl: t.backForm, backLabel: t.backBtn,
      });
    }
  } catch (e) {
    console.error('[sendemail] fetch failed (admin)', e);
    return respond(req, res, {
      json, status: 502, lang, kind: 'error',
      title: t.titleErr, message: t.error,
      backUrl: t.backForm, backLabel: t.backBtn,
    });
  }

  // 2) Auto-reply to the submitter — best-effort. If it fails (e.g. domain
  //    not yet verified on Resend, so the sandbox sender can't deliver to a
  //    third-party address), log it but still return success — the admin
  //    already received the enquiry and that's the critical path.
  try {
    const ackHtml = renderAckHtml({ ticket, name: fields.name, salutation: fields.salutation });
    const ackText = renderAckText({ ticket, name: fields.name, salutation: fields.salutation });
    const ackSubject = `[${ticket}] Ihre Anfrage / Your inquiry — Tech Recycling Berlin`;
    const ackRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        from: noreplyFrom,
        to: [fields.email],
        reply_to: to,
        subject: ackSubject,
        html: ackHtml,
        text: ackText,
      }),
    });
    if (!ackRes.ok) {
      const detail = await ackRes.text().catch(() => '');
      console.warn('[sendemail] Resend warn (acknowledgement skipped)', ackRes.status, detail);
    }
  } catch (e) {
    console.warn('[sendemail] acknowledgement failed', e);
  }

  return respond(req, res, {
    json, status: 200, lang, kind: 'success',
    title: t.titleOk, message: t.success,
    backUrl: t.backHome, backLabel: t.backBtn,
    ticket,
  });
}
