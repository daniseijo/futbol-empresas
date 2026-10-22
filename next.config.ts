import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Perfiles de caché de las lecturas de la base de datos (src/lib/data.ts).
  // Además, la sincronización invalida la etiqueta "datos" al terminar.
  cacheLife: {
    // Resultados, calendario y clasificaciones: cambian en día de partido.
    resultados: { stale: 60, revalidate: 300, expire: 86400 },
    // Equipos, competiciones y campos: cambian pocas veces por semana.
    catalogo: { stale: 300, revalidate: 3600, expire: 604800 },
  },
  images: {
    // sharp no se compila en este entorno (pnpm allowBuilds); las imágenes
    // de la liga ya vienen en tamaños pequeños, así que no las optimizamos.
    unoptimized: true,
    remotePatterns: [
      { protocol: "https", hostname: "www.futbolempresas.es", pathname: "/wp-content/uploads/**" },
      { protocol: "https", hostname: "live.staticflickr.com" },
      { protocol: "https", hostname: "i.ytimg.com" },
    ],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
