// Tech Recycling Berlin — UI scripts v2
(function () {
  'use strict';

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- Mobile menu ----------
  const toggle = document.querySelector('.menu-toggle');
  const mobileNav = document.querySelector('.mobile-nav');
  if (toggle && mobileNav) {
    toggle.addEventListener('click', function () {
      const open = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!open));
      mobileNav.classList.toggle('is-open', !open);
      document.body.style.overflow = !open ? 'hidden' : '';
    });
    mobileNav.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () {
        toggle.setAttribute('aria-expanded', 'false');
        mobileNav.classList.remove('is-open');
        document.body.style.overflow = '';
      });
    });
  }

  // ---------- Auto-apply stagger to service/process grids (must run before observer) ----------
  document.querySelectorAll('.services-grid, .process-grid, .testimonials-grid, .stats-band, .trust-bar__items, .hero__trust').forEach(function (g) {
    if (!g.classList.contains('stagger')) g.classList.add('stagger');
  });

  // ---------- Reveal on scroll (with stagger) ----------
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add('is-visible');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -60px 0px' });
    document.querySelectorAll('.reveal, .stagger').forEach(function (el) { io.observe(el); });
  } else {
    document.querySelectorAll('.reveal, .stagger').forEach(function (el) { el.classList.add('is-visible'); });
  }

  // ---------- Safety fallback: if a .stagger is already in view on load, reveal it ----------
  requestAnimationFrame(function () {
    document.querySelectorAll('.stagger:not(.is-visible)').forEach(function (el) {
      const r = el.getBoundingClientRect();
      if (r.top < window.innerHeight && r.bottom > 0) el.classList.add('is-visible');
    });
  });

  // ---------- Header scroll effect + scroll progress ----------
  const header = document.querySelector('.site-header');
  function syncHeaderHeight() {
    if (!header) return;
    const h = header.offsetHeight;
    if (h) document.documentElement.style.setProperty('--header-h', h + 'px');
  }
  syncHeaderHeight();
  window.addEventListener('resize', syncHeaderHeight);
  window.addEventListener('load', syncHeaderHeight);
  const progressBar = document.createElement('div');
  progressBar.className = 'scroll-progress';
  document.body.appendChild(progressBar);

  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      const y = window.scrollY;
      if (header) header.classList.toggle('is-scrolled', y > 12);
      const h = document.documentElement.scrollHeight - window.innerHeight;
      const pct = h > 0 ? Math.min(100, (y / h) * 100) : 0;
      progressBar.style.setProperty('--sp', pct + '%');
      if (toTop) toTop.classList.toggle('is-visible', y > 600);
      ticking = false;
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });

  // ---------- Back-to-top ----------
  const toTop = document.createElement('button');
  toTop.className = 'to-top';
  toTop.setAttribute('aria-label', 'Nach oben');
  toTop.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5m-7 7 7-7 7 7"/></svg>';
  document.body.appendChild(toTop);
  toTop.addEventListener('click', function () {
    window.scrollTo({ top: 0, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
  });

  // ---------- Counter animation for stats ----------
  function animateCounter(el) {
    const raw = (el.textContent || '').trim();
    const match = raw.match(/^(\d+(?:[.,]\d+)?)(.*)$/);
    if (!match) return;
    const target = parseFloat(match[1].replace(',', '.'));
    const suffix = match[2] || '';
    const decimals = (match[1].split(/[.,]/)[1] || '').length;
    const duration = 1400;
    const start = performance.now();
    function tick(now) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const val = target * eased;
      el.textContent = val.toFixed(decimals).replace('.', decimals ? ',' : '') + suffix;
      if (t < 1) requestAnimationFrame(tick);
      else el.textContent = raw;
    }
    requestAnimationFrame(tick);
  }

  if ('IntersectionObserver' in window && !prefersReducedMotion) {
    const counterIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          animateCounter(e.target);
          counterIO.unobserve(e.target);
        }
      });
    }, { threshold: 0.4 });
    document.querySelectorAll('.stat-big strong, .hero__stat strong, .feature-card .bignum').forEach(function (el) {
      counterIO.observe(el);
    });
  }

  // ---------- Service-card 3D tilt & spotlight ----------
  if (!prefersReducedMotion && window.matchMedia('(pointer: fine)').matches) {
    document.querySelectorAll('.service-card').forEach(function (card) {
      card.addEventListener('mousemove', function (e) {
        const r = card.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width;
        const y = (e.clientY - r.top) / r.height;
        const rotY = (x - 0.5) * 6;
        const rotX = (0.5 - y) * 6;
        card.style.transform = 'translateY(-6px) perspective(900px) rotateX(' + rotX.toFixed(2) + 'deg) rotateY(' + rotY.toFixed(2) + 'deg)';
      });
      card.addEventListener('mouseleave', function () { card.style.transform = ''; });
    });

    // Hero visual parallax follows mouse within the visual
    const heroVisual = document.querySelector('.hero__visual');
    if (heroVisual) {
      heroVisual.addEventListener('mousemove', function (e) {
        const r = heroVisual.getBoundingClientRect();
        const mx = ((e.clientX - r.left) / r.width) * 100;
        const my = ((e.clientY - r.top) / r.height) * 100;
        heroVisual.style.setProperty('--mx', mx + '%');
        heroVisual.style.setProperty('--my', my + '%');
      });
    }

    // Sub-page hero 3D parallax — .page-hero__visual with .hero-float layers
    document.querySelectorAll('.page-hero__visual').forEach(function (visual) {
      visual.addEventListener('mousemove', function (e) {
        const r = visual.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const dx = (e.clientX - cx) / r.width;
        const dy = (e.clientY - cy) / r.height;
        visual.style.setProperty('--lx', (dx * -12).toFixed(1) + 'px');
        visual.style.setProperty('--ly', (dy * -12).toFixed(1) + 'px');
      });
      visual.addEventListener('mouseleave', function () {
        visual.style.setProperty('--lx', '0px');
        visual.style.setProperty('--ly', '0px');
      });
    });
  }

  // ---------- Smooth anchor scroll ----------
  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    const href = a.getAttribute('href');
    if (!href || href === '#' || href.length < 2) return;
    a.addEventListener('click', function (e) {
      const target = document.querySelector(href);
      if (!target) return;
      e.preventDefault();
      const offset = (header ? header.offsetHeight : 0) + 10;
      const top = target.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top: top, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
      history.pushState(null, '', href);
    });
  });

  // ---------- Cross-page transition (where View Transitions API isn't available) ----------
  const supportsVT = 'startViewTransition' in document;
  if (!supportsVT && !prefersReducedMotion) {
    const overlay = document.createElement('div');
    overlay.className = 'page-transition';
    document.body.appendChild(overlay);
    requestAnimationFrame(function () {
      overlay.classList.add('is-enter');
      setTimeout(function () { overlay.classList.remove('is-enter'); overlay.style.transform = 'translateY(-100%)'; }, 700);
    });
    document.addEventListener('click', function (e) {
      const a = e.target && e.target.closest && e.target.closest('a');
      if (!a) return;
      const href = a.getAttribute('href');
      if (!href) return;
      const url = new URL(href, window.location.href);
      const sameOrigin = url.origin === window.location.origin;
      const isHash = url.pathname === window.location.pathname && url.hash;
      const isDownload = a.hasAttribute('download');
      const isExternal = a.target === '_blank';
      const isSpecial = /^(mailto:|tel:|javascript:)/i.test(href);
      if (!sameOrigin || isHash || isDownload || isExternal || isSpecial) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      overlay.style.transform = '';
      overlay.classList.add('is-exit');
      setTimeout(function () { window.location.href = url.href; }, 380);
    });
  }

  // ---------- Cookie banner ----------
  // Notifies Google Consent Mode (gtag, declared in <head>) when the visitor
  // makes a choice. "all" → grant analytics + ads storage; "essential" stays
  // denied (the default set in the gtag snippet).
  function updateGtagConsent(choice) {
    if (typeof window.gtag !== 'function') return;
    if (choice === 'all') {
      window.gtag('consent', 'update', {
        'ad_storage': 'granted',
        'ad_user_data': 'granted',
        'ad_personalization': 'granted',
        'analytics_storage': 'granted'
      });
    } else {
      window.gtag('consent', 'update', {
        'ad_storage': 'denied',
        'ad_user_data': 'denied',
        'ad_personalization': 'denied',
        'analytics_storage': 'denied'
      });
    }
  }
  try {
    const KEY = 'trb_cookie_consent_v1';
    const banner = document.getElementById('cookie-banner');
    if (banner && !localStorage.getItem(KEY)) {
      setTimeout(function () { banner.classList.add('is-visible'); }, 1200);
      banner.querySelectorAll('[data-consent]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          const choice = btn.getAttribute('data-consent');
          localStorage.setItem(KEY, choice);
          updateGtagConsent(choice);
          banner.classList.remove('is-visible');
        });
      });
    }
  } catch (err) { /* storage may be blocked */ }

  // ---------- Contact form validation ----------
  const form = document.querySelector('form[data-contact]');
  if (form) {
    form.addEventListener('submit', function (e) {
      const required = form.querySelectorAll('[required]');
      let ok = true;
      required.forEach(function (el) {
        const valid = el.type === 'checkbox' ? el.checked : el.value.trim().length > 0;
        if (!valid) {
          el.style.borderColor = '#dc3545';
          el.style.boxShadow = '0 0 0 3px rgba(220,53,69,.15)';
          ok = false;
        } else {
          el.style.borderColor = '';
          el.style.boxShadow = '';
        }
      });
      if (!ok) {
        e.preventDefault();
        const first = form.querySelector('[style*="dc3545"]');
        if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
  }

  // ---------- Year injection (fallback) ----------
  const yearEls = document.querySelectorAll('#year, [data-year]');
  yearEls.forEach(function (el) { el.textContent = new Date().getFullYear(); });

  // ---------- Hero headline word-reveal ----------
  if (!prefersReducedMotion) {
    document.querySelectorAll('.hero h1, .hero .eyebrow').forEach(function (el) {
      if (el.dataset.split === '1') return;
      el.dataset.split = '1';
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
      const texts = [];
      let n; while ((n = walker.nextNode())) texts.push(n);
      let idx = 0;
      texts.forEach(function (node) {
        const parts = node.nodeValue.split(/(\s+)/);
        const frag = document.createDocumentFragment();
        parts.forEach(function (p) {
          if (/^\s+$/.test(p) || p === '') { frag.appendChild(document.createTextNode(p)); return; }
          const span = document.createElement('span');
          span.className = 'w';
          span.style.setProperty('--i', idx++);
          span.textContent = p;
          frag.appendChild(span);
        });
        node.parentNode.replaceChild(frag, node);
      });
    });
  }

  // ---------- Magnetic primary CTAs ----------
  if (!prefersReducedMotion && window.matchMedia('(pointer: fine)').matches) {
    document.querySelectorAll('.btn--primary').forEach(function (btn) {
      const strength = 12; // px max pull
      btn.addEventListener('mouseenter', function () { btn.classList.add('is-magnetic'); });
      btn.addEventListener('mousemove', function (e) {
        const r = btn.getBoundingClientRect();
        const dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
        const dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
        btn.style.transform = 'translate(' + (dx * strength).toFixed(1) + 'px,' + (dy * strength - 2).toFixed(1) + 'px)';
      });
      btn.addEventListener('mouseleave', function () {
        btn.classList.remove('is-magnetic');
        btn.style.transform = '';
      });
    });
  }

  // ---------- Process-grid reveal trigger (line-draw) ----------
  if ('IntersectionObserver' in window) {
    const pgIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('is-visible'); pgIO.unobserve(e.target); }
      });
    }, { threshold: 0.25 });
    document.querySelectorAll('.process-grid, .industries-strip').forEach(function (g) { pgIO.observe(g); });
  }

  // ---------- Hero cursor-following spotlight ----------
  const hero = document.querySelector('.hero');
  if (hero && !prefersReducedMotion && window.matchMedia('(pointer: fine)').matches) {
    const spotlight = document.createElement('div');
    spotlight.className = 'hero__spotlight';
    hero.prepend(spotlight);
    let spotTick = false;
    hero.addEventListener('mousemove', function (e) {
      if (spotTick) return;
      spotTick = true;
      requestAnimationFrame(function () {
        const r = hero.getBoundingClientRect();
        const x = ((e.clientX - r.left) / r.width) * 100;
        const y = ((e.clientY - r.top) / r.height) * 100;
        hero.style.setProperty('--hx', x + '%');
        hero.style.setProperty('--hy', y + '%');
        spotTick = false;
      });
    });
  }

  // ---------- Service-card shine sweep ----------
  document.querySelectorAll('.service-card').forEach(function (card) {
    if (card.querySelector('.shine')) return;
    const shine = document.createElement('span');
    shine.className = 'shine';
    card.appendChild(shine);
  });

  // ---------- Scroll-linked parallax on hero visual ----------
  const heroVisualEl = document.querySelector('.hero__visual');
  if (heroVisualEl && !prefersReducedMotion) {
    let pTicking = false;
    function onHeroParallax() {
      if (pTicking) return;
      pTicking = true;
      requestAnimationFrame(function () {
        const r = heroVisualEl.getBoundingClientRect();
        const vh = window.innerHeight;
        if (r.bottom < 0 || r.top > vh) { pTicking = false; return; }
        const centerOffset = (r.top + r.height / 2 - vh / 2) / vh; // ~-0.5..0.5
        const ty = Math.max(-18, Math.min(18, centerOffset * -24));
        heroVisualEl.style.setProperty('--parallax-y', ty.toFixed(1) + 'px');
        heroVisualEl.style.transform = 'translateY(' + ty.toFixed(1) + 'px)';
        pTicking = false;
      });
    }
    // Wait for the initial hero-fade-up animation to finish (~1.3s) before
    // taking over the transform, so we don't clash with the entrance animation.
    setTimeout(function () {
      onHeroParallax();
      window.addEventListener('scroll', onHeroParallax, { passive: true });
      window.addEventListener('resize', onHeroParallax);
    }, 1400);
  }

  // ---------- Button ripple on click ----------
  if (!prefersReducedMotion) {
    document.addEventListener('click', function (e) {
      const btn = e.target && e.target.closest && e.target.closest('.btn');
      if (!btn) return;
      const r = btn.getBoundingClientRect();
      const size = Math.max(r.width, r.height);
      const x = e.clientX - r.left - size / 2;
      const y = e.clientY - r.top - size / 2;
      const ripple = document.createElement('span');
      ripple.className = 'ripple';
      ripple.style.width = ripple.style.height = size + 'px';
      ripple.style.left = x + 'px';
      ripple.style.top = y + 'px';
      btn.appendChild(ripple);
      setTimeout(function () { ripple.remove(); }, 750);
    });
  }

  // ---------- Counter flash when finished ----------
  (function patchCounterFlash() {
    // wrap animateCounter to add .is-flashed on completion
    const els = document.querySelectorAll('.stat-big strong, .hero__stat strong');
    if (!els.length || prefersReducedMotion) return;
    const flashIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        const el = e.target;
        flashIO.unobserve(el);
        // existing counter runs ~1400ms; trigger flash near the end
        setTimeout(function () {
          el.classList.add('is-flashed');
          setTimeout(function () { el.classList.remove('is-flashed'); }, 950);
        }, 1200);
      });
    }, { threshold: 0.5 });
    els.forEach(function (el) { flashIO.observe(el); });
  })();

  // ---------- Feature card ring: trigger when visible ----------
  const featureCard = document.querySelector('.feature-card');
  if (featureCard && 'IntersectionObserver' in window) {
    const fcIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('is-visible'); fcIO.unobserve(e.target); }
      });
    }, { threshold: 0.35 });
    fcIO.observe(featureCard);
  }

  // ---------- Value Calculator ----------
  const calc = document.querySelector('[data-calc]');
  if (calc) {
    const valueEl = calc.querySelector('[data-calc-value]');
    const breakdownEl = calc.querySelector('[data-calc-breakdown]');
    const inputs = calc.querySelectorAll('input[type="range"]');
    const formatter = new Intl.NumberFormat('de-DE');

    function easeDisplay(from, to, el) {
      if (prefersReducedMotion) { el.textContent = formatter.format(Math.round(to)); return; }
      const duration = 380;
      const start = performance.now();
      function step(now) {
        const t = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - t, 3);
        el.textContent = formatter.format(Math.round(from + (to - from) * eased));
        if (t < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    }

    let lastValue = 0;
    function update(triggered) {
      let total = 0;
      const parts = [];
      inputs.forEach(function (input) {
        const count = parseInt(input.value, 10) || 0;
        const price = parseFloat(input.getAttribute('data-price')) || 0;
        const label = input.getAttribute('data-label') || '';
        const fill = ((count - input.min) / (input.max - input.min)) * 100;
        input.style.setProperty('--fill', fill + '%');
        const out = document.querySelector('output[for="' + input.id + '"]');
        if (out) out.textContent = count;
        if (count > 0) {
          const sub = count * price;
          total += sub;
          parts.push({ label: label, count: count, sub: sub });
        }
      });

      easeDisplay(lastValue, total, valueEl);
      lastValue = total;

      if (triggered && !prefersReducedMotion) {
        valueEl.classList.remove('is-bump');
        // force reflow to restart animation
        void valueEl.offsetWidth;
        valueEl.classList.add('is-bump');
      }

      // Rebuild breakdown
      breakdownEl.innerHTML = '';
      if (!parts.length) {
        const li = document.createElement('li');
        li.className = 'calc__empty';
        li.textContent = 'Geräte auswählen, um Angebot zu berechnen.';
        breakdownEl.appendChild(li);
      } else {
        parts.forEach(function (p) {
          const li = document.createElement('li');
          li.innerHTML = '<span>' + p.count + ' × ' + p.label + '</span><strong>€ ' + formatter.format(p.sub) + '</strong>';
          breakdownEl.appendChild(li);
        });
      }
    }

    inputs.forEach(function (input) {
      input.addEventListener('input', function () { update(true); });
    });
    update(false);
  }

  // ---------- Sticky quote tab visibility ----------
  const quoteTab = document.querySelector('.quote-tab');
  if (quoteTab) {
    let qtTicking = false;
    function toggleQuoteTab() {
      if (qtTicking) return;
      qtTicking = true;
      requestAnimationFrame(function () {
        const y = window.scrollY;
        const past = y > window.innerHeight * 0.6;
        const footer = document.querySelector('.site-footer');
        let nearFooter = false;
        if (footer) {
          const rect = footer.getBoundingClientRect();
          nearFooter = rect.top < window.innerHeight - 80;
        }
        quoteTab.classList.toggle('is-visible', past && !nearFooter);
        qtTicking = false;
      });
    }
    window.addEventListener('scroll', toggleQuoteTab, { passive: true });
    window.addEventListener('resize', toggleQuoteTab);
    toggleQuoteTab();
  }
})();

/* =====================================================================
   Contact form — client-side validation + AJAX submit (no page reload)
   Falls back to native form POST if JS is disabled.
===================================================================== */
(function () {
  const STRINGS = {
    de: {
      sending: 'Wird gesendet…',
      successTitle: 'Vielen Dank!',
      successBody:  'Ihre Nachricht ist bei uns angekommen. Wir melden uns innerhalb von 24 Stunden.',
      validationTitle: 'Bitte prüfen Sie Ihre Eingaben',
      sendFailTitle:   'Senden fehlgeschlagen',
      sendFailBody:    'Wir konnten Ihre Nachricht gerade nicht zustellen. Bitte versuchen Sie es in ein paar Minuten erneut oder rufen Sie uns direkt an: +49 155 66044719.',
      errorNetwork: 'Verbindung fehlgeschlagen. Bitte versuchen Sie es erneut oder rufen Sie uns an: +49 155 66044719.',
      field_name:    'Bitte geben Sie Ihren Namen ein.',
      field_email:   'Bitte geben Sie eine gültige E-Mail-Adresse ein.',
      field_message: 'Bitte beschreiben Sie kurz Ihre Anfrage (mindestens 10 Zeichen).',
      field_consent: 'Bitte stimmen Sie der Datenschutzerklärung zu.',
    },
    en: {
      sending: 'Sending…',
      successTitle: 'Thank you!',
      successBody:  'Your message is on its way. We will reply within 24 hours.',
      validationTitle: 'Please check your entries',
      sendFailTitle:   "Couldn't send right now",
      sendFailBody:    "We couldn't deliver your message just now. Please try again in a few minutes or call us directly: +49 155 66044719.",
      errorNetwork: 'Connection failed. Please try again or call us: +49 155 66044719.',
      field_name:    'Please enter your name.',
      field_email:   'Please enter a valid email address.',
      field_message: 'Please briefly describe your enquiry (at least 10 characters).',
      field_consent: 'Please agree to the Privacy Policy.',
    }
  };

  const ICONS = {
    success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg>',
    error:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12M18 6L6 18"/></svg>'
  };

  function getLang(form) {
    const explicit = form.querySelector('input[name="lang"]');
    if (explicit && (explicit.value === 'en' || explicit.value === 'de')) return explicit.value;
    return document.documentElement.lang === 'en' ? 'en' : 'de';
  }

  function ensureFieldErrorEl(group) {
    let err = group.querySelector('.field-error');
    if (!err) {
      err = document.createElement('div');
      err.className = 'field-error';
      group.appendChild(err);
    }
    return err;
  }

  function showFieldError(form, fieldName, message) {
    const input = form.querySelector('[name="' + fieldName + '"]');
    if (!input) return;
    const group = input.closest('.form-group') || input.closest('.form-consent');
    if (!group) return;
    group.classList.add('has-error');
    const err = ensureFieldErrorEl(group);
    err.textContent = message;
    input.setAttribute('aria-invalid', 'true');
  }

  function clearErrors(form) {
    form.querySelectorAll('.has-error').forEach(function (g) { g.classList.remove('has-error'); });
    form.querySelectorAll('[aria-invalid="true"]').forEach(function (el) { el.removeAttribute('aria-invalid'); });
  }

  function setStatus(form, kind, title, body) {
    let box = form.querySelector('.form-status');
    if (!box) {
      box = document.createElement('div');
      box.className = 'form-status';
      box.setAttribute('role', 'status');
      box.setAttribute('aria-live', 'polite');
      form.insertBefore(box, form.firstChild);
    }
    box.className = 'form-status is-visible form-status--' + kind;
    box.innerHTML =
      '<span class="form-status__icon">' + ICONS[kind === 'success' ? 'success' : 'error'] + '</span>' +
      '<p>' + (title ? '<strong>' + title + '</strong>' : '') + (body || '') + '</p>';
  }

  function clearStatus(form) {
    const box = form.querySelector('.form-status');
    if (box) box.classList.remove('is-visible');
  }

  function clientValidate(form, t) {
    const errors = {};
    const get = function (n) { const el = form.querySelector('[name="' + n + '"]'); return el ? (el.value || '').trim() : ''; };
    if (get('name').length < 2) errors.name = t.field_name;
    const email = get('email');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = t.field_email;
    if (get('message').length < 10) errors.message = t.field_message;
    const consentEl = form.querySelector('[name="consent"]');
    if (consentEl && !consentEl.checked) errors.consent = t.field_consent;
    return errors;
  }

  document.querySelectorAll('form[data-contact]').forEach(function (form) {
    // Clear field errors as user types/changes
    form.addEventListener('input', function (e) {
      const t = e.target;
      if (!t.name) return;
      const group = t.closest('.form-group') || t.closest('.form-consent');
      if (group && group.classList.contains('has-error')) {
        group.classList.remove('has-error');
        t.removeAttribute('aria-invalid');
      }
    });
    form.addEventListener('change', function (e) {
      if (e.target && e.target.name === 'consent') {
        const group = e.target.closest('.form-consent');
        if (group && group.classList.contains('has-error')) group.classList.remove('has-error');
      }
    });

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      const lang = getLang(form);
      const t = STRINGS[lang];
      clearErrors(form);
      clearStatus(form);

      const errors = clientValidate(form, t);
      if (Object.keys(errors).length) {
        Object.keys(errors).forEach(function (k) { showFieldError(form, k, errors[k]); });
        setStatus(form, 'error', t.validationTitle, '');
        const firstErr = form.querySelector('.has-error [name]');
        if (firstErr && typeof firstErr.focus === 'function') firstErr.focus();
        return;
      }

      // Build payload (FormData -> plain object). Skip empty consent if unchecked.
      const data = {};
      const fd = new FormData(form);
      fd.forEach(function (v, k) { data[k] = typeof v === 'string' ? v : ''; });
      if (form.querySelector('[name="consent"]')) {
        data.consent = !!form.querySelector('[name="consent"]').checked;
      }

      // Cloudflare Turnstile — only block if widget is present on the page.
      // The widget injects a hidden input named "cf-turnstile-response"; the
      // token lives there once the visitor has been verified.
      const turnstileEl = form.querySelector('.cf-turnstile');
      if (turnstileEl) {
        const tokenInput = form.querySelector('[name="cf-turnstile-response"]');
        const token = tokenInput && tokenInput.value;
        if (!token) {
          setStatus(form, 'error', t.validationTitle, lang === 'en'
            ? 'Please complete the verification challenge above.'
            : 'Bitte schließen Sie die Sicherheitsprüfung oben ab.');
          if (turnstileEl.scrollIntoView) turnstileEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return;
        }
        data['cf-turnstile-response'] = token;
      }

      const submitBtn = form.querySelector('button[type="submit"]');
      const originalLabel = submitBtn ? submitBtn.innerHTML : '';
      if (submitBtn) {
        submitBtn.classList.add('is-loading');
        submitBtn.disabled = true;
      }

      try {
        const res = await fetch(form.getAttribute('action') || '/api/sendemail', {
          method: 'POST',
          headers: {
            'Content-Type':     'application/json',
            'Accept':           'application/json',
            'X-Requested-With': 'fetch'
          },
          body: JSON.stringify(data)
        });

        let payload = null;
        try { payload = await res.json(); } catch { payload = null; }

        if (res.ok && payload && payload.ok) {
          var ref = payload.ticket
            ? ' <span style="display:inline-block;margin-top:.35rem;font-size:.82rem;color:#1f5a30;font-family:SFMono-Regular,Consolas,Menlo,monospace">' + payload.ticket + '</span>'
            : '';
          setStatus(form, 'success', t.successTitle, t.successBody + ref);
          form.reset();
          if (window.turnstile && typeof window.turnstile.reset === 'function') window.turnstile.reset();
          const status = form.querySelector('.form-status');
          if (status && status.scrollIntoView) status.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else if (payload && payload.fieldErrors) {
          Object.keys(payload.fieldErrors).forEach(function (k) {
            showFieldError(form, k, payload.fieldErrors[k]);
          });
          setStatus(form, 'error', t.validationTitle, payload.message || '');
          if (window.turnstile && typeof window.turnstile.reset === 'function') window.turnstile.reset();
          const firstErr = form.querySelector('.has-error [name]');
          if (firstErr && typeof firstErr.focus === 'function') firstErr.focus();
        } else {
          // Server-side / delivery failure (5xx, no field errors)
          setStatus(form, 'error', t.sendFailTitle, t.sendFailBody);
          if (window.turnstile && typeof window.turnstile.reset === 'function') window.turnstile.reset();
        }
      } catch (err) {
        setStatus(form, 'error', t.sendFailTitle, t.errorNetwork);
        if (window.turnstile && typeof window.turnstile.reset === 'function') window.turnstile.reset();
      } finally {
        if (submitBtn) {
          submitBtn.classList.remove('is-loading');
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalLabel;
        }
      }
    });
  });
})();
