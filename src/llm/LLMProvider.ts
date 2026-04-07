import { LLMConfig, LLMMessage, LLMResponse, MCPTool } from '../types';

export abstract class LLMProvider {
  protected readonly config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = config;
  }

  /**
   * Send a conversation to the LLM and receive a response.
   * If `tools` are provided the LLM may return tool calls instead of text.
   *
   * @param messages  Conversation history (user/assistant turns)
   * @param tools     Optional list of tools the LLM may call
   * @param system    System prompt (injected before messages)
   */
  abstract chat(
    messages: LLMMessage[],
    tools?: MCPTool[],
    system?: string
  ): Promise<LLMResponse>;

  /** Display name used in logs */
  abstract get providerName(): string;
}
