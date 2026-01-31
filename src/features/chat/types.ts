export type MessageRole = "user" | "system" | "assistant";

export interface Message {
    role: MessageRole;
    content: string;
    timestamp: string;
}

export interface MessageOptions {
    role: MessageRole;
    json: boolean;
}
