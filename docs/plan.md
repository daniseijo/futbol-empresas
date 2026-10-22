# Plan

Lo que queda por hacer, por orden de prioridad. Cada bloque es independiente.

## 1. Terminar la carga de datos

Estado (22/10/2026): temporada 26/27 completa (partidos, plantillas, vídeos), 25/26 completa, 24/25 a medias (página 13), 23/24 y 22/23 sin empezar.

- [ ] Dejar correr `pnpm sync` hasta que diga «Todo al día». Es reanudable: se puede cortar y relanzar.
- [x] ~~Nombres de jugadores con ficha privada~~: no se pueden sacar. La liga los oculta en todas partes: la API da 404, no salen en el acta de la web ni en las listas de plantilla, y su ficha web da 404. Solo queda su id en el acta de la API, así que la web los muestra por su dorsal («Dorsal 7»).
- [ ] Vídeos de temporadas pasadas: la tarea «Vídeos (histórico)» va al final de la cola; revisar cuántos encuentra.

## 2. Despliegue (Vercel + Turso + GitHub Actions)

Ver los pasos en el README. Pendiente de decidir cuándo.

- [ ] Crear la base de datos en Turso e importar la local (`turso db import futbolempresas.db`, con una copia hecha con `.backup` y en modo WAL; ver el README).
- [ ] Conectar el repositorio a Vercel con `DATABASE_URL`, `DATABASE_AUTH_TOKEN` y `REVALIDATE_SECRET`.
- [ ] Secretos de GitHub para la acción de sincronización y comprobar la primera ejecución programada.
- [ ] Comprobar los minutos de GitHub Actions del primer mes (repositorio privado: 2.000 gratis).

## 3. Páginas nuevas

- [x] **Grupo / competición** (`/competiciones/...`): clasificación, jornadas navegables, pichichi y Crack del grupo, enlazada desde la portada, la ficha de partido y la clasificación del equipo.
  - [ ] Copas sin grupos (Corporate Cup): ahora salen con una clasificación de todos sus equipos; mejor un cuadro o una lista de eliminatorias.
- [x] **Jugador** (`/jugadores/[id]`): partidos, goles con minuto, MVP, equipos por temporada y foto, enlazada desde alineaciones, pichichi, Crack, plantilla y líderes del equipo.
- [ ] **Campo** (`/campos/[id]`): mapa, dirección y partidos de hoy en ese campo.
- [ ] **Liga femenina**: revisar que portada y equipos funcionan bien con sus competiciones.

## 4. Mejoras de lo que ya existe

- [ ] Portada: si hoy no hay partidos, mostrar la próxima jornada y los últimos resultados en lugar de «0 partidos».
- [ ] Ficha de partido: alineaciones en formato campo (opcional).
- [ ] Equipo: botón «Compartir» con el estilo de la web.
- [ ] Buscador: buscar también jugadores (`players?search=`).
- [ ] SEO: `sitemap.xml`, imágenes Open Graph por partido y equipo.
- [ ] Página 404 real: ahora responde 200 porque el contenido va en streaming. En desarrollo, la primera carga de un 404 a veces da «cannot have a negative time stamp» en `performance.measure` (de React, no de la web).

## 5. Calidad

- [ ] Tests unitarios de `parse.ts` (títulos, goles con minuto, shortcodes), `standings.ts` y la asociación de vídeos.
- [ ] Test de extremo a extremo de la sincronización contra respuestas grabadas de la API.
- [ ] Revisión de accesibilidad (contraste del coral sobre blanco, foco, lectores de pantalla en la línea de tiempo).
- [ ] Avisos si la sincronización falla (por ejemplo, notificación desde GitHub Actions).

## Datos raros de la API ya conocidos

- Partidos con resultado y `status: future` (se tratan como jugados).
- Títulos que nombran a otro equipo («Roche Pharma» cuando juega Roche Femenino): el nombre sale del equipo enlazado.
- Un mismo jugador en las dos alineaciones de un partido (portera de la liga femenina): se guardan las dos filas.
- `position` del acta a veces es un texto o un objeto en lugar de una lista.
- Peticiones con `content` de varios equipos dan 504; `/players` tarda más de 10 s; `_embed` es muy lento.
