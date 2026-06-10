# argus-watch

> 결정을 입력받는 앱이 아니라, **이미 일어난 대화에서 결정을 알아보는 눈.**
>
> 배경: `docs/PIVOT-presence-not-place.md` · 검증: `scripts/decision-watch-eval/`

당신은 아무것도 쓰지 않습니다. argus-watch가 당신의 Claude Code 대화 기록을 읽고,
결정의 순간을 알아보고("~하기로 했다", 옵션 선택, 방향 전환), 반증 가능한 내기로
봉인하자고 제안하고, check_by 날짜에 먼저 돌아와 묻습니다 — **"그래서, 어떻게 됐어요?"**

판정하지 않습니다. 점수도 조언도 없습니다. 알아보고, 봉인하고, 돌아올 뿐입니다.

## 사용

```bash
node tools/argus-watch/cli.mjs scan              # 이 프로젝트의 대화에서 결정 수확
node tools/argus-watch/cli.mjs scan --all-projects --concurrency 4
node tools/argus-watch/cli.mjs list              # 수확된 결정 후보
node tools/argus-watch/cli.mjs seal a1b2c3d4     # 내기로 봉인 (LLM이 초안, 당신이 확정)
node tools/argus-watch/cli.mjs dismiss a1b2c3d4 --reason "사소함"
node tools/argus-watch/cli.mjs due               # "그래서, 어떻게 됐어요?"
node tools/argus-watch/cli.mjs settle a1b2c3d4 happened --note "예측대로"
node tools/argus-watch/cli.mjs amend a1b2c3d4 --check-by 2026-07-01   # 변침 — 이력 보존
node tools/argus-watch/cli.mjs ledger            # 원장 + 자차표 (정산 5건부터)
```

- 의존성 0 (Node 내장만). LLM 호출은 headless `claude -p` — **API 키 불요**, 기존 Claude Code 인증 사용.
- `--model sonnet`(기본)·`haiku`·`opus` 선택 가능.

## 매일의 루프 (제안)

1. 하루 끝 또는 세션 끝에 `scan` — "오늘 결정 N개 했더라."
2. 무게 있는 것만 `seal` — 내기와 check_by는 초안돼 나오고, 당신은 고치기만.
3. 세션 시작 시 `due`가 인사 — 아래 훅을 걸면 자동:

```jsonc
// .claude/settings.json → hooks에 추가 (opt-in)
{
  "hooks": {
    "SessionStart": [{
      "hooks": [{ "type": "command", "command": "node tools/argus-watch/cli.mjs due" }]
    }]
  }
}
```

이게 Return의 순간입니다 — 사용자가 돌아오는 게 아니라 제품이 돌아옵니다.

## 프라이버시 (중요)

- 원장(`.argus/ledger/`)과 모든 산출물은 **로컬 전용**이며 `.gitignore`에 등록돼 있습니다.
  이 레포는 public입니다 — 원장을 절대 커밋하지 마세요.
- 대화 원문은 저장하지 않습니다. 저장되는 건 결정 한 줄 + 인용 한 구절 + 내기뿐.
- 원장은 append-only입니다. 수정(amend)도 이력으로 남습니다 — 조용한 덮어쓰기는 없습니다.

## 구조

```
cli.mjs               명령 라우팅 + 렌더
lib/transcript.mjs    Claude Code JSONL → 대화 다이제스트 세그먼트
lib/detect.mjs        결정 감지 + 봉인 초안 (prompts/detector.md가 정의의 단일 원천)
lib/llm.mjs           claude -p 래퍼 (도구 차단, JSON 추출, 동시성 풀)
lib/ledger.mjs        append-only 이벤트 원장 (harvest/seal/amend/dismiss/settle)
prompts/detector.md   결정-순간 정의 — 백테스트와 공유
```

## 알려진 한계 (정직 조항)

- 감지기는 백테스트로 검증되지만(`scripts/decision-watch-eval/`), 정밀도 100%가 아닙니다.
  "이건 내 결정이 아닌데" 싶으면 `dismiss` — 기각도 기록되어 보정 자료가 됩니다.
- 세그먼트당 수십 초 (claude -p 왕복). `--concurrency`로 완화.
- 지금은 Claude Code 트랜스크립트만 읽습니다. ChatGPT 내보내기 등 횡단은 다음 단계.
- 자차표(편차 패턴)는 정산 5건부터 — 데이터 없는 자차표는 빈 거울이라 만들지 않습니다.
