// Cloudflare Pages Function: completes the GitHub OAuth flow for the admin panel.
// Route: /callback  (GitHub redirects here after the user authorizes)
//
// Requires OAUTH_CLIENT_ID and OAUTH_CLIENT_SECRET to be set in Cloudflare
// Pages environment variables (from your GitHub OAuth App).
//
// This follows the standard handshake Decap CMS's popup window expects:
// it waits for a message from the opener (the admin page), then replies
// with the access token so the CMS can start committing to GitHub.

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const code = url.searchParams.get('code');

  if (!code) {
    return new Response('Missing authorization code from GitHub.', { status: 400 });
  }

  if (!env.OAUTH_CLIENT_ID || !env.OAUTH_CLIENT_SECRET) {
    return new Response('OAuth credentials are not set in Cloudflare Pages environment variables.', { status: 500 });
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
