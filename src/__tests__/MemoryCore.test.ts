import { MemoryCore } from '../core/MemoryCore';

describe('MemoryCore', () => {
  let core: MemoryCore;

  beforeEach(() => {
    core = new MemoryCore({ maxEntries: 10 });
  });

  describe('add()', () => {
    it('stores a memory entry', () => {
      core.add({ type: 'semantic', content: 'Learned TypeScript', importance: 0.7, tags: ['tech'] });
      expect(core.getAll()).toHaveLength(1);
    });

    it('clamps importance to [0, 1]', () => {
      core.add({ type: 'semantic', content: 'test', importance: 5.0 });
      expect(core.getAll()[0].importance).toBeLessThanOrEqual(1);
    });

    it('returns an entry with an id', () => {
      const entry = core.add({ type: 'episodic', content: 'Had a meeting', importance: 0.5 });
      expect(typeof entry.id).toBe('string');
      expect(entry.id.length).toBeGreaterThan(0);
    });

    it('prunes when maxEntries exceeded', () => {
      for (let i = 0; i < 15; i++) {
        core.add({ type: 'semantic', content: `item-${i}`, importance: 0.1 });
      }
      expect(core.getAll().length).toBeLessThanOrEqual(10);
    });

    it('keeps high-importance entries when pruning', () => {
      // add one important entry first
      core.add({ type: 'emotional', content: 'Very important event', importance: 1.0 });
      // fill up the rest with low importance
      for (let i = 0; i < 15; i++) {
        core.add({ type: 'semantic', content: `filler-${i}`, importance: 0.01 });
      }
      const remaining = core.getAll();
      const important = remaining.find((e) => e.content === 'Very important event');
      expect(important).toBeDefined();
    });
  });

  describe('retrieve()', () => {
    beforeEach(() => {
      core.add({ type: 'semantic', content: 'Fixed a React bug in the frontend', importance: 0.8, tags: ['react', 'bug'] });
      core.add({ type: 'semantic', content: 'Had lunch with Alice', importance: 0.4, tags: ['social'] });
      core.add({ type: 'episodic', content: 'Deployed new feature to production', importance: 0.9, tags: ['deploy'] });
    });

    it('returns relevant memories for a keyword query', () => {
      const results = core.retrieve('React frontend', 5);
      expect(results[0].content).toContain('React');
    });

    it('returns empty array for empty core', () => {
      const empty = new MemoryCore();
      expect(empty.retrieve('anything', 5)).toEqual([]);
    });

    it('increments accessCount on retrieval', () => {
      core.retrieve('React', 3);
      const entry = core.getAll().find((e) => e.content.includes('React'));
      expect(entry?.accessCount).toBeGreaterThan(0);
    });

    it('respects limit', () => {
      const results = core.retrieve('', 2);
      expect(results.length).toBeLessThanOrEqual(2);
    });
  });

  describe('decay()', () => {
    it('reduces importance over game hours', () => {
      core.add({ type: 'semantic', content: 'Some old memory', importance: 0.5 });
      const before = core.getAll()[0].importance;
      core.decay(100);
      const after = core.getAll().find((e) => e.content === 'Some old memory');
      if (after) {
        expect(after.importance).toBeLessThan(before);
      }
      // It's OK if the entry was pruned — that also means decay worked
    });

    it('removes entries with near-zero importance', () => {
      core.add({ type: 'semantic', content: 'Fading memory', importance: 0.01 });
      core.decay(999);
      const found = core.getAll().find((e) => e.content === 'Fading memory');
      expect(found).toBeUndefined();
    });
  });

  describe('toPromptContext()', () => {
    it('returns empty string when no memories', () => {
      expect(core.toPromptContext('anything')).toBe('');
    });

    it('returns non-empty string with relevant memories', () => {
      core.add({ type: 'semantic', content: 'TypeScript best practices', importance: 0.8, tags: ['typescript'] });
      const ctx = core.toPromptContext('TypeScript');
      expect(ctx.length).toBeGreaterThan(0);
      expect(ctx).toContain('TypeScript');
    });
  });
});
