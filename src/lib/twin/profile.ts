// TWIN 판단 프로필 — 추출·검증·조회.
//
// 프로필은 파인튜닝이 아니라 **검사·수정·회수 가능한 항목**이다. LLM 은 후보를
// 낼 뿐이고, 저장 여부는 여기 있는 결정론 검증이 정한다:
// 1. 증거 링크 실존 — 항목의 근거 케이스가 실제로 정산돼 있어야 한다
// 2. 판정 언어 린트 — 사용자에 대한 정체성 판정 문장은 프로필이 될 수 없다
//    (zero-judgment: 프로필은 관찰된 패턴이지 사람에 대한 진단이 아니다)
// 검증에 걸린 항목은 조용히 고쳐지지 않고 **버려지며 로그를 남긴다.**

import { adminClient } from '@/lib/share-guard';
import { callAnthropicJson } from '@/lib/llm-server';
import { sanitizeForPrompt } from '@/lib/persona-prompt';
import { buildExtractSystem, buildExtractUser, EXTRACT_SCHEMA, type SettledCaseFacts } from './prompts';

const PROFILE_MODEL_TIER = 'default' as const;

/**
 * 프로필의 확신도는 **계산값이다.** LLM 이 매긴 숫자가 아니다.
 *
 * 이유가 이 파일의 핵심이다. 추출 때 모델이 "확신도 0.8"이라 적으면 그 숫자는
 * 이후 무슨 일이 일어나도 0.8 로 남는다 — 현실이 세 번 반대로 답해도 그대로다.
 * 그것은 학습이 아니라 첫인상의 화석화이고, "그럴듯함이 맞음으로 위장"하는
 * 형태 그 자체다 (LLM-glue 불변식). 그래서 확신도는 근거와 반례의 **개수**에서만
 * 나온다 — Laplace 평활(+1/+2)을 쓰므로 근거 1건짜리 항목이 1.0 을 갖지 못한다.
 *
 *   근거 1 / 반례 0 → 0.67    근거 5 / 반례 0 → 0.86
 *   근거 3 / 반례 1 → 0.67    근거 2 / 반례 3 → 0.43
 */
export function deriveConfidence(support: number, counter: number): number {
  return (support + 1) / (support + counter + 2);
}

// 반례가 근거를 넘어서면 그 항목은 더 이상 이 사람의 패턴이 아니다. 조용히
// 두면 분신이 틀린 규칙 위에서 계속 생각한다 — 은퇴시키고, 다시 관찰되면
// 새 항목으로 돌아온다 (지운 것이 아니라 물러난 것이므로 기록은 남는다).
export const RETIRE_CONFIDENCE = 0.5;
const RETIRE_MIN_COUNTEREXAMPLES = 2;

// 마지막 보강에서 이만큼 지나면 항목은 만료된다. 사람은 변하고, 2년 전 채용
// 기준으로 오늘의 나를 예측하면 그것은 분신이 아니라 유령이다. 만료는 삭제가
// 아니다 — 다시 관찰되면 보강으로 되살아난다.
const PROFILE_TTL_DAYS = 180;

function ttlFromNow(): string {
  return new Date(Date.now() + PROFILE_TTL_DAYS * 86400_000).toISOString();
}

// 정체성 판정 언어 — 프로필에 존재할 수 없는 형태. 목록은 보수적으로 시작한다
// (과차단보다 과통과가 더 위험한 표면이므로 발견되는 대로 추가).
const JUDGMENT_LANGUAGE = [
  /점수/, /등급/, /유형이다/, /타입이다/, /성향이 (있|강하)/,
  /한 사람이다/, /스타일이다/, /능력이 (부족|뛰어나)/,
];

export function violatesJudgmentLanguage(content: string): boolean {
  return JUDGMENT_LANGUAGE.some((re) => re.test(content));
}

interface CandidateItem {
  layer: 'L1' | 'L2' | 'L3';
  domain: string;
  content: string;
}

function parseCandidates(raw: unknown): CandidateItem[] {
  if (!raw || typeof raw !== 'object') return [];
  const items = (raw as { items?: unknown }).items;
  if (!Array.isArray(items)) return [];
  const out: CandidateItem[] = [];
  for (const it of items.slice(0, 3)) {
    const layer = (it as { layer?: unknown }).layer;
    const domain = (it as { domain?: unknown }).domain;
    const content = (it as { content?: unknown }).content;
    if (
      (layer === 'L1' || layer === 'L2' || layer === 'L3') &&
      typeof domain === 'string' && domain.trim() &&
      typeof content === 'string' && content.trim()
    ) {
      out.push({ layer, domain: domain.trim().slice(0, 40), content: content.trim() });
    }
  }
  return out;
}

/**
 * 모델이 돌려준 번호 목록을 **기존 항목 배열의 유효 인덱스**로만 좁힌다.
 * 범위 밖·정수 아님·중복은 버린다. 그리고 reinforces 와 contradicts 양쪽에
 * 동시에 등장한 번호는 **양쪽에서 다 뺀다** — 모델이 스스로 모순된 답을 낸
 * 것이므로 어느 쪽으로도 세지 않는 것이 정직하다 (indeterminate 와 같은 규율).
 */
export function resolveIndexFeedback(
  raw: unknown,
  existingCount: number,
): { reinforces: number[]; contradicts: number[] } {
  const pick = (key: 'reinforces' | 'contradicts'): number[] => {
    const arr = (raw as Record<string, unknown> | null)?.[key];
    if (!Array.isArray(arr)) return [];
    return [
      ...new Set(
        arr
          .filter((n): n is number => typeof n === 'number' && Number.isInteger(n))
          .filter((n) => n >= 0 && n < existingCount),
      ),
    ];
  };
  const reinforces = pick('reinforces');
  const contradicts = pick('contradicts');
  const both = new Set(reinforces.filter((n) => contradicts.includes(n)));
  return {
    reinforces: reinforces.filter((n) => !both.has(n)),
    contradicts: contradicts.filter((n) => !both.has(n)),
  };
}

interface ProfileRow {
  id: string;
  layer: string;
  domain: string;
  content: string;
  evidence_case_ids: string[] | null;
  counterexamples: string[] | null;
}

/** 정산 한 건이 프로필에 무엇을 했는가 — 호출부가 사용자에게 그대로 옮긴다. */
export interface ProfileUpdate {
  inserted: number;
  reinforced: number;
  contradicted: number;
  retired: number;
}

const NO_PROFILE_CHANGE: ProfileUpdate = { inserted: 0, reinforced: 0, contradicted: 0, retired: 0 };

/**
 * 정산 직후 호출 (after()). 이번에 정산된 케이스 하나를 **기존 프로필에 비추어**
 * 읽고 셋을 한다: 새 관찰 저장 · 기존 항목 보강 · 반례 등록(필요하면 은퇴).
 * 실패는 로그 — 정산 응답을 막지 않는다.
 *
 * 라우팅은 전부 여기(결정론)에 있고 LLM 은 번호만 돌려준다. 모델에게 "이 항목을
 * 은퇴시켜라"를 시키면 은퇴 기준이 매 호출 달라진다 — 기준은 상수여야 한다.
 */
export async function extractProfileFromSettlement(
  userId: string,
  facts: SettledCaseFacts,
): Promise<ProfileUpdate> {
  const result: ProfileUpdate = { ...NO_PROFILE_CHANGE };
  try {
    const admin = adminClient();

    // 기존 활성 항목 — 모델이 번호로 참조할 대상. 만료된 것은 보여 주지 않는다
    // (만료 항목을 보강 후보로 내면 유령이 되살아난다).
    const { data: existingRaw } = await admin
      .from('argus_profile_items')
      .select('id, layer, domain, content, evidence_case_ids, counterexamples')
      .eq('user_id', userId)
      .eq('status', 'active')
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .order('updated_at', { ascending: false })
      .limit(20);
    const existing = (existingRaw ?? []) as ProfileRow[];

    const raw = await callAnthropicJson({
      system: buildExtractSystem(),
      user: buildExtractUser(
        facts,
        existing.map((r) => `[${r.layer}·${r.domain}] ${r.content}`),
      ),
      toolName: 'extract_profile_items',
      schema: EXTRACT_SCHEMA,
      model: PROFILE_MODEL_TIER,
      maxTokens: 600,
    });
    // 시도 표식은 **모델이 답한 순간** 찍는다. 결과가 0건인 것은 흔한 정상
    // 결과이므로(없음이 정직한 답일 수 있다) 그것을 미시도로 남겨 두면 크론
    // 백스톱이 같은 케이스를 48시간 동안 매시간 다시 집는다. 반대로 LLM 호출
    // 자체가 실패한 경로(위의 조기 반환)에는 표식이 없어 백스톱이 그것만 집는다.
    if (!raw) return result;
    await markProfileExtracted(userId, facts.caseId);

    const candidates = parseCandidates(raw);
    const { reinforces, contradicts } = resolveIndexFeedback(raw, existing.length);
    if (candidates.length === 0 && reinforces.length === 0 && contradicts.length === 0) return result;

    // 증거 실존 검증 — 이 케이스가 실제로 정산돼 있는가. 방금 정산했으니 참이어야
    // 정상이지만, 검증은 "정상일 것"이 아니라 사실을 본다 (fail-closed).
    // 보강·반례도 이 증거를 근거로 쓰므로 셋 다 여기에 걸린다.
    const { data: settled } = await admin
      .from('argus_cases')
      .select('id, settled_at')
      .eq('id', facts.caseId)
      .eq('user_id', userId)
      .not('settled_at', 'is', null)
      .maybeSingle();
    if (!settled) {
      console.error(`[twin/profile] evidence case ${facts.caseId} is not settled — dropping all profile changes`);
      return result;
    }

    // ── 기존 항목 갱신 ──────────────────────────────────────────────────
    for (const idx of reinforces) {
      const row = existing[idx];
      const evidence = row.evidence_case_ids ?? [];
      if (evidence.includes(facts.caseId)) continue; // 같은 케이스로 두 번 세지 않는다
      const next = [...evidence, facts.caseId];
      const { error } = await admin
        .from('argus_profile_items')
        .update({
          evidence_case_ids: next,
          confidence: deriveConfidence(next.length, (row.counterexamples ?? []).length),
          expires_at: ttlFromNow(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.id)
        .eq('user_id', userId);
      if (error) console.error('[twin/profile] reinforce failed:', error.message);
      else result.reinforced += 1;
    }

    for (const idx of contradicts) {
      const row = existing[idx];
      const counters = row.counterexamples ?? [];
      if (counters.includes(facts.caseId)) continue;
      const next = [...counters, facts.caseId];
      const support = (row.evidence_case_ids ?? []).length;
      const confidence = deriveConfidence(support, next.length);
      // 은퇴 판정은 상수 둘로만 — 반례가 임계 이상이고 확신도가 무너졌을 때.
      const retire = next.length >= RETIRE_MIN_COUNTEREXAMPLES && confidence < RETIRE_CONFIDENCE;
      const { error } = await admin
        .from('argus_profile_items')
        .update({
          counterexamples: next,
          confidence,
          ...(retire ? { status: 'retired' } : {}),
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.id)
        .eq('user_id', userId);
      if (error) console.error('[twin/profile] counterexample failed:', error.message);
      else {
        result.contradicted += 1;
        if (retire) result.retired += 1;
      }
    }

    // ── 새 항목 ─────────────────────────────────────────────────────────
    const accepted = candidates.filter((c) => {
      if (violatesJudgmentLanguage(c.content)) {
        console.error(`[twin/profile] judgment language rejected: "${c.content.slice(0, 60)}"`);
        return false;
      }
      return true;
    });
    if (accepted.length > 0) {
      const { error } = await admin.from('argus_profile_items').insert(
        accepted.map((c) => ({
          user_id: userId,
          layer: c.layer,
          domain: c.domain,
          content: c.content,
          evidence_case_ids: [facts.caseId],
          confidence: deriveConfidence(1, 0),
          expires_at: ttlFromNow(),
          provenance: 'ai_extracted',
        })),
      );
      if (error) console.error('[twin/profile] insert failed:', error.message);
      else result.inserted = accepted.length;
    }
    return result;
  } catch (e) {
    console.error('[twin/profile] extraction failed:', e);
    return result;
  }
}

/** 그림자 생성·recall 표시용 — 활성 항목을 사람이 읽는 줄로. */
export async function profileLines(userId: string, limit = 8): Promise<string[]> {
  try {
    const admin = adminClient();
    const { data, error } = await admin
      .from('argus_profile_items')
      .select('layer, domain, content, evidence_case_ids, counterexamples, confidence')
      .eq('user_id', userId)
      .eq('status', 'active')
      // 만료된 항목은 분신의 입력에서 빠진다 — 오래된 관찰로 오늘의 나를
      // 예측하면 그것은 분신이 아니라 유령이다.
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      // 근거가 많은 것부터. 최신순으로 자르면 근거 5건짜리 패턴이 방금 만들어진
      // 1건짜리에 밀려 프롬프트 밖으로 나간다.
      .order('confidence', { ascending: false })
      .limit(limit);
    if (error || !data) return [];
    // 프로필 내용은 사용자 발화에서 추출된 것이므로 **사용자 데이터**다. 이것이
    // 그대로 system 프롬프트에 이어붙으면 주입 표면이 된다 — 리포 규약대로
    // sanitizeForPrompt 를 통과시키고 <user-data> 로 감싼다.
    // 배열 fallback(?? []) 은 방어적 읽기 규약 (스키마상 not null 이지만
    // Supabase 응답을 믿고 dereference 하면 한 행 때문에 전체가 죽는다).
    return (
      data as Array<{
        layer: string;
        domain: string;
        content: string;
        evidence_case_ids: string[] | null;
        counterexamples: string[] | null;
      }>
    ).map((r) => {
      // 반례 수도 함께 싣는다. 반례가 있는 패턴을 근거만 보여 주고 주입하면
      // 분신이 이미 흔들린 규칙을 굳은 규칙으로 읽는다.
      const counters = (r.counterexamples ?? []).length;
      return (
        `[${r.layer}·${r.domain}] <user-data>${sanitizeForPrompt(r.content ?? '')}</user-data> ` +
        `(근거: ${(r.evidence_case_ids ?? []).join(', ')}${counters > 0 ? ` · 반례 ${counters}건` : ''})`
      );
    });
  } catch {
    return [];
  }
}

/**
 * 최근 물러난 관찰 — recall 표시용.
 *
 * 왜 이것을 사용자에게 보이는가: 프로필이 "편집 가능한 거울"이려면 거울이
 * **스스로 취소한 것**도 보여야 한다. 조용히 은퇴시키면 사용자가 아는 것은
 * "언젠가 있던 항목이 사라졌다"뿐이고, 그것은 기계가 몰래 자기 기록을 고치는
 * 형태다. 반대로 은퇴 사실을 말하면 그 자리에서 이의를 제기할 수 있다.
 */
export async function recentlyRetiredLines(userId: string, days = 30, limit = 3): Promise<string[]> {
  try {
    const admin = adminClient();
    const since = new Date(Date.now() - days * 86400_000).toISOString();
    const { data, error } = await admin
      .from('argus_profile_items')
      .select('layer, domain, content, evidence_case_ids, counterexamples')
      .eq('user_id', userId)
      .eq('status', 'retired')
      .gte('updated_at', since)
      .order('updated_at', { ascending: false })
      .limit(limit);
    if (error || !data) return [];
    return (
      data as Array<{
        layer: string;
        domain: string;
        content: string;
        evidence_case_ids: string[] | null;
        counterexamples: string[] | null;
      }>
    ).map(
      (r) =>
        `[${r.layer}·${r.domain}] <user-data>${sanitizeForPrompt(r.content ?? '')}</user-data> ` +
        `— 반례 ${(r.counterexamples ?? []).length}건으로 물러남 (근거였던 정산: ${(r.evidence_case_ids ?? []).join(', ')})`,
    );
  } catch {
    return [];
  }
}

/**
 * 추출 **시도** 표식. 결과가 0건이어도 찍는다 — "없음"은 정상 결과이고, 그것을
 * 미시도로 오인하면 백스톱이 같은 케이스를 48시간 동안 매시간 다시 집는다.
 * 표식 쓰기 실패는 삼킨다: 최악의 결과가 "한 번 더 시도"이므로 fail-open 이 맞다.
 */
async function markProfileExtracted(userId: string, caseId: string): Promise<void> {
  try {
    const admin = adminClient();
    const { error } = await admin
      .from('argus_cases')
      .update({ profile_extracted_at: new Date().toISOString() })
      .eq('id', caseId)
      .eq('user_id', userId);
    if (error) console.error('[twin/profile] mark failed:', error.message);
  } catch (e) {
    console.error('[twin/profile] mark threw:', e);
  }
}

/**
 * 백스톱 후보: 정산은 됐는데 추출을 시도한 적이 없는 케이스.
 *
 * 왜 필요한가 — 추출은 `after()` 안에서 돈다. 서버리스에서 그 경로가 죽으면
 * 사용자에게는 아무 표시도 나지 않고, 정산은 됐는데 분신만 배우지 못한 상태가
 * 영구히 남는다. 그림자에는 이미 같은 성격의 백스톱이 있다 (recentCasesMissingShadows).
 */
export async function settledCasesMissingProfile(
  hours = 48,
  limit = 10,
): Promise<Array<{ userId: string; facts: SettledCaseFacts }>> {
  try {
    const admin = adminClient();
    const since = new Date(Date.now() - hours * 3600 * 1000).toISOString();
    const { data, error } = await admin
      .from('argus_cases')
      .select('id, user_id, title, choice, last_observation, recall_gap')
      .not('settled_at', 'is', null)
      .gte('settled_at', since)
      .is('profile_extracted_at', null)
      .limit(limit);
    if (error || !data) return [];

    return (
      data as Array<{
        id: string;
        user_id: string;
        title: string | null;
        choice: string | null;
        last_observation: string | null;
        recall_gap: string | null;
      }>
    )
      // 관찰이 없으면 추출할 재료가 없다 — 지어내지 않고 건너뛴다.
      .filter((c) => c.last_observation)
      .map((c) => ({
        userId: c.user_id,
        facts: {
          caseId: c.id,
          question: c.title ?? c.id,
          choice: c.choice ?? '',
          // 원장에만 있는 값이다. 백스톱은 케이스 행만 보므로 **비운다** —
          // 지어내는 것보다 적은 입력으로 추출하는 편이 정직하다.
          statedReasons: [],
          observation: c.last_observation ?? '',
          recall: c.recall_gap ?? '',
        },
      }));
  } catch {
    return [];
  }
}
