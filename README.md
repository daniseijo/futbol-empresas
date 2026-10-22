# Futbolempresas

Web no oficial de la liga de fútbol 7 entre empresas de Madrid, construida sobre la API
pública de [futbolempresas.es](https://www.futbolempresas.es) (WordPress + SportsPress v2).
Está centrada en un equipo principal (Embat por defecto), pero se puede consultar cualquier equipo.

## Cómo funciona

```
API de la liga ──pnpm sync──▶ base de datos propia (SQLite / Turso) ──▶ páginas Next.js
   (lenta)        (GitHub Actions)                                      (solo leen de la BD)
```

La API de la liga es lenta (de 0,2 a 12 s por llamada) y se satura con peticiones en paralelo.
Por eso la web **nunca la llama al renderizar**: una sincronización copia los datos a una base
de datos propia y las páginas leen de ella en milisegundos.

## Arrancar en local

```bash
pnpm install
pnpm sync    # descarga los datos a data/futbol.db (la primera vez tarda horas; es reanudable)
pnpm dev     # http://localhost:3000
```

La sincronización es **progresiva y reanudable**: va por prioridad (temporada actual, equipo principal y su
grupo, plantillas, vídeos, temporadas pasadas) y guarda el avance tras cada página o equipo. Se puede cortar
con Ctrl+C y relanzar cuando se quiera; también trae primero lo modificado desde la última vez.

```bash
pnpm sync                         # sigue donde se quedó
pnpm sync -- --budget=600         # para a los 10 minutos (lo usa GitHub Actions)
pnpm sync -- --partidos=104101    # vuelve a descargar partidos concretos
pnpm sync:reset                   # vuelve a descargar todo desde cero
```

Variables de entorno: ver `.env.example`. Sin `DATABASE_URL` se usa el fichero local `data/futbol.db`.

## Copiar la base de datos a otro equipo

`data/futbol.db` **no se sube al repositorio**: es una copia de datos de terceros (con nombres y fotos de
jugadores), se puede regenerar con `pnpm sync` y cambia constantemente. Para llevarla a otro equipo sin esperar
a la sincronización:

```bash
# Con la sincronización y la web paradas, saca una copia consistente en un solo fichero
# (en local se usa el modo WAL, así que no basta con copiar futbol.db a secas).
sqlite3 data/futbol.db ".backup futbol-copia.db"
```

Pasa `futbol-copia.db` por AirDrop, Drive, etc., guárdalo como `data/futbol.db` en el otro equipo y lanza
`pnpm sync`: seguirá desde donde se quedó, porque el estado de la carga va dentro de la propia base de datos.

## Desplegar (Vercel + Turso + GitHub Actions)

1. **Base de datos en Turso, con la carga ya hecha en local:** saca una copia consistente
   (`sqlite3 data/futbol.db ".backup futbolempresas.db"`), déjala en modo WAL con el registro volcado
   (`sqlite3 futbolempresas.db "PRAGMA journal_mode=wal; PRAGMA wal_checkpoint(truncate);"`) e impórtala con
   `turso db import futbolempresas.db` (la base de datos toma el nombre del fichero). Después, crea el token con
   `turso db tokens create futbolempresas` y saca la URL con `turso db show futbolempresas --url`.
2. **Sin carga local:** `turso db create futbolempresas` crea una vacía; la acción de GitHub la irá rellenando, pero
   tarda días y gasta muchos minutos de Actions.
3. **Vercel:** importa el repositorio y define `DATABASE_URL`, `DATABASE_AUTH_TOKEN`, `REVALIDATE_SECRET`
   y, si quieres otro equipo principal, `NEXT_PUBLIC_FOCUS_TEAM_SLUG`.
4. **GitHub:** en *Settings › Secrets and variables › Actions*, crea los secretos `DATABASE_URL`,
   `DATABASE_AUTH_TOKEN`, `REVALIDATE_SECRET` (el mismo que en Vercel) y `REVALIDATE_URL`
   (`https://<dominio>/api/revalidate`), y la variable `SYNC_ENABLED=true`. Sin esa variable la acción
   programada no se ejecuta (así no gasta minutos ni carga la API mientras no hay base de datos remota).

La acción `.github/workflows/sync.yml` sincroniza cada 20 minutos las noches de partido (lunes a viernes)
y cada 3 horas el resto (15 minutos como máximo por ejecución), y al terminar llama a `/api/revalidate` para
que la web refresque su caché.

## Páginas

- `/`: portada con los partidos del día, el bloque del equipo principal, las competiciones de la temporada,
  los líderes de cada grupo, el pichichi y las goleadas de la semana.
- `/equipos/[slug]`: equipo, con pestañas que son rutas propias: resumen, `partidos` (próximos y jugados),
  `clasificacion`, `plantilla` (por posición o por valor) e `historial` (temporadas pasadas).
- `/competiciones/[...ruta]`: competición, fase o grupo (`/competiciones/liga-apertura/fase-1/grupo-20`), con la
  ruta sacada de los nombres. Muestra sus grupos con el líder, la clasificación, las jornadas (`?jornada=`), el pichichi
  y el Crack. Las temporadas pasadas se piden con `?temporada=25-26`.
- `/jugadores/[id]`: jugador, con totales, partidos (goles con minuto, asistencias, MVP) y equipos por temporada, sacados
  de las actas. Los de ficha privada salen por su dorsal hasta que se cargue su nombre.
- `/partidos/[id]`: ficha de partido con marcador, línea de tiempo de goles, resumen en vídeo, MVP,
  alineaciones, estadísticas, cara a cara, resto de la jornada y campo; o la previa si aún no se ha jugado.

## Estructura

```
src/
  config/site.ts         equipo principal, URL de la API, zona horaria
  db/                    esquema Drizzle (SQLite) y cliente libSQL
  sync/                  sincronización API → base de datos (fetch.ts descarga, run.ts guarda)
  lib/data.ts            lecturas de la base de datos para las páginas ("use cache")
  lib/views/             datos ya calculados para cada página
  lib/sportspress/       cliente de la API, parsers y tipos de dominio
  lib/standings.ts       clasificación calculada a partir de los partidos
  app/api/revalidate     endpoint que llama la sincronización al terminar
scripts/sync.ts          `pnpm sync` (ver opciones arriba)
drizzle/                 migraciones (se generan con `pnpm db:generate`)
```

## Cosas de la API que conviene saber

- **`/players` es lo más lento** (10 s o más), porque calcula las estadísticas de cada jugador. La plantilla
  sale de las listas del equipo (`/lists`): de la lista «Plantilla» salen las estadísticas, de las listas por
  posición sale la posición y las fotos se piden con `media?parent=`. `_embed` también es muy lento.
- **Sincronización incremental:** `modified_after` devuelve solo lo modificado desde la última vez
  (hora local de Madrid; se pide con una hora de margen).
- **Las clasificaciones de grupo se reutilizan cada temporada.** La web las calcula a partir de los partidos
  (3 puntos por victoria, 1 por empate), lo que sirve también para temporadas pasadas.
- **Un partido con resultado cuenta como jugado**, aunque su `status` sea `future` (resultados administrativos).
- **Fotos de equipo:** son banners en el contenido del equipo. Los `*-CABECERA.jpg` son la plantilla de siluetas
  y se ignoran; en su lugar se usa la última foto de partido (de Flickr).
- **Fotos de jugador:** el avatar genérico no está adjunto a ningún jugador. Sin foto, se muestra el dorsal
  sobre el color de su posición y, si tampoco hay dorsal, las iniciales.
- **Buscador:** `teams?search=…` necesita `search_columns=post_title`, o también busca dentro del HTML.
