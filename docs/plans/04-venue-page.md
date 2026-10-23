# 04 · Venue page

## Why

Venues appear everywhere (match cards, the featured match, the preview's "Cómo llegar", the team header "Juega
en RUPE Rodríguez Sahagún") but have no page. Players want to know where a venue is, how to get there and what
is on there tonight.

## What to build

- **`/campos/[id]`**, `id` being the API's venue id (stable; names change). Contents:
  - Name as the title, address, a map and "Cómo llegar" (`mapsUrl(venue)`).
  - **Matches there on the next date with matches at this venue** (or today), grouped by time, each linking to its
    match; the focus team's highlighted.
  - The rest of this season's schedule at the venue, compact: upcoming first, then recent results.
  - Teams that play there most this season (top 5 to 8 by matches), linking to their pages.
- **`/campos`**, a simple index of all venues (name, address, matches this season), sorted by name.
- **Links:** make the venue name a link wherever it is shown: the featured match (`src/components/featured-match.tsx`),
  the day strip on the home page, the match page's "El campo" card (`src/app/partidos/[id]/page.tsx`), and the team
  header (`src/components/team/team-header.tsx`). Keep "Cómo llegar" pointing to Google Maps.

## How

- **Data:** venues are a static list in `src/lib/sportspress/venues.ts` (21 venues with address, `lat`, `lng`; one
  without an address). `getVenue(id)` returns `null` for unknown ids: those pages are `notFound()`. Matches come
  from `getSeasonMatches(season.id)` filtered by `venueId`; write a view `getVenuePageData(id)` in
  `src/lib/views/venue.ts` (`"use cache"`, `cacheLife("results")`).
- **Map without API keys:** an OpenStreetMap embed,
  `https://www.openstreetmap.org/export/embed.html?bbox=<lng-0.004>,<lat-0.0025>,<lng+0.004>,<lat+0.0025>&layer=mapnik&marker=<lat>,<lng>`,
  in an `<iframe>` with a `title`, `loading="lazy"`, rounded like the cards and about 280 px tall. For the venue
  without coordinates, show only the address line and the Maps link. Check that the site's headers or CSP (if any)
  allow the iframe.
- **Static params:** `generateStaticParams` can return all venue ids (there are 21).
- **Metadata:** title "<venue name> · Campos".
- **Nav:** consider adding "Campos" to the main nav (`src/components/main-nav.tsx`) only if it fits at 390 px;
  otherwise the links above are enough.

## Done when

- `/campos/644` (RUPE Rodríguez Sahagún) shows the map, the next matches there and the season schedule;
  `/campos/112` (no address) still looks right; `/campos/99999` is a 404.
- `/campos` lists every venue.
- Venue names are links in the four places above.
- Lint and types pass; screenshots at 1280 and 390 px look right.
