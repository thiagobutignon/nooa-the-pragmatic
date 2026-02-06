export interface Assertion {
	type:
	| "is_valid_json"
	| "has_property"
	| "enum_check"
	| "no_absolute_paths"
	| "max_count"
	| "no_absolute_paths"
	| "max_count"
	| "property_equals"
	| "contains";
	property?: string;
	allowed?: string[];
	limit?: number;
	value?: unknown;
}

export interface AssertionResult {
	passed: boolean;
	message: string;
}

export class DeterministicScorer {
	score(
		output: string,
		assertions: Assertion[],
	): { passed: number; total: number; results: AssertionResult[] } {
		const results: AssertionResult[] = [];
		let parsedJson: Record<string, unknown> | null = null;

		for (const assertion of assertions) {
			try {
				if (assertion.type === "is_valid_json") {
					try {
						const jsonMatch = output.match(/\{[\s\S]*\}/);
						const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : output);
						parsedJson =
							parsed && typeof parsed === "object"
								? (parsed as Record<string, unknown>)
								: null;
						results.push({ passed: true, message: "Valid JSON" });
					} catch (e) {
						results.push({
							passed: false,
							message: `Invalid JSON: ${(e as Error).message}`,
						});
					}
					continue;
				}

				// Logic split for JSON vs String assertions
				if (assertion.type === "contains") {
					if (typeof assertion.value !== "string") {
						results.push({ passed: false, message: "Value must be string for contains" });
						continue;
					}
					results.push({
						passed: output.includes(assertion.value),
						message: `Output contains "${assertion.value}"`,
					});
					continue;
				}

				// All other assertions require JSON
				if (!parsedJson) {
					// Try to parse just in case (lazy parse)
					try {
						const jsonMatch = output.match(/\{[\s\S]*\}/);
						const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : output);
						parsedJson = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
					} catch { }
				}

				if (!parsedJson) {
					results.push({
						passed: false,
						message: `Skipped ${assertion.type}: No valid JSON to check`,
					});
					continue;
				}

				// Property Access Helper (simple version for findings[].category)
				const getValues = (
					obj: Record<string, unknown>,
					path?: string,
				): unknown[] => {
					if (!path) return [obj];
					if (path.includes("[].")) {
						const [arrayKey, propKey] = path.split("[].") as [string, string];
						const arr = obj[arrayKey];
						if (Array.isArray(arr)) {
							return arr.map((item) =>
								typeof item === "object" && item !== null
									? (item as Record<string, unknown>)[propKey]
									: undefined,
							);
						}
						return [];
					}
					return [obj[path]];
				};

				switch (assertion.type) {
					case "has_property": {
						const hasProperty =
							Boolean(assertion.property) && assertion.property in parsedJson;
						results.push({
							passed: hasProperty,
							message: `Property ${assertion.property ?? "unknown"} exists`,
						});
						break;
					}

					case "enum_check": {
						const values = getValues(parsedJson, assertion.property);
						const invalid = values.filter(
							(v) => !assertion.allowed?.includes(String(v)),
						);
						results.push({
							passed: invalid.length === 0,
							message:
								invalid.length === 0
									? `Enum ${assertion.property} is valid`
									: `Invalid enum values in ${assertion.property}: ${invalid.join(", ")}`,
						});
						break;
					}

					case "no_absolute_paths": {
						const values = getValues(parsedJson, assertion.property);
						const absolute = values.filter(
							(v) =>
								typeof v === "string" &&
								(v.startsWith("/") || /^[a-zA-Z]:/.test(v)),
						);
						results.push({
							passed: absolute.length === 0,
							message:
								absolute.length === 0
									? `No absolute paths in ${assertion.property}`
									: `Absolute paths found: ${absolute.join(", ")}`,
						});
						break;
					}

					case "max_count": {
						if (!assertion.property || assertion.limit === undefined) {
							results.push({
								passed: false,
								message: "Missing property or limit for max_count",
							});
							break;
						}
						const val = parsedJson[assertion.property];
						const count = Array.isArray(val) ? val.length : 0;
						results.push({
							passed: count <= assertion.limit,
							message: `Count of ${assertion.property} is ${count} (limit: ${assertion.limit})`,
						});
						break;
					}

					case "property_equals": {
						if (!assertion.property) {
							results.push({
								passed: false,
								message: "Missing property for property_equals",
							});
							break;
						}
						results.push({
							passed: parsedJson[assertion.property] === assertion.value,
							message: `Property ${assertion.property} equals expected value`,
						});
						break;
					}
				}
			} catch (err) {
				results.push({
					passed: false,
					message: `Error in check ${assertion.type}: ${(err as Error).message}`,
				});
			}
		}

		return {
			passed: results.filter((r) => r.passed).length,
			total: results.length,
			results,
		};
	}
}
