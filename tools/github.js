/**
 * GitHub-related MCP tools
 */

import { z } from "zod";
import {
  fetchJson,
  fetchText,
  errorResponse,
  textResponse,
  truncate,
  formatNumber,
  formatRelativeTime,
  formatBytes,
} from "../utils/fetcher.js";

const GITHUB_API = "https://api.github.com";
const GITHUB_RAW = "https://raw.githubusercontent.com";

/**
 * Get GitHub API headers (with optional token)
 */
function getHeaders() {
  const headers = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "docs-fetcher-mcp/1.0",
  };

  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  return headers;
}

/**
 * Tool definitions for GitHub
 */
export const githubTools = [
  {
    name: "fetch_github_readme",
    description: "Fetch README from a public GitHub repo",
    inputSchema: {
      owner: z.string().describe("GitHub repository owner/organization"),
      repo: z.string().describe("GitHub repository name"),
    },
    handler: async ({ owner, repo }) => {
      const branches = ["main", "master", "canary"];
      const filenames = ["README.md", "readme.md", "Readme.md"];

      for (const branch of branches) {
        for (const filename of filenames) {
          const url = `${GITHUB_RAW}/${owner}/${repo}/${branch}/${filename}`;
          const { data, error } = await fetchText(url);

          if (data) {
            return textResponse(truncate(data, 8000));
          }
        }
      }

      return errorResponse(
        `Failed to fetch README from ${owner}/${repo}. The repository may not exist, be private, or have a README in a different location.`,
      );
    },
  },

  {
    name: "fetch_github_file",
    description: "Fetch any file from a public GitHub repository",
    inputSchema: {
      owner: z.string().describe("GitHub repository owner/organization"),
      repo: z.string().describe("GitHub repository name"),
      path: z
        .string()
        .describe("Path to the file (e.g., 'src/index.ts' or 'package.json')"),
      branch: z
        .string()
        .optional()
        .describe("Branch name (defaults to 'main', falls back to 'master')"),
    },
    handler: async ({ owner, repo, path, branch }) => {
      const branches = branch ? [branch] : ["main", "master"];

      for (const b of branches) {
        const url = `${GITHUB_RAW}/${owner}/${repo}/${b}/${path}`;
        const { data, error } = await fetchText(url);

        if (data) {
          // Detect file type for context
          const ext = path.split(".").pop()?.toLowerCase() || "";
          const header = `File: ${owner}/${repo}/${path} (branch: ${b})\n${"─".repeat(50)}\n\n`;
          return textResponse(header + truncate(data, 8000));
        }
      }

      return errorResponse(
        `Failed to fetch file '${path}' from ${owner}/${repo}. The file may not exist or the repository may be private.`,
      );
    },
  },

  {
    name: "get_repo_info",
    description: "Get metadata and statistics about a GitHub repository",
    inputSchema: {
      owner: z.string().describe("GitHub repository owner/organization"),
      repo: z.string().describe("GitHub repository name"),
    },
    handler: async ({ owner, repo }) => {
      const { data, error } = await fetchJson(
        `${GITHUB_API}/repos/${owner}/${repo}`,
        {
          headers: getHeaders(),
        },
      );

      if (error) {
        return errorResponse(`Failed to fetch repo info: ${error}`);
      }

      // Fetch languages
      const { data: languages } = await fetchJson(
        `${GITHUB_API}/repos/${owner}/${repo}/languages`,
        {
          headers: getHeaders(),
        },
      );

      const languageList = languages
        ? Object.entries(languages)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([lang, bytes]) => `${lang} (${formatBytes(bytes)})`)
            .join(", ")
        : "Unknown";

      const info = `
# ${data.full_name}

${data.description || "No description provided."}

## Statistics
- ⭐ Stars: ${formatNumber(data.stargazers_count)}
- 🍴 Forks: ${formatNumber(data.forks_count)}
- 👀 Watchers: ${formatNumber(data.subscribers_count || 0)}
- 🐛 Open Issues: ${formatNumber(data.open_issues_count)}

## Details
- 📝 License: ${data.license?.name || "Not specified"}
- 🔤 Primary Language: ${data.language || "Not specified"}
- 📊 Languages: ${languageList}
- 🏷️ Topics: ${data.topics?.length ? data.topics.join(", ") : "None"}
- 📅 Created: ${formatRelativeTime(data.created_at)}
- 🔄 Last Updated: ${formatRelativeTime(data.pushed_at)}
- 🌿 Default Branch: ${data.default_branch}

## Links
- 🔗 Repository: ${data.html_url}
- 🏠 Homepage: ${data.homepage || "Not specified"}
${data.has_wiki ? `- 📚 Wiki: ${data.html_url}/wiki` : ""}
`.trim();

      return textResponse(info);
    },
  },

  {
    name: "list_repo_contents",
    description: "List files and folders in a GitHub repository directory",
    inputSchema: {
      owner: z.string().describe("GitHub repository owner/organization"),
      repo: z.string().describe("GitHub repository name"),
      path: z.string().optional().describe("Directory path (defaults to root)"),
    },
    handler: async ({ owner, repo, path = "" }) => {
      const url = `${GITHUB_API}/repos/${owner}/${repo}/contents/${path}`;
      const { data, error } = await fetchJson(url, {
        headers: getHeaders(),
      });

      if (error) {
        return errorResponse(`Failed to list contents: ${error}`);
      }

      if (!Array.isArray(data)) {
        // It's a single file, not a directory
        return errorResponse(
          `'${path}' is a file, not a directory. Use fetch_github_file to read it.`,
        );
      }

      // Sort: directories first, then files, alphabetically
      const sorted = data.sort((a, b) => {
        if (a.type === b.type) return a.name.localeCompare(b.name);
        return a.type === "dir" ? -1 : 1;
      });

      const listing = sorted.map((item) => {
        const icon = item.type === "dir" ? "📁" : "📄";
        const size = item.type === "file" ? ` (${formatBytes(item.size)})` : "";
        return `${icon} ${item.name}${size}`;
      });

      const header = `Contents of ${owner}/${repo}/${path || "(root)"}\n${"─".repeat(50)}\n`;
      return textResponse(header + listing.join("\n"));
    },
  },

  {
    name: "get_github_releases",
    description: "Get recent releases and changelogs from a GitHub repository",
    inputSchema: {
      owner: z.string().describe("GitHub repository owner/organization"),
      repo: z.string().describe("GitHub repository name"),
      count: z
        .number()
        .optional()
        .describe("Number of releases to fetch (default: 5, max: 10)"),
    },
    handler: async ({ owner, repo, count = 5 }) => {
      const limit = Math.min(Math.max(1, count), 10);
      const url = `${GITHUB_API}/repos/${owner}/${repo}/releases?per_page=${limit}`;
      const { data, error } = await fetchJson(url, {
        headers: getHeaders(),
      });

      if (error) {
        return errorResponse(`Failed to fetch releases: ${error}`);
      }

      if (!data || data.length === 0) {
        return textResponse(
          `No releases found for ${owner}/${repo}. The project may use a different release strategy.`,
        );
      }

      const releases = data.map((release) => {
        const tag = release.tag_name;
        const name = release.name || tag;
        const date = formatRelativeTime(release.published_at);
        const prerelease = release.prerelease ? " [PRE-RELEASE]" : "";
        const body = release.body
          ? truncate(release.body, 1000)
          : "No release notes provided.";

        return `
## ${name}${prerelease}
**Tag:** ${tag} | **Released:** ${date}

${body}
`.trim();
      });

      const header = `# Releases for ${owner}/${repo}\n\n`;
      return textResponse(header + releases.join("\n\n---\n\n"));
    },
  },
];
