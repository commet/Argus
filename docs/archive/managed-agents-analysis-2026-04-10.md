# Claude Managed Agents — 기술 분석과 Argus 함의

> 2026-04-10 작성. Anthropic의 Managed Agents 발표, 오픈소스 대응(Multica), LangGraph Platform 발표를 종합 분석한다.

---

## 1. 배경: 모델이 한 세대 올라가면 코드가 죽는다

Claude Sonnet 4.5의 약점을 보완하려고 에이전트 엔진(harness)에 넣었던 패치 코드가, Opus 4.5/4.6이 나오자마자 방해물이 된다. Anthropic 엔지니어링 팀은 이 현상을 **"Dead Weight(죽은 무게)"**라고 부른다.

모델의 한계를 가정한 모든 영리한 코드는, 결국 청산해야 할 부채가 된다.

이것이 Managed Agents 발표의 출발점이다. 모델의 성장이 코드를 죽이는 반복적인 고통을 구조적으로 끊겠다는 선언.

### Harness는 모델의 약점 위에 쌓은 모래성

에이전트를 굴리는 제어 루프(harness)는 사실 모델의 구멍을 메우는 패치 덩어리다:

- **감시 로직**: 컨텍스트가 차오르면 불안해하는 모델(context anxiety)을 위해 감시 로직을 깐다
- **중복 필터**: 도구를 중복 호출하면 필터를 짠다
- **컨텍스트 관리**: 창이 길어지면 억지로 잘라내는 규칙을 박는다

하나하나 보면 합리적이지만, 모델이 발전하면 이 패치들은 모델이 더 잘할 수 있는 일을 가로막는 족쇄가 된다.

---

## 2. Anthropic의 설계 철학: 50년을 살아남은 운영체제의 지혜

1970년대 디스크와 지금의 SSD는 비교조차 안 될 기술 격차가 있지만, `read()`라는 시스템 호출은 그대로 살아남았다. 살아남은 쪽은 **인터페이스**였다. 디스크 모터가 돌든 플래시 셀이 번쩍이든, 앱은 그저 바이트를 읽어 달라고만 말하면 됐다.

Anthropic의 디자인 원칙:

> **"인터페이스에 대해서는 까다롭게 굴고, 구현(지능)에 대해서는 중립을 지킨다."**

우아한 추상화지만, 동시에 이 인터페이스가 견고해질수록 사용자는 이 생태계를 벗어나기 더 어려워진다. `read()`가 POSIX **표준**인 것과 달리, Managed Agents API는 **한 회사의 제품**이라는 근본적 차이가 있다.

---

## 3. Managed Agents 기술 구조

### 3.1 핵심 개념 — 4개의 축

| 개념 | 역할 |
|------|------|
| **Agent** | 모델 + 시스템 프롬프트 + 도구 + MCP 서버 + 스킬. 한 번 정의하면 ID로 참조 |
| **Environment** | 클라우드 컨테이너 템플릿 — 패키지(Python, Node.js, Go 등), 네트워크 규칙, 마운트 파일 |
| **Session** | Agent + Environment의 실행 인스턴스. 특정 작업을 수행하고 산출물을 생성 |
| **Events** | 앱과 에이전트 사이의 메시지(사용자 턴, 도구 결과, 상태 업데이트). SSE 스트리밍 |

### 3.2 세션, 하네스, 샌드박스의 완벽한 분리

Anthropic이 재설계한 인프라는 세 개의 축이 각자의 인터페이스 뒤로 숨었다:

1. **Session**: 모든 사건의 기록 (Append-only 이벤트 로그). 서버 측에서 영속화되며 전체 이력 조회 가능
2. **Harness**: 모델을 호출하고 도구 실행을 흘려보내는 제어 루프. 프롬프트 캐싱, 컴팩션, 성능 최적화 내장
3. **Sandbox**: 실제 코드 실행과 파일 편집이 일어나는 격리 환경

이 셋이 서로를 모르고 대화법만 맞춘다는 게 핵심이다. 샌드박스의 인터페이스는 딱 한 줄: `execute(name, input) → string`. 이 문자열이 도커 컨테이너에서 왔는지, 에뮬레이터에서 왔는지 하네스는 묻지 않는다.

### 3.3 실행 흐름

```
1. Agent 생성 → 모델, 프롬프트, 도구, MCP 서버, 스킬 정의
2. Environment 생성 → 컨테이너 템플릿 구성 (패키지, 네트워크, 파일)
3. Session 시작 → Agent + Environment 참조
4. Events 송수신 → 사용자 메시지 전송 → Claude가 자율적으로 도구 실행 → SSE로 결과 스트리밍
5. 조향/중단 → 실행 중 추가 이벤트로 방향 전환 또는 중단
```

### 3.4 지원 도구

- **Bash** — 컨테이너 내 셸 명령 실행
- **파일 조작** — Read, Write, Edit, Glob, Grep
- **웹** — 검색 및 URL 콘텐츠 가져오기
- **MCP 서버** — 외부 도구 제공자 연결

### 3.5 애완동물이 아닌 '가축'으로 다루는 인프라

이전 설계에서는 서버 하나가 쓰러지면 세션 자체가 증발했다. 이제는 다르다:

- **무상태 하네스**: 하네스가 충돌해도 세션 로그는 바깥에 살아있으니 재부팅하면 끝
- **보안 격리**: 자격 증명(Token)은 샌드박스 바깥 보안 저장소(Vault)에 보관. 모델은 토큰을 구경조차 못 한 채 프록시를 통해 작업 수행
- **컨테이너는 번호표**: 컨테이너가 털려도 털릴 게 없는 구조

### 3.6 성능 수치와 솔직한 자백

Anthropic은 첫 응답 속도(TTFT)를 최대 90%까지 줄였다고 발표했다. 원리: 컨테이너가 뜰 때까지 기다리지 않고, 모델이 세션 로그를 읽으며 즉시 답변을 준비한다.

또한 "가장 어려운 문제에서 성공률을 최대 10포인트 향상"시켰다고 한다.

**단, 이 수치는 전부 '자사 이전 코드'와의 비교다.** 경쟁사 벤치마크가 아니다. "우리가 어제까지 얼마나 느리고 비효율적이었는가"의 고백이자, 자신들의 한계를 돌파했다는 선언으로 읽는 게 정확하다.

### 3.7 현재 상태

- **베타**: `managed-agents-2026-04-01` 헤더 필요 (SDK는 자동 설정)
- **접근**: 모든 API 계정에서 기본 활성화
- **리서치 프리뷰**: Outcomes, Multi-agent, Memory (별도 신청)
- **Rate Limit**: 생성 60req/min, 조회 600req/min
- **브랜딩**: "Claude Agent" 또는 "Powered by Claude" 허용. "Claude Code" 브랜딩은 금지

---

## 4. Multica — 오픈소스 대응

### 4.1 정체

에이전트를 팀 동료처럼 할당하고, 실행을 모니터링하고, 스킬을 팀 전체에서 재사용하는 오픈소스 플랫폼.

**"몇 시간 만에 등장"이라는 프레이밍은 과장이다.** GitHub 기록을 보면 1,980 커밋, v0.1.21, 3.9k stars — 이미 상당 기간 개발되던 프로젝트다. 다만 Managed Agents 발표와 동시에 포지셔닝을 날카롭게 잡은 것.

### 4.2 기술 스택

| 레이어 | 기술 |
|--------|------|
| **프론트엔드** | Next.js 16 (App Router) |
| **백엔드** | Go (Chi router, sqlc, gorilla/websocket) |
| **데이터베이스** | PostgreSQL 17 + pgvector |
| **런타임** | 로컬 데몬 — Claude Code, Codex, OpenClaw, OpenCode 자동 감지 |

코드 구성: TypeScript 55.7%, Go 42.8%

### 4.3 핵심 기능

- **Agents as Teammates**: 에이전트에 프로필과 보드 존재감 부여
- **Autonomous Execution**: WebSocket을 통한 실시간 진행 스트리밍
- **Reusable Skills**: 팀 전체에서 스킬을 축적하고 재사용
- **Unified Runtimes**: 로컬 + 클라우드 컴퓨트 통합 관리
- **Multi-workspace**: 워크스페이스별 격리

### 4.4 Managed Agents vs Multica 비교

| 차원 | Claude Managed Agents | Multica |
|------|----------------------|---------|
| **런타임** | Anthropic 클라우드 전용 | 로컬 데몬 (자체 호스팅) |
| **벤더 종속** | Claude 전용 | 벤더 중립 (Claude, Codex, OpenClaw 등) |
| **아키텍처** | Session/Harness/Sandbox (서버리스) | Next.js + Go + PostgreSQL (자체 인프라) |
| **상태 관리** | Anthropic이 영속화 | PostgreSQL + pgvector 자체 관리 |
| **보안 모델** | Vault 기반 자격 증명 격리 | 로컬 데몬 수준 격리 |
| **핵심 가치** | "인프라 걱정 없이" | "내 인프라에서 내 방식으로" |
| **성숙도** | 베타 (2026-04) | v0.1.21, 3.9k stars |
| **비용** | API 사용량 기반 과금 | 오픈소스 (인프라 비용만) |

---

## 5. LangGraph Platform — 제3의 선택지

LangChain이 LangGraph Cloud를 **LangGraph Platform**으로 리브랜딩하며 발표한 통합 인프라.

### 5.1 구성 요소

- **LangGraph Server**: 배포 및 에이전트 관리
- **LangGraph Studio**: 시각화 + 디버깅 IDE
- **CLI + SDK**: 개발 도구

### 5.2 핵심 기능

- 수평 확장 인프라 + 태스크 큐
- 장시간 실행, 상태 유지 에이전트
- 스트리밍, 배치 처리, 상태 롤백
- Cron jobs + Webhooks
- 동시성 제어

### 5.3 배포 옵션 (베타)

| 티어 | 설명 |
|------|------|
| **Self-Hosted Lite** | 무료 (100만 노드 실행까지) |
| **Cloud SaaS** | 완전 관리형 |
| **BYOC** | AWS only, 관리형 |
| **Self-Hosted Enterprise** | 완전 온프레미스 |

### 5.4 포지셔닝

Managed Agents가 "우리 클라우드에서 우리 모델로"라면, LangGraph Platform은 "어디서든 어떤 모델로든"을 내세운다. Self-Hosted Lite 무료 제공은 락인 우려에 대한 직접적 대응.

---

## 6. 세 플랫폼 종합 비교

| 차원 | Managed Agents | Multica | LangGraph Platform |
|------|---------------|---------|-------------------|
| **모델** | Claude 전용 | 멀티 모델 | 멀티 모델 |
| **호스팅** | Anthropic 클라우드 | 셀프 호스팅 | 4단계 (클라우드~온프렘) |
| **오케스트레이션** | 내장 harness (블랙박스) | 태스크 보드 기반 | LangGraph (코드 레벨 제어) |
| **상태 관리** | 서버 측 자동 | PostgreSQL 자체 | 내장 체크포인팅 |
| **도구 생태계** | Bash, 파일, 웹, MCP | 런타임 CLI 기반 | Python 함수 기반 |
| **디버깅** | 이벤트 스트림 | WebSocket 모니터링 | Studio IDE (시각화) |
| **성숙도** | 베타 | v0.1.21 | 베타 |
| **가격** | API 종량제 | 무료 (인프라 비용) | Lite 무료~Enterprise 유료 |
| **락인 수준** | 높음 | 낮음 | 중간 |

---

## 7. Argus에 대한 함의

### 7.1 현재 Argus의 Harness 코드 맵

Argus는 이미 Managed Agents가 해결하려는 문제의 상당 부분을 자체 구현하고 있다:

| 패턴 | 파일 | 핵심 함수 | 역할 |
|------|------|-----------|------|
| **에이전트 오케스트레이션** | `orchestrator.ts` | `planWorkers`, `buildStages` | 멀티 에이전트 태스크 라우팅 + 스테이징 |
| **리드 에이전트** | `lead-agent.ts` | `selectLeadAgent` | 도메인별 합성 |
| **컨텍스트 컴팩션** | `compact-context.ts` | `compactQAHistory`, `compactSnapshots` | 토큰 예산 관리 |
| **컨텍스트 전략** | `context-strategy.ts` | `selectContextStrategy`, `recordStrategyOutcome` | 5가지 전략 + 자가 튜닝 |
| **리트라이 + 서킷 브레이커** | `llm.ts:28-201` | `fetchWithRetry`, `checkCircuit` | 장애 복원력 |
| **JSON 3단계 복구** | `llm.ts:203-250` | `parseJSON` | fence → regex object → regex array |
| **스키마 강제 변환** | `llm.ts:268-329` | `validateShape` | string→boolean 등 타입 보정 |
| **파싱 재시도** | `llm.ts:495-546` | `callLLMJson` | 교정 프롬프트로 재시도 |
| **품질 검증** | `worker-quality.ts` | `validateWorkerOutput` | 21개 placeholder 패턴 + LLM 폴백 |
| **가드 레일** | `guard-rails.ts` | `validateByFramework` | 프레임워크별 결정론적 검증 |
| **위임** | `agent-delegator.ts` | `findDelegateAgent`, `executeDelegation` | 역량 기반 서브태스크 디스패치 |
| **플래닝 게이트** | `agent-planner.ts` | `shouldPlan`, `executePlan` | 자율 에이전트 분해 |
| **스트리밍** | `llm.ts:613-775` | `callLLMStream`, `callLLMStreamThenParse` | 실시간 UX + 구조화 출력 |
| **병렬 호출** | `llm.ts:548-609` | `callLLMParallel` | Promise.allSettled 기반 동시 실행 |
| **수렴 측정** | `progressive-convergence.ts` | `assessConvergence` | 반복 종료 판단 (0-100 점수) |
| **모델 티어 라우팅** | `llm.ts:392-406` | 모델 해석 | fast/default/strong 3단계 자동 선택 |
| **입력 검증** | `llm-validation.ts` | `validateMessages` | 메시지 크기/수 제한 |
| **레이트 리미팅** | `llm.ts` + `route.ts` | `checkCircuit`, `checkRateLimit` | 요청 스로틀링 |
| **메타 분석** | `concertmaster.ts` | `generateInsights` | 판단 패턴 코칭 (LLM 호출 없음) |

### 7.2 Dead Weight 판별 — 어떤 코드가 다음 세대에서 죽는가

#### 죽을 코드 (모델 발전으로 불필요해지는 것)

| 코드 | 위치 | 이유 |
|------|------|------|
| JSON 3단계 복구 | `llm.ts:203-250` | Opus급 모델은 JSON을 안정적으로 생성. Structured output 네이티브 지원 |
| `validateShape` 타입 강제변환 | `llm.ts:268-329` | `"true"` → `true` 변환은 모델이 정확한 타입을 뱉으면 불필요 |
| 파싱 실패 시 교정 프롬프트 재시도 | `llm.ts:495-546` | 동상 |
| 21개 placeholder 패턴 탐지 | `worker-quality.ts` | "TBD", "추가 조사 필요" 같은 게으른 출력 자체가 감소 |
| 반복 문장 탐지 | `worker-quality.ts` | 동상 |
| 길이 기반 품질 체크 (<50자 = 실패) | `worker-quality.ts` | 모델이 충분한 답변을 생성하면 무의미한 체크 |

#### 살아남을 코드 (도메인 로직으로서 가치가 있는 것)

| 코드 | 위치 | 이유 |
|------|------|------|
| 컨텍스트 전략 5모드 + 자가 튜닝 | `context-strategy.ts` | 모델 능력과 무관한 **의사결정 도메인 지식** |
| 프레임워크별 가드 레일 | `guard-rails.ts` | Pre-mortem, Unit Economics 등 **구조적 검증**은 모델이 못 대체 |
| Concertmaster 메타 분석 | `concertmaster.ts` | 패턴 코칭은 LLM 호출 없는 **결정론적 분석** |
| Progressive convergence | `progressive-convergence.ts` | 수렴 판단은 Argus 고유의 **워크플로우 논리** |
| 에이전트 오케스트레이션 | `orchestrator.ts` | 도메인/stakes 기반 라우팅은 Argus만의 차별화 |
| 리드 에이전트 합성 | `lead-agent.ts` | 12개 도메인별 합성 지시문은 범용 harness에 없음 |
| 서킷 브레이커 | `llm.ts:93-140` | 인프라 복원력. Managed Agents 쓰면 불필요하지만, 자체 호스팅 시 필수 |

### 7.3 전략적 선택지

#### 선택지 A: 현행 유지

- 모델 세대마다 dead weight 청산 비용 감수
- 자유도 최대, 벤더 독립
- 멀티 프로바이더(Anthropic, OpenAI, Gemini) 유지 가능 — 현재 `llm.ts`가 이미 3개 프로바이더 지원

#### 선택지 B: 하이브리드 (가장 현실적)

- **교체**: LLM 호출 레이어(retry, JSON repair, streaming, parse retry)만 Managed Agents 또는 Anthropic SDK의 structured output으로 교체
- **유지**: 상위 오케스트레이션(context strategy, guard rails, convergence, concertmaster)
- 코드 ~30% 삭감, 자유도 ~80% 유지

#### 선택지 C: 전면 이전

- Agent/Session/Environment 모델로 재설계
- 코드 ~50% 삭감, 자유도 ~50% 삭감
- 멀티 프로바이더 포기, Anthropic 완전 종속
- Argus 고유의 오케스트레이션 논리를 Managed Agents의 프롬프트/도구 시스템 안으로 재편해야 함

### 7.4 권장 다음 수순

1. **얇게 만들기**: `parseJSON`, `validateShape`, placeholder 탐지를 Opus 4.6 기준으로 조건부 스킵하는 모델 티어 게이트 도입. 코드를 삭제하지 않되, 강한 모델에서는 우회하도록.
2. **두텁게 만들기**: context strategy 자가 튜닝의 히트레이트 데이터 축적, concertmaster 인사이트 고도화, guard-rails 프레임워크 확장.
3. **관찰하기**: Managed Agents 베타가 GA로 전환될 때의 가격 모델, rate limit 변화, multi-agent 기능 성숙도를 추적. 지금 전면 이전은 시기상조.

---

## 8. 구조적 판단: '죽은 코드'냐 '우아한 락인'이냐

Anthropic의 진단은 정확하다. 모델에 맞춰 쓰다듬고 패치한 코드는 반드시 죽은 무게가 된다. 그래서 그들은 제안한다: "애완동물을 직접 키우지 말고, 우리 집에 맡기세요."

하지만 잊지 말아야 한다:

- **직접 짤 것인가**: 모델이 바뀔 때마다 코드를 새로 짜는 부채를 짊어질 것인가
- **빌려 쓸 것인가**: Anthropic의 우아한 성벽 안에서 편하게 지내되 주도권을 양보할 것인가

지름길은 빠르지만, **통행료와 길의 방향은 도로 주인이 정한다.** 그 주인이 Anthropic으로 바뀌고 있다는 것.

그리고 하나 더:

> **도로 주인이 바뀌는 것보다 더 중요한 건, 도로 위의 차가 매 세대마다 바뀐다는 것이다.**

"누구의 인프라를 쓸 것인가"보다 **"어떤 코드가 다음 세대에서 살아남을 것인가"**를 먼저 판단하는 게 맞다. Argus에서 살아남을 코드는 context strategy, concertmaster, progressive convergence다. 죽을 코드는 JSON repair, placeholder 탐지, shape coercion이다. 전자를 두텁게 하고 후자를 얇게 만드는 것이 다음 수순이다.

---

## 참고 링크

- [Claude Managed Agents 공식 문서](https://platform.claude.com/docs/en/managed-agents/overview)
- [Claude Managed Agents 블로그](https://claude.com/blog/claude-managed-agents)
- [Multica GitHub](https://github.com/multica-ai/multica)
- [LangGraph Platform 발표](https://blog.langchain.com/langgraph-platform-announce/)
