/**
 * @fileoverview Tests for MCP server.
 */

import { mcpServer } from "../src/mcp-server.js";
import assert from "node:assert";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { fileURLToPath } from "node:url";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const passingFilePath = path.join(dirname, "fixtures", "passing.js");
const syntaxErrorFilePath = path.join(dirname, "fixtures", "syntax-error.js");
const usesUndefFilePath = path.join(dirname, "fixtures", "uses-undef.js");
const fixturesDir = path.join(dirname, "fixtures");
const oxlintrcFixturesDir = path.join(dirname, "fixtures", "oxlintrc");
const oxlintrcUsesUndefFilePath = path.join(
	oxlintrcFixturesDir,
	"uses-undef.js",
);

const filePathsJsonSchema = {
	$schema: "http://json-schema.org/draft-07/schema#",
	additionalProperties: false,
	properties: {
		filePaths: {
			items: {
				type: "string",
				minLength: 1,
			},
			minItems: 1,
			type: "array",
		},
	},
	required: ["filePaths"],
	type: "object",
};

/**
 * Extracts JSON payload objects from tool response content.
 * @param {Array<{type: string, text: string}>} rawResults Tool response content.
 * @returns {Array<{type: string, text: object}>} Parsed JSON entries.
 */
function getJsonResults(rawResults) {
	return rawResults.flatMap(({ type, text }) => {
		try {
			return [{ type, text: JSON.parse(text) }];
		} catch {
			return [];
		}
	});
}

describe("MCP Server", () => {
	let client;
	let clientTransport;
	let serverTransport;

	beforeEach(async () => {
		client = new Client({
			name: "test client",
			version: "1.0",
		});

		[clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

		// Note: must connect server first or else client hangs
		await mcpServer.connect(serverTransport);
		await client.connect(clientTransport);
	});

	afterEach(async () => {
		await mcpServer.close();
	});

	describe("Tools", () => {
		it("should list tools", async () => {
			const { tools } = await client.listTools();

			assert.strictEqual(tools.length, 1);
			assert.strictEqual(tools[0].name, "lint-files");
			assert.deepStrictEqual(tools[0].inputSchema, filePathsJsonSchema);
		});

		describe("lint-files", () => {
			it("should return zero lint messages for a valid file", async () => {
				const { content: rawResults } = await client.callTool({
					name: "lint-files",
					arguments: {
						filePaths: [passingFilePath],
					},
				});

				const results = getJsonResults(rawResults);

				assert.deepStrictEqual(results, [
					{
						type: "text",
						text: {
							filePath: passingFilePath,
							messages: [],
							suppressedMessages: [],
							errorCount: 0,
							fatalErrorCount: 0,
							warningCount: 0,
							fixableErrorCount: 0,
							fixableWarningCount: 0,
							usedDeprecatedRules: [],
						},
					},
				]);
			});

			it("should return zero lint messages for a valid file and a syntax error for an invalid file", async () => {
				const { content: rawResults } = await client.callTool({
					name: "lint-files",
					arguments: {
						filePaths: [passingFilePath, syntaxErrorFilePath],
					},
				});

				const results = getJsonResults(rawResults);

				assert.deepStrictEqual(results, [
					{
						type: "text",
						text: {
							filePath: passingFilePath,
							messages: [],
							suppressedMessages: [],
							errorCount: 0,
							fatalErrorCount: 0,
							warningCount: 0,
							fixableErrorCount: 0,
							fixableWarningCount: 0,
							usedDeprecatedRules: [],
						},
					},
					{
						type: "text",
						text: {
							filePath: syntaxErrorFilePath,
							messages: [
								{
									ruleId: null,
									severity: 2,
									fatal: true,
									message: "Unexpected token",
									line: 1,
									column: 3,
								},
							],
							suppressedMessages: [],
							errorCount: 1,
							fatalErrorCount: 1,
							warningCount: 0,
							fixableErrorCount: 0,
							fixableWarningCount: 0,
							usedDeprecatedRules: [],
						},
					},
				]);
			});

			it("should not automatically apply eslint.config.js when it exists in cwd", async () => {
				const originalCwd = process.cwd();
				process.chdir(fixturesDir);

				try {
					const { content: rawResults } = await client.callTool({
						name: "lint-files",
						arguments: {
							filePaths: [usesUndefFilePath],
						},
					});

					const results = getJsonResults(rawResults);
					assert.deepStrictEqual(results, [
						{
							type: "text",
							text: {
								filePath: usesUndefFilePath,
								messages: [],
								suppressedMessages: [],
								errorCount: 0,
								fatalErrorCount: 0,
								warningCount: 0,
								fixableErrorCount: 0,
								fixableWarningCount: 0,
								usedDeprecatedRules: [],
							},
						},
					]);
				} finally {
					process.chdir(originalCwd);
				}
			});

			it("should apply .oxlintrc.json when it exists in cwd", async () => {
				const originalCwd = process.cwd();
				process.chdir(oxlintrcFixturesDir);

				try {
					const { content: rawResults } = await client.callTool({
						name: "lint-files",
						arguments: {
							filePaths: [oxlintrcUsesUndefFilePath],
						},
					});

					const results = getJsonResults(rawResults);
					assert.deepStrictEqual(results, [
						{
							type: "text",
							text: {
								filePath: oxlintrcUsesUndefFilePath,
								messages: [
									{
										ruleId: "eslint(no-undef)",
										severity: 2,
										fatal: false,
										message: "'foo' is not defined.",
										line: 1,
										column: 1,
									},
								],
								suppressedMessages: [],
								errorCount: 1,
								fatalErrorCount: 0,
								warningCount: 0,
								fixableErrorCount: 0,
								fixableWarningCount: 0,
								usedDeprecatedRules: [],
							},
						},
					]);
				} finally {
					process.chdir(originalCwd);
				}
			});
		});
	});
});
