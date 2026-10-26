import { toolDefinition } from "@tanstack/ai";
import { type } from "arktype";

/**
 * Real data for the agent's charts and tables, from public APIs that need no
 * key. Both return compact results: the model pays for every token it reads.
 */

const npmDownloadsInput = type({
  package: type("string > 0").describe("npm package name, e.g. 'react' or '@tanstack/react-query'"),
  period: type("'last-week' | 'last-month' | 'last-year'").describe(
    "How far back to look. Weekly totals for last-year, daily otherwise.",
  ),
});

interface DownloadsResponse {
  package: string;
  start: string;
  end: string;
  downloads: { day: string; downloads: number }[];
}

/** Sums daily counts into weeks starting on Monday (UTC). */
export function weeklyTotals(days: DownloadsResponse["downloads"]) {
  const weeks = new Map<string, number>();
  for (const { day, downloads } of days) {
    const date = new Date(`${day}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
    const week = date.toISOString().slice(0, 10);
    weeks.set(week, (weeks.get(week) ?? 0) + downloads);
  }
  return [...weeks].map(([week, downloads]) => ({ date: week, downloads }));
}

type Period = typeof npmDownloadsInput.infer.period;

const day = (date: Date) => date.toISOString().slice(0, 10);

/**
 * Date ranges covering a period, for the point endpoint: months for a year,
 * weeks for a month, days for a week. Ends yesterday (UTC), like npm's own.
 */
export function periodBuckets(period: Period, today = new Date()) {
  const end = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - 1),
  );
  const steps = {
    "last-year": { count: 12, days: 0 },
    "last-month": { count: 4, days: 7 },
    "last-week": { count: 7, days: 1 },
  }[period];
  const buckets: { start: string; end: string }[] = [];
  let bucketEnd = end;
  for (let i = 0; i < steps.count; i++) {
    const bucketStart =
      period === "last-year"
        ? new Date(Date.UTC(bucketEnd.getUTCFullYear(), bucketEnd.getUTCMonth(), 1))
        : new Date(bucketEnd.getTime() - (steps.days - 1) * 86_400_000);
    buckets.unshift({ start: day(bucketStart), end: day(bucketEnd) });
    bucketEnd = new Date(bucketStart.getTime() - 86_400_000);
  }
  return buckets;
}

const GRANULARITY = { "last-year": "month", "last-month": "week", "last-week": "day" } as const;

/** One request per bucket to the point endpoint, for when the range endpoint fails. */
async function downloadsByPoint(name: string, period: Period) {
  const buckets = periodBuckets(period);
  const totals = await Promise.all(
    buckets.map(async ({ start, end }) => {
      const response = await fetch(`https://api.npmjs.org/downloads/point/${start}:${end}/${name}`);
      if (!response.ok) throw new Error(`npm returned ${response.status}.`);
      return ((await response.json()) as { downloads: number }).downloads;
    }),
  );
  const rows = buckets.map((bucket, i) => ({ date: bucket.start, downloads: totals[i] ?? 0 }));
  return {
    package: name,
    start: buckets[0]?.start,
    end: buckets.at(-1)?.end,
    granularity: GRANULARITY[period],
    total: totals.reduce((sum, n) => sum + n, 0),
    rows,
  };
}

export const npmDownloads = toolDefinition({
  name: "npmDownloads",
  description:
    "Download counts for an npm package from the npm registry. Call once per package; to compare packages, call it for each and combine the rows with a series field. Check granularity in each result: it can be coarser than asked if npm's range API is unavailable. If packages you compare come back at different granularities, sum the finer rows into the coarser periods before charting, and say so.",
  inputSchema: npmDownloadsInput,
}).server(async ({ package: name, period }) => {
  const response = await fetch(`https://api.npmjs.org/downloads/range/${period}/${name}`);
  if (response.status === 404) return { error: `No package named ${name} on npm.` };
  if (!response.ok) {
    // npm's range endpoint has returned 503 for every scoped package while the
    // point endpoint kept working (seen 2026-10-26).
    try {
      return await downloadsByPoint(name, period);
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) };
    }
  }
  const data = (await response.json()) as DownloadsResponse;
  const rows =
    period === "last-year"
      ? weeklyTotals(data.downloads)
      : data.downloads.map(({ day, downloads }) => ({ date: day, downloads }));
  return {
    package: data.package,
    start: data.start,
    end: data.end,
    granularity: period === "last-year" ? "week" : "day",
    total: data.downloads.reduce((sum, d) => sum + d.downloads, 0),
    rows,
  };
});

const githubRepoInput = type({
  repo: type(/^[\w.-]+\/[\w.-]+$/).describe("Repository as owner/name, e.g. 'TanStack/query'"),
});

interface RepoResponse {
  full_name: string;
  description: string | null;
  html_url: string;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  subscribers_count?: number;
  language: string | null;
  license: { spdx_id: string } | null;
  topics?: string[];
  created_at: string;
  pushed_at: string;
}

export const githubRepo = toolDefinition({
  name: "githubRepo",
  description:
    "Facts about a public GitHub repository: stars, forks, open issues, language, license, topics, and when it was created and last pushed.",
  inputSchema: githubRepoInput,
}).server(async ({ repo }) => {
  const response = await fetch(`https://api.github.com/repos/${repo}`, {
    headers: { accept: "application/vnd.github+json", "user-agent": "ai-tink-ai-sdk-hono" },
  });
  if (response.status === 404) return { error: `No public repository ${repo}.` };
  if (response.status === 403) return { error: "GitHub's rate limit was hit; try again later." };
  if (!response.ok) return { error: `GitHub returned ${response.status}.` };
  const data = (await response.json()) as RepoResponse;
  return {
    repo: data.full_name,
    description: data.description,
    url: data.html_url,
    stars: data.stargazers_count,
    forks: data.forks_count,
    openIssues: data.open_issues_count,
    watchers: data.subscribers_count,
    language: data.language,
    license: data.license?.spdx_id ?? null,
    topics: data.topics ?? [],
    createdAt: data.created_at,
    pushedAt: data.pushed_at,
  };
});

export const dataTools = [npmDownloads, githubRepo];
