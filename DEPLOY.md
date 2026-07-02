# Deploying Buget

The app deploys automatically: every push to `main` runs
[.github/workflows/deploy.yml](.github/workflows/deploy.yml), which
builds the site (injecting the Firebase config from repo secrets) and
publishes `dist/` to GitHub Pages at
`https://<username>.github.io/budget-tracker/`.

One-time prerequisites (Firebase project, repo secrets, enabling Pages)
are in [SETUP.md](SETUP.md).

## Manual redeploy

*Actions* tab → *Deploy to GitHub Pages* → *Run workflow*.

## Renaming the repo

GitHub Pages serves project sites under `/<repo-name>/`. If the repo
isn't `budget-tracker`, change `BASE_PATH` in the workflow accordingly.

## Custom domain (optional, later)

Repo *Settings → Pages → Custom domain* (e.g. `buget.galateanu.ro`),
add the CNAME record it asks for at your DNS provider, then:

1. Set `BASE_PATH=/` in the workflow (custom domains serve from the root).
2. Add the domain to Firebase *Authentication → Authorized domains*.

## Alternative hosts

The build is fully static, so `dist/` also works on Netlify, Vercel or
Cloudflare Pages — set the four `VITE_FIREBASE_*` env vars and
`BASE_PATH=/` in that host's build settings, and add the host's domain
to Firebase authorized domains.
