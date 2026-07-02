# Setup — Firebase + GitHub Pages

Everything in the code is ready; these are the only steps that need your
accounts. Total time: ~15 minutes, all free.

## A. Firebase (accounts + database) — ~10 min

1. Go to https://console.firebase.google.com → **Add project**.
   Name: `buget` (any name works). Google Analytics: **off**. Create.

2. **Authentication**: in the left menu *Build → Authentication → Get
   started*, tab *Sign-in method*:
   - Enable **Google** (pick your email as support email).
   - Enable **Email/Password** (first toggle only).

3. **Firestore**: *Build → Firestore Database → Create database* →
   **Production mode** → location: `europe-west1` (or `eur3`). Create.

4. **Security rules**: in Firestore, tab *Rules* → replace everything with
   the contents of [firestore.rules](firestore.rules) from this repo →
   **Publish**. This is what makes each account's data private.

5. **Web app config**: gear icon → *Project settings* → section *Your
   apps* → click the `</>` (Web) icon → nickname `Buget`, do NOT tick
   Firebase Hosting → *Register app*. Copy the 4 values shown:
   `apiKey`, `authDomain`, `projectId`, `appId`.

6. **Authorized domains**: *Authentication → Settings → Authorized
   domains* → *Add domain* → `<your-github-username>.github.io`.
   (`localhost` is already in the list, for development.)

7. **Local dev config**: in the project folder, copy `.env.example` to
   `.env.local` and paste the 4 values. Then `npm run dev` runs with real
   sign-in and sync. Without `.env.local` the app falls back to
   local-only mode (no account, data on device) — handy but not required.

## B. GitHub repo + Pages — ~5 min

1. On https://github.com/new create a **public** repo named
   **`budget-tracker`** (no README/gitignore — the project already has
   them). If you pick another name, also change `BASE_PATH` in
   [.github/workflows/deploy.yml](.github/workflows/deploy.yml).

2. **Secrets** (before the first push): repo *Settings → Secrets and
   variables → Actions → New repository secret*, four times:

   | Name | Value |
   |---|---|
   | `VITE_FIREBASE_API_KEY` | apiKey from step A5 |
   | `VITE_FIREBASE_AUTH_DOMAIN` | authDomain |
   | `VITE_FIREBASE_PROJECT_ID` | projectId |
   | `VITE_FIREBASE_APP_ID` | appId |

3. **Enable Pages**: repo *Settings → Pages* → Source: **GitHub Actions**.

4. **Push** (from this folder — the code is already committed):

   ```bash
   git remote add origin https://github.com/<your-username>/budget-tracker.git
   git push -u origin main
   ```

5. Watch the *Actions* tab — when the deploy finishes, the app is live at
   `https://<your-username>.github.io/budget-tracker/`.

## C. Phone

Open the URL → sign in → browser menu → **Add to Home screen** /
**Install app**. After the first load it works offline; entries made
offline sync automatically when you're back online.

## Security notes (public repo)

- No passwords or credentials are in the repo: config lives in
  `.env.local` (gitignored) and GitHub Actions secrets.
- The Firebase values above are **client identifiers**, not secrets —
  they are visible in the deployed site's JS by design. Your data is
  protected by `firestore.rules` (only your signed-in account can read or
  write your documents) plus the authorized-domains list.
