# docs-fetcher MCP Server

A comprehensive MCP (Model Context Protocol) server for fetching developer documentation from GitHub, npm, and the web.

## Quick Start

```bash
# Install dependencies
npm install

# Start the server
npm start
```

The server runs at `http://localhost:3000/mcp`

### Configure with Cursor

Add to your `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "docs-fetcher": {
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

## Available Tools

### GitHub Tools

| Tool                  | What to ask                                            |
| --------------------- | ------------------------------------------------------ |
| `fetch_github_readme` | "Fetch the README from TanStack/query"                 |
| `fetch_github_file`   | "Get the package.json from facebook/react"             |
| `get_repo_info`       | "How many stars does vercel/next.js have?"             |
| `list_repo_contents`  | "What files are in the src folder of TanStack/router?" |
| `get_github_releases` | "What's new in the latest releases of prisma/prisma?"  |

### npm Tools

| Tool                   | What to ask                                      |
| ---------------------- | ------------------------------------------------ |
| `get_npm_package`      | "Tell me about the zod package"                  |
| `search_npm_packages`  | "Find React form libraries"                      |
| `get_package_versions` | "When was the last version of express released?" |

### Documentation Tools

| Tool                | What to ask                                                 |
| ------------------- | ----------------------------------------------------------- |
| `fetch_url_content` | "Fetch the Quick Start guide from https://tanstack.com/..." |
| `search_mdn`        | "How does Promise.allSettled work?"                         |

## Testing

```bash
# Run tests once
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## Environment Variables

| Variable       | Description                                                        |
| -------------- | ------------------------------------------------------------------ |
| `PORT`         | Server port (default: 3000)                                        |
| `GITHUB_TOKEN` | Optional GitHub token for higher API rate limits (60/hr → 5000/hr) |

## Deployment

### Docker

```bash
docker build -t docs-fetcher-mcp .
docker run -p 3000:3000 docs-fetcher-mcp
```

### Cloud Platforms

Works with any Docker-compatible platform:

```bash
# Render / Railway
# Connect your GitHub repo - auto-detects Dockerfile
```

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for technical details, diagrams, and internals.

## License

MIT
