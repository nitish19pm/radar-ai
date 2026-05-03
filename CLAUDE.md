# RadarAI

> *Everything AI. Nothing you don't need.*

A web dashboard that aggregates AI + product management articles from multiple sources in real time.

## Live URL
https://radar-ai-six.vercel.app

## Tech Stack
- **Backend**: Node.js + Express (`server.js`)
- **Frontend**: Vanilla HTML/CSS/JS (`public/`)
- **Dependencies**: `axios` (HTTP), `cheerio` (XML/HTML parsing), `express`
- **Hosting**: Vercel (serverless, auto-deploys from GitHub)
- **Repo**: https://github.com/nitish19pm/radar-ai

## Project Structure
```
claude_pulse/
├── server.js          — Express backend, API routes
├── package.json       — Dependencies and scripts
├── vercel.json        — Vercel routing config (all requests → server.js)
├── .gitignore
├── CLAUDE.md          — This file
└── public/
    ├── index.html     — App shell, filter buttons, chip filter section
    ├── style.css      — Dark theme, card grid, badges, chip styles
    └── app.js         — Fetch logic, card rendering, filters, localStorage
```

## API Routes (server.js)
| Route | Description |
|---|---|
| `GET /api/rss` | Fetches RSS feeds from AI newsletters (TLDR AI, Ben's Bites, The Rundown AI, Import AI). Parses XML with cheerio. Returns up to 60 posts. |
| `GET /api/producthunt` | Disabled (WIP). Returns `{ disabled: true }`. |
| `GET /api/reddit` | Disabled until Reddit OAuth credentials are configured via env vars. |

## Frontend Sources (app.js — client-side)
| Source | Method | Queries/Tags |
|---|---|---|
| Hacker News | Algolia API (`search_by_date`) | anthropic, chatgpt, openai, gemini ai, github copilot, claude ai |
| Dev.to | Dev.to REST API | claude, chatgpt, openai, gemini, copilot, productmanagement |
| Newsletters | `/api/rss` (server) | TLDR AI, Ben's Bites, The Rundown AI, Import AI |

## Key Frontend Features (app.js)
- **Chip filter**: Collapsible keyword filter bar (AI Tools + Topics chips). Multi-select, OR logic. Persisted in `localStorage` (`radarai_chips`, `radarai_filter_open`).
- **Source filter**: All / Hacker News / Dev.to / Newsletters buttons. Reddit + Product Hunt show WIP popup.
- **Search bar**: Live text search filtering posts by title. Clears on refresh. Persists `searchQuery` state in memory.
- **Theme toggle**: 🌙/☀️ button toggles dark/light theme. Persisted in `localStorage` (`radarai_theme`). Light theme overrides CSS variables via `[data-theme="light"]` on `<body>`.
- **Tags on cards**: HN cards show matched AI keywords; Dev.to cards show actual `tag_list` from API.
- **Source accent borders**: Cards have a colored left border matching their source (HN=orange, Dev.to=purple, Newsletter=green).
- **Skeleton loaders**: Shimmer animation while fetching.
- **Refresh button**: Re-fetches all sources, clears search, updates "Last fetched" timestamp.
- **Deduplication**: Posts deduplicated by ID within each source.
- **Sort**: Newest first by `createdAt` timestamp. Posts without timestamps go to the end.

## Environment Variables (Vercel)
| Variable | Purpose |
|---|---|
| `REDDIT_CLIENT_ID` | Reddit OAuth app ID (not yet configured) |
| `REDDIT_CLIENT_SECRET` | Reddit OAuth app secret (not yet configured) |

## Running Locally
```bash
cd claude_pulse
npm install
node server.js
# Open http://localhost:3000
```

## Deploying
Push to `main` branch on GitHub — Vercel auto-deploys within ~30 seconds.

## Disabled / WIP Sources
- **Reddit**: Needs OAuth credentials. Route exists in `server.js`, returns empty until `REDDIT_CLIENT_ID` + `REDDIT_CLIENT_SECRET` are set in Vercel env vars.
- **Product Hunt**: Scraping blocked from Vercel IPs. Marked WIP in UI.

## Badge Colors
| Source | Color |
|---|---|
| Hacker News | Orange `#ff6600` |
| Dev.to | Purple `#a855f7` |
| Newsletter | Green `#4ade80` |
| Reddit | Red-orange `#ff4500` |
| Product Hunt | Coral `#da552f` |
