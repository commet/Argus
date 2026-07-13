/**
 * DKK v6 P1 — 지저분한 현실 corpus.
 *
 * 이 파일은 제품 fixture가 아니라 의미론의 입력 계약이다. P2 reducer, P3 adapter,
 * P4 MCP surface는 각 case의 required/forbidden/expected projection을 만족해야 한다.
 * 사례를 통과시키기 위해 새 타입을 늘릴 때는 v6 §4.3의 네 열 규율과 ADR가 필요하다.
 */

export type ExpectedLifecycle =
  | 'proposal'
  | 'sealed'
  | 'due'
  | 'resolved_answered'
  | 'resolved_indeterminate'
  | 'resolved_moot'
  | 'withdrawn'
  | 'superseded'
  | 'conflict'
  | 'erased'
  | 'invalid_or_unknown';

export type CorpusCategory =
  | 'temporality'
  | 'authority'
  | 'resolution'
  | 'ambiguity'
  | 'incompleteness'
  | 'relationships'
  | 'legacy'
  | 'synchronization'
  | 'erasure'
  | 'surface';

export interface MessyCorpusCase {
  id: string;
  category: CorpusCategory;
  title: string;
  narrative: string;
  named: readonly string[];
  intentionallyUnnamed: readonly string[];
  allowedLoss: string;
  required: readonly string[];
  forbidden: readonly string[];
  expectedLifecycle: ExpectedLifecycle;
  expectedResolution?: 'answered' | 'indeterminate' | 'moot';
  expectedCriterionResult?: 'met' | 'not_met' | 'partial' | 'not_applicable';
  asOfExcludes?: readonly string[];
  confirmationActions: number;
}

const c = (
  id: string,
  category: CorpusCategory,
  title: string,
  narrative: string,
  expectedLifecycle: ExpectedLifecycle,
  required: readonly string[],
  forbidden: readonly string[],
  extras: Partial<Omit<MessyCorpusCase, 'id' | 'category' | 'title' | 'narrative' | 'expectedLifecycle' | 'required' | 'forbidden'>> = {},
): MessyCorpusCase => ({
  id,
  category,
  title,
  narrative,
  expectedLifecycle,
  required,
  forbidden,
  named: extras.named ?? [],
  intentionallyUnnamed: extras.intentionallyUnnamed ?? [],
  allowedLoss: extras.allowedLoss ?? 'none',
  confirmationActions: extras.confirmationActions ?? 0,
  ...(extras.expectedResolution ? { expectedResolution: extras.expectedResolution } : {}),
  ...(extras.expectedCriterionResult ? { expectedCriterionResult: extras.expectedCriterionResult } : {}),
  ...(extras.asOfExcludes ? { asOfExcludes: extras.asOfExcludes } : {}),
});

export const MESSY_CORPUS: readonly MessyCorpusCase[] = [
  c(
    'C01-retrospective-seal',
    'temporality',
    '회고 봉인은 당시 봉인이 아니다',
    '사용자가 오늘 “지난달에 이미 채용을 보류하기로 했다”고 기록한다.',
    'sealed',
    ['occurred_at may be last month', 'recorded_at and authorized_at are today', 'temporal_mode is retrospective'],
    ['past contemporaneous projection includes the new seal', 'recorded_at is rewritten to last month'],
    { named: ['past decision'], asOfExcludes: ['retrospective judgment'] , confirmationActions: 1 },
  ),
  c(
    'C02-tentative-without-return',
    'ambiguity',
    '반쯤 결정했지만 돌아올 약속은 없다',
    '사용자는 가격 인상을 고민하지만 판단으로 봉인하거나 다시 볼 약속을 하고 싶지 않다.',
    'proposal',
    ['proposal or work item remains available', 'no due item is created'],
    ['AI seals a judgment', 'system invents a return date'],
    { intentionallyUnnamed: ['why the user is hesitant'] },
  ),
  c(
    'C03-vague-statement',
    'ambiguity',
    '의도적으로 모호한 판단문',
    '사용자는 “조금 더 신중하게 가겠다”는 판단을 특정 기준 없이 봉인한다.',
    'sealed',
    ['non-empty statement', 'explicit authority', 'return contract', 'specification_status may be open'],
    ['quality verdict', 'forced rewrite', 'AI-created criterion'],
    { confirmationActions: 1 },
  ),
  c(
    'C04-vague-review-question',
    'ambiguity',
    '모호한 돌아보기 질문',
    '사용자는 “그때 가서 괜찮았는지 보자”를 review question으로 남긴다.',
    'sealed',
    ['review question is preserved verbatim', 'return date or trigger exists'],
    ['system labels it bad', 'criterion is fabricated'],
    { confirmationActions: 1 },
  ),
  c(
    'C05-indeterminate-evidence-never-arrives',
    'resolution',
    '증거가 끝내 오지 않는다',
    '외부 감사 결과가 약속일 이후에도 공개되지 않아 판단을 답할 수 없다.',
    'resolved_indeterminate',
    ['resolution kind indeterminate', 'non-empty reason', 'authorized closure'],
    ['still_pending is terminal', 'answered is fabricated'],
    { expectedResolution: 'indeterminate', intentionallyUnnamed: ['why the audit was delayed'], confirmationActions: 1 },
  ),
  c(
    'C06-moot-goal-shift',
    'resolution',
    '목표가 사라져 질문이 소멸한다',
    '회사가 제품을 종료해 기존 가격 실험의 질문이 더는 적용되지 않는다.',
    'resolved_moot',
    ['resolution kind moot', 'reason names changed target', 'authorized closure'],
    ['moot is rendered as failure', 'AI closes without authority'],
    { expectedResolution: 'moot', confirmationActions: 1 },
  ),
  c(
    'C07-observation-without-judgment',
    'incompleteness',
    '판단 없이 일어난 관찰',
    '호스트가 전환율 하락을 보고하지만 관련 봉인 판단은 없다.',
    'proposal',
    ['observation may be recorded', 'gap remains visible'],
    ['system fabricates a prior judgment', 'observation becomes a closure'],
    { named: ['conversion observation'], intentionallyUnnamed: ['whether a decision should have existed'] },
  ),
  c(
    'C08-private-premise-silence',
    'incompleteness',
    '사적인 이유는 말하지 않는다',
    '사용자는 이직 판단을 봉인하지만 가족 사정이라는 이유는 기록하지 않는다.',
    'sealed',
    ['judgment and return contract are valid without premise', 'blank premise stays blank'],
    ['prompting as a required gate', 'AI invents a premise'],
    { intentionallyUnnamed: ['private family reason'], confirmationActions: 1 },
  ),
  c(
    'C09-changed-mind-preserves-past',
    'temporality',
    '현재 입장이 과거 판단과 다르다',
    '사용자는 이전에는 보류를 지지했지만 지금은 추진을 지지한다.',
    'superseded',
    ['old judgment remains readable', 'new judgment has a new seal', 'supersedes relation is explicit'],
    ['old statement is overwritten', 'current opinion is backfilled as old premise'],
    { confirmationActions: 2 },
  ),
  c(
    'C10-intertwined-judgments',
    'relationships',
    '서로 얽힌 두 판단',
    '채용 판단과 가격 판단은 같은 runway premise에 기대지만 처음에는 분리되어 기록된다.',
    'sealed',
    ['two independent judgments', 'relationship may be proposed later'],
    ['forced decomposition at capture', 'AI relation is committed without adoption'],
    { named: ['hiring judgment', 'pricing judgment', 'runway premise'], confirmationActions: 2 },
  ),
  c(
    'C11-ai-partial-adoption',
    'authority',
    'AI 초안의 일부만 채택',
    'AI가 statement, premise, criterion 세 개를 제안하고 사용자는 statement만 수정해 채택한다.',
    'sealed',
    ['user-authored final statement', 'AI proposal provenance remains', 'unadopted premise is not committed'],
    ['AI premise is auto-adopted', 'authorship is upgraded to human'],
    { confirmationActions: 1 },
  ),
  c(
    'C12-batch-authorization-fixed-list',
    'authority',
    '고정 목록의 일괄 승인',
    '사용자는 화면에 보인 세 후보만 판단 기록으로 남기라고 명령한다.',
    'sealed',
    ['command digest names exactly three targets', 'each seal references the batch authorization'],
    ['hidden fourth target is included', 'list is recomputed after approval'],
    { named: ['candidate-a', 'candidate-b', 'candidate-c'], confirmationActions: 1 },
  ),
  c(
    'C13-batch-list-changed',
    'authority',
    '일괄 승인 뒤 목록이 바뀐다',
    '승인 직후 새 후보가 발견되어 목록이 네 개가 된다.',
    'proposal',
    ['original three targets may proceed', 'new target remains proposal', 'new confirmation is required'],
    ['new target inherits old authorization'],
    { named: ['new candidate'] },
  ),
  c(
    'C14-concurrent-defer-and-close',
    'synchronization',
    '동시 유예와 종결',
    '웹에서는 사용자가 아직을 선택하고 같은 시각 Telegram에서는 종결 command가 들어온다.',
    'conflict',
    ['causal conflict is surfaced', 'both source events remain inspectable'],
    ['latest timestamp silently wins', 'one event is dropped'],
    { named: ['web defer', 'telegram close'], confirmationActions: 0 },
  ),
  c(
    'C15-stale-replica-after-erasure',
    'erasure',
    '삭제 뒤 낡은 복제본이 돌아온다',
    '사용자는 판단을 삭제했고, 이후 오프라인 replica가 예전 본문을 sync한다.',
    'erased',
    ['deletion receipt scope is retained', 'ordinary projection excludes erased body', 'replica import is quarantined or purged'],
    ['erased body reappears in search', 'receipt reproduces the erased body'],
    { named: ['deletion receipt'], confirmationActions: 1 },
  ),
  c(
    'C16-host-observation-provenance',
    'authority',
    '호스트가 보고한 관찰',
    '분석 대시보드 호스트가 전환율 3.4%를 기록한다.',
    'due',
    ['observation has host provenance and observed_by', 'human may later interpret it'],
    ['host observation is labelled human judgment', 'observation closes a judgment'],
    { named: ['analytics report'] },
  ),
  c(
    'C17-direct-command-close',
    'authority',
    '직접 명령으로 종결',
    '사용자가 특정 판단을 가리켜 “조건이 충족됐다. 닫아줘”라고 명령한다.',
    'resolved_answered',
    ['direct_command evidence pointer', 'resolution has subject and evidence', 'closure is authorized'],
    ['MCP executor is considered author', 'target is inferred from a vague command'],
    { expectedResolution: 'answered', expectedCriterionResult: 'met', confirmationActions: 0 },
  ),
  c(
    'C18-ai-suggested-terminal-rejected',
    'authority',
    'AI의 자동 종결 제안',
    'AI가 대화를 요약해 “아마 moot”이라며 command 없이 닫으려 한다.',
    'due',
    ['proposal may be shown', 'judgment remains open'],
    ['terminal event is appended', 'silence is treated as approval'],
  ),
  c(
    'C19-hindsight-amend-blocked',
    'temporality',
    '결과를 안 뒤 과거 판단을 고친다',
    '사용자가 결과를 본 뒤 sealed statement를 더 그럴듯하게 바꾸려 한다.',
    'sealed',
    ['command is rejected or requires new superseding judgment', 'old statement remains visible'],
    ['in-place amend', 'changed statement is treated as original'],
    { confirmationActions: 0 },
  ),
  c(
    'C20-return-contract-superseded',
    'temporality',
    '검토 기준이 의미 있게 바뀐다',
    '사용자는 원래 전환율 기준 대신 retention 기준으로 돌아보기 질문을 바꾸고 싶다.',
    'sealed',
    ['old return contract is superseded', 'new contract has a new id and authority'],
    ['old question is overwritten', 'due history is erased'],
    { confirmationActions: 1 },
  ),
  c(
    'C21-legacy-authority-unknown',
    'legacy',
    'legacy의 승인자를 모른다',
    'v2 seal 이벤트에는 provenance만 있고 사람이 승인했음을 증명할 evidence가 없다.',
    'sealed',
    ['authority_status is legacy_unknown', 'legacy content remains readable'],
    ['legacy event is upgraded to human-authorized', 'event is silently discarded'],
    { allowedLoss: 'authority detail is named unknown' },
  ),
  c(
    'C22-signed-import',
    'legacy',
    '서명된 import',
    '신뢰 정책을 통과한 외부 원장이 사람의 승인 서명과 함께 들어온다.',
    'sealed',
    ['authorization_mode signed_import', 'trust policy reference is retained'],
    ['signature is treated as a general AI authorization', 'unsigned import is silently trusted'],
    { named: ['signature metadata', 'trust policy'] },
  ),
  c(
    'C23-observation-is-not-closure',
    'resolution',
    '관찰은 종결이 아니다',
    '관찰이 모든 criterion을 충족하지만 사용자는 아직 해석·종결하지 않았다.',
    'due',
    ['observation is visible', 'judgment remains due'],
    ['system auto-closes', 'answered result is derived without authority'],
    { named: ['criterion-satisfying observation'] },
  ),
  c(
    'C24-still-pending-rearms-return',
    'resolution',
    '아직은 다시 약속한다',
    '사용자가 “데이터가 한 주 더 필요하다”고 말한다.',
    'sealed',
    ['return_deferred event', 'new return date or trigger', 'no closure'],
    ['resolved statistic increment', 'terminal state'],
    { confirmationActions: 0 },
  ),
  c(
    'C25-retro-premise-excluded-as-of',
    'temporality',
    '나중에 말한 전제는 과거 화면에 없다',
    '사용자가 오늘 “당시에도 환율이 걱정이었다”고 premise를 회고 추가한다.',
    'sealed',
    ['retrospective premise is stored with its record time', 'current projection may show it'],
    ['as_of before record time includes the premise', 'premise becomes contemporaneous'],
    { asOfExcludes: ['retrospective premise'], confirmationActions: 1 },
  ),
  c(
    'C26-cross-surface-idempotency',
    'synchronization',
    '여러 표면의 같은 재시도',
    'MCP가 timeout 뒤 같은 direct command를 재시도하고 web mirror도 같은 idempotency key를 전달한다.',
    'resolved_answered',
    ['one semantic close is retained', 'duplicate receipt references the original'],
    ['two closures are created', 'different transport timestamps change meaning'],
    { expectedResolution: 'answered', expectedCriterionResult: 'not_applicable' },
  ),
  c(
    'C27-similar-text-independent-records',
    'relationships',
    '비슷한 문장은 자동 병합하지 않는다',
    '두 팀이 같은 날 비슷한 가격 판단을 서로 독립적으로 봉인한다.',
    'sealed',
    ['two distinct judgment ids', 'possible same_question proposal only'],
    ['fuzzy merge', 'one author receives the other author\'s history'],
    { named: ['team-a judgment', 'team-b judgment'], confirmationActions: 2 },
  ),
  c(
    'C28-local-only-sync-failure',
    'surface',
    '동기화 실패는 판단 생애주기가 아니다',
    '로컬에서 판단을 봉인했지만 account sync가 실패한다.',
    'sealed',
    ['local canonical event remains readable', 'sync_failed attention signal is shown'],
    ['judgment becomes dismissed', 'decision is reported as settled'],
    { named: ['sync failure'] , confirmationActions: 1 },
  ),
  c(
    'C29-withdrawal-is-not-failure',
    'resolution',
    '철회는 실패가 아니다',
    '사용자는 외부 결과와 무관하게 더는 이 판단을 유지하지 않겠다고 명시한다.',
    'withdrawn',
    ['authorized withdrawal', 'reason may be absent', 'past record remains readable'],
    ['failure score', 'moot is inferred without reason'],
    { confirmationActions: 1 },
  ),
  c(
    'C30-direct-file-edit-is-honest',
    'legacy',
    '관문 밖 파일 편집',
    '사용자가 local ledger JSONL에 손으로 알 수 없는 이벤트를 추가한다.',
    'invalid_or_unknown',
    ['unknown or invalid event is visible in diagnostic/loss report', 'valid history still replays'],
    ['event is silently treated as valid', 'whole ledger is silently discarded'],
    { named: ['direct file edit'], allowedLoss: 'unknown event semantics are named unknown' },
  ),
];
