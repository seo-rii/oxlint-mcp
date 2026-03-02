/**
 * @fileoverview Tests for MCP server CLI.
 */

import assert from "node:assert";
import childProcess from "node:child_process";
import path from "node:path";

const EXECUTABLE_PATH = path.resolve("./src/mcp-cli.js");

describe("MCP server", () => {
	it("should execute the MCP server CLI", () => {
		const result = childProcess.spawnSync(process.execPath, [EXECUTABLE_PATH], {
			encoding: "utf8",
			timeout: 5000,
		});

		assert.strictEqual(result.status, 0);
		assert.strictEqual(result.signal, null);
		assert.strictEqual(result.stdout, "");
	});
});
