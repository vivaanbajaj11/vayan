# Vayan

A handmade-shirt storefront: static site + cart + Stripe checkout + Decap CMS admin panel. Free to host on Netlify.

## What's in here

```
index.html                              storefront homepage
success.html                            post-checkout confirmation page
css/style.css                           all styling
js/main.js                              renders products, cart drawer, checkout call
js/cart.js                              cart state (localStorage)
data/products.json                      your product catalog — edit via /admin, or by hand
images/                                 product photos (placeholder SVGs included)
images/logo/                            your real Vayan logo assets, extracted from your brand PDFs
admin/index.html, admin/config.yml      Decap CMS admin panel config
netlify/functions/create-checkout-session.js   builds a Stripe Checkout Session for the cart
netlify.toml                            tells Netlify where the site and functions live
package.json                            declares the "stripe" dependency the function needs
```

## 1. About the logo assets

Your logo PDFs were used to generate transparent-background PNGs in `images/logo/`:

- `vayan-mark-gold.png` / `vayan-wordmark-gold.png` — used in the header and success page (gold reads well on the navy header)
- `vayan-full-gold.png` — the full lockup (mark + wordmark + "Bespoke Tailoring"), not placed on the site yet but ready to use, e.g. on an About section
- `vayan-mark-maroon.png` / `vayan-wordmark-maroon.png` — maroon-on-transparent versions for light backgrounds; the footer wordmark uses this
- `favicon.png` — square browser-tab icon, built from the maroon mark

If you'd rather use your original vector PDFs directly (for print, packaging, etc.), the source files aren't part of this site build — keep them wherever you store brand assets separately.

## 2. Push to GitHub

```bash
cd thread-character
git init
git add .
git commit -m "Initial storefront"
```
Create a new empty repo on GitHub, then:
```bash
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

## 3. Deploy on Netlify

1. Go to [app.netlify.com](https://app.netlify.com) → **Add new site → Import an existing project**.
2. Connect your GitHub repo.
3. Build settings: leave build command **empty**, publish directory as `.` (this is a static site, no build step). Netlify will read `netlify.toml` for the rest.
4. Deploy.

## 4. Turn on the admin panel (Decap CMS + Netlify Identity)

1. In your Netlify site dashboard: **Site configuration → Identity → Enable Identity**.
2. Under Identity settings, set **Registration** to "Invite only" (so strangers can't sign up as an admin).
3. Enable **Git Gateway** (Identity → Services → Git Gateway) — this lets the CMS commit changes to GitHub on your behalf.
4. Go to **Identity → Invite users**, invite yourself with your email.
5. Check your email, click the invite link — it'll drop you on your live site with a "Set password" modal.
6. Visit `yoursite.netlify.app/admin` and log in. You'll see a "Shop / Products" section where you can add shirts, upload photos, and update stock — no code required.

## 5. Turn on checkout (Stripe)

1. Create a free [Stripe](https://stripe.com) account.
2. Get your **secret key** from the Stripe dashboard (Developers → API keys). Use the test key first (`sk_test_...`) until you're ready to go live.
3. In Netlify: **Site configuration → Environment variables → Add a variable**:
   - Key: `STRIPE_SECRET_KEY`
   - Value: your Stripe secret key
4. Redeploy the site (env var changes need a redeploy to take effect).
5. Test it: add a shirt to the cart, hit checkout — it should redirect to a real Stripe Checkout page. Use Stripe's [test card `4242 4242 4242 4242`](https://docs.stripe.com/testing) with any future expiry/CVC to simulate a purchase.
6. When ready to accept real payments, swap in your Stripe **live** secret key.

### About stock tracking (read this)

The checkout function checks requested quantities against `data/products.json` at the moment of checkout, so someone can't buy more than the stock number you've set. But this is a **soft check against a file**, not a live database — if two people try to buy your last shirt in the same instant, Stripe won't stop the second one. For a small handmade batch business this is usually fine (you just refund the rare double-sale), but if that risk matters to you, the fix is to move stock into a real database (Supabase and Neon both have free tiers) instead of `products.json`.

After each sale, manually lower the `stock` number for that shirt in `/admin` (or edit `data/products.json` directly and push) — nothing does this automatically yet.

## 6. Local preview (optional)

To preview with working serverless functions before deploying:
```bash
npm install -g netlify-cli
npm install
netlify dev
```
Then open the local URL it prints.

## Customizing further

- **Product photos**: replace the SVGs in `/images` with real photos (or upload new ones through `/admin`, which stores them in `/images` too).
- **Colors/fonts**: all defined as CSS variables at the top of `css/style.css`.
- **Shipping regions**: edit the `allowed_countries` array in `netlify/functions/create-checkout-session.js`.
