# DGTL Project Network — deploy

Static site. Deploy the contents of this folder to any static host (Netlify, Vercel, S3, nginx).

## Files
- `index.html` — the app (open via a web server, not file://)
- `support.js` — runtime (required, do not edit)
- `projects-data.js` — **edit this to add/change projects** (see comments inside)
- `image-slot.js` — image-slot component
- `standalone.html` — single-file offline copy (everything inlined; opens with a double-click)

## Deploy
Drag this folder into Netlify, or:
```
netlify deploy --dir . --prod
```

## Editing projects
Edit `projects-data.js` by hand, or use the in-app Admin panel (gear icon / press **A**),
then click **Export data file** and replace `projects-data.js` with the download.

## Note
`index.html` must be served over HTTP(S) — opening it directly from disk (file://)
will not load `support.js`. For a double-click / email copy, use `standalone.html`.
