/**
 * Renders a Judgment Receipt as shareable markdown (design doc §"receipt export
 * markdown"). Same object powers the webapp view and the MCP output, so this is
 * the single text projection. It shows findings + obligations + the neutral
 * heading — never an AI verdict on the decision.
 */

import { type JudgmentReceipt } from './schema';

export function receiptToMarkdown(r: JudgmentReceipt): string {
  const L: string[] = [];
  L.push(`# Judgment Receipt — ${r.source_title}`);
  L.push('');
  L.push(`- 상태: ${r.state} · 검수 가능성: ${r.reviewability.score}/100`);
  L.push(`- 문서 유형: ${r.profile.document_type} · 이해관계: ${r.profile.stakes}`);
  // Coverage travels with the shared receipt — a partial review must never read
  // as a full one, even when copied out of the app.
  if (r.coverage && r.coverage.band !== 'full' && r.coverage.notes.length) {
    L.push(`- 검수 범위: ${r.coverage.notes.join(' ')}`);
  }
  L.push('');
  L.push('## 핵심 판단');
  L.push(r.core_question || '(핵심 질문 미검출)');
  L.push('');

  if (r.judgment_obligations.length) {
    L.push('## 사람이 직접 판단해야 할 것');
    r.judgment_obligations.forEach((o, i) => {
      L.push(`${i + 1}. ${o.statement}`);
      if (o.why_human) L.push(`   - 왜 사람인가: ${o.why_human}`);
      if (o.evidence_needed) L.push(`   - 확인할 근거: ${o.evidence_needed}`);
    });
    L.push('');
  }

  const top = r.findings.slice(0, 5);
  if (top.length) {
    L.push('## 주요 발견');
    top.forEach((f) => {
      L.push(`- [${f.severity}] ${f.title}${anchorHint(f.anchors)}`);
      if (f.suggested_action) L.push(`  - 확인: ${f.suggested_action}`);
    });
    L.push('');
  }

  if (r.hidden_assumptions.length) {
    L.push('## 그대로 진행하면 위험한 가정');
    r.hidden_assumptions.slice(0, 3).forEach((a) => {
      L.push(`- ${a.text}${a.if_false ? ` → 틀리면: ${a.if_false}` : ''}`);
    });
    L.push('');
  }

  if (r.falsifiable_followups.length) {
    L.push('## 현실이 답할 후속 예측');
    r.falsifiable_followups.forEach((f) => {
      L.push(`- ${f.predicate} (확인일 ${f.check_by})`);
      if (f.pass_condition) L.push(`  - 맞음: ${f.pass_condition}`);
      if (f.fail_condition) L.push(`  - 틀림: ${f.fail_condition}`);
    });
    L.push('');
  }

  L.push('---');
  L.push(`적용 렌즈: ${r.routing.selected.join(', ')}`);
  L.push('AI는 이 결정을 대신 판단하지 않았습니다. 판단은 당신의 몫입니다.');
  return L.join('\n');
}

function anchorHint(anchors: JudgmentReceipt['findings'][number]['anchors']): string {
  const a = anchors[0];
  if (!a) return '';
  if (a.slide !== undefined) return ` (slide ${a.slide})`;
  if (a.section_path?.length) return ` (${a.section_path.join(' › ')})`;
  if (a.line_start !== undefined) return ` (L${a.line_start})`;
  return '';
}
