# Tech Recycling Berlin — New Website

A clean, modern, fully responsive bilingual (DE/EN) website for Tech Recycling Berlin.
Built as static HTML + CSS + JS (no build step required), with PHP for contact form.

## Structure

```
/
├── index.html                        # German homepage
├── ueber-uns.html                    # About (DE)
├── faq.html                          # FAQ (DE)
├── kontakt.html                      # Contact (DE)
├── sichere-datenloeschung.html       # Service: Data erasure
├── it-ankauf.html                    # Service: IT buyback
├── it-recycling.html                 # Service: IT recycling
├── festplattenvernichtung.html       # Service: HDD destruction
├── server-entsorgung.html            # Service: Server disposal
├── datenrettung.html                 # Service: Data recovery
├── impressum.html                    # Legal: Imprint
├── datenschutz.html                  # Legal: Privacy
├── agb.html                          # Legal: Terms
│
├── en/                               # English mirror
│   ├── index.html
│   ├── about.html
│   ├── faq.html
│   ├── contact.html
│   ├── secure-data-erasure.html
│   ├── it-buyback.html
│   ├── it-recycling.html
│   ├── hard-drive-destruction.html
│   ├── server-disposal.html
│   ├── data-recovery.html
│   ├── imprint.html
│   ├── privacy.html
│   └── terms.html
│
├── assets/
│   ├── css/style.css                 # All styles
│   ├── js/main.js                    # Mobile nav, scroll reveals, cookie banner
│   └── images/
│       ├── logo.png                  # Full-colour logo
│       ├── logo-white.png            # White logo for dark backgrounds
│       └── favicon.ico
│
├── sendemail.php                     # Contact-form handler (requires PHPMailer)
├── sitemap.xml                       # XML sitemap with hreflang
└── robots.txt                        # Search-engine directives
```

## Design system

- **Colors**: Brand green `#3A9E1E`, ink black `#0f1a0d`, soft backgrounds, yellow accent
- **Typography**: Manrope (display) + Inter (body) from Google Fonts
- **Layout**: CSS Grid + Flexbox, container max-width 1200 px, fluid type with `clamp()`
- **Responsive**: Mobile-first, breakpoints at 600/800/900/960 px
- **Components**: Sticky blurred header, dropdown nav, hero with custom SVG,
  service cards with gradient-border hover, process steps, testimonials,
  FAQ accordion (native `<details>`), dark CTA sections, cookie banner

## SEO features

- Per-page unique `<title>` and meta descriptions, optimised for German keywords
  (IT Entsorgung Berlin, DSGVO Datenlöschung, etc.) and English equivalents
- `<link rel="canonical">` on every page
- Full `hreflang` alternates (de / en / x-default) on every bilingual page
- Open Graph + Twitter Card metadata
- JSON-LD structured data:
  - `LocalBusiness` / `ProfessionalService` on homepages with address, hours,
    geo-coordinates, ratings, social profiles, offer catalog
  - `FAQPage` on homepages and FAQ pages
  - `BreadcrumbList` on homepage
- XML sitemap with hreflang alternates
- Robots.txt pointing to sitemap
- Semantic HTML5 (`<header>`, `<nav>`, `<main>`-equivalent, `<article>`, `<section>`, `<footer>`)
- Accessible: ARIA labels, landmark roles, keyboard-friendly forms

## Local preview

All asset paths are **relative**, so you can preview the site by simply
double-clicking any `.html` file — no local web server needed. The site
works identically whether opened from disk or served from a web server.

## Deployment

### Static hosting (recommended)

For a purely static deployment (no PHP), just upload all files to your web server.
The contact form will need a replacement (e.g. Formspree, Getform, or a serverless function).

1. Upload all files and folders to your web root
2. Ensure HTTPS is enabled (the CSP and SSL references assume it)
3. If using Apache: nothing else needed — files serve as-is
4. If using Nginx: ensure `index.html` is in the `index` directive

### With PHP (for contact form)

1. Upload all files including `sendemail.php`
2. Copy PHPMailer to `/vendor/` (you already have this from your previous site
   — `composer require phpmailer/phpmailer`)
3. Edit `sendemail.php` to configure SMTP credentials for reliable delivery
   (use an SMTP server like SendGrid, Mailgun, or your hosting provider's SMTP)
4. Make sure `php mail()` is enabled, or SMTP is configured

### Search engine submission

1. Verify site ownership in Google Search Console
2. Submit `https://techrecycling-berlin.com/sitemap.xml`
3. Do the same in Bing Webmaster Tools
4. Check that structured data validates at
   https://search.google.com/test/rich-results

## Customisation

### Changing colours

Edit CSS variables at the top of `assets/css/style.css`:

```css
:root {
  --green: #3A9E1E;
  --green-dark: #2d7d16;
  --green-light: #e8f5e1;
  /* … */
}
```

### Adding a page

1. Copy an existing page (e.g. `ueber-uns.html`)
2. Update `<title>`, meta description, canonical, hreflang links
3. Change the `active` state in the navigation
4. Add the URL to `sitemap.xml`

## Browser support

Modern evergreen browsers: Chrome, Edge, Firefox, Safari (last 2 versions).
Graceful degradation for older browsers (IntersectionObserver scroll reveals
fall back to visible content).

## Performance

- No build step, no framework overhead
- Only ~25 kB of CSS, ~3 kB of JS (minified would be ~18 kB / ~2 kB)
- Lazy reveal via IntersectionObserver
- Fonts loaded with `preconnect` + `display=swap`
- Images: logo PNGs, custom SVG for hero (scalable, no binary images in hero)

---

**Contact**: info@techrecycling-berlin.com · +49 155 66044719
