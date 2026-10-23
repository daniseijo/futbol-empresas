export const siteConfig = {
  name: "Futbolempresas",
  description: "La liga de fútbol 7 entre empresas de Madrid: resultados, clasificaciones y equipos.",
  /**
   * The site's focus team. Highlighted on the home page and the target of
   * "Tu equipo". Set NEXT_PUBLIC_FOCUS_TEAM_SLUG to change it.
   */
  focusTeamSlug: process.env.NEXT_PUBLIC_FOCUS_TEAM_SLUG ?? "embat",
  apiBase: "https://www.futbolempresas.es/wp-json",
  sourceSite: "https://www.futbolempresas.es",
  youtubeChannel: "https://www.youtube.com/@Futbolempresas",
  timeZone: "Europe/Madrid",
} as const;
