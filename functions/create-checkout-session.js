// Cloudflare Pages Function: creates a Stripe Checkout Session for the cart.
// Lives at /functions/create-checkout-session.js, which Cloudflare Pages
// automatically maps to the route: /create-checkout-session
//
// Requires the STRIPE_SECRET_KEY environment variable to be set in the
// Cloudflare Pages project settings (Settings -> Environment variables).
//
// This talks to Stripe's REST API directly via fetch rather than the Stripe
// Node SDK, since Cloudflare's Workers runtime doesn't include Node's
// fs/stream APIs the SDK relies on by default.
//
// Like the previous version, this checks requested quantities against the
// live products.json before creating the session — a "soft" check against a
// committed file, not a real-time database. Two people buying the last item
// in the same instant could both succeed; a real inventory guarantee would
// need a database instead of a flat JSON file.

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.STRIPE_SECRET_KEY) {
    return new Response(
      JSON.stringify({ error: 'STRIPE_SECRET_KEY is not set in Cloudflare Pages environment variables.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const { items } = await request.json();
    if (!Array.isArray(items) || items.length === 0) {
      return new Response(JSON.stringify({ error: 'Cart is empty.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Fetch the live products.json from this same deployment so prices/stock
    // can't be spoofed by editing values in the browser before checkout.
    const productsUrl = new URL('/products.json', request.url);
    const productsRes = await fetch(productsUrl);
    const catalog = (await productsRes.json()).products;

    const lineItems = [];
    for (const item of items) {
      const product = catalog.find((p) => p.id === item.id);
      if (!product) {
        return new Response(JSON.stringify({ error: `Unknown product: ${item.id}` }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (item.qty > product.stock) {
        return new Response(JSON.stringify({ error: `Only ${product.stock} left of "${product.name}".` }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      lineItems.push({
        name: item.size ? `${product.name} (Size ${item.size})` : product.name,
        unitAmount: Math.round(product.price * 100),
        qty: item.qty,
      });
    }

    const siteUrl = new URL(request.url).origin;

    // Stripe's Checkout Session API expects classic form-encoded params,
    // including array-style keys for line items and shipping countries.
    const params = new URLSearchParams();
    params.append('mode', 'payment');
    params.append('success_url', `${siteUrl}/success.html`);
    params.append('cancel_url', `${siteUrl}/`);
    ['IN', 'US', 'CA', 'GB', 'AU'].forEach((country) => {
      params.append('shipping_address_collection[allowed_countries][]', country);
    });
    lineItems.forEach((li, i) => {
      params.append(`line_items[${i}][price_data][currency]`, 'inr');
      params.append(`line_items[${i}][price_data][product_data][name]`, li.name);
      params.append(`line_items[${i}][price_data][unit_amount]`, String(li.unitAmount));
      params.append(`line_items[${i}][quantity]`, String(li.qty));
    });

    const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const session = await stripeRes.json();

    if (!stripeRes.ok) {
      return new Response(JSON.stringify({ error: session.error?.message || 'Stripe error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
