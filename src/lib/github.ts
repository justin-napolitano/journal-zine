// src/lib/github.ts

type GithubUser = {
  login: string;
  id: number;
};

type GithubRepo = {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  fork: boolean;
  archived: boolean;
  html_url: string;
  owner: {
    login: string;
    id: number;
  };
};

export type GithubPull = {
  id: number;
  number: number;
  title: string;
  html_url: string;
  merged_at: string | null;
  state: string;
  user: {
    login: string;
  };
};

type RepoRef = {
  owner: string;
  repo: string;
  full_name: string;
};

function getGithubToken(): string | null {
  return process.env.GITHUB_TOKEN ?? null;
}

async function githubFetch<T>(url: string): Promise<T | null> {
  const token = getGithubToken();
  if (!token) return null;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "journal-zine",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    console.error("GitHub API error", res.status, url);
    return null;
  }

  const json = (await res.json()) as T;
  return json;
}

async function fetchViewer(): Promise<GithubUser | null> {
  return githubFetch<GithubUser>("https://api.github.com/user");
}

/**
 * Discover all public, non-fork, non-archived repos owned by the
 * current user (or GITHUB_OWNER if set).
 */
export async function fetchPublicRepos(): Promise<RepoRef[]> {
  const token = getGithubToken();
  if (!token) return [];

  const viewer = await fetchViewer();
  if (!viewer) return [];

  const ownerOverride = process.env.GITHUB_OWNER;
  const ownerLogin = ownerOverride || viewer.login;

  const repos: RepoRef[] = [];
  let page = 1;

  // Basic pagination; bump per_page if needed later
  while (page <= 5) {
    const url = `https://api.github.com/user/repos?visibility=public&affiliation=owner&per_page=100&page=${page}`;
    const batch = await githubFetch<GithubRepo[]>(url);
    if (!batch || batch.length === 0) break;

    for (const repo of batch) {
      if (
        repo.private ||
        repo.fork ||
        repo.archived ||
        repo.owner.login.toLowerCase() !== ownerLogin.toLowerCase()
      ) {
        continue;
      }

      repos.push({
        owner: repo.owner.login,
        repo: repo.name,
        full_name: repo.full_name,
      });
    }

    if (batch.length < 100) break;
    page++;
  }

  return repos;
}

/**
 * Fetch recently closed PRs for a repo and filter to merged ones
 * after `sinceIso`.
 */
export async function fetchRecentMergedPullsForRepo(
  repo: RepoRef,
  sinceIso: string,
  perPage = 30,
): Promise<{ repo: RepoRef; pull: GithubPull }[]> {
  const url = `https://api.github.com/repos/${repo.owner}/${repo.repo}/pulls?state=closed&sort=updated&direction=desc&per_page=${perPage}`;
  const pulls = await githubFetch<GithubPull[]>(url);
  if (!pulls) return [];

  const since = new Date(sinceIso);
  const results: { repo: RepoRef; pull: GithubPull }[] = [];

  for (const pull of pulls) {
    if (!pull.merged_at) continue;
    const mergedAt = new Date(pull.merged_at);
    if (Number.isNaN(mergedAt.getTime())) continue;
    if (mergedAt < since) continue;

    results.push({ repo, pull });
  }

  return results;
}

