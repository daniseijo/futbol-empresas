# 06 · Sharing and SEO

## Why

League results are shared constantly in company WhatsApp groups. Today a shared link shows a bare title: no
score, no crest. A good preview ("Imageen Gamhur 2–1 Embat") and a share button make the site the natural thing to
send. Search engines also have no sitemap.

## What to build

1. **Open Graph images** (1200×630) generated per page:
   - Match (`/partidos/[id]`): both crests, names, the score (or the kick-off date and time for an upcoming match),
     competition, group and round, venue. Coral accent, Barlow Condensed numbers, like the site.
   - Team (`/equipos/[slug]` and its tabs): crest, name, group, position and points, last results as V/E/D.
   - Default image for the rest of the site: the logo square and "Futbolempresas".
2. **Metadata:** `metadataBase` in the root layout, from a `NEXT_PUBLIC_SITE_URL` variable (production is
   `https://futbol-empresas.vercel.app` unless a domain is added; add the variable to `.env.example`). Match pages
   get a description like "Liga Apertura · Grupo 20 · Jornada 4 · RUPE Rodríguez Sahagún"; team pages
   "9º del Grupo 20 · Liga Apertura 26/27".
3. **Share button** on match and team pages: the Web Share API (`navigator.share`) where available, otherwise copy
   the link to the clipboard with a short "Enlace copiado" confirmation. A client component in the site's style
   (rounded, `border-line`, an inline share icon), with a real `<button>` and an `aria-label`.
4. **`sitemap.xml` and `robots.txt`:** the home page, competitions, every team, current-season matches and
   players with a name. That is thousands of URLs: use `generateSitemaps` to split by type if the docs recommend it.

## How

- Read first: `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/opengraph-image.md`,
  `sitemap.md`, `robots.md`, and the `ImageResponse` reference. Use the `opengraph-image.tsx` file convention next
  to each `page.tsx`.
- `ImageResponse` needs the fonts as data: load Barlow Condensed and Inter (`.ttf` from Google Fonts, or files
  committed under `src/app/fonts/`) with `fetch` or `readFile`, as the docs show.
- Crests are remote images (league WordPress). Fetch them inside the image route and fall back to the initials
  shape (like `Crest`) when they fail. Keep the generation fast; it reads the same cached views as the pages
  (`getMatchPageData`, `getTeamPageData`).
- The images change when a score arrives: make sure they are cached with the same lifetime as match data and
  revalidated by the sync's tag (`DATA_TAG`), not cached forever.
- The share button must not shift layout: put it in the match header and the team header.
- Players with private profiles have no name: leave them out of the sitemap.

## Done when

- Pasting a match URL into a link preview tool (or `curl` the `og:image` URL) shows the generated image with the
  real score; an upcoming match shows its date and time; same for a team.
- `/sitemap.xml` (or its index) and `/robots.txt` respond and list the expected URLs.
- The share button opens the native sheet on a phone and copies the link on desktop.
- Lint and types pass.
