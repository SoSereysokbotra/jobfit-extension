# Résumé Parsing — Failure Diagnosis, Fixes & Plan

> **Status: ✅ RESOLVED** — the latest résumé now parses to `SUCCESS` with a real
> summary + extracted skills (verified in the DB). This doc records *why it broke*,
> *what was changed*, and a **phased plan for your review** to make it durable and
> re-verify the extension features on real data.
>
> _Date: 2026-08-10_

---

## 1. Symptom

Web-app onboarding → "**We couldn't read this resume.**" on upload of
`CV_So_Sereysokbotra_Software_Engineer.pdf`. The same failure also made the
extension's match score `semantic: false` and cover letters fall back to a
generic template.

## 2. Root causes (TWO independent problems)

### Cause A — Backend reached the wrong service (IPv4/IPv6)
- Backend `.env` had `AI_SERVICE_URL=http://localhost:8000/api/v1`.
- On Windows/Node, `localhost` resolves to **IPv6 `::1`** first.
- Port 8000 has **two** listeners: your real FastAPI AI service on `127.0.0.1:8000`
  (IPv4) **and Docker forwarding a Django container** on `0.0.0.0`/`[::]:8000`.
- So the backend's AI calls hit **Docker/Django → 404**. Résumé parsing has
  **no fallback** (`resume-parser.service.ts`) → the job fails → "couldn't read".

**Evidence:** `curl localhost:8000/api/v1/health` → Django 404;
`curl 127.0.0.1:8000/api/v1/health` → `{"status":"ok","modelsLoaded":[...]}`.

### Cause B — Redis was down (queue couldn't run)
- Résumé parsing is a **BullMQ background job** (`resume.service.ts` →
  `queue.addJob('resume-parsing', …)`), and BullMQ runs on **Redis (:6379)**.
- Nothing was serving 6379 (`ECONNREFUSED ::1:6379` / `127.0.0.1:6379` in the log).
- `BullQueueService.addJob` just calls `queue.add()` — **no inline fallback** — so
  with Redis down the parse job can't be enqueued/processed at all.

## 3. Fixes applied (done)

| # | Fix | Where | Note |
|---|---|---|---|
| A | `AI_SERVICE_URL` → `http://127.0.0.1:8000/api/v1` | `jobfit-backend/.env` | Forces IPv4 → hits the real AI service, sidesteps Docker/Django. **Requires backend restart** (done). |
| B | Started Redis: `docker run -d --name jobfit-redis -p 6379:6379 redis:alpine` | Docker | Backend's ioredis auto-reconnected; the worker resumed. |

## 4. Verification (done)

- AI service `127.0.0.1:8000/api/v1/health` → **200**, models loaded (qwen3, bge-m3, …).
- Redis `jobfit-redis` → **PONG**.
- BullMQ `resume-parsing`: **2 jobs completed, 0 failed**.
- DB: latest `CV_So_Sereysokbotra…pdf` → **`parsingStatus: SUCCESS`**, real summary,
  skills extracted.

---

## 5. Phased plan — FOR YOUR REVIEW

Nothing below is done yet. Approve / adjust and I'll execute.

### Phase 1 — Confirm end-to-end in the browser (you)
- [ ] Finish onboarding (résumé already parsed) → complete **Profile Setup** so a
      `Profile` row exists (the extension's match badge needs it).
- [ ] Re-test the extension on a LinkedIn job: match %, skill gaps, company, salary,
      cover letter (should now be **personalized** from your résumé), interview prep.

### Phase 2 — Make the infra durable ✅ DONE (2026-08-10)
- [x] Added `jobfit-backend/docker-compose.yml` with a **Redis service** — persistent
      named volume (`jobfit-redis-data`, `--appendonly yes`), `restart: unless-stopped`,
      and a healthcheck. Replaced the throwaway `docker run` container with the
      compose-managed one (`docker compose up -d` → `PONG`). It now **survives reboots**.
- [x] Updated `jobfit-backend/.env.example`: `AI_SERVICE_URL` → `127.0.0.1:8000` with a
      comment explaining the IPv6/Docker trap, so a fresh clone won't repeat it.
- [ ] _(optional)_ Add the same note to the backend README "getting started".

**How to run Redis from now on:** `cd jobfit-backend && docker compose up -d`
(it auto-starts on reboot; `docker compose down` to stop, data is kept).

### Phase 3 — Clean up
- [ ] Delete the stale `FAILED` résumé row for your account (optional tidy-up).
- [ ] Note: the Django-on-8000 (Docker) belongs to another project — leaving it is
      fine now that the backend uses `127.0.0.1`, but flag if you want it stopped.

### Phase 4 — Re-verify extension features on REAL résumé data (me)
Now that parsing works, re-run the endpoint checks as your account and confirm the
upgrades vs. the earlier fallback run:
- [ ] `/recommendations/by-job` → **`semantic: true`** (real skills score, not neutral 50).
- [ ] `/generate/cover-letter` → **personalized** (uses your résumé summary).
- [ ] `/learning/gap` → gaps reflect your real skills.
- [ ] Update `docs/PROGRESS.md` with the "real data verified" result.

---

## 6. Open questions for you

1. **Redis durability** — OK to add a `docker-compose.yml` with a persistent Redis
   service (Phase 2)? Or do you already have a compose I should extend?
2. **AI service startup** — how do you normally start `jobfits-ai-service` + Ollama?
   Should I document/script that so the whole stack comes up together?
3. Anything you *don't* want me to touch in `jobfit-backend`?
