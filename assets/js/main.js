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

  // ---------- Auto-apply stagger to service/process grids ----------
  document.querySelectorAll('.services-grid, .process-grid, .testimonials-grid, .stats-band, .trust-bar__items, .hero__trust').forEach(function (g) {
    if (!g.classList.contains('stagger')) g.classList.add('stagger');
  });

  // ---------- Header scroll effect + scroll progress ----------
  const header = document.querySelector('.site-header');
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
  try {
    const KEY = 'trb_cookie_consent_v1';
    const banner = document.getElementById('cookie-banner');
    if (banner && !localStorage.getItem(KEY)) {
      setTimeout(function () { banner.classList.add('is-visible'); }, 1200);
      banner.querySelectorAll('[data-consent]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          localStorage.setItem(KEY, btn.getAttribute('data-consent'));
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
})();
