# Cloudflare Workers Deployment Guide

## Step 1: Connect GitHub to Cloudflare (Auto-deploy on push)

1. Go to https://dash.cloudflare.com → Workers & Pages → Create
2. Click "Workers" → "Import a repository"
3. Select your GitHub repo: `Ali-123409/zexbox`
4. Set build settings:
   - **Build command:** `npx opennextjs-cloudflare build`
   - **Deploy command:** `npx wrangler deploy`
   - **Root directory:** `/`
5. Under "Settings" → "Variables":
   - Add `NODE_VERSION` = `20`
6. Click "Save and Deploy"
7. Wait for build to complete (~2-3 minutes)
8. Your site goes live at `https://zexbox.<your-subdomain>.workers.dev`

## Step 2: Add Custom Domain (Optional)

1. Go to Cloudflare Dashboard → Workers & Pages → zexbox → Settings → Triggers
2. Under "Custom Domains" → "Add Custom Domain"
3. Enter your domain (e.g., zexbox.com)
4. Cloudflare auto-configures DNS + SSL

## Step 3: Deploy via CLI (Alternative)

```bash
# Login to Cloudflare (one-time)
npx wrangler login

# Build for Cloudflare
npx opennextjs-cloudflare build

# Deploy to Cloudflare Workers
npx wrangler deploy

# Preview locally
npx wrangler dev
```

## Why Cloudflare Workers (not Vercel)?

- ✅ FREE for commercial use (Vercel Hobby is non-commercial only)
- ✅ 100,000 requests/day free tier
- ✅ Global CDN (300+ locations)
- ✅ No serverless cold starts (V8 isolates)
- ✅ nodejs_compat flag for Node.js APIs
- ✅ Unlimited bandwidth on free tier

## Environment Variables

Set in Cloudflare dashboard → Workers → zexbox → Settings → Variables:
- `DATABASE_URL` — your database URL (optional)
