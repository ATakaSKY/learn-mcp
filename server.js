import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({
  name: "docs-fetcher",
  version: "1.0.0",
});

// Register the fetch_github_readme tool
server.registerTool(
  "fetch_github_readme",
  {
    description: "Fetch README from a public GitHub repo",
    inputSchema: {
      owner: z.string().describe("GitHub repository owner/organization"),
      repo: z.string().describe("GitHub repository name"),
    },
  },
  async ({ owner, repo }) => {
    const url = `https://raw.githubusercontent.com/${owner}/${repo}/main/README.md`;

    const res = await fetch(url);
    if (!res.ok) {
      // Try master branch as fallback
      const masterUrl = `https://raw.githubusercontent.com/${owner}/${repo}/master/README.md`;
      const masterRes = await fetch(masterUrl);

      if (!masterRes.ok) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to fetch README from ${owner}/${repo}. The repository may not exist, be private, or have a README in a different location.`,
            },
          ],
          isError: true,
        };
      }

      const text = await masterRes.text();
      return {
        content: [
          {
            type: "text",
            text: text.slice(0, 5000), // truncate for safety
          },
        ],
      };
    }

    const text = await res.text();
    return {
      content: [
        {
          type: "text",
          text: text.slice(0, 5000), // truncate for safety
        },
      ],
    };
  }
);

// Start the server with stdio transport
const transport = new StdioServerTransport();
await server.connect(transport);
