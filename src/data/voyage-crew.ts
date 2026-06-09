/**
 * Voyage data — 5 crew divisions + 5 stages of work.
 *
 * The page metaphors the journey of a project as an Odyssey-era voyage:
 *   Captain (the user) sets the heading.
 *   Five divisions of crew handle the rest.
 *   Five stages of work move the ship from brief → Ithaca.
 *
 * `stationOrder` controls the visual order of divisions in the Cutaway —
 * forward-of-ship first (Scouts at the bow), aft-of-ship last (Navigator
 * at the helm). Watch sits up in the crow's nest above all decks.
 */

export type DivisionId = 'scouts' | 'cartographers' | 'artisans' | 'watch' | 'navigator';

export type CrewDivision = {
  id: DivisionId;
  label: { ko: string; en: string };
  /** Single-sentence purpose, deliberately punchy — shown in the cutaway station card. */
  role: { ko: string; en: string };
  /** Literal job in plain words — kills the metaphor decode-tax for skeptical first-timers. */
  functionLabel: { ko: string; en: string };
  /** Where they sit on the ship — copy-only, used in the station label. */
  stationLabel: { ko: string; en: string };
  /** Member count is the visible signal; individual names live underneath if expanded. */
  members: { name: string; personaRole: { ko: string; en: string } }[];
};

export const CREW_DIVISIONS: CrewDivision[] = [
  {
    id: 'scouts',
    label: { ko: '탐색조', en: 'Scouts' },
    role: {
      ko: '먼저 바다로 나가 낯선 해역의 정보를 가져온다',
      en: 'Sail ahead, read the unknown waters',
    },
    functionLabel: { ko: '리서치 — 시장·경쟁·선례 조사', en: 'Research — market, rivals, precedent' },
    stationLabel: { ko: '선수 난간', en: 'Forward railing' },
    members: [
      { name: '하윤', personaRole: { ko: '리서치 인턴', en: 'Research intern' } },
      { name: '다은', personaRole: { ko: '리서치 애널리스트', en: 'Research analyst' } },
      { name: '도윤', personaRole: { ko: '리서치 디렉터', en: 'Research director' } },
    ],
  },
  {
    id: 'cartographers',
    label: { ko: '제도사', en: 'Cartographers' },
    role: {
      ko: '해도를 그리고 어디로 갈지를 정한다',
      en: 'Chart the course, set the heading',
    },
    functionLabel: { ko: '전략 — 방향 설정·우선순위', en: 'Strategy — direction & priorities' },
    stationLabel: { ko: '메인마스트 아래 해도 테이블', en: 'Chart table, under the mainmast' },
    members: [
      { name: '정민', personaRole: { ko: '전략 주니어', en: 'Strategy junior' } },
      { name: '현우', personaRole: { ko: '전략 구루', en: 'Strategy lead' } },
      { name: '승현', personaRole: { ko: '수석 전략가', en: 'Chief strategist' } },
    ],
  },
  {
    id: 'artisans',
    label: { ko: '장인들', en: 'Artisans' },
    role: {
      ko: '각자의 손기술로 항해의 실물을 만든다',
      en: 'Build the voyage with their own hands',
    },
    functionLabel: {
      ko: '실무 — 카피·재무·마케팅·기술 작성',
      en: 'Execution — copy, finance, marketing, build',
    },
    stationLabel: { ko: '메인 갑판', en: 'Main deck' },
    members: [
      { name: '서연', personaRole: { ko: '카피라이터', en: 'Copywriter' } },
      { name: '규민', personaRole: { ko: '숫자 분석가', en: 'Numbers' } },
      { name: '혜연', personaRole: { ko: '재무 전문가', en: 'Finance' } },
      { name: '민서', personaRole: { ko: '마케팅 전략가', en: 'Marketing' } },
      { name: '수진', personaRole: { ko: '조직·문화 전문가', en: 'People & culture' } },
      { name: '준서', personaRole: { ko: '기술 설계자', en: 'Engineering' } },
      { name: '예린', personaRole: { ko: '프로젝트 매니저', en: 'PM' } },
    ],
  },
  {
    id: 'watch',
    label: { ko: '망루', en: 'The Watch' },
    role: {
      ko: '수평선 너머의 위험을 먼저 본다',
      en: 'Spot danger before anyone else does',
    },
    functionLabel: { ko: '리스크 — 허점·UX·법규 사전 검토', en: 'Risk — flaws, UX & compliance, up front' },
    stationLabel: { ko: "까마귀 둥지 (crow's nest)", en: "Crow's nest" },
    members: [
      { name: '동혁', personaRole: { ko: '리스크 검토자', en: 'Risk reviewer' } },
      { name: '지은', personaRole: { ko: 'UX 설계자', en: 'UX designer' } },
      { name: '윤석', personaRole: { ko: '법률·규정 검토자', en: 'Legal & compliance' } },
    ],
  },
  {
    id: 'navigator',
    label: { ko: '일등 항해사', en: 'First Mate' },
    role: {
      ko: '모든 선원의 목소리를 하나로 묶어 선장에게 전한다',
      en: 'Binds every voice into one for the captain',
    },
    functionLabel: { ko: '종합 — 모든 의견을 하나로 묶음', en: 'Synthesis — binds every voice into one' },
    stationLabel: { ko: '조타륜 옆', en: 'Beside the helm' },
    members: [
      { name: '일등 항해사', personaRole: { ko: '종합 검토자', en: 'First mate' } },
    ],
  },
];

export type StageId = 'brief' | 'draft' | 'review' | 'refinement' | 'synthesis';

export type Stage = {
  id: StageId;
  label: { ko: string; en: string };
  subtitle: { ko: string; en: string };
};

export const STAGES: Stage[] = [
  {
    id: 'brief',
    label: { ko: 'Brief', en: 'Brief' },
    subtitle: { ko: '선장이 받은 지시', en: "The captain's orders" },
  },
  {
    id: 'draft',
    label: { ko: 'Draft', en: 'Draft' },
    subtitle: { ko: '첫 해도가 그려진다', en: 'The first chart is drawn' },
  },
  {
    id: 'review',
    label: { ko: 'Review', en: 'Review' },
    subtitle: { ko: '선원 회의', en: 'Crew council' },
  },
  {
    id: 'refinement',
    label: { ko: 'Refinement', en: 'Refinement' },
    subtitle: { ko: '항로를 다시 잡는다', en: 'Course corrected' },
  },
  {
    id: 'synthesis',
    label: { ko: 'Synthesis', en: 'Synthesis' },
    subtitle: { ko: '이타카가 보인다', en: 'Ithaca in sight' },
  },
];

export const TOTAL_CREW = CREW_DIVISIONS.reduce((sum, d) => sum + d.members.length, 0);
