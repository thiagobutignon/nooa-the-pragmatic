import { logger } from "../../core/logger";
import type {
	AiEngineOptions,
	AiProvider,
	AiRequest,
	AiResponse,
} from "./types";

export class AiEngine {
	private providers = new Map<string, AiProvider>();

	register(provider: AiProvider) {
		this.providers.set(provider.name, provider);
	}

	async complete(
		request: AiRequest,
		options: AiEngineOptions = {},
	): Promise<AiResponse> {
		const providerName =
			options.provider || process.env.NOOA_AI_PROVIDER || "ollama";
		const provider = this.providers.get(providerName);

		if (!provider) {
			throw new Error(`AI Provider not found: ${providerName}`);
		}

		try {
			return await this.withRetry(() => provider.complete(request), options);
		} catch (error) {
			if (options.fallbackProvider) {
				logger.warn(
					`Primary provider ${providerName} failed, falling back to ${options.fallbackProvider}`,
					{
						error: error instanceof Error ? error.message : String(error),
					},
				);
				const fallback = this.providers.get(options.fallbackProvider);
				if (fallback) {
					return await this.withRetry(
						() => fallback.complete(request),
						options,
					);
				}
			}
			throw error;
		}
	}

	private async withRetry<T>(
		fn: () => Promise<T>,
		options: AiEngineOptions,
	): Promise<T> {
		const maxRetries = options.maxRetries ?? 3;
		let delay = options.initialDelayMs ?? 1000;

		for (let attempt = 0; attempt <= maxRetries; attempt++) {
			try {
				return await fn();
			} catch (error) {
				if (attempt === maxRetries) {
					throw error;
				}

				const jitter = Math.random() * 200;
				const totalDelay = delay + jitter;

				logger.warn(
					`AI request failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${Math.round(totalDelay)}ms`,
					{
						error: error instanceof Error ? error.message : String(error),
					},
				);

				await new Promise((resolve) => setTimeout(resolve, totalDelay));
				delay *= 2; // Exponential backoff
			}
		}

		throw new Error("Retry logic failed to return or throw"); // Should be unreachable
	}
}
