// TWIN 자기 이탈 감지 — 길항 루프의 왕관.
//
// "당신의 지난 기록은 A 패턴이었는데 이번엔 B로 기울고 있습니다 — 새 정보가
// 있어서인가요?" 기준점이 기계의 의견이 아니라 **사용자 자신의 기록**이므로
// zero-judgment 형태가 유지된다.
//
// 중립성을 프롬프트에 맡기지 않는다:
// 1. **결정론 관문이 LLM 이전에 돈다** — 같은 도메인의 정산 증거가 임계(5건)
//    이상인 패턴만 후보가 된다. 미달이면 LLM 은 호출조차 되지 않는다 (침묵).
// 2. LLM 의 역할은 **어느 패턴과 충돌하는지 고르는 것뿐**이다 (인덱스 하나).
//    문장을 짓게 하면 기울기가 스민다 — 질문 문장은 아래 결정론 템플릿이 만든다.
// 3. 발화는 한 건만 — 여러 패턴이 걸려도 증거가 가장 많은 하나만 묻는다.

import { adminClient } from '@/lib/share-guard';
import { callAnthropicJson } from '@/lib/llm-server';

// 같은 도메인의 정산 증거가 이 수를 넘어야 "패턴"이라 부를 자격이 있다.
// 얇은 프로필에서 LLM 이 아무 데서나 패턴을 "발견"하는 과발화의 방지선.
export const DIVERGENCE_MIN_EVIDENCE = 5;

interface PolicyPattern {
  content: string;
  domain: string;
  evidenceIds: string[];
}

// 결정론 관문: 증거 임계를 넘는 L3 패턴만 돌려준다.
export async function qualifiedPatterns(userId: string): Promise<PolicyPattern[]> {
  try {
    const admin = adminClient();
    const { data, error } = await admin
      .from('argus_profile_items')
      .select('domain, content, evidence_case_ids')
      .eq('user_id', userId)
      .eq('status', 'active')
      .eq('layer', 'L3');
    if (error || !data) return [];

    // 도메인별 고유 증거 수를 세고, 임계를 넘는 도메인의 패턴만 남긴다.
    // ?? [] 는 방어적 읽기 규약 — 한 행이 null 이어도 나머지 유효한 행을 잃지 않는다.
    const rows = data as Array<{ domain: string; content: string; evidence_case_ids: string[] | null }>;
    const byDomain = new Map<string, Set<string>>();
    for (const r of rows) {
      const set = byDomain.get(r.domain) ?? new Set<string>();
      for (const id of r.evidence_case_ids ?? []) set.add(id);
      byDomain.set(r.domain, set);
    }
    return rows
      .filter((r) => (byDomain.get(r.domain)?.size ?? 0) >= DIVERGENCE_MIN_EVIDENCE)
      .map((r) => ({ content: r.content, domain: r.domain, evidenceIds: r.evidence_case_ids ?? [] }));
  } catch {
    return [];
  }
}

const PICK_SCHEMA = {
  type: 'object' as const,
  properties: {
    conflicting_index: {
      type: 'number',
      description: '새 기울기와 실제로 어긋나는 패턴의 인덱스. 어긋나는 것이 없으면 -1. 애매하면 -1.',
    },
  },
  required: ['conflicting_index'],
};

/**
 * 이탈 감지. 침묵이 기본값이다 — 다음 전부에서 빈 문자열을 돌려준다:
 * lean 없음 / 관문 통과 패턴 없음 / LLM 이 충돌 없음(-1) / 범위 밖 인덱스 / 실패.
 */
export async function divergenceCrux(userId: string, utterance: string, lean: string | undefined): Promise<string> {
  if (!lean) return ''; // 기울기가 없으면 이탈할 대상도 없다
  try {
    const patterns = await qualifiedPatterns(userId);
    if (patterns.length === 0) return '';

    const out = await callAnthropicJson({
      system:
        '사용자의 새 결정 기울기가 아래 패턴들(사용자 자신의 정산된 기록에서 관찰된 것) 중 ' +
        '어느 것과 실제로 어긋나는지 판단한다. 어긋남이 명확한 것 하나의 인덱스만. ' +
        '없거나 애매하면 -1 — 만들어내는 충돌이 최악이다.',
      user:
        `새 결정: "${utterance}"\n새 기울기: "${lean}"\n\n패턴:\n` +
        patterns.map((p, i) => `${i}. [${p.domain}] ${p.content}`).join('\n'),
      toolName: 'pick_conflict',
      schema: PICK_SCHEMA,
      model: 'fast',
      maxTokens: 150,
    });
    if (!out) return '';
    const idx = typeof out.conflicting_index === 'number' ? Math.trunc(out.conflicting_index) : -1;
    if (idx < 0 || idx >= patterns.length) return '';

    const p = patterns[idx];
    // 질문 문장은 여기(결정론)가 만든다 — LLM 문장이 아니므로 기울기가 스밀
    // 자리가 없고, 기준점은 항상 사용자 자신의 기록이다.
    return (
      `\n\n---\n당신의 지난 ${p.domain} 정산 ${p.evidenceIds.length}건에서는 이런 패턴이 관찰됐습니다: ` +
      `"${p.content}" (근거: ${p.evidenceIds.join(', ')})\n` +
      // 맨 중립 crux 한 문장. **양극 fork 금지**(거울 조항) — "A인가요, 아니면
      // B인가요"는 답을 둘로 가두는 형태이고, 그것도 사용자 대신 틀을 정하는
      // 것이다. 열린 질문 하나만 남긴다.
      `이번 기울기("${lean}")는 그와 다릅니다. 이번에는 무엇이 다릅니까?`
    );
  } catch (e) {
    console.error('[twin/divergence] failed:', e);
    return '';
  }
}
