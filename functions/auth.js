// Cloudflare Pages Function: starts the GitHub OAuth flow for the admin panel.
// Route: /auth  (Decap CMS's "github" backend hits this first)
//
// Requires OAUTH_CLIENT_ID to be set in Cloudflare Pages environment variables
// (the Client ID of your GitHub OAuth App).

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  if (!env.OAUTH_CLIENT_ID) {
    return new Response('OAUTH_CLIENT_ID is not set in Cloudflare Pages environment variables.', { status: 500 });
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
