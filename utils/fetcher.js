/**
 * Shared fetch utilities with error handling
 */

const DEFAULT_TIMEOUT = 10000; // 10 seconds

/**
 * Fetch with timeout and error handling
 * @param {string} url - URL to fetch
 * @param {object} options - Fetch options
 * @returns {Promise<Response>}
 */
export async function fetchWithTimeout(url, options = {}) {
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
 * @param {string} url - URL to fetch
 * @param {object} options - Fetch options
 * @returns {Promise<{data: any, error: string|null}>}
 */
export async function fetchJson(url, options = {}) {
  try {
    const response = await fetchWithTimeout(url, options);

    if (!response.ok) {
      return {
        data: null,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const data = await response.json();
    return { data, error: null };
  } catch (error) {
    if (error.name === "AbortError") {
      return { data: null, error: "Request timed out" };
    }
    return { data: null, error: error.message };
  }
}

/**
 * Fetch text content with error handling
 * @param {string} url - URL to fetch
 * @param {object} options - Fetch options
 * @returns {Promise<{data: string|null, error: string|null}>}
 */
export async function fetchText(url, options = {}) {
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
    if (error.name === "AbortError") {
      return { data: null, error: "Request timed out" };
    }
    return { data: null, error: error.message };
  }
}

/**
 * Create an MCP error response
 * @param {string} message - Error message
 * @returns {object} MCP error response
 */
export function errorResponse(message) {
  return {
    content: [{ type: "text", text: message }],
    isError: true,
  };
}

/**
 * Create an MCP success response
 * @param {string} text - Response text
 * @returns {object} MCP success response
 */
export function textResponse(text) {
  return {
    content: [{ type: "text", text }],
  };
}

/**
 * Truncate text to a maximum length
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length (default 10000)
 * @returns {string}
 */
export function truncate(text, maxLength = 10000) {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "\n\n... [truncated]";
}

/**
 * Format bytes to human readable string
 * @param {number} bytes - Number of bytes
 * @returns {string}
 */
export function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

/**
 * Format number with commas
 * @param {number} num - Number to format
 * @returns {string}
 */
export function formatNumber(num) {
  return num.toLocaleString("en-US");
}

/**
 * Format relative time
 * @param {string|Date} date - Date to format
 * @returns {string}
 */
export function formatRelativeTime(date) {
  const now = new Date();
  const then = new Date(date);
  const diffMs = now - then;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}
