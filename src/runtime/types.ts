export interface ToolResult {
	/** Conteudo enviado ao LLM para raciocinio (sempre presente) */
	forLlm: string;
	/** Conteudo enviado ao usuario (opcional, silenciado se silent=true) */
	forUser?: string;
	/** Suprime mensagem ao usuario */
	silent: boolean;
	/** Indica erro na execucao */
	isError: boolean;
	/** Indica execucao assincrona em background */
	async: boolean;
	/** Erro interno (nao serializado) */
	error?: Error;
}

/** Resultado basico - so para o LLM */
export function toolResult(forLlm: string): ToolResult {
	return { forLlm, silent: false, isError: false, async: false };
}

/** Resultado silencioso - LLM ve, usuario nao */
export function silentResult(forLlm: string): ToolResult {
	return { forLlm, silent: true, isError: false, async: false };
}

/** Resultado de erro */
export function errorResult(forLlm: string, error?: Error): ToolResult {
	return { forLlm, silent: false, isError: true, async: false, error };
}

/** Resultado assincrono - task rodando em background */
export function asyncResult(forLlm: string): ToolResult {
	return { forLlm, silent: false, isError: false, async: true };
}

/** Resultado com output para o usuario */
export function userResult(content: string): ToolResult {
	return {
		forLlm: content,
		forUser: content,
		silent: false,
		isError: false,
		async: false,
	};
}
