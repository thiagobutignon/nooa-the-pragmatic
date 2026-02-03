# SDK: run

Execute a pipeline of NOOA commands or external commands.

## Usage

```ts
import { sdk } from "../../src/sdk";

const result = await sdk.run.run({
	steps: [
		{ kind: "external", argv: ["echo", "ok"], original: "exec echo ok" },
	],
	captureOutput: true,
});
if (result.ok) {
	console.log(result.data.steps[0]?.stdout);
}
```

## API

### `sdk.run.run(input)`

**Input**
- `args?: string[]`
- `steps?: PipelineStep[]`
- `continueOnError?: boolean`
- `captureOutput?: boolean`
- `allowExternal?: boolean`
- `dryRun?: boolean`
- `cwd?: string`

**Returns**
- `SdkResult<RunResult>`

**RunResult**
- `runId: string`
- `ok: boolean`
- `failedStepIndex?: number`
- `steps: StepResult[]`
- `plan?: PipelineStep[]`

**Errors**
- `invalid_input` when no steps are provided
