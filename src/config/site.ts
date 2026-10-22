export const siteConfig = {
  name: "Futbolempresas",
  description: "La liga de fútbol 7 entre empresas de Madrid: resultados, clasificaciones y equipos.",
  /**
   * Equipo principal de la web. Se destaca en la portada y es el destino de
   * «Tu equipo». Para cambiarlo basta con NEXT_PUBLIC_FOCUS_TEAM_SLUG.
   */
  focusTeamSlug: process.env.NEXT_PUBLIC_FOCUS_TEAM_SLUG ?? "embat",
  apiBase: "https://www.futbolempresas.es/wp-json",
  sourceSite: "https://www.futbolempresas.es",
  youtubeChannel: "https://www.youtube.com/@Futbolempresas",
  timeZone: "Europe/Madrid",
} as const;
