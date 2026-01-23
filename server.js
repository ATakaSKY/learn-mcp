import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import { z } from "zod";
import { randomUUID } from "crypto";

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

// Setup Express app with HTTP transport
const app = express();
app.use(express.json());

// Store transports by session ID for proper session management
const transports = new Map();

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok", server: "docs-fetcher", version: "1.0.0" });
});

// MCP endpoint - handles POST requests
app.post("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"] || randomUUID();
  
  let transport = transports.get(sessionId);
  
  if (!transport) {
    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => sessionId,
      enableJsonResponse: true,
    });
    transports.set(sessionId, transport);
    
    // Clean up on close
    res.on("close", () => {
      transports.delete(sessionId);
      transport.close();
    });
    
    await server.connect(transport);
  }
  
  await transport.handleRequest(req, res, req.body);
});

// Handle GET requests for SSE streams (optional, for backwards compatibility)
app.get("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"];
  
  if (!sessionId || !transports.has(sessionId)) {
    res.status(400).json({ error: "Invalid or missing session ID" });
    return;
  }
  
  const transport = transports.get(sessionId);
  await transport.handleRequest(req, res);
});

// Handle DELETE for session cleanup
app.delete("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"];
  
  if (sessionId && transports.has(sessionId)) {
    const transport = transports.get(sessionId);
    transport.close();
    transports.delete(sessionId);
  }
  
  res.status(204).end();
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 MCP Server "docs-fetcher" running on http://localhost:${PORT}/mcp`);
  console.log(`📋 Health check: http://localhost:${PORT}/health`);
});
