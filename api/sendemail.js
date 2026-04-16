// Tech Recycling Berlin — contact form handler (Vercel Node serverless)
// Sends mail via Resend. Set RESEND_API_KEY in the Vercel project env vars.
// Optional env vars:
//   MAIL_TO     — recipient (default: info@techrecycling-berlin.com)
//   MAIL_FROM   — sender    (default: Tech Recycling Berlin <onboarding@resend.dev>)

export const config = { runtime: 'nodejs' };

const MESSAGES = {
  de: {
    success: 'Vielen Dank! Ihre Nachricht wurde erfolgreich gesendet. Wir melden uns innerhalb von 24 Stunden.',
    error:   'Beim Senden ist ein Fehler aufgetreten. Bitte versuchen Sie es später erneut oder rufen Sie uns an.',
    invalid: 'Bitte füllen Sie alle Pflichtfelder korrekt aus.',
    consent: 'Bitte stimmen Sie der Datenschutzerklärung zu.',
    subject: 'Neue Anfrage über techrecycling-berlin.com',
    backBtn: 'Zurück',
    titleOk: 'Nachricht gesendet',
    titleErr: 'Fehler',
    backHome: '/',
    backForm: '/kontakt.html',
  },
  en: {
    success: 'Thank you! Your message was sent successfully. We will reply within 24 hours.',
    error:   'An error occurred. Please try again later or give us a call.',
    invalid: 'Please fill in all required fields correctly.',
    consent: 'Please agree to the Privacy Policy.',
    subject: 'New enquiry via techrecycling-berlin.com',
    backBtn: 'Back',
    titleOk: 'Message sent',
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

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c])
  );
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

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');

  if (req.method !== 'POST') {
    res.statusCode = 405;
    return res.end('Method not allowed');
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

  // Honeypot
  if ((body.website || '').trim() !== '') {
    res.statusCode = 200;
    return res.end(renderPage({
      lang, kind: 'success', title: t.titleOk, message: t.success,
      backUrl: t.backHome, backLabel: t.backBtn,
    }));
  }

  // Validation
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const errors = [];
  if (name.length < 2) errors.push(t.invalid);
  if (!emailOk)        errors.push(t.invalid);
  if (message.length < 10) errors.push(t.invalid);
  if (!consent)        errors.push(t.consent);

  if (errors.length) {
    res.statusCode = 400;
    return res.end(renderPage({
      lang, kind: 'error', title: t.titleErr,
      message: [...new Set(errors)].join(' '),
      backUrl: t.backForm, backLabel: t.backBtn,
    }));
  }

  const to   = process.env.MAIL_TO   || 'info@techrecycling-berlin.com';
  const from = process.env.MAIL_FROM || 'Tech Recycling Berlin <onboarding@resend.dev>';
  const apiKey = process.env.RESEND_API_KEY;

  const textBody =
`Neue Anfrage / New enquiry

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
    res.statusCode = 500;
    return res.end(renderPage({
      lang, kind: 'error', title: t.titleErr, message: t.error,
      backUrl: t.backForm, backLabel: t.backBtn,
    }));
  }

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
        subject: t.subject,
        text: textBody,
      }),
    });
    if (!r.ok) {
      const detail = await r.text().catch(() => '');
      console.error('[sendemail] Resend error', r.status, detail);
      res.statusCode = 502;
      return res.end(renderPage({
        lang, kind: 'error', title: t.titleErr, message: t.error,
        backUrl: t.backForm, backLabel: t.backBtn,
      }));
    }
  } catch (e) {
    console.error('[sendemail] fetch failed', e);
    res.statusCode = 502;
    return res.end(renderPage({
      lang, kind: 'error', title: t.titleErr, message: t.error,
      backUrl: t.backForm, backLabel: t.backBtn,
    }));
  }

  res.statusCode = 200;
  return res.end(renderPage({
    lang, kind: 'success', title: t.titleOk, message: t.success,
    backUrl: t.backHome, backLabel: t.backBtn,
  }));
}
