# MOXON Project Structure

This project is a static public website with a Supabase-backed CMS admin.

## Public Pages

- `index.html` - homepage.
- `about.html` - company/about page.
- `products.html` - product catalog page.
- `services.html` - service page.
- `news.html` - news page shell and public renderer target.
- `recruitment.html` - recruitment form page.
- `contact.html` - contact and quotation form page.

Public pages should stay mostly markup and page-specific content. Shared behavior belongs in `assets/js/` or `data/`.

## Public Assets

- `assets/css/styles.css` - main public CSS. This is currently the largest file and should be split later by area.
- `assets/js/components.js` - shared header/footer/navigation rendering.
- `assets/js/public-forms.js` - contact/recruitment validation, Supabase submissions, attachments, and quote pre-fill.
- `assets/js/public-catalog.js` - product filtering, product detail modal, and dynamic catalog updates.
- `assets/js/script.js` - public motion, scroll reveal, counters, homepage auto-scroll, and hero slideshow.
- `assets/optimized/` - optimized public images used by pages and fallback content.
- `assets/logo-transparent.png` - logo asset.

Recommended next public split: move motion code from `assets/js/script.js` into `assets/js/public-motion.js`, then keep `script.js` as a small bootstrap only if a build step is added later.

## Supabase/Data Layer

- `data/supabase-config.js` - Supabase URL, anon key, and bucket names.
- `data/supabase-client.js` - creates the browser Supabase client.
- `data/supabase-runtime.js` - loads public Supabase data and merges it into runtime data.
- `data/public-renderer.js` - renders CMS-backed public sections after data loads.
- `data/site-data.js` - fallback content only. Real CMS operations should be done in Supabase/admin.
- `supabase-cms-schema.sql` - database schema, RLS policies, and Storage policies.

Do not put service-role keys or private secrets in `data/`; these files are public on the website.
The public anon/publishable key is expected in frontend code. Admin write access is controlled by Supabase Auth, so public signup must stay disabled.

## Admin

- `admin/dashboard.html` - admin app shell.
- `admin/login.html` - Supabase Auth login page.
- `admin/admin.css` - admin-only styles.
- `admin/admin.js` - main admin app, UI renderers, form wiring, dashboard, and save flow.
- `admin/js/admin-utils.js` - shared admin helpers.
- `admin/js/admin-storage.js` - admin Storage upload and cleanup helpers.

Recommended next split for `admin/admin.js`:

- `admin/js/admin-supabase.js`
- `admin/js/admin-image.js`
- `admin/js/admin-dashboard.js`
- `admin/js/admin-editors.js`

Split one area at a time and test admin save/upload/delete after each split.

## Deploy/SEO/Security

- `_headers` - Netlify/security headers and noindex for `/admin/*`.
- `robots.txt` - crawler rules, including `Disallow: /admin/`.
- `sitemap.xml` - public sitemap.
- `.netlifyignore` - excludes local/dev files from Netlify deploy.
- `HANDOVER.md` - handover notes for deploy, Supabase, and operations.

## Local/Development Only

- `tools/` - local helper scripts.
- `restore-backups/` - local backups if present.
- `.git/`, `.agents/`, `.codex/` - local tooling/history.

These should not be part of a public static deploy.
