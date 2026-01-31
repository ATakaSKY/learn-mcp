/**
 * GitHub API type definitions
 */

export interface GitHubRepo {
  full_name: string;
  description: string | null;
  stargazers_count: number;
  forks_count: number;
  subscribers_count: number;
  open_issues_count: number;
  license: { name: string } | null;
  language: string | null;
  topics: string[];
  created_at: string;
  pushed_at: string;
  default_branch: string;
  html_url: string;
  homepage: string | null;
  has_wiki: boolean;
}

export interface GitHubLanguages {
  [language: string]: number;
}

export interface GitHubRelease {
  tag_name: string;
  name: string | null;
  published_at: string;
  prerelease: boolean;
  body: string | null;
}

export interface GitHubContentItem {
  name: string;
  path: string;
  type: "file" | "dir";
  size: number;
}
