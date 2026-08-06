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
  confidence: number;
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
    const confidence = (it as { confidence?: unknown }).confidence;
    if (
      (layer === 'L1' || layer === 'L2' || layer === 'L3') &&
      typeof domain === 'string' && domain.trim() &&
      typeof content === 'string' && content.trim() &&
      typeof confidence === 'number' && confidence >= 0 && confidence <= 1
    ) {
      out.push({ layer, domain: domain.trim().slice(0, 40), content: content.trim(), confidence });
    }
  }
  return out;
}

/**
 * 정산 직후 호출 (after()). 이번에 정산된 케이스 하나에서 항목 후보를 추출해
 * 검증을 통과한 것만 저장한다. 실패는 로그 — 정산 응답을 막지 않는다.
 */
export async function extractProfileFromSettlement(userId: string, facts: SettledCaseFacts): Promise<number> {
  try {
    const raw = await callAnthropicJson({
      system: buildExtractSystem(),
      user: buildExtractUser(facts),
      toolName: 'extract_profile_items',
      schema: EXTRACT_SCHEMA,
      model: PROFILE_MODEL_TIER,
      maxTokens: 600,
    });
    const candidates = parseCandidates(raw);
    if (candidates.length === 0) return 0; // 없음이 정직한 답일 수 있다

    const admin = adminClient();

    // 증거 실존 검증 — 이 케이스가 실제로 정산돼 있는가. 방금 정산했으니 참이어야
    // 정상이지만, 검증은 "정상일 것"이 아니라 사실을 본다 (fail-closed).
    const { data: settled } = await admin
      .from('argus_cases')
      .select('id, settled_at')
      .eq('id', facts.caseId)
      .eq('user_id', userId)
      .not('settled_at', 'is', null)
      .maybeSingle();
    if (!settled) {
      console.error(`[twin/profile] evidence case ${facts.caseId} is not settled — dropping ${candidates.length} items`);
      return 0;
    }

    const accepted = candidates.filter((c) => {
      if (violatesJudgmentLanguage(c.content)) {
        console.error(`[twin/profile] judgment language rejected: "${c.content.slice(0, 60)}"`);
        return false;
      }
      return true;
    });
    if (accepted.length === 0) return 0;

    const { error } = await admin.from('argus_profile_items').insert(
      accepted.map((c) => ({
        user_id: userId,
        layer: c.layer,
        domain: c.domain,
        content: c.content,
        evidence_case_ids: [facts.caseId],
        confidence: c.confidence,
        provenance: 'ai_extracted',
      })),
    );
    if (error) {
      console.error('[twin/profile] insert failed:', error.message);
      return 0;
    }
    return accepted.length;
  } catch (e) {
    console.error('[twin/profile] extraction failed:', e);
    return 0;
  }
}

/** 그림자 생성·recall 표시용 — 활성 항목을 사람이 읽는 줄로. */
export async function profileLines(userId: string, limit = 8): Promise<string[]> {
  try {
    const admin = adminClient();
    const { data, error } = await admin
      .from('argus_profile_items')
      .select('layer, domain, content, evidence_case_ids, confidence')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error || !data) return [];
    // 프로필 내용은 사용자 발화에서 추출된 것이므로 **사용자 데이터**다. 이것이
    // 그대로 system 프롬프트에 이어붙으면 주입 표면이 된다 — 리포 규약대로
    // sanitizeForPrompt 를 통과시키고 <user-data> 로 감싼다.
    // 배열 fallback(?? []) 은 방어적 읽기 규약 (스키마상 not null 이지만
    // Supabase 응답을 믿고 dereference 하면 한 행 때문에 전체가 죽는다).
    return (
      data as Array<{ layer: string; domain: string; content: string; evidence_case_ids: string[] | null }>
    ).map(
      (r) =>
        `[${r.layer}·${r.domain}] <user-data>${sanitizeForPrompt(r.content ?? '')}</user-data> ` +
        `(근거: ${(r.evidence_case_ids ?? []).join(', ')})`,
    );
  } catch {
    return [];
  }
}
