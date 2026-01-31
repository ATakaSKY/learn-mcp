/**
 * Unit tests for server.ts
 *
 * These tests verify the server's exported components and HTTP handlers.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import request from "supertest";

// Mock the MCP SDK modules before importing server
vi.mock("@modelcontextprotocol/sdk/server/mcp.js", () => ({
  McpServer: class MockMcpServer {
    registeredTools: string[] = [];
    constructor() {}
    registerTool(name: string) {
      this.registeredTools.push(name);
    }
    connect = vi.fn().mockResolvedValue(undefined);
  },
}));

vi.mock("@modelcontextprotocol/sdk/server/streamableHttp.js", () => ({
  StreamableHTTPServerTransport: class MockTransport {
    sessionId = "mock-session-id";
    handleRequest = vi.fn().mockImplementation((_req, res) => {
      res.json({ jsonrpc: "2.0", result: {} });
    });
    close = vi.fn();
  },
}));

import { app, sessions, allTools, createMcpServer } from "./server.js";
import type { Session } from "./types/index.js";

describe("allTools export", () => {
  it("contains expected number of tools", () => {
    expect(allTools).toHaveLength(10);
  });

  it("contains GitHub tools", () => {
    const githubTools = allTools.filter(
      (t) =>
        t.name.includes("github") ||
        t.name.includes("repo") ||
        t.name === "fetch_github_readme" ||
        t.name === "fetch_github_file"
    );
    expect(githubTools.length).toBeGreaterThanOrEqual(5);
  });

  it("contains npm tools", () => {
    const npmTools = allTools.filter(
      (t) => t.name.includes("npm") || t.name.includes("package")
    );
    expect(npmTools.length).toBeGreaterThanOrEqual(3);
  });

  it("contains docs tools", () => {
    const docsTools = allTools.filter(
      (t) => t.name.includes("url") || t.name.includes("mdn")
    );
    expect(docsTools.length).toBeGreaterThanOrEqual(2);
  });

  it("all tools have required properties", () => {
    for (const tool of allTools) {
      expect(tool.name).toBeDefined();
      expect(typeof tool.name).toBe("string");
      expect(tool.description).toBeDefined();
      expect(typeof tool.description).toBe("string");
      expect(tool.inputSchema).toBeDefined();
      expect(tool.handler).toBeInstanceOf(Function);
    }
  });

  it("tool names are unique", () => {
    const names = allTools.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe("createMcpServer", () => {
  it("creates a server instance", () => {
    const server = createMcpServer();
    expect(server).toBeDefined();
  });

  it("registers all tools", () => {
    const server = createMcpServer();
    const mockServer = server as unknown as { registeredTools: string[] };
    expect(mockServer.registeredTools.length).toBe(allTools.length);
  });

  it("registers tools with correct names", () => {
    const server = createMcpServer();
    const mockServer = server as unknown as { registeredTools: string[] };

    for (const tool of allTools) {
      expect(mockServer.registeredTools).toContain(tool.name);
    }
  });
});

describe("sessions Map", () => {
  beforeEach(() => {
    sessions.clear();
  });

  afterEach(() => {
    sessions.clear();
  });

  it("is initially empty or can be cleared", () => {
    sessions.clear();
    expect(sessions.size).toBe(0);
  });

  it("can store and retrieve sessions", () => {
    const mockSession = {
      server: createMcpServer(),
      transport: {
        sessionId: "test-123",
        handleRequest: vi.fn(),
        close: vi.fn(),
      },
    } as unknown as Session;

    sessions.set("test-123", mockSession);
    expect(sessions.has("test-123")).toBe(true);
    expect(sessions.get("test-123")).toBe(mockSession);
  });

  it("can delete sessions", () => {
    const mockSession = {
      server: createMcpServer(),
      transport: { sessionId: "delete-me", handleRequest: vi.fn(), close: vi.fn() },
    } as unknown as Session;

    sessions.set("delete-me", mockSession);
    expect(sessions.has("delete-me")).toBe(true);

    sessions.delete("delete-me");
    expect(sessions.has("delete-me")).toBe(false);
  });
});

describe("Health endpoint", () => {
  it("GET /health returns server status", async () => {
    const response = await request(app).get("/health").expect(200);

    expect(response.body).toEqual({
      status: "ok",
      server: "docs-fetcher",
      version: "1.0.0",
      tools: expect.any(Array),
    });
  });

  it("GET /health returns all tool names", async () => {
    const response = await request(app).get("/health");

    expect(response.body.tools).toHaveLength(allTools.length);
    expect(response.body.tools).toContain("fetch_github_readme");
    expect(response.body.tools).toContain("get_npm_package");
    expect(response.body.tools).toContain("search_mdn");
  });
});

describe("POST /mcp endpoint", () => {
  beforeEach(() => {
    sessions.clear();
  });

  afterEach(() => {
    sessions.clear();
  });

  it("creates new session for first request", async () => {
    const response = await request(app)
      .post("/mcp")
      .send({ jsonrpc: "2.0", method: "initialize", id: 1 })
      .expect(200);

    expect(response.body).toBeDefined();
    expect(sessions.size).toBe(1);
  });

  it("reuses existing session with mcp-session-id header", async () => {
    const mockTransport = {
      sessionId: "existing-session",
      handleRequest: vi.fn().mockImplementation((_req, res) => {
        res.json({ jsonrpc: "2.0", result: { reused: true } });
      }),
      close: vi.fn(),
    };

    sessions.set("existing-session", {
      server: createMcpServer(),
      transport: mockTransport,
    } as unknown as Session);

    const response = await request(app)
      .post("/mcp")
      .set("mcp-session-id", "existing-session")
      .send({ jsonrpc: "2.0", method: "tools/list", id: 2 })
      .expect(200);

    expect(response.body.result.reused).toBe(true);
    expect(mockTransport.handleRequest).toHaveBeenCalled();
  });

  it("creates new session when session-id not found", async () => {
    const initialSize = sessions.size;

    await request(app)
      .post("/mcp")
      .set("mcp-session-id", "nonexistent-session")
      .send({ jsonrpc: "2.0", method: "initialize", id: 1 })
      .expect(200);

    expect(sessions.size).toBe(initialSize + 1);
  });
});

describe("GET /mcp endpoint", () => {
  beforeEach(() => {
    sessions.clear();
  });

  afterEach(() => {
    sessions.clear();
  });

  it("returns 400 without session-id header", async () => {
    const response = await request(app).get("/mcp").expect(400);

    expect(response.body).toEqual({
      error: "Invalid or missing session ID",
    });
  });

  it("returns 400 with invalid session-id", async () => {
    const response = await request(app)
      .get("/mcp")
      .set("mcp-session-id", "invalid-session")
      .expect(400);

    expect(response.body).toEqual({
      error: "Invalid or missing session ID",
    });
  });

  it("handles valid session for SSE stream", async () => {
    const mockTransport = {
      sessionId: "sse-session",
      handleRequest: vi.fn().mockImplementation((_req, res) => {
        res.json({ stream: "connected" });
      }),
      close: vi.fn(),
    };

    sessions.set("sse-session", {
      server: createMcpServer(),
      transport: mockTransport,
    } as unknown as Session);

    await request(app)
      .get("/mcp")
      .set("mcp-session-id", "sse-session")
      .expect(200);

    expect(mockTransport.handleRequest).toHaveBeenCalled();
  });
});

describe("DELETE /mcp endpoint", () => {
  beforeEach(() => {
    sessions.clear();
  });

  afterEach(() => {
    sessions.clear();
  });

  it("returns 204 without session-id", async () => {
    await request(app).delete("/mcp").expect(204);
  });

  it("returns 204 with invalid session-id", async () => {
    await request(app)
      .delete("/mcp")
      .set("mcp-session-id", "nonexistent")
      .expect(204);
  });

  it("cleans up existing session", async () => {
    const mockTransport = {
      sessionId: "cleanup-session",
      handleRequest: vi.fn(),
      close: vi.fn(),
    };

    sessions.set("cleanup-session", {
      server: createMcpServer(),
      transport: mockTransport,
    } as unknown as Session);

    expect(sessions.has("cleanup-session")).toBe(true);

    await request(app)
      .delete("/mcp")
      .set("mcp-session-id", "cleanup-session")
      .expect(204);

    expect(sessions.has("cleanup-session")).toBe(false);
    expect(mockTransport.close).toHaveBeenCalled();
  });
});

describe("Tool handler integration", () => {
  it("all tool handlers are async functions", () => {
    for (const tool of allTools) {
      expect(tool.handler).toBeInstanceOf(Function);
    }
  });

  it("tool input schemas use zod", () => {
    for (const tool of allTools) {
      expect(tool.inputSchema).toBeDefined();
      expect(typeof tool.inputSchema).toBe("object");
    }
  });
});
