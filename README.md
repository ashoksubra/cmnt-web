# CMNT Web (Path A)

Web-hosted Carnatic Music Notation Toolkit: TypeScript core, SVG score rendering, and CSS-variable theming with school presets.

The desktop JAR under `~/Desktop/Development/CMNT` remains the reference implementation until this port reaches parity.

## Status

**Iteration 1** — TypeScript core foundations + golden layout tests (in progress).

| Iter | Focus | Status |
|------|--------|--------|
| 1 | Parse + layout parity vs JAR goldens | current |
| 2 | SVG score renderer | next |
| 3 | Web editor shell | planned |
| 4 | CSS themes + school presets | planned |
| 5 | Playback, export, hosting | planned |

## Setup

```bash
npm install
npm test
npm run typecheck
```

## Public site

Songs stay on each visitor’s computer. **File → Open** / **File → Save** use the browser folder picker (Chrome/Edge) or a download (Firefox/Safari). Nothing is uploaded.

| Host | URL |
|------|-----|
| GitHub Pages | https://ashoksubra.github.io/cmnt-web/ |
| Cloudflare Pages | https://cmnt-web.pages.dev/ (after first deploy) |

Push to `main` deploys both. GitHub Pages needs no extra secrets. Cloudflare Pages needs repo secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`, or a one-shot:

```bash
npx wrangler login
./scripts/deploy-cloudflare.sh
```

## GitHub

Remote: `https://github.com/ashoksubra/cmnt-web`

A Cursor stop-hook prompts for a clean commit + push when local commits are ahead of `origin`.

## Reference

Java source of truth (do not edit from this repo):

`../CMNT/CMNT-Notation-Studio-source/src/cmnt/`
