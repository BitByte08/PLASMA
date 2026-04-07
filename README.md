# Plasma Engine

**[English](#english)** · **[한국어](#한국어)**

---

<a id="english"></a>

## English

**P**ersona **L**ifecycle & **A**daptive **S**ocial **M**ind **A**rchitecture

LLM-backed AI persona engine for simulations, virtual agents, and interactive applications.

Each `PlasmaEngine` instance is one simulated person — they have a **personality**, **mood**, **fatigue**, **memory**, a **social influence score**, and a **relationship graph** centered on themselves. They read messages, decide whether to respond, call external tools, and produce in-character text replies.

Works in any **TypeScript** environment (Node.js, Electron, browser, etc.).
Requires an OpenAI or Anthropic API key supplied at runtime.

### Architecture

```
PlasmaEngine (one instance per persona)
├── PersonaCore         — static traits: personality, skills, values, influence score
├── EmotionCore         — dynamic mood: valence, arousal, stress, confidence, motivation
├── FatigueCore         — energy, mental fatigue, burnout risk; work/rest simulation
├── MemoryCore          — episodic/semantic/emotional memories with decay + retrieval
├── RelationshipGraph   — ego-centric graph; edges updated by every interaction
│
├── MessageRouter       — engagement decision engine (MUST / SHOULD / CAN / SKIP)
├── ConversationManager — conversation state and history
├── ResponseGenerator   — agentic loop: LLM → tool calls → result → final reply
│
├── MCPClient           — tool registry; register handlers at startup
├── PromptBuilder       — assembles system prompt from all live state
└── LLMProvider         — OpenAI / Anthropic abstraction
```

### Installation

```bash
npm install plasma-engine
# install your chosen LLM provider:
npm install openai             # for OpenAI
npm install @anthropic-ai/sdk  # for Anthropic
```

### Quick Start

```ts
import { PlasmaEngine, fromPreset } from 'plasma-engine';

const engine = new PlasmaEngine({
  persona: {
    id: 'dev-jisu',
    name: '김지수',
    role: 'Frontend Developer',
    influenceScore: fromPreset('senior').score,  // 58
    influenceLabel: 'Senior',
    personality: {
      openness: 0.75, conscientiousness: 0.65,
      extraversion: 0.45, agreeableness: 0.70,
      neuroticism: 0.30, ambition: 0.65,
    },
    background: '5-year frontend developer. React and TypeScript specialist.',
    skills: [
      { name: 'React',      level: 'expert',       domain: 'frontend' },
      { name: 'TypeScript', level: 'advanced',      domain: 'frontend' },
      { name: 'UI Design',  level: 'intermediate',  domain: 'design' },
    ],
    communicationStyle: { formality: 0.35, verbosity: 0.55, directness: 0.6, humor: 0.4, language: 'en' },
    relationships: [
      { personaId: 'lead-1', name: 'Team Lead', trust: 0.7, rapport: 0.6, influenceScore: 99, explicitType: 'superior' },
      { personaId: 'dev-2',  name: 'Park Minsu', trust: 0.8, rapport: 0.8, influenceScore: 40 },
    ],
    values: ['code quality', 'autonomy', 'learning'],
  },
  llm: {
    provider: 'anthropic',
    apiKey: process.env.ANTHROPIC_API_KEY!,
  },
  debug: false,
});
```

#### Register external tools

Plug in any callable action — databases, APIs, task queues, etc.:

```ts
engine.registerTool(
  {
    name: 'get_task_queue',
    description: 'List tasks currently assigned to this persona.',
    inputSchema: { type: 'object', properties: {} },
  },
  async () => myApp.getTasksFor(engine.persona.id)
);
```

#### Handle incoming messages

```ts
const decision = engine.routeMessage({
  id: 'msg-001',
  conversationId: 'channel-general',
  senderId: 'lead-1',
  senderName: 'Team Lead',
  senderInfluenceScore: 99,
  content: 'Jisu, is the sprint review ready?',
  timestamp: Date.now(),
  mentions: ['dev-jisu'],
  isDirectMessage: false,
});

// decision.action: 'MUST_RESPOND' | 'SHOULD_RESPOND' | 'CAN_RESPOND' | 'SKIP'
if (decision.action !== 'SKIP') {
  setTimeout(async () => {
    const reply = await engine.respond(message);
    myApp.sendMessage(engine.persona.id, reply);
  }, decision.delayMs);
}
```

#### Lifecycle events → emotion

```ts
engine.applyGameEvent({ type: 'praised',         intensity: 0.9 });
engine.applyGameEvent({ type: 'deadline_missed', intensity: 0.7 });
engine.applyGameEvent({ type: 'promoted',        intensity: 1.0 });
```

#### Time simulation

```ts
engine.advanceTime(8, false);  // 8 hours of work
engine.advanceTime(6, true);   // 6 hours of rest
engine.startNewDay();
engine.startNewWeek();
```

#### Events

```ts
engine.on('emotion:changed',      (state) => ui.updateMoodIndicator(state.mood));
engine.on('fatigue:changed',      (state) => ui.updateEnergyBar(state.energy));
engine.on('engagement:decided',   (d)     => console.log(d.action, d.reasoning));
engine.on('relationship:updated', (edge)  => updateGraphNode(edge));
engine.on('memory:added',         (mem)   => console.log('Memory:', mem.content));
engine.on('response:generated',   ({ response }) => console.log(response));
```

### Social Influence System

Instead of hardcoded job titles, Plasma uses a **0–100 influence score**:

```ts
import { INFLUENCE_PRESETS, fromPreset, deriveModifiers } from 'plasma-engine';

INFLUENCE_PRESETS.intern        // 5
INFLUENCE_PRESETS.senior        // 58
INFLUENCE_PRESETS.team_manager  // 80
INFLUENCE_PRESETS.ceo_founder   // 99

const jisu = fromPreset('senior', 'Senior');  // → { score: 58, label: 'Senior' }
const mods = deriveModifiers(58);
// mods.decisionAuthority      ≈ 0.52
// mods.deferenceToHigher      ≈ 0.44
// mods.maxEffectiveHoursPerDay ≈ 11.5
```

### Relationship Graph

| Metric | Range | Meaning |
|--------|-------|---------|
| `trust` | 0–1 | Reliability and honesty |
| `rapport` | 0–1 | Warmth and social comfort |
| `respect` | 0–1 | Admiration of competence/character |
| `tension` | 0–1 | Conflict and friction |
| `familiarity` | 0–1 | How well they know each other |

Auto-derived types: `close_friend` · `friend` · `colleague` · `rival` · `acquaintance` · `stranger`

### API Reference

| Method | Description |
|--------|-------------|
| `routeMessage(msg)` | Feed a message → returns `EngagementDecision` |
| `respond(msg, opts?)` | Generate and record a response string |
| `logInteraction(targetId, name, event)` | Record an interaction (updates relationship graph) |
| `setRelationshipType(id, name, type, meta?)` | Set explicit relationship classification |
| `getEgoGraph()` | Export graph for visualization |
| `applyGameEvent(event)` | Trigger emotional/memory update |
| `advanceTime(hours, isResting?)` | Simulate passage of time |
| `registerTool(tool, handler)` | Register an external tool |
| `serialize()` | Full serialisable state for save/load |
| `.on(event, handler)` | Subscribe to engine events |

### Save / Load

```ts
const saved = engine.serialize();
localStorage.setItem('persona-dev-jisu', JSON.stringify(saved));
// Full restore API planned for v0.3
```

---

<a id="한국어"></a>

## 한국어

**P**ersona **L**ifecycle & **A**daptive **S**ocial **M**ind **A**rchitecture

LLM 기반 AI 페르소나 엔진 — 감정·피로도·기억·인간관계를 가진 가상 인격이 상황에 맞게 자율적으로 판단하고 대화합니다.

`PlasmaEngine` 인스턴스 하나가 곧 한 명의 가상 인격입니다. **성격**, **기분**, **피로도**, **기억**, **사회적 영향력 점수**, 그리고 **관계 그래프**를 가지며, 메시지를 읽고 응답 여부를 스스로 판단해 캐릭터에 맞는 응답을 생성합니다.

**TypeScript** 환경이라면 어디서든 동작합니다 (Node.js, Electron, 브라우저 등). OpenAI 또는 Anthropic API 키가 필요합니다.

### 아키텍처

```
PlasmaEngine (페르소나당 1개 인스턴스)
├── PersonaCore         — 정적 특성: 성격, 스킬, 가치관, 영향력 점수
├── EmotionCore         — 동적 감정: 감가, 각성도, 스트레스, 자신감, 동기부여
├── FatigueCore         — 에너지, 정신 피로, 번아웃 위험; 근무/휴식 시뮬레이션
├── MemoryCore          — 에피소드/의미론적/감정 기억 (감쇠 + 검색)
├── RelationshipGraph   — 자기중심 그래프; 모든 상호작용으로 갱신
│
├── MessageRouter       — 참여 결정 엔진 (MUST / SHOULD / CAN / SKIP)
├── ConversationManager — 대화 상태 및 히스토리
├── ResponseGenerator   — 에이전트 루프: LLM → 도구 호출 → 결과 → 최종 응답
│
├── MCPClient           — 도구 레지스트리; 시작 시 핸들러 등록
├── PromptBuilder       — 모든 라이브 상태를 시스템 프롬프트로 조합
└── LLMProvider         — OpenAI / Anthropic 추상화
```

### 설치

```bash
npm install plasma-engine
# 사용할 LLM 프로바이더 설치:
npm install openai             # OpenAI
npm install @anthropic-ai/sdk  # Anthropic
```

### 빠른 시작

```ts
import { PlasmaEngine, fromPreset } from 'plasma-engine';

const engine = new PlasmaEngine({
  persona: {
    id: 'dev-jisu',
    name: '김지수',
    role: 'Frontend Developer',
    influenceScore: fromPreset('senior').score,  // 58
    influenceLabel: '과장',
    personality: {
      openness: 0.75, conscientiousness: 0.65,
      extraversion: 0.45, agreeableness: 0.70,
      neuroticism: 0.30, ambition: 0.65,
    },
    background: '5년차 프론트엔드 개발자. React와 TypeScript 전문가.',
    skills: [
      { name: 'React',      level: 'expert',       domain: 'frontend' },
      { name: 'TypeScript', level: 'advanced',      domain: 'frontend' },
      { name: 'UI Design',  level: 'intermediate',  domain: 'design' },
    ],
    communicationStyle: {
      formality: 0.35, verbosity: 0.55,
      directness: 0.6, humor: 0.4, language: 'ko',
    },
    relationships: [
      { personaId: 'lead-1', name: '팀장', trust: 0.7, rapport: 0.6, influenceScore: 99, explicitType: 'superior' },
      { personaId: 'dev-2',  name: '박민수', trust: 0.8, rapport: 0.8, influenceScore: 40 },
    ],
    values: ['code quality', 'autonomy', 'learning'],
  },
  llm: {
    provider: 'openai',
    apiKey: process.env.OPENAI_API_KEY!,
  },
  debug: false,
});
```

#### 외부 도구 등록

DB, API, 작업 큐 등 원하는 액션을 자유롭게 연결할 수 있습니다:

```ts
engine.registerTool(
  {
    name: 'get_task_queue',
    description: '이 페르소나에게 할당된 작업 목록을 가져옵니다.',
    inputSchema: { type: 'object', properties: {} },
  },
  async () => myApp.getTasksFor(engine.persona.id)
);
```

#### 메시지 처리

```ts
const decision = engine.routeMessage({
  id: 'msg-001',
  conversationId: 'channel-general',
  senderId: 'lead-1',
  senderName: '팀장',
  senderInfluenceScore: 99,
  content: '지수씨, 오늘 스프린트 리뷰 준비됐나요?',
  timestamp: Date.now(),
  mentions: ['dev-jisu'],
  isDirectMessage: false,
});

// decision.action: 'MUST_RESPOND' | 'SHOULD_RESPOND' | 'CAN_RESPOND' | 'SKIP'
if (decision.action !== 'SKIP') {
  setTimeout(async () => {
    const reply = await engine.respond(message);
    myApp.sendMessage(engine.persona.id, reply);
  }, decision.delayMs);
}
```

#### 라이프사이클 이벤트 → 감정

```ts
engine.applyGameEvent({ type: 'praised',         intensity: 0.9 });
engine.applyGameEvent({ type: 'deadline_missed', intensity: 0.7 });
engine.applyGameEvent({ type: 'promoted',        intensity: 1.0 });
```

#### 시간 시뮬레이션

```ts
engine.advanceTime(8, false);  // 8시간 근무
engine.advanceTime(6, true);   // 6시간 휴식
engine.startNewDay();
engine.startNewWeek();
```

#### 이벤트 구독

```ts
engine.on('emotion:changed',      (state) => ui.updateMoodIndicator(state.mood));
engine.on('fatigue:changed',      (state) => ui.updateEnergyBar(state.energy));
engine.on('engagement:decided',   (d)     => console.log(d.action, d.reasoning));
engine.on('relationship:updated', (edge)  => updateGraphNode(edge));
engine.on('memory:added',         (mem)   => console.log('기억:', mem.content));
engine.on('response:generated',   ({ response }) => console.log(response));
```

### 사회적 영향력 시스템

직급 이름 대신 **0~100 영향력 점수**를 사용합니다:

```ts
import { INFLUENCE_PRESETS, fromPreset, deriveModifiers } from 'plasma-engine';

INFLUENCE_PRESETS.intern        // 5
INFLUENCE_PRESETS.senior        // 58
INFLUENCE_PRESETS.team_manager  // 80
INFLUENCE_PRESETS.ceo_founder   // 99

const jisu = fromPreset('senior', '과장');  // → { score: 58, label: '과장' }
const mods = deriveModifiers(58);
// mods.decisionAuthority      ≈ 0.52
// mods.deferenceToHigher      ≈ 0.44
// mods.maxEffectiveHoursPerDay ≈ 11.5
```

### 관계 그래프

| 지표 | 범위 | 의미 |
|------|------|------|
| `trust` | 0–1 | 신뢰도 |
| `rapport` | 0–1 | 친밀감 |
| `respect` | 0–1 | 존경 |
| `tension` | 0–1 | 갈등 |
| `familiarity` | 0–1 | 친숙함 |

자동 분류: `close_friend` · `friend` · `colleague` · `rival` · `acquaintance` · `stranger`

### API 레퍼런스

| 메서드 | 설명 |
|--------|------|
| `routeMessage(msg)` | 메시지 수신 → `EngagementDecision` 반환 |
| `respond(msg, opts?)` | 응답 문자열 생성 및 기록 |
| `logInteraction(targetId, name, event)` | 상호작용 기록 (관계 그래프 업데이트) |
| `setRelationshipType(id, name, type, meta?)` | 관계 유형 명시적 설정 |
| `getEgoGraph()` | 시각화용 그래프 내보내기 |
| `applyGameEvent(event)` | 감정/기억 업데이트 트리거 |
| `advanceTime(hours, isResting?)` | 시간 경과 시뮬레이션 |
| `registerTool(tool, handler)` | 외부 도구 등록 |
| `serialize()` | 저장/로드용 전체 직렬화 |
| `.on(event, handler)` | 엔진 이벤트 구독 |

### 저장 / 로드

```ts
const saved = engine.serialize();
localStorage.setItem('persona-dev-jisu', JSON.stringify(saved));
// 전체 복원 API는 v0.3에서 계획 중
```
