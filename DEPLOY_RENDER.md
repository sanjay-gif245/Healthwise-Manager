# Deploying to Render (free tier)

This gets you a real public URL. Two things to know up front about the **free** tier specifically:

- The service spins down after ~15 minutes with no traffic, and its disk resets on the next restart. `npm start`
  runs the seed script before booting (see `package.json`), so every restart lands back on the same demo accounts
  instead of an empty database — but anything a real user typed in between (new bookings, etc.) is lost on restart.
  This is fine for a demo/evaluation deployment; if you want real persistence, upgrade the service to a paid
  instance type and attach a Render Disk (see the note at the bottom).
- Render's free plan doesn't include a "Background Worker" service type, so the reminder/retry worker can't run as
  a second free Render service. Instead, an external free cron pings an HTTP endpoint — see step 5.

## 1. Push the code to GitHub

If you haven't already, from inside the project folder:

```bash
git init
git add -A
git commit -m "Initial commit"
```

Create a new **empty** repository on [github.com/new](https://github.com/new) (don't initialize it with a README),
then:

```bash
git remote add origin https://github.com/<your-username>/<repo-name>.git
git branch -M main
git push -u origin main
```

(If you have the `gh` CLI installed, `gh repo create <repo-name> --private --source=. --push` does all of the
above in one command.)

## 2. Create the Render service from the blueprint

1. Sign up / log in at [render.com](https://render.com).
2. **New +** → **Blueprint**.
3. Connect your GitHub account if prompted, then pick the repository you just pushed.
4. Render reads `render.yaml` from the repo root and shows you the one service it defines
   (`healthcare-appointment-manager`, free plan). Click **Apply**.
5. Render generates secure random values for `AUTH_SECRET` and `WORKER_SECRET` automatically (that's what
   `generateValue: true` does in `render.yaml`) — you don't need to set those yourself.

The first deploy takes a few minutes (npm install + Next.js build). When it's done, Render shows you the live URL:
`https://<your-service-name>.onrender.com`.

## 3. (Optional) fill in real integrations

Everything works without this — you'll just see "Simulated" labels in the UI and `[SIMULATED EMAIL]` lines in the
Render logs instead of real AI summaries / real emails. To turn any of them on, go to your service →
**Environment** tab and fill in the corresponding variable(s), then **Save Changes** (Render redeploys
automatically):

- **Real AI summaries**: set `ANTHROPIC_API_KEY`.
- **Real emails**: set `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` (any SMTP provider — SendGrid, Mailgun, Gmail SMTP…).
- **Google Calendar sync**: set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REDIRECT_URI` to
  `https://<your-service-name>.onrender.com/api/calendar/callback` — and add that same URL as an Authorized
  redirect URI in your Google Cloud OAuth client (see README.md → "Google Calendar setup" for creating that client
  in the first place).

## 4. Log in

Go to `https://<your-service-name>.onrender.com` and log in with the seeded demo accounts (same ones as local dev):

- Admin: `admin@clinic.demo` / `Admin@1234`
- Doctor: `anjali.rao@clinic.demo` / `Doctor@1234`
- Patient: `ravi.kumar@clinic.demo` / `Patient@1234`

If the service had spun down from inactivity, the first request takes ~30-60 seconds to wake it up — that's normal
for Render's free tier, not a bug.

## 5. Wire up the background worker (medication reminders + notification retries)

The app exposes `POST /api/worker/tick` specifically for this — it runs the same sweep the standalone
`npm run worker` process would, just triggered over HTTP instead of on a timer. Use any free scheduler to call it
every few minutes:

1. Go to your Render service → **Environment** tab, copy the auto-generated value of `WORKER_SECRET`.
2. Sign up (free) at [cron-job.org](https://cron-job.org) (or use GitHub Actions' `schedule` trigger if you'd
   rather keep it in the same repo — either works).
3. Create a job that sends a `POST` request every 5 minutes to:
   ```
   https://<your-service-name>.onrender.com/api/worker/tick
   ```
   with a custom header:
   ```
   x-worker-secret: <the WORKER_SECRET value you copied>
   ```
4. That's it — booking reminders, medication reminders, and failed-email retries will now actually fire on schedule.

Skipping this step doesn't break booking/cancellation (those work immediately either way) — it only means
scheduled reminders and retries won't run until something triggers `/api/worker/tick`.

## Upgrading to real persistence later

If you outgrow the free tier's disk-resets-on-restart behavior: upgrade the service to a paid instance type, add a
**Render Disk** (Render dashboard → your service → Disks) mounted at `/opt/render/project/src/data`, and remove the
`tsx src/db/seed.ts &&` prefix from the `start` script in `package.json` (you no longer want to re-seed over real
user data on every restart). Everything else about the app stays the same.
