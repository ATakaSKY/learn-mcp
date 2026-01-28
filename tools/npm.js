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

const NPM_REGISTRY = "https://registry.npmjs.org";
const NPM_API = "https://api.npmjs.org";

/**
 * Tool definitions for npm
 */
export const npmTools = [
  {
    name: "get_npm_package",
    description: "Get detailed information about an npm package",
    inputSchema: {
      package_name: z
        .string()
        .describe("Name of the npm package (e.g., 'react', '@tanstack/query')"),
    },
    handler: async ({ package_name }) => {
      // Fetch package metadata
      const { data: pkg, error } = await fetchJson(
        `${NPM_REGISTRY}/${encodeURIComponent(package_name)}`,
      );

      if (error) {
        return errorResponse(`Failed to fetch package info: ${error}`);
      }

      // Fetch download stats
      const { data: downloads } = await fetchJson(
        `${NPM_API}/downloads/point/last-week/${encodeURIComponent(package_name)}`,
      );

      const latest = pkg["dist-tags"]?.latest;
      const latestVersion = pkg.versions?.[latest];

      if (!latestVersion) {
        return errorResponse(
          `Package '${package_name}' not found or has no versions.`,
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
- 📅 Last Published: ${formatRelativeTime(pkg.time?.[latest])}
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
    inputSchema: {
      query: z
        .string()
        .describe("Search query (e.g., 'react state management')"),
      limit: z
        .number()
        .optional()
        .describe("Number of results to return (default: 10, max: 20)"),
    },
    handler: async ({ query, limit = 10 }) => {
      const size = Math.min(Math.max(1, limit), 20);
      const url = `${NPM_REGISTRY}/-/v1/search?text=${encodeURIComponent(query)}&size=${size}`;
      const { data, error } = await fetchJson(url);

      if (error) {
        return errorResponse(`Failed to search npm: ${error}`);
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
    inputSchema: {
      package_name: z.string().describe("Name of the npm package"),
      limit: z
        .number()
        .optional()
        .describe("Number of versions to show (default: 10, max: 20)"),
    },
    handler: async ({ package_name, limit = 10 }) => {
      const { data: pkg, error } = await fetchJson(
        `${NPM_REGISTRY}/${encodeURIComponent(package_name)}`,
      );

      if (error) {
        return errorResponse(`Failed to fetch package: ${error}`);
      }

      if (!pkg.time) {
        return errorResponse(
          `Version history not available for '${package_name}'.`,
        );
      }

      // Get version times, excluding 'created' and 'modified'
      const versions = Object.entries(pkg.time)
        .filter(([key]) => key !== "created" && key !== "modified")
        .sort((a, b) => new Date(b[1]) - new Date(a[1]))
        .slice(0, Math.min(Math.max(1, limit), 20));

      const distTags = pkg["dist-tags"] || {};
      const tagMap = {};
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
