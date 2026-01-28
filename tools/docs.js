/**
 * Documentation fetching MCP tools
 */

import { z } from "zod";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import {
  fetchText,
  fetchJson,
  errorResponse,
  textResponse,
  truncate,
} from "../utils/fetcher.js";

const MDN_API = "https://developer.mozilla.org/api/v1/search";

/**
 * Tool definitions for documentation
 */
export const docsTools = [
  {
    name: "fetch_url_content",
    description:
      "Fetch and extract readable text content from any URL. Useful for reading documentation pages, blog posts, or articles.",
    inputSchema: {
      url: z.string().url().describe("The URL to fetch content from"),
    },
    handler: async ({ url }) => {
      const { data: html, error } = await fetchText(url);

      if (error) {
        return errorResponse(`Failed to fetch URL: ${error}`);
      }

      try {
        // Parse HTML with JSDOM
        const dom = new JSDOM(html, { url });
        const document = dom.window.document;

        // Use Readability to extract main content
        const reader = new Readability(document);
        const article = reader.parse();

        if (!article || !article.textContent) {
          // Fallback: try to get body text directly
          const body = document.body;
          if (body) {
            // Remove scripts and styles
            body
              .querySelectorAll("script, style, nav, footer, header")
              .forEach((el) => el.remove());
            const text = body.textContent?.trim();
            if (text) {
              return textResponse(
                `# Content from ${url}\n\n${truncate(text, 8000)}`,
              );
            }
          }
          return errorResponse(
            "Could not extract readable content from this URL. The page may be JavaScript-rendered or have an unusual structure.",
          );
        }

        const content = `
# ${article.title || "Untitled"}

**Source:** ${url}
${article.byline ? `**Author:** ${article.byline}` : ""}

---

${truncate(article.textContent, 8000)}
`.trim();

        return textResponse(content);
      } catch (err) {
        return errorResponse(`Failed to parse page content: ${err.message}`);
      }
    },
  },

  {
    name: "search_mdn",
    description:
      "Search MDN Web Docs for JavaScript, HTML, CSS, and Web API documentation",
    inputSchema: {
      query: z
        .string()
        .describe("Search query (e.g., 'Array.map', 'flexbox', 'fetch API')"),
    },
    handler: async ({ query }) => {
      const url = `${MDN_API}?q=${encodeURIComponent(query)}&locale=en-US`;
      const { data, error } = await fetchJson(url);

      if (error) {
        return errorResponse(`Failed to search MDN: ${error}`);
      }

      if (!data.documents || data.documents.length === 0) {
        return textResponse(`No MDN results found for "${query}".`);
      }

      const results = data.documents.slice(0, 8).map((doc, index) => {
        const docUrl = `https://developer.mozilla.org${doc.mdn_url}`;
        return `
${index + 1}. **${doc.title}**
   ${doc.summary || "No summary available"}
   🔗 ${docUrl}
`.trim();
      });

      const header = `# MDN Search Results for "${query}"\n\nFound ${data.metadata?.total?.value || data.documents.length} results:\n\n`;
      const footer = `\n\n---\nTip: Use fetch_url_content to read the full documentation for any of these links.`;

      return textResponse(header + results.join("\n\n") + footer);
    },
  },
];
