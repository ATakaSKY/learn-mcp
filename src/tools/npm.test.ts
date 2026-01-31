/**
 * Unit tests for tools/npm.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { npmTools } from "./npm.js";

// Mock the fetcher module
vi.mock("../utils/fetcher.js", () => ({
  fetchJson: vi.fn(),
  errorResponse: (msg: string) => ({
    content: [{ type: "text", text: msg }],
    isError: true,
  }),
  textResponse: (text: string) => ({
    content: [{ type: "text", text }],
  }),
  formatNumber: (n: number) => n.toLocaleString("en-US"),
  formatRelativeTime: (date: string) => "2 days ago",
}));

import { fetchJson } from "../utils/fetcher.js";

// Helper to get tool by name
function getTool(name: string) {
  const tool = npmTools.find((t) => t.name === name);
  if (!tool) throw new Error(`Tool ${name} not found`);
  return tool;
}

describe("get_npm_package", () => {
  const tool = getTool("get_npm_package");

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns formatted package info on success", async () => {
    const mockPackage = {
      name: "react",
      description: "A JavaScript library for building user interfaces",
      homepage: "https://react.dev",
      repository: { url: "git+https://github.com/facebook/react.git" },
      bugs: { url: "https://github.com/facebook/react/issues" },
      keywords: ["react", "javascript", "ui"],
      maintainers: [{ name: "fb" }, { name: "sophiebits" }],
      "dist-tags": { latest: "18.2.0" },
      time: { "18.2.0": "2026-01-15T00:00:00Z" },
      versions: {
        "18.2.0": {
          license: "MIT",
          dependencies: { "loose-envify": "^1.1.0" },
          peerDependencies: {},
        },
      },
    };

    const mockDownloads = { downloads: 15000000 };

    vi.mocked(fetchJson)
      .mockResolvedValueOnce({ data: mockPackage, error: null })
      .mockResolvedValueOnce({ data: mockDownloads, error: null });

    const result = await tool.handler({ package_name: "react" });

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("react");
    expect(result.content[0].text).toContain("18.2.0");
    expect(result.content[0].text).toContain("MIT");
    expect(result.content[0].text).toContain("15,000,000");
  });

  it("handles scoped packages", async () => {
    const mockPackage = {
      name: "@tanstack/query",
      description: "Powerful data fetching",
      "dist-tags": { latest: "5.0.0" },
      time: { "5.0.0": "2026-01-01T00:00:00Z" },
      versions: {
        "5.0.0": {
          license: "MIT",
          dependencies: {},
          peerDependencies: { react: "^18.0.0" },
        },
      },
    };

    vi.mocked(fetchJson)
      .mockResolvedValueOnce({ data: mockPackage, error: null })
      .mockResolvedValueOnce({ data: { downloads: 1000 }, error: null });

    const result = await tool.handler({ package_name: "@tanstack/query" });

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("@tanstack/query");
    expect(result.content[0].text).toContain("react@^18.0.0");
  });

  it("handles missing optional fields", async () => {
    const mockPackage = {
      name: "minimal-pkg",
      "dist-tags": { latest: "1.0.0" },
      time: { "1.0.0": "2026-01-01T00:00:00Z" },
      versions: {
        "1.0.0": {},
      },
    };

    vi.mocked(fetchJson)
      .mockResolvedValueOnce({ data: mockPackage, error: null })
      .mockResolvedValueOnce({ data: null, error: "failed" });

    const result = await tool.handler({ package_name: "minimal-pkg" });

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("No description provided");
    expect(result.content[0].text).toContain("None");
  });

  it("truncates long dependency lists", async () => {
    const manyDeps: Record<string, string> = {};
    for (let i = 0; i < 15; i++) {
      manyDeps[`dep-${i}`] = "^1.0.0";
    }

    const mockPackage = {
      name: "many-deps",
      "dist-tags": { latest: "1.0.0" },
      time: { "1.0.0": "2026-01-01T00:00:00Z" },
      versions: {
        "1.0.0": {
          dependencies: manyDeps,
        },
      },
    };

    vi.mocked(fetchJson)
      .mockResolvedValueOnce({ data: mockPackage, error: null })
      .mockResolvedValueOnce({ data: null, error: null });

    const result = await tool.handler({ package_name: "many-deps" });

    expect(result.content[0].text).toContain("...");
  });

  it("returns error when package not found", async () => {
    vi.mocked(fetchJson).mockResolvedValueOnce({
      data: null,
      error: "HTTP 404: Not Found",
    });

    const result = await tool.handler({ package_name: "nonexistent-pkg-xyz" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Failed to fetch package info");
  });

  it("returns error when package has no versions", async () => {
    const mockPackage = {
      name: "empty-pkg",
      "dist-tags": {},
      versions: {},
    };

    vi.mocked(fetchJson)
      .mockResolvedValueOnce({ data: mockPackage, error: null })
      .mockResolvedValueOnce({ data: null, error: null }); // downloads call

    const result = await tool.handler({ package_name: "empty-pkg" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("not found or has no versions");
  });
});

describe("search_npm_packages", () => {
  const tool = getTool("search_npm_packages");

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns formatted search results on success", async () => {
    const mockResults = {
      total: 100,
      objects: [
        {
          package: {
            name: "react",
            version: "18.2.0",
            description: "A library for building UIs",
          },
          score: { final: 0.95 },
        },
        {
          package: {
            name: "react-dom",
            version: "18.2.0",
            description: "React DOM renderer",
          },
          score: { final: 0.9 },
        },
      ],
    };

    vi.mocked(fetchJson).mockResolvedValueOnce({
      data: mockResults,
      error: null,
    });

    const result = await tool.handler({ query: "react" });

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("react");
    expect(result.content[0].text).toContain("react-dom");
    expect(result.content[0].text).toContain("95%");
    expect(result.content[0].text).toContain("Found 100 packages");
  });

  it("uses custom limit parameter", async () => {
    vi.mocked(fetchJson).mockResolvedValueOnce({
      data: { total: 0, objects: [] },
      error: null,
    });

    await tool.handler({ query: "test", limit: 5 });

    expect(fetchJson).toHaveBeenCalledWith(expect.stringContaining("size=5"));
  });

  it("clamps limit to valid range", async () => {
    vi.mocked(fetchJson).mockResolvedValueOnce({
      data: { total: 0, objects: [] },
      error: null,
    });

    await tool.handler({ query: "test", limit: 100 });

    expect(fetchJson).toHaveBeenCalledWith(expect.stringContaining("size=20"));
  });

  it("handles packages without description", async () => {
    const mockResults = {
      total: 1,
      objects: [
        {
          package: {
            name: "no-desc",
            version: "1.0.0",
            description: null,
          },
          score: { final: 0.5 },
        },
      ],
    };

    vi.mocked(fetchJson).mockResolvedValueOnce({
      data: mockResults,
      error: null,
    });

    const result = await tool.handler({ query: "no-desc" });

    expect(result.content[0].text).toContain("No description");
  });

  it("returns message when no results found", async () => {
    vi.mocked(fetchJson).mockResolvedValueOnce({
      data: { total: 0, objects: [] },
      error: null,
    });

    const result = await tool.handler({ query: "xyznonexistent123" });

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("No packages found");
  });

  it("returns error on fetch failure", async () => {
    vi.mocked(fetchJson).mockResolvedValueOnce({
      data: null,
      error: "Network error",
    });

    const result = await tool.handler({ query: "test" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Failed to search npm");
  });
});

describe("get_package_versions", () => {
  const tool = getTool("get_package_versions");

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns formatted version history on success", async () => {
    const mockPackage = {
      name: "lodash",
      "dist-tags": { latest: "4.17.21", next: "5.0.0-beta.1" },
      time: {
        created: "2012-01-01T00:00:00Z",
        modified: "2026-01-01T00:00:00Z",
        "4.17.21": "2025-12-01T00:00:00Z",
        "4.17.20": "2025-11-01T00:00:00Z",
        "5.0.0-beta.1": "2026-01-01T00:00:00Z",
      },
    };

    vi.mocked(fetchJson).mockResolvedValueOnce({
      data: mockPackage,
      error: null,
    });

    const result = await tool.handler({ package_name: "lodash" });

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("4.17.21");
    expect(result.content[0].text).toContain("[latest]");
    expect(result.content[0].text).toContain("[next]");
  });

  it("uses custom limit parameter", async () => {
    const mockPackage = {
      name: "test",
      "dist-tags": { latest: "1.0.0" },
      time: {
        "1.0.0": "2026-01-03T00:00:00Z",
        "0.9.0": "2026-01-02T00:00:00Z",
        "0.8.0": "2026-01-01T00:00:00Z",
      },
    };

    vi.mocked(fetchJson).mockResolvedValueOnce({
      data: mockPackage,
      error: null,
    });

    const result = await tool.handler({ package_name: "test", limit: 2 });

    expect(result.content[0].text).toContain("Showing 2 most recent");
  });

  it("excludes created and modified from version list", async () => {
    const mockPackage = {
      name: "test",
      "dist-tags": {},
      time: {
        created: "2020-01-01T00:00:00Z",
        modified: "2026-01-01T00:00:00Z",
        "1.0.0": "2025-01-01T00:00:00Z",
      },
    };

    vi.mocked(fetchJson).mockResolvedValueOnce({
      data: mockPackage,
      error: null,
    });

    const result = await tool.handler({ package_name: "test" });

    expect(result.content[0].text).not.toContain("created");
    expect(result.content[0].text).not.toContain("modified");
    expect(result.content[0].text).toContain("1.0.0");
  });

  it("returns error when package not found", async () => {
    vi.mocked(fetchJson).mockResolvedValueOnce({
      data: null,
      error: "HTTP 404: Not Found",
    });

    const result = await tool.handler({ package_name: "nonexistent" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Failed to fetch package");
  });

  it("returns error when time data not available", async () => {
    const mockPackage = {
      name: "no-time",
      "dist-tags": { latest: "1.0.0" },
    };

    vi.mocked(fetchJson).mockResolvedValueOnce({
      data: mockPackage,
      error: null,
    });

    const result = await tool.handler({ package_name: "no-time" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Version history not available");
  });
});

describe("npm tools structure", () => {
  it("exports correct number of tools", () => {
    expect(npmTools).toHaveLength(3);
  });

  it("all tools have required properties", () => {
    for (const tool of npmTools) {
      expect(tool.name).toBeDefined();
      expect(tool.description).toBeDefined();
      expect(tool.inputSchema).toBeDefined();
      expect(tool.handler).toBeInstanceOf(Function);
    }
  });

  it("tool names are unique", () => {
    const names = npmTools.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });
});
