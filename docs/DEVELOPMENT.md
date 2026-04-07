# Plasma Engine — 개발 가이드

## 목차

- [프로젝트 구조](#프로젝트-구조)
- [개발 환경 세팅](#개발-환경-세팅)
- [테스트 실행](#테스트-실행)
- [LLM 통합 테스트](#llm-통합-테스트)
- [새 모듈 추가하기](#새-모듈-추가하기)
- [새 LLM 프로바이더 추가하기](#새-llm-프로바이더-추가하기)
- [설계 원칙](#설계-원칙)
- [커밋 컨벤션](#커밋-컨벤션)
- [버전 관리](#버전-관리)
- [릴리즈 프로세스](#릴리즈-프로세스)

---

## 프로젝트 구조

```
src/
├── core/
│   ├── PlasmaEngine.ts       # 메인 진입점, 모든 모듈을 조합
│   ├── PersonaCore.ts        # 정적 특성 (성격, 스킬, 영향력)
│   ├── EmotionCore.ts        # 감정 상태 및 변화 로직
│   ├── FatigueCore.ts        # 피로도, 에너지, 번아웃 시뮬레이션
│   └── MemoryCore.ts         # 기억 저장, 감쇠, 검색
│
├── graph/
│   └── RelationshipGraph.ts  # 자기중심 방향 그래프 (관계 데이터)
│
├── communication/
│   ├── MessageRouter.ts      # 메시지 수신 → 참여 결정 (MUST/SHOULD/CAN/SKIP)
│   ├── ConversationManager.ts# 대화 상태 및 히스토리
│   └── ResponseGenerator.ts  # LLM 호출 + 도구 루프 → 최종 응답
│
├── llm/
│   ├── LLMProvider.ts        # 추상 인터페이스
│   ├── AnthropicProvider.ts  # Anthropic SDK 구현체
│   ├── OpenAIProvider.ts     # OpenAI SDK 구현체
│   └── PromptBuilder.ts      # 시스템 프롬프트 조합기
│
├── mcp/
│   └── MCPClient.ts          # 도구 레지스트리 (게임 월드 연결)
│
├── rank/
│   └── RankSystem.ts         # 영향력 점수 프리셋 및 수정치 계산
│
├── utils/
│   ├── EventEmitter.ts       # 타입 안전 이벤트 버스
│   └── Logger.ts             # 디버그 로거
│
├── types/
│   └── index.ts              # 모든 공개 타입 정의
│
└── index.ts                  # 공개 API export
```

---

## 개발 환경 세팅

```bash
# 1. 저장소 클론
git clone https://github.com/bssm-oss/Plasma.git
cd Plasma

# 2. 의존성 설치
npm install

# 3. TypeScript 빌드
npm run build

# 4. 타입 체크 (빌드 없이)
npm run lint
```

### 권장 개발 환경

- Node.js 18+
- TypeScript 5.x
- VS Code + ESLint / Prettier 확장

빌드 자동화:
```bash
npm run build:watch  # 변경 감지 자동 빌드
```

---

## 테스트 실행

```bash
# 전체 유닛 테스트
npm test

# 특정 파일만
npx jest EmotionCore

# 커버리지 포함
npx jest --coverage
```

### 테스트 커버리지 대상

| 파일 | 테스트 파일 |
|------|------------|
| `EmotionCore` | `__tests__/EmotionCore.test.ts` |
| `FatigueCore` | `__tests__/FatigueCore.test.ts` |
| `MemoryCore` | `__tests__/MemoryCore.test.ts` |
| `RelationshipGraph` | `__tests__/RelationshipGraph.test.ts` |
| `RankSystem` | `__tests__/RankSystem.test.ts` |
| `MessageRouter` | `__tests__/MessageRouter.test.ts` |

---

## LLM 통합 테스트

실제 LLM API를 호출하는 E2E 테스트입니다. 무료 API 키로 실행 가능합니다.

### 무료 LLM 프로바이더 추천

| 프로바이더 | 무료 한도 | OpenAI SDK 호환 |
|-----------|----------|:--------------:|
| **Groq** | 분당 30요청 | ✅ |
| OpenRouter | 일부 모델 무료 | ✅ |
| Together AI | 가입 시 $5 크레딧 | ✅ |
| Google Gemini | 분당 15요청 | ❌ (별도 SDK) |

### 세팅 방법

프로젝트 루트에 `.env` 파일 생성:

```env
PLASMA_INTEGRATION=1
PLASMA_LLM_PROVIDER=openai
PLASMA_LLM_API_KEY=gsk_발급받은키
PLASMA_LLM_BASE_URL=https://api.groq.com/openai/v1
PLASMA_LLM_MODEL=llama3-8b-8192
```

실행:

```bash
npm run test:integration
```

대화 로그는 `integration-test.log`에 저장됩니다.

> `.env` 파일은 `.gitignore`에 포함되어 있습니다. 절대 커밋하지 마세요.

---

## 새 모듈 추가하기

예시: `MoodHistoryCore` 추가

**1. `src/core/MoodHistoryCore.ts` 작성**

```ts
export class MoodHistoryCore {
  private history: { mood: string; timestamp: number }[] = [];

  record(mood: string) {
    this.history.push({ mood, timestamp: Date.now() });
  }

  getLast(n: number) {
    return this.history.slice(-n);
  }
}
```

**2. `PlasmaEngine.ts`에서 초기화 및 연결**

```ts
import { MoodHistoryCore } from './MoodHistoryCore';

export class PlasmaEngine {
  private moodHistory: MoodHistoryCore;

  constructor(config: PlasmaEngineConfig) {
    // ...
    this.moodHistory = new MoodHistoryCore();

    // EmotionCore 이벤트와 연결
    this.emotion.on('changed', (state) => {
      this.moodHistory.record(state.mood);
    });
  }
}
```

**3. `src/types/index.ts`에 필요한 타입 추가**

**4. `src/index.ts`에서 공개 export 추가**

```ts
export { MoodHistoryCore } from './core/MoodHistoryCore';
```

**5. `src/__tests__/MoodHistoryCore.test.ts` 작성 후 `npm test` 통과 확인**

---

## 새 LLM 프로바이더 추가하기

예시: Gemini 프로바이더

**1. `src/llm/GeminiProvider.ts` 작성**

```ts
import type { LLMProvider, LLMMessage, LLMResponse, LLMTool } from './LLMProvider';

export class GeminiProvider implements LLMProvider {
  constructor(private apiKey: string, private model: string) {}

  async complete(messages: LLMMessage[], tools?: LLMTool[]): Promise<LLMResponse> {
    // Google Generative AI SDK 호출
    // ...
  }
}
```

**2. `src/llm/LLMProvider.ts`의 인터페이스 구현 확인**

`complete()` 메서드가 `LLMResponse` 형태를 반환해야 합니다:

```ts
interface LLMResponse {
  content: string;
  toolCalls?: { name: string; input: Record<string, unknown> }[];
}
```

**3. `PlasmaEngine.ts`의 프로바이더 생성 분기에 추가**

```ts
switch (config.llm.provider) {
  case 'openai':    return new OpenAIProvider(...);
  case 'anthropic': return new AnthropicProvider(...);
  case 'gemini':    return new GeminiProvider(...);   // 추가
}
```

**4. `src/types/index.ts`의 `LLMProviderType` 유니언에 `'gemini'` 추가**

---

## 설계 원칙

### 1. 인스턴스 = 페르소나 1명
`PlasmaEngine`은 절대 공유 상태를 갖지 않습니다. NPC 10명이면 인스턴스 10개입니다.

### 2. 숫자만 믿는다
영향력 점수는 `0–100` 숫자이고, 프리셋 이름(`senior`, `ceo_founder`)은 편의 헬퍼일 뿐입니다. 엔진 내부 로직은 숫자만 참조합니다.

### 3. 도구는 항상 스텁이 기본
`MCPClient`는 기본 스텁 핸들러를 제공합니다. 게임이 `registerTool()`로 실제 핸들러를 주입합니다.

### 4. 이벤트로 상태 변화를 알린다
`PlasmaEngine`의 내부 상태 변화는 이벤트(`emotion:changed`, `relationship:updated` 등)로만 외부에 알립니다. 폴링하지 마세요.

### 5. 직렬화 가능성 유지
모든 내부 상태는 `serialize()`로 JSON 직렬화 가능해야 합니다. 함수나 클래스 인스턴스를 상태에 저장하지 마세요.

---

## 커밋 컨벤션

[Conventional Commits](https://www.conventionalcommits.org/) 규칙을 따릅니다.

```
<type>(<scope>): <subject>
```

### 타입

| 타입 | 언제 쓰나 |
|------|----------|
| `feat` | 새 기능 추가 |
| `fix` | 버그 수정 |
| `docs` | 문서만 변경 |
| `refactor` | 기능 변화 없는 코드 정리 |
| `test` | 테스트 추가/수정 |
| `chore` | 빌드, 패키지, 설정 변경 |
| `perf` | 성능 개선 |

### 스코프 (선택)

변경된 모듈을 명시합니다.

`emotion` · `fatigue` · `memory` · `graph` · `router` · `llm` · `mcp` · `rank` · `types`

### 예시

```
feat(emotion): add burnout recovery curve
fix(router): fix MUST_RESPOND threshold for DMs
docs: add Korean section to README
refactor(llm): extract prompt assembly into PromptBuilder
test(graph): add rivalry classification edge case
chore: bump typescript to 5.8
```

### Breaking Change

공개 API가 바뀌는 경우 본문에 `BREAKING CHANGE:` 를 명시합니다:

```
feat(types)!: rename PersonaConfig.influenceScore to socialScore

BREAKING CHANGE: PersonaConfig.influenceScore has been renamed to
socialScore for clarity. Update all usages accordingly.
```

`!` 표시 또는 `BREAKING CHANGE:` 가 있으면 major 버전을 올려야 합니다.

---

## 버전 관리

[Semantic Versioning](https://semver.org/) 을 따릅니다: `MAJOR.MINOR.PATCH`

| 버전 종류 | 언제 올리나 | 예시 |
|----------|-----------|------|
| `MAJOR` | 공개 API 파괴적 변경 | `1.0.0` → `2.0.0` |
| `MINOR` | 하위 호환되는 기능 추가 | `1.0.0` → `1.1.0` |
| `PATCH` | 하위 호환되는 버그 수정 | `1.0.0` → `1.0.1` |

### 프리릴리즈 단계

```
alpha → beta → rc → 정식 출시
```

| 태그 | 의미 | 버전 예시 | npm 배포 명령 |
|------|------|----------|--------------|
| `alpha` | 초기 개발, 기능 불완전 | `1.0.0-alpha.1` | `npm publish --tag alpha` |
| `beta` | 기능 완성, 버그 수정 중 | `1.0.0-beta.1` | `npm publish --tag beta` |
| `rc` | 최종 후보, 이상 없으면 정식 출시 | `1.0.0-rc.1` | `npm publish --tag rc` |
| *(없음)* | 정식 출시 (`latest`) | `1.0.0` | `npm publish` |

> 프리릴리즈 태그가 붙은 버전은 `npm install plasma-engine` 으로는 설치되지 않습니다.
> 사용자가 `npm install plasma-engine@rc` 처럼 명시해야 설치됩니다.

### 버전 올리는 법

```bash
# 정식 버전
npm version patch    # 1.0.0 → 1.0.1
npm version minor    # 1.0.0 → 1.1.0
npm version major    # 1.0.0 → 2.0.0

# 프리릴리즈
npm version prerelease --preid=alpha   # 1.0.0 → 1.0.1-alpha.0
npm version prerelease --preid=beta    # 1.0.1-alpha.0 → 1.0.1-beta.0
npm version prerelease --preid=rc      # 1.0.1-beta.0 → 1.0.1-rc.0

# 또는 직접 지정
npm version 1.1.0-rc.1
```

`npm version` 은 `package.json` 수정 + git commit + git tag 를 한 번에 처리합니다.

---

## 릴리즈 프로세스

### 정식 릴리즈

```bash
# 1. 테스트 전체 통과 확인
npm test

# 2. 버전 올리기 (package.json + git commit + git tag 자동 생성)
npm version patch   # 버그 수정: 0.2.0 → 0.2.1
npm version minor   # 기능 추가: 0.2.0 → 0.3.0
npm version major   # 파괴적 변경: 0.2.0 → 1.0.0

# 3. GitHub에 푸시 (태그 포함)
git push origin main --tags

# 4. npm 배포
npm publish --otp=<2FA코드>
```

### 프리릴리즈

```bash
# 1. 버전 지정
npm version 1.0.0-rc.1

# 2. GitHub에 푸시
git push origin main --tags

# 3. npm 배포 (--tag 필수)
npm publish --tag rc --otp=<2FA코드>

# rc → 정식 출시할 때
npm version 1.0.0
npm publish --otp=<2FA코드>
```
