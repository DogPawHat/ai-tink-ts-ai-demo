import { afterEach, expect, test, vi } from "vite-plus/test";
import { githubRepo, npmDownloads, periodBuckets, weeklyTotals } from "./data-tools.ts";

function mockFetch(status: number, body: unknown) {
  const fetch = vi.fn(async () => new Response(JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

test("sums daily downloads into Monday-starting weeks", () => {
  expect(
    weeklyTotals([
      { day: "2026-01-04", downloads: 1 }, // Sunday: week of Dec 29
      { day: "2026-01-05", downloads: 2 }, // Monday
      { day: "2026-01-11", downloads: 3 }, // Sunday, same week
      { day: "2026-01-12", downloads: 4 },
    ]),
  ).toEqual([
    { date: "2025-12-29", downloads: 1 },
    { date: "2026-01-05", downloads: 5 },
    { date: "2026-01-12", downloads: 4 },
  ]);
});

test("npmDownloads returns weekly rows for a year and the total", async () => {
  const fetch = mockFetch(200, {
    package: "@tanstack/react-query",
    start: "2026-01-05",
    end: "2026-01-13",
    downloads: [
      { day: "2026-01-05", downloads: 10 },
      { day: "2026-01-06", downloads: 20 },
      { day: "2026-01-13", downloads: 5 },
    ],
  });
  const result = await npmDownloads.execute!({
    package: "@tanstack/react-query",
    period: "last-year",
  });
  expect(fetch).toHaveBeenCalledWith(
    "https://api.npmjs.org/downloads/range/last-year/@tanstack/react-query",
  );
  expect(result).toMatchObject({
    granularity: "week",
    total: 35,
    rows: [
      { date: "2026-01-05", downloads: 30 },
      { date: "2026-01-12", downloads: 5 },
    ],
  });
});

test("npmDownloads keeps daily rows for a month", async () => {
  mockFetch(200, {
    package: "swr",
    start: "2026-01-05",
    end: "2026-01-06",
    downloads: [
      { day: "2026-01-05", downloads: 1 },
      { day: "2026-01-06", downloads: 2 },
    ],
  });
  const result = await npmDownloads.execute!({ package: "swr", period: "last-month" });
  expect(result).toMatchObject({
    granularity: "day",
    rows: [{ date: "2026-01-05" }, { date: "2026-01-06" }],
  });
});

test("npmDownloads reports a missing package", async () => {
  mockFetch(404, { error: "not found" });
  expect(await npmDownloads.execute!({ package: "nope-x", period: "last-week" })).toEqual({
    error: "No package named nope-x on npm.",
  });
});

test("githubRepo returns compact facts", async () => {
  const fetch = mockFetch(200, {
    full_name: "TanStack/query",
    description: "Powerful asynchronous state management",
    html_url: "https://github.com/TanStack/query",
    stargazers_count: 45000,
    forks_count: 3000,
    open_issues_count: 100,
    subscribers_count: 200,
    language: "TypeScript",
    license: { spdx_id: "MIT" },
    topics: ["react"],
    created_at: "2019-09-10T00:00:00Z",
    pushed_at: "2026-10-25T00:00:00Z",
    owner: { login: "TanStack" },
  });
  const result = await githubRepo.execute!({ repo: "TanStack/query" });
  expect(fetch).toHaveBeenCalledWith(
    "https://api.github.com/repos/TanStack/query",
    expect.anything(),
  );
  expect(result).toEqual({
    repo: "TanStack/query",
    description: "Powerful asynchronous state management",
    url: "https://github.com/TanStack/query",
    stars: 45000,
    forks: 3000,
    openIssues: 100,
    watchers: 200,
    language: "TypeScript",
    license: "MIT",
    topics: ["react"],
    createdAt: "2019-09-10T00:00:00Z",
    pushedAt: "2026-10-25T00:00:00Z",
  });
});

test("githubRepo explains a rate limit", async () => {
  mockFetch(403, { message: "API rate limit exceeded" });
  expect(await githubRepo.execute!({ repo: "TanStack/query" })).toEqual({
    error: "GitHub's rate limit was hit; try again later.",
  });
});

test("periodBuckets covers a year in months ending yesterday", () => {
  const buckets = periodBuckets("last-year", new Date("2026-10-26T12:00:00Z"));
  expect(buckets).toHaveLength(12);
  expect(buckets.at(-1)).toEqual({ start: "2026-10-01", end: "2026-10-25" });
  expect(buckets[0]).toEqual({ start: "2025-11-01", end: "2025-11-30" });
});

test("periodBuckets covers a week in days", () => {
  const buckets = periodBuckets("last-week", new Date("2026-10-26T12:00:00Z"));
  expect(buckets.map((b) => b.start)).toEqual([
    "2026-10-19",
    "2026-10-20",
    "2026-10-21",
    "2026-10-22",
    "2026-10-23",
    "2026-10-24",
    "2026-10-25",
  ]);
  expect(buckets.every((b) => b.start === b.end)).toBe(true);
});

test("npmDownloads falls back to the point endpoint when the range endpoint fails", async () => {
  const fetch = vi.fn(async (url: string) =>
    url.includes("/range/")
      ? new Response("unavailable", { status: 503 })
      : new Response(JSON.stringify({ downloads: 10 })),
  );
  vi.stubGlobal("fetch", fetch);
  const result = await npmDownloads.execute!({
    package: "@tanstack/react-query",
    period: "last-week",
  });
  expect(fetch).toHaveBeenCalledTimes(8);
  expect(result).toMatchObject({ granularity: "day", total: 70 });
  expect((result as { rows: unknown[] }).rows).toHaveLength(7);
});
