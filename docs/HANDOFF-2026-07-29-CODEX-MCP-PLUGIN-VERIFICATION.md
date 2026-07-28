# Argus MCP·플러그인 독립 검증 인수인계

작성 시각: 2026-07-29 (Asia/Seoul)

작업 브랜치: `codex/fix-mcp-verification-and-codex-host`

작성 목적: 다른 기기의 새 Codex 세션이 맥락을 다시 추측하지 않고, 아직 끝나지 않은 치명적 결함부터 재현·수정·반증하도록 한다.

## 2026-07-29 후속 세션 결과

이 절이 아래의 최초 인수인계보다 우선한다. 아래 본문은 결함을 발견했을 때의
재현 기록으로 보존하며, 더 이상 현재 상태를 뜻하지 않는다.

### 결론

- 최신 `origin/main`과 MCP 2.0.5 / 플러그인 3.0.5 릴리스 브랜치를 통합했다.
- 500ms 기반 decline 재분류와 process-global picker circuit을 제거했다.
- MCP `decline`은 속도와 무관하게 `declined`, `cancel`은 `no_answer/cancelled`,
  전송 오류는 `no_answer/failed`, capability 미지원은 `unsupported`로 보존한다.
- 한 tool call은 elicitation을 한 번만 시도하고 끝난다. 한 응답이 이후의 다른
  picker를 전역 차단하지 않는다.

### 왜 이 설계가 맞는가

설치된 Codex CLI 0.145.0의 app-server를 실제로 기동하고 두 thread를 만들었다.

1. `mcp_elicitations=true`: 바깥 client에 `mode:"form"` 요청이 도착했고 Accept가
   user-owned seal로 기록됐다.
2. `mcp_elicitations=false`: 바깥 client에는 요청이 0건이었고, MCP 서버가 받은
   원시 값은 `_meta` 없는 `{action:"decline"}`였다.

MCP 표준도 `decline`을 사용자의 명시적 거절로 정의하며, 정책 거절을 식별하는
별도 필드는 없다. 따라서 서버가 elapsed time으로 둘을 구분하는 것은 관측이
아니라 추측이다. `evals/codex-elicit-wire-probe.mjs`와
`evals/codex-app-server.mjs`가 이 사실을 실제 wire에서 고정한다.

### 최종 전수 검증

정식 명령은 문서의 옛 표기인 `npm run verify:all`이 아니라 다음이다.

```powershell
cd argus-mcp
npm run verify
```

2026-07-29 후속 세션 결과:

- build / typecheck: 통과
- 단위·프로토콜: 120 files, 1,116 tests 통과
- E2E picker: 13/13
- battery: 92 calls, 0 RED
- picker surfaces: 6,696 checks, 0 violations
- host matrix: 390 checks, 0 violations
- real Codex app-server: 15 checks, 0 violations
- Claude Code form: 120 checks, 0 violations
- 95초 slow-human: 3 checks, 0 violations
- plugin validate/install/simulate/parity: 전부 통과
- mutation self-test: 심은 회귀 24개를 모두 해당 gate가 검출
- 원본 보호: mutation 대상 10개 바이트 불변, 격리 사본 삭제

추가로 테스트 temp root에 실행별 무작위 소유 토큰을 붙이고 global teardown을
추가했다. 병렬 워크스페이스의 fixture를 건드리지 않으면서 자기 실행의
`argus-test-*`만 재시도 삭제한다.

### 아직 남은 외부 단계

이 절 작성 시점에는 코드와 로컬 전수 검증이 끝났고, 남은 것은 PR CI, main 병합,
태그/배포, published tarball 재검증뿐이다. 이 단계가 끝나기 전에는 “배포 완료”로
표현하지 않는다.

## 0. 가장 먼저 읽을 결론

이 작업은 **완료되지 않았다. 현재 전체 검증은 빨간색이다.**

Claude 쪽 변경은 `main`에 반영되었다. PR #308, #313, #314, #315가 모두 `origin/main`에 들어와 있다. 그러나 이 문서와 함께 있는 Codex 변경은 아직 `main`에 병합·배포되지 않은 WIP다.

현재 가장 치명적인 미완료 항목은 다음 하나의 설계 결함으로 모인다.

> MCP elicitation 응답이 500ms 안에 `decline`되면 “호스트 정책이 화면도 띄우지 않고 자동 거절했다”고 간주하고, 그 MCP 세션의 이후 모든 픽커를 차단한다. 그러나 테스트와 실제 사용자 모두 충분히 빠르게 정상 Decline할 수 있다. 현재 구현은 이 둘을 시간만으로 구별하며, 정상 Decline을 정책 차단으로 오인한 뒤 이후 픽커를 전부 없앤다.

이 때문에 최신 전체 검증에서 baseline 3개가 실패했고 self-test는 의도대로 시작하지 않았다.

- E2E picker: 9 passed, 4 failed
- content battery: 92 calls, 1 RED
- picker surfaces: 290 checks, 32 violations

이 문제를 테스트 지연으로 숨기지 말 것. 먼저 “정책 자동 거절”과 “사용자가 실제로 누른 빠른 Decline”을 프로토콜 또는 관측 가능한 증거로 구분할 수 있는지 조사하고, 불가능하다면 오판의 피해 반경을 줄이는 상태 기계를 다시 설계해야 한다.

## 1. 저장소와 병합 현황

이 문서를 작성할 때 확인한 상태:

```text
workspace:
C:\Users\SAMSUNG\Documents\GitHub\commet\Argus

branch:
codex/fix-mcp-verification-and-codex-host

local HEAD:
e62730fe  Merge PR #313

origin/main:
f3eb4530  PR #315

divergence:
local branch 0 ahead / 6 behind origin/main
```

`origin/main`에서 local HEAD 이후 들어온 커밋:

```text
f3eb4530 전제 자동 감시 보강 — 출처 날짜 정직성, 폭발 반경 격리, 동의 스위치, 프롬프트 울타리 (#315)
87771448 Merge pull request #308 from commet/fix/return-loop-integrity-and-bridge-provenance
4affcdce merge main again — #313 landed, so both sides of two files had moved
35924468 merge main: the tally this PR balanced was removed, so its test moves with it
ac39c8ec merge main — the outcome tally this PR wanted to balance was removed instead
fdbf3a60 fix: repair the return loop and carry provenance across the bridge
```

확인된 PR 상태:

- PR #308: merged
- PR #313: merged, CI 성공
- PR #314: merged, CI 성공
- PR #315: merged
- `v2.0.4` 태그 및 npm `argus-decision-mcp@2.0.4` 존재
- publish workflow `30372428477` 성공

따라서 “Claude가 한 것이 반영되었나?”에 대한 답은 **예**다. 다만 이 Codex WIP는 아직 아니다.

## 2. 다른 기기에서 시작하는 정확한 순서

이 브랜치가 remote에 push되어 있다는 전제로:

```powershell
git fetch origin --prune
git switch codex/fix-mcp-verification-and-codex-host
git status --short
git log --oneline --decorate -12
git diff origin/main...HEAD --stat
```

그 다음 아래 원칙으로 `origin/main`의 6개 신규 커밋을 통합한다.

1. 먼저 PR #308과 #315가 건드린 파일을 읽는다.
2. 특히 `premises`, provenance, 자동 감시, prompt fence 변경과 이 WIP가 충돌하거나 의미를 무효화하는지 확인한다.
3. WIP가 빨간 상태라는 사실을 보존한다. 충돌 해결과 기능 수정을 한 번에 섞지 않는다.
4. 통합 후 아래 3개의 실패 게이트를 그대로 재현한다.
5. 설계 수정 후 개별 게이트를 통과시키고, 마지막에만 `npm run verify`를 실행한다.

브랜치가 remote에 없다면 이전 기기에서 push가 누락된 것이다. 임의로 같은 변경을 재작성하지 말고 이 문서 작성 세션에 branch push를 요청한다.

## 3. 안전장치와 로컬 백업

이전 기기에는 다음 stash가 남아 있다.

```text
stash@{0}: On codex/fix-mcp-verification-and-codex-host: codex sharp mcp verification wip
```

이는 fast-forward 및 충돌 해결 전 WIP 백업이다.

- WIP가 remote branch에 안전하게 올라가고 검증될 때까지 삭제하지 말 것.
- `stash@{1}` 이하의 오래된 stash는 사용자 소유일 수 있으므로 건드리지 말 것.
- `git reset --hard`, 광범위한 `git clean`, 오래된 stash 삭제를 하지 말 것.

이전 기기의 전체 검증 로그:

```text
C:\Users\SAMSUNG\AppData\Local\Temp\argus-codex-final-verify.log
```

이 경로는 다른 기기에서 보이지 않을 수 있으므로, 아래 재현 명령과 이 문서의 정확한 실패 내역을 기준으로 삼는다.

## 4. 현재 WIP 파일 목록

작성 직전 로컬 변경:

```text
M  .github/workflows/ci.yml
M  .github/workflows/publish-mcp.yml
M  argus-mcp/CHANGELOG.md
M  argus-mcp/evals/INDEPENDENT-VERIFICATION.md
M  argus-mcp/evals/answer-time.mjs
M  argus-mcp/evals/host-matrix.mjs
M  argus-mcp/evals/slow-human.mjs
M  argus-mcp/evals/verify-all.mjs
M  argus-mcp/src/lib/elicit.ts
M  argus-mcp/src/server.ts
M  argus-mcp/src/test-helpers.ts
M  argus-mcp/src/test-setup.ts
M  argus-plugin-v2/commands/doctor.md
M  argus-plugin-v2/scripts/install-smoke.mjs
?? argus-mcp/evals/codex-app-server.mjs
?? argus-mcp/src/lib/__tests__/elicit-host-policy.test.ts
```

문서 추가 후 이 파일도 포함된다.

```text
docs/HANDOFF-2026-07-29-CODEX-MCP-PLUGIN-VERIFICATION.md
```

## 5. 최신 빨간 게이트의 정확한 재현

먼저 build가 현재 소스와 일치하는지 확인한다.

```powershell
cd argus-mcp
npm run build
```

### 5.1 E2E picker

```powershell
node evals/e2e-picker.mjs node dist/index.js
```

관측된 결과:

```text
E2E: 9 passed, 4 failed

FAIL 날짜 조정 → 문장 유지 + 확인일 이동
FAIL 정산 픽커 실발사 — count=0
FAIL 정산 픽커 한 왕복으로 완료 — OUTCOME_REQUIRED
FAIL 정산 결과가 사용자 말 그대로 기록 — OUTCOME_REQUIRED
```

앞선 `skip`/Decline이 500ms 안에 돌아오면서 세션을 `_provenUnavailable`로 만들고, 이후 날짜 조정 및 settle picker가 호출되지 않는 것이 유력한 직접 원인이다.

### 5.2 Content battery

```powershell
$env:BATTERY_SKIP_BUILD='1'
node evals/battery.mjs
```

관측된 결과:

```text
92 calls · 1 RED · 0 yellow

S36 defer 픽커 — Decline하면 정직한 되물음
expected DEFER_DATE_REQUIRED, call succeeded
```

현재 구현은 빠른 Decline을 `no_answer/failed`로 재분류한다. 따라서 S36이 기대하던 명시적 사용자 Decline 경로와 다른 성공 응답을 낸다.

### 5.3 Picker surfaces

```powershell
$env:PICKER_SURFACES_SKIP_BUILD='1'
node evals/picker-surfaces.mjs
```

관측된 결과:

```text
290 checks · 32 violations
```

16개 locale/input 조합 각각에서:

```text
다섯 픽커가 전부 떴다:
안 뜬 것 premise,settle,defer,ambient
받은 것 1개: seal

접기 선택지가 되돌릴 수 없다고 말한다:
확인할 UI 자체가 오지 않아 빈 문자열
```

첫 seal picker의 즉시 Decline이 세션 전체 회로를 끄므로 이후 4개 surface가 사라진다.

### 5.4 전체 검증

개별 빨간 게이트를 해결하기 전에는 긴 전체 검증을 반복해서 돌리지 말 것. 해결 후:

```powershell
cd argus-mcp
npm run verify
```

최신 전체 실행에서 통과한 주요 baseline:

```text
build                         PASS
typecheck                     PASS
unit/protocol                 1111 passed
fuzz                          PASS
unreadable ledger             PASS
npm pack                      PASS
host matrix                   392 checks / 0 violations
ambient                       21 checks / 0
widget                        36 gestures
surface hazards               1222 / 0
keepsake                      254 / 0
version lockstep              9 / 0
claude-code-form              20 / 0
real Codex app-server         10 / 0
answer-time                   10 / 0
slow human                    95 seconds / 3 / 0
plugin validate               PASS
plugin install smoke          PASS
plugin simulation             PASS
copy parity                   PASS
```

실패한 baseline:

```text
E2E picker                    FAIL
battery                       FAIL
picker-surfaces               FAIL
```

baseline이 빨간 상태라 verifier self-test는 실행되지 않았다. 이것은 fail-fast 설계대로다.

## 6. 핵심 설계 결함: 시간 기반 판별의 모호성

현재 `argus-mcp/src/lib/elicit.ts`의 중요한 WIP 동작:

```text
INVISIBLE_DECLINE_MAX_MS = 500

elicitation 응답이 decline이고 elapsed <= 500ms:
  current result를 no_answer/failed로 바꿈
  session._provenUnavailable = true

이후 canElicit:
  false
```

의도:

- Codex 같은 호스트에서 MCP elicitation capability는 광고하지만, 사용자 정책 설정 때문에 UI를 띄우지 않고 즉시 decline하는 경우가 있다.
- 그런 호스트에서 매번 보이지 않는 picker를 호출하지 않고 text fallback으로 내려가야 한다.

문제:

- 빠른 정상 사용자 Decline과 정책 자동 decline은 protocol의 `action: "decline"`만 보면 동일하다.
- 테스트 harness는 사용자 선택을 즉시 반환하므로 모두 정책 차단으로 오인된다.
- 실제 사용자도 500ms 안에 버튼을 누를 수 있다.
- 한 번의 오판이 세션의 모든 후속 picker를 제거하므로 피해 반경이 지나치게 크다.

### 먼저 조사할 것

추측으로 임계값을 바꾸기 전에 실제 Codex app-server wire를 조사한다.

1. `mcpServer/elicitation/request` 응답에서 `_meta`가 정책 거절과 사용자 거절을 구분하는가?
2. outer app-server notification 또는 request lifecycle에 UI 표시 여부가 나타나는가?
3. Codex `approval_policy.granular.mcp_elicitations`가 꺼졌을 때와 사용자가 실제 Decline했을 때 응답 구조·지연·오류 코드가 다른가?
4. MCP SDK가 버리는 필드가 있는가? raw JSON-RPC를 함께 캡처할 것.
5. Claude Code/Desktop에서도 같은 구분 신호가 있는가?

관련 공식 Codex 사실:

- Codex app-server는 `mcpServer/elicitation/request`의 form/url elicitation을 지원한다.
- extended form은 initialization capability `mcpServerOpenaiFormElicitation`과 연결된다.
- `approval_policy.granular.mcp_elicitations=true`로 MCP elicitation prompt 표출을 허용할 수 있다.
- UI 지원 여부를 product name으로 분기하지 말고 capability로 판단하라는 방향이 맞다.

이 WIP의 real app-server gate는 “Codex라는 제품 이름 자체를 blacklist하면 틀린다”는 것을 이미 입증했다. 실제 `codex app-server`에서 form을 Accept하고 user-owned seal까지 성공했다.

### 검토할 설계 후보

아래는 답이 아니라 검증할 가설이다.

#### 후보 A: 명시적 metadata 사용

정책 거절과 사용자 거절을 구분하는 `_meta` 또는 오류 코드가 실제 host wire에 있으면 그것만 사용한다. 가장 좋은 경로다. 반드시 real host fixture로 증명한다.

#### 후보 B: 한 번의 fast decline으로 세션 전체를 끄지 않음

첫 fast decline은 현재 호출만 `no_answer`로 처리하고, 연속 2회 이상 동일한 즉시 거절일 때만 회로를 연다.

장점:

- 한 번의 정상 Decline으로 이후 모든 picker가 사라지는 문제를 줄인다.

단점:

- 정책 차단 host에서 보이지 않는 form을 최소 2번 시도한다.
- 실제 사용자의 두 번 빠른 Decline도 여전히 오판할 수 있다.

반드시 “정책 차단 시 반복 괴롭힘”과 “정상 Decline 후 다음 picker 유지”를 둘 다 게이트로 만든다.

#### 후보 C: 세션 전체가 아닌 surface별 또는 단기 회로

seal의 빠른 Decline이 premise/settle/defer/ambient를 없애지 않도록 회로 범위를 줄인다.

단점:

- 정책 차단 host에서 surface마다 한 번씩 보이지 않는 요청이 갈 수 있다.

#### 후보 D: 서버 설정으로 명시

host 또는 사용자가 policy-blocked 상태를 명시할 수 있는 설정을 둔다.

단점:

- 자동 탐지 실패를 사용자 설정 부담으로 넘긴다.
- host 이름 coupling을 다시 만들 수 있다.

#### 금지에 가까운 임시방편

- 테스트의 모든 Decline 앞에 501ms sleep을 넣어 초록으로 만들기
- Codex product name을 다시 blacklist하기
- 임계값을 50ms, 100ms처럼 바꾸고 충분하다고 주장하기
- 실패한 surface count를 기대값에서 삭제하기
- policy-blocked real-host 증거 없이 mock만 추가하기

## 7. 이미 구현했고 보존할 가치가 있는 것

### 7.1 Codex capability와 real app-server 검증

변경:

- `server.ts`에서 product-name 기반 `getClientVersion` 분기 제거
- `supportsReliableElicitation`은 protocol capability를 기준으로 판단
- `evals/codex-app-server.mjs` 추가
- CI에서 `@openai/codex@0.130.0-alpha.5`를 고정 설치

real app-server gate의 10개 확인:

```text
1. allowed standard form이 실제로 표출/왕복
2. Accept로 seal 성공
3. owner=user
4. immediate decline을 안전하게 no_answer 처리
5. check_in이 text_fallback 보고
6. 이후 picker 반복 없음
7. fallback premise provenance=ai_surfaced
...총 10개 / 0 위반
```

주의: 이 gate가 현재 flawed circuit을 요구하고 있으므로, 회로 설계를 바꿀 때 gate도 “원래 결함을 다시 심었을 때만 빨개지는가?”를 기준으로 함께 재설계해야 한다.

수동 mutation 확인 이력:

- mutation #23: capability function을 false로 만들면 real Codex form C1이 실패
- mutation #24: circuit assignment를 제거하면 auto-reject/no-repeat C2가 실패

새 설계 후 mutation #24는 그대로 유지할 이유가 없을 수 있다. 새 불변식에 맞게 바꾼다.

### 7.2 응답 시각(answer-time)

Claude/main이 picker 응답 뒤에 `answeredAt`을 찍도록 `premises.ts`, `seal.ts`를 수정했다.

Codex WIP는 `answer-time.mjs`를 보강했다.

- `ARGUS_TZ=UTC` 고정
- A3에서 exact UTC date 비교
- KST 자정에서 이전 구현의 부호가 반대로 허용되던 false-pass 제거
- mutation #21 premises 및 #22 seal 추가

이 변경은 현재의 picker circuit 실패와 별개이며 보존 후보지만, PR #315 통합 후 다시 실행해야 한다.

### 7.3 verifier self-test 강화

`evals/verify-all.mjs` 변경:

- baseline이 전부 통과한 뒤에만 self-test 실행
- self-test를 임시 복사본에서 수행
- `node_modules`와 `dist` 복사 제외, `node_modules` junction 사용
- 원본 source byte-identical 확인
- 각 mutation은 nonzero exit뿐 아니라 해당 gate가 소유한 positive failure signature를 요구
- `0 violations`를 실패로 오인하던 regex 제거
- 모든 self-test 뒤 원본 byte 재확인
- self-test #21~#24 추가
- real Codex app-server baseline 추가
- slow-human baseline 95초, self-test 61.5초

이전 full run에서 21개 self-test가 통과한 적은 있으나, 최신 baseline이 빨간 뒤에는 실행되지 않았다. “예전에 통과”를 최종 증거로 쓰지 말 것.

### 7.4 테스트 임시 디렉터리 정리

문제:

- 전체 unit 후 `argus-test-*` 임시 디렉터리가 147개 남아 디스크를 고갈시켰다.

변경:

- `test-helpers.ts`, `test-setup.ts`에 `afterAll` 및 process-exit cleanup 등록

확인 이력:

- unit 1111개 통과
- 종료 뒤 작업이 만든 `argus-test-*` count 0

광범위한 Temp 삭제를 하지 말고, 다시 확인할 때도 정확한 prefix와 ownership을 확인한다.

### 7.5 실제 Claude plugin lifecycle

`argus-plugin-v2/scripts/install-smoke.mjs`를 mock 수준에서 실제 lifecycle로 올렸다.

격리된 Claude config에서:

```text
marketplace add
plugin install
plugin list/details
mcp list connected
disable
enable
update
uninstall
```

추가로 설치 inventory의 정확한 `mcpServers.argus-decision` command/args를 읽고, 그 명령으로 MCP를 직접 실행해:

- public tool 6개 노출
- `argus_check_in.data.server_version === pinnedVersion`

을 확인한다.

통과 이력:

- local pre-publish plugin v3.0.4 + local MCP build: PASS
- published plugin v3.0.4 + npm MCP 2.0.4: PASS

publish workflow도 registry publish 전 실제 plugin install/MCP connection을 확인하도록 보강했다.

### 7.6 host matrix

현재 12개 profile, 392 checks / 0 violations 이력:

```text
Claude Code
Claude Desktop
Codex interactive (동일 identity, 실제 Accept)
Codex auto-reject (동일 identity, 즉시 decline)
legacy
cancel
empty
long typer
garbage
extra
hostile error
text-only
```

중요: host matrix가 초록인데 picker-surfaces가 빨간 것은 matrix가 충분하다는 뜻이 아니다. matrix의 auto-reject profile이 현재 flawed circuit을 정답으로 고정했을 가능성을 검토한다.

## 8. 사용자 기본 설치 상태와 격리 검증을 혼동하지 말 것

격리 install smoke는 최신 버전으로 통과했지만, 이전 기기의 사용자 기본 Claude profile은 오래된 상태였다.

```text
plugin inventory:
argus@argus 3.0.2

install path:
C:\Users\SAMSUNG\.claude\plugins\cache\argus\argus\3.0.2

MCP command:
npx -y argus-decision-mcp@2.0.2
```

이는 격리 검증의 plugin v3.0.4 / MCP 2.0.4와 다르다.

- 사용자의 기본 profile을 검증 없이 최신이라고 보고하지 말 것.
- 사용자 허락 없이 기본 profile을 업데이트하거나 제거하지 말 것.
- 다른 기기의 상태는 별도로 `claude plugin list`, details, `claude mcp list`와 실제 MCP tool call로 확인할 것.

이전 기기의 Codex config는:

```text
argus-decision -> npx -y argus-decision-mcp@latest
```

였고 npm latest는 당시 2.0.4였다. 다른 기기에서는 다시 확인한다.

## 9. 다음 세션의 우선순위

### P0 — red baseline을 설계 수준에서 해결

1. `origin/main`의 PR #308/#315를 읽고 WIP와 통합
2. E2E, battery S36, picker-surfaces 32건 재현
3. 실제 Codex app-server에서 policy decline과 human decline raw wire 캡처
4. 구분 가능한 metadata가 있는지 확인
5. 없다면 single-fast-decline session-wide circuit을 폐기하거나 피해 반경을 축소
6. 세 종류의 게이트 모두를 통과
7. 정확한 defect replant mutation으로 게이트 민감도 증명

완료 조건:

```text
정상 빠른 Decline 뒤에도 다음 picker가 뜬다.
정책 자동 거절 host에서는 보이지 않는 picker가 무한 반복되지 않는다.
현재 호출에서 user choice/provenance를 거짓으로 만들지 않는다.
product name blacklist가 없다.
mock뿐 아니라 real Codex app-server evidence가 있다.
```

### P1 — main 통합 회귀

- PR #308 return loop/provenance
- PR #315 premise auto-watch/source date/consent/prompt fence
- answer-time exact timestamp
- temp cleanup
- plugin installed-command tool call

을 대상으로 관련 개별 게이트를 다시 실행한다.

### P2 — 전체 검증과 mutation

baseline이 모두 초록일 때만:

```powershell
npm run verify
```

그 뒤 self-test 결과에서 각 mutation이:

- nonzero
- 해당 gate 고유의 positive failure
- 원본 byte 유지
- temp 정리

를 만족하는지 확인한다.

### P3 — 실제 사용자 여정

격리 CLI smoke만으로 끝내지 않는다.

- Claude Code 실제 설치 → picker 표시 → Accept/Decline/Cancel → 재시작 → update/uninstall
- Codex app/CLI 실제 MCP 연결 → picker 표시 허용 설정 ON/OFF → Accept/Decline
- fresh machine 또는 clean profile
- 이미 설치된 오래된 profile에서 upgrade
- npm tarball의 실제 command/args와 server version

각 여정에서 “화면에 무엇이 보였는지”, “wire에서 무엇이 왔는지”, “원장에 무엇이 기록됐는지”를 함께 남긴다.

## 10. 검증 철학 — 숫자로 밀어붙이지 말 것

사용자의 명시적 요구:

> 22번 정도는 새발의 피다. 양으로 밀어붙인다고 되는 것이 아니라, 한 번 한 번의 루프와 테스트가 날카롭고 유의미해야 한다.

따라서 새 테스트마다 아래 다섯 문장을 먼저 쓴다.

1. 어떤 실제 사용자 손상이 발생하는가?
2. 어떤 구체적 결함이 그 손상을 만든다는 가설인가?
3. 어떤 real artifact/host/wire/state로 재현하는가?
4. 결함을 정확히 다시 심으면 어느 assertion이 왜 빨개져야 하는가?
5. 인접한 정상 행동을 과잉 차단하지 않았다는 증거는 무엇인가?

테스트 수 증가 자체를 진척으로 보고하지 않는다. 같은 mock을 100개 늘리는 것보다 실제 설치 command 한 번, 실제 app-server 왕복 한 번, 정확한 mutation 한 번이 더 강한 증거일 수 있다.

## 11. 관련 파일 지도

핵심 설계:

- `argus-mcp/src/lib/elicit.ts`
- `argus-mcp/src/server.ts`
- `argus-mcp/src/lib/__tests__/elicit-host-policy.test.ts`

실제 host 및 surface:

- `argus-mcp/evals/codex-app-server.mjs`
- `argus-mcp/evals/host-matrix.mjs`
- `argus-mcp/evals/e2e-picker.mjs`
- `argus-mcp/evals/picker-surfaces.mjs`
- `argus-mcp/evals/battery.mjs`

검증 오케스트레이션:

- `argus-mcp/evals/verify-all.mjs`
- `argus-mcp/evals/INDEPENDENT-VERIFICATION.md`

응답 시각:

- `argus-mcp/evals/answer-time.mjs`
- main의 premise/seal handlers

plugin lifecycle:

- `argus-plugin-v2/scripts/install-smoke.mjs`
- `.github/workflows/publish-mcp.yml`
- `.github/workflows/ci.yml`
- `argus-plugin-v2/commands/doctor.md`

임시 파일 정리:

- `argus-mcp/src/test-helpers.ts`
- `argus-mcp/src/test-setup.ts`

## 12. 최종 완료의 엄격한 정의

다음이 모두 충족되기 전에는 완료라고 말하지 않는다.

- 최신 `origin/main` 위에서 작업
- working tree의 의도하지 않은 변경 없음
- build/typecheck/unit 통과
- E2E picker 통과
- battery 0 RED
- picker-surfaces 0 violations
- real Codex app-server 통과
- Claude plugin real lifecycle local/published 통과
- host matrix 및 ambient/surface/keepsake 통과
- answer-time exact response timestamp 통과
- slow-human 통과
- full `verify` baseline 통과
- 모든 mutation self-test가 정확한 이유로 red
- test가 원본을 오염시키지 않음
- fresh install 및 upgrade 사용자 여정 증거
- branch PR의 CI 통과
- 병합 후 `main`에서 다시 검증
- 배포했다면 npm 및 실제 설치 버전 확인
- 기본 사용자 profile 상태를 격리 profile 결과와 구분해 보고

현재 상태는 이 정의상 **미완료**다.
