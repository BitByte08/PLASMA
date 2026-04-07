# Plasma Engine

**[English](../README.md)** · **[한국어](./docs/README.ko.md)**

**P**ersona **L**ifecycle & **A**daptive **S**ocial **M**ind **A**rchitecture

---

> LLM 기반 AI 페르소나 시뮬레이션 엔진 — 감정·피로도·기억·인간관계를 가진 가상 인격이 상황에 맞게 자율적으로 판단하고 대화합니다.

`PlasmaEngine` 인스턴스 하나가 곧 한 명의 가상 인격입니다. 각 인스턴스는 **성격**, **기분**, **피로도**, **기억**, **사회적 영향력 점수**, 그리고 자신을 중심으로 한 **관계 그래프**를 가집니다. 메시지를 읽고, 응답 여부를 판단하며, 도구를 호출하고, 캐릭터에 맞는 텍스트 응답을 생성합니다.

**Electron + TypeScript** 환경에서 동작하며, OpenAI 또는 Anthropic API 키가 필요합니다.

---

## 아키텍처

```
PlasmaEngine (NPC/직원당 1개 인스턴스)
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
├── MCPClient           — 도구 레지스트리; 게임 시작 시 핸들러 연결
├── PromptBuilder       — 모든 라이브 상태를 시스템 프롬프트로 조합
└── LLMProvider         — OpenAI / Anthropic 추상화
```

---

## 설치

```bash
npm install plasma-engine
# 사용할 LLM 프로바이더 설치:
npm install openai              # OpenAI
npm install @anthropic-ai/sdk   # Anthropic
```

---

## 빠른 시작

```ts
import { PlasmaEngine, fromPreset } from 'plasma-engine';

const engine = new PlasmaEngine({
  persona: {
    id: 'dev-jisu',
    name: '김지수',
    role: 'Frontend Developer',
    influenceScore: fromPreset('senior').score,   // 58
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
      { personaId: 'ceo-1', name: 'CEO', trust: 0.7, rapport: 0.6, influenceScore: 99, explicitType: 'superior' },
      { personaId: 'dev-2', name: '박민수', trust: 0.8, rapport: 0.8, influenceScore: 40 },
    ],
    values: ['code quality', 'autonomy', 'learning'],
  },
  llm: {
    provider: 'openai',
    apiKey: userSuppliedApiKey,
  },
  debug: false,
});
```

---

## 게임 월드 도구 연결

게임 내부 로직을 엔진에 연결하려면 `registerTool()`을 사용합니다:

```ts
engine.registerTool(
  {
    name: 'get_task_queue',
    description: '이 직원에게 할당된 작업 목록을 가져옵니다.',
    inputSchema: { type: 'object', properties: {} },
  },
  async () => gameWorld.getTasksFor(engine.persona.id)
);

engine.registerTool(
  {
    name: 'complete_task',
    description: '작업을 완료 처리합니다.',
    inputSchema: {
      type: 'object',
      properties: {
        task_id: { type: 'string', description: '작업 ID' },
        summary: { type: 'string', description: '수행 내용' },
      },
      required: ['task_id'],
    },
  },
  async ({ task_id, summary }) => gameWorld.completeTask(task_id as string, summary as string)
);
```

> 기본적으로 7개의 스텁 도구가 등록되어 있습니다. `registerTool()`로 덮어쓰세요.

---

## 메시지 처리

### 메시지 수신 및 참여 결정

게임 메신저의 **모든 메시지**를 `routeMessage()`에 전달합니다:

```ts
const decision = engine.routeMessage({
  id: 'msg-001',
  conversationId: 'channel-general',
  senderId: 'ceo-1',
  senderName: 'CEO',
  senderInfluenceScore: 99,
  content: '지수씨, 오늘 스프린트 리뷰 준비됐나요?',
  timestamp: Date.now(),
  mentions: ['dev-jisu'],
  isDirectMessage: false,
});

// decision.action: 'MUST_RESPOND' | 'SHOULD_RESPOND' | 'CAN_RESPOND' | 'SKIP'
// decision.delayMs: 현실적인 타이핑 지연 시간

if (decision.action !== 'SKIP') {
  setTimeout(async () => {
    const reply = await engine.respond(message);
    gameUI.sendMessage(engine.persona.id, reply);
  }, decision.delayMs);
}
```

### 응답 생성

```ts
const reply = await engine.respond(message, {
  extraInstructions: '간결하게 답변해주세요.',
});
```

---

## 관계 그래프

메신저 외의 상호작용은 `logInteraction()`으로 기록합니다:

```ts
// 페어 프로그래밍
engine.logInteraction('dev-2', '박민수', {
  type: 'pair_work',
  intensity: 0.85,
  timestamp: Date.now(),
  description: '인증 모듈을 3시간 페어 프로그래밍함',
});

// 갈등
engine.logInteraction('designer-1', '이소라', {
  type: 'conflict',
  intensity: 0.7,
  timestamp: Date.now(),
  description: 'UI 컴포넌트 API 설계에 대해 의견 충돌',
});

// 조직 관계 설정
engine.setRelationshipType('new-intern', '정인턴', 'mentee', {
  targetRole: '인턴',
  targetInfluenceScore: 5,
});
```

### 그래프 시각화 데이터

```ts
const graph = engine.getEgoGraph();
// graph.nodes — 페르소나 본인은 isCentral = true
// graph.edges — sourceId가 항상 페르소나 ID
// graph.stats — mostTrustedId, closestAllyId, biggestRivalId 등

// vis.js / cytoscape / d3 등에 전달
renderGraph(graph.nodes, graph.edges);
```

---

## 감정 시스템

게임 이벤트가 감정 상태를 변화시킵니다:

```ts
engine.applyGameEvent({ type: 'praised',         intensity: 0.9 });
engine.applyGameEvent({ type: 'deadline_missed', intensity: 0.7 });
engine.applyGameEvent({ type: 'promoted',        intensity: 1.0 });
engine.applyGameEvent({
  type: 'custom',
  intensity: 0.6,
  customValenceDelta: -0.3,
  description: '해커톤 데모에서 탈락함',
});
```

### 감정 상태 (EmotionState)

| 필드 | 범위 | 의미 |
|------|------|------|
| `mood` | enum | 현재 기분 (happy, stressed, neutral 등) |
| `valence` | -1 ~ +1 | 긍정/부정 |
| `arousal` | 0 ~ 1 | 각성도 (차분함 → 흥분) |
| `stressLevel` | 0 ~ 1 | 스트레스 수준 |
| `confidence` | 0 ~ 1 | 자신감 |
| `motivation` | 0 ~ 1 | 동기부여 |

---

## 시간 시뮬레이션

```ts
// 8시간 근무
engine.advanceTime(8, false);

// 6시간 휴식 (수면 / 주말)
engine.advanceTime(6, true);

// 새로운 날 / 주 시작
engine.startNewDay();
engine.startNewWeek();
```

> `advanceTime()`을 호출하지 않으면 감정/피로/기억이 변하지 않습니다. 게임 시계와 연결하세요.

---

## 이벤트 구독

```ts
engine.on('emotion:changed',      (state) => ui.updateMoodIndicator(state.mood));
engine.on('fatigue:changed',      (state) => ui.updateEnergyBar(state.energy));
engine.on('engagement:decided',   (d)     => console.log(d.action, d.reasoning));
engine.on('relationship:updated', (edge)  => updateGraphNode(edge));
engine.on('memory:added',         (mem)   => console.log('기억:', mem.content));
engine.on('response:generated',   ({ response }) => console.log(response));
```

---

## 사회적 영향력 시스템

직급 이름 대신 **0~100 영향력 점수**를 사용합니다. 권력-법칙 곡선으로 모든 권위/준거 수정치를 계산합니다:

```ts
import { INFLUENCE_PRESETS, fromPreset, deriveModifiers } from 'plasma-engine';

// 내장 프리셋
INFLUENCE_PRESETS.intern        // 5
INFLUENCE_PRESETS.senior        // 58
INFLUENCE_PRESETS.team_manager  // 80
INFLUENCE_PRESETS.ceo_founder   // 99

// 학계
INFLUENCE_PRESETS.student       // 10
INFLUENCE_PRESETS.professor     // 75

// 프리셋으로 생성
const jisu = fromPreset('senior', '과장');
// → { score: 58, label: '과장' }

// 점수가 의미하는 행동 수정치 확인
const mods = deriveModifiers(58);
// mods.decisionAuthority      ≈ 0.52
// mods.deferenceToHigher      ≈ 0.44
// mods.leadershipPresence     ≈ 0.48
// mods.maxEffectiveHoursPerDay ≈ 11.5
```

도메인에 맞는 임의의 점수를 설정할 수 있습니다 — 엔진은 숫자만 봅니다:

```ts
// 판타지 RPG
{ id: 'guild-master', influenceScore: 92, influenceLabel: '길드 마스터' }
{ id: 'new-recruit',  influenceScore: 8,  influenceLabel: '신입 모험가' }
```

---

## 관계 그래프 상세

모든 `PlasmaEngine`은 **자기중심 방향 그래프**를 유지합니다. 간선은 이 페르소나의 타인에 대한 주관적 인식을 나타냅니다.

### 간선 지표

| 지표 | 범위 | 의미 |
|------|------|------|
| `trust` | 0–1 | 신뢰도 |
| `rapport` | 0–1 | 친밀감 |
| `respect` | 0–1 | 존경 |
| `tension` | 0–1 | 갈등 |
| `familiarity` | 0–1 | 친숙함 |

### 상호작용 유형

| 유형 | 효과 |
|------|------|
| `message` / `direct_message` | 친밀감 + 친숙함 소폭 증가 |
| `collaborated` / `pair_work` | 신뢰 + 친밀감 크게 증가 |
| `helped` | 신뢰 크게 증가 |
| `conflict` | 신뢰/친밀감 하락, 갈등 급증 |
| `resolved_conflict` | 갈등 크게 감소 |
| `praised` / `criticized` | 신뢰 +/- |
| `mentored` | 신뢰 + 친밀감 + 존경 증가 |
| `hired` / `fired` | 신뢰 크게 +/- |
| `social` | 친밀감 증가 |
| `custom` | `customTrustDelta` / `customRapportDelta` / `customTensionDelta` 사용 |

### 자동 분류되는 관계 유형

| 유형 | 조건 |
|------|------|
| `close_friend` | trust > 0.78 AND rapport > 0.75 |
| `friend` | trust > 0.58 AND rapport > 0.55 |
| `colleague` | familiarity > 0.35 |
| `rival` | tension > 0.6 AND rapport < 0.3 |
| `acquaintance` | interactionCount ≥ 2 |
| `stranger` | interactionCount < 2 |

`setRelationshipType()`으로 구조적 역할(`superior`, `mentor`, `report` 등)을 명시적으로 설정할 수 있습니다.

---

## API 레퍼런스

### `PlasmaEngine`

| 메서드 | 설명 |
|--------|------|
| `routeMessage(msg)` | 메시지 수신 → `EngagementDecision` 반환 |
| `respond(msg, opts?)` | 응답 문자열 생성 및 기록 |
| `logInteraction(targetId, name, event)` | 메신저 외 상호작용 기록 |
| `setRelationshipType(id, name, type, meta?)` | 관계 유형 명시적 설정 |
| `getEgoGraph()` | UI 렌더링용 그래프 내보내기 |
| `applyGameEvent(event)` | 감정/기억 업데이트 트리거 |
| `advanceTime(hours, isResting?)` | 게임 시간 경과 시뮬레이션 |
| `startNewDay()` / `startNewWeek()` | 시간 누적값 리셋 |
| `registerTool(tool, handler)` | 게임 월드 도구 등록 |
| `remember(content, importance, type?, tags?)` | 수동으로 기억 추가 |
| `recallRelevant(query, limit?)` | 관련 기억 검색 |
| `getState()` | 현재 엔진 상태 스냅샷 |
| `serialize()` | 저장/로드용 전체 직렬화 |
| `.on(event, handler)` | 엔진 이벤트 구독 |

### `EngagementDecision`

```ts
{
  action: 'MUST_RESPOND' | 'SHOULD_RESPOND' | 'CAN_RESPOND' | 'SKIP';
  score: {
    relevance: number;         // 페르소나 스킬과의 주제 관련성
    social: number;            // 기분 조정된 사회적 성향
    energy: number;            // 피로도 조정된 에너지
    relationship: number;      // 발신자와의 신뢰 + 친밀감
    addressContext: number;    // DM/멘션 vs 그룹 채팅
    urgency: number;           // 키워드 기반 긴급도
    influenceModifier: number; // 권위 차이 수정치
    total: number;             // 최종 가중 점수
  };
  shouldDelay: boolean;
  delayMs: number;             // 타이핑 지연 시간
  reasoning: string;
}
```

### 게임 이벤트 유형

`task_completed` · `task_failed` · `praised` · `criticized` · `promoted` · `demoted` · `deadline_missed` · `conflict` · `resolved_conflict` · `overtime_forced` · `bonus_received` · `team_success` · `team_failure` · `mentored` · `learned_skill` · `custom`

---

## 저장 / 로드

```ts
// 저장
const saved = engine.serialize();
localStorage.setItem('persona-dev-jisu', JSON.stringify(saved));

// 로드 — 저장된 상태에서 복원
// (현재 emotion/fatigue/memory/relationships의 수동 복원 필요)
// 전체 복원 API는 v0.3에서 계획 중
```

---

## 테스트

### 유닛 테스트

```bash
npm install
npm test
```

커버리지: `EmotionCore`, `FatigueCore`, `MemoryCore`, `RelationshipGraph`, `RankSystem`, `MessageRouter`

### LLM 통합 테스트

실제 LLM API를 호출하는 통합 테스트입니다.

**1. API 키 준비**

무료 LLM API 추천:

| 프로바이더 | 무료 한도 | 비고 |
|-----------|----------|------|
| **Groq** | 분당 30요청 | OpenAI SDK 호환, 속도 빠름 |
| OpenRouter | 일부 모델 무료 | OpenAI SDK 호환 |
| Google Gemini | 분당 15요청 | 별도 SDK 필요 |
| Together AI | 가입 시 $5 크레딧 | OpenAI SDK 호환 |

**2. `.env` 파일 설정**

```env
PLASMA_INTEGRATION=1
PLASMA_LLM_PROVIDER=openai
PLASMA_LLM_API_KEY=gsk_발급받은키
PLASMA_LLM_BASE_URL=https://api.groq.com/openai/v1
PLASMA_LLM_MODEL=openai/gpt-oss-20b
```

**3. 실행**

```bash
npm run test:integration
```

대화 로그는 `integration-test.log`에 저장됩니다.

---

## 주의사항

- **엔진 1개 = 페르소나 1명.** NPC/직원마다 `PlasmaEngine` 인스턴스를 생성하세요.
- **`respond()` 전에 반드시 `routeMessage()` 호출.** routeMessage가 대화 히스토리에 메시지를 기록합니다.
- **`logInteraction()`으로 관계가 성장합니다.** 이것 없이는 메신저 대화만 그래프에 영향을 줍니다.
- **영향력 점수는 숫자일 뿐입니다.** 특정 프리셋 이름에 의존하지 말고 `INFLUENCE_PRESETS.xxx` 또는 `fromPreset()`을 사용하세요.
- **도구는 기본적으로 스텁입니다.** 실제 핸들러를 `registerTool()`로 등록하세요.
- **`advanceTime()`을 반드시 호출하세요.** 그렇지 않으면 감정/피로/기억이 수동적으로 변하지 않습니다.
- **`serialize()`로 저장하고** 디스크에 보관하세요. 엔진 자체에는 영속성이 없습니다.
