// Netlify serverless function: creates a Stripe Checkout Session for the cart.
// Requires the STRIPE_SECRET_KEY environment variable to be set in Netlify.
//
// This checks requested quantities against data/products.json at request time,
// so someone can't check out with more stock than you have listed. Note: this
// is a "soft" check based on the committed JSON file, not a live database —
// if two people buy the last item at the exact same moment, Stripe itself
// won't stop the second sale. For true real-time inventory locking you'd need
// a database (e.g. Supabase, FaunaDB) instead of a flat JSON file.

const Stripe = require('stripe');
const fs = require('fs');
const path = require('path');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'STRIPE_SECRET_KEY is not set in Netlify environment variables.' }),
    };
  }

  const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

  try {
    const { items } = JSON.parse(event.body);
    if (!Array.isArray(items) || items.length === 0) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Cart is empty.' }) };
    }

    // Load the current catalog so prices/stock can't be spoofed from the client.
    // File sits at repo root; this function lives at netlify/functions/, so ../../ reaches root.
    const productsPath = path.join(__dirname, '..', '..', 'products.json');
    const catalog = JSON.parse(fs.readFileSync(productsPath, 'utf8')).products;

    const line_items = [];
    for (const item of items) {
      const product = catalog.find((p) => p.id === item.id);
      if (!product) {
        return { statusCode: 400, body: JSON.stringify({ error: `Unknown product: ${item.id}` }) };
      }
      if (item.qty > product.stock) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: `Only ${product.stock} left of "${product.name}".` }),
        };
      }
      line_items.push({
        price_data: {
          currency: 'inr',
          product_data: { name: item.size ? `${product.name} (Size ${item.size})` : product.name },
          unit_amount: Math.round(product.price * 100),
        },
        quantity: item.qty,
      });
    }

    const siteUrl = process.env.URL || 'http://localhost:8888';

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items,
      shipping_address_collection: { allowed_countries: ['IN', 'US', 'CA', 'GB', 'AU'] },
      success_url: `${siteUrl}/success.html`,
      cancel_url: `${siteUrl}/`,
    });

    return { statusCode: 200, body: JSON.stringify({ url: session.url }) };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
