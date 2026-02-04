import type { Command, CommandContext } from "./command";
import { HelpBuilder, renderChangelogXml } from "./help-builder";
import { buildStandardOptions } from "./cli-flags";
import { createTraceId, logger } from "./logger";
import { telemetry } from "./telemetry";
import type {
	AgentDocError,
	AgentDocExample,
	AgentDocExitCode,
	AgentDocMeta,
	AgentDocOutputField,
	SdkError,
	SdkResult,
} from "./types";

type UsageSpec = {
	cli: string;
	sdk?: string;
	tui?: string;
};

export type SchemaField = {
	type: "string" | "number" | "boolean";
	required?: boolean;
	default?: unknown;
	since?: string;
};

export type SchemaSpec = Record<string, SchemaField>;

type ParseOptions = {
	options: Record<string, { type: "string" | "boolean"; short?: string }>;
};

type InputContext = {
	values: Record<string, unknown>;
	positionals: string[];
};

type TelemetryConfig<Input, Output> = {
	eventPrefix: string;
	successMetadata?: (input: Input, output: Output) => Record<string, unknown>;
	failureMetadata?: (input: Input, error: SdkError) => Record<string, unknown>;
};

export class CommandBuilder<Input, Output> {
	private metaValue?: AgentDocMeta;
	private usageValue?: UsageSpec;
	private helpText?: string;
	private sdkUsageText?: string;
	private schemaValue?: SchemaSpec;
	private parseOptions?: ParseOptions;
	private inputParser?: (ctx: InputContext) => Promise<Input>;
	private runFn?: (input: Input) => Promise<SdkResult<Output>>;
	private renderSuccess?: (output: Output, values: Record<string, unknown>) => void;
	private renderFailure?: (error: SdkError, input: Input) => void;
	private telemetryConfig?: TelemetryConfig<Input, Output>;
	private agentDocIncludeChangelog = false;
	private examplesValue: AgentDocExample[] = [];
	private errorsValue: AgentDocError[] = [];
	private outputFieldsValue: AgentDocOutputField[] = [];
	private exitCodesValue: AgentDocExitCode[] = [];

	meta(meta: AgentDocMeta) {
		this.metaValue = meta;
		return this;
	}

	usage(usage: UsageSpec) {
		this.usageValue = usage;
		return this;
	}

	schema(schema: SchemaSpec) {
		this.schemaValue = schema;
		return this;
	}

	help(text: string) {
		this.helpText = text;
		return this;
	}

	sdkUsage(text: string) {
		this.sdkUsageText = text;
		return this;
	}

	options(options: ParseOptions) {
		this.parseOptions = options;
		return this;
	}

	parseInput(fn: (ctx: InputContext) => Promise<Input>) {
		this.inputParser = fn;
		return this;
	}

	run(fn: (input: Input) => Promise<SdkResult<Output>>) {
		this.runFn = fn;
		return this;
	}

	onSuccess(fn: (output: Output, values: Record<string, unknown>) => void) {
		this.renderSuccess = fn;
		return this;
	}

	onFailure(fn: (error: SdkError, input: Input) => void) {
		this.renderFailure = fn;
		return this;
	}

	telemetry(config: TelemetryConfig<Input, Output>) {
		this.telemetryConfig = config;
		return this;
	}

	examples(examples: AgentDocExample[]) {
		this.examplesValue = examples;
		return this;
	}

	errors(errors: AgentDocError[]) {
		this.errorsValue = errors;
		return this;
	}

	outputFields(fields: AgentDocOutputField[]) {
		this.outputFieldsValue = fields;
		return this;
	}

	exitCodes(codes: AgentDocExitCode[]) {
		this.exitCodesValue = codes;
		return this;
	}

	includeChangelogInAgentDoc(value = true) {
		this.agentDocIncludeChangelog = value;
		return this;
	}

	buildAgentDoc(includeChangelog = this.agentDocIncludeChangelog) {
		if (!this.metaValue || !this.usageValue || !this.schemaValue) {
			throw new Error("meta, usage, and schema are required to build agent doc");
		}

		const version = this.metaValue.changelog[0]?.version ?? "1.0.0";

		const inputFields = Object.entries(this.schemaValue)
			.map(([name, field]) => {
				const attrs = [
					`name="${name}"`,
					`type="${field.type}"`,
					field.required ? `required="true"` : `required="false"`,
				];
				if (field.default !== undefined) attrs.push(`default="${field.default}"`);
				if (field.since) attrs.push(`since="${field.since}"`);
				return `      <field ${attrs.join(" ")} />`;
			})
			.join("\n");

		const outputXml =
			this.outputFieldsValue.length > 0
				? `\n    <output>\n${this.outputFieldsValue
					.map((field) => `      <field name="${field.name}" type="${field.type}" />`)
					.join("\n")}\n    </output>`
				: "";

		const examplesXml =
			this.examplesValue.length > 0
				? `\n  <examples>\n${this.examplesValue
					.map(
						(example) =>
							`    <example>\n      <input>${example.input}</input>\n      <output>${example.output}</output>\n    </example>`,
					)
					.join("\n")}\n  </examples>`
				: "";

		const errorsXml =
			this.errorsValue.length > 0
				? `\n  <errors>\n${this.errorsValue
					.map(
						(error) =>
							`    <error code="${error.code}">${error.message}</error>`,
					)
					.join("\n")}\n  </errors>`
				: "";

		const exitCodesXml =
			this.exitCodesValue.length > 0
				? `\n  <exit-codes>\n${this.exitCodesValue
					.map(
						(code) =>
							`    <code value="${code.value}">${code.description}</code>`,
					)
					.join("\n")}\n  </exit-codes>`
				: "";

		const changelogXml = includeChangelog
			? `\n  ${renderChangelogXml(this.metaValue.changelog)}`
			: "";

		const escapeXml = (value: string) =>
			value
				.replaceAll("&", "&amp;")
				.replaceAll("<", "&lt;")
				.replaceAll(">", "&gt;");

		return `
<instruction version="${version}" name="${this.metaValue.name}">
  <purpose>${this.metaValue.description}</purpose>
  <usage>
    <cli>${escapeXml(this.usageValue.cli)}</cli>
    ${this.usageValue.sdk ? `<sdk>${escapeXml(this.usageValue.sdk)}</sdk>` : ""}
    ${this.usageValue.tui ? `<tui>${escapeXml(this.usageValue.tui)}</tui>` : ""}
  </usage>
  <contract>
    <input>
${inputFields}
    </input>
${outputXml}
  </contract>${exitCodesXml}${examplesXml}${errorsXml}${changelogXml}
</instruction>
`.trim();
	}

	buildHelp(includeChangelog = false) {
		if (!this.metaValue || !this.helpText || !this.sdkUsageText) {
			throw new Error("meta, help, and sdkUsage are required to build help");
		}

		const agentDoc = this.buildAgentDoc(includeChangelog);
		return new HelpBuilder(this.helpText.trim())
			.addSection("System Instruction (Agent)", `\`\`\`xml\n${agentDoc}\n\`\`\``)
			.addSection("SDK Usage", `\`\`\`text\n${this.sdkUsageText.trim()}\n\`\`\``)
			.withChangelog(this.metaValue.changelog)
			.includeChangelogSection(includeChangelog)
			.build();
	}

	buildFeatureDoc(includeChangelog = true) {
		if (!this.metaValue || !this.helpText || !this.sdkUsageText) {
			throw new Error("meta, help, and sdkUsage are required to build docs");
		}
		const agentDoc = this.buildAgentDoc(includeChangelog);
		return new HelpBuilder(`# ${this.metaValue.name}`)
			.addSection("Description", this.metaValue.description)
			.addSection("CLI Usage", `\`\`\`text\n${this.helpText.trim()}\n\`\`\``)
			.addSection("Agent Instructions", `\`\`\`xml\n${agentDoc}\n\`\`\``)
			.addSection("SDK", `\`\`\`text\n${this.sdkUsageText.trim()}\n\`\`\``)
			.withChangelog(this.metaValue.changelog)
			.includeChangelogSection(includeChangelog)
			.build();
	}

	build(): Command {
		if (!this.metaValue || !this.helpText || !this.runFn || !this.inputParser) {
			throw new Error("meta, help, parseInput, and run are required to build command");
		}

		const runFn = this.runFn;
		const inputParser = this.inputParser;
		const parseOptions = this.parseOptions ?? { options: buildStandardOptions() };
		const helpText = this.helpText;
		const meta = this.metaValue;

		const execute = async ({ rawArgs, bus }: CommandContext) => {
			const { parseArgs } = await import("node:util");
			const parsed = parseArgs({
				args: rawArgs,
				options: parseOptions.options,
				strict: true,
				allowPositionals: true,
			});

			const values = parsed.values as Record<string, unknown>;
			const positionals = parsed.positionals as string[];

			if (values.help) {
				const includeChangelog = Boolean(values["include-changelog"]);
				console.log(this.buildHelp(includeChangelog));
				return;
			}

			const traceId = createTraceId();
			const startTime = Date.now();

			const input = await inputParser({ values, positionals });
			const result = await runFn(input);

			if (!result.ok) {
				if (this.renderFailure) {
					this.renderFailure(result.error, input);
				} else {
					console.error(`Error: ${result.error.message}`);
					process.exitCode = result.error.code === "invalid_input" ? 2 : 1;
				}

				const metaData =
					this.telemetryConfig?.failureMetadata?.(input, result.error) ?? {};
				telemetry.track(
					{
						event: `${this.telemetryConfig?.eventPrefix ?? meta.name}.failure`,
						level: "error",
						success: false,
						duration_ms: Date.now() - startTime,
						trace_id: traceId,
						metadata: metaData,
					},
					bus,
				);
				logger.error(`${meta.name}.failure`, new Error(result.error.message), metaData);
				return;
			}

			if (this.renderSuccess) {
				this.renderSuccess(result.data, values);
			}

			const successMeta =
				this.telemetryConfig?.successMetadata?.(input, result.data) ?? {};
			telemetry.track(
				{
					event: `${this.telemetryConfig?.eventPrefix ?? meta.name}.success`,
					level: "info",
					success: true,
					duration_ms: Date.now() - startTime,
					trace_id: traceId,
					metadata: successMeta,
				},
				bus,
			);
			logger.info(`${meta.name}.success`, successMeta);
		};

		return {
			name: this.metaValue.name,
			description: this.metaValue.description,
			options: {},
			execute,
			agentDoc: this.buildAgentDoc(this.agentDocIncludeChangelog),
		};
	}
}
