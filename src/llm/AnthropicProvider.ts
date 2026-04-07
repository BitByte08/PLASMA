import Anthropic from '@anthropic-ai/sdk';
import type {
  MessageParam,
  Tool,
  ToolResultBlockParam,
  ToolUseBlock,
} from '@anthropic-ai/sdk/resources/messages';
import { LLMConfig, LLMMessage, LLMResponse, MCPTool } from '../types';
import { LLMProvider } from './LLMProvider';

const DEFAULT_MODEL = 'claude-sonnet-4-6';

export class AnthropicProvider extends LLMProvider {
  private readonly client: Anthropic;

  constructor(config: LLMConfig) {
    super(config);
    this.client = new Anthropic({ apiKey: config.apiKey });
  }

  get providerName(): string {
    return 'anthropic';
  }

  async chat(
    messages: LLMMessage[],
    tools?: MCPTool[],
    system?: string
  ): Promise<LLMResponse> {
    const anthropicMessages: MessageParam[] = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

    const anthropicTools: Tool[] | undefined =
      tools && tools.length > 0
        ? tools.map((t) => ({
            name: t.name,
            description: t.description,
            input_schema: {
              type: 'object' as const,
              properties: t.inputSchema.properties as Record<
                string,
                { type: string; description: string }
              >,
              required: t.inputSchema.required,
            },
          }))
        : undefined;

    const res = await this.client.messages.create({
      model: this.config.model ?? DEFAULT_MODEL,
      max_tokens: this.config.maxTokens ?? 1024,
      temperature: this.config.temperature ?? 0.75,
      system: system ?? undefined,
      messages: anthropicMessages,
      ...(anthropicTools ? { tools: anthropicTools } : {}),
    });

    const textBlocks = res.content.filter((b) => b.type === 'text');
    const toolUseBlocks = res.content.filter(
      (b): b is ToolUseBlock => b.type === 'tool_use'
    );

    const content = textBlocks.map((b) => (b.type === 'text' ? b.text : '')).join('');

    const toolCalls = toolUseBlocks.map((tc) => ({
      id: tc.id,
      name: tc.name,
      arguments: tc.input as Record<string, unknown>,
    }));

    return {
      content,
      toolCalls: toolCalls.length ? toolCalls : undefined,
      usage: {
        promptTokens: res.usage.input_tokens,
        completionTokens: res.usage.output_tokens,
      },
    };
  }

  /**
   * Helper for the agentic loop: sends a tool-result back to Anthropic.
   * Returns the model's next message after seeing the tool output.
   */
  async continueWithToolResult(
    messages: MessageParam[],
    toolResults: ToolResultBlockParam[],
    tools: Tool[],
    system?: string
  ): Promise<LLMResponse> {
    const updatedMessages: MessageParam[] = [
      ...messages,
      { role: 'user', content: toolResults },
    ];

    const res = await this.client.messages.create({
      model: this.config.model ?? DEFAULT_MODEL,
      max_tokens: this.config.maxTokens ?? 1024,
      system: system ?? undefined,
      tools,
      messages: updatedMessages,
    });

    const textBlocks = res.content.filter((b) => b.type === 'text');
    const toolUseBlocks = res.content.filter(
      (b): b is ToolUseBlock => b.type === 'tool_use'
    );

    return {
      content: textBlocks.map((b) => (b.type === 'text' ? b.text : '')).join(''),
      toolCalls: toolUseBlocks.length
        ? toolUseBlocks.map((tc) => ({
            id: tc.id,
            name: tc.name,
            arguments: tc.input as Record<string, unknown>,
          }))
        : undefined,
      usage: {
        promptTokens: res.usage.input_tokens,
        completionTokens: res.usage.output_tokens,
      },
    };
  }
}
