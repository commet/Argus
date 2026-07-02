'use client';

import { useEffect, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAgentStore } from '@/stores/useAgentStore';
import type { Agent } from '@/stores/agent-types';
import { useLocale } from '@/hooks/useLocale';

const TOAST_DURATION = 5000;

export function UnlockToast() {
  const locale = useLocale();
  const lastUnlockedIds = useAgentStore(s => s.lastUnlockedIds);
  const clearUnlocked = useAgentStore(s => s.clearUnlocked);
  const agents = useAgentStore(s => s.agents);
  const [queue, setQueue] = useState<Agent[]>([]);

  useEffect(() => {
    if (lastUnlockedIds.length === 0) return;

    const unlocked = lastUnlockedIds
      .map(id => agents.find(a => a.id === id))
      .filter((a): a is Agent => !!a);

    if (unlocked.length > 0) {
      setQueue(unlocked);
    }
  }, [lastUnlockedIds, agents]);

  const dismiss = useCallback(() => {
    setQueue([]);
    clearUnlocked();
  }, [clearUnlocked]);

  useEffect(() => {
    if (queue.length === 0) return;
    const timer = setTimeout(dismiss, TOAST_DURATION);
    return () => clearTimeout(timer);
  }, [queue, dismiss]);

  return (
    <div className="unlock-toast-container">
      <AnimatePresence>
        {queue.map((agent, i) => {
          const displayName = locale === 'en' && agent.nameEn ? agent.nameEn : agent.name;
          const displayRole = locale === 'en' && agent.roleEn ? agent.roleEn : agent.role;
          // Recognition, not game reward (02 P2-3): a crew member comes aboard.
          const unlockLine = locale === 'ko' ? `새 선원이 승선했어요 — ${displayRole}` : `${displayRole} came aboard`;
          return (
            <motion.button
              key={agent.id}
              initial={{ opacity: 0, y: 60, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30, delay: i * 0.12 }}
              className="unlock-toast"
              onClick={dismiss}
            >
              <div className="unlock-toast-glow" />
              <span className="unlock-toast-emoji">{agent.emoji}</span>
              <div className="unlock-toast-body">
                <p className="unlock-toast-name">{displayName}</p>
                <p className="unlock-toast-role">{unlockLine}</p>
              </div>
            </motion.button>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
