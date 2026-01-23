# docs-fetcher MCP Server

An MCP (Model Context Protocol) server that fetches README files from public GitHub repositories.

## Installation

```bash
npm install
```

## Usage

### Running Locally (HTTP Server)

```bash
npm start
```

The server will start at `http://localhost:3000/mcp`

### Configuring with Cursor (Remote HTTP)

Add this to your Cursor MCP settings (`.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "docs-fetcher": {
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

For a deployed server, replace `localhost:3000` with your server URL.

## Deployment Options

### 1. Docker

Build and run with Docker:

```bash
# Build the image
docker build -t docs-fetcher-mcp .

# Run the container
docker run -p 3000:3000 docs-fetcher-mcp
```

### 2. Fly.io

```bash
# Install flyctl if you haven't
# brew install flyctl

# Login to Fly.io
fly auth login

# Launch the app (first time)
fly launch

# Deploy updates
fly deploy
```

### 3. Railway

1. Push your code to GitHub
2. Connect Railway to your GitHub repo
3. Railway will auto-detect the Dockerfile and deploy

### 4. Render

1. Create a new Web Service on Render
2. Connect your GitHub repo
3. Set the start command to `npm start`
4. Deploy!

## Endpoints

- `POST /mcp` - Main MCP endpoint for tool calls
- `GET /health` - Health check endpoint

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
