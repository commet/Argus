# MCP-NOTES — v2 구조를 사람이 빨리 이해하기 위한 지도

> 정본은 `docs/ARGUS-MCP-V2-SPEC.md`(규칙·계약)다. 이 문서는 그 스펙이
> 코드 어디에 어떻게 구현돼 있는지를 잇는 **부속 지도**다 — 여기와 스펙이
> 충돌하면 스펙이 이긴다. (마지막 대조: 2026-07-12)

## 1. 한 문단 요약

Argus MCP는 "결정을 봉인(seal)하고, 확인일에 현실과 대조해 정산(settle)한다"를
제공하는 로컬 stdio 서버다. v1은 기록을 프로젝트 폴더 안(`.argus/ledger/`)에
두어 폴더 삭제 시 기록이 사라질 수 있었다. v2는 기록을 사용자 홈
(`~/.argus/projects/{repository_id}/ledger.jsonl`)으로 옮긴다. 지금은 **이행기**:
v1이 여전히 정본이고, 모든 쓰기가 v2에 자동 복제되며(dual-write), 두 쪽의
답이 갈리는지 매 check_in마다 기계로 대조 중이다(발산 감지). 발산 0이
충분히 쌓이면 읽기를 v2로 전환한다.

## 2. 4층 구조와 실제 파일

| 층 | 역할 | 실제 파일 (src/) |
|---|---|---|
| CORE | 기록→상태→봉인→브리프→정산 | `v2/ledger.ts`(파일·락·registry) · `v2/events.ts`(이벤트 23종 스키마) · `v2/reducer.ts`(상태 접기+전이 가드) · `v2/brief.ts`(due·그물 파생) |
| COMPANION | 후보·정리 | `v2/harvest.ts`(수확 처리) · `v2/queue.ts`(수확 큐) · `v2/gate.ts`(결정 발화 검출) · `tools/candidates.ts`(argus_candidates) |
| DRIVER | Claude Code 접점 | `../argus-driver/`(플러그인: 훅·커맨드·statusline·doctor) |
| PROJECTION | 파생 화면 | `v2/logbook.ts`(LOGBOOK.md) · `v2/mirror.ts`의 `readV2Brief`(check_in 병기) · statusline |

층 격리: COMPANION·PROJECTION의 어떤 실패도 CORE 쓰기를 막지 않는다
(미러·LOGBOOK 갱신은 전부 non-throwing).

## 3. 기록이 사는 곳 (그리고 왜)

- **`~/.argus/projects/{repository_id}/ledger.jsonl`** — v2 정본이 될 기록.
  repository_id는 git 저장소(`git_common_dir` 실경로)당 UUID 하나로,
  `~/.argus/registry.json`에 등록된다. 같은 저장소면 어느 작업 폴더
  (worktree)에서 열어도 같은 기록이 보인다.
- **프로젝트 `.argus/`** — 파생물만 산다: `project.json`(바인딩),
  `LOGBOOK.md`(요약 화면). 지워져도 다음 갱신에서 다시 만들어진다.
- **`${CLAUDE_PLUGIN_DATA}`** — 임시 상태만: 수확 큐, 1일-1회 marker.
  플러그인을 지우면 같이 사라져도 되는 것들.
- **v1 `.argus/ledger/`** — 기존 기록. v2 바인딩 시 1회 복사되고
  (`ledger.v1.jsonl` + `v1-migration.json` marker), 원본은 절대 건드리지
  않는다.

## 4. 이행 경로와 현재 위치

```
[완료] dual-write     — v1 쓰기 성공 시 v2에 자동 복제 (lib/ledger-append.ts → v2/mirror.ts)
[완료] 관찰 채널      — check_in이 data.v2_brief(읽기)와 data.v2_divergence(대조)를 병기
[지금] 발산 관찰      — 실사용에서 v2_divergence.diverged=false가 이어지는지 본다
[다음] 읽기 전환      — 발산 0 확인 후 surface가 v2를 읽게 전환
[끝]   v1 은퇴        — v1 원장은 읽기 전용 스냅샷으로만 남는다
```

## 5. 수확(자동 캡처) 파이프라인

전부 opt-in(`~/.argus/config.json`의 `harvest.opt_in: true`)이고, 켜기 전에는
파일 하나 만들지 않는다.

```
SessionStart 훅         transcript 경로를 큐에 넣기만 (추출 안 함)
  → queue.ts            lease+재시도, 실패해도 항목 보존
  → harvest.ts          하루 1회 · 주 2건 캡. 결정 발화 검출(gate.ts) 후
                        대화 원문에서 byte 단위로 검증된 인용만 후보로 기록
  → argus_candidates    사용자가 목록을 보고 봉인/연결/정리/방치 선택
```

지금 검출기는 키워드 기반 결정론 판(과발화 0을 CI가 강제)이고, haiku 모델
추출은 `harvest.ts`의 검출부만 갈아끼우는 업그레이드 자리다.

## 6. 새 세션이 지켜야 할 불변식 5개

1. **v1 쓰기는 반드시 `appendLedger` 하나로** — 이 관문이 v2 복제를 자동
   호출한다. 다른 경로로 v1에 쓰면 두 기록이 갈라진다.
2. **v1→v2 복사는 marker가 경계** — `v1-migration.json`이 있으면 재복사는
   영원히 no-op. marker를 지우거나 우회하면 기록이 이중으로 접힌다.
3. **측정본 = 배송본** — 게이트 eval 하네스는 배송되는 `v2/gate.ts` 함수
   자체를 잰다(스파이크는 재수출 껍데기). 검출기를 복제해 만들지 말 것.
   statusline도 같다: 정본은 `argus-plugin-v2/statusline/index.js`,
   `argus-driver`의 사본은 byte 동일(테스트가 대조).
4. **opt-in 전 흔적 0** — 수확 관련 파일은 opt-in 전에 절대 생기지 않는다.
5. **원장이 정본, 화면은 파생** — LOGBOOK·statusline·brief는 언제 지워도
   원장에서 다시 만들어진다. 화면에만 쓰고 원장에 안 남는 데이터를 만들지
   말 것. 반대로, 원장에 쓰이는 사용자 인용문은 untrusted다 — 화면에 낼 때
   반드시 `v2/sanitize.ts`를 거친다.

## 7. 자주 쓰는 확인 명령

```bash
cd argus-mcp && npx vitest run          # 전체 테스트 (v2 포함)
npx vitest run src/v2                    # v2만
npm run copy                             # 사용자 문구 하우스 스타일 감사
ARGUS_PERF_EVENTS=100000 npx vitest run src/v2/perf.test.ts   # 대용량 벤치
```

문제가 있으면 사용자에게는 `/argus-driver:doctor`(읽기 전용 자가진단)가
같은 지도를 훑어준다.
