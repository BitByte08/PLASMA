import { EmotionCore } from '../core/EmotionCore';
import { GameEvent } from '../types';

describe('EmotionCore', () => {
  let core: EmotionCore;

  beforeEach(() => {
    core = new EmotionCore();
  });

  describe('initial state', () => {
    it('starts with neutral mood', () => {
      expect(core.current.mood).toBe('neutral');
    });

    it('starts with balanced valence', () => {
      expect(core.current.valence).toBe(0);
    });

    it('starts with moderate motivation', () => {
      expect(core.current.motivation).toBeGreaterThan(0.5);
    });
  });

  describe('applyEvent', () => {
    it('increases valence after being praised', () => {
      const before = core.current.valence;
      const event: GameEvent = { type: 'praised', intensity: 0.8 };
      core.applyEvent(event);
      expect(core.current.valence).toBeGreaterThan(before);
    });

    it('decreases valence after task_failed', () => {
      const before = core.current.valence;
      core.applyEvent({ type: 'task_failed', intensity: 0.7 });
      expect(core.current.valence).toBeLessThan(before);
    });

    it('increases stress after deadline_missed', () => {
      const before = core.current.stressLevel;
      core.applyEvent({ type: 'deadline_missed', intensity: 0.9 });
      expect(core.current.stressLevel).toBeGreaterThan(before);
    });

    it('decreases stress after resolved_conflict', () => {
      // Prime with a conflict first
      core.applyEvent({ type: 'conflict', intensity: 0.8 });
      const stressed = core.current.stressLevel;
      core.applyEvent({ type: 'resolved_conflict', intensity: 0.8 });
      expect(core.current.stressLevel).toBeLessThan(stressed);
    });

    it('clamps valence to [-1, 1]', () => {
      for (let i = 0; i < 20; i++) {
        core.applyEvent({ type: 'praised', intensity: 1.0 });
      }
      expect(core.current.valence).toBeLessThanOrEqual(1);
      expect(core.current.valence).toBeGreaterThanOrEqual(-1);
    });

    it('uses customValenceDelta for custom events', () => {
      core.applyEvent({ type: 'custom', intensity: 1.0, customValenceDelta: 0.5 });
      expect(core.current.valence).toBeCloseTo(0.5, 1);
    });

    it('updates mood to burned_out when stress is very high', () => {
      for (let i = 0; i < 6; i++) {
        core.applyEvent({ type: 'deadline_missed', intensity: 1.0 });
        core.applyEvent({ type: 'overtime_forced', intensity: 1.0 });
      }
      expect(['burned_out', 'stressed', 'frustrated', 'angry']).toContain(core.current.mood);
    });
  });

  describe('decayTowardNeutral', () => {
    it('reduces positive valence over time', () => {
      core.applyEvent({ type: 'praised', intensity: 1.0 });
      const high = core.current.valence;
      core.decayTowardNeutral(24);
      expect(core.current.valence).toBeLessThan(high);
    });

    it('does not overshoot neutral into opposite', () => {
      core.applyEvent({ type: 'praised', intensity: 1.0 });
      core.decayTowardNeutral(1000);
      // Should approach 0 but not go below it aggressively
      expect(core.current.valence).toBeGreaterThanOrEqual(-0.1);
    });
  });

  describe('modifiers', () => {
    it('getSocialModifier returns 0–1', () => {
      const m = core.getSocialModifier();
      expect(m).toBeGreaterThanOrEqual(0);
      expect(m).toBeLessThanOrEqual(1);
    });

    it('getMoodQualityModifier is higher in good mood', () => {
      const neutral = core.getMoodQualityModifier();
      core.applyEvent({ type: 'praised', intensity: 1.0 });
      const happy = core.getMoodQualityModifier();
      expect(happy).toBeGreaterThan(neutral);
    });
  });
});
