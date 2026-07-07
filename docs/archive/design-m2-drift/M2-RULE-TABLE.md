# M2 Drift Materiality — v1 규칙표 (적대 검증 반영, 구현 확정본)

> 근거: `docs/DESIGN-SPEC-companion-mechanisms-2026-07-05.md` §2 + 111 케이스 전수 +
> 4렌즈 적대 검증(과발화 / 과소발화 / 비수치·범주형 / 규칙충돌·스파인).
> 실코드: `argus-mcp/src/lib/numeric-drift.ts`(현재 전역 10%/부호전환),
> `argus-mcp/src/tools/recheck.ts`(drift 불리언·next_actions 배선), `premises.ts`(PremiseRecheck).
> 이 문서는 **구현 스펙**이다 — §6 테스트 매트릭스가 그대로 test fixture, §8이 구현 노트.

---

## 0. 한 문장 요약 (설계자가 잊지 말 것)

규칙은 **"이 전제의 사실이 material하게 변했나"**만 기계로 판정한다. 적대 검증이 부순 것은
**규칙 taxonomy가 아니라 (a) 스마트 기본값 2개와 (b) 노이즈바닥의 미정의**였다. 그래서
v1의 핵심 3전환은:

1. **taxonomy를 6→8규칙으로 확장**한다(`map` 명목상태, `stateful` 경로/피크/변동성 추가) +
   각 규칙에 **modifier**(direction, unit_axis, boundary, scale)를 붙인다.
2. **스마트 기본값에서 "부호전환 항상 material"과 "전역 절대 노이즈바닥"을 폐기**한다 —
   둘 다 구조적 과발화/과소발화 근원. 노이즈바닥은 **봉인 때 측정해상도·스케일에서 유도**하고,
   미지정이면 **임의 상수 발화가 아니라 침묵 + 저신뢰 고지**가 기본.
3. **출력을 2값(drifted bool)에서 3값(`material` / `uncertain` / `unchanged`)으로 확장**한다.
   `uncertain`(=사람 판정 depends·경계걸침·규칙미포괄)은 **baseline만 갱신하고 handle을 자동
   부착하지 않는다** — 평평/가역 결정에 포크를 제조하는 스파인 누출(미러조항)을 배선에서 차단.

`zero judgment` 스파인 무접촉: 아래 수정은 전부 "사실이 변했나"의 기계적 정밀화이며, **침묵을
늘리는 방향**(과발화 억제)이라 절제 원칙과 정합. 어떤 분류도 "결정을 뒤집어라"로 새지 않는다.

---

## 1. 최종 규칙 taxonomy (8규칙 + 4 modifier)

각 전제는 **하나 이상의 규칙**을 가진다(봉인 때 지정 또는 기본 휴리스틱이 부여). 규칙은
`{ type, params, modifiers }` 구조. 값(value)은 항상 **정규화(§3.1) 이후**의 canonical 값.

### 1.1 크기(scalar-level) 규칙 — 4종

| 규칙 | material 조건 | 필수 params | 적용조건 / 적합 예 |
|---|---|---|---|
| `threshold` | canonical 값이 선 X를 넘음/미달 | `line`(X), `direction`(above\|below\|cross), `boundary`(inclusive\|exclusive) | 경계선·covenant·마감. `boundary` **필수** — "4.0 도달도 위반인가"는 전제가 정한다. 예: RATE-02, PM-08, PCT-03/04, DATE-01/02/06, PHY-02/10 |
| `step` | canonical(또는 서수맵) 값이 단계 S의 **N칸 이상** 이동 | `S`(단계 크기), `N`(기본 1), `scale`(선택: 서수맵 이름) | 값이 **고정 격자**(정책금리 25bp·신용등급·티어). S는 반드시 **측정해상도 위**(§3.3). 예: RATE-01/05, PM-02, CAT-01/07, RATE-11, PHY-07 |
| `delta` | \|next − prev\| ≥ D (canonical 단위) | `D`, `unit_axis`(§1.4) | 절대 규모가 의미(재고·인원·%p·일수). D는 **스케일에서 유도**(§3.3), 절대상수 금지. 예: RATE-03/08, INV-01, CNT-04, HC-06, SBG-06/08, DATE-03/13, PHY-03/09 |
| `relative` | \|next − prev\|/\|prev\| ≥ P | `P`(기본 0.10) | **scale-free 양에만**(매출·트래픽·개수 규모). 값이 **이미 %/확률이면 기본 금지**(§1.4 unit_axis=ratio → delta로). 예: PCT-01/07, PM-05, REV-08, DATE-03 |

### 1.2 이산/명목 규칙 — 2종

| 규칙 | material 조건 | 필수 params | 적용조건 / 적합 예 |
|---|---|---|---|
| `band` | canonical 값이 [lo, hi] **밖으로 이탈** | `lo`, `hi`, `boundary` | 밴드 유지 전제(환율·공차·커버리지). 서수 밴드도 가능(신용등급 [A-, AA]). 예: RATE-06, PM-01, PCT-13, PHY-14, CAT-04, SBG-05(부호전환 dead-band로도 재사용) |
| `map` **(신규)** | 값(라벨)이 **사전등록된 material 상태집합**에 진입 | `material_states`(집합), `scale`(선택: nominal set 이름) | **순서 없는 명목 상태전이**. step/threshold가 서수를 전제하므로 이게 없으면 host의 자유 `changed`로 새어 "규칙"이 아닌 매번 모델 판정 = 스파인 위험. 예: CAT-08(→deprecated), CAT-09(→CRL), CAT-11(→EOL), CAT-12(→departing), INV-10(0→비0 상태전환) |

### 1.3 상태보유(stateful) 규칙 — 1종 (신규, v1은 최소 구현)

| 규칙 | material 조건 | 필수 params | 적용조건 / 적합 예 |
|---|---|---|---|
| `stateful` **(신규)** | 관측**창** 내에서 (a) running-peak 대비 낙폭 ≥ D, 또는 (b) 임계 접근/이탈 **N회**, 또는 (c) 창내 max−min 폭 ≥ W | `mode`(drawdown\|crossings\|range), 모드별 파라미터, `window` | 두 스냅샷으론 표현 불가한 **경로·변동성·피크대비**. v1은 **관측 이력을 버리지 않고**(§8), 최소한 "이 창에서 N회 임계 접근" **사실만 surface**(평결 아님). 예: PM-09(drawdown), PM-10(변동성=range), RATE-10·INV-12·SBG-15·DATE-11·PHY-08(비단조 crossings) |

> **v1 범위 결정**: `stateful`은 **옵트인 전용**(기본 휴리스틱이 자동 부여하지 않음). 자동
> 부여하면 노이즈 폭증 위험 + 스파인상 "변동성을 material로 볼지"는 전제가 정할 몫. v1은
> **"이 전제는 6/7규칙으로 감시 불가"를 정직 고지**하고, `stateful`을 명시한 전제만 경로 감시.

### 1.4 Modifier (모든 크기 규칙에 얹는 옵션 — 독립 규칙 아님)

적대 검증의 핵심 교훈: **direction은 독립 규칙이 아니라 modifier여야 한다**(옵트인 별도 규칙이면
기본 delta/relative가 방향맹 → 유익한 방향 이동을 과발화, DATE-05). 마찬가지로 단위축·경계·스케일도
규칙 파라미터 **앞단**에 강제한다.

| Modifier | 값 | 효과 | 없앤 문제 |
|---|---|---|---|
| `direction` | `harmful_only` \| `either`(기본) \| `sign_flip` | `harmful_only`면 전제가 선언한 **유해 방향만** material, 유익한 방향은 침묵. `sign_flip`은 아래 §2.3 부호전환 규약으로. | DATE-05 앞당김 과발화, 흑자↔적자 방향성 |
| `unit_axis` | `absolute` \| `ratio`(%·확률) \| `percentage_point`(%p) \| `complement` | 값의 **축**을 봉인 때 못박는다. `ratio`(값 자체가 %)면 relative 금지·delta(%p) 기본. `complement`면 감시축=실패율/거절율/미방어율. | RATE-08(%p vs %), PHY-05, PCT-02/10/12 complement |
| `boundary` | `inclusive` \| `exclusive` | threshold/band 경계 "도달=위반"인가 "초과부터"인가. **미지정이면 안전측 자동채움 금지 → uncertain**(§4). | RATE-02, PCT-04, INV-02 |
| `resolution` | 측정해상도(호가단위·반올림자리·TZ 1일) | 모든 자동추정 파라미터(S·D·노이즈바닥)는 `resolution × 배수` **위에서만**. | RATE-04(1bp), PHY-03(0.1kg), DATE-14(TZ 1일) |

---

## 2. 규칙 미지정 시 스마트 기본 휴리스틱 — 정확한 알고리즘

**설계 원칙(적대 검증 확정)**: 기본값은 **under-fire(침묵 쪽)**. 확신이 없으면 발화가 아니라
**침묵 + "규칙 정하면 더 정확" 고지**. "부호전환 항상"과 "전역 절대 노이즈바닥"은 **삭제**.

```
function defaultMateriality(prev, next, premise):
    # ── 0. 정규화 선행 (규칙 이전 단계, §3) ──
    prev, next, unit = normalize(prev, next, premise)   # 단위 canonical화·서수맵·별칭
    if prev is None or next is None:                     # 라벨인데 서수맵 없음 / 단위 미상
        return UNCERTAIN(reason="비수치/미정규 — host 판정 레인", low_confidence=True)
    if prev == next:
        return UNCHANGED                                 # 변화 없음 = 어느 규칙도 발화 안 함 (RATE-09, DATE-11 왕복복귀)

    # ── 1. 측정해상도 게이트 (모든 판정 앞) ──
    resolution = premise.resolution or inferResolution(prev, next)   # 반올림 자리에서 유도
    if abs(next - prev) < resolution * SIG_MULT:         # 1bp·0.1kg·TZ 1일
        return UNCHANGED                                 # RATE-04, PHY-03, DATE-14, PHY-06

    # ── 2. 단위축 분기 (relative 오용 차단) ──
    axis = premise.unit_axis or inferAxis(premise, prev, next)
    #   inferAxis: 값이 [0,1] 또는 명시 % → 'ratio';  "%p"/"bp" 명시 → 'percentage_point';
    #              near-ceiling(>0.95 or >95%) → 'ratio' + complement 자동 '제안'(확인 필요, 강제 아님)
    #              그 외 스칼라 → 'absolute'

    # ── 3. 부호전환: "항상"이 아니라 dead-band AND ──   (적대 검증 최우선 수정)
    signFlip = sign(prev) != sign(next) and prev != 0 and next != 0
    if signFlip:
        floor = signFloor(premise)                       # 봉인 때 유도된 노이즈밴드 (예: BEP ±1억)
        if abs(prev) >= floor and abs(next) >= floor:
            # 그래도 '항상 material'로 강제하지 않는다: 0이 의미있는 축(흑자/적자·성장률)인지
            # premise.zero_meaningful 로만 material. 미지정이면 UNCERTAIN(강제 발화 금지).
            if premise.zero_meaningful == True:
                return MATERIAL(reason=f"부호 전환: {prev} → {next}")
            else:
                return UNCERTAIN(reason="부호 전환이나 0의 의미 미선언 — 규칙 정해주세요")
        else:
            return UNCHANGED                              # dead-band 안 왕복 = 노이즈 (SBG-05, PCT-11)

    # ── 4. 크기 판정 (축별로 다른 규칙) ──
    if axis == 'ratio':                                  # 값이 이미 %/확률 → relative 무단적용 금지
        # %p 기준 delta가 기본. 상대배수는 near-zero(§5)에서만.
        return UNCERTAIN(reason="값이 비율/%% — %p 기준(delta)이나 complement 축을 정해주세요",
                         low_confidence=True)             # PCT-02/10/12, PHY-05 → 축 미정이면 침묵+고지
    if axis == 'percentage_point':
        D = premise.D or deriveDelta(prev, resolution)    # 해상도 위에서 유도
        return MATERIAL if abs(next-prev) >= D else UNCHANGED

    # axis == 'absolute' (scale-free 후보)
    # ── 4a. near-zero 방어: relative 폭발 vs 진짜 신호 (양날) ──
    if isNearZero(prev, premise):                         # |prev| < near_zero_cut (검출한계·해상도 기반)
        # 전역 절대바닥으로 죽이지 않는다: near-zero엔 relative(배수)를 살리되
        # 절대바닥은 '도메인 안전기준'이 있을 때만 AND. 없으면 배수>=BIG_MULT면 material.
        rel = abs(next-prev)/max(abs(prev), resolution)
        if premise.safety_floor is not None:
            return MATERIAL if abs(next-prev) >= premise.safety_floor else UNCHANGED   # PHY-09(no)
        return MATERIAL if rel >= BIG_MULT else UNCERTAIN(low_confidence=True)         # PCT-14(yes,2.5x)
    # ── 4b. 일반 scale-free: relative만, 절대바닥은 AND 아님 ──
    rel = abs(next-prev)/abs(prev)
    if rel >= (premise.P or REL_DEFAULT):                  # REL_DEFAULT=0.10
        return MATERIAL(reason=f"{round(rel*100)}% 이동: {prev} → {next}")
    # ── 4c. 경계 knife-edge: 딱 임계 근처는 uncertain (>= vs > 인질 방지) ──
    if abs(rel - REL_DEFAULT) <= EPS:                      # PCT-08(10.00%), DATE-09(10.0%)
        return UNCERTAIN(reason="상대변화가 임계 경계에 정확히 걸침 — 규칙/밴드를 정해주세요")
    return UNCHANGED
```

**상수 기본값(v1)**: `SIG_MULT`(해상도 유의배수)`≈ 2`, `REL_DEFAULT = 0.10`,
`BIG_MULT`(near-zero 배수)`≈ 2.0`(2배), `EPS`(경계 스무딩)`≈ 0.01`. 모두 **전제별 override 가능**.

**절대 하지 말 것 (적대 검증 결론)**:
- ❌ 전역 절대 노이즈바닥을 `relative AND absolute`로 하드코딩 (CNT-05 과발화 ↔ PCT-14 과소발화 동시 유발)
- ❌ 부호전환 default-on (SBG-05·PCT-11 구조적 과발화)
- ❌ %값에 relative 무단 적용 (PHY-05 축 혼동)
- ❌ 측정해상도 밑 자동추정 (RATE-04·DATE-14)
- ❌ 미지정 시 임의 상수로 발화 (침묵+고지가 기본)

---

## 3. 정규화 레이어 (규칙 실행 **앞단**, pre-rule)

적대 검증 3렌즈 공통: **정규화는 규칙 이전 문제인데 taxonomy가 이를 삼키면 오작동한다.**
규칙 실행 전에 반드시:

### 3.1 라벨 → 서수 canonical화
- **내장 canonical scale 사전 제공**: S&P/무디스 신용등급(AAA=1…D=22, **별칭 Baa2≡BBB=7**),
  LTS 단계(Active>Maintenance>EOL), 제품 티어(Free<Pro<Business<Enterprise). 전제가 `scale` 이름만
  지정하면(`scale='sp_credit'`) step/band가 자동 서수 대조. 사용자 커스텀 scale도 허용.
- 이게 없으면 문자열이 host의 `changed` 부울로 떨어져 **"규칙"이 아니라 매번 모델 판정 = 스파인 위반**
  (CAT-01/02/03/04/07, RATE-11, PHY-07). `map`도 마찬가지로 상태집합 사전등록 필요.
- **별칭 정규화 후 동일하면 어떤 규칙도 발화 안 함** (CAT-06 Baa2↔BBB, PHY-11 mpg↔L/100km).

### 3.2 단위 canonical화
- %p vs %, K vs ℃, mpg↔L/100km, dB(로그) 를 **비교 전에 canonical 단위로 변환**. 변환 후 값이
  같으면 unchanged(PHY-11). 단위 미상이면 **host_reported 레인 + 저신뢰 고지**(억지 계산 금지).

### 3.3 측정해상도 유도
- `resolution` = 전제 명시값 또는 두 값의 반올림 자리에서 유도(0.01%→1bp, 소수1자리 kg→0.1kg,
  일 단위→1일). **모든 자동추정 파라미터(S·D·노이즈바닥) ≥ resolution × SIG_MULT.**
- TZ/자정 경계 1일, 유효숫자 밖 자리는 **항상 노이즈**(RATE-04·PHY-03·PHY-06·DATE-14).

---

## 4. 3값 출력 — `material` / `uncertain` / `unchanged` (스파인 배선)

**적대 검증 최대 스파인 발견**: 현재 `recheck.ts`가 `drifted` 불리언 2값으로 강제 이분하고
`next_actions: drifted ? ['argus_recall', ...]`로 handle(포크)을 자동부착 → human=`depends`
(가역·저스테이크·경계걸침) 케이스에 **평평한 결정에 포크를 제조**(CLAUDE.md 미러조항 위반).

수정: recheck 출력에 **세 번째 상태**를 도입한다.

| 상태 | 의미 | baseline 갱신 | handle(argus_recall) 자동부착 | surface 톤 |
|---|---|---|---|---|
| `material` | 규칙상 사실이 material하게 변함 | O | **O**(단, "다시 볼지는 당신 몫" 명시) | 사실 + handle |
| `uncertain` | depends·경계걸침·규칙미포괄·축미정 | O | **X** (자동 포크 금지) | "규칙상 경계에 걸침 / 규칙 미포괄 — 판단은 당신 몫" 사실만 |
| `unchanged` | 변화 없음 또는 노이즈 이하 | O | X | 조용(침묵 기본) |

- `uncertain`은 **argus_recall 유도를 붙이지 않는다** — handle은 사용자가 부를 때만. `depends`를
  `material`로 뭉개는 배선을 제거.
- 정직 provenance: 세 상태 모두 `source`(url/user/host_reported) 기록 유지(이미 있음).

---

## 5. 비수치 / 범주형 경로 (numeric 밖)

| 유형 | 규칙 | 라우팅 |
|---|---|---|
| 서수형 라벨(신용등급·티어·버전단계) | `step`/`band`/`threshold` + `scale` 서수맵(§3.1) | 서수맵 있으면 **기계 판정**. 없으면 host `changed` + "규칙 미포괄, canonical scale 지정 권고" 고지 |
| 순서 없는 명목 상태(available→deprecated, under review→CRL, in-office→departing) | `map` + `material_states` 사전등록 | 등록집합 진입 = material. **미등록 상태 도착 시** host_reported `changed` + "규칙 미포괄" 정직 고지 |
| 별칭/표기 차이(Baa2↔BBB, mpg↔L/100km) | 정규화(§3.1/3.2) | 정규화 후 동일 = unchanged |
| 파생/2변량 축(실질=명목−인플레, complement, drawdown, 상관) | `map` 아님 — **별도 전제 등록** 유도 | 봉인 때 "인플레·실패율·변동성도 전제로 등록"하면 delta/relative로 잡힘. 안 되면 "단변량 규칙 밖" 고지(PM-11/12, PCT-02, SBG-13) |
| 질적 material(누가 빠졌나·프록시 이동) | **규칙 없음** | 자동 판정 대상 제외 + "이 전제는 수치 감시 밖, 사용자 cadence 재확인" 정직 고지(HC-13, REV-14) |
| 메타변화(스텝크기·척도·단위 자체 개정) | **규칙 없음** | host_reported "레짐/척도 변경" 플래그 + 규칙 파라미터 무효화 nudge(RATE-14, PHY-13) |

**공통 규약**: numeric 밖에서 규칙이 못 잡는 것은 **조용히 host 판정으로 위임하지 말고**,
`uncertain` + "규칙 미포괄 — host 판정" 정직 고지로 표면화(§7 카피). 모델 추측을 규칙판정으로 위장 금지.

---

## 6. 규칙 충돌 우선순위

한 전제에 여러 규칙이 **다른 판정**을 낼 때(적대 검증이 지목한 "통째로 없는" 부분):

1. **정규화(§3) 먼저.** 정규화 후 값이 같으면 모든 규칙 침묵(별칭·단위 케이스 선차단).
2. **명시 규칙 > 기본 휴리스틱.** 전제가 지정한 규칙이 있으면 그것만 평가(휴리스틱 미개입).
3. **여러 명시 규칙이 공존하면 OR-material, 단 축이 충돌하면 unit_axis가 결정.** 예: 같은 %숫자에
   relative와 delta가 붙으면 `unit_axis`(percentage_point면 delta, ratio면 complement/relative)가
   심판. 축 미선언이면 발화 대신 `uncertain`("축을 정해주세요").
4. **경계/near-zero는 uncertain으로 흡수.** knife-edge(정확히 임계)·near-zero 애매는 어느 규칙이든
   `material`로 강제하지 않고 `uncertain`.
5. **direction modifier는 크기 판정 위에 얹혀 게이트.** 크기가 material이어도 유익한 방향이면
   `unchanged`(harmful_only).

**노이즈바닥은 기본 AND 게이트에서 제거** — delta/band 규칙을 **명시**할 때만 그 규칙의
`min_delta`/공차로 상한. 기본 경로는 `relative OR (delta 켰으면 delta)`, AND 아님(CNT-04·PHY-14·PCT-14
"절대 작지만 결정적" 구제).

---

## 7. 정직 고지 카피 (휴리스틱·불확실일 때)

스파인: 사실 진술만, 평결·지시 금지. handle은 사용자가 부를 때만.

| 상황 | 카피(ko) |
|---|---|
| 휴리스틱 기본값으로 판정(규칙 미지정 load_bearing) | "규칙을 따로 정하지 않아 기본값으로 봤어요 — 이 전제에서 어떤 움직임이 중요한지 정해두면 더 정확해요." |
| `material` 판정 | "P{n}의 사실이 바뀌었어요: '{before}' → '{after}' ({source}). 다시 볼지는 당신 몫이에요." |
| `uncertain` — 경계 걸침 | "P{n}이 규칙 경계에 정확히 걸쳤어요({rel}%). material인지 아닌지는 규칙/밴드를 정해주셔야 갈려요. 판단은 당신 몫." |
| `uncertain` — 규칙 미포괄(범주/경로/파생) | "P{n}은 지금 규칙으로는 자동 감시가 어려운 종류예요(예: 상태 전이·경로·파생값). host가 확인한 사실만 적어뒀어요 — 규칙 정할지, 그냥 둘지는 당신 몫." |
| `uncertain` — 축 미정(%p vs %) | "P{n} 값이 비율/%라 '몇 %p 움직였나'로 볼지 '실패율로 볼지' 축을 정해주셔야 정확해요." |
| baseline 첫 기록 | "P{n} 기준값 기록: '{finding}' ({source}). 7일 뒤 다시 확인 제안." |
| 봉인 때 규칙 1개 제안 | "여기서 어떤 움직임이 중요해요? (예: '4.0% 밑으로 내려가면' / '한 단계라도 바뀌면')  얼마나 자주 확인할까요?" |

---

## 8. 테스트 매트릭스 (케이스 → 기대분류, test fixture)

기대분류: **M**=material, **U**=uncertain(침묵+고지, handle 자동부착 금지), **N**=unchanged(조용).
"사람" 열은 코퍼스의 human 라벨(yes/no/depends). depends→**U**가 원칙(강제 material 금지).

### 8.1 금리·수익률 (RATE)

| 케이스 | 규칙(정규화 후) | prev→next | 사람 | 기대 | 검증 포인트 |
|---|---|---|---|---|---|
| RATE-01 | step(S=0.25,N≥1) | 3.50→3.25 | yes | M | 정책 notch, rel 7.1%지만 step이 잡음 |
| RATE-02 | threshold(4.0,below,boundary) | 4.30→4.00 | yes | M | 경계 도달=위반은 boundary가 정함 |
| RATE-03 | delta(0.15pp) / threshold | 3.60→3.80 | yes | M | 15bp |
| RATE-04 | delta, resolution=1bp | 3.60→3.61 | no | N | 해상도 게이트가 죽임 |
| RATE-05 | step(S=0.25) 누적 | 5.50→5.00 | yes | M | 2칸. baseline은 마지막 material 시점 고정(§8 누적방어) |
| RATE-06 | band[3.2,3.8] | 3.50→3.85 | yes | M | 상단 이탈 |
| RATE-07 | step + 지평상한 | 3.50→3.05 | depends | U | 파킹 지평 짧으면 무의미 → 축/지평 미정=U |
| RATE-08 | delta(0.25pp), unit_axis=%p | 3.00→3.30 | yes | M | %p 명시, relative 금지 |
| RATE-09 | any | 5.50→5.50 | no | N | 무변 |
| RATE-10 | stateful(crossings) 또는 미지정 | 3.50→3.50(중간 4.10) | depends | U/N | 스냅샷 대조 침묵(N); stateful 켰으면 창내 접근 사실 surface(U) |
| RATE-11 | step(scale=sp_credit,N≥1) | A0→A- | yes | M | 서수맵 필수 |
| RATE-12 | direction(sign_flip), zero_meaningful | +0.5→−0.3 | yes | M | 실질금리 0교차 의미 |
| RATE-13 | delta(0.10pp)/threshold, near-zero | 0.05→0.25 | yes | M | near-zero엔 delta/threshold, relative 폭발 끔 |
| RATE-14 | 없음(메타변화) | 25bp→75bp 스텝크기 | yes | U | 척도 자체 변경 → "규칙 미포괄" 플래그 |

### 8.2 가격·시장·환율 (PM)

| 케이스 | 규칙 | prev→next | 사람 | 기대 | 검증 |
|---|---|---|---|---|---|
| PM-01 | band[1300,1400] | 1350→1408 | yes | M | 상단 이탈 |
| PM-02 | step(0.25)/threshold | 3.50→3.75 | yes | M | 정책 1단계, rel 7.1% |
| PM-03 | threshold(−20%,below) | 0%→−12% | depends | U | 손절선 미도달, 아직 U |
| PM-04 | relative(P=30%)/threshold | 60000→52800 | no | N | 12%<30% |
| PM-05 | relative(P=10%)/delta | 9000→9850 | yes | M | 9.4% 경계 근처지만 delta도 잡음 |
| PM-06 | direction(harmful=엔약세)+threshold(155) | 150→158 | yes | M | 방향+선 |
| PM-07 | relative | 1340→1345 | no | N | 0.4% |
| PM-08 | threshold(5.0,below) | 5.2→4.6 | yes | M | 하향 교차 |
| PM-09 | stateful(drawdown, peak) | −3%→−11% | yes | M(stateful 켠 경우)/U | running-peak 필요, 미지정이면 U 고지 |
| PM-10 | stateful(range=변동성) | σ0.4%→1.6% | yes | M/U | 2차 모멘트, 변동성 전제 등록 필요 |
| PM-11 | 파생(실질=명목−인플레) | 명목불변 | yes | U | 인플레 별도 전제 등록 유도 |
| PM-12 | 파생(상관) | 상관0.85→0.30 | yes | U | 단변량 밖 |
| PM-13 | threshold(우리$10)/direction | 12→9 | yes | M | 우위 역전 |
| PM-14 | 없음(spike vs trend) | 100→113 | depends | U | 급등/추세 구분 불가 |

### 8.3 확률·백분율·비율 (PCT)

| 케이스 | 규칙 | prev→next | 사람 | 기대 | 검증 |
|---|---|---|---|---|---|
| PCT-01 | relative(10%) | 3.0→2.6 | yes | M | 13.3% |
| PCT-02 | complement(실패율) | 99.9→99.5 | yes | U→M | 성공률축이면 U; complement 지정 시 5배=M |
| PCT-03 | threshold(50,below) | 52→49 | yes | M | 과반선 교차 |
| PCT-04 | threshold(0.05,above,boundary) | 0.048→0.052 | yes | M | 유의선 교차 |
| PCT-05 | relative+절대바닥 | 1.0→1.3 | depends | U | +30%상대·+0.3%p절대, 표본작으면 노이즈 |
| PCT-06 | delta(0.5%p)/band | 5→5.4 | depends | U | rel 8%<10% 애매 |
| PCT-07 | relative(10%)/delta(5%p) | 40→31 | yes | M | 22.5% |
| PCT-08 | relative, knife-edge | 0.70→0.63 | depends | U | 정확히 10.00% → 경계=U |
| PCT-09 | direction(sign_flip),zero_meaningful | +2→−1 | yes | M | 흑↔적, 0 의미 |
| PCT-10 | complement(거절율) | 85→90 | depends | U | 명시축이면 5.9%<10% 침묵; complement 지정 유도 |
| PCT-11 | direction, dead-band | +0.5→−0.3 | depends | U | 성장률 미세, dead-band 밖 아니면 U(강제발화 금지) |
| PCT-12 | complement(미방어) | 95→90 | yes | U→M | 효능축 모호, complement면 2배=M |
| PCT-13 | band[75,100]/threshold(75) | 80→72 | depends | U/M | 하한 이탈이면 M; 밴드 미정이면 U |
| PCT-14 | relative(near-zero,배수) | 0.02→0.05 | yes | M | 2.5배, 절대바닥이 죽이면 안 됨(safety_floor 없으면 배수로 M) |

### 8.4 개수·규모 (INV/CNT/HC/REV)

| 케이스 | 규칙 | prev→next | 사람 | 기대 | 검증 |
|---|---|---|---|---|---|
| INV-01 | delta(D=100) | 500→380 | yes | M | 안전재고 근처 |
| INV-02 | threshold(40) | 44→40 | yes | M | 바닥선 도달 |
| INV-03 | delta(D=2000) | 12000→11050 | no | N | 950<2000 |
| CNT-04 | delta(D=1,near-zero) | 8→9 | yes | M | 개수는 relative 아닌 delta, 절대바닥이 죽이면 안 됨 |
| CNT-05 | delta(D=3)/relative(AND절대) | 3→6 | depends | U | near-zero 100%폭발, 절대 3명이 신호. 미지정이면 U |
| HC-06 | delta(D=1)/threshold(5) | 5→4 | yes | M | 20% 용량손실 |
| HC-07 | delta(1)+threshold(5) | 6→5 | depends | U | 5 미만부터 비선형 |
| REV-08 | relative(10%,scale-free) | 3.2M→3.05M | no | N | 4.7%<10%, 매출은 relative |
| REV-09 | delta(10%p)/threshold(50) | 40→55 | yes | M | 집중도 %p |
| INV-10 | map/direction(0 이탈) | 0→3 | yes | M | 0에서 벗어남=상태전환 |
| CNT-11 | relative+스케일유도바닥 | 10000→10400 | depends | U | 4%, 대규모라 일상변동. 노이즈바닥 스케일유도 |
| INV-12 | stateful(crossings) | 200→150→260→180 | depends | U/N | 비단조, 미지정이면 N; stateful이면 U |
| HC-13 | 질적(누가) | 12→11(리드) | yes | U | 8.3%<10%지만 진짜=질적 → 수치 밖 고지 |
| REV-14 | 프록시 이동 | 계약0→0(문의2→15) | depends | U | 감시값 불변, 프록시 별도 등록 유도 |

### 8.5 부호·수지·성장 (SBG)

| 케이스 | 규칙 | prev→next | 사람 | 기대 | 검증 |
|---|---|---|---|---|---|
| SBG-01 | direction(sign_flip),zero_meaningful | +8억→−2억 | yes | M | 흑↔적 |
| SBG-02 | direction(sign_flip) | +1200→−300 | yes | M | 현금흐름 0교차 |
| SBG-03 | direction(sign_flip) | +3→−1 | yes | M | 성장 0교차 |
| SBG-04 | 없음/relative | +30→+26 | no | N | 13%지만 견고 플러스, 방향유지 |
| SBG-05 | band dead-band[−1억,+1억] | +0.5→−0.4 | no | N | 노이즈밴드 안 왕복, 부호전환이 여기서 발화하면 안 됨 |
| SBG-06 | delta(≥3억)/relative | −1억→−6억 | yes | M | 절대 악화 |
| SBG-07 | delta(스케일유도 D) | −50억→−53억 | no | N | 대사업부, D를 규모에서 유도해야 N |
| SBG-08 | threshold(−320억)/delta(15억) | −300→−318 | yes | M | 승인선 근접 |
| SBG-09 | threshold(+1.0)/band | +2.1→+0.2 | depends | U | 침체선 미달 애매 |
| SBG-10 | threshold(0℃) | +4→−1 | yes | M | 동결선 |
| SBG-11 | delta(≥5℃)/threshold | +3→−2 | depends | U | 빙점 이벤트 조건 |
| SBG-12 | threshold(+10억)/relative | +40→+2 | yes | M | 안전마진선 |
| SBG-13 | 없음(회계기준 변경) | +50억→GAAP−20억 | yes | U | 메타변화, 단일값 밖 |
| SBG-14 | 없음 | +12→+11 | no | N | 방향·규모 유지 |
| SBG-15 | stateful(crossings) | +500→−50→+480 | depends | U/N | 비단조, prev==next면 N; stateful이면 U |

### 8.6 범주형·상태 (CAT)

| 케이스 | 규칙 | prev→next | 사람 | 기대 | 검증 |
|---|---|---|---|---|---|
| CAT-01 | step(scale=sp_credit,N≥1) | A→BBB | yes | M | 서수맵 |
| CAT-02 | threshold(BBB-,투자등급선) | BBB-→BB+ | yes | M | junk 강등 |
| CAT-03 | step(N≥2) | AAA→AA+ | no | N | 1칸, N≥2면 침묵 |
| CAT-04 | band[A-,AA] | A→AA- | no | N | 구간 내 |
| CAT-05 | direction(강등만) | BBB→BBB+ | no | N | 상향 무시 |
| CAT-06 | 정규화(별칭) | Baa2→BBB | no | N | Baa2≡BBB 정규화 후 동일 |
| CAT-07 | step(tier)/threshold(Enterprise) | Enterprise→Business | yes | M | 티어 서수 |
| CAT-08 | map({deprecated,...}) | available→deprecated | yes | M | 명목 상태전이 |
| CAT-09 | map({CRL,rejected}) | under review→CRL | yes | M | 순서없는 명목 |
| CAT-10 | map(미등록=U) | in force→under challenge | depends | U | 실효 유지, watchlist만 |
| CAT-11 | threshold(LTS단계)/map(EOL) | Active→Maintenance | depends | U | EOL만 hard-material |
| CAT-12 | map({departing,...}) | 재직→이임 | yes | M | 인사 상태전이 |

### 8.7 날짜·마감 (DATE)

| 케이스 | 규칙 | prev→next | 사람 | 기대 | 검증 |
|---|---|---|---|---|---|
| DATE-01 | threshold(3-15 하드마감) | 3-01→3-10 | no | N | 3-10<3-15 미교차 |
| DATE-02 | threshold(3-15) | 3-01→3-20 | yes | M | 하드마감 교차 |
| DATE-03 | relative(33%)/delta(7일) | 30→40일 | yes | M | 리드타임 |
| DATE-04 | delta(≥7일),resolution | 30→32일 | no | N | 2일<7 |
| DATE-05 | delta+direction(harmful_only) | 4-15→4-08 앞당김 | no | N | 유익 방향 침묵 |
| DATE-06 | threshold(7-01 판매일) | 6-30→7-28 | yes | M | 계획일 교차 |
| DATE-07 | threshold(우리 8월,상대위치) | 9-15→7-01 | yes | M | 내 날짜 대비 뒤집힘 |
| DATE-08 | threshold(연말경계 12-31) | 12-20→1-05 | yes | M | 분기/연 경계 |
| DATE-09 | relative, knife-edge | 90→99일 | depends | U | 정확히 10.0% → 경계=U |
| DATE-10 | threshold(재계약선,하드) | 8-31→8-24 앞당김 | yes | M | 법적 선, 방향무관 |
| DATE-11 | any(prev==next) | 6-01→(6-10)→6-01 | no | N | 왕복복귀 무변 |
| DATE-12 | threshold(9-30 분기경계) | Q3말→Q4초 | yes | M | 경계 교차, 값 모호 |
| DATE-13 | delta(버퍼5일)/threshold(40일) | 45→41일 | depends | U | 버퍼 내면 U |
| DATE-14 | delta,resolution=1일 | 7-15→7-16 | no | N | TZ 1일 노이즈 |

### 8.8 물리·측정 (PHY)

| 케이스 | 규칙 | prev→next | 사람 | 기대 | 검증 |
|---|---|---|---|---|---|
| PHY-01 | threshold(CI하한>0) | CI포함0→미포함0 | yes | M | 불확실구간이 0 넘김 |
| PHY-02 | threshold(38.0,above) | 37.4→38.1 | yes | M | 발열선 |
| PHY-03 | delta, resolution=0.1kg | 70.4→70.6 | no | N | min_delta=0.1×10=1.0 |
| PHY-04 | delta(℃), unit_axis | 20℃→25℃ | depends | U | ℃ delta로, K 상대% 함정 |
| PHY-05 | relative(P=50%) 또는 delta(%p) | 2→4% | yes | M | +100%상대. 축선언 필요 |
| PHY-06 | 없음(유효숫자) | 4자리→5자리 | no | N | 정밀도 밖 |
| PHY-07 | step(scale,N=1) | A→B | yes | M | 품질등급 서수 |
| PHY-08 | stateful/threshold(1000) | 800→820(600~1100진동) | depends | U | 순간값 아닌 시간비율 |
| PHY-09 | delta(safety_floor) | 0.01→0.03ppm | no | N | 안전기준 대비 작음, safety_floor로 N |
| PHY-10 | threshold(65dB) | 60→66 | yes | M | 로그, %·delta 오도 |
| PHY-11 | 정규화(단위) | 40mpg→40mpg | no | N | 물리량 불변 |
| PHY-12 | direction(sign_flip) | +2→−3 Gt/yr | yes | M | 질량수지 0교차 |
| PHY-13 | 없음(척도개정) | 6/10→7/11 | depends | U | 10점→11점 메타변화 |
| PHY-14 | band[9.95,10.05] | 10.00→10.06 | yes | M | 공차 이탈 |

**PHY-09 vs PCT-14 (동형 shape, 반대 판정) — 노이즈바닥 per-premise 증명**: 둘 다 near-zero
2.5~3배 이동. PHY-09는 `safety_floor`(규제 1ppm 등) 지정 → 절대변화 작아 **N**. PCT-14는
safety_floor 없음 → 배수(2.5x)≥BIG_MULT라 **M**. 단일 전역 노이즈바닥으론 못 가르는 것을
**전제별 파라미터(safety_floor 유무)**가 가른다.

### 8.9 매트릭스 커버리지 요약

- **False-alert 방어 검증**: RATE-04/09/14, PM-04/07, PCT-11, INV-03, SBG-04/05/07/14,
  CAT-03/04/05/06, DATE-01/04/05/11/14, PHY-03/06/09/11 → 전부 **N 또는 U**(과발화 없음).
- **False-silence 방어 검증**: RATE-01/02/03/05, PM-02, CAT-01/02/07, RATE-11, PCT-03/04,
  PHY-02/07/10/14 → 전부 **M**(step/threshold/band/서수맵이 전역 10%가 놓치던 걸 잡음).
- **depends → U 라우팅**(강제 material 금지, 스파인): RATE-07/10, PM-03/09/10/14, PCT-05/06/08/10/11/13,
  CNT-05/11, HC-07, INV-12, SBG-09/11/15, CAT-10/11, DATE-09/13, PHY-04/08/13, REV-14, HC-13.

---

## 9. 스파인 확인 ("변했나" vs "다시 볼까" 분리)

| 항목 | 확인 |
|---|---|
| 규칙은 "사실이 material하게 변했나"만 판정 | ✅ 8규칙 모두 기계·전제정의. "뒤집어라" 없음 |
| handle 반환만, 지시 없음 | ✅ `material`도 "다시 볼지는 당신 몫"만. `uncertain`은 handle 자동부착 **제거**(포크 제조 차단) |
| 규칙은 사용자/전제가 정함 | ✅ 봉인 때 지정. 미지정이면 침묵+고지(모델이 대신 판정 안 함) |
| 어떤 분류도 사용자 평결로 안 샘 | ✅ 상태전이·서수도 "사실이 바뀜"이지 "당신이 틀림" 아님 |
| under-fire 기본(미러조항) | ✅ 기본값이 침묵 쪽. depends→U, near-zero/경계→U. 부호전환 default-off, dead-band AND |
| 정직 provenance | ✅ 3상태 모두 source 기록. 정규화 실패·규칙미포괄은 "host 판정" 정직 고지 |

**미러조항 특별 확인**: `uncertain`이 handle을 자동부착하지 않는 것이 핵심 — 가역·저스테이크·
평평한 depends 케이스(PM-03·PCT-05·CNT-05 등)에 argus_recall 포크를 제조하던 배선을 끊는다.

---

## 10. 구현 노트 — `numeric-drift.ts`를 어떻게 바꾸나

현재: `numericDrift(prev, next): { drifted: boolean }` — 전역 10% + 부호전환 항상.

### 10.1 시그니처 확장
```ts
// 현재
export function numericDrift(prev: number, next: number): NumericDrift;

// v1
export type Materiality = 'material' | 'uncertain' | 'unchanged';
export interface MaterialityResult {
  status: Materiality;
  reason: string;
  low_confidence?: boolean;   // 휴리스틱/경계/축미정 → 정직 고지 유발
}
export function evaluateMateriality(
  prev: PremiseValue,          // number | { label: string } (서수/명목)
  next: PremiseValue,
  rule?: MaterialityRule,      // 전제가 지정한 규칙(없으면 기본 휴리스틱)
  ctx?: { resolution?: number; unit_axis?: UnitAxis; ... },
): MaterialityResult;
```

### 10.2 `MaterialityRule` 타입 (premise에 저장, jsonb — 마이그 0)
```ts
type RuleType = 'threshold'|'step'|'delta'|'relative'|'band'|'map'|'stateful';
interface MaterialityRule {
  type: RuleType;
  params: Record<string, number|string|string[]>;   // line/S/N/D/P/lo/hi/material_states...
  modifiers?: {
    direction?: 'harmful_only'|'either'|'sign_flip';
    unit_axis?: 'absolute'|'ratio'|'percentage_point'|'complement';
    boundary?: 'inclusive'|'exclusive';
    scale?: string;            // 서수맵/nominal set 이름
    resolution?: number;
    zero_meaningful?: boolean;
    safety_floor?: number;
  };
}
```
- `premise.materiality_rule`, `recheck_cadence_days`, `next_recheck_due`를 **jsonb 내부 필드로**
  추가(스펙 §5) → `decision_contract`/ledger event에 실려 PGRST204 위험 없음. `PremiseRecheck`는
  그대로 두고 규칙만 premise 쪽에.

### 10.3 `recheck.ts` 배선 변경 (스파인)
- `numericDrift` 호출부(85–104줄)를 `evaluateMateriality`로 교체. `drifted: boolean` → `status: 3값`.
- **142줄 `next_actions`**: `drifted ? ['argus_recall','leave_as_is'] : [...]` →
  `status === 'material' ? ['argus_recall','leave_as_is'] : ['leave_as_is','stop']`.
  **`uncertain`은 argus_recall 자동부착 금지**(§4 스파인).
- surface(131–135줄): `uncertain` 분기 추가(§7 카피). `low_confidence`면 "휴리스틱 — 규칙 정하면 더 정확" 한 줄.
- integrityNote(89–91줄) 유지 — numeric vs host `changed` 불일치는 계속 둘 다 기록.

### 10.4 정규화 인프라 (신규 파일)
- `argus-mcp/src/lib/canonical-scales.ts`: 내장 서수맵(S&P/무디스 별칭, LTS, 티어) +
  `normalizeLabel(scale, label): number|null` + `normalizeUnit(value, from, to)`.
- `evaluateMateriality`가 규칙 실행 **앞단**에서 호출. 실패(맵 없음/단위미상)면 `uncertain`.

### 10.5 하위호환 & 가드
- 규칙 미지정 전제는 §2 기본 휴리스틱으로 — 기존 동작보다 **덜 발화**(under-fire). 기존 185 테스트
  중 numeric 케이스는 기대값 재산정 필요(전역 10%→축별 규칙). **테스트 매트릭스(§8)를 신규 fixture로**.
- `NUMERIC_DRIFT_THRESHOLD` 상수는 `REL_DEFAULT`로 유지(scale-free 기본), 단 axis=ratio엔 미적용.
- v1은 `stateful`을 **미지정 시 자동부여 안 함**(옵트인). 경로/변동성 케이스는 U 고지로 정직 처리 →
  v2에서 관측이력 누적 후 stateful 구현.
