import type { FeedbackRecord, Persona, RehearsalResult } from '@/stores/types';
import { traceLocators } from '@/lib/evidence-trace';

export type StakeholderStatementKind = 'concern' | 'condition' | 'support' | 'question' | 'risk';

export interface DocumentClaimUnit {
  id: string;
  text: string;
  section?: string;
  lineStart: number;
  lineEnd: number;
  locator: string;
}

export interface StakeholderStatement {
  id: string;
  kind: StakeholderStatementKind;
  text: string;
  locator: string;
}

export interface StakeholderMatrixCell {
  personaId: string;
  claimId: string;
  statements: StakeholderStatement[];
  tone: 'challenge' | 'condition' | 'support' | 'mixed' | 'none';
}

export interface StakeholderValidationMatrix {
  claims: DocumentClaimUnit[];
  rows: Array<{
    personaId: string;
    name: string;
    role: string;
    influence: Persona['influence'];
    cells: StakeholderMatrixCell[];
    unmapped: StakeholderStatement[];
  }>;
}

const STOP = new Set([
  '그리고', '하지만', '대한', '위한', '있는', '없는', '이것', '저것', '계획', '자료', '내용', '부분', '관련',
  'with', 'that', 'this', 'from', 'your', 'plan', 'document', 'about', 'have', 'will', 'what', 'when', 'where',
]);

const clean = (value: string) => value
  .replace(/^#{1,6}\s+/, '')
  .replace(/^[-*+]\s+/, '')
  .replace(/^\d+[.)]\s+/, '')
  .replace(/[*_`>|]/g, '')
  .replace(/\s+/g, ' ')
  .trim();

function tokens(value: string): Set<string> {
  const found = value.toLowerCase().match(/[a-z]+|[0-9]+(?:\.[0-9]+)?%?|[가-힣]+/g) || [];
  const normalized = found.map((token) => /[가-힣]/.test(token)
    ? token.replace(/(으로|에서|에게|부터|까지|처럼|보다|하고|이며|이고|은|는|이|가|을|를|의|에|로|와|과|도|만)$/, '')
    : token);
  return new Set(normalized.filter((token) => token.length >= 2 && !STOP.has(token)));
}

function isRelated(claim: string, statement: string): boolean {
  const a = tokens(claim);
  const b = tokens(statement);
  const overlap = [...a].filter((token) => b.has(token));
  if (overlap.some((token) => /\d/.test(token))) return true;
  if (overlap.length >= 2) return true;
  return overlap.some((token) => token.length >= 5);
}

export function extractDocumentClaims(recordId: string, documentText: string, limit = 6): DocumentClaimUnit[] {
  const lines = (documentText || '').split(/\r?\n/);
  const blocks: Array<{ text: string; section?: string; lineStart: number; lineEnd: number }> = [];
  let section: string | undefined;
  let buffer: string[] = [];
  let start = 1;

  const flush = (lineEnd: number) => {
    const text = clean(buffer.join(' '));
    if (text.length >= 18 && !/^[-:|\s]+$/.test(text)) blocks.push({ text, section, lineStart: start, lineEnd });
    buffer = [];
  };

  lines.forEach((line, index) => {
    const lineNo = index + 1;
    if (/^#{1,6}\s+/.test(line.trim())) {
      if (buffer.length) flush(lineNo - 1);
      section = clean(line);
      return;
    }
    if (!line.trim()) {
      if (buffer.length) flush(lineNo - 1);
      return;
    }
    if (!buffer.length) start = lineNo;
    buffer.push(line);
  });
  if (buffer.length) flush(lines.length);

  return blocks.slice(0, limit).map((block, index) => ({
    id: `claim:${recordId}:${block.lineStart}:${index}`,
    ...block,
    locator: traceLocators.rehearseDocument(recordId, block.lineStart),
  }));
}

function statementsFor(recordId: string, result: RehearsalResult): StakeholderStatement[] {
  const rows: StakeholderStatement[] = [];
  const add = (kind: StakeholderStatementKind, values: string[] | undefined) => {
    (values || []).filter(Boolean).forEach((text, index) => rows.push({
      id: `${result.persona_id}:${kind}:${index}`,
      kind,
      text,
      locator: traceLocators.rehearseFeedback(recordId, result.persona_id, kind, index),
    }));
  };
  add('concern', result.concerns);
  add('condition', result.approval_conditions);
  add('support', result.praise);
  add('question', result.first_questions);
  add('risk', (result.classified_risks || []).map((risk) => risk.text));
  return rows;
}

function toneOf(statements: StakeholderStatement[]): StakeholderMatrixCell['tone'] {
  if (statements.length === 0) return 'none';
  const kinds = new Set(statements.map((statement) => statement.kind));
  if ([...kinds].some((kind) => kind === 'concern' || kind === 'risk' || kind === 'question')) {
    return kinds.has('condition') || kinds.has('support') ? 'mixed' : 'challenge';
  }
  if (kinds.has('condition')) return kinds.has('support') ? 'mixed' : 'condition';
  return 'support';
}

export function buildStakeholderValidationMatrix(record: FeedbackRecord, personas: Persona[]): StakeholderValidationMatrix {
  const claims = extractDocumentClaims(record.id, record.document_text);
  const personaById = new Map(personas.map((persona) => [persona.id, persona]));
  const rows = record.results.map((result) => {
    const persona = personaById.get(result.persona_id);
    const statements = statementsFor(record.id, result);
    const mappedIds = new Set<string>();
    const cells = claims.map((claim) => {
      const related = statements.filter((statement) => isRelated(claim.text, statement.text));
      related.forEach((statement) => mappedIds.add(statement.id));
      return { personaId: result.persona_id, claimId: claim.id, statements: related, tone: toneOf(related) };
    });
    return {
      personaId: result.persona_id,
      name: persona?.name || result.persona_id,
      role: persona?.role || '',
      influence: persona?.influence || 'medium',
      cells,
      unmapped: statements.filter((statement) => !mappedIds.has(statement.id)),
    };
  });
  return { claims, rows };
}
