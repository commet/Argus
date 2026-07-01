'use client';

/**
 * Decision Items card — the editable, tracked premises/phenomena/open-questions of
 * a decision, shown next to DecisionContractCard on the project page.
 *
 * Design: docs/DESIGN-decision-items-living-premises-2026-07-01.md
 *
 * Editing is the DEFAULT posture: AI-extracted items are drafts the user fixes,
 * and every correction is recorded as signal (recordEdit via the store). No verdict
 * about the user; the alert toggle is per-item and opt-out (mostly off). Copy is
 * literal — no metaphor (DESIGN §2).
 *
 * Population: reuses the reframe step's hidden_assumptions (the same assumptions the
 * user already saw) rather than a second extraction — so it can't drift, and there
 * is no surprise LLM call. The user imports them, then corrects.
 */

import { useEffect, useMemo, useState } from 'react';
import { Bell, BellOff, Pencil, Trash2, Check, X, ListChecks } from 'lucide-react';
import { useLocale } from '@/hooks/useLocale';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { getStorage, STORAGE_KEYS } from '@/lib/storage';
import { useDecisionItemsStore } from '@/stores/useDecisionItemsStore';
import { createItem, type ItemType } from '@/lib/decision-items';
import type { Project, ReframeItem } from '@/stores/types';

const TYPE_ORDER: ItemType[] = ['premise', 'phenomenon', 'open_question'];
const TYPE_LABEL: Record<ItemType, { ko: string; en: string }> = {
  premise: { ko: '전제', en: 'Premises' },
  phenomenon: { ko: '현상', en: 'Observations' },
  open_question: { ko: '미결', en: 'Open questions' },
  conclusion: { ko: '결론', en: 'Conclusions' },
  prediction: { ko: '예측', en: 'Predictions' },
};

export function DecisionItemsCard({ project }: { project: Project }) {
  const locale = useLocale();
  const ko = locale === 'ko';
  const L = (k: string, e: string) => (ko ? k : e);

  const items = useDecisionItemsStore((s) => s.items);
  const loadData = useDecisionItemsStore((s) => s.loadData);
  const addItems = useDecisionItemsStore((s) => s.addItems);
  const editItem = useDecisionItemsStore((s) => s.editItem);
  const setAlert = useDecisionItemsStore((s) => s.setAlert);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    loadData();
  }, [loadData]);

  const mine = useMemo(
    () => items.filter((i) => i.decision_id === project.id && i.status !== 'retired'),
    [items, project.id],
  );

  // Derive premise texts from the reframe step's already-surfaced assumptions.
  const derivable = useMemo(() => {
    if (mine.length > 0) return [] as string[];
    const rfs = getStorage<ReframeItem[]>(STORAGE_KEYS.REFRAME_LIST, []).filter(
      (r) => r.project_id === project.id,
    );
    const latest = rfs[rfs.length - 1];
    const assumptions = latest?.analysis?.hidden_assumptions || [];
    return assumptions.map((a) => a?.assumption).filter((t): t is string => !!t && !!t.trim());
  }, [mine.length, project.id]);

  function importPremises() {
    const now = Date.now();
    const derived = derivable.map((text) =>
      createItem(
        { decision_id: project.id, type: 'premise', text, source: 'ai', external: false, load_bearing: false, ai_original: text },
        now,
      ),
    );
    addItems(derived);
  }

  function startEdit(id: string, text: string) {
    setEditingId(id);
    setDraft(text);
  }
  function saveEdit(id: string) {
    const next = draft.trim();
    if (next) editItem(id, 'refine', next);
    setEditingId(null);
    setDraft('');
  }

  // Nothing to show and nothing to import → render nothing (no empty ceremony).
  if (mine.length === 0 && derivable.length === 0) return null;

  const grouped = TYPE_ORDER.map((type) => ({ type, list: mine.filter((i) => i.type === type) })).filter(
    (g) => g.list.length > 0,
  );

  return (
    <Card className="border-[var(--border)]">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-[var(--bg)] text-[var(--text-secondary)] flex items-center justify-center shrink-0">
          <ListChecks size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-[15px] font-bold text-[var(--text-primary)]">
            {L('결정 항목', 'Decision items')}
          </h3>
          <p className="text-[12.5px] text-[var(--text-secondary)] mt-1 leading-[1.55]">
            {L('AI가 뽑았어요. 틀린 건 고치세요.', 'AI extracted these. Fix anything that is wrong.')}
          </p>

          {mine.length === 0 ? (
            <div className="mt-3">
              <Button variant="secondary" size="sm" onClick={importPremises}>
                {L(`전제 ${derivable.length}개 불러와서 추적하기`, `Track ${derivable.length} premise${derivable.length === 1 ? '' : 's'}`)}
              </Button>
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              {grouped.map(({ type, list }) => (
                <div key={type}>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)] mb-1.5">
                    {L(TYPE_LABEL[type].ko, TYPE_LABEL[type].en)}
                  </p>
                  <ul className="space-y-1.5">
                    {list.map((item) => {
                      const editing = editingId === item.id;
                      const alertOn = item.alert.mode === 'on_change';
                      const edited = item.authored === 'ai_edited_by_user';
                      return (
                        <li
                          key={item.id}
                          className="rounded-lg border border-[var(--border)] p-2.5 bg-[var(--surface)]"
                        >
                          {editing ? (
                            <div className="space-y-2">
                              <textarea
                                value={draft}
                                onChange={(e) => setDraft(e.target.value)}
                                rows={2}
                                autoFocus
                                className="w-full text-[13px] text-[var(--text-primary)] bg-[var(--bg)] border border-[var(--accent)]/40 rounded-md p-2 leading-[1.5] resize-none focus:outline-none focus:border-[var(--accent)]"
                              />
                              <div className="flex gap-1.5">
                                <button
                                  onClick={() => saveEdit(item.id)}
                                  className="px-2.5 py-1.5 rounded-md text-[12.5px] font-semibold border border-[var(--accent)] bg-[var(--accent)] text-white inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <Check size={13} /> {L('저장', 'Save')}
                                </button>
                                <button
                                  onClick={() => { setEditingId(null); setDraft(''); }}
                                  className="px-2.5 py-1.5 rounded-md text-[12.5px] font-medium border border-[var(--border)] text-[var(--text-secondary)] inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <X size={13} /> {L('취소', 'Cancel')}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-start gap-2">
                              <p className="text-[13px] text-[var(--text-primary)] leading-[1.5] flex-1 min-w-0">
                                {item.text}
                                {edited && (
                                  <span className="ml-1.5 text-[10.5px] text-[var(--text-tertiary)] align-middle">
                                    {L('(수정함)', '(edited)')}
                                  </span>
                                )}
                              </p>
                              <div className="flex items-center gap-0.5 shrink-0">
                                {item.type === 'premise' && (
                                  <button
                                    onClick={() => setAlert(item.id, alertOn ? 'off' : 'on_change')}
                                    title={alertOn ? L('바뀌면 알림 켜짐', 'Alert on change: on') : L('알림 꺼짐', 'Alert off')}
                                    aria-pressed={alertOn}
                                    className={`p-1.5 rounded-md cursor-pointer transition-colors ${
                                      alertOn ? 'text-[var(--accent)]' : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
                                    }`}
                                  >
                                    {alertOn ? <Bell size={14} /> : <BellOff size={14} />}
                                  </button>
                                )}
                                <button
                                  onClick={() => startEdit(item.id, item.text)}
                                  title={L('수정', 'Edit')}
                                  className="p-1.5 rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] cursor-pointer"
                                >
                                  <Pencil size={14} />
                                </button>
                                <button
                                  onClick={() => editItem(item.id, 'reject', '')}
                                  title={L('삭제', 'Remove')}
                                  className="p-1.5 rounded-md text-[var(--text-tertiary)] hover:text-[var(--danger)] cursor-pointer"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
              <p className="text-[11px] text-[var(--text-tertiary)] leading-[1.5]">
                {L(
                  '전제 옆 종을 켜면, 그 사실이 바뀔 때만 알려드려요.',
                  'Turn on the bell next to a premise to be told only when that fact changes.',
                )}
              </p>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
