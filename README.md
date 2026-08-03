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

## GitHub

Remote: `https://github.com/ashoksubra/cmnt-web`

A Cursor stop-hook prompts for a clean commit + push when local commits are ahead of `origin`.

## Reference

Java source of truth (do not edit from this repo):

`../CMNT/CMNT-Notation-Studio-source/src/cmnt/`
