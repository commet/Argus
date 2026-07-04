# Argus 컴패니언 비전 검증 — 2026-07-03

친구가 눈 반짝인 3기능이 argus에 **실제로 있는가**를 발행된 서버로 34스텝 관찰.
원본: `CORPUS-2-companion.md` + `raw-2-companion.jsonl`. locale=ko.

## 친구가 반짝인 것 ↔ 실측 결과

### ① 전제/결론 저장 → 팔로업 → 변하면 alert  ✅ **작동**
- `argus_premises`로 전제 저장: `external`(현실이 검증 가능)·`load_bearing`(틀리면 결정 뒤집힘)·
  `open_question`(명시적 미결정) 태깅. 실측 저장됨.
- `argus_recheck`: 첫 체크 = baseline(무알림). 재체크에서 **기계적 drift 판정** —
  실측: `기준금리 3.5% → 4.0%`, `"moved 14%: 3.5 → 4"`, `drifted:true`.
  **모델이 판단 안 함**, 숫자가 결정. 스파인대로 "revisit 여부는 당신 몫"으로 handle 반환.
- **cross-decision fan-out 작동**: carloan에서 한 번 recheck(`apply_to_matching`) →
  같은 전제를 쓰는 loan에도 자동 적용(`applied_to_matching:[{decision_id:"loan",ref:"P1"}]`).
  = "그 사실에 기대던 **모든** 결정에 한 번에 alert."

### ② 미결정/불확실 주기적 nudge  🟡 **부분 작동 (갭 발견)**
- ✅ check_in이 확인일 지난 **계약**과 재확인 due **전제**를 한국어로 nudge:
  "계약 3건이 확인일을 지났습니다 — 현실과 대조할 차례입니다 (argus_settle).
   전제 사실 1건이 현실 재확인 차례입니다 (argus_recheck)."
- ⚑ **갭: `open_question`(명시적 미결정)은 주기 nudge에 안 뜬다.** check_in의 `due`에는
  계약·전제재확인만 있고, "2년 내 이직할지 아직 모른다" 같은 open_question은 사용자가
  resolve하기 전까지 **다시 상기시켜 주지 않음**. 친구가 흥미로워한 "미결정한 것도 주기적으로
  고민하게" 부분이 **절반만 구현**. → 개선 후보: check_in에 open_question 재상기(사실 진술로만,
  "N일 전 미결로 남긴 질문 — 지금 답할 수 있나?" · 스파인상 강요 아닌 handle 반환).

### ③ 패턴 메모리(비서처럼)  ✅ **작동 (corpus-1에서 확정)**
- `track_record`: "Of 10 settled: 5 held, 2 avoided, 3 partial", `sample_size` 명시,
  `judgment_tier:null / judgment_score:null` — **빈도 사실만, 등급 없음**(스파인 유지).
- `related_to`로 유사 결정 연결 → 빈도 서술. (corpus-2의 launch 케이스는 테스트 실수:
  `related_to`를 `argus_seal`에 넘겼는데 seal 스키마엔 없어 strict 거절 — argus가 옳게 막음.)

## 견고성 가드 — 전부 작동
| 프로브 | 결과 |
|---|---|
| source=ai + ai_original 없음 | `PROVENANCE_REQUIRED` — 위조 차단 ✅ |
| 확인일 지난 뒤 amend | `GOALPOST_MOVED` — 사후 골대이동 차단 ✅ |
| 전제 과다 | `PREMISE_CAP` ✅ |
| open_question을 recheck | `NOT_RECHECKABLE`(resolve로 닫아라) ✅ |
| strict 스키마 미지정 인자 | 거절 ✅ |

## 이번에 나온 개선 항목 (다음 패스)
1. **[기능갭] open_question 주기 nudge** — 친구 포인트 ②의 미구현 절반. check_in에 미결 재상기.
2. **[locale] happy-path 한 줄 영어 잔존 — 6개 도구**: `open_decision`·`seal`·`settle`·
   `recheck`(drift alert 메시지 포함)·`amend`·`dismiss`. 리치 표면·에러·nudge는 이미 한국어.
   `surfaces.ts` 사전에 one-liner 추가 + 각 도구 분기(영어 문자열은 185테스트가 검증하므로
   **en 바이트 보존 + ko 추가** 방식). 이 코퍼스가 before-기준선(EN_SURFACE 카운트).
3. **[설계 아이디어] 입력 언어 자동 감지** — 지금 locale은 config-only(자동 아님). 결정 동반자라면
   사용자가 쓴 언어를 따라가는 게 자연스러움. detectLocale이 init 때 env/Intl로 1회 스니핑하는데,
   런타임 입력 언어 반영은 미구현. (호스트가 매 호출 언어를 못 주므로 설계 필요.)
