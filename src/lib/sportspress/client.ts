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

// League API client. Only the sync uses it (src/sync), never rendering: these
// module-level queues cannot be used inside "use cache".
// The API answers a single request in ~200 ms, but with several at once each
// one climbs to 5-7 s, and its heaviest calls (pages of matches with
// `content`) are already close to a 504. The website's pages take ~13 s each
// (Oct 2026) but stay nearly that fast with 6 at once.
function slots(max: number) {
  let active = 0;
  const waiting: (() => void)[] = [];
  return async function withSlot<T>(task: () => Promise<T>): Promise<T> {
    if (active >= max) await new Promise<void>((resolve) => waiting.push(resolve));
    active += 1;
    try {
      return await task();
    } finally {
      active -= 1;
      waiting.shift()?.();
    }
  };
}

/** Requests at once to the REST API. */
const API_CONCURRENCY = 2;
/** Requests at once to the website's pages (for data the API lacks). */
export const PAGE_CONCURRENCY = 6;
const apiSlot = slots(API_CONCURRENCY);
const pageSlot = slots(PAGE_CONCURRENCY);

/** Waits before retrying: the server returns 502/503/504 under load. */
const RETRY_DELAYS_MS = [3_000, 10_000, 30_000];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export interface RequestOptions {
  /**
   * Fail as soon as a 500 arrives, without retrying. 502/503/504 mean the
   * server is busy and are always retried; a 500 while rendering a match's
   * `content` is permanent, and retrying it only costs 43 s.
   */
  failFastOn500?: boolean;
}

/** Request to the league server with a concurrency limit and retries. */
async function request(
  url: string,
  accept: string,
  withSlot: <T>(task: () => Promise<T>) => Promise<T>,
  { failFastOn500 = false }: RequestOptions = {},
): Promise<Response> {
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
    const retryable = !res || (res.status >= 500 && !(failFastOn500 && res.status === 500)) || res.status === 429;
    if (!retryable || attempt >= RETRY_DELAYS_MS.length) {
      throw new SportsPressError(`SportsPress ${res?.status ?? "no response"} at ${url}`, res?.status ?? 0, url);
    }
    await sleep(RETRY_DELAYS_MS[attempt]);
  }
}

/** One page of a WordPress/SportsPress REST API collection. */
export async function getPage<T>(path: string, params: Params = {}, options?: RequestOptions): Promise<Page<T>> {
  const res = await request(buildUrl(path, params), "application/json", apiSlot, options);
  const items = (await res.json()) as T[];
  return {
    items,
    total: Number(res.headers.get("x-wp-total") ?? items.length),
    totalPages: Number(res.headers.get("x-wp-totalpages") ?? 1),
  };
}

/** HTML of a league website page (for data the API does not expose). */
export async function getHtml(path: string): Promise<string> {
  const res = await request(`${siteConfig.sourceSite}${path}`, "text/html", pageSlot);
  return res.text();
}

/**
 * Walks every page of a collection (100 items per page unless another
 * `per_page` is given; requests with `content` should be smaller, or the
 * server cuts them off with a 504). Sorted by id so pagination stays stable
 * even if items are added while walking it.
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
