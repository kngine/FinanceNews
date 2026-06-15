# Finance News

Finance News is a Yahoo Finance-inspired news-only app built with Next.js,
TypeScript, and Tailwind. It aggregates trusted finance and economic news feeds,
shows clear attribution, and links readers to the original publisher.

## What It Includes

- A responsive finance news homepage.
- A source/category/search filter bar.
- Server-side RSS aggregation with caching.
- Source attribution on every article card.
- A JSON endpoint at `/api/news`.

## Source Policy

Finance News uses allowlisted feeds from trusted publishers and official
sources. Reader mode fetches publisher pages and extracts readable article
content when the page provides it.

Allowed source types:

- Official regulatory feeds.
- Official central bank and treasury feeds.
- Official economic-statistics feeds.
- Reputable publisher RSS feeds, including market and business news feeds.

Stored feed data includes title, source, URL, category, publish time,
summary/excerpt, and tags. Reader content is generated on demand from the
publisher page.

## Getting Started

This environment did not have Node or npm available, so dependencies were not
installed during scaffolding. On a machine with Node.js installed:

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

## Useful Commands

```bash
npm run lint
npm run build
```

## Adding Sources

Add sources in `src/lib/news/sources.ts`. Before enabling a feed, verify that:

- The publisher is reputable or official.
- The feed permits normal RSS-reader style access.

Disable or remove any source that blocks RSS access or requires an API key.
