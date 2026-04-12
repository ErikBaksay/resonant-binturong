# Resonant Binturong

Resonant Binturong is a local-first Angular app for mind programming through repetition. You create statements, group them into categories, define default repetition counts, optionally attach reminder times, and then complete focused writing sessions directly in the browser.

## What it does

- Stores everything in `localStorage`, so no backend is required.
- Lets you organize statements into categories.
- Supports a default repetition count plus one-off custom counts when starting a session.
- Provides scheduled reminder times with a blocking in-app prompt when a reminder is due.
- Keeps lightweight stats such as total completed sessions, total repetitions written, and a simple streak.
- Includes GitHub Pages deployment via GitHub Actions.

## Important browser limits

- The app can block interaction inside the app itself until a due session is completed.
- A GitHub Pages web app cannot truly stop someone from closing the browser or leaving the tab at the device level.
- Browser notifications only work when permission is granted, and static apps cannot guarantee rich background reminder behavior on every tablet/browser combination.

## Local development

```bash
npm install
npm start
```

The app runs at `http://localhost:4200/`.

## Quality checks

```bash
npm run build
npm run test:ci
```

## GitHub Pages

The repository includes `.github/workflows/deploy.yml`, which builds and deploys the app to GitHub Pages on pushes to `main`.

If GitHub Pages is enabled for the repository:

1. Set the Pages source to `GitHub Actions`.
2. Push to `main`.
3. The workflow will publish the built app using the repository path `/resonant-binturong/`.
4. The site should appear at `https://erikbaksay.github.io/resonant-binturong/` after the workflow finishes successfully.

## Future upgrades worth considering

- Service-worker-based offline caching.
- Richer installable PWA assets.
- Export and import for your local statement library.
- More flexible reminder patterns and completion analytics.
