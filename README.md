# SMM API Center — v9 (full website)

A complete website rebuild: public landing page, username/password auth,
a dashboard matching your provided design, and a real payment gateway
integration (UglyPay) instead of a manual deposit form.

## What's new in this rebuild

- **Full website, not just a Mini App.** Public landing page at `/`,
  `/register.html` and `/login.html` for auth, `/dashboard.html` for the
  logged-in app, `/admin.html` for admin.
- **Real accounts.** Username + name + email + password signup (fields and
  layout match your screenshot exactly, including the icon+label rows and
  the gradient "Sign up" button). Passwords are hashed with PBKDF2-SHA256
  (100,000 iterations) — never stored in plain text. Sessions are
  server-side (a `sessions` table) tied to an httpOnly cookie, not a JWT
  you have to manage client-side.
- **Dashboard sidebar** matches your second screenshot: profile card with
  avatar + "Verified User", a highlighted gradient **New order** item, then
  **Bulk Order**, **Orders History**, **Services**, **Add funds**, **API**,
  **Logout** — collapses into a slide-out drawer with an X close button on
  mobile, exactly like the screenshot.
- **Bulk Order** (new): paste up to 100 lines as `service,link,quantity`
  and get a per-line success/failure report back.
- **Services** (new): a read-only catalog view of every active service with
  live pricing, separate from the ordering flow.
- **Add Funds now uses a real payment gateway (UglyPay)** instead of a
  manual "send money and wait" form:
  1. User enters an amount and clicks "Pay securely".
  2. The Worker calls `POST {payment_api_url}` with
     `{ amount, reference, callbackUrl }` and your UglyPay API key as a
     Bearer token, then redirects the browser to the returned `payUrl`.
  3. UglyPay calls `POST /api/webhook/uglypay` on your domain when the
     invoice is verified. The Worker checks the `X-Signature` header
     (HMAC-SHA256 of the raw body, signed with your **own** UglyPay API
     key — never your admin password), and on `event === "invoice.verified"`
     credits the user's balance and marks the deposit `Approved`.
  4. Admin → **Deposits** shows every request either way, with a manual
     Approve/Reject fallback for the rare case a webhook doesn't arrive.
- **Admin is now just a user with `role = 'admin'`**, logged in through the
  same session system — no separate shared admin password to manage.

## Folder structure

```
worker.js                     Cloudflare Worker (API + cron)
schema.sql                    D1 schema + starter platforms + seed admin
wrangler.jsonc                Worker config
public/
  index.html                  Landing page
  register.html                Sign up
  login.html                   Log in
  dashboard.html                Logged-in app (sidebar + all views)
  admin.html                    Admin panel
  assets/
    css/style.css              Single stylesheet for the whole site
    js/auth.js                 register.html + login.html logic
    js/dashboard.js             dashboard.html logic
    js/admin.js                 admin.html logic
```

## Setup

1. **Create the D1 database**
   ```bash
   npx wrangler d1 create smm-api-center-db
   ```
   Copy the returned `database_id` into `wrangler.jsonc`.

2. **Apply the schema**
   ```bash
   npx wrangler d1 execute smm-api-center-db --remote --file=./schema.sql
   ```
   This also seeds one admin account:
   **username `admin` / password `admin123`** — log in at `/admin.html` and
   change it immediately from Users → Adjust, or just register a fresh
   account and promote it to `role = 'admin'` via a direct D1 query, then
   disable/ban the seed admin.

3. **Deploy**
   ```bash
   npx wrangler deploy
   ```

4. In **Admin → Settings**:
   - **Payment Gateway (UglyPay)**: set the Invoices API URL (defaults to
     `https://uglypay.devugly.workers.dev/api/invoices`) and your API key
     from UglyPay's `/keys.html` page. The webhook URL is automatic — it's
     always `https://<your-domain>/api/webhook/uglypay`, no extra field
     needed, since the Worker sends that as `callbackUrl` on every invoice
     it creates.
   - **Upstream Provider** (optional): your SMM supplier's API, if you want
     orders auto-placed instead of handled manually.
   - Add **Platforms** → **Categories** → **Services** from their tabs.

## Notes

- The reseller/child API (`POST /api/v2`) is unchanged in shape from the
  previous build — existing integrations keep working.
- Cron (`* * * * *`) still auto-syncs `Processing` orders and pending
  refills from your upstream provider, independent of the payment gateway.
- Sessions last 30 days; logging out clears the cookie and deletes the
  session row server-side.
