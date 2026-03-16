# mcp-server-dash (Node.js)

A Model Context Protocol (MCP) server that provides tools to interact with the [Dash](https://kapeli.com/dash) documentation browser API.

Dash 8 is required. You can download Dash 8 at https://kapeli.com/dash.

## Overview

The Dash MCP server provides tools for accessing and searching documentation directly from Dash, the macOS documentation browser. MCP clients can:

- List installed docsets
- Search across docsets and code snippets
- Load documentation pages from search results
- Enable full-text search for specific docsets

## Tools

1. **list_installed_docsets**
   - Lists all installed documentation sets in Dash
2. **search_documentation**
   - Searches across docsets and snippets
3. **load_documentation_page**
   - Loads a documentation page from a `load_url` returned by `search_documentation`
4. **enable_docset_fts**
   - Enables full-text search for a specific docset

## Requirements

- macOS (required for Dash app)
- [Dash](https://kapeli.com/dash) installed
- Node.js 18 or higher

## Configuration

### Using npx

#### in `claude_desktop_config.json`

```json
{
  "mcpServers": {
      "dash-api": {
          "command": "npx",
          "args": [
              "-y",
              "git+https://github.com/Kapeli/dash-mcp-server-node.git",
              "dash-mcp-server"
          ]
      }
  }
}
```

#### in `Claude Code`

```bash
claude mcp add dash-api -- npx -y "git+https://github.com/Kapeli/dash-mcp-server-node.git" dash-mcp-server
```

### From source

```bash
git clone https://github.com/Kapeli/dash-mcp-server-node.git
cd dash-mcp-server-node
npm install
npm run build
```

#### in `claude_desktop_config.json`

```json
{
  "mcpServers": {
      "dash-api": {
          "command": "node",
          "args": ["/absolute/path/to/dash-mcp-server-node/dist/index.js"]
      }
  }
}
```

#### in `Claude Code`

```bash
claude mcp add dash-api -- node /absolute/path/to/dash-mcp-server-node/dist/index.js
```

## Development

```bash
npm install
npm run dev      # watch mode
npm test         # run tests
npm run lint     # type check
```
