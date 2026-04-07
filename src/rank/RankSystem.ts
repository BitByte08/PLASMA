/**
 * SocialInfluence — abstract social-influence system.
 *
 * Instead of hardcoding job titles ("intern", "manager"), the engine treats
 * influence as a 0–100 numeric score. Behavioral modifiers (deference,
 * leadership presence, decision authority, etc.) are derived from this score.
 *
 * Game authors assign scores and optional labels to fit their domain:
 *
 *   Startup game  →  intern=5, senior=60, cto=95, founder=98
 *   School game   →  student=10, class_rep=40, teacher=75, principal=92
 *   Guild game    →  recruit=5, member=30, officer=65, guild_master=95
 *
 * Preset constants are provided for convenience but are never required.
 */

// ─── Core types ───────────────────────────────────────────────────────────────

export interface SocialInfluence {
  /** 0 = no standing, 100 = maximum influence */
  score: number;
  /** Human-readable label for display / prompts (e.g. '인턴', 'Guild Master') */
  label?: string;
  /** Optionally override any derived modifier */
  overrides?: Partial<InfluenceModifiers>;
}

export interface InfluenceModifiers {
  /** 0–1: authority to make decisions without approval */
  decisionAuthority: number;
  /** 0–1: tendency to defer/yield to higher-influence personas */
  deferenceToHigher: number;
  /** 0–1: confidence asserting views toward lower-influence personas */
  assertivenessToLower: number;
  /** 0–1: commanding presence in group settings */
  leadershipPresence: number;
  /** Productive hours before efficiency penalty kicks in */
  maxEffectiveHoursPerDay: number;
}

// ─── Derivation ───────────────────────────────────────────────────────────────

/**
 * Derive InfluenceModifiers from a raw influence score.
 * Uses non-linear (power-law) curves so the top is meaningfully
 * different from the middle, and the bottom is genuinely weak.
 */
export function deriveModifiers(score: number): InfluenceModifiers {
  const t = Math.max(0, Math.min(100, score)) / 100;
  return {
    decisionAuthority:    Math.pow(t, 0.65),
    deferenceToHigher:    Math.pow(1 - t, 0.55),
    assertivenessToLower: Math.pow(t, 0.50),
    leadershipPresence:   Math.pow(t, 0.60),
    maxEffectiveHoursPerDay: 8 + t * 6,  // 8h (score=0) → 14h (score=100)
  };
}

/**
 * Resolve the final modifiers for a persona, merging derived values with
 * any per-persona overrides.
 */
export function resolveModifiers(influence: SocialInfluence): InfluenceModifiers {
  const base = deriveModifiers(influence.score);
  if (!influence.overrides) return base;
  return { ...base, ...influence.overrides };
}

// ─── Comparison helpers ───────────────────────────────────────────────────────

/**
 * Score difference from my perspective.
 * Positive = they have higher influence; negative = lower.
 */
export function compareInfluence(
  mine: SocialInfluence,
  theirs: SocialInfluence
): number {
  return theirs.score - mine.score;
}

/**
 * Engagement multiplier based on influence gap.
 * Higher-influence persona asking = higher engagement.
 */
export function getInfluenceEngagementMultiplier(
  mine: SocialInfluence,
  theirs: SocialInfluence
): number {
  const diff = compareInfluence(mine, theirs);
  const myMods = resolveModifiers(mine);
  if (diff > 30) return 1.0 + myMods.deferenceToHigher * 0.6;
  if (diff > 10) return 1.0 + myMods.deferenceToHigher * 0.2;
  if (Math.abs(diff) <= 10) return 1.0;
  if (diff < -30) return 0.80;
  return 0.90;
}

/**
 * Tone hints for how this persona should communicate given the influence gap.
 */
export function getInfluenceToneHints(
  mine: SocialInfluence,
  theirs: SocialInfluence
): {
  useFormalLanguage: boolean;
  isDeferential: boolean;
  isAssertive: boolean;
  isInMentoringMode: boolean;
} {
  const diff = compareInfluence(mine, theirs);
  const myMods = resolveModifiers(mine);
  return {
    useFormalLanguage:  diff > 20,
    isDeferential:      diff > 20 && myMods.deferenceToHigher > 0.5,
    isAssertive:        diff < -20 && myMods.assertivenessToLower > 0.5,
    isInMentoringMode:  diff < -30 && myMods.leadershipPresence > 0.4,
  };
}

// ─── Convenience presets ──────────────────────────────────────────────────────
// These are plain numbers — copy them into your PersonaDefinition or define
// your own. Nothing in the engine depends on these names.

export const INFLUENCE_PRESETS = {
  // ── Generic ─────────────────────────────────────────
  newcomer:         5,
  junior_member:   20,
  member:          40,
  senior_member:   60,
  lead:            72,
  manager:         82,
  director:        90,
  top_executive:   96,
  founder:         99,

  // ── Corporate (스타트업 게임용) ──────────────────────
  intern:           5,
  junior:          20,   // 사원
  mid:             38,   // 대리
  senior:          58,   // 과장
  staff_lead:      70,   // 차장
  team_manager:    80,   // 팀장
  executive_dir:   88,   // 이사
  vp:              93,   // 부사장
  c_level:         96,   // C레벨
  ceo_founder:     99,

  // ── Academic ─────────────────────────────────────────
  student:         10,
  teaching_assistant: 35,
  lecturer:        55,
  professor:       75,
  department_head: 88,

  // ── Community / Guild ─────────────────────────────────
  recruit:          5,
  guild_member:    30,
  guild_officer:   65,
  guild_master:    92,
} as const;

export type InfluencePresetKey = keyof typeof INFLUENCE_PRESETS;

/** Build a SocialInfluence from a preset key. */
export function fromPreset(
  key: InfluencePresetKey,
  label?: string
): SocialInfluence {
  return { score: INFLUENCE_PRESETS[key], label: label ?? key };
}
