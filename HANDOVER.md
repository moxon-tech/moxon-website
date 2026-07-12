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
- `_headers`
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

## Storage cleanup

When admins delete or replace CMS records/images, the admin script removes Supabase Storage files that are no longer referenced by the saved CMS data.

- Public website media is stored in `moxon-media`.
- Contact/recruitment attachments are stored in `moxon-private`.
- Local repository images such as `assets/optimized/*` are not deleted by the admin.
- New uploaded Storage files are named from the related record title/name first, then the field name and timestamp, so they are easier to find in Supabase.

## Supabase handover checklist

- Disable public signup in Supabase Auth before handover, or replace the broad `authenticated` admin policies with an admin whitelist.
- Keep `cms_sections` public-readable only for content that is safe to show on the website. Do not store secrets, private notes, API keys, or internal prices there.
- Run the latest `supabase-cms-schema.sql` once after deployment. It removes the unused `products_with_vn_time` view so Supabase does not keep showing it as unrestricted.
- Add CAPTCHA or rate limiting later if public contact/recruitment spam becomes a problem.
