'use client';

import { motion } from 'framer-motion';

interface TabItem {
  key: string;
  label: string;
  count?: number;
}

interface TabProps {
  tabs: TabItem[];
  activeKey: string;
  onChange: (key: string) => void;
}

export function Tab({ tabs, activeKey, onChange }: TabProps) {
  return (
    <div className="flex gap-0.5 bg-[var(--bg)] p-1 rounded-xl overflow-x-auto relative border border-[var(--border-subtle)] shadow-[var(--shadow-xs)]">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={`
            relative px-4 py-2 text-[13px] whitespace-nowrap rounded-lg
            transition-colors duration-200 cursor-pointer z-10
            ${
              activeKey === tab.key
                ? 'text-[var(--text-primary)] font-semibold'
                : 'text-[var(--text-secondary)] font-medium hover:text-[var(--text-primary)]'
            }
          `}
        >
          {activeKey === tab.key && (
            <motion.div
              layoutId="tab-indicator"
              className="absolute inset-0 bg-[var(--surface)] rounded-lg shadow-[var(--shadow-sm)] border-b-2 border-b-[var(--accent)]"
              style={{ zIndex: -1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            />
          )}
          {tab.label}
          {tab.count !== undefined && (
            <span className={`ml-1.5 text-[11px] px-1.5 py-0.5 rounded-full ${
              activeKey === tab.key ? 'bg-[var(--bg)]' : 'bg-[var(--surface)]'
            }`}>
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
