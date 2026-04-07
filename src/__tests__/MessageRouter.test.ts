import { MessageRouter } from '../communication/MessageRouter';
import { PersonaCore } from '../core/PersonaCore';
import { EmotionCore } from '../core/EmotionCore';
import { FatigueCore } from '../core/FatigueCore';
import { ConversationContext, Message, PersonaDefinition } from '../types';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const basePersona: PersonaDefinition = {
  id: 'dev1',
  name: 'Dev1',
  role: 'Frontend Developer',
  influenceScore: 40,
  personality: {
    openness: 0.7, conscientiousness: 0.6,
    extraversion: 0.5, agreeableness: 0.6,
    neuroticism: 0.3, ambition: 0.6,
  },
  background: 'Experienced developer.',
  skills: [
    { name: 'React', level: 'expert',       domain: 'frontend' },
    { name: 'TypeScript', level: 'advanced', domain: 'frontend' },
  ],
  communicationStyle: { formality: 0.4, verbosity: 0.5, directness: 0.5, humor: 0.4 },
  relationships: [
    { personaId: 'boss1', name: 'Boss',    trust: 0.8, rapport: 0.7, influenceScore: 90 },
    { personaId: 'peer1', name: 'PeerDev', trust: 0.6, rapport: 0.6, influenceScore: 38 },
  ],
  values: ['quality', 'learning'],
};

function makeConversation(isGroupChat = false): ConversationContext {
  return {
    id: 'conv1', participants: ['dev1', 'boss1'],
    messages: [], startedAt: Date.now(), lastActivityAt: Date.now(),
    isGroupChat,
  };
}

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 'msg1', conversationId: 'conv1',
    senderId: 'boss1', senderName: 'Boss',
    content: 'Hey, can you fix the React bug?',
    timestamp: Date.now(), mentions: [],
    isDirectMessage: true,
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('MessageRouter', () => {
  let persona: PersonaCore;
  let emotion: EmotionCore;
  let fatigue: FatigueCore;
  let router: MessageRouter;

  beforeEach(() => {
    persona = new PersonaCore(basePersona);
    emotion = new EmotionCore();
    fatigue = new FatigueCore();
    router  = new MessageRouter(persona, emotion, fatigue);
  });

  describe('MUST_RESPOND', () => {
    it('direct message → MUST_RESPOND', () => {
      const decision = router.decide(makeMessage({ isDirectMessage: true }), makeConversation());
      expect(decision.action).toBe('MUST_RESPOND');
    });

    it('@mention in group chat → MUST_RESPOND', () => {
      const decision = router.decide(
        makeMessage({ isDirectMessage: false, mentions: ['dev1'] }),
        makeConversation(true)
      );
      expect(decision.action).toBe('MUST_RESPOND');
    });

    it('exhausted persona still SHOULD_RESPOND to DM', () => {
      fatigue.work(999); // exhaust
      const decision = router.decide(makeMessage(), makeConversation());
      expect(['MUST_RESPOND', 'SHOULD_RESPOND']).toContain(decision.action);
    });
  });

  describe('SKIP', () => {
    it('message from self → SKIP', () => {
      const decision = router.decide(
        makeMessage({ senderId: 'dev1', senderName: 'Dev1', isDirectMessage: false }),
        makeConversation(true)
      );
      expect(decision.action).toBe('SKIP');
    });

    it('irrelevant group message from stranger → SKIP', () => {
      const decision = router.decide(
        makeMessage({
          senderId: 'stranger99', senderName: 'Stranger',
          content: 'What is the weather like?',
          isDirectMessage: false,
        }),
        makeConversation(true)
      );
      expect(decision.action).toBe('SKIP');
    });
  });

  describe('Engagement score components', () => {
    it('score.total is in [0, 1]', () => {
      const decision = router.decide(makeMessage(), makeConversation());
      expect(decision.score.total).toBeGreaterThanOrEqual(0);
      expect(decision.score.total).toBeLessThanOrEqual(1);
    });

    it('relevant domain content boosts relevance score', () => {
      const plain = router.decide(
        makeMessage({ content: 'Random chat', isDirectMessage: false }),
        makeConversation(true)
      );
      const relevant = router.decide(
        makeMessage({ content: 'Can you review the React frontend component?', isDirectMessage: false }),
        makeConversation(true)
      );
      expect(relevant.score.relevance).toBeGreaterThan(plain.score.relevance);
    });

    it('high-influence sender boosts engagement', () => {
      const lowSender = router.decide(
        makeMessage({ senderId: 'intern', senderName: 'Intern', senderInfluenceScore: 5, isDirectMessage: false }),
        makeConversation(true)
      );
      const highSender = router.decide(
        makeMessage({ senderId: 'ceo', senderName: 'CEO', senderInfluenceScore: 99, isDirectMessage: false }),
        makeConversation(true)
      );
      expect(highSender.score.influenceModifier).toBeGreaterThan(lowSender.score.influenceModifier);
    });

    it('urgent keywords boost urgency score', () => {
      const chill   = router.decide(makeMessage({ content: 'Hey, how are things?' }), makeConversation());
      const urgent  = router.decide(makeMessage({ content: 'URGENT: production is down, critical bug!' }), makeConversation());
      expect(urgent.score.urgency).toBeGreaterThan(chill.score.urgency);
    });
  });

  describe('delay calculation', () => {
    it('returns delayMs > 0 for non-SKIP actions', () => {
      const decision = router.decide(makeMessage(), makeConversation());
      if (decision.action !== 'SKIP') {
        expect(decision.delayMs).toBeGreaterThan(0);
      }
    });

    it('SKIP action has delayMs = 0', () => {
      const decision = router.decide(
        makeMessage({ senderId: 'dev1', senderName: 'Dev1', isDirectMessage: false }),
        makeConversation(true)
      );
      expect(decision.delayMs).toBe(0);
    });
  });
});
