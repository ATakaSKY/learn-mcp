/**
 * Shared fetch utilities with error handling
 */

import type { FetchResult, McpToolResponse, Headers } from "../types/index.js";

const DEFAULT_TIMEOUT = 10000; // 10 seconds

interface FetchOptions extends RequestInit {
  timeout?: number;
  headers?: Headers;
}

/**
 * Fetch with timeout and error handling
 */
export async function fetchWithTimeout(
  url: string,
  options: FetchOptions = {}
): Promise<Response> {
  const { timeout = DEFAULT_TIMEOUT, ...fetchOptions } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Fetch JSON with error handling
 */
export async function fetchJson<T = unknown>(
  url: string,
  options: FetchOptions = {}
): Promise<FetchResult<T>> {
  try {
    const response = await fetchWithTimeout(url, options);

    if (!response.ok) {
      return {
        data: null,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const data = (await response.json()) as T;
    return { data, error: null };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { data: null, error: "Request timed out" };
    }
    return { data: null, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Fetch text content with error handling
 */
export async function fetchText(
  url: string,
  options: FetchOptions = {}
): Promise<FetchResult<string>> {
  try {
    const response = await fetchWithTimeout(url, options);

    if (!response.ok) {
      return {
        data: null,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const data = await response.text();
    return { data, error: null };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { data: null, error: "Request timed out" };
    }
    return { data: null, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Create an MCP error response
 */
export function errorResponse(message: string): McpToolResponse {
  return {
    content: [{ type: "text", text: message }],
    isError: true,
  };
}

/**
 * Create an MCP success response
 */
export function textResponse(text: string): McpToolResponse {
  return {
    content: [{ type: "text", text }],
  };
}

/**
 * Truncate text to a maximum length
 */
export function truncate(text: string, maxLength: number = 10000): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "\n\n... [truncated]";
}

/**
 * Format bytes to human readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

/**
 * Format number with commas
 */
export function formatNumber(num: number): string {
  return num.toLocaleString("en-US");
}

/**
 * Format relative time
 */
export function formatRelativeTime(date: string | Date): string {
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}
