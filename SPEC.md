# Buget — Personal Budget Tracker PWA

## Context

The owner (Cristi) currently tracks his monthly budget in a Google Sheet: one worksheet per month, expense categories as columns, each transaction entered manually as a new amount in the category column. Column totals at the bottom feed three summary numbers: **Buget disponibil** (available), **Buget cheltuit** (spent), **Buget ramas** (remaining). This app replaces that workflow with a mobile-first PWA whose core job is: **log a transaction in under 5 seconds, right after paying**.

The app is for a single user, self-hosted as static files. No backend, no accounts, no paid services.

## Tech stack

- **Vite + React + TypeScript** (SPA, static build output)
- No UI framework required; plain CSS or CSS modules. Keep the bundle small.
- **PWA**: web manifest + service worker (use `vite-plugin-pwa`), installable on Android/iOS home screen, works offline.
- **Storage: localStorage** through a single storage module (`src/storage.ts`) that wraps all reads/writes, so the backend can be swapped later (e.g., Google Sheets sync in v2). Persist the whole app state as one JSON blob under key `buget:v1`. Debounce writes.
- No external network calls at runtime. Everything works offline.

## Data model

```ts
type Category = {
  id: string;          // slug, e.g. "alimente"
  name: string;        // display, e.g. "Alimente"
  order: number;
  archived: boolean;   // hidden from quick-add, kept for history
};

type Transaction = {
  id: string;          // uuid
  categoryId: string;
  amount: number;      // positive, RON
  tags?: string[];     // optional short labels: store, product, brand
  note?: string;       // deprecated single note; migrated to tags on load
  timestamp: string;   // ISO datetime, auto-set at creation, editable
};

type Period = {
  id: string;          // e.g. "2026-06"
  name: string;        // e.g. "Iunie 2026"
  start: string;       // ISO date, e.g. "2026-06-07"
  end: string;         // start of next period (exclusive)
  budgetAvailable: number;  // "Buget disponibil", entered manually per period
  transactions: Transaction[];
};

type Settings = {
  monthStartDay: number;   // default 7 (salary day); periods run 7th -> 7th
  currency: "RON";
  categories: Category[];
};
```

### Default categories (exact order and names, Romanian)

1. Fond economii
2. Rata card de credit
3. Abonamente
4. Combustibil
5. Ocazionale
6. Fast Food
7. Restaurant
8. Alimente
9. Transport
10. Sanatate
11. Haine
12. Divertisment
13. Igiena

Categories are editable in Settings (rename, reorder, add, archive). Never hard-delete a category that has transactions; archive instead.

## Business rules

- A **period** runs from `monthStartDay` of one month to `monthStartDay` of the next (e.g., 07.06.2026 – 07.07.2026). Period naming uses the month the period starts in ("Iunie 2026").
- **Buget cheltuit** = sum of ALL transactions in the period, **including** "Fond economii" and "Rata card de credit". This matches the existing sheet: savings and credit card payments count as money that left the budget.
- **Buget ramas** = budgetAvailable − buget cheltuit. Show it in red if negative.
- On app open, if today falls outside the latest period, auto-create the new period (budgetAvailable = 0 until the user sets it; show a gentle prompt to set it).
- Adding a transaction defaults to the current period and current timestamp. Amounts use comma or dot as decimal separator on input; normalize to number.
- Number display: Romanian format, e.g. `1.234,56 lei`.

## Screens

UI language: **Romanian**. Keep copy short and plain ("Adaugă", "Salvează", "Șterge", "Buget rămas").

### 1. Adaugă (default screen)
The 5-second flow. A grid of category buttons (non-archived, in order). Tap category → numeric keypad-friendly amount input (`inputmode="decimal"`) → optional tags (Enter/comma adds a tag; suggestions from history) → "Salvează". After save: brief confirmation toast showing category + amount + new "Buget ramas", then reset for the next entry. This screen must be usable one-handed on a phone.

### 2. Dashboard
Current period at a glance: the three numbers (disponibil / cheltuit / ramas) prominent at top, then per-category totals for the period as a list with amounts and a simple horizontal bar proportional to spend. Period switcher (‹ Mai 2026 ›) to browse history. Tapping a category opens its transactions for that period.

### 3. Istoric (transactions)
Reverse-chronological list for the selected period: date, category, amount, tags. Swipe or tap to edit/delete a transaction (edit: amount, category, tags, timestamp). Deleting asks for confirmation. A chip row of the period's tags (biggest spend first) filters the list by tag and shows the tag's total for the period. Statistici has a per-tag spending card: search a tag, pick a month or all-time, see total and transaction count (savings excluded).

### 4. Setări
- budgetAvailable for the current period (and past periods, editable)
- monthStartDay
- category management (rename, reorder, add, archive)
- **Export**: full JSON backup; CSV per period (columns matching the old sheet layout)
- **Import**: JSON backup restore, and first-run import of `seed-data.json` (see below)

## Seed data

`seed-data.json` (in this folder) contains the complete history migrated from the Google Sheet: 6 periods (Ianuarie–Iunie 2026), 300 transactions, verified to match the sheet's per-category and grand totals to the cent. Format:

```json
{
  "monthStartDay": 7,
  "currency": "RON",
  "categories": ["Fond economii", "..."],
  "periods": [
    {
      "name": "Iunie",
      "start": "2026-06-07",
      "budgetAvailable": 7895.68,
      "transactions": [ { "category": "Abonamente", "amount": 195.94 }, ... ]
    }
  ]
}
```

Migrated transactions have **no timestamps** (the sheet didn't store them). On import, assign each one the period's start date and preserve their original order. The importer maps category display names to category ids.

On first run with empty storage, offer a one-tap "Importă istoricul din Google Sheets (seed-data.json)" — bundle the file with the app so no file picker is needed, but also support importing a JSON backup from a file.

Known quirk from the source sheet: the "Iunie" worksheet's period label was a copy-paste leftover ("07.05.2026 - 07.06.2026"); the seed file already uses the corrected start `2026-06-07`.

## Non-functional requirements

- Mobile-first (design at 380px width, scale up gracefully to desktop).
- Installable PWA: valid manifest (name "Buget", Romanian locale, standalone display, theme color), icons 192/512 (generate simple ones — a lei/wallet glyph is fine), offline-capable via precached app shell.
- No data leaves the device. State survives refresh and app restarts.
- Visible keyboard focus, `prefers-reduced-motion` respected.
- Lighthouse PWA installability check passes.

## Verification checklist (do these before calling it done)

1. `npm run build` succeeds; preview the production build.
2. Import seed data, then verify against these exact totals (Buget cheltuit per period): Ianuarie **5782.19**, Februarie **4299.86**, Martie **5421.88**, Aprilie **6777.57**, Mai **3370.32**, Iunie **3063.98**. Iunie per-category spot check: Alimente 819.40, Ocazionale 740.00, Fast Food 341.00.
3. Add a transaction → appears in Istoric, Dashboard totals update, Buget ramas recalculates.
4. Edit and delete a transaction → totals update.
5. Reload the page → all data still there.
6. Export JSON, wipe localStorage, import the JSON → identical state.
7. CSV export of Iunie opens correctly in Excel with Romanian amounts.
8. Simulate a date after the current period's end → new period auto-created, prompt to set budgetAvailable.

## Out of scope for v1 (do not build now)

- Google Sheets sync, cloud backup, multi-device sync
- Authentication
- Charts beyond the simple category bars
- Budgets/limits per category, notifications

## Deployment

Static output (`dist/`) deployable anywhere: Vercel/Netlify/Cloudflare Pages free tier, or classic shared hosting via FTP (e.g., a subdomain like buget.galateanu.ro). HTTPS is required for PWA install. Add a short DEPLOY.md with both options.
