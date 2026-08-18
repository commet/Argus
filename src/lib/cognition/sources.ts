import { parseTranscript, type TranscriptTurn } from './extract';

/**
 * 후보가 **어디서 오는가** — 입력 계층.
 *
 * ── 왜 이 파일이 생겼나 (2026-08-18 정정) ────────────────────────────
 *
 * 처음 만든 화면은 사용자에게 `.jsonl` 파일을 직접 고르라고 했다. 그건 이
 * 저장소가 이미 가진 것보다 **훨씬 나쁜 경로**였다. `argus-mcp/src/v2/` 에는
 * 훅이 transcript 경로를 자동으로 넘겨주는 수집 파이프라인이 이미 있다
 * (`capture-cli.ts` → `queue.ts` → `harvest.ts` → `candidate-capture.ts`),
 * 민감정보 차단과 인용 byte 대조까지 붙어서.
 *
 * 근본 원인은 파일 하나가 아니라 **입력이 추출기 안에 박혀 있던 것**이다.
 * 그래서 입력을 갈아끼울 수 있는 계층으로 떼어낸다. `extract.ts` 는 이제
 * "턴 → 후보"만 하고, "어디서 턴이 오는가"는 여기가 안다.
 *
 * ── 세 갈래, 마찰 순 ─────────────────────────────────────────────────
 *
 *   plugin_auto  플러그인이 이미 가져와 둔 것.  사용자가 할 일 **없음**.
 *                훅 → 큐 → 수확 → 로컬 원장 → push-webapp.js → plugin_decisions.
 *   paste        자기가 쓴 것을 붙여넣기.        설치 없음. 기록 없는 사람용.
 *   file         세션 파일 직접 고르기.          최후 수단.
 *
 * ── 정직해야 하는 지점 (조용히 메우면 안 되는 곳) ────────────────────
 *
 * plugin_auto 로 오는 문장은 **사람 턴만** 담겨 있다 — MIT 존 수집기가
 * `role:'user'` 만 읽기 때문이다(`readTranscriptTurns`). 그래서 "이 문장이
 * 앞선 AI 턴의 인용인가"를 **대조할 수가 없다.** 대조 못 한 것을 `false`(=
 * "본인이 처음 한 말")로 적으면 그게 바로 이 제품이 막으려는 조용한 메우기다.
 * 그래서 `quoted_from_ai` 는 세 값이다: `'yes' | 'no' | 'unknown'`.
 */

export type SourceId = 'plugin_auto' | 'paste' | 'file';

export interface SourceSpec {
  id: SourceId;
  /** 사용자가 눌러야 하는 횟수. 0 = 아무것도 안 해도 도착해 있다. */
  clicks: 0 | 1 | 2;
  /** 화면에 그대로 쓰는 말. */
  label: string;
  /** 어떻게 도착하는지 한 줄. */
  arrives: string;
  /** 비었을 때 할 말 — 빈 목록을 말없이 보여주지 않는다. */
  whenEmpty: string;
  /** 설치·연결이 필요하면 그 한 줄. 없으면 null. */
  setup: string | null;
  /** 이 소스로 온 문장에 AI 턴 대조가 가능한가. */
  canCompareWithAi: boolean;
}

/**
 * 마찰 오름차순. 화면은 이 순서로 그린다 — 0클릭이 맨 위다.
 * 순서를 화면에 하드코딩하면 다음 사람이 뒤집는다.
 */
export const SOURCES: readonly SourceSpec[] = [
  {
    id: 'plugin_auto',
    clicks: 0,
    label: '이미 가져와 둔 것',
    arrives: 'Claude Code 플러그인이 대화를 훑어 결정으로 보이는 문장을 미리 모아둡니다. 여기서는 고르기만 하면 됩니다.',
    whenEmpty:
      '아직 가져온 문장이 없습니다. 플러그인을 안 쓰고 있거나, 최근 대화에 결정으로 보이는 문장이 없었을 수 있습니다. 아래에 직접 붙여넣어도 됩니다.',
    setup: 'Claude Code 에서 /argus:settings connect 를 한 번 실행하면 이후로는 알아서 옵니다.',
    canCompareWithAi: false,
  },
  {
    id: 'paste',
    clicks: 1,
    label: '내가 쓴 것 붙여넣기',
    arrives: '메모든 메신저든, 그 결정에 대해 자기가 쓴 글을 그대로 붙여넣으세요. 설치할 것은 없습니다.',
    whenEmpty: '붙여넣은 글에서 결정으로 보이는 문장을 못 찾았습니다. 없는 것을 지어내지는 않습니다.',
    setup: null,
    canCompareWithAi: false,
  },
  {
    id: 'file',
    clicks: 2,
    label: '세션 파일 고르기',
    arrives: 'Claude Code 세션 파일(.jsonl)을 직접 넣습니다. 위 두 가지가 안 될 때만 쓰세요.',
    whenEmpty: '이 파일에서는 결정으로 보이는 문장을 못 찾았습니다.',
    setup: null,
    canCompareWithAi: true,
  },
] as const;

export function sourceSpec(id: SourceId): SourceSpec {
  const s = SOURCES.find((x) => x.id === id);
  if (!s) throw new Error(`unknown source: ${id}`);
  return s;
}

/** 마찰이 가장 낮은 소스 — 화면의 기본값. 목록 순서에서 파생한다. */
export const DEFAULT_SOURCE: SourceId = SOURCES[0].id;

/**
 * 플러그인이 이미 가져다 둔 후보 한 줄.
 *
 * `plugin_decisions` 테이블의 모양 그대로다 (`quote`, `session`, `harvested_at`).
 * 이 문장들은 MIT 존에서 **byte 대조를 통과한 사용자 발화**다 — 그래서 저자는
 * 추측이 아니라 이미 증명돼 있다.
 */
export interface PluginCandidateRow {
  id: string;
  // 셋 다 null·undefined 를 받는다. 이 행들은 플러그인 원장에서 온 것이라
  // 옛 판에는 없던 필드가 있고, 좁게 타입하면 호출부가 캐스팅으로 뭉갠다
  // (방어적 데이터 접근 — Supabase 병합·옛 데이터·플러그인 판 차이).
  quote?: string | null;
  session?: string | null;
  harvested_at?: string | null;
  decided_at?: string | null;
  status?: string | null;
}

/**
 * 플러그인이 가져다 둔 것 → 턴.
 *
 * 전부 `who:'user'` 다. 수집기가 사람 턴만 읽으므로 이건 가정이 아니라 사실이다.
 * 대신 AI 턴이 없으니 인용 대조는 **못 한다** — 그건 `canCompareWithAi:false`
 * 로 이미 선언돼 있고, 추출 결과에도 `unknown` 으로 남는다.
 */
export function turnsFromPluginCandidates(rows: readonly PluginCandidateRow[]): TranscriptTurn[] {
  const turns: TranscriptTurn[] = [];
  for (const r of rows || []) {
    const text = (r?.quote || '').trim();
    if (!text) continue;
    const at = r.decided_at || r.harvested_at;
    // 시각 없는 문장은 기록이 될 수 없다 — 언제 한 말인지 모르면 되짚을 수 없다.
    if (!at) continue;
    turns.push({ who: 'user', text, at, id: `plugin:${r.id}` });
  }
  // 시간 오름차순. 추출기가 '나중 것이 더 최근'을 점수에 쓰므로 순서가 의미를 갖는다.
  return turns.sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
}

/**
 * 붙여넣은 자기 글 → 턴.
 *
 * 화자를 추측해 쪼개지 않는다. "> 로 시작하면 AI" 같은 규칙은 사람마다 달라서
 * 틀리고, **틀린 저자 표시는 없는 것보다 나쁘다.** 붙여넣은 것은 전부 그 사람이
 * 자기 것으로 낸 글로 다루고, AI 대조는 못 했다고 적는다.
 */
export function turnsFromPastedWriting(text: string, at: string): TranscriptTurn[] {
  const body = (text || '').trim();
  if (!body || !at) return [];
  return [{ who: 'user', text: body, at, id: `paste:${at}` }];
}

/** 세션 파일 → 턴. 사람·AI 턴이 다 있으므로 인용 대조가 된다. */
export function turnsFromTranscriptFile(jsonl: string, opts?: { maxTurns?: number }): TranscriptTurn[] {
  return parseTranscript(jsonl, opts);
}

/**
 * 이 소스로 뭐가 얼마나 왔는지 한 줄로. **0건도 한 줄을 받는다** — 빈 목록을
 * 말없이 보여주는 것이 이 저장소가 반복해서 겪은 조용한 실패다.
 */
export function sourceReport(id: SourceId, turns: readonly TranscriptTurn[]): string[] {
  const spec = sourceSpec(id);
  const user = turns.filter((t) => t.who === 'user').length;
  const ai = turns.filter((t) => t.who === 'ai').length;

  if (turns.length === 0) {
    return spec.setup ? [spec.whenEmpty, spec.setup] : [spec.whenEmpty];
  }

  const lines = [
    spec.id === 'plugin_auto'
      ? `플러그인이 가져다 둔 문장 ${user}개를 읽었습니다.`
      : `사람이 쓴 ${user}개${ai > 0 ? `, AI가 쓴 ${ai}개` : ''}를 읽었습니다.`,
  ];
  if (!spec.canCompareWithAi) {
    lines.push('이 경로에는 AI가 한 말이 함께 오지 않아, 어떤 문장이 AI 말을 옮긴 것인지는 확인할 수 없었습니다.');
  }
  return lines;
}
