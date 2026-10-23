// The cron-job.org job that starts the sync on match nights, kept as code.
// GitHub's own schedule starts runs late or drops them on busy hours, so
// cron-job.org calls the workflow_dispatch API instead (see the README).
//
// Usage (reads CRONJOB_API_KEY from .env.local):
//   pnpm cron-job                 status: the job, its last runs and the next ones
//   pnpm cron-job diff            what `apply` would change
//   pnpm cron-job apply           makes the job match JOB below (creates it if missing)
//
// The GitHub token (fine-grained, Actions: read and write on this repository) is
// not in the repository: `apply` keeps the one the job already has, or sets
// GITHUB_DISPATCH_TOKEN if given. Output never shows it.

import { nowInMadrid } from "@/lib/dates";

const API = "https://api.cron-job.org";
const REPOSITORY = "daniseijo/futbol-empresas";
const AUTH_HEADER = "Authorization";

/** The fields of the job this script owns. Anything else is left as it is. */
const JOB = {
  title: "futbol-empresas sync",
  enabled: true,
  saveResponses: true,
  url: `https://api.github.com/repos/${REPOSITORY}/actions/workflows/sync.yml/dispatches`,
  requestMethod: 1, // POST
  requestTimeout: 30,
  // Matches are Monday to Friday, 19:00 to 23:30 Madrid time.
  schedule: {
    timezone: "Europe/Madrid",
    expiresAt: 0,
    hours: [19, 20, 21, 22, 23],
    minutes: [0, 20, 40],
    wdays: [1, 2, 3, 4, 5],
    mdays: [-1],
    months: [-1],
  },
  // An email when GitHub refuses the call, e.g. 401 once the token expires.
  notification: { onFailure: true, onFailureCount: 1, onSuccess: false, onDisable: true },
  extendedData: {
    headers: {
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
    } as Record<string, string>,
    body: JSON.stringify({ ref: "main" }),
  },
};

type Job = typeof JOB & { jobId: number; lastStatus: number; nextExecution: number | null };

interface HistoryItem {
  identifier: string;
  date: number;
  status: number;
  statusText: string;
  httpStatus: number;
  duration: number;
  type: number;
  body?: string | null;
}

async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  const key = process.env.CRONJOB_API_KEY;
  if (!key) throw new Error("CRONJOB_API_KEY is not set (put it in .env.local)");
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${method} ${path}: ${res.status} ${await res.text()}`);
  const text = await res.text();
  return (text ? JSON.parse(text) : {}) as T;
}

async function findJob(): Promise<Job | null> {
  const { jobs } = await api<{ jobs: { jobId: number; title: string }[] }>("GET", "/jobs");
  const match = jobs.find((job) => job.title === JOB.title);
  if (!match) return null;
  const { jobDetails } = await api<{ jobDetails: Job }>("GET", `/jobs/${match.jobId}`);
  return jobDetails;
}

/** The token is the one secret the job holds: never print it. */
function redact<T>(value: T): T {
  return JSON.parse(JSON.stringify(value), (key, v) => (key === AUTH_HEADER && typeof v === "string" ? "Bearer ***" : v));
}

function stamp(unixSeconds: number): string {
  return nowInMadrid(new Date(unixSeconds * 1000)).replace("T", " ");
}

/** Fields of JOB whose value differs in the live job, as "field: live → wanted". */
function differences(live: Job, wanted: typeof JOB): string[] {
  const changes: string[] = [];
  const compare = (path: string, a: unknown, b: unknown) => {
    if (b !== null && typeof b === "object" && !Array.isArray(b)) {
      for (const key of Object.keys(b)) compare(`${path}.${key}`, (a as Record<string, unknown>)?.[key], (b as Record<string, unknown>)[key]);
    } else if (JSON.stringify(a) !== JSON.stringify(b)) {
      changes.push(`${path.slice(1)}: ${JSON.stringify(a)} → ${JSON.stringify(b)}`);
    }
  };
  compare("", redact(live), redact(wanted));
  return changes;
}

/** JOB plus the authorization header: a new token if given, else the live one. */
function wantedJob(live: Job | null): typeof JOB {
  const token = process.env.GITHUB_DISPATCH_TOKEN;
  const auth = token ? `Bearer ${token}` : live?.extendedData?.headers?.[AUTH_HEADER];
  if (!auth) throw new Error("The job has no GitHub token yet: set GITHUB_DISPATCH_TOKEN");
  return { ...JOB, extendedData: { ...JOB.extendedData, headers: { ...JOB.extendedData.headers, [AUTH_HEADER]: auth } } };
}

async function status() {
  const job = await findJob();
  if (!job) return console.log(`No job titled "${JOB.title}": run \`pnpm cron-job apply\``);
  console.log(`${job.title} (#${job.jobId}) · ${job.enabled ? "enabled" : "DISABLED"}`);
  const { history, predictions } = await api<{ history: HistoryItem[]; predictions: number[] }>("GET", `/jobs/${job.jobId}/history`);
  console.log(`Next runs: ${predictions.map(stamp).join(", ") || "none"}`);
  if (history.length === 0) return console.log("No runs yet.");
  console.log("Last runs (Madrid time):");
  for (const run of history) {
    const ok = run.httpStatus >= 200 && run.httpStatus < 300;
    console.log(`  ${stamp(run.date)}  ${run.httpStatus || "—"}  ${run.duration} ms  ${ok ? "" : run.statusText}`);
  }
  // GitHub's error message says why (expired token, wrong ref...). One extra call per failure, at most 3.
  for (const run of history.filter((r) => r.httpStatus < 200 || r.httpStatus >= 300).slice(0, 3)) {
    const { jobHistoryDetails } = await api<{ jobHistoryDetails: HistoryItem }>("GET", `/jobs/${job.jobId}/history/${run.identifier}`);
    console.log(`  ${stamp(run.date)}: ${jobHistoryDetails.body?.trim() || "(no response body)"}`);
  }
}

async function apply({ dryRun }: { dryRun: boolean }) {
  const live = await findJob();
  if (!live) {
    if (dryRun) return console.log(`Would create "${JOB.title}".`);
    const { jobId } = await api<{ jobId: number }>("PUT", "/jobs", { job: wantedJob(null) });
    return console.log(`Created "${JOB.title}" (#${jobId}).`);
  }
  const wanted = wantedJob(live);
  const changes = differences(live, wanted);
  if (process.env.GITHUB_DISPATCH_TOKEN) changes.push("extendedData.headers.Authorization: new token");
  if (changes.length === 0) return console.log("Up to date.");
  console.log(changes.map((c) => `  ${c}`).join("\n"));
  if (dryRun) return;
  await api("PATCH", `/jobs/${live.jobId}`, { job: wanted });
  console.log(`Updated "${JOB.title}" (#${live.jobId}).`);
}

async function main() {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // No .env.local: the variables may come from the environment.
  }
  const command = process.argv[2] ?? "status";
  if (command === "status") await status();
  else if (command === "diff") await apply({ dryRun: true });
  else if (command === "apply") await apply({ dryRun: false });
  else throw new Error(`Unknown command "${command}": use status, diff or apply`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
