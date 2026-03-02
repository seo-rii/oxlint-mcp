#!/usr/bin/env node
/**
 * @fileoverview CLI to run the MCP server.
 */

import { mcpServer } from "./mcp-server.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

/**
 * Disconnects the server and sets exit code to 0.
 * @returns {void}
 */
function disconnect() {
	mcpServer.close();
	process.exitCode = 0;
}

mcpServer.connect(new StdioServerTransport()).catch(error => {
	// eslint-disable-next-line no-console -- Needed to output information
	console.error("Failed to start Oxlint MCP server:", error);
	process.exitCode = 1;
});

// Note: do not use console.log() because stdout is part of the server transport
// eslint-disable-next-line no-console -- Needed to output information
console.error(`Oxlint MCP server is running. cwd: ${process.cwd()}`);

process.on("SIGINT", disconnect);
process.on("SIGTERM", disconnect);
