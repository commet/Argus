'use client';

/**
 * TeamAssignmentModal — the manual crew-assignment overlay lifted out of
 * ProgressiveFlow's render. Wraps PersonaPoolModal and derives the per-group
 * info (task / ai-scope / personas) from the live worker list at render time,
 * so it always reflects the latest store. Handles all three modes (task / free
 * / replace); the open/close state (`poolModal`) still lives in the parent and
 * arrives as a prop. Behaviour-preserving: returns null in exactly the same
 * cases the inline IIFE did.
 */

import type { Dispatch, SetStateAction } from 'react';
import { PersonaPoolModal } from './PersonaPoolModal';
import type { WorkerTask } from '@/stores/types';
import type { ProgressiveState } from '@/stores/useProgressiveStore';
import type { useWorkerActions } from '@/hooks/useWorkerActions';

export type PoolModalState =
  | { mode: 'task'; targetGroupId: string }
  | { mode: 'free' }
  | { mode: 'replace'; workerId: string; rerun?: boolean }
  | null;

interface TeamAssignmentModalProps {
  poolModal: PoolModalState;
  workers: WorkerTask[];
  setPoolModal: Dispatch<SetStateAction<PoolModalState>>;
  store: ProgressiveState;
  workerActions: ReturnType<typeof useWorkerActions>;
}

export function TeamAssignmentModal({ poolModal, workers, setPoolModal, store, workerActions }: TeamAssignmentModalProps) {
  if (!poolModal) return null;
  // Build group info list (used by both modes — task-mode uses the
  // target group's data, free-mode iterates for best-match).
  const groupBuckets = new Map<string, WorkerTask[]>();
  const groupOrder: string[] = [];
  for (const w of workers) {
    const gid = w.task_group_id || w.id;
    if (!groupBuckets.has(gid)) {
      groupBuckets.set(gid, []);
      groupOrder.push(gid);
    }
    groupBuckets.get(gid)!.push(w);
  }
  const groupInfos = groupOrder.map(gid => {
    const members = groupBuckets.get(gid)!;
    const seed = members[0];
    return {
      groupId: gid,
      task: seed.task,
      aiScope: seed.ai_scope ?? null,
      expectedOutput: seed.expected_output ?? null,
      memberCount: members.length,
      personaIds: members.map(m => m.persona?.id).filter((x): x is string => !!x),
    };
  });

  if (poolModal.mode === 'task') {
    const target = groupInfos.find(g => g.groupId === poolModal.targetGroupId);
    if (!target) return null;
  }

  // Replace mode targets a single worker, not a group.
  const replaceWorker = poolModal.mode === 'replace'
    ? workers.find(w => w.id === poolModal.workerId)
    : undefined;
  if (poolModal.mode === 'replace' && !replaceWorker) return null;

  return (
    <PersonaPoolModal
      isOpen
      mode={poolModal.mode}
      targetGroupId={poolModal.mode === 'task' ? poolModal.targetGroupId : undefined}
      replaceInfo={replaceWorker ? {
        task: replaceWorker.task,
        aiScope: replaceWorker.ai_scope ?? null,
        expectedOutput: replaceWorker.expected_output ?? null,
        currentPersonaId: replaceWorker.persona?.id,
        siblingPersonaIds: workers
          .filter(w => w.id !== replaceWorker.id
            && (w.task_group_id || w.id) === (replaceWorker.task_group_id || replaceWorker.id))
          .map(w => w.persona?.id)
          .filter((x): x is string => !!x),
      } : undefined}
      groups={groupInfos}
      maxPerGroup={5}
      onClose={() => setPoolModal(null)}
      onSelect={(persona, matchedGroupId) => {
        if (poolModal.mode === 'replace') {
          const { workerId, rerun } = poolModal;
          store.replaceWorkerPersona(workerId, persona);
          // Report-stage re-assignment: the swap resets the worker to
          // 'pending', but nothing auto-runs post-deploy — kick off the
          // fresh take immediately so the captain sees a new result.
          if (rerun) workerActions.handleRetry(workerId);
          setPoolModal(null);
          return;
        }
        const newId = store.addWorkerToGroup(matchedGroupId, persona);
        if (newId) setPoolModal(null);
      }}
    />
  );
}
