# 📚 Bookstagram Dashboard

Instagram analytics dashboard for @bookmarked.by.steph

## Deploy to Vercel

### Option 1: Vercel CLI (recommended)

1. Install Vercel CLI:
   ```bash
   npm i -g vercel
   ```

2. Login to Vercel:
   ```bash
   vercel login
   ```

3. Deploy:
   ```bash
   cd bookstagram-dashboard
   vercel
   ```

4. Add your Instagram token as an environment variable:
   ```bash
   vercel env add INSTAGRAM_ACCESS_TOKEN
   ```
   (paste your token when prompted)

5. Redeploy to pick up the env var:
   ```bash
   vercel --prod
   ```

### Option 2: Vercel Dashboard

1. Push this folder to a GitHub repo
2. Go to vercel.com → New Project → Import from GitHub
3. Add environment variable: `INSTAGRAM_ACCESS_TOKEN` = your token
4. Deploy

## Environment Variables

| Variable | Description |
|----------|-------------|
| `INSTAGRAM_ACCESS_TOKEN` | Your Instagram Graph API access token |

## Token Refresh

The Instagram token expires every 60 days. To refresh:

1. Call the refresh endpoint (Molt can do this)
2. Update the `INSTAGRAM_ACCESS_TOKEN` env var in Vercel:
   ```bash
   vercel env rm INSTAGRAM_ACCESS_TOKEN
   vercel env add INSTAGRAM_ACCESS_TOKEN
   vercel --prod
   ```

## Local Development

```bash
# Set env var
export INSTAGRAM_ACCESS_TOKEN=your_token_here

# Run locally
vercel dev
```

---
Dashboard by Molt 🦋
