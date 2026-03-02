# oxlint-mcp

MCP server for Oxlint.

Similar to `@eslint/mcp`, but with `oxlint`!

## MCP Setup

This package is meant to be configured as an MCP server in your editor/agent client.

### VS Code

Create `.vscode/mcp.json` in your project:

```json
{
  "servers": {
    "Oxlint": {
      "type": "stdio",
      "command": "npx",
      "args": ["oxlint-mcp@latest"]
    }
  }
}
```

### Cursor

Create `.cursor/mcp.json` in your project:

```json
{
  "mcpServers": {
    "oxlint": {
      "command": "npx",
      "args": ["oxlint-mcp@latest"],
      "env": {}
    }
  }
}
```

Optional global configuration: `~/.cursor/mcp.json`

### Windsurf

Add this to `~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "oxlint": {
      "command": "npx",
      "args": ["oxlint-mcp@latest"],
      "env": {}
    }
  }
}
```

## Troubleshooting

- In VS Code, run `MCP: List Servers` and check server logs with `Show Output`.
- Run `npx oxlint-mcp@latest` directly in terminal to confirm the server can start.
- Ensure Node.js and `npx` are available in the same environment as your MCP client.

## License

Apache-2.0
