# Architecture

Technical architecture of the **docs-fetcher** MCP server.

## Project Structure

```
docs-fetcher/
├── server.js           # Express server & MCP setup
├── tools/
│   ├── github.js       # GitHub tools (5)
│   ├── npm.js          # npm tools (3)
│   └── docs.js         # Documentation tools (2)
├── utils/
│   └── fetcher.js      # HTTP utilities & formatters
├── package.json
└── Dockerfile
```

## System Overview

```mermaid
flowchart TB
    subgraph Clients["MCP Clients"]
        Cursor["Cursor IDE"]
        Other["Other MCP Clients"]
    end

    subgraph Server["docs-fetcher MCP Server"]
        subgraph Express["Express.js"]
            Health["/health"]
            MCP["/mcp"]
        end
        
        subgraph Core["MCP Core"]
            Transport["StreamableHTTPServerTransport"]
            McpServer["McpServer"]
            Sessions["Session Manager"]
        end
        
        subgraph Tools["Tools"]
            GitHubTools["GitHub (5)"]
            NpmTools["npm (3)"]
            DocsTools["Docs (2)"]
        end
    end

    subgraph External["External APIs"]
        GitHub["GitHub API"]
        NpmRegistry["npm Registry"]
        MDN["MDN / Web"]
    end

    Clients -->|"HTTP"| MCP
    MCP --> Transport --> McpServer
    McpServer --> Sessions
    McpServer --> Tools
    Tools -->|"HTTPS"| External
```

## HTTP Layer

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/mcp` | POST | Tool calls and initialization |
| `/mcp` | GET | SSE stream for sessions |
| `/mcp` | DELETE | Session cleanup |
| `/health` | GET | Health check |

## Session Management

Each client gets a unique session with 30-minute inactivity timeout.

```mermaid
sequenceDiagram
    participant Client
    participant Server
    participant Sessions
    participant MCP

    Client->>Server: POST /mcp (no session)
    Server->>MCP: Create McpServer
    Server->>Sessions: Store session (UUID)
    Server-->>Client: Response + mcp-session-id
    
    Client->>Server: POST /mcp (with session-id)
    Server->>Sessions: Lookup
    Sessions-->>Server: Existing transport
    Server->>MCP: Handle request
    Server-->>Client: Response

    Note over Sessions: Auto-cleanup after 30 min
```

## Tool Implementation

All tools follow the same pattern:

```mermaid
flowchart LR
    A[Tool Call] --> B[Fetch from API]
    B --> C[Process Response]
    C --> D[Truncate to 8000 chars]
    D --> E[Return Text Response]
```

### External APIs Used

| Tool Category | APIs |
|---------------|------|
| GitHub | `api.github.com`, `raw.githubusercontent.com` |
| npm | `registry.npmjs.org`, `api.npmjs.org` |
| Docs | `developer.mozilla.org`, any URL |

### Tool Behaviors

- **GitHub tools**: Try branches `main` → `master` → `canary`
- **npm tools**: Fetch from both registry and downloads API
- **Docs tools**: Use Mozilla Readability for content extraction

## Dependencies

| Package | Purpose |
|---------|---------|
| `@modelcontextprotocol/sdk` | MCP protocol |
| `express` | HTTP server |
| `zod` | Input validation |
| `jsdom` | DOM parsing |
| `@mozilla/readability` | Content extraction |

## Deployment

```mermaid
flowchart LR
    Dev["Local Dev"] -->|git push| GitHub
    GitHub -->|Auto Deploy| Cloud["Render / Fly.io"]
    Cloud --> Docker["Docker Container"]
```

### Container

- Base: `node:22-alpine`
- Port: `3000` (configurable via `PORT`)
- Health check: `/health`

## Future Considerations

- [x] npm tools
- [x] Web content fetching
- [ ] PyPI tools (Python)
- [ ] Crates.io tools (Rust)
- [ ] Response caching
- [ ] Private repo auth
- [ ] Rate limiting

---

*Last updated: January 2026*
