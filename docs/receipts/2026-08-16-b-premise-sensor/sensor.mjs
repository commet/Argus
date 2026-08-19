#!/usr/bin/env node
/**
 * 판별 실험 B — 전제 센서망 (재정초 브리프 §4 B)
 *
 * 전제를 관찰 가능한 외부 신호에 결박하고, 신호를 읽어 원장에 적고, 임계를
 * 넘으면 경보한다. 경보가 곧 귀환 사유다 — "당신의 전제 중 하나가 방금
 * 흔들렸습니다"는 어떤 달력 리마인더보다 강한 귀환 사유다.
 *
 * 감시 대상은 **세계**이지 사람이 아니다 (프로파일링 금지와 무충돌).
 *
 * 임계값은 검증 불가능한 사전 믿음이므로 코드에 숨기지 않고 premises.json에
 * 노출한다 (P6). 이 스크립트는 그 선언을 집행만 한다.
 *
 * 사용법:
 *   node sensor.mjs read   <premises.json> <ledger.jsonl> --at <ISO8601>
 *   node sensor.mjs report <premises.json> <ledger.jsonl>
 *
 * Supabase 신호는 환경변수가 있을 때만 읽는다 — 없으면 'unavailable'로
 * 정직하게 남기고 절대 추정하지 않는다 (조용한 공백 금지).
 */
import { readFileSync, existsSync, appendFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const [, , cmd, premisesPath, ledgerPath] = process.argv;
if (!cmd || !premisesPath || !ledgerPath) {
  console.error('사용법: sensor.mjs read|report <premises.json> <ledger.jsonl> [--at <ISO8601>]');
  process.exit(2);
}
const spec = JSON.parse(readFileSync(premisesPath, 'utf8'));

// ------------------------------------------------------------------ 신호 판독
const READERS = {
  npm_version({ pkg }) {
    try {
      const v = execSync(`npm view ${pkg} version`, { encoding: 'utf8', timeout: 60_000 }).trim();
      return { ok: true, value: v };
    } catch (e) {
      return { ok: false, value: null, error: String(e.message).slice(0, 120) };
    }
  },
  http_status({ url }) {
    try {
      const c = execSync(`curl -s -o /dev/null -w '%{http_code}' --max-time 25 ${JSON.stringify(url)}`, { encoding: 'utf8' }).trim();
      return c === '000' ? { ok: false, value: null, error: '연결 실패' } : { ok: true, value: c };
    } catch (e) {
      return { ok: false, value: null, error: String(e.message).slice(0, 120) };
    }
  },
  supabase_count() {
    // 판독은 MCP 세션에서 수행하고 --inject 로 주입한다. 자동 실행 환경에
    // 자격증명이 없을 때 값을 지어내지 않기 위해 여기서는 미가용으로 남긴다.
    return { ok: false, value: null, error: 'unavailable — Supabase 자격증명 없음 (주입 필요)' };
  },
  supabase_recent() {
    return { ok: false, value: null, error: 'unavailable — Supabase 자격증명 없음 (주입 필요)' };
  },
  supabase_distinct() {
    return { ok: false, value: null, error: 'unavailable — Supabase 자격증명 없음 (주입 필요)' };
  },
  manual({ how }) {
    return { ok: false, value: null, error: `manual — ${how}` };
  },
};

// 주입: --inject '{"P3-...": 2, "P4-...": 1234}'
function injected() {
  const i = process.argv.indexOf('--inject');
  if (i === -1) return {};
  try { return JSON.parse(process.argv[i + 1]); } catch { return {}; }
}

// ------------------------------------------------------------------ 임계 판정
function verdict(p, value, prevReadings) {
  if (value === null || value === undefined) return { state: 'unread', why: '신호 미가용 — 판정하지 않는다' };
  switch (p.signal.type) {
    case 'npm_version': {
      const cmp = (a, b) => {
        const pa = String(a).split('.').map(Number), pb = String(b).split('.').map(Number);
        for (let i = 0; i < 3; i += 1) { if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0); }
        return 0;
      };
      return cmp(value, p.baseline) < 0
        ? { state: 'alert', why: `버전이 baseline(${p.baseline})보다 낮다 — yank 의심` }
        : { state: 'holds', why: `${value} ≥ baseline ${p.baseline}` };
    }
    case 'http_status': {
      const n = Number(value);
      return n >= 500
        ? { state: 'alert', why: `${n} — 서버 오류` }
        : { state: 'holds', why: `${n} — 응답함` };
    }
    case 'supabase_count': {
      const prior = prevReadings.filter((r) => r.value !== null);
      if (!prior.length) return { state: 'holds', why: `첫 판독 ${value} — 변화 판정 불가(기준선 수립)` };
      const week = prior[prior.length - 1];
      return value === week.value
        ? { state: 'watch', why: `직전 판독과 동일(${value}) — 초대 발송 사실과 함께 읽어야 한다` }
        : { state: 'holds', why: `${week.value} → ${value}` };
    }
    case 'supabase_recent':
      return Number(value) === 0
        ? { state: 'alert', why: '최근 7일 이벤트 0 — 생존 신호 끊김' }
        : { state: 'holds', why: `최근 7일 ${value}건` };
    case 'supabase_distinct':
      return Number(value) <= Number(p.baseline)
        ? { state: 'alert', why: `7일 고유 사용자 ${value}명 ≤ 임계 ${p.baseline} — 활동량이 아니라 사람 수가 붕괴` }
        : { state: 'holds', why: `7일 고유 사용자 ${value}명` };
    default:
      return { state: 'unread', why: '자동 판정기 없음' };
  }
}

// ------------------------------------------------------------------ read
if (cmd === 'read') {
  const atIdx = process.argv.indexOf('--at');
  const at = atIdx > -1 ? process.argv[atIdx + 1] : null;
  if (!at) { console.error('--at <ISO8601> 필수 — 스크립트가 시각을 지어내지 않는다 (결정론)'); process.exit(2); }
  const inj = injected();
  const prior = existsSync(ledgerPath)
    ? readFileSync(ledgerPath, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
    : [];

  const lines = [];
  lines.push(`전제 센서망 판독 — ${at}`);
  lines.push('='.repeat(64));
  let alerts = 0, unread = 0;
  for (const p of spec.premises) {
    let r;
    if (Object.prototype.hasOwnProperty.call(inj, p.id)) {
      r = { ok: true, value: inj[p.id], injected: true };
    } else {
      r = READERS[p.signal.type](p.signal.args || {});
    }
    const prev = prior.filter((e) => e.premise_id === p.id);
    const v = verdict(p, r.ok ? r.value : null, prev);
    if (v.state === 'alert') alerts += 1;
    if (v.state === 'unread') unread += 1;
    appendFileSync(ledgerPath, JSON.stringify({
      v: 1, event: 'signal_read', at, premise_id: p.id,
      signal: p.signal.type, value: r.ok ? r.value : null,
      error: r.ok ? null : r.error, injected: !!r.injected, state: v.state, why: v.why,
    }) + '\n');
    const mark = { holds: '유지', alert: '경보', watch: '주시', unread: '미판독' }[v.state];
    lines.push(`${mark} · ${p.id}`);
    lines.push(`      전제: ${p.premise}`);
    lines.push(`      신호: ${p.signal.type} = ${r.ok ? r.value : `(${r.error})`}${r.injected ? ' [주입]' : ''}`);
    lines.push(`      판정: ${v.why}`);
    if (v.state === 'alert') lines.push(`      귀환: 이 전제를 참조한 결정 — "${p.decision}" — 을 다시 연다`);
    lines.push('');
  }
  lines.push('-'.repeat(64));
  lines.push(`전제 ${spec.premises.length} · 경보 ${alerts} · 미판독 ${unread}`);
  lines.push(unread ? '미판독은 공백으로 남긴다 — 추정하지 않는다 (조용한 메움 금지).' : '');
  console.log(lines.join('\n'));
  process.exit(alerts ? 1 : 0);
}

// ------------------------------------------------------------------ report
if (cmd === 'report') {
  const rows = readFileSync(ledgerPath, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  const byPremise = new Map();
  for (const r of rows) {
    if (!byPremise.has(r.premise_id)) byPremise.set(r.premise_id, []);
    byPremise.get(r.premise_id).push(r);
  }
  const L = ['전제 센서망 원장 요약', '='.repeat(64), ''];
  for (const [id, rs] of byPremise) {
    const readable = rs.filter((r) => r.value !== null);
    L.push(`${id}`);
    L.push(`  판독 ${rs.length}회 · 값 확보 ${readable.length}회 · 경보 ${rs.filter((r) => r.state === 'alert').length}회`);
    L.push(`  이력: ${rs.map((r) => `${r.at.slice(5, 10)}=${r.value === null ? '−' : r.value}`).join(' ')}`);
    L.push('');
  }
  const alerts = rows.filter((r) => r.state === 'alert');
  L.push('-'.repeat(64));
  L.push(`총 판독 ${rows.length} · 경보 ${alerts.length}`);
  L.push('브리프 §4 B의 판별 질문: 경보 1건이 실제 재판단을 유발했는가?');
  L.push(alerts.length ? '  → 경보 발생. 재판단 여부는 사람이 판정해 리시트에 적는다.' : '  → 아직 경보 없음 — 판별 불가. 관측을 더 쌓아야 한다.');
  console.log(L.join('\n'));
  process.exit(0);
}

console.error('알 수 없는 명령');
process.exit(2);
