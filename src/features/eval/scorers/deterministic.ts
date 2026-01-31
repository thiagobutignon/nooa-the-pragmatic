export interface Assertion {
    type: "is_valid_json" | "has_property" | "enum_check" | "no_absolute_paths" | "max_count" | "property_equals";
    property?: string;
    allowed?: string[];
    limit?: number;
    value?: any;
}

export interface AssertionResult {
    passed: boolean;
    message: string;
}

export class DeterministicScorer {
    score(output: string, assertions: Assertion[]): { passed: number; total: number; results: AssertionResult[] } {
        const results: AssertionResult[] = [];
        let parsedJson: any = null;

        for (const assertion of assertions) {
            try {
                if (assertion.type === "is_valid_json") {
                    try {
                        const jsonMatch = output.match(/\{[\s\S]*\}/);
                        parsedJson = JSON.parse(jsonMatch ? jsonMatch[0] : output);
                        results.push({ passed: true, message: "Valid JSON" });
                    } catch (e) {
                        results.push({ passed: false, message: `Invalid JSON: ${(e as Error).message}` });
                    }
                    continue;
                }

                if (!parsedJson) {
                    results.push({ passed: false, message: `Skipped ${assertion.type}: No valid JSON to check` });
                    continue;
                }

                // Property Access Helper (simple version for findings[].category)
                const getValues = (obj: any, path?: string): any[] => {
                    if (!path) return [obj];
                    if (path.includes("[].")) {
                        const [arrayKey, propKey] = path.split("[].") as [string, string];
                        const arr = obj[arrayKey];
                        if (Array.isArray(arr)) {
                            return arr.map(item => item[propKey]);
                        }
                        return [];
                    }
                    return [obj[path]];
                };

                switch (assertion.type) {
                    case "has_property":
                        results.push({ 
                            passed: assertion.property! in parsedJson, 
                            message: `Property ${assertion.property} exists` 
                        });
                        break;

                    case "enum_check": {
                        const values = getValues(parsedJson, assertion.property);
                        const invalid = values.filter(v => !assertion.allowed!.includes(v));
                        results.push({
                            passed: invalid.length === 0,
                            message: invalid.length === 0 
                                ? `Enum ${assertion.property} is valid` 
                                : `Invalid enum values in ${assertion.property}: ${invalid.join(", ")}`
                        });
                        break;
                    }

                    case "no_absolute_paths": {
                        const values = getValues(parsedJson, assertion.property);
                        const absolute = values.filter(v => typeof v === 'string' && (v.startsWith("/") || /^[a-zA-Z]:/.test(v)));
                        results.push({
                            passed: absolute.length === 0,
                            message: absolute.length === 0 
                                ? `No absolute paths in ${assertion.property}` 
                                : `Absolute paths found: ${absolute.join(", ")}`
                        });
                        break;
                    }

                    case "max_count": {
                        const val = parsedJson[assertion.property!];
                        const count = Array.isArray(val) ? val.length : 0;
                        results.push({
                            passed: count <= assertion.limit!,
                            message: `Count of ${assertion.property} is ${count} (limit: ${assertion.limit})`
                        });
                        break;
                    }

                    case "property_equals": {
                        results.push({
                            passed: parsedJson[assertion.property!] === assertion.value,
                            message: `Property ${assertion.property} equals expected value`
                        });
                        break;
                    }
                }
            } catch (err) {
                results.push({ passed: false, message: `Error in check ${assertion.type}: ${(err as Error).message}` });
            }
        }

        return {
            passed: results.filter(r => r.passed).length,
            total: results.length,
            results
        };
    }
}
