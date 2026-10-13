# SmartShop AI — Smart Price Comparison & Shopping Assistant

Production-oriented full-stack price comparison and AI shopping assistant designed for the Egyptian consumer market.

## Architecture

- **Frontend**: React 19 + TypeScript + Tailwind CSS (v4) with RTL-first layout for Arabic, English LTR toggle, Cairo & IBM Plex Sans Arabic typography, and Recharts.
- **Backend**: Full-stack Node.js Express server (`server.ts`) mounting Vite middleware in development and serving static production builds in production.
- **Database**: Persistent SQLite with WebAssembly engine (`sql.js`), versioned migrations, atomic disk persistence, and relational integrity.
- **AI Shopping Assistant**: Server-side Gemini 3.8 Flash (`@google/genai`) with deterministic grounding on verified Egyptian catalog offers and budget ceiling enforcement.
- **External Discovery**:
  - **Provider A**: SerpApi Google Shopping Egypt (`gl=eg`, `hl=ar`), reporting `not_configured` when credentials are absent.
  - **Provider B**: Gemini with Google Search Grounding for live Egyptian retailer offer discovery (Amazon Egypt, Noon, Jumia, B.Tech, 2B, Raya Shop).
- **Admin Dashboard**: Real-time KPI cards bound directly to database records, charts (store coverage, search trends), product/offer management, live provider diagnostics, and matching review.

## Environment Variables

See `.env.example` for details:
```
GEMINI_API_KEY="MY_GEMINI_API_KEY"
SERPAPI_API_KEY="your_serpapi_key_here"
CACHE_TTL_MINUTES=60
SERPAPI_ENABLED=true
GEMINI_GROUNDING_ENABLED=true
```

## Running Automated Integrity Tests

```bash
npx tsx test-integrity.ts
```
