import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import { randomUUID } from "crypto";

// Import tool definitions
import { githubTools } from "./tools/github.js";
import { npmTools } from "./tools/npm.js";
import { docsTools } from "./tools/docs.js";

// Combine all tools
const allTools = [...githubTools, ...npmTools, ...docsTools];

// Factory function to create a configured MCP server
function createMcpServer() {
  const server = new McpServer({
    name: "docs-fetcher",
    version: "1.0.0",
  });

  // Register all tools
  for (const tool of allTools) {
    server.registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema: tool.inputSchema,
      },
      tool.handler,
    );
  }

  return server;
}

// Setup Express app with HTTP transport
const app = express();
app.use(express.json());

// Store sessions: { server, transport }
const sessions = new Map();

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    server: "docs-fetcher",
    version: "1.0.0",
    tools: allTools.map((t) => t.name),
  });
});

// MCP endpoint - handles POST requests
app.post("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"];

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
  console.log(`🔧 Tools available: ${allTools.length}`);
  allTools.forEach((t) => console.log(`   - ${t.name}`));
});
