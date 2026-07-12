// ━━━ 사주 해석기: ssaju 출력 → 성격 특성 텍스트 ━━━
// ssaju의 toCompact() 결과를 LLM에 넘기기 위한 요약 + 핵심 특성 추출

// ssaju는 ESM/CJS 모두 지원. 서버사이드에서만 사용.
// 클라이언트에서는 API를 통해 해석 결과를 받음.

export interface SajuInput {
  year: number;
  month: number;
  day: number;
  hour?: number;
  minute?: number;
  gender: '남' | '여';
}

export interface SajuProfile {
  /** ssaju toCompact() 원문 (LLM 프롬프트에 직접 삽입) */
  raw: string;
  /** 일간 (Day Master) — 핵심 성격 */
  dayMaster: string;
  /** 강약 점수 */
  strength: string;
  /** 격국 */
  structure: string;
  /** 용신 */
  useful: string;
  /** 요약 한 줄 (UI 표시용) */
  summary: string;
}

// 일간별 성격 키워드 (간략)
const DAY_MASTER_TRAITS: Record<string, string> = {
  '甲': '곧은 소나무 — 정직하고 강직, 리더십 있으나 융통성 부족',
  '乙': '넝쿨 풀 — 유연하고 적응력 높음, 부드럽지만 끈질김',
  '丙': '태양 — 밝고 열정적, 카리스마 있으나 자기중심적일 수 있음',
  '丁': '촛불 — 섬세하고 따뜻, 내면의 열정이 강하나 예민함',
  '戊': '큰 산 — 듬직하고 신뢰감, 느리지만 확실한 판단',
  '己': '논밭 — 포용력 넓고 실용적, 겉은 부드럽고 속은 단단',
  '庚': '강철 — 단호하고 결단력 있음, 의리 있으나 거침없음',
  '辛': '보석 — 예민하고 완벽주의, 고집 있으나 섬세한 감각',
  '壬': '큰 강 — 지혜롭고 자유분방, 대범하나 변덕스러울 수 있음',
  '癸': '이슬비 — 직관적이고 감수성 풍부, 조용하지만 깊은 사고',
};

/**
 * ssaju 결과를 파싱해서 핵심 정보 추출.
 * ssaju 패키지가 설치되어 있어야 동작.
 */
export async function interpretSaju(input: SajuInput): Promise<SajuProfile> {
  const { calculateSaju } = await import('ssaju');

  const result = calculateSaju({
    year: input.year,
    month: input.month,
    day: input.day,
    hour: input.hour,
    minute: input.minute,
    gender: input.gender,
  });

  const raw = result.toCompact();

  // 기본 정보 파싱 (첫 줄에서 추출)
  const basicLine = raw.split('\n').find(l => l.includes('일간')) || '';
  const dayMasterMatch = basicLine.match(/일간\s+([甲乙丙丁戊己庚辛壬癸])/);
  const strengthMatch = basicLine.match(/강약:\s*(강|약)\((\d+)\)/);
  const structureMatch = basicLine.match(/격:\s*(\S+)/);
  const usefulMatch = basicLine.match(/용신:\s*([^,\n]+)/);

  const dayMasterChar = dayMasterMatch?.[1] || '';
  const dayMasterTrait = DAY_MASTER_TRAITS[dayMasterChar] || '';

  const strength = strengthMatch ? `${strengthMatch[1]}(${strengthMatch[2]})` : '보통';
  const structure = structureMatch?.[1] || '';
  const useful = usefulMatch?.[1]?.trim() || '';

  const summary = dayMasterChar
    ? `일간 ${dayMasterChar} (${dayMasterTrait.split(' — ')[0]}) · ${strength} · ${structure}`
    : '사주 정보 분석 완료';

  return {
    raw,
    dayMaster: dayMasterChar ? `${dayMasterChar} — ${dayMasterTrait}` : '',
    strength,
    structure,
    useful,
    summary,
  };
}

// ━━━ 오행 (Five Elements) ━━━

export type FiveElement = '木' | '火' | '土' | '金' | '水';

export interface ElementInfo {
  element: FiveElement;
  color: string;       // CSS color
  glow: string;        // glow shadow
  stem: string;        // 천간 한자
  stemName: string;    // 천간 한글
  nature: string;      // 자연물 비유
  trait: string;       // 성격 한 줄
  emoji: string;
}

const STEM_TO_ELEMENT: Record<string, ElementInfo> = {
  '甲': { element: '木', color: '#2d8a4e', glow: 'rgba(45,138,78,0.3)', stem: '甲', stemName: '갑목', nature: '곧은 소나무', trait: '정직하고 강직한 리더', emoji: '🌲' },
  '乙': { element: '木', color: '#4caf7a', glow: 'rgba(76,175,122,0.3)', stem: '乙', stemName: '을목', nature: '넝쿨 풀', trait: '유연하고 끈질긴 적응력', emoji: '🌿' },
  '丙': { element: '火', color: '#e53935', glow: 'rgba(229,57,53,0.3)', stem: '丙', stemName: '병화', nature: '태양', trait: '밝고 열정적인 카리스마', emoji: '☀️' },
  '丁': { element: '火', color: '#ff7043', glow: 'rgba(255,112,67,0.3)', stem: '丁', stemName: '정화', nature: '촛불', trait: '섬세하고 따뜻한 내면의 열정', emoji: '🕯️' },
  '戊': { element: '土', color: '#c17d24', glow: 'rgba(193,125,36,0.3)', stem: '戊', stemName: '무토', nature: '큰 산', trait: '듬직하고 신뢰감 있는 판단', emoji: '⛰️' },
  '己': { element: '土', color: '#d4a24c', glow: 'rgba(212,162,76,0.3)', stem: '己', stemName: '기토', nature: '논밭', trait: '포용력 넓고 실용적인 실력자', emoji: '🌾' },
  '庚': { element: '金', color: '#78909c', glow: 'rgba(120,144,156,0.3)', stem: '庚', stemName: '경금', nature: '강철', trait: '단호하고 결단력 있는 의리파', emoji: '⚔️' },
  '辛': { element: '金', color: '#b0bec5', glow: 'rgba(176,190,197,0.3)', stem: '辛', stemName: '신금', nature: '보석', trait: '예민하고 완벽주의적 감각파', emoji: '💎' },
  '壬': { element: '水', color: '#1e88e5', glow: 'rgba(30,136,229,0.3)', stem: '壬', stemName: '임수', nature: '큰 강', trait: '지혜롭고 자유분방한 대범함', emoji: '🌊' },
  '癸': { element: '水', color: '#5c9fd4', glow: 'rgba(92,159,212,0.3)', stem: '癸', stemName: '계수', nature: '이슬비', trait: '직관적이고 깊은 사고의 감수성', emoji: '🌧️' },
};

const STEMS_BY_YEAR = ['庚', '辛', '壬', '癸', '甲', '乙', '丙', '丁', '戊', '己'];

/**
 * 클라이언트용: 연도 끝자리로 천간/오행 즉시 조회.
 * 실시간 UI 프리뷰에 사용 (서버 호출 없음).
 */
export function getYearElement(year: number): ElementInfo | null {
  if (year < 1940 || year > 2010) return null;
  const stem = STEMS_BY_YEAR[year % 10];
  return STEM_TO_ELEMENT[stem] || null;
}

/**
 * 클라이언트용: 사주 정보 없이 간단한 생년월일 기반 요약만 생성.
 */
export function getQuickSajuLabel(year: number, month: number, day: number): string {
  const stems = ['庚', '辛', '壬', '癸', '甲', '乙', '丙', '丁', '戊', '己'];
  const stem = stems[year % 10];
  const trait = DAY_MASTER_TRAITS[stem];
  if (!trait) return `${year}.${month}.${day}생`;
  return `${year}년생 · ${trait.split(' — ')[0]}의 기운`;
}

// ━━━ 띠 (12지지) ━━━

export interface ZodiacAnimalInfo {
  animal: string;
  emoji: string;
  trait: string;       // 팀장으로서의 특성
}

const ZODIAC_ANIMALS: ZodiacAnimalInfo[] = [
  { animal: '원숭이', emoji: '🐵', trait: '재치 있고 임기응변에 강함. 눈치 빠르지만 가끔 꼼수' },
  { animal: '닭', emoji: '🐔', trait: '시간 관리 철저, 디테일 집착. 지적은 정확하지만 날카로움' },
  { animal: '개', emoji: '🐶', trait: '의리파, 팀 충성도 높음. 신뢰하면 끝까지 가지만 배신에 냉정' },
  { animal: '돼지', emoji: '🐷', trait: '너그럽고 여유로움. 평소엔 관대하지만 선 넘으면 폭발' },
  { animal: '쥐', emoji: '🐭', trait: '눈치 빠르고 정치적. 정보 수집력 최고, 생존 본능 강함' },
  { animal: '소', emoji: '🐮', trait: '묵묵히 밀어붙이는 실행가. 느리지만 확실, 고집이 장단점' },
  { animal: '호랑이', emoji: '🐯', trait: '카리스마 직진형. 결단 빠르고 추진력 강하지만 독단적' },
  { animal: '토끼', emoji: '🐰', trait: '부드럽지만 은근 독함. 갈등 회피하면서도 원하는 건 얻어냄' },
  { animal: '용', emoji: '🐲', trait: '자신감 폭발, 큰 그림 좋아함. 스케일 크지만 디테일 놓침' },
  { animal: '뱀', emoji: '🐍', trait: '조용히 관찰하다 핵심 찌름. 직관 예리하고 전략적' },
  { animal: '말', emoji: '🐴', trait: '에너지 넘치고 행동파. 열정적이지만 지구력 부족할 때' },
  { animal: '양', emoji: '🐑', trait: '온화하고 팀 분위기 중시. 배려 깊지만 결정 장애 가능' },
];

export function getZodiacAnimal(year: number): ZodiacAnimalInfo | null {
  if (year < 1940 || year > 2010) return null;
  return ZODIAC_ANIMALS[year % 12];
}

// ━━━ 별자리 (12 Zodiac Signs) ━━━

export interface ZodiacSignInfo {
  sign: string;
  emoji: string;
  trait: string;       // 팀장으로서의 특성
}

const ZODIAC_SIGNS: ZodiacSignInfo[] = [
  { sign: '염소자리', emoji: '♑', trait: '목표 지향적, 체계적. 성과로 증명해야 인정' },
  { sign: '물병자리', emoji: '♒', trait: '독창적 사고, 틀 깨기 좋아함. 관습적 보고서 싫어함' },
  { sign: '물고기자리', emoji: '♓', trait: '감수성 풍부, 분위기 읽음. 논리보다 느낌으로 판단' },
  { sign: '양자리', emoji: '♈', trait: '추진력 강하고 즉흥적. 빠른 결정, 긴 회의 싫어함' },
  { sign: '황소자리', emoji: '♉', trait: '안정 지향, 실용주의. 검증된 방법 선호, 급한 변화 거부' },
  { sign: '쌍둥이자리', emoji: '♊', trait: '다재다능, 대화 좋아함. 아이디어 많지만 산만할 수' },
  { sign: '게자리', emoji: '♋', trait: '팀 보호 본능, 감정 세심. 충성도 높지만 서운하면 오래감' },
  { sign: '사자자리', emoji: '♌', trait: '무대 체질, 인정욕 강함. 칭찬에 약하고 무시에 불같음' },
  { sign: '처녀자리', emoji: '♍', trait: '완벽주의, 분석적. 디테일 귀신이지만 칭찬에 인색' },
  { sign: '천칭자리', emoji: '♎', trait: '균형 추구, 공정함 중시. 갈등 싫어하고 합의 선호' },
  { sign: '전갈자리', emoji: '♏', trait: '통찰력 날카롭고 깊음. 신뢰하면 전폭 지원, 아니면 냉정' },
  { sign: '사수자리', emoji: '♐', trait: '낙관적 비전가, 자유로움. 큰 방향은 잘 잡지만 관리 싫어함' },
];

export function getZodiacSign(month: number): ZodiacSignInfo | null {
  if (month < 1 || month > 12) return null;
  return ZODIAC_SIGNS[month - 1];
}

// ━━━ 연월주 경량 프로필 (day 없이) ━━━

/**
 * 월주 천간 계산: 연도 천간에 따라 월주 천간이 결정됨.
 * 갑/기년 → 병인월 시작, 을/경년 → 무인월 시작 등.
 */
const MONTH_STEM_START: Record<string, number> = {
  '甲': 2, '己': 2, // 병(2)부터
  '乙': 4, '庚': 4, // 무(4)부터
  '丙': 6, '辛': 6, // 경(6)부터
  '丁': 8, '壬': 8, // 임(8)부터
  '戊': 0, '癸': 0, // 갑(0)부터
};

const TEN_STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const TWELVE_BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

export interface YearMonthProfile {
  // 연주
  yearStem: string;
  yearBranch: string;
  yearElement: ElementInfo;
  animal: ZodiacAnimalInfo;
  // 월주 (month가 있을 때만)
  monthStem?: string;
  monthBranch?: string;
  monthElement?: ElementInfo;
  zodiacSign?: ZodiacSignInfo;
  // 성격 요약
  summary: string;
  traits: string[];
}

/**
 * 연도 + 월(선택)로 연월주 기반 성격 프로필 생성.
 * 사주 체계를 따르되 일주/시주 없이도 유의미한 해석.
 */
export function buildYearMonthProfile(year: number, month?: number): YearMonthProfile | null {
  const yearElement = getYearElement(year);
  const animal = getZodiacAnimal(year);
  if (!yearElement || !animal) return null;

  const yearStem = STEMS_BY_YEAR[year % 10];
  const yearBranch = TWELVE_BRANCHES[year % 12];

  const traits: string[] = [
    yearElement.trait,
    animal.trait,
  ];

  let monthStem: string | undefined;
  let monthBranch: string | undefined;
  let monthElement: ElementInfo | undefined;
  let zodiacSign: ZodiacSignInfo | undefined;

  if (month && month >= 1 && month <= 12) {
    // 월주 천간 계산
    const startIdx = MONTH_STEM_START[yearStem] ?? 0;
    // 인월(1월=寅)부터 시작 → month를 지지에 매핑
    const monthBranchIdx = (month + 1) % 12; // 1월=寅(2), 2월=卯(3), ...
    monthBranch = TWELVE_BRANCHES[monthBranchIdx];
    const monthStemIdx = (startIdx + month - 1) % 10;
    monthStem = TEN_STEMS[monthStemIdx];
    monthElement = STEM_TO_ELEMENT[monthStem] || undefined;

    zodiacSign = getZodiacSign(month) || undefined;

    if (monthElement) {
      traits.push(monthElement.trait);
    }
    if (zodiacSign) {
      traits.push(zodiacSign.trait);
    }
  }

  // 요약 생성
  const parts = [`${year}년생 ${animal.emoji}${animal.animal}띠`];
  if (yearElement) parts.push(`${yearElement.nature}(${yearElement.element})`);
  if (zodiacSign) parts.push(`${zodiacSign.emoji} ${zodiacSign.sign}`);

  return {
    yearStem,
    yearBranch,
    yearElement,
    animal,
    monthStem,
    monthBranch,
    monthElement,
    zodiacSign,
    summary: parts.join(' · '),
    traits,
  };
}
