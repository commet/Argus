/**
 * LOGBOOK.md projection — v2 원장을 읽는 첫 표면 (P2-1).
 *
 * 정본 규칙 10: LOGBOOK은 **재생성 가능한 projection**이다 — write-through
 * 정본이 아니다. 원장(내구 홈)만이 정본이고, 이 파일은 언제든 지워도 다음
 * 갱신에서 동일하게 다시 태어난다. 그래서:
 *  - 렌더 입력은 BriefState **만** (규칙 6: 모든 renderer는 동일 BriefState
 *    소비 — statusline/check_in과 이 파일이 서로 다른 말을 할 방법이 없다).
 *  - 커서(I-1): 마지막 반영 event_id를 파일 안에 기록한다. 원장과 커서가
 *    다르면 stale — 읽는 쪽이 자동 재생성한다. 커서를 별도 파일이 아니라
 *    LOGBOOK 본문 footer에 두는 이유: 파일 하나가 통째로 지워지거나 통째로
 *    낡거나 둘 중 하나가 되게 (반쪽 상태 제거).
 *  - 사는 곳: worktree의 `.argus/LOGBOOK.md` (II-D: worktree .argus에는
 *    projection만 — 원장은 절대 여기 없다).
 *  - 쓰는 시점: 미러 관문이 v2 append 성공 후 락 **밖**에서 (규칙 11:
 *    LOGBOOK·영수증·.ics·sync는 락 밖).
 *
 * 렌더 원칙 (스파인): 사실과 손잡이만 — 평결·조언·추세 없음. quote류가
 * 들어오면 규칙 19 sanitize를 통과시킨다 (여기서는 사용자 자신의 predicate
 * 텍스트만 렌더하므로 길이 캡만 적용).
 */
import fs from 'node:fs';
import path from 'node:path';
import type { BriefState } from './brief.js';

const CURSOR_RE = /<!-- argus:last_event_id=([0-9A-HJKMNP-TV-Z]{26}|none) -->/;

export function logbookPath(workspaceArgusDir: string): string {
  return path.join(workspaceArgusDir, 'LOGBOOK.md');
}

/** 한 줄 안전화: 개행 제거 + 길이 캡 (LOGBOOK 표는 한 줄 셀이 계약). */
const line = (s: string, max = 120): string => {
  const flat = s.replace(/[\r\n|]/g, ' ').trim();
  return flat.length > max ? flat.slice(0, max - 1) + '…' : flat;
};

/** BriefState → LOGBOOK 마크다운. 순수 함수 — 골든 픽스처의 대상. */
export function renderLogbook(brief: BriefState, repositoryId: string): string {
  const out: string[] = [];
  out.push('# ARGUS LOGBOOK');
  out.push('');
  out.push(`> projection — 원장(\`~/.argus/projects/${repositoryId}/\`)에서 언제든 재생성됩니다. 직접 수정해도 다음 갱신에서 사라집니다.`);
  out.push(`> 기준일: ${brief.logical_date}`);
  out.push('');

  if (brief.due.length > 0) {
    out.push(`## 정산할 것 (${brief.due.length})`);
    out.push('');
    out.push('| 결정 | 예측 | 확인일 | 경과 |');
    out.push('|---|---|---|---|');
    for (const d of brief.due) {
      const days = d.overdue_days === 0 ? '오늘' : `+${d.overdue_days}일`;
      const tail = d.suggest_dismiss ? ' (2회 미룸 — dismiss 후보)' : '';
      out.push(`| ${line(d.decision_id, 40)} | ${line(d.predicate)} | ${d.check_by} | ${days}${tail} |`);
    }
    out.push('');
    out.push('→ `argus_settle`로 현실을 기록하세요. 미루려면 `argus_snooze`.');
    out.push('');
  } else {
    out.push('## 정산할 것');
    out.push('');
    out.push('오늘은 없습니다.');
    out.push('');
  }

  out.push(`## 살아있는 봉인: ${brief.sealed_alive}건`);
  out.push('');

  // 그물의 수동(pull) 표면 — 능동 1회 노출(pickNetOnce)과 별개로, 파일을
  // 열어본 사람에게는 봉인 안 된 수확이 숨지 않는다 (조용한 소실 금지).
  if (brief.unsealed_net.length > 0) {
    out.push(`## 봉인 대기 수확 (${brief.unsealed_net.length})`);
    out.push('');
    for (const n of brief.unsealed_net) {
      out.push(`- ${line(n.text)} — ${n.harvested_on} 수확 (봉인하려면 \`argus_seal\`)`);
    }
    out.push('');
  }

  if (brief.premise_rechecks_due.length > 0) {
    out.push(`## 재확인 도래 전제 (${brief.premise_rechecks_due.length})`);
    out.push('');
    for (const p of brief.premise_rechecks_due) {
      out.push(`- ${line(p.text)} — ${p.due_since}부터 (\`argus_recheck\`)`);
    }
    out.push('');
  }

  if (brief.open_questions.length > 0) {
    out.push(`## 열린 질문 (${brief.open_questions.length})`);
    out.push('');
    for (const q of brief.open_questions) out.push(`- ${line(q.text)}`);
    out.push('');
  }

  if (brief.candidates_active.length > 0 || brief.candidates_expired > 0) {
    out.push(`## 캡처 후보: ${brief.candidates_active.length}건 활성` +
      (brief.candidates_expired > 0 ? ` · ${brief.candidates_expired}건 14일 경과 소멸` : ''));
    out.push('');
  }

  // 정직성 카운터 — 0이 아니면 반드시 표면에 (조용한 소실 금지).
  const honesty: string[] = [];
  if (brief.anomalies > 0) honesty.push(`전이 이상 ${brief.anomalies}건 (조사 신호)`);
  if (brief.dropped_corrupt > 0) honesty.push(`파손 줄 ${brief.dropped_corrupt}건`);
  if (brief.skipped_unknown > 0) honesty.push(`미지 이벤트 ${brief.skipped_unknown}건 (신버전 기록 — 데이터는 안전)`);
  if (honesty.length > 0) {
    out.push('## 원장 상태');
    out.push('');
    for (const h of honesty) out.push(`- ${h}`);
    out.push('');
  }

  out.push('---');
  out.push(`<!-- argus:last_event_id=${brief.last_event_id ?? 'none'} -->`);
  out.push('');
  return out.join('\n');
}

/** 파일의 커서와 원장의 last_event_id 대조 — 다르면 stale (I-1 재생성 신호).
 *  파일 부재·커서 훼손도 stale이다 (반쪽 상태는 존재하지 않는 것으로 취급). */
export function logbookIsStale(workspaceArgusDir: string, ledgerLastEventId: string | null): boolean {
  let content: string;
  try {
    content = fs.readFileSync(logbookPath(workspaceArgusDir), 'utf8');
  } catch {
    return true;
  }
  const m = CURSOR_RE.exec(content);
  if (!m) return true;
  return m[1] !== (ledgerLastEventId ?? 'none');
}

/** 렌더 + 원자 쓰기 (tmp+rename — 반쯤 쓰인 LOGBOOK 방지). 실패는 던지지
 *  않고 false — projection 실패가 원장 쓰기를 오염하면 안 된다 (호출자가
 *  honest-gap으로 노출할지 결정). */
export function writeLogbook(workspaceArgusDir: string, brief: BriefState, repositoryId: string): boolean {
  try {
    fs.mkdirSync(workspaceArgusDir, { recursive: true });
    const target = logbookPath(workspaceArgusDir);
    const tmp = `${target}.tmp`;
    fs.writeFileSync(tmp, renderLogbook(brief, repositoryId), 'utf8');
    fs.renameSync(tmp, target);
    return true;
  } catch {
    return false;
  }
}
