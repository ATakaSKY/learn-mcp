/**
 * npm registry MCP tools
 */

import { z } from "zod";
import {
  fetchJson,
  errorResponse,
  textResponse,
  formatNumber,
  formatRelativeTime,
} from "../utils/fetcher.js";
import type { McpTool } from "../types/index.js";
import type {
  NpmPackage,
  NpmDownloads,
  NpmSearchResult,
} from "../types/npm.js";

const NPM_REGISTRY = "https://registry.npmjs.org";
const NPM_API = "https://api.npmjs.org";

// Input schemas
const packageSchema = {
  package_name: z
    .string()
    .describe("Name of the npm package (e.g., 'react', '@tanstack/query')"),
};

const searchSchema = {
  query: z.string().describe("Search query (e.g., 'react state management')"),
  limit: z
    .number()
    .optional()
    .describe("Number of results to return (default: 10, max: 20)"),
};

const versionsSchema = {
  package_name: z.string().describe("Name of the npm package"),
  limit: z
    .number()
    .optional()
    .describe("Number of versions to show (default: 10, max: 20)"),
};

/**
 * Tool definitions for npm
 */
export const npmTools: McpTool[] = [
  {
    name: "get_npm_package",
    description: "Get detailed information about an npm package",
    inputSchema: packageSchema,
    handler: async (args) => {
      const { package_name } = args as { package_name: string };
      // Fetch package metadata
      const { data: pkg, error } = await fetchJson<NpmPackage>(
        `${NPM_REGISTRY}/${encodeURIComponent(package_name)}`
      );

      if (error || !pkg) {
        return errorResponse(`Failed to fetch package info: ${error || "received empty response"}`);
      }

      // Fetch download stats
      const { data: downloads } = await fetchJson<NpmDownloads>(
        `${NPM_API}/downloads/point/last-week/${encodeURIComponent(package_name)}`
      );

      const latest = pkg["dist-tags"]?.latest;
      const latestVersion = latest ? pkg.versions?.[latest] : undefined;

      if (!latestVersion) {
        return errorResponse(
          `Package '${package_name}' not found or has no versions.`
        );
      }

      // Get dependencies
      const deps = latestVersion.dependencies
        ? Object.keys(latestVersion.dependencies).slice(0, 10)
        : [];
      const depsText = deps.length
        ? deps.join(", ") +
          (Object.keys(latestVersion.dependencies || {}).length > 10
            ? "..."
            : "")
        : "None";

      // Get peer dependencies
      const peerDeps = latestVersion.peerDependencies
        ? Object.entries(latestVersion.peerDependencies)
            .map(([name, version]) => `${name}@${version}`)
            .join(", ")
        : "None";

      const info = `
# ${package_name}

${pkg.description || "No description provided."}

## Package Info
- 📦 Latest Version: ${latest}
- 📅 Last Published: ${formatRelativeTime(pkg.time?.[latest!] || "")}
- 📥 Weekly Downloads: ${downloads?.downloads ? formatNumber(downloads.downloads) : "Unknown"}
- 📜 License: ${latestVersion.license || "Not specified"}

## Links
- 🔗 npm: https://www.npmjs.com/package/${package_name}
${pkg.homepage ? `- 🏠 Homepage: ${pkg.homepage}` : ""}
${pkg.repository?.url ? `- 📂 Repository: ${pkg.repository.url.replace(/^git\+/, "").replace(/\.git$/, "")}` : ""}
${pkg.bugs?.url ? `- 🐛 Issues: ${pkg.bugs.url}` : ""}

## Dependencies
- **Runtime:** ${depsText}
- **Peer:** ${peerDeps}

## Keywords
${pkg.keywords?.length ? pkg.keywords.join(", ") : "None specified"}

## Maintainers
${pkg.maintainers?.map((m) => m.name).join(", ") || "Unknown"}
`.trim();

      return textResponse(info);
    },
  },

  {
    name: "search_npm_packages",
    description: "Search for packages on npm registry",
    inputSchema: searchSchema,
    handler: async (args) => {
      const { query, limit = 10 } = args as { query: string; limit?: number };
      const size = Math.min(Math.max(1, limit), 20);
      const url = `${NPM_REGISTRY}/-/v1/search?text=${encodeURIComponent(query)}&size=${size}`;
      const { data, error } = await fetchJson<NpmSearchResult>(url);

      if (error || !data) {
        return errorResponse(`Failed to search npm: ${error || "received empty response"}`);
      }

      if (!data.objects || data.objects.length === 0) {
        return textResponse(`No packages found for "${query}".`);
      }

      const results = data.objects.map((obj, index) => {
        const pkg = obj.package;
        const score = Math.round((obj.score?.final || 0) * 100);
        return `
${index + 1}. **${pkg.name}** (v${pkg.version})
   ${pkg.description || "No description"}
   📥 Score: ${score}% | 🔗 https://www.npmjs.com/package/${pkg.name}
`.trim();
      });

      const header = `# npm Search Results for "${query}"\n\nFound ${data.total} packages. Showing top ${data.objects.length}:\n\n`;
      return textResponse(header + results.join("\n\n"));
    },
  },

  {
    name: "get_package_versions",
    description: "Get version history of an npm package",
    inputSchema: versionsSchema,
    handler: async (args) => {
      const { package_name, limit = 10 } = args as {
        package_name: string;
        limit?: number;
      };
      const { data: pkg, error } = await fetchJson<NpmPackage>(
        `${NPM_REGISTRY}/${encodeURIComponent(package_name)}`
      );

      if (error || !pkg) {
        return errorResponse(`Failed to fetch package: ${error || "received empty response"}`);
      }

      if (!pkg.time) {
        return errorResponse(
          `Version history not available for '${package_name}'.`
        );
      }

      // Get version times, excluding 'created' and 'modified'
      const versions = Object.entries(pkg.time)
        .filter(([key]) => key !== "created" && key !== "modified")
        .sort((a, b) => new Date(b[1]).getTime() - new Date(a[1]).getTime())
        .slice(0, Math.min(Math.max(1, limit), 20));

      const distTags = pkg["dist-tags"] || {};
      const tagMap: Record<string, string[]> = {};
      Object.entries(distTags).forEach(([tag, version]) => {
        if (!tagMap[version]) tagMap[version] = [];
        tagMap[version].push(tag);
      });

      const versionList = versions.map(([version, date]) => {
        const tags = tagMap[version] ? ` [${tagMap[version].join(", ")}]` : "";
        return `- **${version}**${tags} - ${formatRelativeTime(date)}`;
      });

      const header = `# Version History: ${package_name}\n\nShowing ${versions.length} most recent versions:\n\n`;
      return textResponse(header + versionList.join("\n"));
    },
  },
];
