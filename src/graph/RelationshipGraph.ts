import { v4 as uuidv4 } from 'uuid';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * The qualitative classification of a relationship.
 * Derived automatically from edge metrics; can be overridden explicitly.
 */
export type RelationshipType =
  | 'stranger'
  | 'acquaintance'
  | 'colleague'
  | 'friend'
  | 'close_friend'
  | 'rival'
  | 'mentor'      // they mentor me
  | 'mentee'      // I mentor them
  | 'superior'    // they have authority over me
  | 'report'      // they report to me
  | 'custom';     // game-defined

/**
 * The type of interaction that happened between two personas.
 * Each type carries a default delta-set that updates the edge.
 */
export type InteractionType =
  | 'message'
  | 'direct_message'
  | 'collaborated'
  | 'code_review'
  | 'pair_work'
  | 'helped'
  | 'conflict'
  | 'resolved_conflict'
  | 'praised'
  | 'criticized'
  | 'mentored'
  | 'meeting'
  | 'hired'
  | 'fired'
  | 'first_meeting'
  | 'social'          // lunch, team-building, etc.
  | 'custom';

export interface InteractionEvent {
  id: string;
  type: InteractionType;
  timestamp: number;    // Unix ms
  /** 0–1 intensity scale */
  intensity: number;
  description?: string;
  /** Override trust delta (bypasses the type's default) */
  customTrustDelta?: number;
  /** Override rapport delta */
  customRapportDelta?: number;
  /** Override tension delta */
  customTensionDelta?: number;
}

/** A directed edge: "how THIS persona views THAT persona" */
export interface RelationshipEdge {
  targetPersonaId: string;
  targetName: string;
  targetRole?: string;
  targetInfluenceScore?: number;
  /** If set, overrides the auto-derived RelationshipType */
  explicitType?: RelationshipType;
  trust: number;        // 0–1
  rapport: number;      // 0–1
  respect: number;      // 0–1
  tension: number;      // 0–1
  familiarity: number;  // 0–1 (how well I know them)
  interactionCount: number;
  lastInteractionAt: number;
  /** Rolling log of last 20 notable interactions */
  recentEvents: InteractionEvent[];
}

// Graph export types (for UI rendering)

export interface GraphNode {
  id: string;
  name: string;
  role?: string;
  influenceScore?: number;
  relationshipType: RelationshipType;
  /** Composite 0–1 strength score */
  strength: number;
  trust: number;
  rapport: number;
  tension: number;
  interactionCount: number;
  lastInteractionAt: number;
  isCentral: boolean;
}

export interface GraphEdge {
  id: string;
  sourceId: string;
  targetId: string;
  type: RelationshipType;
  /** 0–1 overall relationship weight */
  weight: number;
  trust: number;
  rapport: number;
  tension: number;
  interactionCount: number;
  label: string;
}

export interface EgoGraph {
  centerId: string;
  centerName: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  computedAt: number;
  stats: EgoGraphStats;
}

export interface EgoGraphStats {
  totalConnections: number;
  avgTrust: number;
  avgRapport: number;
  avgTension: number;
  mostTrustedId?: string;
  mostTrustedName?: string;
  mostTenseId?: string;
  mostTenseName?: string;
  closestAllyId?: string;
  closestAllyName?: string;
  biggestRivalId?: string;
  biggestRivalName?: string;
}

// ─── Interaction effect table ─────────────────────────────────────────────────

interface InteractionEffects {
  trustDelta: number;
  rapportDelta: number;
  tensionDelta: number;
  familiarityDelta: number;
}

const EFFECTS: Record<InteractionType, InteractionEffects> = {
  message:            { trustDelta:  0.008, rapportDelta:  0.015, tensionDelta: -0.005, familiarityDelta:  0.025 },
  direct_message:     { trustDelta:  0.015, rapportDelta:  0.025, tensionDelta: -0.010, familiarityDelta:  0.040 },
  collaborated:       { trustDelta:  0.045, rapportDelta:  0.040, tensionDelta: -0.015, familiarityDelta:  0.070 },
  code_review:        { trustDelta:  0.025, rapportDelta:  0.020, tensionDelta:  0.008, familiarityDelta:  0.045 },
  pair_work:          { trustDelta:  0.055, rapportDelta:  0.060, tensionDelta:  0.008, familiarityDelta:  0.090 },
  helped:             { trustDelta:  0.075, rapportDelta:  0.055, tensionDelta: -0.025, familiarityDelta:  0.060 },
  conflict:           { trustDelta: -0.150, rapportDelta: -0.100, tensionDelta:  0.250, familiarityDelta:  0.040 },
  resolved_conflict:  { trustDelta:  0.095, rapportDelta:  0.075, tensionDelta: -0.280, familiarityDelta:  0.040 },
  praised:            { trustDelta:  0.060, rapportDelta:  0.075, tensionDelta: -0.040, familiarityDelta:  0.030 },
  criticized:         { trustDelta: -0.050, rapportDelta: -0.040, tensionDelta:  0.095, familiarityDelta:  0.025 },
  mentored:           { trustDelta:  0.065, rapportDelta:  0.055, tensionDelta: -0.025, familiarityDelta:  0.065 },
  meeting:            { trustDelta:  0.010, rapportDelta:  0.015, tensionDelta:  0.000, familiarityDelta:  0.035 },
  hired:              { trustDelta:  0.090, rapportDelta:  0.040, tensionDelta:  0.000, familiarityDelta:  0.090 },
  fired:              { trustDelta: -0.280, rapportDelta: -0.180, tensionDelta:  0.380, familiarityDelta:  0.040 },
  first_meeting:      { trustDelta:  0.040, rapportDelta:  0.040, tensionDelta:  0.000, familiarityDelta:  0.120 },
  social:             { trustDelta:  0.035, rapportDelta:  0.075, tensionDelta: -0.035, familiarityDelta:  0.070 },
  custom:             { trustDelta:  0.000, rapportDelta:  0.000, tensionDelta:  0.000, familiarityDelta:  0.010 },
};

// ─── RelationshipGraph class ──────────────────────────────────────────────────

/**
 * Ego-centric relationship graph for a single persona.
 *
 * This is the "inner world" — how THIS persona perceives all other personas.
 * It is unidirectional: PersonaB's graph has its own edges with different values.
 *
 * Interactions are recorded via `recordInteraction()` which updates edge metrics
 * according to the interaction type and intensity.
 *
 * The graph auto-derives a RelationshipType from edge metrics, but the game
 * can override it via `setExplicitType()` for structural relationships
 * (manager, mentor, etc.) that cannot be inferred from interaction counts alone.
 */
export class RelationshipGraph {
  private readonly edges = new Map<string, RelationshipEdge>();

  constructor(
    seeds?: Array<{
      personaId: string;
      name: string;
      role?: string;
      influenceScore?: number;
      trust: number;
      rapport: number;
      history?: string;
      explicitType?: RelationshipType;
    }>
  ) {
    if (seeds) {
      for (const s of seeds) {
        this.edges.set(s.personaId, {
          targetPersonaId: s.personaId,
          targetName: s.name,
          targetRole: s.role,
          targetInfluenceScore: s.influenceScore,
          explicitType: s.explicitType,
          trust: clamp01(s.trust),
          rapport: clamp01(s.rapport),
          respect: clamp01(s.trust * 0.65 + 0.15),
          tension: 0,
          familiarity: clamp01((s.trust + s.rapport) / 2),
          interactionCount: 1,
          lastInteractionAt: Date.now(),
          recentEvents: [],
        });
      }
    }
  }

  // ─── Mutation ───────────────────────────────────────────────────────────────

  /**
   * Record an interaction with another persona.
   * Upserts the edge and adjusts all metrics.
   *
   * @param targetId   The other persona's ID
   * @param targetName Display name (used if edge is new)
   * @param event      What happened between them
   */
  recordInteraction(
    targetId: string,
    targetName: string,
    event: Omit<InteractionEvent, 'id'> & { id?: string }
  ): RelationshipEdge {
    let edge = this.edges.get(targetId);
    if (!edge) {
      edge = createEdge(targetId, targetName);
      this.edges.set(targetId, edge);
    }

    const fx = EFFECTS[event.type];
    const s = clamp01(event.intensity);

    const trustDelta   = event.customTrustDelta   ?? fx.trustDelta   * s;
    const rapportDelta = event.customRapportDelta  ?? fx.rapportDelta * s;
    const tensionDelta = event.customTensionDelta  ?? fx.tensionDelta * s;

    edge.trust       = clamp01(edge.trust   + trustDelta);
    edge.rapport     = clamp01(edge.rapport + rapportDelta);
    edge.tension     = clamp01(edge.tension + tensionDelta);
    edge.familiarity = clamp01(edge.familiarity + fx.familiarityDelta * s);
    edge.respect     = clamp01(
      edge.trust * 0.55 + edge.rapport * 0.20 + 0.10 +
      (fx.trustDelta > 0 ? 0.04 : -0.03) * s
    );
    edge.interactionCount++;
    edge.lastInteractionAt = event.timestamp;

    const fullEvent: InteractionEvent = { id: event.id ?? uuidv4(), ...event };
    edge.recentEvents.push(fullEvent);
    if (edge.recentEvents.length > 20) {
      edge.recentEvents.splice(0, edge.recentEvents.length - 20);
    }

    return { ...edge };
  }

  /**
   * Explicitly set the relationship classification.
   * Use for structural roles (superior, mentor, report) that can't be inferred.
   */
  setExplicitType(
    targetId: string,
    targetName: string,
    type: RelationshipType,
    meta?: { targetRole?: string; targetInfluenceScore?: number }
  ): void {
    let edge = this.edges.get(targetId);
    if (!edge) {
      edge = createEdge(targetId, targetName);
      this.edges.set(targetId, edge);
    }
    edge.explicitType = type;
    if (meta?.targetRole) edge.targetRole = meta.targetRole;
    if (meta?.targetInfluenceScore !== undefined) {
      edge.targetInfluenceScore = meta.targetInfluenceScore;
    }
  }

  /** Update display info for a known persona (e.g. after a name change). */
  updatePersonaInfo(
    targetId: string,
    info: Partial<Pick<RelationshipEdge, 'targetName' | 'targetRole' | 'targetInfluenceScore'>>
  ): void {
    const edge = this.edges.get(targetId);
    if (!edge) return;
    if (info.targetName) edge.targetName = info.targetName;
    if (info.targetRole !== undefined) edge.targetRole = info.targetRole;
    if (info.targetInfluenceScore !== undefined) {
      edge.targetInfluenceScore = info.targetInfluenceScore;
    }
  }

  // ─── Query ──────────────────────────────────────────────────────────────────

  getEdge(targetId: string): RelationshipEdge | null {
    return this.edges.get(targetId) ?? null;
  }

  getAllEdges(): RelationshipEdge[] {
    return Array.from(this.edges.values());
  }

  getByType(type: RelationshipType): RelationshipEdge[] {
    return this.getAllEdges().filter(
      (e) => (e.explicitType ?? deriveType(e)) === type
    );
  }

  /** Edges sorted by composite strength (trust + rapport − tension), descending. */
  getStrongest(limit = 5): RelationshipEdge[] {
    return [...this.getAllEdges()]
      .sort((a, b) => computeStrength(b) - computeStrength(a))
      .slice(0, limit);
  }

  getMostTense(limit = 3): RelationshipEdge[] {
    return [...this.getAllEdges()]
      .sort((a, b) => b.tension - a.tension)
      .slice(0, limit);
  }

  // ─── Time decay ─────────────────────────────────────────────────────────────

  /**
   * Decay familiarity and tension over simulated game time.
   * Call when the game clock advances (advanceTime in PlasmaEngine).
   */
  decay(gameHours: number): void {
    for (const edge of this.edges.values()) {
      // Familiarity drops when people don't interact
      const idleHours = (Date.now() - edge.lastInteractionAt) / 3_600_000;
      if (idleHours > 24) {
        edge.familiarity = Math.max(0, edge.familiarity - 0.0008 * gameHours);
      }
      // Tension naturally cools off
      if (edge.tension > 0) {
        edge.tension = Math.max(0, edge.tension - 0.0015 * gameHours);
      }
    }
  }

  // ─── Graph export ────────────────────────────────────────────────────────────

  /**
   * Export the graph in a format suitable for UI rendering (vis.js, cytoscape, d3, etc.)
   */
  toEgoGraph(centerId: string, centerName: string, centerRole?: string): EgoGraph {
    const allEdges = this.getAllEdges();
    const nodes: GraphNode[] = [];
    const gEdges: GraphEdge[] = [];

    // Center node
    nodes.push({
      id: centerId,
      name: centerName,
      role: centerRole,
      relationshipType: 'colleague',
      strength: 1,
      trust: 1,
      rapport: 1,
      tension: 0,
      interactionCount: 0,
      lastInteractionAt: Date.now(),
      isCentral: true,
    });

    let sumTrust = 0, sumRapport = 0, sumTension = 0;
    let mostTrustedEdge: RelationshipEdge | null = null;
    let mostTenseEdge: RelationshipEdge | null = null;
    let closestAllyEdge: RelationshipEdge | null = null;
    let biggestRivalEdge: RelationshipEdge | null = null;

    for (const edge of allEdges) {
      const type = edge.explicitType ?? deriveType(edge);
      const strength = computeStrength(edge);

      nodes.push({
        id: edge.targetPersonaId,
        name: edge.targetName,
        role: edge.targetRole,
        influenceScore: edge.targetInfluenceScore,
        relationshipType: type,
        strength,
        trust: edge.trust,
        rapport: edge.rapport,
        tension: edge.tension,
        interactionCount: edge.interactionCount,
        lastInteractionAt: edge.lastInteractionAt,
        isCentral: false,
      });

      gEdges.push({
        id: `${centerId}→${edge.targetPersonaId}`,
        sourceId: centerId,
        targetId: edge.targetPersonaId,
        type,
        weight: strength,
        trust: edge.trust,
        rapport: edge.rapport,
        tension: edge.tension,
        interactionCount: edge.interactionCount,
        label: type,
      });

      sumTrust   += edge.trust;
      sumRapport += edge.rapport;
      sumTension += edge.tension;

      if (!mostTrustedEdge || edge.trust > mostTrustedEdge.trust)
        mostTrustedEdge = edge;
      if (!mostTenseEdge || edge.tension > mostTenseEdge.tension)
        mostTenseEdge = edge;

      const allyScore = (edge.trust + edge.rapport) / 2 - edge.tension * 0.4;
      const rivalScore = edge.tension - (edge.trust + edge.rapport) * 0.3;
      if (!closestAllyEdge || allyScore > computeAllyScore(closestAllyEdge))
        closestAllyEdge = edge;
      if (!biggestRivalEdge || rivalScore > computeRivalScore(biggestRivalEdge))
        biggestRivalEdge = edge;
    }

    const n = allEdges.length;
    return {
      centerId,
      centerName,
      nodes,
      edges: gEdges,
      computedAt: Date.now(),
      stats: {
        totalConnections: n,
        avgTrust:    n ? sumTrust   / n : 0,
        avgRapport:  n ? sumRapport / n : 0,
        avgTension:  n ? sumTension / n : 0,
        mostTrustedId:   mostTrustedEdge?.targetPersonaId,
        mostTrustedName: mostTrustedEdge?.targetName,
        mostTenseId:     mostTenseEdge?.targetPersonaId,
        mostTenseName:   mostTenseEdge?.targetName,
        closestAllyId:   closestAllyEdge?.targetPersonaId,
        closestAllyName: closestAllyEdge?.targetName,
        biggestRivalId:  biggestRivalEdge?.targetPersonaId,
        biggestRivalName: biggestRivalEdge?.targetName,
      },
    };
  }

  // ─── Prompt context ──────────────────────────────────────────────────────────

  /**
   * Build a concise summary of key relationships for LLM system prompts.
   * Pass `relevantIds` to show only specific people; otherwise shows top 8.
   */
  toPromptContext(relevantIds?: string[]): string {
    const edges = relevantIds
      ? relevantIds.map((id) => this.edges.get(id)).filter(Boolean) as RelationshipEdge[]
      : [...this.getAllEdges()]
          .sort((a, b) => computeStrength(b) - computeStrength(a))
          .slice(0, 8);

    if (edges.length === 0) return '';

    const lines = edges.map((edge) => {
      const type = edge.explicitType ?? deriveType(edge);
      const flags: string[] = [];
      if (edge.tension > 0.5) flags.push('⚠ tension');
      if (edge.trust > 0.72)  flags.push('trusted');
      else if (edge.trust < 0.28) flags.push('distrusted');
      if (edge.rapport > 0.72) flags.push('good rapport');
      const suffix = flags.length ? ` [${flags.join(', ')}]` : '';
      return `- ${edge.targetName}${edge.targetRole ? ` (${edge.targetRole})` : ''}: ${type}${suffix}`;
    });

    return `My key relationships:\n${lines.join('\n')}`;
  }

  // ─── Serialisation ───────────────────────────────────────────────────────────

  toJSON(): RelationshipEdge[] {
    return this.getAllEdges();
  }

  static fromJSON(data: RelationshipEdge[]): RelationshipGraph {
    const g = new RelationshipGraph();
    for (const edge of data) {
      (g as unknown as { edges: Map<string, RelationshipEdge> }).edges.set(
        edge.targetPersonaId,
        edge
      );
    }
    return g;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function createEdge(targetId: string, targetName: string): RelationshipEdge {
  return {
    targetPersonaId: targetId,
    targetName,
    trust: 0.25,
    rapport: 0.25,
    respect: 0.25,
    tension: 0,
    familiarity: 0.10,
    interactionCount: 0,
    lastInteractionAt: Date.now(),
    recentEvents: [],
  };
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function computeStrength(e: RelationshipEdge): number {
  return e.trust * 0.40 + e.rapport * 0.35 + e.familiarity * 0.15 - e.tension * 0.10;
}

function computeAllyScore(e: RelationshipEdge): number {
  return (e.trust + e.rapport) / 2 - e.tension * 0.4;
}

function computeRivalScore(e: RelationshipEdge): number {
  return e.tension - (e.trust + e.rapport) * 0.3;
}

function deriveType(e: RelationshipEdge): RelationshipType {
  if (e.interactionCount < 2) return 'stranger';
  if (e.tension > 0.6 && e.rapport < 0.3) return 'rival';
  if (e.trust > 0.78 && e.rapport > 0.75) return 'close_friend';
  if (e.trust > 0.58 && e.rapport > 0.55) return 'friend';
  if (e.familiarity > 0.35) return 'colleague';
  return 'acquaintance';
}
