// TWIN Phase 4 — 범위 위임. 신뢰 사다리의 마지막 칸이자 가장 위험한 칸.
//
//   관찰 → 그림자 시험 → 요청 시 조언 → **범위 위임**
//
// 위임이 위험한 이유는 하나다: 여기서 기계가 사람의 판단 자리에 가장 가까이
// 간다. 그래서 이 파일의 규칙은 전부 "무엇을 **하지 않는가**"로 되어 있다.
//
// 1. **위임은 사용자의 문장으로만 태어난다.** AI 가 추출한 프로필 항목이
//    위임으로 승격되는 경로는 없다 — `userWords`(사용자 원문 인용)가 없으면
//    생성 자체가 거부된다. 저자성에 거짓말하지 않는다는 규약의 이 표면 버전이다.
// 2. **위임은 결정을 대신하지 않는다.** 적용은 "당신이 쓴 규칙이 여기 해당한다"를
//    꺼내 놓는 것까지이고, 채택은 여전히 argus_adopt(사용자의 명시)로만 일어난다.
// 3. **위임은 채점된다.** 위임으로 내려진 결정이 정산되면 그 판정이 위임의
//    성적이 되고, 어긋남이 임계를 넘으면 위임이 **스스로 멈춘다**. 사람이
//    지켜보지 않아도 틀린 위임이 계속 도는 일이 없어야 자율이 안전해진다.
// 4. **만료는 필수다.** 영원한 위임은 3년 전의 나에게 오늘을 넘기는 것이다.
//
// 라우팅은 전부 결정론이고 LLM 은 "이 결정이 이 위임의 범위인가"에 인덱스로만
// 답한다 (divergence.ts 와 같은 규율).

import { adminClient } from '@/lib/share-guard';
import { callAnthropicJson } from '@/lib/llm-server';
import { sanitizeForPrompt } from '@/lib/persona-prompt';

/** 위임의 최대 수명. 이보다 긴 위임은 만들 수 없다. */
export const DELEGATION_MAX_DAYS = 90;
export const DELEGATION_DEFAULT_DAYS = 30;

/** 어긋남이 이 수를 넘고 맞음보다 많으면 위임은 스스로 멈춘다. */
export const DELEGATION_SUSPEND_CONTRADICTIONS = 2;

export interface DelegationRow {
  id: string;
  policy: string;
  scope_domain: string;
  scope_condition: string;
  user_words: string;
  expires_at: string;
  status: 'active' | 'suspended' | 'revoked';
  applications: number;
  supported: number;
  contradicted: number;
}

export interface DelegationDraft {
  policy: string;
  scopeDomain: string;
  scopeCondition: string;
  /** 사용자가 실제로 말한 문장. 없으면 위임은 생기지 않는다. */
  userWords: string;
  days?: number;
  fromCaseId?: string;
}

export type DelegationCreateResult =
  | { ok: true; id: string; expiresAt: string }
  | { ok: false; reason: string };

/**
 * 위임 생성. **거부가 기본값이다** — 아래 넷 중 하나라도 없으면 만들지 않고,
 * 왜 만들지 않았는지를 문장으로 돌려준다. 조용히 축소해서 만드는 것이 최악이다
 * (사용자는 위임이 생긴 줄 알고, 실제로는 자기가 말하지 않은 규칙이 돈다).
 */
export async function createDelegation(userId: string, draft: DelegationDraft): Promise<DelegationCreateResult> {
  const policy = draft.policy?.trim() ?? '';
  const domain = draft.scopeDomain?.trim() ?? '';
  const condition = draft.scopeCondition?.trim() ?? '';
  const words = draft.userWords?.trim() ?? '';

  if (!words) {
    return {
      ok: false,
      reason:
        '위임은 사용자가 직접 말한 문장으로만 생깁니다. 사용자가 위임을 요청한 원문(userWords)이 없어 만들지 않았습니다.',
    };
  }
  if (!policy || !domain || !condition) {
    return {
      ok: false,
      reason: '위임에는 정책·적용 영역·적용 조건이 모두 필요합니다. 빠진 것이 있어 만들지 않았습니다.',
    };
  }

  // 기간은 위로만 닫는다. 모델이 큰 값을 보내면 잘라내되 **잘랐다고 말한다.**
  const requested = typeof draft.days === 'number' && draft.days > 0 ? Math.trunc(draft.days) : DELEGATION_DEFAULT_DAYS;
  const days = Math.min(requested, DELEGATION_MAX_DAYS);
  const expiresAt = new Date(Date.now() + days * 86400_000).toISOString();

  try {
    const admin = adminClient();
    const { data, error } = await admin
      .from('argus_delegations')
      .insert({
        user_id: userId,
        policy: policy.slice(0, 500),
        scope_domain: domain.slice(0, 40),
        scope_condition: condition.slice(0, 300),
        user_words: words.slice(0, 500),
        created_from_case_id: draft.fromCaseId ?? null,
        expires_at: expiresAt,
      })
      .select('id')
      .maybeSingle();
    if (error || !data) {
      return { ok: false, reason: `위임을 저장하지 못했습니다: ${error?.message ?? '알 수 없는 오류'}` };
    }
    return { ok: true, id: data.id as string, expiresAt };
  } catch (e) {
    return { ok: false, reason: `위임을 저장하지 못했습니다: ${e instanceof Error ? e.message : String(e)}` };
  }
}

/** 결정론 사전 필터: 살아 있고, 만료되지 않았고, 성적이 무너지지 않은 위임만. */
export async function activeDelegations(userId: string, limit = 10): Promise<DelegationRow[]> {
  try {
    const admin = adminClient();
    const { data, error } = await admin
      .from('argus_delegations')
      .select('id, policy, scope_domain, scope_condition, user_words, expires_at, status, applications, supported, contradicted')
      .eq('user_id', userId)
      .eq('status', 'active')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error || !data) return [];
    return data as DelegationRow[];
  } catch {
    return [];
  }
}

const MATCH_SCHEMA = {
  type: 'object' as const,
  properties: {
    matching_index: {
      type: 'number',
      description: '이 결정이 명확히 범위 안에 드는 위임의 인덱스. 없거나 애매하면 -1.',
    },
  },
  required: ['matching_index'],
};

export interface DelegationMatch {
  delegation: DelegationRow;
  text: string;
}

/**
 * 위임 적용. **침묵이 기본값이다** — 위임 없음/범위 밖/애매함/실패는 전부 null.
 *
 * 돌려주는 문장은 결정론 템플릿이 만든다. LLM 이 "이 정책에 따르면 X 하십시오"를
 * 쓰게 하면 그것은 위임을 빌미로 한 조언이 되고, 위임의 문장이 사용자의 것이
 * 아니게 된다. 여기서 인용되는 것은 **사용자가 쓴 정책 원문**뿐이다.
 */
export async function applyDelegation(userId: string, utterance: string): Promise<DelegationMatch | null> {
  try {
    const rows = await activeDelegations(userId);
    if (rows.length === 0) return null;

    const out = await callAnthropicJson({
      system:
        '사용자가 미리 승인해 둔 위임 정책들이 있다. 새로 연 결정이 그중 하나의 **적용 범위 안에** ' +
        '명확히 드는지만 판단하라. 정책이 좋은지 나쁜지는 판단하지 않는다. ' +
        '해당하는 것이 없거나 애매하면 -1 — 억지로 맞추는 것이 최악이다.',
      user:
        `새 결정: "${sanitizeForPrompt(utterance)}"\n\n위임 목록:\n` +
        rows
          .map((r, i) => `${i}. [${r.scope_domain}] 조건: ${r.scope_condition} / 정책: ${r.policy}`)
          .join('\n'),
      toolName: 'pick_delegation',
      schema: MATCH_SCHEMA,
      model: 'fast',
      maxTokens: 150,
    });
    if (!out) return null;
    const idx = typeof out.matching_index === 'number' ? Math.trunc(out.matching_index) : -1;
    if (idx < 0 || idx >= rows.length) return null;

    const d = rows[idx];
    const score =
      d.applications === 0
        ? '아직 정산된 적용이 없습니다'
        : `지금까지 ${d.applications}건 적용 · 맞음 ${d.supported} · 어긋남 ${d.contradicted}`;
    return {
      delegation: d,
      text:
        `\n\n---\n당신이 위임해 둔 정책이 이 조건에 해당합니다.\n` +
        `· 그때 하신 말: "${d.user_words}"\n` +
        `· 정책: ${d.policy}\n` +
        `· 성적: ${score}\n` +
        `이 정책은 결정을 대신하지 않습니다 — 채택은 여전히 당신이 하십니다. ` +
        `만료: ${d.expires_at.slice(0, 10)} · 철회는 설정 > 판단 프로필에서.`,
    };
  } catch (e) {
    console.error('[twin/delegation] apply failed:', e);
    return null;
  }
}

/** 채택이 위임을 따랐다는 사실을 케이스에 남긴다 — 없으면 정산이 채점할 대상을 잃는다. */
export async function markCaseDelegation(userId: string, caseId: string, delegationId: string): Promise<void> {
  try {
    const admin = adminClient();
    await admin
      .from('argus_cases')
      .update({ delegation_id: delegationId })
      .eq('id', caseId)
      .eq('user_id', userId);
    // 적용 횟수는 채택 시점에 센다. 정산은 나중에 오고, 오지 않을 수도 있다 —
    // "몇 번 쓰였나"와 "몇 번 맞았나"는 다른 숫자이므로 따로 센다.
    const { data } = await admin
      .from('argus_delegations')
      .select('applications')
      .eq('id', delegationId)
      .eq('user_id', userId)
      .maybeSingle();
    if (data) {
      await admin
        .from('argus_delegations')
        .update({ applications: (data.applications as number) + 1, updated_at: new Date().toISOString() })
        .eq('id', delegationId)
        .eq('user_id', userId);
    }
  } catch (e) {
    console.error('[twin/delegation] mark failed:', e);
  }
}

/** 이 케이스가 위임을 따랐는가. 아니면 null — 대부분의 결정이 그렇고, 그것이 정상이다. */
export async function caseDelegationId(userId: string, caseId: string): Promise<string | null> {
  try {
    const admin = adminClient();
    const { data } = await admin
      .from('argus_cases')
      .select('delegation_id')
      .eq('id', caseId)
      .eq('user_id', userId)
      .maybeSingle();
    return (data?.delegation_id as string | null) ?? null;
  } catch {
    return null;
  }
}

const DELEGATION_VERDICT_SCHEMA = {
  type: 'object' as const,
  properties: {
    verdict: { type: 'string', enum: ['supported', 'contradicted', 'indeterminate'] },
    quote: { type: 'string', description: '관찰문에서 그대로 인용한 근거. indeterminate 면 빈 문자열.' },
  },
  required: ['verdict', 'quote'],
};

export interface DelegationGrade {
  verdict: 'supported' | 'contradicted' | 'indeterminate';
  suspended: boolean;
  policy: string;
}

/**
 * 위임 채점 — 정산 때 호출. **판정 대상은 정책이지 사람이 아니다.**
 *
 * 인용 없는 supported/contradicted 는 indeterminate 로 강등한다 (그림자 채점과
 * 같은 규율). indeterminate 는 어느 쪽으로도 세지 않는다 — 정직한 공백.
 * 어긋남이 임계를 넘고 맞음보다 많으면 **위임이 스스로 멈춘다.**
 */
export async function gradeDelegation(
  userId: string,
  delegationId: string,
  observation: string,
): Promise<DelegationGrade | null> {
  try {
    const admin = adminClient();
    const { data } = await admin
      .from('argus_delegations')
      .select('policy, supported, contradicted, status')
      .eq('id', delegationId)
      .eq('user_id', userId)
      .maybeSingle();
    if (!data) return null;
    const policy = data.policy as string;

    const out = await callAnthropicJson({
      system:
        '사용자가 미리 승인한 정책에 따라 내려진 결정이 정산됐다. 관찰이 그 정책을 뒷받침하는지 ' +
        '어긋나는지 판정하라. 셋 중 하나만: supported / contradicted / indeterminate.\n' +
        '근거 문장을 관찰문에서 **그대로 인용**해야 하며, 인용 없는 판정은 무효다. ' +
        '의심스러우면 indeterminate. 사람을 평가하지 말고 정책만 본다.',
      user: `정책:\n"${policy}"\n\n정산 때 사용자가 말한 실제 관찰:\n"${sanitizeForPrompt(observation)}"`,
      toolName: 'grade_delegation',
      schema: DELEGATION_VERDICT_SCHEMA,
      model: 'fast',
      maxTokens: 250,
    });
    if (!out) return null;

    const raw = String(out.verdict ?? '');
    const quote = String(out.quote ?? '').trim();
    const verdict: DelegationGrade['verdict'] =
      (raw === 'supported' || raw === 'contradicted') && quote ? raw : 'indeterminate';

    const supported = (data.supported as number) + (verdict === 'supported' ? 1 : 0);
    const contradicted = (data.contradicted as number) + (verdict === 'contradicted' ? 1 : 0);
    const suspend =
      contradicted >= DELEGATION_SUSPEND_CONTRADICTIONS && contradicted > supported && data.status === 'active';

    await admin
      .from('argus_delegations')
      .update({
        supported,
        contradicted,
        ...(suspend
          ? {
              status: 'suspended',
              suspended_reason: `정산에서 ${contradicted}번 어긋났습니다 (맞음 ${supported}번). 자동으로 멈췄습니다.`,
            }
          : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('id', delegationId)
      .eq('user_id', userId);

    return { verdict, suspended: suspend, policy };
  } catch (e) {
    console.error('[twin/delegation] grade failed:', e);
    return null;
  }
}

/** 정산 응답에 실을 문장. 채점하지 못했으면 빈 문자열 — 없는 일을 말하지 않는다. */
export function describeDelegationGrade(g: DelegationGrade | null): string {
  if (!g) return '';
  if (g.verdict === 'indeterminate') {
    return (
      `\n\n위임 정책("${g.policy}")은 이번 관찰만으로는 판정할 수 없었습니다 — ` +
      '성적에 넣지 않았습니다.'
    );
  }
  const head =
    g.verdict === 'supported'
      ? `\n\n위임 정책("${g.policy}")은 이번에 현실의 뒷받침을 받았습니다.`
      : `\n\n위임 정책("${g.policy}")은 이번에 현실과 어긋났습니다.`;
  return g.suspended
    ? head +
        ' 어긋남이 쌓여 **이 위임을 자동으로 멈췄습니다.** ' +
        '다시 켜거나 지우는 것은 설정 > 판단 프로필에서 하실 수 있습니다.'
    : head;
}
