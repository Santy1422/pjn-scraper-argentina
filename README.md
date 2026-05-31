# Betti — Legal Case Management for Argentine Courts

**Automated case tracking for lawyers practicing in Argentina's federal judiciary (PJN).** Betti scrapes the PJN portal twice daily, tracks deadlines with judicial calendar awareness, generates court documents from templates, and sends WhatsApp summaries every morning.

Built for a solo practitioner managing 200+ active cases across multiple jurisdictions.

---

## Features

- **Automated scraping** — Logs into the PJN portal via headless Chromium, syncs case lists (expedientes), court actions (actuaciones), notifications (cedulas), and rulings (despachos)
- **Smart deadline tracking** — Auto-creates tasks from court events with deadlines calculated using business days, excluding judicial holidays and court recesses
- **Document generator** — 10 pre-built legal templates (appeals, motions, briefs) with auto-injected case headers and lawyer signature
- **PDF export** — Generates court-formatted PDFs (A4, Times New Roman, judicial margins)
- **WhatsApp notifications** — Morning summary of overnight changes via Zavu API
- **Real-time dashboard** — Cases by status, jurisdiction breakdown, weekly activity charts
- **PWA** — Installable on mobile and desktop for quick access
- **Full-text search** — Find any case by name, number, court, or party (Cmd+K)

## Architecture

```
┌─────────────────────────────────────────────┐
│                   Client                    │
│         React 19 + Vite (SPA/PWA)          │
└──────────────────┬──────────────────────────┘
                   │ REST API
┌──────────────────┴──────────────────────────┐
│              Express Server                 │
│  ┌────────┐  ┌────────┐  ┌───────────────┐ │
│  │ Scraper│  │  Cron  │  │  Notifier     │ │
│  │Playwright │ node-cron│  │  Zavu/WhatsApp│ │
│  └────────┘  └────────┘  └───────────────┘ │
│              SQLite (WAL mode)              │
└─────────────────────────────────────────────┘
```

| Layer | Tech |
|---|---|
| Frontend | React 19, Vite, Lucide icons |
| Backend | Node.js, Express |
| Scraping | Playwright (headless Chromium) |
| Database | SQLite via better-sqlite3 (WAL mode) |
| PDF generation | Playwright PDF renderer |
| Notifications | Zavu WhatsApp API |
| Scheduling | node-cron (2x daily, Mon-Fri) |
| Deploy | Docker on Railway (persistent volume) |

## Quick Start

```bash
git clone https://github.com/Santy1422/pjn-scraper-argentina.git
cd pjn-scraper-argentina

npm install
cd dashboard && npm install && npx vite build && cd ..
npx playwright install chromium

npm start
# → http://localhost:3000
```

Create your account on first visit, then go to **Settings** and enter your PJN credentials (CUIL + password).

## Deploy (Railway)

1. Create a project on [Railway](https://railway.app) and connect this repo
2. Add a **Volume** mounted at `/data`
3. Set environment variables:

| Variable | Required | Description |
|---|---|---|
| `DATA_DIR` | Yes | `/data` (persistent volume) |
| `ADMIN_EMAIL` | Optional | Auto-creates admin account on first run |
| `ADMIN_PASSWORD` | Optional | Password for the auto-created account |
| `PJN_USUARIO` | Optional | PJN portal CUIL (auto-configured) |
| `PJN_PASSWORD` | Optional | PJN portal password (auto-configured) |
| `ZAVU_API_KEY` | Optional | Zavu API key for WhatsApp notifications |
| `ZAVU_SENDER_ID` | Optional | Zavu sender ID |
| `NOTIFY_PHONE` | Optional | Phone number for WhatsApp alerts (E.164) |

Railway detects the `Dockerfile` automatically. The scraper runs at 8:00 and 18:00 (Argentina time, Mon-Fri).

## Legal Templates

| Template | Reference |
|---|---|
| Motion for expedited ruling | Art. 167 CPCCN |
| Appeal | Arts. 242/244 CPCCN |
| Answer to complaint | Art. 356 CPCCN |
| Motion for reconsideration | Art. 238 CPCCN |
| Reconsideration with subsidiary appeal | Art. 238 + 244 CPCCN |
| Statement of grievances | Art. 259 CPCCN |
| Evidence offering | Art. 367 CPCCN |
| Closing argument | Art. 482 CPCCN |
| Proof of standing | General practice |
| Generic brief | Free format |

## Project Structure

```
├── server.js          # Express API (40+ endpoints)
├── scraper.js         # Playwright scraper (login, cases, actions, PDFs)
├── db.js              # SQLite schema, queries, judicial calendar
├── cron.js            # Scheduled scraping (8:00 + 18:00 Mon-Fri)
├── notifier.js        # WhatsApp notifications via Zavu
├── Dockerfile         # Production build with Chromium deps
├── railway.toml       # Railway deployment config
└── dashboard/         # React SPA
    ├── src/
    │   ├── App.jsx            # Router, auth, PWA install
    │   ├── api.js             # API client with token management
    │   ├── components/
    │   │   ├── Dashboard.jsx      # Overview with charts
    │   │   ├── Expedientes.jsx    # Case list (table + mobile cards)
    │   │   ├── ExpedienteDetalle.jsx  # Case detail + timeline
    │   │   ├── GeneradorEscrito.jsx   # Document editor + templates
    │   │   ├── Calendario.jsx     # Deadline calendar
    │   │   ├── Alertas.jsx        # Cases requiring attention
    │   │   ├── Actividad.jsx      # Recent activity feed
    │   │   ├── Configuracion.jsx  # Settings + PJN credentials
    │   │   └── ...
    │   └── index.css          # Full design system
    └── public/
        ├── manifest.json      # PWA manifest
        └── sw.js              # Service worker
```

## License

MIT
