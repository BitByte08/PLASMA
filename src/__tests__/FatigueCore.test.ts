import { FatigueCore } from '../core/FatigueCore';

describe('FatigueCore', () => {
  let core: FatigueCore;

  beforeEach(() => {
    core = new FatigueCore();
  });

  describe('initial state', () => {
    it('starts with high energy', () => {
      expect(core.current.energy).toBeGreaterThanOrEqual(80);
    });

    it('starts with low fatigue', () => {
      expect(core.current.mentalFatigue).toBeLessThanOrEqual(20);
    });

    it('is not exhausted initially', () => {
      expect(core.isExhausted()).toBe(false);
    });
  });

  describe('work()', () => {
    it('reduces energy', () => {
      const before = core.current.energy;
      core.work(2);
      expect(core.current.energy).toBeLessThan(before);
    });

    it('increases mental fatigue', () => {
      const before = core.current.mentalFatigue;
      core.work(2);
      expect(core.current.mentalFatigue).toBeGreaterThan(before);
    });

    it('accumulates work hours', () => {
      core.work(3);
      core.work(2);
      expect(core.current.workHoursToday).toBeCloseTo(5);
    });

    it('increases burnout risk when overworked', () => {
      core.work(12); // well over the default 10h max
      expect(core.current.burnoutRisk).toBeGreaterThan(0);
    });

    it('clamps energy at 0', () => {
      core.work(999);
      expect(core.current.energy).toBeGreaterThanOrEqual(0);
    });
  });

  describe('rest()', () => {
    it('recovers energy', () => {
      core.work(4);
      const tired = core.current.energy;
      core.rest(4);
      expect(core.current.energy).toBeGreaterThan(tired);
    });

    it('reduces mental fatigue', () => {
      core.work(4);
      const fatigued = core.current.mentalFatigue;
      core.rest(4);
      expect(core.current.mentalFatigue).toBeLessThan(fatigued);
    });

    it('clamps energy at 100', () => {
      core.rest(999);
      expect(core.current.energy).toBeLessThanOrEqual(100);
    });
  });

  describe('status checks', () => {
    it('isOverworked() after exceeding maxDailyHours', () => {
      core.work(11); // default max is 10
      expect(core.isOverworked()).toBe(true);
    });

    it('isExhausted() when energy is very low', () => {
      // drain to near zero
      core.work(999);
      expect(core.isExhausted()).toBe(true);
    });

    it('isBurningOut() when burnout risk is high', () => {
      for (let i = 0; i < 5; i++) core.work(12);
      expect(core.isBurningOut()).toBe(true);
    });
  });

  describe('efficiency modifier', () => {
    it('returns close to 1 when rested', () => {
      expect(core.getEfficiencyModifier()).toBeGreaterThan(0.7);
    });

    it('drops when tired', () => {
      const fresh = core.getEfficiencyModifier();
      core.work(8);
      const tired = core.getEfficiencyModifier();
      expect(tired).toBeLessThan(fresh);
    });
  });

  describe('newDay() / newWeek()', () => {
    it('resets daily work hours', () => {
      core.work(5);
      core.newDay();
      expect(core.current.workHoursToday).toBe(0);
    });

    it('newWeek() resets both daily and weekly', () => {
      core.work(5);
      core.newWeek();
      expect(core.current.workHoursToday).toBe(0);
      expect(core.current.workHoursThisWeek).toBe(0);
    });
  });
});
