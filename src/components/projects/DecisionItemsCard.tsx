'use client';

/**
 * Decision Items card — the editable, tracked premises/phenomena/open-questions of
 * a decision, shown next to DecisionContractCard on the project page.
 *
 * Design: internal design notes
 *
 * Editing is the DEFAULT posture: AI-extracted items are drafts the user fixes,
 * and every correction is recorded as signal (recordEdit via the store). No verdict
 * about the user; the alert toggle is per-item and opt-out (mostly off). Copy is
 * literal — no metaphor (DESIGN §2).
 *
 * Population: reuses assumptions the user already saw — no second extraction, no
 * surprise LLM call. Primary source is the progressive decision's own
 * `final_mix.key_assumptions` (+ the user's flinch bet); the legacy reframe
 * hidden_assumptions is a fallback (it only exists if the user exited to reframe
 * mid-flow, so it is empty for a normal sealed decision). The user imports, then
 * corrects.
 */

import { useEffect, useMemo, useState } from 'react';
import { Bell, BellOff, Pencil, Trash2, Check, X, ListChecks } from 'lucide-react';
import { useLocale } from '@/hooks/useLocale';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { getStorage, STORAGE_KEYS } from '@/lib/storage';
import { useDecisionItemsStore } from '@/stores/useDecisionItemsStore';
import {
  createItem,
  isItemDueForReconsider,
  isItemDueForRecheck,
  itemReconsiderDays,
  itemRecheckDays,
  type ItemType,
} from '@/lib/decision-items';
import { derivePremiseTexts } from '@/lib/derive-premise-texts';
import type { Project, ReframeItem, ProgressiveSession } from '@/stores/types';

const TYPE_ORDER: ItemType[] = ['premise', 'phenomenon', 'open_question'];
const TYPE_LABEL: Record<ItemType, { ko: string; en: string }> = {
  premise: { ko: '전제', en: 'Premises' },
  phenomenon: { ko: '현상', en: 'Observations' },
  open_question: { ko: '미결', en: 'Open questions' },
  conclusion: { ko: '결론', en: 'Conclusions' },
  prediction: { ko: '예측', en: 'Predictions' },
};

export function DecisionItemsCard({
  project,
  session,
}: {
  project: Project;
  /** The progressive voyage session for this project, if any — its
   *  final_mix.key_assumptions are the primary premise source. */
  session?: ProgressiveSession | null;
}) {
  const locale = useLocale();
  const ko = locale === 'ko';
  const L = (k: string, e: string) => (ko ? k : e);

  const items = useDecisionItemsStore((s) => s.items);
  const loadData = useDecisionItemsStore((s) => s.loadData);
  const addItems = useDecisionItemsStore((s) => s.addItems);
  const editItem = useDecisionItemsStore((s) => s.editItem);
  const toggleMonitoring = useDecisionItemsStore((s) => s.toggleMonitoring);
  const dismissAlert = useDecisionItemsStore((s) => s.dismissAlert);
  const markRechecked = useDecisionItemsStore((s) => s.markRechecked);

  // Pull-based "worth a look on return" clock (gaps #1/#2). Computed once per
  // render; the nudges are surfaced when the user opens the project, never pushed.
  const now = Date.now();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [newQ, setNewQ] = useState('');

  useEffect(() => {
    loadData();
  }, [loadData]);

  const mine = useMemo(
    () => items.filter((i) => i.decision_id === project.id && i.status !== 'retired'),
    [items, project.id],
  );

  // Derive premise texts. Primary: the progressive decision's own key assumptions
  // (present for a normally-sealed voyage). Fallback: legacy reframe handoff.
  const derivable = useMemo(() => {
    if (mine.length > 0) return [] as string[];
    const rfs = getStorage<ReframeItem[]>(STORAGE_KEYS.REFRAME_LIST, []).filter(
      (r) => r.project_id === project.id,
    );
    const latest = rfs[rfs.length - 1];
    const reframeTexts = (latest?.analysis?.hidden_assumptions || []).map((a) => a?.assumption);
    return derivePremiseTexts(session, reframeTexts);
  }, [mine.length, project.id, session]);

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
  // Open questions on the web are user-created only (never auto-derived from a
  // sealed decision — that would reopen a closed call; mirror clause).
  function addOpenQuestion() {
    const text = newQ.trim();
    if (!text) return;
    addItems([
      createItem({ decision_id: project.id, type: 'open_question', text, source: 'user' }, Date.now()),
    ]);
    setNewQ('');
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
                      const alertOn = item.alert?.mode === 'on_change';
                      const edited = item.authored === 'ai_edited_by_user';
                      return (
                        <li
                          key={item.id}
                          id={`decision-item-${item.id}`}
                          className="scroll-mt-24 rounded-lg border border-[var(--border)] p-2.5 bg-[var(--surface)]"
                        >
                          {editing ? (
                            <div className="space-y-2">
                              <textarea
                                aria-label={L('결정 항목 수정', 'Edit decision item')}
                                value={draft}
                                onChange={(e) => setDraft(e.target.value)}
                                rows={2}
                                maxLength={500}
                                autoFocus
                                className="w-full text-[13px] text-[var(--text-primary)] bg-[var(--bg)] border border-[var(--accent)]/40 rounded-md p-2 leading-[1.5] resize-none focus:outline-none focus:border-[var(--accent)]"
                              />
                              <div className="flex gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => saveEdit(item.id)}
                                  className="px-2.5 py-1.5 rounded-md text-[12.5px] font-semibold border border-[var(--accent)] bg-[var(--accent)] text-white inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <Check size={13} /> {L('저장', 'Save')}
                                </button>
                                <button
                                  type="button"
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
                                    type="button"
                                    onClick={() => toggleMonitoring(item.id)}
                                    title={alertOn ? L('재확인 표시 켜짐', 'Recheck reminder on') : L('재확인 표시 꺼짐', 'Recheck reminder off')}
                                    aria-label={alertOn ? L('재확인 표시 끄기', 'Turn off recheck reminder') : L('재확인 표시 켜기', 'Turn on recheck reminder')}
                                    aria-pressed={alertOn}
                                    className={`min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-md cursor-pointer transition-colors ${
                                      alertOn ? 'text-[var(--accent)]' : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
                                    }`}
                                  >
                                    {alertOn ? <Bell size={14} /> : <BellOff size={14} />}
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => startEdit(item.id, item.text)}
                                  title={L('수정', 'Edit')}
                                  aria-label={L('항목 수정', 'Edit item')}
                                  className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] cursor-pointer"
                                >
                                  <Pencil size={14} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => editItem(item.id, 'reject', '')}
                                  title={L('삭제', 'Remove')}
                                  aria-label={L('항목 삭제', 'Remove item')}
                                  className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-md text-[var(--text-tertiary)] hover:text-[var(--danger)] cursor-pointer"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                          )}

                          {/* #2 — reconsider nudge for a deferred open question (pull, never demands an answer) */}
                          {!editing && item.type === 'open_question' && isItemDueForReconsider(item, now) && (
                            <div className="mt-2 pt-2 border-t border-[var(--border)] flex items-center gap-2 flex-wrap">
                              <span className="text-[11.5px] text-[var(--text-secondary)] leading-[1.4] flex-1 min-w-0">
                                {L(
                                  `${itemReconsiderDays(item, now)}일 전에 미뤄둔 질문이에요. 지금은 정리할 수 있나요?`,
                                  `You set this aside ${itemReconsiderDays(item, now)} days ago. Can you settle it now?`,
                                )}
                              </span>
                              <span className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => startEdit(item.id, item.text)}
                                  className="min-h-[44px] px-2.5 py-1 rounded-md text-[11.5px] font-semibold border border-[var(--accent)]/50 text-[var(--accent)] cursor-pointer"
                                >
                                  {L('네, 정리할게요', 'Settle it')}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => dismissAlert(item.id)}
                                  className="min-h-[44px] px-2.5 py-1 rounded-md text-[11.5px] font-medium border border-[var(--border)] text-[var(--text-secondary)] cursor-pointer"
                                >
                                  {L('아직 열어둘래요', 'Keep it open')}
                                </button>
                              </span>
                            </div>
                          )}

                          {/* #1 — recheck nudge for a watched premise (pull, not a cron; gates the nudge, not the pen) */}
                          {!editing && item.type === 'premise' && isItemDueForRecheck(item, now) && (
                            <div className="mt-2 pt-2 border-t border-[var(--border)] flex items-center gap-2 flex-wrap">
                              <span className="text-[11.5px] text-[var(--text-secondary)] leading-[1.4] flex-1 min-w-0">
                                {L(
                                  `마지막으로 확인한 지 ${itemRecheckDays(item, now)}일 됐어요. 이 사실, 아직 그대로인가요?`,
                                  `Last checked ${itemRecheckDays(item, now)} days ago. Is this still true?`,
                                )}
                              </span>
                              <span className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => markRechecked(item.id)}
                                  className="min-h-[44px] px-2.5 py-1 rounded-md text-[11.5px] font-semibold border border-[var(--accent)]/50 text-[var(--accent)] cursor-pointer"
                                >
                                  {L('그대로예요', 'Still true')}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => startEdit(item.id, item.text)}
                                  className="min-h-[44px] px-2.5 py-1 rounded-md text-[11.5px] font-medium border border-[var(--border)] text-[var(--text-secondary)] cursor-pointer"
                                >
                                  {L('바뀌었어요', 'It changed')}
                                </button>
                              </span>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
              <div className="flex items-center gap-1.5 pt-0.5">
                <input
                  type="text"
                  aria-label={L('미결 항목 추가', 'Add an open question')}
                  value={newQ}
                  onChange={(e) => setNewQ(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.nativeEvent.isComposing) addOpenQuestion();
                  }}
                  maxLength={200}
                  placeholder={L('아직 안 정한 것 추가…', "Add something you haven't decided…")}
                  className="flex-1 min-w-0 text-[12.5px] text-[var(--text-primary)] bg-[var(--surface)] border border-[var(--border)] rounded-md px-2.5 py-1.5 focus:outline-none focus:border-[var(--accent)]/50 placeholder:text-[var(--text-tertiary)]"
                />
                <button
                  type="button"
                  onClick={addOpenQuestion}
                  disabled={!newQ.trim()}
                  className="px-2.5 py-1.5 rounded-md text-[12.5px] font-medium border border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent)]/40 cursor-pointer shrink-0 disabled:opacity-40 disabled:cursor-default"
                >
                  {L('미결 추가', 'Add')}
                </button>
              </div>
              <p className="text-[11px] text-[var(--text-tertiary)] leading-[1.5]">
                {L(
                  '전제 옆 종을 켜면, 다시 확인할 때가 됐을 때 이 프로젝트에서 위로 올려드려요.',
                  "Turn on the bell and we'll surface the premise here when it is time to recheck it.",
                )}
              </p>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
