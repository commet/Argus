# antefact/ — 판단 기록 표준 (Antefact) 격리 존

**Antefact** = a record before the fact (OED 1623, *postfact*의 반대). 판단 기록이란
"미래에 대한 주장이, 결과 이전에 봉인되고, 이름 붙은 저자들에게 소유되며, 이름
붙은 현실에 정산되는 것"이다. 이 존은 그 표준의 정본과 참조 구현을 담는다.

## 무엇이 들어 있나

| 경로 | 내용 |
|---|---|
| `SPEC.md` | 포맷 규범 (영어 정본, v0.1.5-draft) |
| `MINIMUM-ELEMENTS.md` | "판단 기록의 최소 요소" — 포맷 중립 바닥 문서 (규제 인용용, v0.2) |
| `schema/antefact.schema.json` | 파싱된 레코드의 JSON Schema (draft 2020-12) |
| `cli/antefact.mjs` | 참조 CLI(허브) — `parse` · `lint` · `seal` · `verify` · `settle` · `projection` (무의존성) |
| `cli/spokes.mjs` | 스포크 — `embed`(Annex H 한 줄) · `render`(사람용 리시트) · `prov`(PROV-O JSON-LD) · `report`(분모 줄 + 캘리브레이션 곡선) |
| `vectors/` | 골든 테스트 벡터 — valid는 깨끗이 파싱되어야 하고, invalid는 정확히 그 코드로 실패해야 한다 |
| `test/cli.test.mjs` · `test/spokes.test.mjs` | 적합성 테스트 (node:test) |

## 실행

```bash
node --test antefact/test/cli.test.mjs antefact/test/spokes.test.mjs   # 적합성 스위트
node antefact/cli/antefact.mjs lint antefact/vectors/valid
node antefact/cli/antefact.mjs seal my.antefact.md --level L1 --ref git:abc123
node antefact/cli/antefact.mjs verify my.antefact.md
node antefact/cli/antefact.mjs settle my.antefact.md --outcome yes --by "h:김서진" --observed "9.4%" --source dash-w45
# 스포크 — 원본 하나에서 기계 생성되는 투영들 (손으로 쓰면 드리프트한다)
node antefact/cli/antefact.mjs embed my.antefact.md    # Antefact: <id> sealed <date> sha256:<8>
node antefact/cli/antefact.mjs render my.antefact.md   # 사람용 마크다운 리시트
node antefact/cli/antefact.mjs prov my.antefact.md     # PROV-O JSON-LD (Annex E)
node antefact/cli/antefact.mjs report my-records/      # 분모 줄(MUST) + 구간 캘리브레이션
```

봉인 시각(`seal.ts`, proj v2, r6): 봉인 시각은 해시되는 투영 **안에** 있다 —
소급 날조자가 정확히 고칠 그 필드이기 때문이다. v1 봉인 레코드는 계속 검증되나
시각이 없으므로 `embed`가 정직하게 거부한다 (mtime으로 채우는 것은 조작).

주의: `node --test antefact/test/` (디렉토리 인자)는 Node 22에서 로더 문제로
실패한다 — 파일 경로나 글롭을 쓴다.

## 존 규칙 (경계)

1. **양방향 import 금지.** 이 존은 `src/`·`method-harness/`를 import하지 않고,
   그들도 이 존을 import하지 않는다. 공개 시 이 디렉토리는 그대로 별도
   리포지토리로 추출된다 — 그래서 의존성이 0개다.
2. **루트 vitest에서 제외.** 이 존은 자체 node:test 하네스를 쓴다
   (argus-plugin-v2 선례와 동일). `vitest.config.ts`의 exclude에 등재되어 있다.
3. **method-harness와의 관계**: 이벤트 소싱 + 결정론 검증이라는 구조 원리는
   같은 혈통이지만(둘 다 "그럴듯함이 맞음으로 위장하지 못하게"), 데이터 모델이
   다르고(세션 이벤트 vs 레코드 파일) 이 존은 추출 가능해야 하므로 **코드는
   공유하지 않는다** — 의도된 비공유.
4. Argus 제품과의 접점(내보내기·MCP 리소스·정산 UI 등)은 전부 BLUEPRINT §8
   대기 목록을 거쳐 공정표 순서로만 진입한다.

## 설계 핵심 (스펙의 요약이 아니라 안내)

- **품질을 판정하지 않는다.** 보존하는 것은 서열(무엇이 먼저 있었나)과
  저자성(누가 무엇을 소유하나)뿐 — 그것만으로 부정직이 구조적으로 비싸진다.
- **봉인은 자물쇠가 아니라 증거다.** `seal.proj`가 정규 투영 레시피 버전을
  기록한다 — 레시피를 모르는 해시는 아무것도 증명하지 않으므로, 버전 없는
  봉인은 `verify`가 정직하게 거부한다.
- **정산은 append-only.** 정정은 수정이 아니라 사유 딸린 역분개 항목이고,
  정산은 봉인 투영 밖에 살므로 정산을 추가해도 봉인은 깨지지 않는다.
- **자기정산은 금지가 아니라 가시화.** 정산자가 저자와 겹치면 린트가
  `W_SELF_SETTLED`로 표시한다 — 1인 사용자는 자기정산할 수밖에 없고, 그 사실이
  보이는 것이 정직함이다 (2026-08-10 적대 리뷰 반영).

## 정직한 공백 (아직 안 된 것)

- 파서는 스펙이 키별로 고정한 제약 YAML 부분집합만 읽는다(일반 YAML 아님) —
  낯선 모양은 추측하지 않고 크게 실패한다. 의도된 제약이다.
- `settle`은 Settlement 절이 파일 끝에 있다고 가정한다 (v0 단순화). `seal`은
  그 절이 없어도 Stake 뒤에 봉인을 기록한다.
- **append-only 리비전 레코드가 미구현이다.** 스펙 §3.1은 Statement 수정을
  저자성이 붙은 append-only 리비전으로 요구하지만, CLI는 그 형식을 아직
  파싱하지 못한다. 그래서 봉인 후 Statement를 직접 고치면 `verify`는 이를
  **막지 않고 `statementAmended: true`로 드러낸다** — 봉인 해시는 봉인 시점
  리비전에 걸려 있어 깨지지 않는다. 즉 현재 구현은 "수정을 보이게 한다"까지고
  "수정 이력을 강제한다"는 v0.2다. (2026-08-11 리뷰에서 지적된 항목이며,
  자동 리뷰 도구가 이를 해결됨으로 표시했으나 사실이 아니다.)
- `seal.stream`(봉인 연쇄)·L2 서명은 스펙에 있으나 CLI 미구현 (v0.2 예정).
- `report`의 캘리브레이션 곡선은 이진 point-p 정산(yes/no)만 집계한다 — 구간
  p·수량 스테이크는 스펙대로 기록·정산은 되나 채점이 v0.2(CRPS)까지 무채점이다.
- **`report`는 저장소 내부 뷰이지 공개 캘리브레이션 주장(SPEC §8)이 아니다.**
  공개 주장은 무결점 `seal.stream` 연쇄 위에서만 성립하는데 그 연쇄가 CLI
  미구현이므로, 임의 디렉토리에 `report`를 돌린 결과를 적합 공개 주장으로
  제시하면 안 된다 — 골라 담은 디렉토리는 골라 담은 분모다.

(2026-08-11 갱신: CI 배선 완료 — ci.yml "Antefact conformance suite" 스텝.
스포크 4종도 이 날 시공되어 "투영이 설계만 있다"는 공백 항목이 닫혔다.)

라이선스: 스펙 산문 CC BY 4.0 · 스키마/코드 MIT (SPEC.md 이름 정책 참조).
