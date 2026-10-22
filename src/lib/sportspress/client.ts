import { siteConfig } from "@/config/site";

type Params = Record<string, string | number | boolean | undefined | null>;

export class SportsPressError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly url: string,
  ) {
    super(message);
  }
}

function buildUrl(path: string, params: Params): string {
  const url = new URL(`${siteConfig.apiBase}${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    url.searchParams.set(key, String(value));
  }
  return url.toString();
}

export interface Page<T> {
  items: T[];
  total: number;
  totalPages: number;
}

// Cliente de la API de la liga. Solo lo usa la sincronización (src/sync), nunca
// el render: esta cola a nivel de módulo no puede usarse dentro de "use cache".
// El servidor responde en ~200 ms a una petición suelta, pero con varias a la
// vez cada una sube a 5-7 s, así que limitamos la concurrencia.
const MAX_CONCURRENT = 2;
let active = 0;
const waiting: (() => void)[] = [];

async function withSlot<T>(task: () => Promise<T>): Promise<T> {
  if (active >= MAX_CONCURRENT) await new Promise<void>((resolve) => waiting.push(resolve));
  active += 1;
  try {
    return await task();
  } finally {
    active -= 1;
    waiting.shift()?.();
  }
}

/** Esperas antes de reintentar: el servidor da 502/503/504 cuando va cargado. */
const RETRY_DELAYS_MS = [3_000, 10_000, 30_000];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Petición al servidor de la liga con límite de concurrencia y reintentos. */
async function request(url: string, accept: string): Promise<Response> {
  for (let attempt = 0; ; attempt += 1) {
    const t0 = Date.now();
    let res: Response | null = null;
    try {
      res = await withSlot(() => fetch(url, { headers: { Accept: accept } }));
    } catch (error) {
      if (attempt >= RETRY_DELAYS_MS.length) throw error;
    }
    if (process.env.SP_DEBUG) console.log(`[sp] ${res?.status ?? "error"} ${Date.now() - t0}ms ${url.slice(30, 160)}`);
    if (res?.ok) return res;
    const retryable = !res || res.status >= 500 || res.status === 429;
    if (!retryable || attempt >= RETRY_DELAYS_MS.length) {
      throw new SportsPressError(`SportsPress ${res?.status ?? "sin respuesta"} en ${url}`, res?.status ?? 0, url);
    }
    await sleep(RETRY_DELAYS_MS[attempt]);
  }
}

/** Una página de una colección de la API REST de WordPress/SportsPress. */
export async function getPage<T>(path: string, params: Params = {}): Promise<Page<T>> {
  const res = await request(buildUrl(path, params), "application/json");
  const items = (await res.json()) as T[];
  return {
    items,
    total: Number(res.headers.get("x-wp-total") ?? items.length),
    totalPages: Number(res.headers.get("x-wp-totalpages") ?? 1),
  };
}

/** HTML de una página de la web de la liga (para datos que la API no expone). */
export async function getHtml(path: string): Promise<string> {
  const res = await request(`${siteConfig.sourceSite}${path}`, "text/html");
  return res.text();
}

/**
 * Recorre todas las páginas de una colección (100 elementos por página salvo
 * que se pida otro `per_page`; las peticiones con `content` conviene hacerlas
 * más pequeñas, o el servidor corta con un 504). Ordena por id para que la
 * paginación sea estable aunque se añadan elementos mientras se recorre.
 */
export async function getAll<T extends { id: number }>(path: string, params: Params = {}): Promise<T[]> {
  const base = { orderby: "id", order: "asc", per_page: 100, ...params };
  const first = await getPage<T>(path, { ...base, page: 1 });
  const rest = await Promise.all(
    Array.from({ length: Math.max(0, first.totalPages - 1) }, (_, i) => getPage<T>(path, { ...base, page: i + 2 })),
  );
  const byId = new Map<number, T>();
  for (const item of [first, ...rest].flatMap((page) => page.items)) byId.set(item.id, item);
  return [...byId.values()];
}
