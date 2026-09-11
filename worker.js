// Single Cloudflare Worker handling this whole site.
// - Serves the static site (HTML/CSS/JS/images/products.json/etc.) via the
//   ASSETS binding for any route it doesn't explicitly handle below.
// - Handles three dynamic routes: /auth and /callback (the GitHub OAuth
//   relay for the admin panel) and /create-checkout-session (Stripe).
//
// Requires these set as Variables/Secrets on the Worker (Cloudflare
// dashboard -> your Worker -> Settings -> Variables and Secrets):
//   OAUTH_CLIENT_ID, OAUTH_CLIENT_SECRET  (from your GitHub OAuth App)
//   STRIPE_SECRET_KEY                     (from your Stripe account)

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/auth') {
      return handleAuth(request, env, url);
    }

    if (url.pathname === '/callback') {
      return handleCallback(request, env, url);
    }

    if (url.pathname === '/create-checkout-session' && request.method === 'POST') {
      return handleCheckout(request, env, url);
    }

    // Everything else (index.html, css, js, images, products.json, admin/, etc.)
    return env.ASSETS.fetch(request);
  },
};

// --- GitHub OAuth relay for the /admin panel ---

async function handleAuth(request, env, url) {
  if (!env.OAUTH_CLIENT_ID) {
    return new Response('OAUTH_CLIENT_ID is not set in this Worker\'s Variables and Secrets.', { status: 500 });
  }

  const redirectUri = `${url.origin}/callback`;
  const state = crypto.randomUUID();

  const githubAuthUrl =
    `https://github.com/login/oauth/authorize` +
    `?client_id=${encodeURIComponent(env.OAUTH_CLIENT_ID)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&scope=${encodeURIComponent('repo,user')}` +
    `&state=${encodeURIComponent(state)}`;

  return Response.redirect(githubAuthUrl, 302);
}

async function handleCallback(request, env, url) {
  const code = url.searchParams.get('code');

  if (!code) {
    return new Response('Missing authorization code from GitHub.', { status: 400 });
  }

  if (!env.OAUTH_CLIENT_ID || !env.OAUTH_CLIENT_SECRET) {
    return new Response('OAuth credentials are not set in this Worker\'s Variables and Secrets.', { status: 500 });
  }

  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: env.OAUTH_CLIENT_ID,
      client_secret: env.OAUTH_CLIENT_SECRET,
      code,
    }),
  });

  const tokenData = await tokenRes.json();

  if (tokenData.error || !tokenData.access_token) {
    return new Response(`GitHub OAuth error: ${tokenData.error_description || tokenData.error || 'unknown error'}`, {
      status: 400,
    });
  }

  const payload = JSON.stringify({ token: tokenData.access_token, provider: 'github' });

  const html = `<!DOCTYPE html>
<html>
<body>
<script>
  (function() {
    function receiveMessage(e) {
      window.opener.postMessage(
        'authorization:github:success:${payload.replace(/</g, '\\u003c')}',
        e.origin
      );
      window.removeEventListener('message', receiveMessage, false);
    }
    window.addEventListener('message', receiveMessage, false);
    window.opener.postMessage('authorizing:github', '*');
  })();
</script>
Login complete — you can close this window if it doesn't close automatically.
</body>
</html>`;

  return new Response(html, { headers: { 'Content-Type': 'text/html' } });
}

// --- Stripe checkout ---

async function handleCheckout(request, env, url) {
  if (!env.STRIPE_SECRET_KEY) {
    return new Response(
      JSON.stringify({ error: 'STRIPE_SECRET_KEY is not set in this Worker\'s Variables and Secrets.' }),
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

    const productsUrl = new URL('/products.json', url.origin);
    const productsRes = await env.ASSETS.fetch(new Request(productsUrl));
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

    const params = new URLSearchParams();
    params.append('mode', 'payment');
    params.append('success_url', `${url.origin}/success.html`);
    params.append('cancel_url', `${url.origin}/`);
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
