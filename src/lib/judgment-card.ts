import type { DecisionContract, Predicate } from '@/stores/types';

/**
 * 판단 카드 — 봉인된 판단 하나를 그림 한 장으로.
 *
 * ── 이 파일이 존재하는 이유보다, **무엇을 하지 않는지가 더 중요하다** ──────────
 *
 * 결과물 이미지는 홍보에 제일 센 수단이지만, 동시에 이 제품이 가장 크게 배신할 수
 * 있는 자리다. 그럴듯한 AI 요약을 예쁜 카드에 얹으면 (a) 척추를 어긴 평결이
 * 사용자 것처럼 유통되고 (b) 남들 눈엔 다른 AI 제품 스크린샷과 구별되지 않는다.
 * 둘 다 손해다.
 *
 * 그래서 이 모듈의 계약은 딱 하나다:
 *
 *   **카드에 찍히는 모든 글자는 이미 저장된 필드를 그대로 옮긴 것이거나,
 *     이 파일 안에 고정된 문구다. 카드를 위해 생성되는 문장은 없다.**
 *
 * 구체적으로 금지하는 것:
 *   · LLM 호출 — 이 모듈과 렌더러는 네트워크를 쓰지 않는다 (테스트가 감시).
 *   · 분석 요약 — "Argus가 본 핵심" 류를 얹지 않는다. 그건 AI 말이고,
 *     카드는 서명되지 않은 채 남의 손에 들어간다.
 *   · 점수·등급·평결 — 사용자가 어떤 사람인지에 대한 판정은 카드에 없다
 *     (CLAUDE.md 스파인 2항).
 *   · 빈칸 메우기 — 봉인 문장이 없으면 카드를 **아예 만들지 않는다**(null).
 *     없는 걸 그럴듯하게 채우느니 없다고 말하는 쪽이 낫다.
 *
 * 반대로 **반드시 넣는 것**:
 *   · 봉인 문장(sealed_statement) — 사용자가 확정 버튼으로 승인한 바로 그 한 줄.
 *   · 확인일 — 이 제품의 유일무이한 물건. "결과는 그날 안다"는 사실 자체가
 *     다른 어떤 AI 결과물 스크린샷과도 다르게 생겼다. 이게 홍보력의 근원이지
 *     디자인이 아니다.
 *   · 출처 표기 — 그 문장을 사람이 썼는지 기계가 짚은 걸 그대로 뒀는지.
 *     이건 옵션이 아니다. 기계 문장을 사람 문장처럼 유통시키는 건 이 제품이
 *     제일 하면 안 되는 거짓말이다 (CLAUDE.md 스파인 1항).
 */

/** 카드에 찍히는 값 전부. 여기 없는 것은 카드에 못 나온다 — 그게 요점이다. */
export interface JudgmentCardData {
  /** 사용자가 확정한 봉인 문장. 카드의 본문이자, 없으면 카드가 없는 필수 필드. */
  statement: string;
  /** 봉인한 날 (YYYY-MM-DD). */
  sealedOn: string;
  /** 결과를 확인하기로 한 날 (YYYY-MM-DD). 없을 수 있다 — 증인 모드(날짜 없는 기록). */
  checkOn: string | null;
  /**
   * 봉인 문장의 출처.
   *   'user'        — 사람이 직접 쓰거나 자기 말로 고쳐 적었다
   *   'ai_surfaced' — 기계가 짚은 문장을 고치지 않고 그대로 뒀다
   *   'unknown'     — 기록이 없다 (옛 계약). 사람 것으로 **추정하지 않는다**.
   */
  authorship: 'user' | 'ai_surfaced' | 'unknown';
  /** 사용자가 처음 적은 상황 한 줄. 없으면 생략 — 지어내지 않는다. */
  context: string | null;
}

/** 하나의 화면 문구도 여기 밖에서 만들어지지 않는다. */
export const CARD_STRINGS = {
  ko: {
    sealedOn: (d: string) => `${d}, 이렇게 판단했다`,
    checkOn: (d: string) => `결과는 ${d}에 안다`,
    noCheck: '결과를 언제 볼지는 정하지 않았다',
    byUser: '내가 쓴 문장',
    byAi: 'AI가 짚은 문장을 그대로 뒀음',
    byUnknown: '누가 쓴 문장인지 기록이 없음',
  },
  en: {
    sealedOn: (d: string) => `Judged on ${d}`,
    checkOn: (d: string) => `The answer arrives ${d}`,
    noCheck: 'No date was set to look back',
    byUser: 'Written by me',
    byAi: "Kept the AI's sentence as-is",
    byUnknown: 'No record of who wrote this',
  },
} as const;

/** ISO 타임스탬프 → YYYY-MM-DD. 못 읽으면 null (추측하지 않는다). */
function ymd(iso: string | undefined | null): string | null {
  if (!iso || typeof iso !== 'string') return null;
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

/**
 * 봉인 문장의 출처를 읽는다.
 *
 * 지배 베팅 술어(governing bet)의 `attribution.wording_source` 가 정본이고,
 * 없으면 레거시 호환 비트인 `authored` 를 본다. **둘 다 없으면 'unknown'** —
 * 옛 기록을 사람 것으로 승격시키지 않는다. 브리지에서 predicate_owner 가 유실돼
 * 확인되지 않은 초안이 사용자 문장과 구별 없이 도착했던 사례(2026-07-28)와 같은
 * 실수를 카드에서 반복하지 않기 위해서다.
 */
export function readAuthorship(
  predicates: Predicate[] | undefined,
  statement?: string,
): JudgmentCardData['authorship'] {
  const list = predicates ?? [];
  // **그 문장의 출처**를 읽어야 한다. 봉인 문장은 여러 곳에서 올 수 있고
  // (사용자 기울기 · 지배 베팅 · 첫 술어 · 원문), 라벨이 다른 술어의 출처를
  // 읽으면 "내가 쓴 문장"이 AI 문장 위에 붙는다 — 이 카드가 절대 하면 안 되는
  // 단 하나의 거짓말이 정확히 그것이다. 그래서 텍스트가 일치하는 술어를 먼저 찾고,
  // 못 찾으면 지배 베팅으로 물러나고, 그것도 없으면 'unknown' 이다.
  const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
  const target = statement ? norm(statement) : null;
  const bet = (target ? list.find((p) => typeof p.text === 'string' && norm(p.text) === target) : undefined)
    ?? list.find((p) => p.source === 'governing_idea' || p.attribution || p.authored);
  if (!bet) return 'unknown';
  const w = bet.attribution?.wording_source;
  if (w === 'user_direct' || w === 'user_reworded') return 'user';
  if (w === 'ai_surfaced') return 'ai_surfaced';
  if (w === 'imported' || w === 'legacy_unknown') return 'unknown';
  if (bet.authored === 'user') return 'user';
  if (bet.authored === 'ai_surfaced') return 'ai_surfaced';
  return 'unknown';
}

/**
 * 카드를 만들 수 있으면 데이터를, 못 만들면 **null** 을 준다.
 *
 * null 을 주는 경우가 이 함수의 절반이다: 봉인 문장이 없으면 카드는 없다.
 * 호출부는 null 일 때 버튼 자체를 렌더하지 않아야 한다 — 눌렀는데 빈 카드가
 * 나오는 것보다 버튼이 없는 게 정직하다.
 */
export function buildJudgmentCard(
  contract: DecisionContract | null | undefined,
  projectName: string | null | undefined,
): JudgmentCardData | null {
  if (!contract) return null;

  const statement = typeof contract.sealed_statement === 'string'
    ? contract.sealed_statement.trim()
    : '';
  // 본문이 없으면 카드가 없다. 프로젝트 이름이나 AI 요약으로 **대신 채우지 않는다** —
  // 그 순간 카드는 "내가 판단한 문장"이 아니라 "누가 썼는지 모를 문장"이 된다.
  if (!statement) return null;

  const sealedOn = ymd(contract.provenance?.sealed_at) ?? ymd(contract.created_at);
  if (!sealedOn) return null;

  const rawContext = typeof contract.origin_utterance === 'string' && contract.origin_utterance.trim()
    ? contract.origin_utterance.trim()
    : (typeof projectName === 'string' ? projectName.trim() : '');

  return {
    statement,
    sealedOn,
    checkOn: ymd(contract.check_in_at),
    authorship: readAuthorship(contract.predicates, statement),
    // 상황 줄이 봉인 문장과 같으면 두 번 찍지 않는다 (같은 사실의 두 번째 사본).
    context: rawContext && rawContext !== statement ? rawContext : null,
  };
}
