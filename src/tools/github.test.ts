/**
 * Unit tests for tools/github.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { githubTools } from "./github.js";

// Mock the fetcher module
vi.mock("../utils/fetcher.js", () => ({
  fetchJson: vi.fn(),
  fetchText: vi.fn(),
  errorResponse: (msg: string) => ({
    content: [{ type: "text", text: msg }],
    isError: true,
  }),
  textResponse: (text: string) => ({
    content: [{ type: "text", text }],
  }),
  truncate: (text: string, max: number = 8000) =>
    text.length > max ? text.slice(0, max) + "\n\n... [truncated]" : text,
  formatNumber: (n: number) => n.toLocaleString("en-US"),
  formatRelativeTime: (date: string) => "2 days ago",
  formatBytes: (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  },
}));

import { fetchJson, fetchText } from "../utils/fetcher.js";

// Helper to get tool by name
function getTool(name: string) {
  const tool = githubTools.find((t) => t.name === name);
  if (!tool) throw new Error(`Tool ${name} not found`);
  return tool;
}

describe("fetch_github_readme", () => {
  const tool = getTool("fetch_github_readme");

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns README content on success", async () => {
    vi.mocked(fetchText).mockResolvedValueOnce({
      data: "# My Project\n\nThis is the readme.",
      error: null,
    });

    const result = await tool.handler({ owner: "facebook", repo: "react" });

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("My Project");
  });

  it("tries multiple branches and filenames", async () => {
    // First 5 attempts fail, 6th succeeds
    vi.mocked(fetchText)
      .mockResolvedValueOnce({ data: null, error: "404" })
      .mockResolvedValueOnce({ data: null, error: "404" })
      .mockResolvedValueOnce({ data: null, error: "404" })
      .mockResolvedValueOnce({ data: null, error: "404" })
      .mockResolvedValueOnce({ data: null, error: "404" })
      .mockResolvedValueOnce({ data: "# Found on master", error: null });

    const result = await tool.handler({ owner: "test", repo: "repo" });

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("Found on master");
  });

  it("returns error when README not found", async () => {
    // All attempts fail (3 branches × 3 filenames = 9 attempts)
    vi.mocked(fetchText).mockResolvedValue({ data: null, error: "404" });

    const result = await tool.handler({ owner: "test", repo: "nonexistent" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Failed to fetch README");
  });

  it("truncates long README content", async () => {
    const longContent = "a".repeat(10000);
    vi.mocked(fetchText).mockResolvedValueOnce({
      data: longContent,
      error: null,
    });

    const result = await tool.handler({ owner: "test", repo: "repo" });

    expect(result.content[0].text).toContain("[truncated]");
  });
});

describe("fetch_github_file", () => {
  const tool = getTool("fetch_github_file");

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns file content on success", async () => {
    vi.mocked(fetchText).mockResolvedValueOnce({
      data: 'export const foo = "bar";',
      error: null,
    });

    const result = await tool.handler({
      owner: "test",
      repo: "repo",
      path: "src/index.ts",
    });

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("foo");
    expect(result.content[0].text).toContain("src/index.ts");
  });

  it("uses specified branch", async () => {
    vi.mocked(fetchText).mockResolvedValueOnce({
      data: "content",
      error: null,
    });

    await tool.handler({
      owner: "test",
      repo: "repo",
      path: "file.txt",
      branch: "develop",
    });

    expect(fetchText).toHaveBeenCalledWith(
      expect.stringContaining("/develop/")
    );
  });

  it("tries main and master branches when branch not specified", async () => {
    vi.mocked(fetchText)
      .mockResolvedValueOnce({ data: null, error: "404" })
      .mockResolvedValueOnce({ data: "found on master", error: null });

    const result = await tool.handler({
      owner: "test",
      repo: "repo",
      path: "file.txt",
    });

    expect(result.isError).toBeUndefined();
    expect(fetchText).toHaveBeenCalledTimes(2);
  });

  it("returns error when file not found", async () => {
    vi.mocked(fetchText).mockResolvedValue({ data: null, error: "404" });

    const result = await tool.handler({
      owner: "test",
      repo: "repo",
      path: "nonexistent.ts",
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Failed to fetch file");
  });
});

describe("get_repo_info", () => {
  const tool = getTool("get_repo_info");

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns formatted repo info on success", async () => {
    const mockRepo = {
      full_name: "facebook/react",
      description: "A JavaScript library for building UIs",
      stargazers_count: 200000,
      forks_count: 40000,
      subscribers_count: 6000,
      open_issues_count: 500,
      license: { name: "MIT" },
      language: "JavaScript",
      topics: ["javascript", "react", "frontend"],
      created_at: "2013-05-24T00:00:00Z",
      pushed_at: "2026-01-30T00:00:00Z",
      default_branch: "main",
      html_url: "https://github.com/facebook/react",
      homepage: "https://react.dev",
      has_wiki: true,
    };

    const mockLanguages = {
      JavaScript: 1000000,
      TypeScript: 500000,
      CSS: 50000,
    };

    vi.mocked(fetchJson)
      .mockResolvedValueOnce({ data: mockRepo, error: null })
      .mockResolvedValueOnce({ data: mockLanguages, error: null });

    const result = await tool.handler({ owner: "facebook", repo: "react" });

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("facebook/react");
    expect(result.content[0].text).toContain("200,000");
    expect(result.content[0].text).toContain("MIT");
    expect(result.content[0].text).toContain("JavaScript");
  });

  it("handles missing optional fields", async () => {
    const mockRepo = {
      full_name: "test/repo",
      description: null,
      stargazers_count: 10,
      forks_count: 2,
      subscribers_count: 0,
      open_issues_count: 1,
      license: null,
      language: null,
      topics: [],
      created_at: "2025-01-01T00:00:00Z",
      pushed_at: "2025-01-02T00:00:00Z",
      default_branch: "main",
      html_url: "https://github.com/test/repo",
      homepage: null,
      has_wiki: false,
    };

    vi.mocked(fetchJson)
      .mockResolvedValueOnce({ data: mockRepo, error: null })
      .mockResolvedValueOnce({ data: null, error: "failed" });

    const result = await tool.handler({ owner: "test", repo: "repo" });

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("No description provided");
    expect(result.content[0].text).toContain("Not specified");
  });

  it("returns error when repo not found", async () => {
    vi.mocked(fetchJson).mockResolvedValueOnce({
      data: null,
      error: "HTTP 404: Not Found",
    });

    const result = await tool.handler({ owner: "test", repo: "nonexistent" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Failed to fetch repo info");
  });
});

describe("list_repo_contents", () => {
  const tool = getTool("list_repo_contents");

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns directory listing on success", async () => {
    const mockContents = [
      { name: "src", type: "dir", size: 0 },
      { name: "package.json", type: "file", size: 1024 },
      { name: "README.md", type: "file", size: 2048 },
    ];

    vi.mocked(fetchJson).mockResolvedValueOnce({
      data: mockContents,
      error: null,
    });

    const result = await tool.handler({ owner: "test", repo: "repo" });

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("📁 src");
    expect(result.content[0].text).toContain("📄 package.json");
    expect(result.content[0].text).toContain("📄 README.md");
  });

  it("sorts directories before files", async () => {
    const mockContents = [
      { name: "file.txt", type: "file", size: 100 },
      { name: "aaa-dir", type: "dir", size: 0 },
      { name: "zzz-dir", type: "dir", size: 0 },
    ];

    vi.mocked(fetchJson).mockResolvedValueOnce({
      data: mockContents,
      error: null,
    });

    const result = await tool.handler({ owner: "test", repo: "repo" });

    const text = result.content[0].text;
    const aaaDirIndex = text.indexOf("aaa-dir");
    const zzzDirIndex = text.indexOf("zzz-dir");
    const fileIndex = text.indexOf("file.txt");

    expect(aaaDirIndex).toBeLessThan(zzzDirIndex);
    expect(zzzDirIndex).toBeLessThan(fileIndex);
  });

  it("handles subdirectory path", async () => {
    vi.mocked(fetchJson).mockResolvedValueOnce({
      data: [{ name: "index.ts", type: "file", size: 500 }],
      error: null,
    });

    const result = await tool.handler({
      owner: "test",
      repo: "repo",
      path: "src/utils",
    });

    expect(result.content[0].text).toContain("src/utils");
  });

  it("returns error when path is a file", async () => {
    const mockFile = { name: "file.txt", type: "file", size: 100 };

    vi.mocked(fetchJson).mockResolvedValueOnce({
      data: mockFile,
      error: null,
    });

    const result = await tool.handler({
      owner: "test",
      repo: "repo",
      path: "file.txt",
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("is a file, not a directory");
  });

  it("returns error when path not found", async () => {
    vi.mocked(fetchJson).mockResolvedValueOnce({
      data: null,
      error: "HTTP 404: Not Found",
    });

    const result = await tool.handler({
      owner: "test",
      repo: "repo",
      path: "nonexistent",
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Failed to list contents");
  });
});

describe("get_github_releases", () => {
  const tool = getTool("get_github_releases");

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns formatted releases on success", async () => {
    const mockReleases = [
      {
        tag_name: "v1.0.0",
        name: "Version 1.0.0",
        published_at: "2026-01-20T00:00:00Z",
        prerelease: false,
        body: "## Changes\n- Feature A\n- Bug fix B",
      },
      {
        tag_name: "v0.9.0",
        name: "Beta Release",
        published_at: "2026-01-10T00:00:00Z",
        prerelease: true,
        body: "Beta features",
      },
    ];

    vi.mocked(fetchJson).mockResolvedValueOnce({
      data: mockReleases,
      error: null,
    });

    const result = await tool.handler({ owner: "test", repo: "repo" });

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("Version 1.0.0");
    expect(result.content[0].text).toContain("v1.0.0");
    expect(result.content[0].text).toContain("[PRE-RELEASE]");
  });

  it("uses custom count parameter", async () => {
    vi.mocked(fetchJson).mockResolvedValueOnce({
      data: [],
      error: null,
    });

    await tool.handler({ owner: "test", repo: "repo", count: 3 });

    expect(fetchJson).toHaveBeenCalledWith(
      expect.stringContaining("per_page=3"),
      expect.any(Object)
    );
  });

  it("clamps count to valid range", async () => {
    vi.mocked(fetchJson).mockResolvedValueOnce({
      data: [],
      error: null,
    });

    await tool.handler({ owner: "test", repo: "repo", count: 100 });

    expect(fetchJson).toHaveBeenCalledWith(
      expect.stringContaining("per_page=10"),
      expect.any(Object)
    );
  });

  it("handles release with no body", async () => {
    vi.mocked(fetchJson).mockResolvedValueOnce({
      data: [
        {
          tag_name: "v1.0.0",
          name: null,
          published_at: "2026-01-20T00:00:00Z",
          prerelease: false,
          body: null,
        },
      ],
      error: null,
    });

    const result = await tool.handler({ owner: "test", repo: "repo" });

    expect(result.content[0].text).toContain("No release notes provided");
  });

  it("returns message when no releases found", async () => {
    vi.mocked(fetchJson).mockResolvedValueOnce({
      data: [],
      error: null,
    });

    const result = await tool.handler({ owner: "test", repo: "repo" });

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("No releases found");
  });

  it("returns error on fetch failure", async () => {
    vi.mocked(fetchJson).mockResolvedValueOnce({
      data: null,
      error: "HTTP 404: Not Found",
    });

    const result = await tool.handler({ owner: "test", repo: "nonexistent" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Failed to fetch releases");
  });
});

describe("GitHub tools structure", () => {
  it("exports correct number of tools", () => {
    expect(githubTools).toHaveLength(5);
  });

  it("all tools have required properties", () => {
    for (const tool of githubTools) {
      expect(tool.name).toBeDefined();
      expect(tool.description).toBeDefined();
      expect(tool.inputSchema).toBeDefined();
      expect(tool.handler).toBeInstanceOf(Function);
    }
  });

  it("tool names are unique", () => {
    const names = githubTools.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });
});
