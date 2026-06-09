'use client';

/**
 * DeployResumeBanners — the crew deploy + resume controls lifted out of
 * ProgressiveFlow: the TeamDeployBanner (captain's seat, shown when a team is
 * staged) and the resume banner (offered after a crash/reload leaves work
 * unfinished). Parent owns teamDeployRef and the on* handlers, passed in.
 */

import type { Dispatch, SetStateAction, RefObject } from 'react';
import { motion } from 'framer-motion';
import { useLocale } from '@/hooks/useLocale';
import { TeamDeployBanner } from './TeamDeployBanner';
import type { WorkerTask } from '@/stores/types';
import type { ProgressiveState } from '@/stores/useProgressiveStore';
import type { PoolModalState } from './TeamAssignmentModal';

interface DeployResumeBannersProps {
  deployPhase: string;
  workers: WorkerTask[];
  teamDeployRef: RefObject<HTMLDivElement | null>;
  onDeployWorkers: () => void;
  store: ProgressiveState;
  setPoolModal: Dispatch<SetStateAction<PoolModalState>>;
  isResumable: boolean;
  onResumeWorkers: () => void;
}

export function DeployResumeBanners({
  deployPhase, workers, teamDeployRef, onDeployWorkers, store, setPoolModal,
  isResumable, onResumeWorkers,
}: DeployResumeBannersProps) {
  const locale = useLocale();
  const L = (ko: string, en: string) => (locale === 'ko' ? ko : en);
  return (
    <>
          {/* Team deploy banner — 사용자 확인 후 worker 실행 */}
          {deployPhase === 'ready' && workers.length > 0 && (
            <div ref={teamDeployRef}>
            <TeamDeployBanner
              workers={workers}
              onDeploy={onDeployWorkers}
              onUpdateWorker={(id, partial) => store.updateWorker(id, partial)}
              onOpenPool={(groupId) => setPoolModal({ mode: 'task', targetGroupId: groupId })}
              onOpenFreePool={() => setPoolModal({ mode: 'free' })}
              onRemoveWorker={(id) => store.removeWorker(id)}
              onReplaceWorker={(id) => setPoolModal({ mode: 'replace', workerId: id })}
              onUpdateTask={(groupId, text) => store.updateGroupTask(groupId, text)}
              onSetGroupTrack={(groupId, track) => store.setGroupTrack(groupId, track)}
            />
            </div>
          )}

          {/* Resume banner — 크래시/새로고침 후 미완료 작업 재개 */}
          {isResumable && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mx-4 mt-3 p-4 rounded-xl border border-amber-500/30 bg-amber-500/5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-[13px] text-amber-600 dark:text-amber-400">
                  <span>⟳</span>
                  <span>{L('중단된 작업이 있습니다', 'Interrupted tasks found')}</span>
                  <span className="text-[var(--text-tertiary)]">
                    ({workers.filter(w => w.status === 'done').length}/{workers.length} {L('완료', 'done')})
                  </span>
                </div>
                <button onClick={onResumeWorkers}
                  className="px-3 py-1.5 text-[13px] font-medium rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors">
                  {L('이어서 실행', 'Resume')}
                </button>
              </div>
            </motion.div>
          )}
    </>
  );
}
