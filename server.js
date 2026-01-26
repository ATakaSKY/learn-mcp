import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import { z } from "zod";
import { randomUUID } from "crypto";

// Factory function to create a configured MCP server
function createMcpServer() {
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
    },
  );

  return server;
}

// Setup Express app with HTTP transport
const app = express();
app.use(express.json());

// Store sessions: { server, transport }
const sessions = new Map();

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok", server: "docs-fetcher", version: "1.0.0" });
});

// MCP endpoint - handles POST requests
app.post("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"];

  console.log("sessionId", sessionId);
  console.log("req.body", req.body);

  console.log("req.headers", req.headers);

  console.log("req.method", req.method);

  console.log("req.url", req.url);

  // Check if we have an existing session
  let session = sessionId ? sessions.get(sessionId) : null;

  if (session) {
    // Reuse existing session's transport
    await session.transport.handleRequest(req, res, req.body);
    return;
  }

  // Create new server and transport for new sessions
  const server = createMcpServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    enableJsonResponse: true,
  });

  // Connect the server to this transport
  await server.connect(transport);

  // Handle the request
  await transport.handleRequest(req, res, req.body);

  // Store the session by its ID for future requests
  const newSessionId = transport.sessionId;
  if (newSessionId) {
    sessions.set(newSessionId, { server, transport });

    // Set up cleanup after 30 minutes of inactivity
    setTimeout(
      () => {
        if (sessions.has(newSessionId)) {
          sessions.get(newSessionId).transport.close();
          sessions.delete(newSessionId);
        }
      },
      30 * 60 * 1000,
    );
  }
});

// Handle GET requests for SSE streams (optional, for backwards compatibility)
app.get("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"];

  if (!sessionId || !sessions.has(sessionId)) {
    res.status(400).json({ error: "Invalid or missing session ID" });
    return;
  }

  const session = sessions.get(sessionId);
  await session.transport.handleRequest(req, res);
});

// Handle DELETE for session cleanup
app.delete("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"];

  if (sessionId && sessions.has(sessionId)) {
    const session = sessions.get(sessionId);
    session.transport.close();
    sessions.delete(sessionId);
  }

  res.status(204).end();
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(
    `🚀 MCP Server "docs-fetcher" running on http://localhost:${PORT}/mcp`,
  );
  console.log(`📋 Health check: http://localhost:${PORT}/health`);
});
