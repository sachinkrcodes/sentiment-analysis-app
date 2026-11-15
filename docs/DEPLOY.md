# Putting this live

Java is not an official Vercel runtime. Vercel's Container runtime (beta) can run a Dockerfile, but I could not test it.
Safest order to try:

1. **Vercel Container runtime (beta)**: import the GitHub repo, keep the root `Dockerfile`.
   Environment variables: `PORT=8080`, `READ_ONLY=true`, `NO_BROWSER=1`.
   If Vercel does not offer it on your account, go to step 2.
2. **Render.com (free web service, Docker)**: New > Web Service > connect repo > Runtime: Docker.
   Same three environment variables.

Notes
- `READ_ONLY=true` blocks training, lexicon edits and history delete, so visitors cannot break the demo.
- History is stored in files and resets when the server restarts. All visitors share it.
- The free tier sleeps when idle; the first open can take about a minute.
