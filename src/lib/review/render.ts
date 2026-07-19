/**
 * Renders a Judgment Receipt as shareable markdown. The same object powers the
 * webapp view and the MCP output, so this is the single text projection. It
 * shows findings + obligations + the neutral heading, never an AI verdict on
 * the decision.
 */

import { type JudgmentReceipt } from './schema';

export function receiptToMarkdown(r: JudgmentReceipt): string {
  if (isJudgmentMirror(r) || !r.reviewability || !r.profile || !r.routing) {
    return judgmentMirrorToMarkdown(r);
  }

  const lines: string[] = [];
  lines.push(`# Judgment Receipt -- ${r.source_title}`);
  lines.push('');
  lines.push(`- 상태: ${r.state} · 검토 가능성: ${r.reviewability.score}/100`);
  lines.push(`- 문서 유형: ${r.profile.document_type} · 이해관계: ${r.profile.stakes}`);

  if (r.coverage && r.coverage.band !== 'full' && r.coverage.notes.length) {
    lines.push(`- 검토 범위: ${r.coverage.notes.join(' ')}`);
  }

  lines.push('');
  lines.push('## 핵심 판단');
  lines.push(r.core_question || '(핵심 질문 미기록)');
  lines.push('');

  if (r.current_heading) {
    lines.push('## 현재 읽히는 방향');
    lines.push(r.current_heading);
    lines.push('');
  }

  if (r.judgment_obligations.length) {
    lines.push('## 사람이 직접 판단해야 할 것');
    r.judgment_obligations.forEach((o, i) => {
      lines.push(`${i + 1}. ${o.statement}`);
      if (o.why_human) lines.push(`   - 왜 사람인가: ${o.why_human}`);
      if (o.evidence_needed) lines.push(`   - 확인할 근거: ${o.evidence_needed}`);
    });
    lines.push('');
  }

  const top = r.findings.slice(0, 5);
  if (top.length) {
    lines.push('## 주요 발견');
    top.forEach((f) => {
      lines.push(`- [${f.severity}] ${f.title}${anchorHint(f.anchors)}`);
      if (f.detail) lines.push(`  - ${f.detail}`);
      if (f.suggested_action) lines.push(`  - 확인: ${f.suggested_action}`);
    });
    lines.push('');
  }

  if (r.hidden_assumptions.length) {
    lines.push('## 그대로 진행하면 위험한 가정');
    r.hidden_assumptions.slice(0, 3).forEach((a) => {
      lines.push(`- ${a.text}${a.if_false ? ` · 틀리면: ${a.if_false}` : ''}`);
    });
    lines.push('');
  }

  if (r.falsifiable_followups.length) {
    lines.push('## 현실이 답할 후속 예측');
    r.falsifiable_followups.forEach((f) => {
      lines.push(`- ${f.predicate} (확인일 ${f.check_by})`);
      if (f.pass_condition) lines.push(`  - 맞음: ${f.pass_condition}`);
      if (f.fail_condition) lines.push(`  - 틀림: ${f.fail_condition}`);
      if (f.lean) lines.push(`  - 그때의 내 판단: ${f.lean}`);
      if (f.settled_at) {
        lines.push(`  - 정산: ${f.outcome || 'recorded'}${f.what_happened ? ` -- ${f.what_happened}` : ''}`);
      }
    });
    lines.push('');
  }

  lines.push('---');
  lines.push(`적용 렌즈: ${r.routing.selected.join(', ')}`);
  lines.push('AI는 이 결정을 대신 판단하지 않습니다. 판단은 당신의 몫입니다.');
  return lines.join('\n');
}

function isJudgmentMirror(r: JudgmentReceipt): boolean {
  return r.kind === 'judgment' || r.root_mode === 'judgment';
}

function judgmentMirrorToMarkdown(r: JudgmentReceipt): string {
  const lines: string[] = [];
  lines.push(`# Judgment Receipt -- ${r.source_title}`);
  lines.push('');
  lines.push(`- State: ${r.state}`);
  lines.push('- AI verdict: none');
  lines.push('');
  lines.push('## Sealed judgment');
  lines.push(r.core_question || '(no question recorded)');
  lines.push('');

  if (r.judgment_obligations.length) {
    lines.push('## Human-owned judgment');
    r.judgment_obligations.forEach((o, i) => {
      lines.push(`${i + 1}. ${o.statement}`);
    });
    lines.push('');
  }

  if (r.falsifiable_followups.length) {
    lines.push('## Reality check');
    r.falsifiable_followups.forEach((f) => {
      lines.push(`- ${f.predicate} (check by ${f.check_by})`);
      if (f.pass_condition) lines.push(`  - Pass: ${f.pass_condition}`);
      if (f.fail_condition) lines.push(`  - Fail: ${f.fail_condition}`);
    });
    lines.push('');
  }

  lines.push('---');
  lines.push('This is a user-sealed judgment mirror, not a document review.');
  return lines.join('\n');
}

function anchorHint(anchors: JudgmentReceipt['findings'][number]['anchors']): string {
  const a = anchors[0];
  if (!a) return '';
  if (a.slide !== undefined) return ` (slide ${a.slide})`;
  if (a.section_path?.length) return ` (${a.section_path.join(' > ')})`;
  if (a.line_start !== undefined) return ` (L${a.line_start})`;
  return '';
}
