/**
 * Unit tests for utils/fetcher.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  fetchWithTimeout,
  fetchJson,
  fetchText,
  errorResponse,
  textResponse,
  truncate,
  formatBytes,
  formatNumber,
  formatRelativeTime,
} from "./fetcher.js";

// ============================================================================
// Pure Function Tests (no mocking required)
// ============================================================================

describe("truncate", () => {
  it("returns text unchanged if under limit", () => {
    const text = "Hello, world!";
    expect(truncate(text, 100)).toBe(text);
  });

  it("returns text unchanged if exactly at limit", () => {
    const text = "12345";
    expect(truncate(text, 5)).toBe(text);
  });

  it("truncates and adds marker if over limit", () => {
    const text = "Hello, world!";
    const result = truncate(text, 5);
    expect(result).toBe("Hello\n\n... [truncated]");
  });

  it("uses default limit of 10000", () => {
    const shortText = "a".repeat(9999);
    const longText = "a".repeat(10001);

    expect(truncate(shortText)).toBe(shortText);
    expect(truncate(longText)).toContain("... [truncated]");
    expect(truncate(longText).length).toBe(10000 + "\n\n... [truncated]".length);
  });
});

describe("formatBytes", () => {
  it("formats 0 bytes", () => {
    expect(formatBytes(0)).toBe("0 B");
  });

  it("formats bytes under 1KB", () => {
    expect(formatBytes(500)).toBe("500 B");
    expect(formatBytes(1023)).toBe("1023 B");
  });

  it("formats KB values", () => {
    expect(formatBytes(1024)).toBe("1 KB");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(10240)).toBe("10 KB");
  });

  it("formats MB values", () => {
    expect(formatBytes(1048576)).toBe("1 MB");
    expect(formatBytes(1572864)).toBe("1.5 MB");
  });

  it("formats GB values", () => {
    expect(formatBytes(1073741824)).toBe("1 GB");
  });
});

describe("formatNumber", () => {
  it("formats small numbers without commas", () => {
    expect(formatNumber(0)).toBe("0");
    expect(formatNumber(999)).toBe("999");
  });

  it("formats thousands with commas", () => {
    expect(formatNumber(1000)).toBe("1,000");
    expect(formatNumber(12345)).toBe("12,345");
  });

  it("formats millions with commas", () => {
    expect(formatNumber(1000000)).toBe("1,000,000");
    expect(formatNumber(1234567)).toBe("1,234,567");
  });

  it("formats negative numbers", () => {
    expect(formatNumber(-1000)).toBe("-1,000");
  });
});

describe("formatRelativeTime", () => {
  beforeEach(() => {
    // Mock Date to control "now"
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-31T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "today" for same day', () => {
    expect(formatRelativeTime("2026-01-31T08:00:00Z")).toBe("today");
  });

  it('returns "yesterday" for 1 day ago', () => {
    expect(formatRelativeTime("2026-01-30T12:00:00Z")).toBe("yesterday");
  });

  it("returns days ago for 2-6 days", () => {
    expect(formatRelativeTime("2026-01-29T12:00:00Z")).toBe("2 days ago");
    expect(formatRelativeTime("2026-01-26T12:00:00Z")).toBe("5 days ago");
  });

  it("returns weeks ago for 7-29 days", () => {
    expect(formatRelativeTime("2026-01-24T12:00:00Z")).toBe("1 weeks ago");
    expect(formatRelativeTime("2026-01-17T12:00:00Z")).toBe("2 weeks ago");
  });

  it("returns months ago for 30-364 days", () => {
    expect(formatRelativeTime("2026-01-01T12:00:00Z")).toBe("1 months ago");
    expect(formatRelativeTime("2025-10-31T12:00:00Z")).toBe("3 months ago");
  });

  it("returns years ago for 365+ days", () => {
    expect(formatRelativeTime("2025-01-31T12:00:00Z")).toBe("1 years ago");
    expect(formatRelativeTime("2024-01-31T12:00:00Z")).toBe("2 years ago");
  });

  it("accepts Date objects", () => {
    expect(formatRelativeTime(new Date("2026-01-31T08:00:00Z"))).toBe("today");
  });
});

describe("errorResponse", () => {
  it("creates correct MCP error response structure", () => {
    const result = errorResponse("Something went wrong");

    expect(result).toEqual({
      content: [{ type: "text", text: "Something went wrong" }],
      isError: true,
    });
  });

  it("handles empty message", () => {
    const result = errorResponse("");

    expect(result.content[0].text).toBe("");
    expect(result.isError).toBe(true);
  });
});

describe("textResponse", () => {
  it("creates correct MCP success response structure", () => {
    const result = textResponse("Success message");

    expect(result).toEqual({
      content: [{ type: "text", text: "Success message" }],
    });
  });

  it("does not include isError property", () => {
    const result = textResponse("test");

    expect(result.isError).toBeUndefined();
  });

  it("handles multiline text", () => {
    const multiline = "Line 1\nLine 2\nLine 3";
    const result = textResponse(multiline);

    expect(result.content[0].text).toBe(multiline);
  });
});

// ============================================================================
// Fetch Function Tests (mocking required)
// ============================================================================

describe("fetchWithTimeout", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("makes fetch request with provided URL", async () => {
    const mockResponse = new Response("OK", { status: 200 });
    vi.mocked(fetch).mockResolvedValue(mockResponse);

    await fetchWithTimeout("https://example.com/api");

    expect(fetch).toHaveBeenCalledWith(
      "https://example.com/api",
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });

  it("passes custom options to fetch", async () => {
    const mockResponse = new Response("OK", { status: 200 });
    vi.mocked(fetch).mockResolvedValue(mockResponse);

    await fetchWithTimeout("https://example.com/api", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    expect(fetch).toHaveBeenCalledWith(
      "https://example.com/api",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
    );
  });

  it("aborts request after timeout", async () => {
    // Create a fetch that respects the abort signal
    vi.mocked(fetch).mockImplementation((_url, options) => {
      return new Promise((_, reject) => {
        const signal = options?.signal as AbortSignal;
        if (signal) {
          signal.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        }
      });
    });

    // Use a very short timeout
    await expect(
      fetchWithTimeout("https://example.com", { timeout: 10 })
    ).rejects.toThrow("Aborted");
  });
});

describe("fetchJson", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns parsed JSON on success", async () => {
    const mockData = { name: "test", value: 123 };
    const mockResponse = new Response(JSON.stringify(mockData), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
    vi.mocked(fetch).mockResolvedValue(mockResponse);

    const result = await fetchJson<{ name: string; value: number }>(
      "https://api.example.com/data"
    );

    expect(result.data).toEqual(mockData);
    expect(result.error).toBeNull();
  });

  it("returns error on HTTP error status", async () => {
    const mockResponse = new Response("Not Found", {
      status: 404,
      statusText: "Not Found",
    });
    vi.mocked(fetch).mockResolvedValue(mockResponse);

    const result = await fetchJson("https://api.example.com/missing");

    expect(result.data).toBeNull();
    expect(result.error).toBe("HTTP 404: Not Found");
  });

  it("returns error on 500 status", async () => {
    const mockResponse = new Response("Internal Server Error", {
      status: 500,
      statusText: "Internal Server Error",
    });
    vi.mocked(fetch).mockResolvedValue(mockResponse);

    const result = await fetchJson("https://api.example.com/error");

    expect(result.data).toBeNull();
    expect(result.error).toBe("HTTP 500: Internal Server Error");
  });

  it("returns error on network failure", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("Network error"));

    const result = await fetchJson("https://api.example.com/fail");

    expect(result.data).toBeNull();
    expect(result.error).toBe("Network error");
  });

  it("returns error on timeout (AbortError)", async () => {
    const abortError = new DOMException("Aborted", "AbortError");
    vi.mocked(fetch).mockRejectedValue(abortError);

    const result = await fetchJson("https://api.example.com/slow");

    expect(result.data).toBeNull();
    expect(result.error).toBe("Request timed out");
  });

  it("returns error on invalid JSON", async () => {
    const mockResponse = new Response("not valid json {{{", {
      status: 200,
    });
    vi.mocked(fetch).mockResolvedValue(mockResponse);

    const result = await fetchJson("https://api.example.com/bad-json");

    expect(result.data).toBeNull();
    expect(result.error).toBeTruthy();
  });

  it("handles non-Error thrown values", async () => {
    vi.mocked(fetch).mockRejectedValue("string error");

    const result = await fetchJson("https://api.example.com/weird-error");

    expect(result.data).toBeNull();
    expect(result.error).toBe("string error");
  });
});

describe("fetchText", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns text content on success", async () => {
    const textContent = "# Hello World\n\nThis is markdown content.";
    const mockResponse = new Response(textContent, { status: 200 });
    vi.mocked(fetch).mockResolvedValue(mockResponse);

    const result = await fetchText("https://example.com/readme.md");

    expect(result.data).toBe(textContent);
    expect(result.error).toBeNull();
  });

  it("returns error on HTTP error status", async () => {
    const mockResponse = new Response("Forbidden", {
      status: 403,
      statusText: "Forbidden",
    });
    vi.mocked(fetch).mockResolvedValue(mockResponse);

    const result = await fetchText("https://example.com/private");

    expect(result.data).toBeNull();
    expect(result.error).toBe("HTTP 403: Forbidden");
  });

  it("returns error on network failure", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("DNS resolution failed"));

    const result = await fetchText("https://nonexistent.example.com");

    expect(result.data).toBeNull();
    expect(result.error).toBe("DNS resolution failed");
  });

  it("returns error on timeout (AbortError)", async () => {
    const abortError = new DOMException("Aborted", "AbortError");
    vi.mocked(fetch).mockRejectedValue(abortError);

    const result = await fetchText("https://slow.example.com");

    expect(result.data).toBeNull();
    expect(result.error).toBe("Request timed out");
  });

  it("handles empty response body", async () => {
    const mockResponse = new Response("", { status: 200 });
    vi.mocked(fetch).mockResolvedValue(mockResponse);

    const result = await fetchText("https://example.com/empty");

    expect(result.data).toBe("");
    expect(result.error).toBeNull();
  });

  it("handles non-Error thrown values", async () => {
    vi.mocked(fetch).mockRejectedValue({ code: "UNKNOWN" });

    const result = await fetchText("https://example.com/weird");

    expect(result.data).toBeNull();
    expect(result.error).toBe("[object Object]");
  });
});
