/**
 * 인지 축 레지스트리 — 60년 문헌이 "기계가 무엇을 만질 수 있는가"에 대해
 * 확정한 경계를, 산문이 아니라 **타입 제약**으로 못 박는 자리.
 *
 * 왜 이 파일이 존재하나. 재정초 브리프는 판단을 "전제"라는 한 축으로 다루는
 * 설계를 검토했다. 그것은 문헌을 절반만 읽은 것이다. 판단은 최소 일곱 축이고,
 * **축마다 문헌이 허용하는 기계의 권한이 다르다.** 프레임은 기계가 손대면
 * 안 되고(Lucas·Hume), 전제는 손대도 되지만 임계가 사전 믿음이며(Chow→
 * Bai-Perron), 추론은 **기록은 되지만 자기보고를 신뢰해선 안 된다**
 * (Nisbett-Wilson 1977). 이 차이를 코드가 모르면 제품이 조용히 선을 넘는다.
 *
 * 그래서 각 축은 `authority` 등급을 갖고, 엔진이 그 등급을 집행한다.
 * 등급을 어기는 쓰기는 런타임에서 거부된다 (P5 시끄러운 실패).
 *
 * ── 문헌의 상충 지점 (결론만 읽으면 안 보이는 것) ─────────────────────
 *
 * 1) 탐지 vs 귀납. Chow(1960)는 **알려진** 시점의 단절을 검정한다. Quandt·
 *    Andrews(1993)는 모르는 시점으로 확장하고, Bai-Perron(1998·2003)은 복수
 *    단절을 동시에 추정하며, Page(1954) CUSUM·ADWIN(2007)은 스트림에서
 *    순차 탐지한다. 그런데 **전부** 검증 불가능한 모수를 요구한다 (유의수준,
 *    trimming, 최대 단절 수, δ, h·k). 유한 표본에서 소음과 구조 변화의 구분은
 *    귀납 문제 그 자체다. → 결론: 임계는 숨기면 거짓말이 된다. `PRIOR_OWNED_BY_USER`.
 *
 * 2) Lucas vs Lucas. Lucas(1976)의 처방은 "개입에 불변인 심층 모수를 찾아라"
 *    다. 그런데 Estrella-Fuhrer(2003)는 그 심층 모수에도 같은 비판이 적용됨을
 *    보였다. **보장된 불변 층위는 없다.** 있는 것은 "더 불변인" 층위뿐이다.
 *    → 결론: "이건 구조적 믿음"이라고 기계가 선언할 수 없다. 대신 *이 사용자의
 *    기록에서 몇 번의 국면 전환을 살아남았는가*는 셀 수 있다. 절대 등급이 아니라
 *    생존 횟수. 그것이 정직한 형태다.
 *
 * 3) Nisbett-Wilson vs Tetlock. Nisbett-Wilson(1977)은 사람이 자기 판단의
 *    *이유*를 정확히 보고하지 못함을 보였다 — 자기보고는 작화(confabulation)다.
 *    반면 Tetlock(2005·2015)은 **사전등록된 해결가능 예측**에 채점 피드백을
 *    주면 보정이 개선됨을 보였다. 두 결과는 모순이 아니다:
 *      → **과정을 묻지 말고 약정을 받아라.** "왜 그렇게 생각했나"(작화)가 아니라
 *        "무엇에 기대는가·얼마나 확신하는가·무엇이 틀렸다고 판정하는가"(검사 가능).
 *        인지 *체계*는 자기서술이 아니라 **여러 에피소드에 걸친 약정의 패턴**에서
 *        재구성된다. 증언이 아니라 잔여물로 짓는 거울.
 *
 * 4) 사후확신은 교정 불가. Fischhoff(1975)는 결과를 알면 회고가 다시 쓰이고,
 *    Fischhoff(1977)는 그것을 **경고해도 줄지 않음**을 보였다. 유일하게 듣는
 *    처방은 당시 기록의 보존이다 (Croushore-Stark(2001) 실시간 데이터 원리:
 *    과거 예측은 그때 가용했던 빈티지로만 평가해야 한다).
 *    → 결론: 빈티지는 UX 선택이 아니라 **이 문제에서 유일하게 효과가 입증된 개입**.
 *
 * 5) 구속은 듣지만 아무도 안 산다. O'Donoghue-Rabin(1999): 자기 비일관성을
 *    아는 세련형만 구속을 수요한다. Ashraf-Karlan-Yin(2006): 구속 상품은
 *    효과가 있으나 자발 수용률이 낮다. Thaler-Benartzi(2004): **기본값**이
 *    설득을 압도한다.
 *    → 결론: 형태는 목적지가 아니라 얹히는 층. 그리고 마찰은 기능이 아니라
 *      **채택의 상한**이다 (M7이 특기된 이유).
 *
 * 6) 탐지의 대안. Herbster-Warmuth(1998)·Cesa-Bianchi-Lugosi(2006)의 후회
 *    상한은 분포 가정 없이 **단절을 탐지하지 않고** 가설 포트폴리오를 재가중해
 *    보증을 얻는다. 안정성-가소성 딜레마(Grossberg 1987)가 말하는 무한 후퇴
 *    (최적 갱신 속도는 변화 과정에 달렸고 그 과정도 변한다)를 우회하는 유일한
 *    계보다.
 *    → 결론: `premise` 축에서 "탐지 실패"를 조용한 정상으로 두지 않는다. 경보가
 *      안 울린 것과 전제가 살아있는 것은 다른 사실이고, 둘을 구분해 적는다.
 *
 * ── 이 프로젝트가 문헌에 **없는** 것을 하나 보탠다 ───────────────────
 *
 * 7) 이해 없는 명명. E-0 실측(2026-08-16): 이 저장소의 창업자 대화에서 새로
 *    생긴 하중 개념구 11/11이 AI 최초 발화였고, **같은 92턴에 이해 거부가
 *    12건**이었다. 즉 어휘와 의제는 넘어가고 이해는 넘어가지 않는다. 문헌의
 *    어느 계보도 이것을 다루지 않는다 (AI와의 장기 협업이 새 현상이므로).
 *    → 그래서 `comprehension` 이 축의 속성이 아니라 **프레임의 게이트**다.
 *      출처 태깅(P2)은 이 실패를 막지 못한다 — "AI가 만든 말입니다"라고
 *      붙여놔도 사람은 그 말로 지시를 계속 내린다.
 */

/**
 * 축에 대한 기계의 권한. 문헌에서 파생된 등급이며 엔진이 집행한다.
 *
 * - `human_only`      기계는 **생성도 채점도 금지**. 조사·반론·조건부 추천까지만
 *                     (브리프 §2 P8). 값·프레임이 여기 속한다 (Hume의 사실-가치
 *                     구분, Lucas의 심층 모수).
 * - `machine_checkable` 기계가 외부 신호에 결박하고 판정해도 된다. 단 임계는
 *                     사용자 소유 사전 믿음으로 노출된다 (상충 1).
 * - `machine_recordable` 기계가 기록은 하되 **판정 금지**. 자기보고를 신뢰할 수
 *                     없는 축 (상충 3, Nisbett-Wilson).
 */
export type AxisAuthority = 'human_only' | 'machine_checkable' | 'machine_recordable';

export type AxisId =
  | 'frame'
  | 'values'
  | 'premises'
  | 'inference'
  | 'confidence'
  | 'alternatives'
  | 'falsifier';

export interface AxisSpec {
  id: AxisId;
  /** 사용자에게 보이는 이름. 판정 어휘가 아니라 질문 형태로 쓴다. */
  label: string;
  /** 이 축이 무엇을 담는지 — 사용자용 한 줄. */
  prompt: string;
  authority: AxisAuthority;
  /** 이 등급의 문헌 근거. 코드에 남겨야 다음 세션이 등급을 함부로 못 바꾼다. */
  lineage: string;
  /**
   * 하중 축인가. 하중 축에서 AI 발원 문장이 나오면 이해 재진술 게이트가 걸린다
   * (상충 7). 모든 축에 걸면 마찰이 채택을 죽인다 (상충 5).
   */
  loadBearing: boolean;
  /** 이 축이 비어 있어도 프레임을 봉인할 수 있는가. */
  optionalForSeal: boolean;
}

/**
 * 일곱 축. 순서는 판단이 실제로 조립되는 순서에 가깝게 두었다 (프레임이 먼저
 * 정해지지 않으면 전제가 무엇에 대한 전제인지 알 수 없다).
 */
export const AXES: readonly AxisSpec[] = [
  {
    id: 'frame',
    label: '무엇을 묻고 있나',
    prompt: '지금 뭘 정하려는 건지 한 줄로. (예: 지금 올릴 때인가, 더 기다릴 때인가)',
    authority: 'human_only',
    lineage:
      'Kahneman-Tversky 프레이밍 + Lucas(1976) 심층 모수 + Hume 사실-가치. 프레임 선택은 §1.2의 기계화 불가능 목록에 있다.',
    loadBearing: true,
    optionalForSeal: false,
  },
  {
    id: 'values',
    label: '무엇을 좋다고 보나',
    prompt: '이게 잘 됐다는 건 뭐가 어떻게 된 상태인가요.',
    authority: 'human_only',
    lineage: 'Hume 사실-가치 구분. 손실 함수는 기계화 불가능(§1.2). AI가 대신 쓰면 그 판단은 사용자의 것이 아니다.',
    loadBearing: true,
    optionalForSeal: false,
  },
  {
    id: 'premises',
    label: '무엇에 기대고 있나',
    prompt: '이게 맞다고 치고 있는 것들. 나중에 숫자로 확인할 수 있으면 더 좋습니다.',
    authority: 'machine_checkable',
    lineage:
      'Chow(1960)→Quandt·Andrews(1993)→Bai-Perron(1998,2003) 단절 추정 + Page(1954) CUSUM + ADWIN(2007). 임계는 검증 불가능한 사전 믿음이므로 사용자 소유로 노출한다.',
    loadBearing: true,
    optionalForSeal: false,
  },
  {
    id: 'inference',
    label: '어떻게 이어지나',
    prompt: '그래서 왜 이 결론이 나오는지 한 줄. 안 써도 됩니다.',
    authority: 'machine_recordable',
    lineage:
      'Nisbett-Wilson(1977) "Telling more than we can know" — 자기 판단의 이유에 대한 자기보고는 신뢰할 수 없다. 그래서 기록만 하고 채점하지 않는다.',
    loadBearing: false,
    optionalForSeal: true,
  },
  {
    id: 'confidence',
    label: '얼마나 확신하나',
    prompt: '0~100. 나중에 맞았는지 틀렸는지 가릴 수 있는 것에만 의미가 있습니다.',
    authority: 'machine_checkable',
    lineage:
      'Tetlock(2005,2015) + Murphy(1973) Brier 분해(보정+분해능−불확실성). 사전등록된 해결가능 예측에만 채점이 성립한다.',
    loadBearing: false,
    optionalForSeal: true,
  },
  {
    id: 'alternatives',
    label: '무엇을 버렸나',
    prompt: '생각했다가 안 하기로 한 것. 안 써도 됩니다.',
    authority: 'machine_recordable',
    lineage:
      'Kahneman outside view + Flyvbjerg 준거집합 예측. 버린 길의 기록은 반사실 처리의 최소 형태이며, 기계가 좋고 나쁨을 판정할 근거는 없다.',
    loadBearing: false,
    optionalForSeal: true,
  },
  {
    id: 'falsifier',
    label: '무엇이 내 마음을 바꾸나',
    prompt: '이런 일이 벌어지면 내가 틀린 거다 — 를 지금 미리 적어둡니다.',
    authority: 'machine_checkable',
    lineage:
      'Popper 반증가능성 + 사전등록(pre-registration) + Strotz(1955)·Laibson(1997) 시간 비일관성에 대한 돛대 원리. 유혹의 상류에서 잠기지 않으면 사후 합리화가 이긴다.',
    loadBearing: true,
    optionalForSeal: false,
  },
] as const;

const BY_ID = new Map<AxisId, AxisSpec>(AXES.map((a) => [a.id, a]));

export function axisSpec(id: AxisId): AxisSpec {
  const spec = BY_ID.get(id);
  // 조용히 undefined 를 흘리면 하위 로직이 "권한 없음"을 "권한 있음"으로 오해할 수
  // 있다. 알 수 없는 축은 크게 실패한다 (P5).
  if (!spec) throw new Error(`알 수 없는 인지 축: ${String(id)}`);
  return spec;
}

export function isKnownAxis(id: string): id is AxisId {
  return BY_ID.has(id as AxisId);
}

/** 봉인에 반드시 채워져야 하는 축들. */
export const REQUIRED_AXES: readonly AxisId[] = AXES.filter((a) => !a.optionalForSeal).map((a) => a.id);

/** 하중 축 — 이해 재진술 게이트가 걸리는 범위. */
export const LOAD_BEARING_AXES: readonly AxisId[] = AXES.filter((a) => a.loadBearing).map((a) => a.id);
