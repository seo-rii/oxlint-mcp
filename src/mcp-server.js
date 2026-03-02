/**
 * @fileoverview MCP Server for handling requests and responses to Oxlint.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { z } from "zod/v3";

const require = createRequire(import.meta.url);

const mcpServer = new McpServer({
	name: "Oxlint",
	version: "0.1.0", // x-release-please-version
});

// Important: Cursor throws an error when `describe()` is used in the schema.
const filePathsSchema = {
	filePaths: z.array(z.string().min(1)).nonempty(),
};

mcpServer.registerTool(
	"lint-files",
	{
		description:
			"Lint files using Oxlint. You must provide a list of absolute file paths to the files you want to lint. The absolute file paths should be in the correct format for your operating system (e.g., forward slashes on Unix-like systems, backslashes on Windows).",
		inputSchema: filePathsSchema,
	},
	async ({ filePaths }) => {
		const type = /** @type {const} */ ("text");
		const oxlintEntryPath = require.resolve("oxlint");
		const oxlintBinPath = path.resolve(
			path.dirname(oxlintEntryPath),
			"../bin/oxlint",
		);
		const { stdout, stderr, exitCode } = await new Promise((resolve, reject) => {
			let collectedStdout = "";
			let collectedStderr = "";
			const child = spawn(
				process.execPath,
				[oxlintBinPath, "--format", "json", ...filePaths],
				{
					cwd: process.cwd(),
					env: process.env,
					stdio: ["ignore", "pipe", "pipe"],
				},
			);

			child.stdout.setEncoding("utf8");
			child.stdout.on("data", data => {
				collectedStdout += data;
			});

			child.stderr.setEncoding("utf8");
			child.stderr.on("data", data => {
				collectedStderr += data;
			});

			child.on("error", reject);
			child.on("close", (code, signal) => {
				if (signal) {
					reject(
						new Error(`oxlint process was terminated by signal: ${signal}`),
					);
					return;
				}

				resolve({
					stdout: collectedStdout,
					stderr: collectedStderr,
					exitCode: code ?? 1,
				});
			});
		});

		let parsedOutput;
		try {
			parsedOutput = JSON.parse(stdout);
		} catch (error) {
			throw new Error(
				["Failed to parse Oxlint JSON output.", stdout, stderr]
					.filter(Boolean)
					.join("\n\n"),
				{ cause: error },
			);
		}

		const diagnostics = Array.isArray(parsedOutput.diagnostics)
			? parsedOutput.diagnostics
			: [];
		const normalizedFilePaths = filePaths.map(filePath => path.resolve(filePath));
		const normalizedFilePathSet = new Set(normalizedFilePaths);
		/** @type {Map<string, Array<any>>} */
		const diagnosticsByFilePath = new Map(
			normalizedFilePaths.map(filePath => [filePath, []]),
		);

		for (const diagnostic of diagnostics) {
			if (!diagnostic || typeof diagnostic !== "object") {
				continue;
			}

			const diagnosticFilePath =
				typeof diagnostic.filename === "string"
					? path.resolve(diagnostic.filename)
					: "";
			if (!diagnosticFilePath) {
				continue;
			}

			if (!diagnosticsByFilePath.has(diagnosticFilePath)) {
				diagnosticsByFilePath.set(diagnosticFilePath, []);
			}
			const diagnosticsForFile = diagnosticsByFilePath.get(diagnosticFilePath);
			if (diagnosticsForFile) {
				diagnosticsForFile.push(diagnostic);
			}
		}

		const additionalFilePaths = [];
		for (const diagnosticFilePath of diagnosticsByFilePath.keys()) {
			if (!normalizedFilePathSet.has(diagnosticFilePath)) {
				additionalFilePaths.push(diagnosticFilePath);
			}
		}

		const results = [...normalizedFilePaths, ...additionalFilePaths].map(filePath => {
			/** @type {Array<any>} */
			const fileDiagnostics = diagnosticsByFilePath.get(filePath) ?? [];
			let errorCount = 0;
			let fatalErrorCount = 0;
			let warningCount = 0;

			const messages = fileDiagnostics.map(diagnostic => {
				const severity = diagnostic.severity === "error" ? 2 : 1;
				const isFatal = severity === 2 && typeof diagnostic.code !== "string";
				if (severity === 2) {
					errorCount += 1;
				}
				if (severity === 1) {
					warningCount += 1;
				}
				if (isFatal) {
					fatalErrorCount += 1;
				}

				const firstLabel =
					Array.isArray(diagnostic.labels) && diagnostic.labels.length > 0
						? diagnostic.labels[0]
						: null;
				const span =
					firstLabel && typeof firstLabel === "object" && firstLabel.span
						? firstLabel.span
						: null;

				return {
					ruleId: typeof diagnostic.code === "string" ? diagnostic.code : null,
					severity,
					fatal: isFatal,
					message:
						typeof diagnostic.message === "string"
							? diagnostic.message
							: "Unknown oxlint diagnostic message.",
					line: span && typeof span.line === "number" ? span.line : 1,
					column: span && typeof span.column === "number" ? span.column : 1,
				};
			});

			return {
				filePath,
				messages,
				suppressedMessages: [],
				errorCount,
				fatalErrorCount,
				warningCount,
				fixableErrorCount: 0,
				fixableWarningCount: 0,
				usedDeprecatedRules: [],
			};
		});

		const content = results.map(result => ({
			type,
			text: JSON.stringify(result),
		}));

		content.unshift({
			type,
			text: "Here are the results of running Oxlint on the provided files. Before doing anything else, you must display the full list to the user:",
		});
		if (stderr.trim()) {
			content.push({
				type,
				text: `Oxlint stderr output:\n${stderr.trim()}`,
			});
		}
		if (exitCode !== 0 && exitCode !== 1) {
			content.push({
				type,
				text: `Oxlint exited with an unexpected code: ${exitCode}`,
			});
		}
		content.push({
			type,
			text: "If the user asked to fix any issues found, proceed in fixing them. If the user did not ask to fix issues found, you must ask the user for confirmation before attempting to fix the issues found.",
		});

		return {
			content,
		};
	},
);

export { mcpServer };
