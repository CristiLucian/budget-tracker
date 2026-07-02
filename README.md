# Buget - Personal Budget Tracker

Account-based budget tracker in Romanian, built as an installable PWA.
Core goal unchanged since v1: **log a transaction in under 5 seconds**.

- **Accounts**: Google sign-in or email/password (Firebase Auth)
- **Cloud database**: Firestore — data syncs across devices and works
  **offline** (entries queue and sync when back online)
- **Hosting**: static build on GitHub Pages, deployed by GitHub Actions
- **Privacy**: each account sees only its own data (`firestore.rules`);
  no credentials in the repo (see [SETUP.md](SETUP.md))
- Mobile-first UI + full desktop experience (sidebar layout)

## Screens

- **Adaugă** — category grid → amount (comma or dot) → optional note →
  save. Toast confirms with the new "Buget rămas".
- **Dashboard** — hero card (rămas / disponibil / cheltuit + progress),
  every category with proportional bars, period switcher.
- **Istoric** — transactions per period, grouped by category with
  subtotals or chronological; add/edit/delete, including past periods.
- **Statistici** — monthly trend, savings rate, category deep-dive,
  top 10 expenses, current-period projection and other aggregate facts.
- **Setări** — periods (create next/previous), budgets, month start day,
  categories (rename/reorder/add/archive), export **Excel (.xlsx)** /
  CSV / JSON backup, import JSON backup or the bundled `seed-data.json`.

## Development

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build to dist/
npm run preview    # serve the production build
```

Without Firebase config the app runs in **local mode** (data in
localStorage, no account) — the full UI works, so you can develop
without any setup. With `.env.local` filled in (see
[.env.example](.env.example)) you get real sign-in and sync.

## Deployment

One-time setup (Firebase project + GitHub repo/secrets/Pages):
follow [SETUP.md](SETUP.md). After that, every push to `main`
auto-deploys via [.github/workflows/deploy.yml](.github/workflows/deploy.yml).

## Data model

Firestore, per user:

```
users/{uid}                    → { settings: { monthStartDay, currency, categories[] } }
users/{uid}/periods/{YYYY-MM}  → { name, start, end, budgetAvailable, transactions[] }
```

A period runs from the configured start day (default 7, salary day) to
the same day of the next month. "Buget cheltuit" includes every category,
savings and credit-card payments included — matching the original
Google Sheet. The reducer in [src/state.ts](src/state.ts) owns all state
transitions; storage adapters ([src/data](src/data)) mirror them to
Firestore or localStorage.
