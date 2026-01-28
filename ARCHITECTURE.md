# Architecture

This document describes the architecture of the **docs-fetcher** MCP server.

## Overview

The docs-fetcher is a Model Context Protocol (MCP) server that provides tools for fetching documentation from external sources. It exposes an HTTP-based MCP endpoint that AI assistants (like Cursor) can connect to.

## System Architecture

```mermaid
flowchart TB
    subgraph Clients["MCP Clients"]
        Cursor["Cursor IDE"]
        Other["Other MCP Clients"]
    end

    subgraph Server["docs-fetcher MCP Server"]
        subgraph Express["Express.js HTTP Layer"]
            Health["/health endpoint"]
            MCP["/mcp endpoint"]
        end
        
        subgraph Core["MCP Core"]
            Transport["StreamableHTTPServerTransport"]
            McpServer["McpServer Instance"]
            Sessions["Session Manager"]
        end
        
        subgraph Tools["Registered Tools"]
            FetchReadme["fetch_github_readme"]
        end
    end

    subgraph External["External Services"]
        GitHub["GitHub Raw Content API"]
    end

    subgraph Deployment["Deployment"]
        Docker["Docker Container"]
        Render["Render.com"]
    end

    Cursor -->|"HTTP POST/GET"| MCP
    Other -->|"HTTP POST/GET"| MCP
    MCP --> Transport
    Transport --> McpServer
    McpServer --> Sessions
    McpServer --> FetchReadme
    FetchReadme -->|"HTTPS"| GitHub
    Docker --> Render
```

## Component Details

### HTTP Layer (Express.js)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check - returns server status |
| `/mcp` | POST | Main MCP endpoint for tool calls and initialization |
| `/mcp` | GET | SSE stream endpoint for existing sessions |
| `/mcp` | DELETE | Session cleanup |

### MCP Server

The core MCP server handles:
- **Protocol negotiation** - Implements MCP specification
- **Tool registration** - Registers available tools with schemas
- **Session management** - Creates and manages client sessions
- **Request routing** - Routes tool calls to appropriate handlers

### Session Management

```mermaid
sequenceDiagram
    participant Client as MCP Client
    participant Server as Express Server
    participant Session as Session Store
    participant MCP as MCP Server

    Client->>Server: POST /mcp (no session)
    Server->>MCP: Create new McpServer
    Server->>Session: Store session (UUID)
    Server-->>Client: Response + mcp-session-id header
    
    Client->>Server: POST /mcp (with session-id)
    Server->>Session: Lookup session
    Session-->>Server: Existing transport
    Server->>MCP: Handle request
    Server-->>Client: Response

    Note over Session: Auto-cleanup after 30 min inactivity
```

### Registered Tools

#### `fetch_github_readme`

Fetches README files from public GitHub repositories.

| Parameter | Type | Description |
|-----------|------|-------------|
| `owner` | string | GitHub repository owner/organization |
| `repo` | string | GitHub repository name |

**Behavior:**
1. Tries multiple branch names: `main`, `master`, `canary`
2. Tries multiple filename variations: `README.md`, `readme.md`, `Readme.md`
3. Returns first successful match (truncated to 5000 chars)
4. Returns error if no README found

```mermaid
flowchart LR
    A[Tool Call] --> B{Try branch/filename}
    B -->|main/README.md| C[Fetch from GitHub]
    C -->|404| B
    C -->|200| D[Return content]
    B -->|All failed| E[Return error]
```

## Deployment Architecture

```mermaid
flowchart LR
    subgraph Development
        Local["Local Dev<br/>npm start"]
    end

    subgraph Production
        subgraph Render["Render.com"]
            WebService["Web Service"]
            Docker["Docker Container<br/>Node 22 Alpine"]
        end
    end

    subgraph Source["Source Control"]
        GitHub["GitHub Repo"]
    end

    Local -->|"git push"| GitHub
    GitHub -->|"Auto Deploy"| Render
    
    subgraph Config
        Dockerfile["Dockerfile"]
    end

    Config --> Render
```

### Deployment Steps

1. **Push to GitHub** - Push your code to a GitHub repository
2. **Create Web Service** - Go to [Render Dashboard](https://dashboard.render.com/) → New → Web Service
3. **Connect Repository** - Select your GitHub repo
4. **Configure Service**:
   - **Environment**: Docker
   - **Region**: Choose nearest region (e.g., Oregon, Frankfurt)
   - **Instance Type**: Free or Starter
   - **Start Command**: Auto-detected from Dockerfile
5. **Deploy** - Render auto-builds and deploys on every push

### Deployment Configuration

| Setting | Value | Description |
|---------|-------|-------------|
| Platform | Render.com | Cloud application hosting |
| Build | Docker | Uses Dockerfile for builds |
| Auto-deploy | Enabled | Deploys on git push to main |
| HTTPS | Automatic | Free SSL certificates |
| Health Check | `/health` | Monitors service availability |

### Environment Variables

Configure these in Render Dashboard → Environment:

| Variable | Value | Description |
|----------|-------|-------------|
| `PORT` | `3000` | Server port (auto-set by Render) |

### Render Service URL

After deployment, your MCP server will be available at:
```
https://your-service-name.onrender.com/mcp
```

Update your Cursor MCP settings to use this URL:
```json
{
  "mcpServers": {
    "docs-fetcher": {
      "url": "https://your-service-name.onrender.com/mcp"
    }
  }
}
```

## Dependencies

| Package | Purpose |
|---------|---------|
| `@modelcontextprotocol/sdk` | MCP protocol implementation |
| `express` | HTTP server framework |
| `zod` | Schema validation for tool inputs |

## Future Considerations

<!-- Add notes here when planning new features -->

- [ ] Add more documentation fetching tools (npm, PyPI, etc.)
- [ ] Add caching layer for frequently requested READMEs
- [ ] Add authentication for private repositories
- [ ] Add rate limiting

---

*Last updated: January 2026*
