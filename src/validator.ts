import { lexer, type Token, type Tokens } from "marked";

export interface ValidationResult {
    url: string;
    ok: boolean;
    status?: number;
    error?: string;
}

/**
 * Extracts all unique URLs from markdown content.
 */
export function extractLinks(markdown: string): string[] {
    const tokens = lexer(markdown);
    const links = new Set<string>();

    function traverse(tokenList: Token[]) {
        for (const token of tokenList) {
            if (token.type === "link") {
                links.add((token as Tokens.Link).href);
            } else if (token.type === "text" && (token as Tokens.Text).tokens) {
                traverse((token as Tokens.Text).tokens!);
            } else if ("tokens" in token && Array.isArray(token.tokens)) {
                traverse(token.tokens);
            } else if ("items" in token && Array.isArray(token.items)) {
                // Handle lists
                for (const item of token.items) {
                    if ("tokens" in item && Array.isArray(item.tokens)) {
                        traverse(item.tokens);
                    }
                }
            }
        }
    }

    traverse(tokens);
    return Array.from(links);
}

/**
 * Validates a single link using a HEAD request.
 */
export async function validateLink(
    url: string,
    timeoutMs = 5000,
): Promise<ValidationResult> {
    if (!url.startsWith("http")) {
        return { url, ok: true }; // Skip non-http links (e.g. mailto)
    }

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        const response = await fetch(url, {
            method: "HEAD",
            signal: controller.signal,
            headers: {
                "User-Agent": "Resume-Converter-Bot/1.0",
            },
        });

        clearTimeout(timeoutId);

        // Some servers return 405 for HEAD, try GET in that case
        if (response.status === 405 || response.status === 403) {
            const getResponse = await fetch(url, {
                method: "GET",
                signal: controller.signal,
                headers: {
                    "User-Agent": "Resume-Converter-Bot/1.0",
                },
            });
            return {
                url,
                ok: getResponse.ok,
                status: getResponse.status,
            };
        }

        return {
            url,
            ok: response.ok,
            status: response.status,
        };
    } catch (error: any) {
        return {
            url,
            ok: false,
            error: error.name === "AbortError" ? "Timeout" : error.message,
        };
    }
}

/**
 * Validates all links in parallel with a concurrency limit.
 */
export async function validateAllLinks(
    urls: string[],
    concurrency = 5,
): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];
    const queue = [...urls];

    async function worker() {
        while (queue.length > 0) {
            const url = queue.shift();
            if (!url) continue;
            const result = await validateLink(url);
            results.push(result);
        }
    }

    const workers = Array.from(
        { length: Math.min(concurrency, urls.length) },
        worker,
    );
    await Promise.all(workers);

    return results;
}
