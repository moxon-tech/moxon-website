# MOXON Website Handover Notes

## Production deploy

Deploy the public website with these paths:

- `admin/`
- `assets/css/`
- `assets/js/`
- `assets/optimized/`
- `assets/logo-transparent.png`
- `data/`
- `*.html`
- `robots.txt`
- `sitemap.xml`

## Keep out of public deploy

These are local development or technical handover materials:

- `restore-backups/`
- `tools/`
- `.agents/`
- `.git/`
- `supabase-cms-schema.sql`
- `assets/Saved Pictures/`
- unoptimized source images such as `assets/product-*.png`, `assets/project-*.png`, `assets/service-*.png`, `assets/moxon-banner.png`

`.netlifyignore` already excludes these local-only files from Netlify deploys.

## Data source

Public product/category content should come from Supabase:

- `product_categories`
- `products`
- `cms_sections`

`data/site-data.js` is only a minimal fallback for company/contact/base content. Do not edit real products there for client operations.

## Forms

Public contact and recruitment forms save directly to Supabase:

- `contact_messages`
- private storage bucket for attachments
- `admin_activity_logs`

The old FormSubmit fallback has been removed from the public forms to avoid duplicate submissions.
