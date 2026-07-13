/**
 * 연결 읽기의 IO 껍데기 (정본 §8-§11) — v2 원장을 읽어 같은 전제·근거에 선 다른
 * 열린 결정을 찾는다. best-effort: git repo가 아니거나(commonDir 없음) v2 미init·
 * 읽기 실패면 빈 배열 — 호출한 도구(정산·포착)는 이 결과와 무관하게 성공한다.
 * 순수 매칭은 connection.ts에 있고, 여기서는 상태 로딩만 한다. 정산 표면과 포착
 * 표면이 연결을 '똑같이' 읽도록 이 셸을 단일 소스로 공유한다 (드리프트 방지).
 */
import { argusHome } from './ledger.js';
import { loadState } from './reducer.js';
import { contextFor } from './bridge.js';
import { gitCommonDirOf } from './git-discovery.js';
import { relatedOpenDecisions, type RelatedDecision } from './connection.js';

/** 전제 텍스트 여러 개(포착 시 load-bearing 가정 + 전제들)로 한 번에 조회한다.
 *  v2 상태는 한 번만 로드하고 텍스트마다 순수 매칭을 돌린다. 한 결정이 여러
 *  텍스트로 걸리면 same_premise(더 강한 연결)를 우선한다. 결정론적 순서. */
export function relatedOpenForPremises(dir: string, today: string, texts: string[], decisionId: string): RelatedDecision[] {
  try {
    const nonEmpty = texts.filter((t) => typeof t === 'string' && t.trim());
    if (nonEmpty.length === 0) return [];
    const commonDir = gitCommonDirOf(dir);
    if (!commonDir) return [];
    const ctx = contextFor({
      home: argusHome(), gitCommonDir: commonDir, workspaceArgusDir: dir,
      sessionId: `mcp-${process.pid}`, producerVersion: '2.0.0', today,
    });
    const state = loadState(ctx.home, ctx.repository_id);
    const byDecision = new Map<string, RelatedDecision>();
    for (const text of nonEmpty) {
      for (const r of relatedOpenDecisions(state, text, decisionId)) {
        const existing = byDecision.get(r.decision_id);
        if (!existing || (r.reason === 'same_premise' && existing.reason !== 'same_premise')) {
          byDecision.set(r.decision_id, r);
        }
      }
    }
    return [...byDecision.values()].sort((a, b) => (a.decision_id < b.decision_id ? -1 : 1));
  } catch {
    return [];
  }
}

/** 단일 전제 텍스트 편의형 (정산 표면이 쓰는 형태). */
export function relatedOpenForPremise(dir: string, today: string, premiseText: string, decisionId: string): RelatedDecision[] {
  return relatedOpenForPremises(dir, today, [premiseText], decisionId);
}
