// Tech Recycling Berlin — contact form handler (Vercel Node serverless)
// Sends mail via Resend. Set RESEND_API_KEY in the Vercel project env vars.
// Optional env vars:
//   MAIL_TO     — recipient (default: info@techrecycling-berlin.com)
//   MAIL_FROM   — sender    (default: Tech Recycling Berlin <onboarding@resend.dev>)
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
    field_message: 'Bitte beschreiben Sie kurz Ihre Anfrage (mindestens 10 Zeichen).',
    field_consent: 'Bitte stimmen Sie der Datenschutzerklärung zu.',
    subject:  'Neue Anfrage über techrecycling-berlin.com',
    backBtn:  'Zurück',
    titleOk:  'Nachricht gesendet',
    titleErr: 'Fehler',
    backHome: '/',
    backForm: '/kontakt.html',
  },
  en: {
    success: 'Thank you! Your message was sent successfully. We will reply within 24 hours.',
    error:   'An error occurred. Please try again later or give us a call.',
    invalid: 'Please check the highlighted fields.',
    field_name:    'Please enter your name.',
    field_email:   'Please enter a valid email address.',
    field_message: 'Please briefly describe your enquiry (at least 10 characters).',
    field_consent: 'Please agree to the Privacy Policy.',
    subject:  'New enquiry via techrecycling-berlin.com',
    backBtn:  'Back',
    titleOk:  'Message sent',
    titleErr: 'Error',
    backHome: '/en/',
    backForm: '/en/contact.html',
  },
};

function parseForm(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => { raw += chunk; if (raw.length > 1_000_000) req.destroy(); });
    req.on('end', () => {
      try {
        const ct = (req.headers['content-type'] || '').toLowerCase();
        if (ct.includes('application/json')) return resolve(JSON.parse(raw || '{}'));
        const params = new URLSearchParams(raw);
        const obj = {};
        for (const [k, v] of params) obj[k] = v;
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
const TICKET_KEY = 'trb_ticket_seq';
const TICKET_SEED = 37552;

async function getNextTicket() {
  const url   = process.env.KV_REST_API_URL  || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  const fallback = () => 'TRB-' + (10000 + Math.floor(Math.random() * 90000));

  if (!url || !token) return fallback();

  try {
    const r = await fetch(url + '/pipeline', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify([
        ['set',  TICKET_KEY, String(TICKET_SEED), 'nx'],
        ['incr', TICKET_KEY],
      ]),
    });
    if (!r.ok) throw new Error('kv http ' + r.status);
    const data = await r.json();
    const num  = data && data[1] && (data[1].result ?? data[1].response);
    if (typeof num === 'number' && Number.isFinite(num)) return 'TRB-' + num;
    throw new Error('kv unexpected response: ' + JSON.stringify(data));
  } catch (e) {
    console.warn('[sendemail] ticket counter fallback to random:', e.message);
    return fallback();
  }
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c])
  );
}

// ---- Auto-reply (acknowledgement) email ---------------------------------
// Sent to the form submitter. Bilingual DE/EN, design-matched to the site
// (green primary #3A9E1E, lime accent #bdea5c, dark footer #0f1a0d).
// Inline styles only — most email clients strip <style> blocks.
function renderAckHtml({ ticket, name }) {
  const safeName = escapeHtml(name) || 'Kunde / customer';
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
          <p style="margin:0 0 12px"><strong>Sehr geehrte/r ${safeName},</strong></p>
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
          <p style="margin:0 0 12px"><strong>Dear ${safeName},</strong></p>
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

function renderAckText({ ticket, name }) {
  const safeName = (name || 'Kunde / customer').trim();
  return `Tech Recycling Berlin
Ihr Partner für zertifizierte IT-Entsorgung

Ticket-Referenz: ${ticket}

Sehr geehrte/r ${safeName},
vielen Dank für Ihre Nachricht. Wir haben Ihre Anfrage erhalten und melden uns innerhalb von 24 Stunden bei Ihnen.
Bei dringenden Anliegen: info@techrecycling-berlin.com oder +49 155 660 44719.

----------------------------------------

Dear ${safeName},
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
<link rel="stylesheet" href="/assets/css/style.css">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700&family=Inter&display=swap">
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

  // ---- Diagnostic: GET /api/sendemail?debug=envs ----------------------
  // Returns which KV-related env-var names are present (not their values).
  // Lets us figure out which name pattern the Upstash/Vercel-KV integration
  // injected, without leaking secrets.
  if (req.method === 'GET') {
    const url = new URL(req.url, 'http://x');
    if (url.searchParams.get('debug') === 'envs') {
      const names = [
        'KV_REST_API_URL', 'KV_REST_API_TOKEN', 'KV_REST_API_READ_ONLY_TOKEN',
        'KV_URL', 'REDIS_URL',
        'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN',
        'RESEND_API_KEY', 'MAIL_TO', 'MAIL_FROM', 'NOREPLY_FROM',
      ];
      const present = {};
      for (const n of names) present[n] = Boolean(process.env[n]);
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.end(JSON.stringify({ envs: present }, null, 2));
    }
  }

  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Content-Type', json ? 'application/json' : 'text/plain');
    return res.end(json ? JSON.stringify({ ok: false, message: 'Method not allowed' }) : 'Method not allowed');
  }

  let body;
  try { body = await parseForm(req); }
  catch { body = {}; }

  // Language: explicit form field, else referer, else German
  let lang = (body.lang || '').toLowerCase() === 'en' ? 'en' : 'de';
  if (!body.lang) {
    const ref = req.headers.referer || req.headers.referrer || '';
    if (/\/en\//.test(ref) || /\/contact\.html/.test(ref)) lang = 'en';
  }
  const t = MESSAGES[lang];

  const name    = (body.name    || '').trim();
  const email   = (body.email   || '').trim();
  const company = (body.company || '').trim();
  const phone   = (body.phone   || '').trim();
  const service = (body.service || '').trim();
  const message = (body.message || '').trim();
  const consent = !!body.consent;

  // Honeypot — silently treat as success
  if ((body.website || '').trim() !== '') {
    return respond(req, res, {
      json, status: 200, lang, kind: 'success',
      title: t.titleOk, message: t.success,
      backUrl: t.backHome, backLabel: t.backBtn,
    });
  }

  // Field-level validation
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const fieldErrors = {};
  if (name.length < 2)       fieldErrors.name    = t.field_name;
  if (!emailOk)              fieldErrors.email   = t.field_email;
  if (message.length < 10)   fieldErrors.message = t.field_message;
  if (!consent)              fieldErrors.consent = t.field_consent;

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

  const adminText =
`Neue Anfrage / New enquiry — ${ticket}

Name:     ${name}
Firma/Co: ${company}
E-Mail:   ${email}
Telefon:  ${phone}
Leistung: ${service}
Sprache:  ${lang}

Nachricht / Message:
${message}
`;

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
        from,
        to: [to],
        reply_to: email,
        subject: `[${ticket}] ${t.subject}`,
        text: adminText,
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
    const ackHtml = renderAckHtml({ ticket, name });
    const ackText = renderAckText({ ticket, name });
    const ackSubject = `[${ticket}] Ihre Anfrage / Your inquiry — Tech Recycling Berlin`;
    const ackRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        from: noreplyFrom,
        to: [email],
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
