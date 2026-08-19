import type { AxisId } from './axes';

/**
 * 대화 로그에서 결정의 조각을 **그대로 뽑아온다** (Claude Code 세션 .jsonl).
 *
 * ── 왜 이 파일이 생겼나 ──────────────────────────────────────────────
 *
 * 처음 만든 화면은 일곱 칸을 사람이 손으로 다 치게 했다. 그건 아무도 안 쓴다
 * (구속 장치는 효과가 있어도 자발 수용률이 낮고, 설득보다 기본값이 이긴다 —
 * Ashraf-Karlan-Yin 2006, Thaler-Benartzi 2004). 창업자 지적도 같았다:
 * 사용자가 이미 쓰는 도구에 얹혀서 입력을 최소화해야 한다.
 *
 * ── 왜 요약이 아니라 '그대로 뽑기'인가 (이 설계의 핵심) ──────────────
 *
 * LLM에게 대화를 요약시켜 칸을 채우면 **이 제품이 막으려는 실패를 제품이
 * 저지른다** — 사용자의 판단이 AI 문장으로 바뀌어 사용자 이름으로 저장된다.
 *
 * 그래서 원문 문장을 **글자 그대로** 뽑고, 그 문장이 나온 턴을 함께 들고 온다.
 * 그러면 저자가 추측이 아니라 **증명**된다:
 *
 *   사람 턴에서 나온 문장  → 그 사람의 말이다 (타임스탬프까지 있다)
 *   AI 턴에서 나온 문장    → AI의 말이다
 *
 * 폼에서는 "이 칸을 건드렸나"를 추적해 저자를 추정해야 했다. 로그에서는
 * 추정할 필요가 없다. **이게 폼보다 나은 진짜 이유다.**
 *
 * ── 이 말뭉치에서 실제로 관찰된 것 (2026-08-18, 창업자 턴 103개) ─────
 *
 * 패턴을 상상하지 않고 실제 분포를 세어 맞췄다:
 *
 *   에이전트 지시문("~해줘/진행해/머지해")   39턴  ← 결정이 아니다. 걸러야 한다
 *   목표·원함                                12턴
 *   확신·추측                                11턴
 *   대안·버린 길                              8턴
 *   전제·가정                                 5턴
 *   당위("~해야 돼")                          5턴
 *   믿음("~라고 본다")                        5턴
 *   **반증 조건("틀렸/실패/안 되면")            2턴**  ← 거의 없다
 *
 * 마지막 줄이 이 도구의 존재 이유를 그대로 보여준다. 사람은 대화에서 "이러면
 * 내가 틀린 거다"를 거의 말하지 않는다. 그래서 그 칸은 대부분 **비어서 돌아온다.**
 *
 * **비면 비었다고 말한다.** 채우지 않는다. 못 찾은 것을 지어내는 순간 이 도구는
 * 쓸모가 아니라 위험이 된다.
 *
 * ── 이 모듈이 아키텍처에서 앉는 자리 (2026-08-18 정정) ───────────────
 *
 * 처음에 이걸 "파일 업로드 화면"으로 지었다. **그건 틀렸다.** 이 저장소에는
 * 이미 자동 수집 파이프라인이 있다 (`argus-mcp/src/v2/`):
 *
 *   Claude Code 훅 (opt-in) → 큐 → runHarvestSweep → CandidateExtractorPort
 *                                                   → byte 검증 → 후보 → 원장
 *
 * 훅은 Claude Code 로부터 transcript 경로를 **자동으로 받는다**(`--transcript`).
 * 사용자가 파일을 고를 일이 없다. 민감정보 차단·인용 byte 대조·주 2건 캡·
 * 1일 1회 제한도 이미 거기 있다.
 *
 * 그러므로 이 모듈은 **입력 경로가 아니라 추출기**다. 갈 자리는
 * `CandidateExtractorPort` 의 새 구현이고, 기존 `deterministicCandidateExtractor`
 * 가 턴당 후보 하나(`{quote, typed_span}`)를 내는 것을 **일곱 축 + 저자 증명**으로
 * 넓힌다. 그 배선은 MIT 존 PR 이다 (한 PR 한 존 규약).
 *
 * 소스는 갈아끼울 수 있어야 한다 — 이 함수들은 `TranscriptTurn[]` 만 받고
 * 파일도, 경로도, 네트워크도 모른다. 그래서 훅이 주든 붙여넣기가 주든 같다.
 *
 * ── 규율 ─────────────────────────────────────────────────────────────
 *
 * 1. 순수·결정론. 같은 로그 = 같은 후보. LLM 호출 없음.
 * 2. 문장은 **글자 그대로**. 다듬지 않는다.
 * 3. 후보는 후보다. 자동으로 칸에 들어가지 않고 사람이 고른다.
 * 4. 못 찾으면 빈 배열. 그럴듯한 문장을 만들지 않는다.
 * 5. 소스를 모른다. 파일·훅·붙여넣기 어디서 와도 같은 함수가 돈다.
 *
 * 전제 모델의 정본은 `src/lib/premises-core.ts` (`normalizePremiseText`·`premiseId`)
 * 이고 지속 계층은 `./premise.ts` 다. 여기서는 전제 **문장을 뽑기만** 하고
 * 전제 객체를 만들거나 동일성을 판정하지 않는다.
 */

export interface TranscriptTurn {
  /** 사람이 친 것인가, AI가 쓴 것인가. 로그가 알려주므로 추측이 아니다. */
  who: 'user' | 'ai';
  text: string;
  /** ISO 시각. */
  at: string;
  /** 되짚을 수 있는 턴 식별자. */
  id: string;
}

/**
 * Claude Code 세션 .jsonl 을 턴 목록으로 읽는다.
 *
 * 형식(2026-08-18 실측):
 *   사람  { type:'user', origin:{kind:'human'}, message:{content: string}, timestamp, uuid }
 *   AI    { type:'assistant', message:{content: [{type:'text'|'thinking'|'tool_use', ...}]}, ... }
 *
 * `origin.kind === 'human'` 검사가 핵심이다 — 도구 결과와 시스템 주입도
 * `type:'user'` 로 들어오므로, 이걸 빼면 **사람이 하지 않은 말이 사람의 말로
 * 기록된다.** 이 제품에서 그건 치명적이다.
 *
 * AI 턴에서는 `thinking` 블록을 버린다. 그건 사용자에게 보인 적이 없으므로
 * 사용자의 판단에 영향을 줬다고 말할 수 없다.
 */
export function parseTranscript(jsonl: string, opts?: { maxTurns?: number }): TranscriptTurn[] {
  const max = opts?.maxTurns ?? 5000;
  const out: TranscriptTurn[] = [];

  for (const line of (jsonl || '').split('\n')) {
    if (out.length >= max) break;
    const s = line.trim();
    if (!s) continue;

    let e: Record<string, unknown>;
    try {
      e = JSON.parse(s) as Record<string, unknown>;
    } catch {
      continue; // 깨진 줄은 조용히 건너뛴다 — 로그 파일은 커서 일부 손상이 흔하다
    }

    const at = typeof e.timestamp === 'string' ? e.timestamp : '';
    const id = typeof e.uuid === 'string' ? e.uuid : '';
    const msg = e.message as { content?: unknown } | undefined;
    if (!at || !msg) continue;

    if (e.type === 'user') {
      const origin = e.origin as { kind?: string } | undefined;
      if (origin?.kind !== 'human') continue; // 도구 결과·시스템 주입 제외
      const c = msg.content;
      if (typeof c !== 'string' || !c.trim()) continue;
      out.push({ who: 'user', text: c.trim(), at, id });
    } else if (e.type === 'assistant') {
      const c = msg.content;
      if (!Array.isArray(c)) continue;
      const text = c
        .filter((b): b is { type: string; text: string } =>
          typeof b === 'object' && b !== null && (b as { type?: string }).type === 'text',
        )
        .map((b) => b.text)
        .join('\n')
        .trim();
      if (!text) continue;
      out.push({ who: 'ai', text, at, id });
    }
  }
  return out;
}


/**
 * 말이 아닌 것. 대화 로그에는 사람이 한 말만 있는 게 아니라 표·목록·UI 목업·
 * 코드 조각이 섞여 있고, 그것들이 후보로 올라오면 화면이 망가진 것처럼 보인다.
 * (실제로 이전 대화의 UI 목업 한 줄이 '반증 조건' 1순위로 뽑혔다.)
 */
const NOT_SPEECH = [
  /\[[^\]]{1,20}\]/,        // [직접 쓰기] 같은 UI 라벨
  /\s{3,}/,                  // 표·정렬용 연속 공백
  /^\s*[|+]/,                // 표 테두리
  /^\s*\d+\.\s|^\s*[-*·]\s/, // 목록 항목
  /\{|\}|=>|;\s*$/,          // 코드
];

/** 문장 쪼개기. 한국어 종결(다./요./까?)과 줄바꿈을 경계로 본다. */
export function splitSentences(text: string): string[] {
  return (text || '')
    .split(/\n+|(?<=[.!?])\s+|(?<=다\.)\s*|(?<=요\.)\s*/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 8 && s.length <= 200)
    .filter((s) => !NOT_SPEECH.some((re) => re.test(s)));
}

/**
 * 에이전트 지시문 — **결정이 아니다.**
 *
 * 실측에서 창업자 턴의 38%가 여기 해당했다("머지해줘", "진행해", "다시 써봐").
 * 이걸 결정으로 뽑으면 후보 목록이 심부름 목록이 되어 쓸모가 없어진다.
 */
const DIRECTIVE = /해줘|해라|해봐|진행해|머지해|만들어|정리해|설명해|알려줘|보여줘|돌려줘|고쳐줘|체크해/;

/** 축별 단서. 실제 말뭉치에서 센 표현만 쓴다 — 상상한 패턴은 넣지 않았다. */
const CUES: Record<AxisId, { re: RegExp; label: string }[]> = {
  frame: [
    { re: /할까|말까|어느\s*쪽|둘\s*중|건가\?|할\s*때인가/, label: '무엇을 정할지 묻는 말' },
    // '결정' 단독은 AI 문서 설명에서 너무 흔했다 — 1인칭 맥락을 요구한다.
    { re: /(내가|우리가|지금)\s*[^.]{0,20}(정해야|골라야|결정)|고민(이|은|중)/, label: '결정을 말하는 자리' },
  ],
  values: [
    { re: /제일\s*(좋|안정|중요)|가장\s*(좋|중요)/, label: '무엇이 더 낫다는 말' },
    { re: /면\s*좋겠|원했|원한|하고\s*싶|목표|목적/, label: '바라는 상태' },
    { re: /해야\s*(돼|한다|함|된다)/, label: '당위' },
  ],
  premises: [
    { re: /전제|가정/, label: '전제라고 직접 말한 곳' },
    { re: /라고\s*(보|생각|치)|다고\s*(보|생각|치)/, label: '믿음을 말하는 형태' },
    { re: /일\s*것|을\s*것\s*같|겠지|않을까/, label: '추측' },
  ],
  inference: [
    { re: /그래서|따라서|때문에|그러면|하면\s*된/, label: '이어지는 논리' },
  ],
  confidence: [
    { re: /확신|확실|아마|같아|싶은데|듯/, label: '확신의 정도' },
    { re: /\d+\s*%/, label: '퍼센트' },
  ],
  alternatives: [
    // '말고' 단독은 심부름 문장에서 너무 흔했다("readme만 보지 말고") — 뺐다.
    { re: /대신에|안\s*하기로|는\s*버리|포기하(고|기)|다른\s*길|~보다는/, label: '버린 길' },
    { re: /A\s*(안|말고)|B로\s*가|둘\s*중\s*하나/, label: '고른 것과 버린 것' },
  ],
  falsifier: [
    { re: /틀렸|틀리면|실패하면|안\s*되면|무너지면|깨지면/, label: '틀렸다고 볼 조건' },
    { re: /반증|아니면\s*안/, label: '반증' },
  ],
};

export interface Candidate {
  axis: AxisId;
  /** 로그에 있던 문장 그대로. 다듬지 않는다. */
  text: string;
  /** 사람이 한 말인가 AI가 한 말인가 — 로그가 증명한다. */
  who: 'user' | 'ai';
  at: string;
  turn_id: string;
  /** 왜 이 문장이 여기 걸렸는지 — 사용자가 납득하거나 반박할 수 있게. */
  why: string;
  /**
   * 사람 턴에 있지만 **앞선 AI 턴에 글자 그대로 있던 문장**인가.
   *
   * 사용자가 AI 문장을 붙여넣어 비판하는 일이 실제로 잦다("이게 뭔 말이야" 하며
   * 인용). 로그상으로는 사람 턴이지만 그 말은 AI 것이다. 이걸 사람 말로 세면
   * 이 제품이 재려는 것(저자가 누구인가)을 바로 그 자리에서 틀리게 된다.
   *
   * 판정은 추측이 아니라 **대조**다: 앞선 AI 턴 어딘가에 같은 문장이 있으면 인용.
   *
   * **세 값인 이유.** 어떤 입력 경로에는 AI 턴이 아예 오지 않는다 — 플러그인
   * 수집기는 사람 턴만 읽고(`argus-mcp/src/v2/candidate-capture.ts` 의
   * `readTranscriptTurns`), 붙여넣기에는 상대 말이 없다. 대조를 **못 한 것**을
   * `'no'`(= 본인이 처음 한 말)로 적으면 그게 이 제품이 막으려는 조용한
   * 메우기다. 그래서 못 했으면 `'unknown'` 이라고 적는다.
   */
  quoted_from_ai: 'yes' | 'no' | 'unknown';
}

/**
 * 이 후보를 **AI 발원으로 다뤄야 하는가.**
 *
 * `quoted_from_ai` 를 그냥 조건문에 넣으면 안 된다 — 세 값 전부 truthy 문자열이라
 * `'no'` 도 참이 된다. (실제로 boolean 이던 시절의 호출부가 타입만 바뀐 채
 * 조용히 살아남아 모든 후보를 AI 문장으로 취급했다. 명사만 타입하고 동사를
 * 안 타입한 전형이다.) 그래서 판정을 함수로 고정한다.
 *
 * `'unknown'` 은 **AI 발원이 아니다** — 대조를 못 했다는 뜻이다. 모르는 것을
 * AI 것으로 몰면 사용자 문장을 기계 문장으로 강등시킨다.
 */
export function isAiWorded(c: Candidate): boolean {
  return c.who === 'ai' || c.quoted_from_ai === 'yes';
}

/** 저자를 사람 말 한 줄로. 모르면 모른다고 적는다. */
export function authorLine(c: Candidate): string {
  if (c.who === 'ai') return 'AI가 한 말';
  if (c.quoted_from_ai === 'yes') return 'AI 문장을 인용한 것';
  if (c.quoted_from_ai === 'unknown') return '내가 쓴 것 (AI 말을 옮긴 건지는 확인 못 함)';
  return '내가 한 말';
}

export interface ExtractionResult {
  /** 축별 후보. 못 찾은 축은 **빈 배열**이고, 그대로 비어서 보인다. */
  byAxis: Record<AxisId, Candidate[]>;
  /** 읽은 턴 수 — 사람/AI 각각. */
  turns: { user: number; ai: number };
  /** 후보를 하나도 못 찾은 축들. 화면이 "못 찾았습니다"를 그릴 재료. */
  emptyAxes: AxisId[];
  /**
   * AI 턴이 함께 왔는가 = 인용 대조가 가능했는가.
   * 화면은 이게 false 면 "본인이 처음 한 말"이라고 말하면 안 된다.
   */
  aiComparisonPossible: boolean;
}

const AXIS_IDS: AxisId[] = ['frame', 'values', 'premises', 'inference', 'confidence', 'alternatives', 'falsifier'];

/**
 * 후보를 뽑는다.
 *
 * 축당 최대 `perAxis` 개. 너무 많으면 고르는 것 자체가 일이 되므로 자르되,
 * **잘랐다는 사실을 숨기지 않는다** (호출자가 `byAxis[axis].length` 로 안다).
 */
export function extractCandidates(
  turns: readonly TranscriptTurn[],
  opts?: { perAxis?: number; includeAi?: boolean },
): ExtractionResult {
  const perAxis = opts?.perAxis ?? 6;
  // AI 문장도 후보로 볼지. 기본은 본다 — AI가 만든 전제를 사용자가 채택한
  // 경우가 실제로 많았고(원장 22/23), 그걸 안 보여주면 그 사실이 가려진다.
  const includeAi = opts?.includeAi ?? true;

  const pool = Object.fromEntries(AXIS_IDS.map((a) => [a, [] as Scored[]])) as Record<AxisId, Scored[]>;
  let userTurns = 0;
  let aiTurns = 0;
  const total = (turns ?? []).length || 1;

  // 지금까지 AI가 한 말의 문장 집합. 사람 턴의 문장이 여기 있으면 인용이다.
  const saidByAi = new Set<string>();
  // AI 턴이 하나라도 있어야 "인용인가"를 대조할 수 있다. 없으면 판정 불가이고,
  // 판정 불가를 '아니오'로 적지 않는 것이 이 파일의 규율이다.
  const hasAiTurns = (turns ?? []).some((t) => t.who === 'ai');
  const norm = (x: string) => x.replace(/\s+/g, ' ').trim();

  for (let i = 0; i < (turns ?? []).length; i += 1) {
    const t = turns[i];
    if (t.who === 'user') userTurns += 1;
    else aiTurns += 1;

    const sentences = splitSentences(t.text);

    if (t.who === 'ai') {
      for (const x of sentences) saidByAi.add(norm(x));
      if (!includeAi) continue;
    }

    for (const sentence of sentences) {
      if (DIRECTIVE.test(sentence)) continue;
      // 사람 턴인데 앞서 AI가 한 말이면 인용 — 사람 말로 세지 않는다.
      // AI 턴이 하나도 없으면 대조 자체가 불가능하다 — 'no' 가 아니라 'unknown'.
      const quoted: Candidate['quoted_from_ai'] = !hasAiTurns
        ? 'unknown'
        : t.who === 'user' && saidByAi.has(norm(sentence))
          ? 'yes'
          : 'no';

      for (const axis of AXIS_IDS) {
        const hits = CUES[axis].filter((c) => c.re.test(sentence));
        if (hits.length === 0) continue;
        pool[axis].push({
          cand: {
            axis,
            text: sentence,
            who: t.who,
            at: t.at,
            turn_id: t.id,
            why: hits[0].label,
            quoted_from_ai: quoted,
          },
          score: scoreSentence(sentence, quoted === 'yes' ? 'ai' : t.who, i / total, hits.length),
        });
      }
    }
  }

  const byAxis = Object.fromEntries(
    AXIS_IDS.map((a) => [
      a,
      pool[a]
        // 점수 내림차순, 동점이면 나중 것(최근) 먼저 — 완전 결정론.
        .sort((x, y) => y.score - x.score || y.cand.at.localeCompare(x.cand.at))
        .filter(dedupeByText())
        .slice(0, perAxis)
        .map((s) => s.cand),
    ]),
  ) as Record<AxisId, Candidate[]>;

  return {
    byAxis,
    turns: { user: userTurns, ai: aiTurns },
    emptyAxes: AXIS_IDS.filter((a) => byAxis[a].length === 0),
    aiComparisonPossible: hasAiTurns,
  };
}

interface Scored {
  cand: Candidate;
  score: number;
}

/** 같은 문장이 여러 번 뽑히면 하나만 남긴다. */
function dedupeByText() {
  const seen = new Set<string>();
  return (s: Scored) => {
    const k = s.cand.text.replace(/\s+/g, ' ').trim();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  };
}

/**
 * 후보 점수. **먼저 온 순서로 채우면 AI 문장이 다 차지한다** — 실측에서 AI 턴이
 * 사람 턴의 12.7배였고, 첫 판이 정확히 그렇게 망가졌다.
 *
 * 가중치는 전부 사전 믿음이므로 여기 적어둔다. 근거가 강해서가 아니라,
 * 적어두면 나중에 왜 이 후보가 위로 왔는지 되짚을 수 있어서다.
 */
function scoreSentence(sentence: string, who: 'user' | 'ai', position: number, cueCount: number): number {
  let score = 0;

  // 사람 말이 압도적으로 먼저다. 이 도구는 사용자의 판단을 지키려고 있다.
  if (who === 'user') score += 100;

  // 최근일수록 위로 (0~20). 8일 전 결정보다 어제 결정이 대개 더 급하다.
  score += position * 20;

  // 단서가 여러 개 걸리면 더 그럴듯하다.
  score += (cueCount - 1) * 5;

  // 1인칭·의향 표현 — 세상 설명이 아니라 자기 판단일 가능성.
  if (/(내가|나는|우리가|우리는)/.test(sentence)) score += 12;
  if (/(할게|갈거야|할거야|하기로|가자|안\s*할)/.test(sentence)) score += 12;

  // 문서·목록·코드 냄새 — 대화가 아니라 산출물일 가능성이 높다.
  if (/^[-*#>|]/.test(sentence.trim())) score -= 30;
  if (/\*\*|`|\bhttps?:\/\//.test(sentence)) score -= 15;
  if (/[/_]{1}\w+[/_]|::|\(\)/.test(sentence)) score -= 12;
  if (/\d+개\s*(모듈|파일|커밋|테스트)/.test(sentence)) score -= 20;

  return score;
}

/**
 * 후보를 화면 문구로. **판정하지 않고 사실만 말한다.**
 */
export function extractionSummary(r: ExtractionResult): string[] {
  const found = AXIS_IDS.filter((a) => r.byAxis[a].length > 0).length;
  const out: string[] = [];
  out.push(`대화 ${r.turns.user + r.turns.ai}개 (내 말 ${r.turns.user}개, AI ${r.turns.ai}개)를 읽었습니다.`);
  out.push(
    found === 0
      ? '결정으로 보이는 문장을 못 찾았습니다. 직접 써주세요 — 없는 걸 지어내지는 않습니다.'
      : `일곱 칸 중 ${found}칸에서 쓸 만한 문장을 찾았습니다. 나머지는 비어 있고, 채워 넣지 않았습니다.`,
  );
  return out;
}
