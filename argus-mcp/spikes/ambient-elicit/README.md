# Spike: out-of-band elicitation — "서버가 먼저 말을 걸 수 있는가"

> 판가름 대상 (BLUEPRINT §9 궤도): 사용자가 주요 작업을 돌리고 기다리는 동안,
> Argus MCP 서버가 **툴 호출 없이 먼저** 전제/미결 질문 피커를 띄울 수 있는가.
> 플러그인(훅) 없이 MCP 단독으로 ambient 질문이 서는지의 관문.

## 결론 (2026-07-15, SDK 1.29.0)

**프로토콜 + SDK 레벨: 된다. 9/9 통과.**

```
node spikes/ambient-elicit/spike.mjs
```

| # | 시나리오 | 결과 |
|---|---|---|
| S1 | 툴 호출 0번, initialize 200ms 뒤 서버발 elicit | ✅ 도착 + 답 왕복 |
| S2 | `arm` 툴이 **먼저 반환**된 뒤 300ms 후 서버발 elicit | ✅ 툴 결과 전달 이후에 질문 도착 (타임스탬프로 검증) |
| S3 | out-of-band 질문을 decline | ✅ 서버측 정상 resolve, 연결 생존 |
| S4 | elicitation 미선언 클라이언트에 서버발 elicit | ✅ 서버측 **loud throw** (catchable), 연결 무사 |

근거: MCP 전송은 양방향 JSON-RPC이고 `elicitation/create`는 server→client
**요청**이다. 스펙 어디에도 "in-flight 툴 호출 안에서만"이라는 제한이 없고,
SDK(`Server.elicitInput`)도 연결이 살아있는 한 아무 때나 보낼 수 있다.
이 스파이크가 그걸 실증했다.

## 아직 증명 안 된 것 (정직한 경계 — 두 주장은 분리 유지)

이 스파이크의 클라이언트는 SDK `Client`다 (= elicitation을 선언한 호스트의
스탠드인, `evals/elicit.mjs`와 동일 패턴). **실제 호스트가 툴 호출 밖에서
도착한 elicit을 UI로 렌더하는지는 호스트별 실증이 남아 있다.** 프로토콜이
허용해도 호스트가 pending 툴 콜에 UI를 묶어놨으면 떨어질 수 있다.

### 실호스트 대조 방법 (`server-oob.mjs`가 곧 탐침 서버)

1. 호스트에 등록 — 예: Claude Code:
   ```bash
   claude mcp add oob-probe --env ARGUS_SPIKE_AUTOFIRE=15000 -- node <repo>/argus-mcp/spikes/ambient-elicit/server-oob.mjs
   ```
2. 세션을 열고 **아무 일이나 하며 15초 기다린다** (autofire 경로),
   또는 모델에게 `arm { delay_ms: 15000 }`을 호출시키고 다른 작업을 계속한다.
3. 15초 뒤 피커가 뜨면 → 그 호스트에서 MCP 단독 ambient 성립.
   안 뜨면 stderr 로그(`elicit_threw` / resolve 없음)로 어느 층에서
   떨어졌는지 판별.
4. 결과를 아래 표에 기록:

| 호스트 | autofire (S1꼴) | arm 후 지연 (S2꼴) | 확인일 |
|---|---|---|---|
| Claude Code (CLI) | 미확인 | 미확인 | — |
| Claude Desktop / claude.ai | 미확인 | 미확인 | — |
| Cursor | 미확인 | 미확인 | — |

## 제품에 얹을 때의 설계 제약 (스파이크가 확정한 것)

- **capability 가드는 기존 seam 그대로**: S4가 보여주듯 미선언 호스트에
  쏘면 던진다. `lib/elicit.ts`의 `canElicit()` probe(선언 capability 확인)를
  ambient 발사 경로에도 반드시 물린다 — 이미 있는 패턴 재사용, 재발명 금지.
- **발사 판단은 overfire-gate 관할**: 서버는 사용자의 주요 대화를 못 본다.
  "언제 띄울까"는 언제나 근사치(마지막 툴 호출 직후, 타이머)이므로 스파인
  미러 조항(개입 여부를 대신 판단하지 말 것)에 직접 걸린다. 발사 게이트를
  `lib/overfire-gate.ts`에 물리고, 침묵을 기본값으로 한다 (ambient-due의
  `isSilent` 규칙과 동일한 결).
- **질문 형태는 스파인 그대로**: 전제/크럭스는 자유 텍스트(`premises.ts`
  op=resolve와 동일 — 선택지·기울기 금지), spine-SAFE 입력(정산 outcome 등)만
  구조화 픽커.
- **decline은 답이다**: S3 경로 — decline/무응답을 "나중에 다시"로 접지 않고
  조용히 물러난다 (M3 still_open과 같은 결).

## 파일

- `server-oob.mjs` — 탐침 서버 (스파이크 러너와 실호스트 대조 겸용, 비출하)
- `spike.mjs` — S1–S4 자동 검증 러너
