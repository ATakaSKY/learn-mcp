# docs-fetcher MCP Server

An MCP (Model Context Protocol) server that fetches README files from public GitHub repositories.

## Installation

```bash
npm install
```

## Usage

### Running the server

```bash
npm start
```

### Configuring with Cursor

Add this to your Cursor MCP settings (`.cursor/mcp.json` in your home directory or project):

```json
{
  "mcpServers": {
    "docs-fetcher": {
      "command": "node",
      "args": ["/Users/aakashthakur/Desktop/Development/2026/my-mcp/server.js"]
    }
  }
}
```

## Tools

### fetch_github_readme

Fetches the README.md file from a public GitHub repository.

**Parameters:**
- `owner` (string): GitHub repository owner/organization
- `repo` (string): GitHub repository name

**Example:**
```
Fetch the README for facebook/react
```

The tool will return the README content (truncated to 5000 characters for safety).
