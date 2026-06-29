# Cloudflare Workers Deployment

## Settings for Cloudflare Dashboard

When connecting the GitHub repo, set:

- **Build command:** `npx opennextjs-cloudflare build`
- **Deploy command:** `npx wrangler deploy`
- **Node version:** 22

Do NOT set the build command to `bun run build` — that causes an infinite loop.
OpenNext internally runs `next build` itself.
