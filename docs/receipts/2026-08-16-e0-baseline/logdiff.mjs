#!/usr/bin/env node
/**
 * E-0 대화 로그 측정 — 원형 E 판별 실험 (브리프 §4 E / §5.1)
 *
 * 질문: 창업자가 자기 발화에서 쓰는 어휘 중, 대화에서 **AI가 먼저 말한** 것의
 * 비율은 얼마인가? (M4 저자성 혼입의 어휘 층위 대리 측정)
 *
 * 결정론: 최초 발화자 귀속은 타임스탬프 순서로만 정해진다 — 판단 개입 0.
 * 의미 판정(어느 용어가 하중을 받는 개념어인가)은 census-log.json에 데이터로
 * 고정하고, 이 스크립트는 셈만 한다.
 *
 * 한계 (보고서에 그대로 싣는다): 용어 재사용 ≠ 믿음 채택. 창업자가 유용한
 * 이름을 의식적으로 채택한 것과 저자성이 조용히 넘어간 것을 이 장치는
 * 구분하지 못한다. 측정하는 것은 "프레임 어휘의 공급자가 누구인가"이지
 * "누가 판단했는가"가 아니다.
 *
 * 교란 통제 둘 (없으면 숫자가 무의미하다):
 *  (a) 물량 비대칭 — AI 턴이 창업자 턴의 12배다. 흔한 단어는 순전히 물량으로
 *      AI가 먼저 말한다. → 대화 이전 저장소 어휘에 이미 있던 말은 전부 제외.
 *  (b) 기존 프로젝트 어휘 — "판단·결정·봉인·정산"은 대화 전부터 정본 문서에
 *      있다. AI가 이 대화에서 먼저 말했다고 AI 발원이 아니다. → 같은 필터.
 *  통제 후 남는 것만이 "이 대화에서 새로 생겨난 말"이고, 그 중 AI가 먼저 낸
 *  것을 창업자가 자기 발화에 쓰면 그것이 측정하려는 저자성 이동이다.
 *
 * 실행: node logdiff.mjs <transcript.jsonl> [pre-conversation-corpus-dir]
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const transcriptPath = process.argv[2];
const priorCorpusDir = process.argv[3];
// 말뭉치 경계 고정 (재현성). 대화 로그는 **살아있는 파일**이라 세션이 진행되면
// 계속 자란다 — 경계를 안 박으면 같은 명령이 매번 다른 숫자를 낸다. 첫 판이
// 실제로 그랬고(1238턴 → 1260턴), 재검증에서 잡혔다.
const untilIdx = process.argv.indexOf('--until');
const UNTIL = untilIdx > -1 ? process.argv[untilIdx + 1] : null;
if (!transcriptPath || !existsSync(transcriptPath)) {
  console.error('사용법: node logdiff.mjs <transcript.jsonl> [pre-conversation-corpus-dir]');
  console.error('대화 로그는 개인 데이터라 저장소에 넣지 않는다 — 경로로만 받는다.');
  process.exit(2);
}

// ---------- 1. 발화 추출 ----------
/** @type {{ts:string, who:'founder'|'ai', text:string}[]} */
const turns = [];
for (const line of readFileSync(transcriptPath, 'utf8').split('\n')) {
  if (!line.trim()) continue;
  let e;
  try { e = JSON.parse(line); } catch { continue; }
  const ts = e.timestamp;
  const msg = e.message;
  if (!ts || !msg) continue;
  if (UNTIL && ts > UNTIL) continue;
  if (e.type === 'user') {
    // 창업자가 실제로 타이핑한 턴만 (도구 결과·시스템 주입 제외)
    if (typeof msg.content !== 'string') continue;
    if (!(e.origin && e.origin.kind === 'human')) continue;
    turns.push({ ts, who: 'founder', text: msg.content });
  } else if (e.type === 'assistant') {
    const c = msg.content;
    if (!Array.isArray(c)) continue;
    const text = c.filter((b) => b && b.type === 'text').map((b) => b.text || '').join('\n');
    if (!text.trim()) continue;
    turns.push({ ts, who: 'ai', text });
  }
}
turns.sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0));

// ---------- 2. 용어 추출 ----------
// 한글 2음절 이상 덩어리 + 라틴 기술어. 조사·어미는 경계로만 쓰고 어간을 남긴다.
const HANGUL = /[가-힣]{2,}/g;
const LATIN = /[A-Za-z][A-Za-z0-9_.\-]{2,}/g;
// 조사/어미 꼬리 제거 (보수적으로 — 과제거하면 별개 용어가 합쳐진다)
const TAILS = ['으로는','에서는','에게는','이라는','라는','으로','에서','에게','까지','부터','보다','처럼','한테','이나','거나','든지','와의','과의','의','를','을','이','가','은','는','에','도','만','로','와','과','랑','아','야','요','다','고','며','서','면','나','든'];
const STOP = new Set(['그리고','그런데','그래서','하지만','그러나','때문에','대해서','대한','위해','통해','있는','있다','없는','없다','한다','했다','하는','하고','되는','된다','됐다','같은','같다','이거','저거','그거','우리','너의','내가','네가','지금','다시','정말','진짜','아주','매우','조금','전부','모두','그냥','일단','계속','바로','아직','이미','혹시','만약','예를','들어','것이','것을','것은','수도','있을','있어','해줘','해봐','하자','보자','거야','거기','여기','저기','뭔가','어떤','어떻게','무엇','누가','언제','어디','왜냐','그럼','근데','또한','또는','즉시','역시','물론','따라서','오히려','그것','이것','저것','사실','정도','경우','부분','내용','상태','결과','문제','방법','생각','이야기','얘기','부탁','확인','진행','작업','다음','이번','저번','지난','오늘','내일','어제','시간','상황','때문','이후','이전','이제','한번','조차','마저','까진','그때','당시','지난번']);

function terms(text) {
  const out = new Set();
  for (const raw of text.match(HANGUL) || []) {
    let t = raw;
    for (const tail of TAILS) {
      if (t.length - tail.length >= 2 && t.endsWith(tail)) { t = t.slice(0, -tail.length); break; }
    }
    if (t.length >= 2 && !STOP.has(t)) out.add(t);
  }
  for (const raw of text.match(LATIN) || []) {
    const t = raw.toLowerCase().replace(/[.\-_]+$/, '');
    if (t.length >= 3) out.add(t);
  }
  return out;
}

// ---------- 2.5 대화 이전 어휘 (교란 통제) ----------
// 대화 시작 시점의 저장소 문서·코드에 이미 있던 말은 "이 대화에서 생겨난 말"이
// 아니다. AI가 이 대화에서 먼저 발화했더라도 발원은 프로젝트다.
const priorVocab = new Set();
if (priorCorpusDir && existsSync(priorCorpusDir)) {
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      let st;
      try { st = statSync(p); } catch { continue; }
      if (st.isDirectory()) { walk(p); continue; }
      if (!/\.(md|ts|tsx|js|mjs|json|txt|sql)$/.test(name)) continue;
      if (st.size > 4_000_000) continue;
      let text;
      try { text = readFileSync(p, 'utf8'); } catch { continue; }
      for (const t of terms(text)) priorVocab.add(t);
    }
  };
  walk(priorCorpusDir);
}

// ---------- 3. 최초 발화자 귀속 ----------
/** term -> {who, ts, idx} */
const firstSpeaker = new Map();
/** term -> {founderUses, aiUses} */
const useCount = new Map();
turns.forEach((t, idx) => {
  const ts_ = terms(t.text);
  for (const term of ts_) {
    if (!firstSpeaker.has(term)) firstSpeaker.set(term, { who: t.who, ts: t.ts, idx });
    const c = useCount.get(term) || { founder: 0, ai: 0 };
    c[t.who === 'founder' ? 'founder' : 'ai'] += 1;
    useCount.set(term, c);
  }
});

const founderTurns = turns.filter((t) => t.who === 'founder');
const aiTurns = turns.filter((t) => t.who === 'ai');

// 창업자가 실제로 쓴 용어 중, 대화 안에서 확립된 것(전체 3회 이상 등장)
const allFounderTerms = [...useCount.entries()].filter(([, c]) => c.founder > 0 && c.founder + c.ai >= 3);
// 교란 통제: 대화 이전 저장소 어휘 제외 → "이 대화에서 새로 생겨난 말"만 남는다
const founderTerms = priorVocab.size
  ? allFounderTerms.filter(([term]) => !priorVocab.has(term))
  : allFounderTerms;
const aiFirst = founderTerms.filter(([term]) => firstSpeaker.get(term).who === 'ai');
const founderFirst = founderTerms.filter(([term]) => firstSpeaker.get(term).who === 'founder');

// 창업자가 반복 사용(2회 이상)한 것 — 일회성 반향이 아니라 어휘로 정착한 것
const repeated = founderTerms.filter(([, c]) => c.founder >= 2);
const repeatedAiFirst = repeated.filter(([term]) => firstSpeaker.get(term).who === 'ai');

// 통제 전후 대비 (교란의 크기 자체를 보고한다)
const uncontrolledAiFirst = allFounderTerms.filter(([term]) => firstSpeaker.get(term).who === 'ai');

const pct = (a, b) => (b === 0 ? 'n/a' : `${a}/${b} (${((a / b) * 100).toFixed(1)}%)`);
const L = [];
const out = (s = '') => L.push(s);

out('E-0 대화 로그 측정 — 원형 E 판별 실험 (브리프 §4 E / §5.1)');
out('='.repeat(64));
out('');
out(`말뭉치: ${turns.length}턴 (창업자 ${founderTurns.length} · AI ${aiTurns.length})`);
out(`기간: ${turns[0].ts.slice(0, 10)} ~ ${turns[turns.length - 1].ts.slice(0, 10)}`);
out(UNTIL
  ? `경계 고정: --until ${UNTIL} (로그는 살아있는 파일 — 고정 없이는 재현 불가)`
  : '경계 미고정 — 로그가 자라면 숫자가 달라진다. 보고용 실행에는 --until 을 쓸 것.');
out(`창업자 발화 총 글자수: ${founderTurns.reduce((s, t) => s + t.text.length, 0).toLocaleString()}`);
out('');
if (priorVocab.size) {
  out(`대화 이전 저장소 어휘: ${priorVocab.size.toLocaleString()}개 (교란 통제용 · 커밋 시점 코퍼스)`);
  out('');
  out('[교란의 크기] 통제 없이 재면 숫자가 이렇게 부풀려진다');
  out(`  통제 전(전체 용어 ${allFounderTerms.length}개): AI 최초 ${pct(uncontrolledAiFirst.length, allFounderTerms.length)}`);
  out(`  → AI 턴이 창업자의 ${(aiTurns.length / founderTurns.length).toFixed(1)}배라, 흔한 말은 물량으로 AI가 먼저 말한다.`);
  out(`  → 게다가 그 중 상당수는 대화 전부터 저장소에 있던 프로젝트 어휘다.`);
  out('');
}
out('[M4-어휘] 이 대화에서 새로 생겨난 말 중 창업자가 쓴 것의 최초 발화자');
out(`  모집단: 창업자가 쓰고, 전체 3회 이상 등장하고, 대화 이전 저장소에 없던 용어 ${founderTerms.length}개`);
out(`  AI가 먼저 말한 것:      ${pct(aiFirst.length, founderTerms.length)}`);
out(`  창업자가 먼저 말한 것:  ${pct(founderFirst.length, founderTerms.length)}`);
out('');
out('[M4-정착] 창업자가 2회 이상 반복 사용한 용어 (일회성 반향 제외)');
out(`  모집단 ${repeated.length}개 중 AI 최초 발화: ${pct(repeatedAiFirst.length, repeated.length)}`);
out('');

// ---------- 4. 구(phrase) 단위 귀속 ----------
// 개념은 낱말이 아니라 구로 산다("거울 인지 필드 매핑"). 형태소 조각의 잡음을
// 피하려면 이 층위에서 재야 한다. 문자열 포함으로 최초 발화자를 찾는다.
function firstUtteranceOf(phrase) {
  for (const t of turns) if (t.text.includes(phrase)) return t;
  return null;
}
function countUtterances(phrase, who) {
  return turns.filter((t) => t.who === who && t.text.includes(phrase)).length;
}

// ---------- 4.5 자동 개념구 추출 (큐레이션 없는 M4) ----------
// census의 하중 개념구는 사람이 고른 목록이라 선택 편향이 있다. 같은 질문에
// 손을 안 대고 답하려면 규칙만으로 개념구를 뽑아야 한다:
//   (a) 창업자 발화에 등장하고 (b) 대화 이전 저장소 어휘에 없고
//   (c) 전체 2회 이상 쓰이는 2~3어절 구.
// 두 숫자(큐레이션·자동)를 나란히 내면 편향의 크기가 보인다.
{
  const CH = /[가-힣A-Za-z0-9]+/g;
  const phraseCount = new Map(); // phrase -> {founder, ai, firstWho, firstTs}
  // **턴 수로 센다, 출현 수가 아니라.** 창업자가 파일 목록을 한 번 붙여넣으면
  // 같은 구가 한 턴 안에서 100번 나온다 — 그것은 저자성이 아니라 붙여넣기다.
  // (첫 판이 실제로 그렇게 오염됐다: "overfire eval" 창업자 102회 = 붙여넣기 1턴)
  const seenInTurn = (text, who, ts) => {
    const toks = text.match(CH) || [];
    const inThisTurn = new Set();
    for (let n = 2; n <= 3; n += 1) {
      for (let i = 0; i + n <= toks.length; i += 1) {
        const win = toks.slice(i, i + n);
        if (win.some((t) => t.length < 2)) continue;
        const ph = win.join(' ');
        if (ph.length < 6 || ph.length > 30) continue;
        inThisTurn.add(ph);
      }
    }
    for (const ph of inThisTurn) {
      let c = phraseCount.get(ph);
      if (!c) { c = { founder: 0, ai: 0, firstWho: who, firstTs: ts }; phraseCount.set(ph, c); }
      c[who] += 1;
    }
  };
  for (const t of turns) seenInTurn(t.text, t.who, t.ts);

  // 대화 이전 저장소에 있던 구는 제외 (정규화 후 포함 검사)
  const priorBlob = [];
  if (priorCorpusDir && existsSync(priorCorpusDir)) {
    const walk2 = (dir) => {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        let st; try { st = statSync(p); } catch { continue; }
        if (st.isDirectory()) { walk2(p); continue; }
        if (!/\.(md|ts|tsx|js|mjs|json|txt|sql)$/.test(name) || st.size > 4_000_000) continue;
        try { priorBlob.push((readFileSync(p, 'utf8').match(CH) || []).join(' ')); } catch { /* skip */ }
      }
    };
    walk2(priorCorpusDir);
  }
  const priorText = priorBlob.join('\n');

  const candidates = [...phraseCount.entries()]
    .filter(([, c]) => c.founder >= 1 && c.founder + c.ai >= 2)
    .filter(([ph]) => !priorText.includes(ph));
  const autoAi = candidates.filter(([, c]) => c.firstWho === 'ai');
  // 창업자가 **여러 턴에 걸쳐** 쓴 것 = 어휘로 정착한 것 (붙여넣기 1턴과 구분)
  const settled = candidates.filter(([, c]) => c.founder >= 2);
  const settledAi = settled.filter(([, c]) => c.firstWho === 'ai');

  out('[M4-자동] 손으로 고르지 않은 개념구 — 규칙만으로 추출');
  out('  조건: 창업자 발화 등장 + 대화 이전 저장소에 없음 + 2턴 이상 (2~3어절)');
  out('  ※ 출현 수가 아니라 **턴 수**로 센다 — 한 턴 안의 반복(붙여넣기)은 1회다');
  out(`  모집단 ${candidates.length}개 중 AI 최초 발화: ${pct(autoAi.length, candidates.length)}`);
  out(`  창업자가 2턴 이상 쓴 것(어휘 정착) ${settled.length}개 중 AI 최초: ${pct(settledAi.length, settled.length)}`);
  const topAuto = settledAi.sort((a, b) => b[1].founder - a[1].founder || b[1].ai - a[1].ai).slice(0, 12);
  out('  창업자가 여러 턴에 걸쳐 쓴 AI 발원 구 (상위):');
  for (const [ph, c] of topAuto) out(`    AI ${c.firstTs.slice(5, 16)} · 창업자 ${c.founder}턴/AI ${c.ai}턴 · "${ph}"`);
  out('');
}

const censusPath = join(here, 'census-log.json');
if (existsSync(censusPath)) {
  const census = JSON.parse(readFileSync(censusPath, 'utf8'));

  out('[M4-하중] 창업자 지시문에 쓰인 개념구 — 누가 먼저 말했나');
  out('  (census-log.json 고정 목록 · 귀속은 타임스탬프가 결정)');
  let ai = 0, fo = 0;
  const rows = [];
  for (const item of census.load_bearing_phrases) {
    const first = firstUtteranceOf(item.phrase);
    if (!first) { rows.push(['—', item.phrase, '대화에 없음']); continue; }
    const inPrior = priorVocab.size ? item.in_prior_repo : null;
    const who = first.who === 'ai' ? 'AI' : '창업자';
    if (first.who === 'ai') ai += 1; else fo += 1;
    rows.push([
      who,
      item.phrase,
      `최초 ${first.ts.slice(5, 16)} · 창업자 사용 ${countUtterances(item.phrase, 'founder')}회` +
        (inPrior ? ' · 대화 이전 저장소에 있던 말' : ''),
    ]);
  }
  for (const [w, p, n] of rows) out(`  ${String(w).padEnd(4)} ${p.padEnd(26)} ${n}`);
  out(`  → 하중 개념구 ${ai + fo}개 중 AI 최초 발화: ${pct(ai, ai + fo)}`);
  out('');

  out('[M4-지시] AI 어휘로만 구성된 창업자 지시문 (census 고정 · 원문)');
  for (const d of census.ai_vocabulary_directives) {
    out(`  ${d.ts} · "${d.quote}"`);
    out(`      AI 발원 개념: ${d.ai_origin_terms.join(' · ')} (최초 발화 ${d.coined_at})`);
  }
  out(`  창업자 지시문 ${census.directive_census.total_directives}건 중 AI 발원 어휘 지시: ${pct(census.ai_vocabulary_directives.length, census.directive_census.total_directives)}`);
  out('');

  out('[M4-반대증거] 창업자가 AI 어휘·설명을 명시적으로 거부한 발화 (census 고정 · 원문)');
  for (const r of census.comprehension_rejections) out(`  ${r.ts} · "${r.quote}"`);
  out(`  → 지시문 ${census.directive_census.total_directives}건 중 이해 실패·거부 표명: ${pct(census.comprehension_rejections.length, census.directive_census.total_directives)}`);
  out('');

  if (census.recall_pairs && census.recall_pairs.length) {
    out('[M1-회고] 창업자가 과거를 되짚은 발화 대 당시 실제 발화 (census 고정)');
    for (const p of census.recall_pairs) {
      out(`  - 회고(${p.recall_ts}): "${p.recall_quote}"`);
      out(`    당시(${p.vintage_ts}): "${p.vintage_quote}"`);
      out(`    판정: ${p.verdict}`);
    }
    const rewrites = census.recall_pairs.filter((p) => p.rewritten).length;
    out(`  대조쌍 ${census.recall_pairs.length}건 중 내용 불일치: ${pct(rewrites, census.recall_pairs.length)}`);
    out('');
  }
}

// 상위 AI 최초 발화 용어 (창업자 사용 빈도순) — 증거 표본
out('[표본] AI가 먼저 말했고 창업자가 가장 많이 쓴 용어 상위 25');
repeatedAiFirst
  .sort((a, b) => b[1].founder - a[1].founder)
  .slice(0, 25)
  .forEach(([term, c]) => {
    const fs_ = firstSpeaker.get(term);
    out(`  ${String(c.founder).padStart(3)}회(창업자) · AI 최초 ${fs_.ts.slice(5, 16)} · ${term}`);
  });
out('');
out('[대조] 창업자가 먼저 말했고 가장 많이 쓴 용어 상위 15');
founderFirst
  .sort((a, b) => b[1].founder - a[1].founder)
  .slice(0, 15)
  .forEach(([term, c]) => out(`  ${String(c.founder).padStart(3)}회 · ${term}`));

out('');
out('-'.repeat(64));
out('귀속은 타임스탬프 순서로만 결정 — 판단 개입 0. 한계: 용어 재사용 ≠ 믿음 채택.');
console.log(L.join('\n'));
