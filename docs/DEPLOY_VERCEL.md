# Deploy DevPulse for free: Vercel + Neon

Vercel serves the React app from its CDN and runs the API as one serverless function (`api/index.js`). The database is
a free Neon PostgreSQL. Total cost for a project like this: **$0**. (Prices and limits change; the figures below were
checked in October 2026 - confirm them on the pricing pages before relying on them.)

| Piece | Plan | What you get |
|---|---|---|
| [Vercel](https://vercel.com/changelog/higher-defaults-and-limits-for-vercel-functions-running-fluid-compute) | Hobby (free) | Functions up to 300 s with Fluid compute (we ask for 60 s), 2 GB memory. Hobby is intended for personal / non-commercial use |
| [Neon](https://neon.com/pricing) | Free | 0.5 GB storage, 100 compute-hours/month, connection pooling, scale-to-zero after 5 minutes idle |
| [Railway](https://docs.railway.com/reference/pricing/plans) (alternative) | Trial, then Hobby | $5 one-time trial credit, then $5/month minimum |

## 1. Database (Neon)
1. Create a project at neon.com. Use the **pooled** connection string (the host contains `-pooler`) and keep `?sslmode=require`.
2. That string is your `DATABASE_URL`. DevPulse creates its tables itself on the first request (versioned migrations).

## 2. GitHub OAuth app
GitHub -> Settings -> Developer settings -> OAuth Apps -> **New**.
- Homepage URL: `https://<your-project>.vercel.app`
- Authorization callback URL: `https://<your-project>.vercel.app/api/auth/github/callback`

Keep the Client ID and generate a Client Secret. (You can create the app first with a guessed project name, then edit the URLs once Vercel shows the real domain.)

## 3. Vercel project
1. Vercel -> **Add New -> Project** -> import this repository. Leave the root directory as the repository root and the framework as **Other**; `vercel.json` already sets the install, build and output settings.
2. Add environment variables (Production):

| Variable | Value |
|---|---|
| `DATABASE_URL` | Neon pooled connection string |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | from step 2 |
| `JWT_SECRET`, `TOKEN_ENCRYPTION_KEY` | two different values from `openssl rand -hex 32` |
| `AI_PROVIDER` + `GEMINI_API_KEY` *(or `OPENAI_API_KEY`)* | optional; without a key you get free rule-based summaries |
| `CRON_SECRET` | optional; enables the weekly digest. Vercel Cron (`vercel.json`) calls `/api/cron/digest` daily at 07:00 UTC with this secret, and each user's digest goes out on the weekday they chose |
| `RESEND_API_KEY`, `DIGEST_FROM` | optional; only needed for digests by e-mail (Slack needs nothing on the server) |
| `BASE_URL` | only if you use a custom domain, e.g. `https://pulse.example.edu` |

   `BASE_URL` is otherwise derived automatically from Vercel's production domain, so the OAuth callback URL matches.
3. **Deploy.** Every push to `main` redeploys; pull requests get preview URLs (OAuth only works on the production domain unless you add that preview URL to the OAuth app).

## 4. Check it works
- `https://<project>.vercel.app/api/health` -> `{"status":"ok"}`
- Landing page -> **Explore the live demo** works with no GitHub or AI keys.
- **Continue with GitHub** -> open a real repository -> first sync -> Insights -> Generate.

## How it differs from a long-running server
- **Cold starts.** The first request after idle boots the function and applies pending migrations (a few hundred ms; Neon may also be waking). Set `MIGRATE_ON_START=false` once your schema is up to date to skip that check.
- **Connections.** Each instance holds at most 3 database connections (`DB_POOL_MAX`) and relies on Neon's pooler.
- **Per-instance memory.** Rate-limit counters and the "one sync at a time per repository" guard live in each instance. They still protect a single instance, but a determined client could spread requests across instances. Database writes are idempotent, so correctness is unaffected. If abuse ever matters, move the counters to Redis (Upstash has a free tier).
- **No always-on process.** Everything here is request-driven, which is all DevPulse needs today. Live push updates (webhooks / WebSockets) would need a different host for that part.

## Prefer a container?
`Dockerfile`, `docker-compose.yml` and `railway.json` remain and work unchanged (see the README).
