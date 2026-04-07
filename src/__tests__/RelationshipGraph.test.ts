import { RelationshipGraph } from '../graph/RelationshipGraph';

const NOW = Date.now();

describe('RelationshipGraph', () => {
  let graph: RelationshipGraph;

  beforeEach(() => {
    graph = new RelationshipGraph([
      { personaId: 'alice', name: 'Alice', trust: 0.6, rapport: 0.7 },
      { personaId: 'bob',   name: 'Bob',   trust: 0.3, rapport: 0.2 },
    ]);
  });

  describe('constructor seeding', () => {
    it('creates edges from seeds', () => {
      expect(graph.getEdge('alice')).not.toBeNull();
      expect(graph.getEdge('bob')).not.toBeNull();
    });

    it('unknown persona returns null', () => {
      expect(graph.getEdge('nobody')).toBeNull();
    });
  });

  describe('recordInteraction()', () => {
    it('creates a new edge for an unseen persona', () => {
      graph.recordInteraction('carol', 'Carol', { type: 'first_meeting', intensity: 0.5, timestamp: NOW });
      expect(graph.getEdge('carol')).not.toBeNull();
    });

    it('increases trust after praised interaction', () => {
      const before = graph.getEdge('alice')!.trust;
      graph.recordInteraction('alice', 'Alice', { type: 'praised', intensity: 0.8, timestamp: NOW });
      expect(graph.getEdge('alice')!.trust).toBeGreaterThan(before);
    });

    it('increases tension after conflict', () => {
      const before = graph.getEdge('bob')!.tension;
      graph.recordInteraction('bob', 'Bob', { type: 'conflict', intensity: 0.9, timestamp: NOW });
      expect(graph.getEdge('bob')!.tension).toBeGreaterThan(before);
    });

    it('decreases tension after resolved_conflict', () => {
      graph.recordInteraction('bob', 'Bob', { type: 'conflict', intensity: 1.0, timestamp: NOW });
      const tense = graph.getEdge('bob')!.tension;
      graph.recordInteraction('bob', 'Bob', { type: 'resolved_conflict', intensity: 0.9, timestamp: NOW });
      expect(graph.getEdge('bob')!.tension).toBeLessThan(tense);
    });

    it('increments interactionCount', () => {
      const before = graph.getEdge('alice')!.interactionCount;
      graph.recordInteraction('alice', 'Alice', { type: 'message', intensity: 0.3, timestamp: NOW });
      expect(graph.getEdge('alice')!.interactionCount).toBe(before + 1);
    });

    it('clamps all metrics to [0, 1]', () => {
      for (let i = 0; i < 30; i++) {
        graph.recordInteraction('alice', 'Alice', { type: 'praised', intensity: 1.0, timestamp: NOW });
      }
      const edge = graph.getEdge('alice')!;
      expect(edge.trust).toBeLessThanOrEqual(1);
      expect(edge.rapport).toBeLessThanOrEqual(1);
      expect(edge.tension).toBeGreaterThanOrEqual(0);
    });

    it('stores recent events (max 20)', () => {
      for (let i = 0; i < 25; i++) {
        graph.recordInteraction('alice', 'Alice', { type: 'message', intensity: 0.2, timestamp: NOW });
      }
      expect(graph.getEdge('alice')!.recentEvents.length).toBeLessThanOrEqual(20);
    });

    it('respects customTrustDelta override', () => {
      const before = graph.getEdge('alice')!.trust;
      graph.recordInteraction('alice', 'Alice', {
        type: 'custom', intensity: 1.0, timestamp: NOW,
        customTrustDelta: 0.2,
      });
      expect(graph.getEdge('alice')!.trust).toBeCloseTo(before + 0.2, 1);
    });
  });

  describe('setExplicitType()', () => {
    it('overrides the derived relationship type', () => {
      graph.setExplicitType('alice', 'Alice', 'mentor');
      const edge = graph.getEdge('alice')!;
      expect(edge.explicitType).toBe('mentor');
    });
  });

  describe('getAllEdges() / getStrongest()', () => {
    it('returns all seeded edges', () => {
      expect(graph.getAllEdges()).toHaveLength(2);
    });

    it('getStrongest returns edges sorted by strength desc', () => {
      const strongest = graph.getStrongest(2);
      expect(strongest[0].targetPersonaId).toBe('alice'); // higher trust/rapport
    });
  });

  describe('toEgoGraph()', () => {
    it('includes a central node', () => {
      const ego = graph.toEgoGraph('me', 'Me', 'Developer');
      const center = ego.nodes.find((n) => n.isCentral);
      expect(center).toBeDefined();
      expect(center!.id).toBe('me');
    });

    it('includes nodes for all edges', () => {
      const ego = graph.toEgoGraph('me', 'Me');
      expect(ego.nodes).toHaveLength(3); // center + alice + bob
    });

    it('includes edges from center to each persona', () => {
      const ego = graph.toEgoGraph('me', 'Me');
      expect(ego.edges).toHaveLength(2);
      expect(ego.edges.every((e) => e.sourceId === 'me')).toBe(true);
    });

    it('computes stats', () => {
      const ego = graph.toEgoGraph('me', 'Me');
      expect(ego.stats.totalConnections).toBe(2);
      expect(ego.stats.avgTrust).toBeGreaterThan(0);
    });
  });

  describe('toPromptContext()', () => {
    it('returns non-empty string', () => {
      expect(graph.toPromptContext()).not.toBe('');
    });

    it('filters by relevant IDs when provided', () => {
      const ctx = graph.toPromptContext(['alice']);
      expect(ctx).toContain('Alice');
      expect(ctx).not.toContain('Bob');
    });
  });

  describe('decay()', () => {
    it('reduces tension over time', () => {
      graph.recordInteraction('alice', 'Alice', { type: 'conflict', intensity: 1.0, timestamp: NOW - 30 * 3_600_000 });
      const before = graph.getEdge('alice')!.tension;
      graph.decay(48);
      expect(graph.getEdge('alice')!.tension).toBeLessThanOrEqual(before);
    });
  });

  describe('serialisation', () => {
    it('toJSON / fromJSON round-trips', () => {
      graph.recordInteraction('carol', 'Carol', { type: 'helped', intensity: 0.7, timestamp: NOW });
      const json = graph.toJSON();
      const restored = RelationshipGraph.fromJSON(json);
      expect(restored.getEdge('alice')).not.toBeNull();
      expect(restored.getEdge('carol')).not.toBeNull();
    });
  });
});
