// The cron-job.org jobs that start GitHub workflows, kept as code: the sync on
// match nights, and the call-ups every hour a Slack channel can pick. GitHub's
// own schedule starts runs late or drops them on busy hours, so cron-job.org
// calls the workflow_dispatch API instead (see the README).
//
// Usage (reads CRONJOB_API_KEY from .env.local):
//   pnpm cron-job                 status: each job, its last runs and the next ones
//   pnpm cron-job diff            what `apply` would change
//   pnpm cron-job apply           makes the jobs match JOBS below (creates the missing ones)
//
// The GitHub token (fine-grained, Actions: read and write on this repository) is
// not in the repository: `apply` keeps the one a job already has (a new job
// takes it from the others), or sets GITHUB_DISPATCH_TOKEN if given. Output
// never shows it.

import { nowInMadrid } from "@/lib/dates";

const API = "https://api.cron-job.org";
const REPOSITORY = "daniseijo/futbol-empresas";
const AUTH_HEADER = "Authorization";

/** A job that starts a workflow at the given Madrid times. */
function dispatchJob(title: string, workflow: string, { hours, minutes, wdays }: { hours: number[]; minutes: number[]; wdays: number[] }) {
  return {
    title,
    enabled: true,
    saveResponses: true,
    url: `https://api.github.com/repos/${REPOSITORY}/actions/workflows/${workflow}/dispatches`,
    requestMethod: 1, // POST
    requestTimeout: 30,
    schedule: { timezone: "Europe/Madrid", expiresAt: 0, hours, minutes, wdays, mdays: [-1], months: [-1] },
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
}

type JobSpec = ReturnType<typeof dispatchJob>;

/** The fields of the jobs this script owns. Anything else is left as it is. */
const JOBS: JobSpec[] = [
  // Matches are Monday to Friday nights, kicking off from 20:00 to 22:05 Madrid time, and the league uploads
  // the results until about 01:00. Every 20 minutes from 20:30, when the first ones end, to 01:50. A job
  // runs every hour × minute it lists, and its weekdays are those of the run, so it takes three jobs.
  dispatchJob("futbol-empresas sync", "sync.yml", { hours: [21, 22, 23], minutes: [10, 30, 50], wdays: [1, 2, 3, 4, 5] }),
  dispatchJob("futbol-empresas sync (first matches)", "sync.yml", { hours: [20], minutes: [30, 50], wdays: [1, 2, 3, 4, 5] }),
  dispatchJob("futbol-empresas sync (after midnight)", "sync.yml", { hours: [0, 1], minutes: [10, 30, 50], wdays: [2, 3, 4, 5, 6] }),
  // Slack channels pick a weekday and a whole hour from 07:00 to 22:00 (src/notify/schedule.ts).
  dispatchJob("futbol-empresas notify", "notify.yml", {
    hours: [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22],
    minutes: [0],
    wdays: [1, 2, 3, 4, 5],
  }),
];

type Job = JobSpec & { jobId: number; lastStatus: number; nextExecution: number | null };

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

/** The live jobs this script owns, by title. */
async function findJobs(): Promise<Map<string, Job>> {
  const { jobs } = await api<{ jobs: { jobId: number; title: string }[] }>("GET", "/jobs");
  const found = new Map<string, Job>();
  for (const { title } of JOBS) {
    const match = jobs.find((job) => job.title === title);
    if (!match) continue;
    const { jobDetails } = await api<{ jobDetails: Job }>("GET", `/jobs/${match.jobId}`);
    found.set(title, jobDetails);
  }
  return found;
}

/** The token is the one secret the job holds: never print it. */
function redact<T>(value: T): T {
  return JSON.parse(JSON.stringify(value), (key, v) => (key === AUTH_HEADER && typeof v === "string" ? "Bearer ***" : v));
}

function stamp(unixSeconds: number): string {
  return nowInMadrid(new Date(unixSeconds * 1000)).replace("T", " ");
}

/** Fields of a job spec whose value differs in the live job, as "field: live → wanted". */
function differences(live: Job, wanted: JobSpec): string[] {
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

/** The spec plus the authorization header: a new token if given, else the live one, else another job's. */
function wantedJob(spec: JobSpec, live: Job | undefined, others: Iterable<Job>): JobSpec {
  const token = process.env.GITHUB_DISPATCH_TOKEN;
  const auth =
    (token ? `Bearer ${token}` : undefined) ??
    live?.extendedData?.headers?.[AUTH_HEADER] ??
    [...others].map((job) => job.extendedData?.headers?.[AUTH_HEADER]).find(Boolean);
  if (!auth) throw new Error(`"${spec.title}" has no GitHub token yet: set GITHUB_DISPATCH_TOKEN`);
  return { ...spec, extendedData: { ...spec.extendedData, headers: { ...spec.extendedData.headers, [AUTH_HEADER]: auth } } };
}

async function status() {
  const live = await findJobs();
  for (const { title } of JOBS) {
    const job = live.get(title);
    if (!job) {
      console.log(`No job titled "${title}": run \`pnpm cron-job apply\`\n`);
      continue;
    }
    console.log(`${job.title} (#${job.jobId}) · ${job.enabled ? "enabled" : "DISABLED"}`);
    const { history, predictions } = await api<{ history: HistoryItem[]; predictions: number[] }>("GET", `/jobs/${job.jobId}/history`);
    console.log(`Next runs: ${predictions.map(stamp).join(", ") || "none"}`);
    if (history.length === 0) {
      console.log("No runs yet.\n");
      continue;
    }
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
    console.log();
  }
}

async function apply({ dryRun }: { dryRun: boolean }) {
  const live = await findJobs();
  for (const spec of JOBS) {
    const job = live.get(spec.title);
    if (!job && dryRun) {
      console.log(`Would create "${spec.title}".`);
      continue;
    }
    const wanted = wantedJob(spec, job, live.values());
    if (!job) {
      const { jobId } = await api<{ jobId: number }>("PUT", "/jobs", { job: wanted });
      console.log(`Created "${spec.title}" (#${jobId}).`);
      continue;
    }
    const changes = differences(job, wanted);
    if (process.env.GITHUB_DISPATCH_TOKEN) changes.push("extendedData.headers.Authorization: new token");
    if (changes.length === 0) {
      console.log(`"${spec.title}": up to date.`);
      continue;
    }
    console.log(`"${spec.title}":\n${changes.map((c) => `  ${c}`).join("\n")}`);
    if (dryRun) continue;
    await api("PATCH", `/jobs/${job.jobId}`, { job: wanted });
    console.log(`Updated "${spec.title}" (#${job.jobId}).`);
  }
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
