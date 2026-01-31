/**
 * Unit tests for tools/docs.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock state that can be controlled per-test
let mockReadabilityResult: unknown = {
  title: "Test Article",
  textContent: "This is the main article content.",
  byline: "John Doe",
};
let mockBodyText = "Fallback body text";
let mockJSDOMShouldThrow = false;

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
}));

// Mock JSDOM as a class
vi.mock("jsdom", () => {
  return {
    JSDOM: class MockJSDOM {
      window: { document: { body: unknown } };
      constructor() {
        if (mockJSDOMShouldThrow) {
          throw new Error("JSDOM parse error");
        }
        this.window = {
          document: {
            body: {
              textContent: mockBodyText,
              querySelectorAll: () => ({
                forEach: () => {},
              }),
            },
          },
        };
      }
    },
  };
});

// Mock Readability as a class
vi.mock("@mozilla/readability", () => {
  return {
    Readability: class MockReadability {
      parse() {
        return mockReadabilityResult;
      }
    },
  };
});

import { docsTools } from "./docs.js";
import { fetchJson, fetchText } from "../utils/fetcher.js";

// Helper to get tool by name
function getTool(name: string) {
  const tool = docsTools.find((t) => t.name === name);
  if (!tool) throw new Error(`Tool ${name} not found`);
  return tool;
}

describe("fetch_url_content", () => {
  const tool = getTool("fetch_url_content");

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock state to defaults
    mockReadabilityResult = {
      title: "Test Article",
      textContent: "This is the main article content.",
      byline: "John Doe",
    };
    mockBodyText = "Fallback body text";
    mockJSDOMShouldThrow = false;
  });

  it("returns parsed article content on success", async () => {
    vi.mocked(fetchText).mockResolvedValueOnce({
      data: "<html><body><article>Content here</article></body></html>",
      error: null,
    });

    const result = await tool.handler({ url: "https://example.com/article" });

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("Test Article");
    expect(result.content[0].text).toContain("main article content");
    expect(result.content[0].text).toContain("John Doe");
  });

  it("includes source URL in response", async () => {
    vi.mocked(fetchText).mockResolvedValueOnce({
      data: "<html><body>Content</body></html>",
      error: null,
    });

    const result = await tool.handler({ url: "https://docs.example.com/api" });

    expect(result.content[0].text).toContain("https://docs.example.com/api");
  });

  it("returns error when fetch fails", async () => {
    vi.mocked(fetchText).mockResolvedValueOnce({
      data: null,
      error: "HTTP 404: Not Found",
    });

    const result = await tool.handler({ url: "https://example.com/missing" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Failed to fetch URL");
  });

  it("returns error on empty response", async () => {
    vi.mocked(fetchText).mockResolvedValueOnce({
      data: "",
      error: null,
    });

    const result = await tool.handler({ url: "https://example.com/empty" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("empty response");
  });

  it("falls back to body text when Readability returns null", async () => {
    // Make Readability return null to trigger fallback path
    mockReadabilityResult = null;
    mockBodyText = "Fallback body content from document";

    vi.mocked(fetchText).mockResolvedValueOnce({
      data: "<html><body>Raw body content</body></html>",
      error: null,
    });

    const result = await tool.handler({ url: "https://example.com/simple" });

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("Fallback body content");
  });

  it("falls back to body text when article has no textContent", async () => {
    // Make Readability return article without textContent
    mockReadabilityResult = { title: "Empty Article", textContent: "" };
    mockBodyText = "Body text fallback";

    vi.mocked(fetchText).mockResolvedValueOnce({
      data: "<html><body>Content</body></html>",
      error: null,
    });

    const result = await tool.handler({ url: "https://example.com/empty-article" });

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("Body text fallback");
  });

  it("returns error when no content can be extracted", async () => {
    // Make both Readability and body text fail
    mockReadabilityResult = null;
    mockBodyText = "   "; // Only whitespace

    vi.mocked(fetchText).mockResolvedValueOnce({
      data: "<html><body></body></html>",
      error: null,
    });

    const result = await tool.handler({ url: "https://example.com/empty-page" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Could not extract readable content");
  });

  it("handles parsing errors gracefully", async () => {
    mockJSDOMShouldThrow = true;

    vi.mocked(fetchText).mockResolvedValueOnce({
      data: "not valid html at all <<<>>>",
      error: null,
    });

    const result = await tool.handler({ url: "https://example.com/bad" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Failed to parse page content");
  });

  it("handles article without byline", async () => {
    mockReadabilityResult = {
      title: "No Author Article",
      textContent: "Content without author",
      byline: null,
    };

    vi.mocked(fetchText).mockResolvedValueOnce({
      data: "<html><body>Content</body></html>",
      error: null,
    });

    const result = await tool.handler({ url: "https://example.com/no-author" });

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("No Author Article");
  });

  it("handles article without title", async () => {
    mockReadabilityResult = {
      title: null,
      textContent: "Content without title",
      byline: null,
    };

    vi.mocked(fetchText).mockResolvedValueOnce({
      data: "<html><body>Content</body></html>",
      error: null,
    });

    const result = await tool.handler({ url: "https://example.com/no-title" });

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("Untitled");
  });
});

describe("search_mdn", () => {
  const tool = getTool("search_mdn");

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns formatted search results on success", async () => {
    const mockResults = {
      documents: [
        {
          title: "Array.prototype.map()",
          mdn_url: "/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/map",
          summary: "The map() method creates a new array.",
        },
        {
          title: "Array.prototype.forEach()",
          mdn_url: "/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/forEach",
          summary: "The forEach() method executes a function for each element.",
        },
      ],
      metadata: {
        total: { value: 50 },
      },
    };

    vi.mocked(fetchJson).mockResolvedValueOnce({
      data: mockResults,
      error: null,
    });

    const result = await tool.handler({ query: "array map" });

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("Array.prototype.map()");
    expect(result.content[0].text).toContain("developer.mozilla.org");
    expect(result.content[0].text).toContain("Found 50 results");
  });

  it("limits results to 8", async () => {
    const manyDocs = Array.from({ length: 15 }, (_, i) => ({
      title: `Doc ${i}`,
      mdn_url: `/doc-${i}`,
      summary: `Summary ${i}`,
    }));

    vi.mocked(fetchJson).mockResolvedValueOnce({
      data: { documents: manyDocs, metadata: { total: { value: 15 } } },
      error: null,
    });

    const result = await tool.handler({ query: "test" });

    // Count occurrences of "🔗" which appears for each result
    const linkCount = (result.content[0].text.match(/🔗/g) || []).length;
    expect(linkCount).toBe(8);
  });

  it("handles documents without summary", async () => {
    vi.mocked(fetchJson).mockResolvedValueOnce({
      data: {
        documents: [
          { title: "No Summary Doc", mdn_url: "/doc", summary: null },
        ],
        metadata: { total: { value: 1 } },
      },
      error: null,
    });

    const result = await tool.handler({ query: "test" });

    expect(result.content[0].text).toContain("No summary available");
  });

  it("returns message when no results found", async () => {
    vi.mocked(fetchJson).mockResolvedValueOnce({
      data: { documents: [], metadata: {} },
      error: null,
    });

    const result = await tool.handler({ query: "xyznonexistent123" });

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("No MDN results found");
  });

  it("returns error on fetch failure", async () => {
    vi.mocked(fetchJson).mockResolvedValueOnce({
      data: null,
      error: "Network error",
    });

    const result = await tool.handler({ query: "test" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Failed to search MDN");
  });

  it("includes tip about fetch_url_content", async () => {
    vi.mocked(fetchJson).mockResolvedValueOnce({
      data: {
        documents: [{ title: "Test", mdn_url: "/test", summary: "Test" }],
        metadata: { total: { value: 1 } },
      },
      error: null,
    });

    const result = await tool.handler({ query: "test" });

    expect(result.content[0].text).toContain("fetch_url_content");
  });

  it("encodes query parameter correctly", async () => {
    vi.mocked(fetchJson).mockResolvedValueOnce({
      data: { documents: [], metadata: {} },
      error: null,
    });

    await tool.handler({ query: "Array.map javascript" });

    expect(fetchJson).toHaveBeenCalledWith(
      expect.stringContaining("Array.map%20javascript")
    );
  });
});

describe("docs tools structure", () => {
  it("exports correct number of tools", () => {
    expect(docsTools).toHaveLength(2);
  });

  it("all tools have required properties", () => {
    for (const tool of docsTools) {
      expect(tool.name).toBeDefined();
      expect(tool.description).toBeDefined();
      expect(tool.inputSchema).toBeDefined();
      expect(tool.handler).toBeInstanceOf(Function);
    }
  });

  it("tool names are unique", () => {
    const names = docsTools.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });
});
