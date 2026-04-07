import {
  deriveModifiers,
  resolveModifiers,
  compareInfluence,
  getInfluenceEngagementMultiplier,
  getInfluenceToneHints,
  fromPreset,
  INFLUENCE_PRESETS,
  SocialInfluence,
} from '../rank/RankSystem';

describe('RankSystem (SocialInfluence)', () => {
  describe('deriveModifiers()', () => {
    it('score=0 → near-zero authority, near-full deference', () => {
      const m = deriveModifiers(0);
      expect(m.decisionAuthority).toBeCloseTo(0, 2);
      expect(m.deferenceToHigher).toBeCloseTo(1, 1);
    });

    it('score=100 → near-full authority, near-zero deference', () => {
      const m = deriveModifiers(100);
      expect(m.decisionAuthority).toBeCloseTo(1, 1);
      expect(m.deferenceToHigher).toBeCloseTo(0, 1);
    });

    it('score=50 → balanced', () => {
      const m = deriveModifiers(50);
      expect(m.decisionAuthority).toBeGreaterThan(0.2);
      expect(m.decisionAuthority).toBeLessThan(0.8);
      expect(m.deferenceToHigher).toBeGreaterThan(0.2);
      expect(m.deferenceToHigher).toBeLessThan(0.8);
    });

    it('maxEffectiveHoursPerDay scales from 8h (0) to 14h (100)', () => {
      expect(deriveModifiers(0).maxEffectiveHoursPerDay).toBeCloseTo(8, 0);
      expect(deriveModifiers(100).maxEffectiveHoursPerDay).toBeCloseTo(14, 0);
    });

    it('clamps score to [0, 100]', () => {
      const mNeg = deriveModifiers(-50);
      const mOver = deriveModifiers(150);
      expect(mNeg).toEqual(deriveModifiers(0));
      expect(mOver).toEqual(deriveModifiers(100));
    });
  });

  describe('resolveModifiers()', () => {
    it('applies overrides', () => {
      const inf: SocialInfluence = {
        score: 20,
        overrides: { decisionAuthority: 0.99 },
      };
      const m = resolveModifiers(inf);
      expect(m.decisionAuthority).toBe(0.99);
      // other fields still derived
      expect(m.deferenceToHigher).toBeGreaterThan(0.3);
    });
  });

  describe('compareInfluence()', () => {
    const junior: SocialInfluence = { score: 20 };
    const senior: SocialInfluence = { score: 60 };

    it('positive when theirs is higher', () => {
      expect(compareInfluence(junior, senior)).toBeGreaterThan(0);
    });

    it('negative when theirs is lower', () => {
      expect(compareInfluence(senior, junior)).toBeLessThan(0);
    });

    it('zero when equal', () => {
      expect(compareInfluence(junior, junior)).toBe(0);
    });
  });

  describe('getInfluenceEngagementMultiplier()', () => {
    const intern: SocialInfluence  = { score: 5 };
    const manager: SocialInfluence = { score: 80 };
    const peer: SocialInfluence    = { score: 20 };

    it('manager asking junior → multiplier > 1 (defer to authority)', () => {
      const mult = getInfluenceEngagementMultiplier(intern, manager);
      expect(mult).toBeGreaterThan(1);
    });

    it('junior asking manager → multiplier < 1', () => {
      const mult = getInfluenceEngagementMultiplier(manager, intern);
      expect(mult).toBeLessThan(1);
    });

    it('peer to peer → multiplier ≈ 1', () => {
      const mult = getInfluenceEngagementMultiplier(peer, peer);
      expect(mult).toBeCloseTo(1, 1);
    });
  });

  describe('getInfluenceToneHints()', () => {
    it('junior to high-level → formal + deferential', () => {
      const hints = getInfluenceToneHints({ score: 5 }, { score: 95 });
      expect(hints.useFormalLanguage).toBe(true);
      expect(hints.isDeferential).toBe(true);
      expect(hints.isAssertive).toBe(false);
    });

    it('senior to intern → assertive + mentoring mode', () => {
      const hints = getInfluenceToneHints({ score: 80 }, { score: 5 });
      expect(hints.isAssertive).toBe(true);
      expect(hints.isInMentoringMode).toBe(true);
      expect(hints.isDeferential).toBe(false);
    });

    it('peer to peer → no strong hints', () => {
      const hints = getInfluenceToneHints({ score: 40 }, { score: 42 });
      expect(hints.isDeferential).toBe(false);
      expect(hints.isAssertive).toBe(false);
    });
  });

  describe('INFLUENCE_PRESETS and fromPreset()', () => {
    it('all presets are numbers in [0, 100]', () => {
      for (const [key, score] of Object.entries(INFLUENCE_PRESETS)) {
        expect(typeof score).toBe('number');
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(100);
      }
    });

    it('fromPreset returns correct score', () => {
      const inf = fromPreset('intern');
      expect(inf.score).toBe(INFLUENCE_PRESETS.intern);
    });

    it('fromPreset uses provided label', () => {
      const inf = fromPreset('senior', '과장');
      expect(inf.label).toBe('과장');
    });

    it('intern score < senior score < founder score', () => {
      expect(INFLUENCE_PRESETS.intern).toBeLessThan(INFLUENCE_PRESETS.senior);
      expect(INFLUENCE_PRESETS.senior).toBeLessThan(INFLUENCE_PRESETS.founder);
    });
  });
});
