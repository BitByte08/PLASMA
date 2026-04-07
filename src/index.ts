// ─── Main engine ─────────────────────────────────────────────────────────────
export { PlasmaEngine } from './core/PlasmaEngine';
export type { SerializedPlasmaState } from './core/PlasmaEngine';

// ─── Sub-systems ──────────────────────────────────────────────────────────────
export { PersonaCore } from './core/PersonaCore';
export { EmotionCore } from './core/EmotionCore';
export { FatigueCore } from './core/FatigueCore';
export { MemoryCore } from './core/MemoryCore';
export { MessageRouter } from './communication/MessageRouter';
export { ConversationManager } from './communication/ConversationManager';
export { ResponseGenerator } from './communication/ResponseGenerator';
export { MCPClient } from './mcp/MCPClient';
export { PromptBuilder } from './llm/PromptBuilder';
export { LLMProvider } from './llm/LLMProvider';
export { OpenAIProvider } from './llm/OpenAIProvider';
export { AnthropicProvider } from './llm/AnthropicProvider';

// ─── Social Influence (RankSystem) ───────────────────────────────────────────
export {
  deriveModifiers,
  resolveModifiers,
  compareInfluence,
  getInfluenceEngagementMultiplier,
  getInfluenceToneHints,
  fromPreset,
  INFLUENCE_PRESETS,
} from './rank/RankSystem';
export type {
  SocialInfluence,
  InfluenceModifiers,
  InfluencePresetKey,
} from './rank/RankSystem';

// ─── Relationship Graph ───────────────────────────────────────────────────────
export { RelationshipGraph } from './graph/RelationshipGraph';
export type {
  RelationshipType,
  InteractionType,
  InteractionEvent,
  RelationshipEdge,
  GraphNode,
  GraphEdge,
  EgoGraph,
  EgoGraphStats,
} from './graph/RelationshipGraph';

// ─── All core types ───────────────────────────────────────────────────────────
export type {
  // LLM
  LLMConfig,
  LLMMessage,
  LLMToolCall,
  LLMResponse,
  LLMProviderType,
  // Persona
  PersonaDefinition,
  PersonalityMatrix,
  Skill,
  SkillLevel,
  CommunicationStyle,
  RelationshipEntry,
  // Emotion
  EmotionState,
  GameEvent,
  GameEventType,
  MoodType,
  // Fatigue
  FatigueState,
  FatigueConfig,
  // Memory
  MemoryEntry,
  MemoryConfig,
  MemoryType,
  // Messaging
  Message,
  ConversationContext,
  // Engagement
  EngagementDecision,
  EngagementScore,
  EngagementAction,
  // Tools / MCP
  MCPTool,
  ToolHandler,
  ToolResult,
  ToolParameterSchema,
  // Engine
  PlasmaConfig,
  PlasmaState,
  PlasmaEventMap,
} from './types';
