/**
 * Core type definitions for the MCP server
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { z } from "zod";

/**
 * MCP tool response content item
 */
export interface McpTextContent {
  type: "text";
  text: string;
}

/**
 * MCP tool response
 */
export interface McpToolResponse {
  content: McpTextContent[];
  isError?: boolean;
}

/**
 * Generic fetch result with data or error
 */
export interface FetchResult<T> {
  data: T | null;
  error: string | null;
}

/**
 * MCP tool definition - uses explicit handler typing per tool
 */
export interface McpTool {
  name: string;
  description: string;
  inputSchema: z.ZodRawShape;
  handler: (args: Record<string, unknown>) => Promise<McpToolResponse>;
}

/**
 * Session object for managing MCP connections
 */
export interface Session {
  server: McpServer;
  transport: StreamableHTTPServerTransport;
}

/**
 * Request headers type helper
 */
export type Headers = Record<string, string>;
