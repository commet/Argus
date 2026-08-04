// Plugin surface — CAPTURE-ONLY, and deliberately so.
//
// v1.0 §11.2: "Plugin은 R5 이후로 연기한다. semantic parity fixture에는
// 포함하되 production surface로 만들지 않는다." This module IS that fixture:
// it implements the plugin's one legitimate pre-R5 character — turning host
// artifacts (documents, issues, conversations) into provenance-preserving
// source events — and structurally refuses everything else.
//
// What a plugin never does here: propose, recommend, adopt, notify. Quiet
// capture in, honest provenance out. The loop continues on web/MCP.

import { Ledger, nextEventId } from '../ledger';
import { type IsoTime, type LedgerEvent } from '../types';

export interface HostArtifact {
  hostKind: 'document' | 'issue' | 'conversation';
  title: string;
  excerpt: string; // the plugin captures excerpts, not whole private stores
  sourceRef: string; // stable host reference (URL/id) — provenance anchor
  authoredBy: 'user' | 'third_party';
  capturedAt: IsoTime;
}

export interface CaptureResult {
  eventId: string;
  // A quiet trigger candidate the OTHER surfaces may surface later. The plugin
  // itself never notifies (§16.2: no notification plumbing before its time).
  quietTriggerCandidate?: { kind: 'possible_signal'; description: string };
}

const SIGNAL_HINTS = [/재방문/, /이탈/, /전환율/, /계약/, /답변/, /출시/, /retention/i, /churn/i, /conversion/i, /reply/i, /launch/i];

export function captureArtifact(ledger: Ledger, caseId: string, artifact: HostArtifact, now: IsoTime): CaptureResult {
  const id = nextEventId('cap');
  const event: LedgerEvent =
    artifact.authoredBy === 'user' && artifact.hostKind === 'conversation'
      ? { id, caseId, at: now, type: 'user_utterance', text: artifact.excerpt }
      : {
          id,
          caseId,
          at: now,
          type: 'external_source',
          description: `${artifact.hostKind}: ${artifact.title}`,
          sourceRef: artifact.sourceRef,
        };
  ledger.append(event);

  const hinted = SIGNAL_HINTS.some((p) => p.test(artifact.excerpt));
  return {
    eventId: id,
    quietTriggerCandidate: hinted
      ? { kind: 'possible_signal', description: `호스트 자료가 기다리던 signal일 수 있습니다: ${artifact.title}` }
      : undefined,
  };
}

// Loud tombstones for the capabilities this surface must not grow before R5 —
// a refactor that wants them has to delete these lines in a reviewed diff.
export function proposeViaPlugin(): never {
  throw new Error('PLUGIN_CANNOT_PROPOSE: the plugin captures sources; proposals belong to web/MCP (v1.0 §11.2).');
}
export function adoptViaPlugin(): never {
  throw new Error('PLUGIN_CANNOT_ADOPT: adoption is an explicit user act on web (v1.0 §6.6, §11.2).');
}
export function notifyViaPlugin(): never {
  throw new Error('PLUGIN_CANNOT_NOTIFY: no notification plumbing before return value is proven (v1.0 §16.2).');
}
