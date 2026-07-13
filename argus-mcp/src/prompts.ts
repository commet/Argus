import { disciplineFor, type DisciplineLocale } from './lib/discipline.js';
import { resolveArgusDirForResource } from './lib/argus-dir.js';
import { resolveToday } from './lib/resolve-today.js';
import { replayLedger, bearingContracts } from './lib/ledger-replay.js';
import { duePremises, groupDuePremises } from './lib/premises.js';
import { detectLocaleFromText } from './lib/locale.js';
import { surfaceLocale } from './lib/surfaces.js';

/**
 * MCP Prompts (blueprint §4.2). The discipline shipped as user-triggered
 * rituals instead of a pasted system prompt. /argus-settle reads the due
 * contracts at GetPrompt time and bakes them into the message so the model
 * settles against the real ledger.
 */
export const PROMPTS = [
  { name: 'argus-bind', title: 'Argus: 결정 묶기 · Bind', description: '진짜 갈림길 확인 → 중립 질문 하나 → 반증 가능한 예측 봉인 · Fire-gate → one neutral question → seal a falsifiable prediction.', arguments: [{ name: 'decision', description: '검토할 결정 · The decision you are facing.', required: false }] },
  { name: 'argus-settle', title: 'Argus: 현실과 정산 · Settle', description: '확인일이 된 결정을 실제 결과와 대조 · Check due decisions against what actually happened.', arguments: [] },
  { name: 'argus-reframe', title: 'Argus: 질문 재구성 · Reframe', description: 'AI에게 묻기 전 숨은 전제를 드러냄 · Surface hidden assumptions before asking the AI.', arguments: [{ name: 'question', description: '다듬을 질문이나 문제 · The question or problem to sharpen.', required: false }] },
  { name: 'argus-review', title: 'Argus: 문서 검수 · Review', description: '원문 근거에 연결해 문서의 판단 위험을 검수 · Review judgment risk anchored to the source.', arguments: [{ name: 'file_path', description: '검수할 .md/.txt 경로(선택) · Path to a .md/.txt document (optional).', required: false }] },
] as const;

export function listPrompts() {
  return { prompts: PROMPTS.map((p) => ({ name: p.name, title: p.title, description: p.description, arguments: p.arguments })) };
}

/** Prompts are no longer part of the advertised product surface. Keep
 * prompts/get compatibility for hosts that cached an old prompt, while new
 * clients discover the purpose-led tools instead. */
export function listPublicPrompts() {
  return { prompts: [] };
}

function userText(text: string) {
  return { role: 'user' as const, content: { type: 'text' as const, text } };
}

function promptLocale(text?: string, dir?: string | null): DisciplineLocale {
  return detectLocaleFromText(text) ?? surfaceLocale(dir);
}

export function getPrompt(name: string, args: Record<string, string> | undefined): { description: string; messages: Array<{ role: 'user'; content: { type: 'text'; text: string } }> } {
  if (name === 'argus-bind') {
    const decision = args?.['decision'];
    const locale = promptLocale(decision);
    return {
      description: locale === 'ko' ? 'Argus 결정 묶기' : 'Argus bind ritual',
      messages: [userText(disciplineFor('bind', locale) + (decision ? `\n\n${locale === 'ko' ? '결정' : 'The decision'}: ${decision}` : ''))],
    };
  }

  if (name === 'argus-reframe') {
    const question = args?.['question'];
    const locale = promptLocale(question);
    return {
      description: locale === 'ko' ? 'Argus 질문 재구성' : 'Argus reframe lens',
      messages: [userText(disciplineFor('reframe', locale) + (question ? `\n\n${locale === 'ko' ? '질문' : 'The question'}: ${question}` : ''))],
    };
  }

  if (name === 'argus-review') {
    const filePath = args?.['file_path'];
    const locale = promptLocale(filePath);
    return {
      description: locale === 'ko' ? 'Argus 문서 검수' : 'Argus review ritual',
      messages: [userText(disciplineFor('review', locale) + (filePath ? `\n\n${locale === 'ko' ? '문서' : 'The document'}: ${filePath}` : ''))],
    };
  }

  if (name === 'argus-settle') {
    const dir = resolveArgusDirForResource();
    const locale = promptLocale(undefined, dir);
    let context = '';
    if (dir) {
      const today = resolveToday({});
      const l = replayLedger(dir, today);
      const seeds = bearingContracts(dir, today, l);
      const due = [
        ...l.overdue.map((c) => ({ id: c.id, predicate: c.text, check_by: c.date })),
        ...seeds.filter((s) => !l.contracts.has(s.id)).map((s) => ({ id: s.id, predicate: s.predicate, check_by: s.check_by })),
      ];
      context = due.length
        ? (locale === 'ko' ? '\n\n지금 확인할 결정:\n' : '\n\nDue now:\n')
          + due.map((d) => `- [${d.id}] "${d.predicate}" (${locale === 'ko' ? '확인일' : 'check-by'} ${d.check_by})`).join('\n')
        : (locale === 'ko' ? '\n\n지금 확인할 결정은 없습니다.' : '\n\nNothing is due right now.');

      // Living premises (plan v5 §0.6-U2): the settle ritual also covers the
      // facts open decisions rest on — the recheck choreography lives HERE:
      // research the current fact, then record it with provenance.
      const premGroups = groupDuePremises(duePremises(l));
      if (premGroups.length > 0) {
        context += (locale === 'ko'
          ? '\n\n현실과 다시 확인할 전제 — 각각 현재 사실을 조사하거나 사용자에게 물은 뒤, finding과 출처(url | user_stated | host_reported)를 argus_recheck에 전달하세요. 수치 사실이면 numeric_value도 명시하세요:\n'
          : '\n\nPremises due for a reality re-check — for each: research the CURRENT fact (a web search, or ask the user), then call argus_recheck with the finding, an explicit numeric_value when the fact is a number, and its source (url | user_stated | host_reported):\n')
          + premGroups.slice(0, 5).map((g) => `- "${g.text}" — ${locale === 'ko' ? '연결된 결정' : 'under'}: ${g.premises.map((p) => `[${p.decision_id}] P${p.ordinal}`).join(', ')}${g.premises.length > 1 ? (locale === 'ko' ? ' (같은 사실 — apply_to_matching으로 한 번에 재확인)' : ' (one fact — re-check once with apply_to_matching)') : ''}`).join('\n');
      }
    }
    return { description: locale === 'ko' ? 'Argus 현실 정산' : 'Argus settle ritual', messages: [userText(disciplineFor('settle', locale) + context)] };
  }

  return { description: 'unknown prompt', messages: [userText(`Unknown prompt: ${name}`)] };
}
