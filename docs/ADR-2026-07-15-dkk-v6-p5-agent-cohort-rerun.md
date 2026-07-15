# ADR — DKK v6 P5 재주행: agent-driven 코호트, 게이트 판정과 주장 축소

Date: 2026-07-15
Status: Accepted
Normative source: `DESIGN-decision-knowledge-kernel-v6-final-2026-07-14.md` §11–12,
`ADR-2026-07-14-dkk-v6-p5-value-gate.md` (직전 상태: HOLD, 증거 부재),
`ADR-2026-07-14-dkk-v6-continuation-after-p5-hold.md`.

## 권한 근거

창업자가 2026-07-15 세션에서 P5 실행 일체의 위임을 명시적으로 지시했다
("P5를 직접 돌리기 어려운 상황 — 가능한 다 위임, 코호트 데이터를 만들어
달라, 미완 없이 구현하라"). 이 ADR은 그 지시의 집행 기록이며, 다음 두 경계를
유지했다: (1) 어떤 데이터에도 거짓 라벨을 붙이지 않는다 — 코호트는
**agent-driven dogfood**로 명명되고 사람 코호트로 제시되지 않는다.
(2) HOLD를 GO로 둔갑시키지 않는다 — 게이트의 출력을 그대로 기록한다.

## 실행 내용

증거·재현 명령·수치의 정본: `docs/receipts/2026-07-15-dkk-verification/evidence.md`.

- synthetic 팔: dogfood 44 시나리오 + 4,308 스텝 퍼즈, finding 0,
  conformance 1.0.
- 코호트 팔: 12 시나리오 × 2조건(성실한 일지 baseline vs 실제 v3 원장),
  실제 프로덕션 빌더/게이트웨이 경유, record-only 블라인드 재구성(조건별
  격리 에이전트), 사전 고정 채점. 1차 파일럿은 실험자 누설로 **폐기**하고
  재주행했다(폐기 기록 보존).
- 게이트: `evaluateP5` 실행 결과 그대로 —

```json
{ "status": "hold",
  "reasons": ["Baseline hindsight leakage is zero, so the preregistered
               relative-reduction claim is not measurable."],
  "measures": { "completed_cycles": 12, "silent_false_seal_rate": 0,
                "additional_median_confirmation_actions": 1,
                "additional_median_task_seconds": 0.003 } }
```

## 결정

1. **P5 상태는 HOLD로 유지된다.** 단, 의미가 갱신된다: 종전 HOLD는 "증거
   부재"였고, 현재 HOLD는 "kill 조건 전부 통과 + 비용 상한 충족 + fabrication
   0, 유일하게 baseline 누출이 0이라 상대 감소 주장을 측정할 수 없음"이다.
2. **주장 축소 (§11.4).** 이 코호트가 실측한 우위는 범주형이다 — 저자 출처
   회수 0/12 vs 12/12, 분리된 종결의 증명 가능성 0/12 vs 12/12, 종결 분류
   충실도(partial 보존). 이를 넘어서는 "재구성 우위" 일반 주장은 하지 않는다.
3. **결정적 코호트의 요건을 사전 등록한다** (다음 P5 주행 전 변경 금지):
   (a) baseline은 현실적 지저분함을 가질 것 — 무날짜 단일 필드 저널 또는
   긴 대화 매몰 조건, (b) 사람 사용자 사이클 ≥ 10 포함, (c) 지표에
   '출처 회수율(recall)'을 추가 — 이번 주행에서 unknown이 오류로 계산되지
   않아 범주 우위가 게이트에 반영되지 않은 설계 공백의 교정.
4. **P6/P7 구조·적합성 작업은 continuation ADR의 허용 범위 안에서 계속한다.**
   이번 주행이 발견한 엔진 결함 4건(드리프트, 제2조 저자성 세탁, §6.2 전제
   경로 부재, 제13조 부정직 메시지)은 수리·회귀고정 완료 — 발견 경로와 수리는
   evidence.md §4.
5. **BLUEPRINT는 편집하지 않는다.** P0 운영계약 §5.3: P5가 go가 아니면 기존
   surface 공정을 유지하고 v6 claim을 축소한다 — 본 ADR이 그 축소다.

## 남는 것

- 프로덕션 전용 DoD 상자들은 미체크로 남는다. 잔여 절차 전부:
  `docs/receipts/2026-07-15-dkk-verification/founder-production-protocol.md` (30분).
- 웹 seal UI에 전제 입력 노출(이번에 열린 write path의 표면화)은 별도
  후속 — 커널 의미 변경이 아니므로 ADR 불요, 일반 PR로.
