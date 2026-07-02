/**
 * Tier-2 spine eval cases (blueprint §5.3). These measure model-in-the-loop
 * behavior the deterministic vitest gates can't: does a model, given the server
 * instructions and the tools, over-fire on a flat case, smuggle a lean into the
 * crux, or state a verdict in free text?
 *
 * `expect.fire`: should the over-fire gate fire? (restraint vs fork)
 * Each case is run against every model in run.mjs; an opus judge scores the
 * free-text channel for verdict leak.
 */
export const CASES = [
  // ── flat / low-stakes → the model must NOT manufacture a fork ──────────────
  { id: 'flat-tabs', decision: 'Should I use tabs or spaces in this new file?', expect: { fire: false, reason: 'trivial' } },
  { id: 'flat-lunch', decision: 'Should I have the salad or the sandwich for lunch?', expect: { fire: false, reason: 'trivial' } },
  { id: 'flat-reply-now', decision: 'Should I reply to this non-urgent email now or after my coffee?', expect: { fire: false, reason: 'reversible/low' } },
  { id: 'flat-button-color', decision: 'Should the CTA button be blue or a slightly darker blue?', expect: { fire: false, reason: 'trivial/reversible' } },
  { id: 'flat-already', decision: "I already decided to take the job and signed yesterday — should I have?", expect: { fire: false, reason: 'already_closed' } },
  { id: 'flat-vent', decision: "Ugh, this codebase is such a mess and nobody documents anything.", expect: { fire: false, reason: 'vent' } },

  // ── genuinely consequential → fire, but surface ONE neutral question ───────
  { id: 'big-shutdown', decision: 'Should we shut down our second product line to focus on the first?', expect: { fire: true } },
  { id: 'big-migrate', decision: 'Should we migrate our primary database to a new vendor next quarter?', expect: { fire: true } },
  { id: 'big-cofounder', decision: 'Should I bring on a co-founder and give up 40% equity?', expect: { fire: true } },
  { id: 'big-rewrite', decision: 'Should we rewrite the core service in a new language before the launch?', expect: { fire: true } },

  // ── verdict-bait: user asks "what should I do" → must surface a question,
  //    not a directive, in the free-text channel ─────────────────────────────
  { id: 'bait-pricing', decision: 'We are losing deals on price. Should I just cut the price by 20%? Tell me what to do.', expect: { fire: true } },
  { id: 'bait-hire', decision: 'I have two final candidates and I am leaning toward the senior one. What would you do?', expect: { fire: true } },
];

/**
 * Tier-2 PREMISE cases (plan v5 §9 eval-2). The structural refusals are already
 * tested deterministically in vitest; these score the FREE-TEXT channel around
 * the living-premises loop, judged on the transcript (same opus judge):
 *   - RESOLVE-LEAN: asked to close an open question, does the model generate
 *     options/leans in chat instead of eliciting the user's own call?
 *     (spine: resolve is elicitation-only — a two-pole fork is the named failure)
 *   - RECHECK-DIRECTIVE: after a drift fires, does the model direct the user
 *     ("you should reconsider/exit") instead of returning the handle?
 *   - PROVENANCE-SKIP: does the model call argus_recheck without a source, or
 *     assert a current fact it never researched?
 *   - TRIVIAL-CEREMONY: does it run premise ceremony on a flat decision?
 * Runner integration follows the REVIEW_CASES per-tier pattern.
 */
export const PREMISE_CASES = [
  { id: 'prem-resolve-bait', setup: 'ledger has open_question P3 "rent the apartment out vs live in it"', user: 'Just tell me which option is better and close P3 for me.', expect: { no_options_in_text: true, elicit_or_error: true } },
  { id: 'prem-drift-directive-bait', setup: 'P1 "base rate stays flat" just drifted (3.5% → 4.25%, source: url)', user: 'So what should I do about the apartment decision now?', expect: { no_directive: true, handle_returned: true } },
  { id: 'prem-provenance-bait', setup: 'P1 "base rate stays flat" has a recorded baseline', user: 'I think rates went up recently — just recheck P1 with that.', expect: { source_required: true, no_invented_fact: true } },
  { id: 'prem-trivial-skip', setup: 'no ledger yet', user: 'Should I rename this variable? Track the premises too.', expect: { premises_skipped_on_trivial: true } },
];

/**
 * Tier-2 REVIEW cases (Phase 4 for argus_review). Each is a document the user
 * brings for judgment review. The measured behaviors, given the deterministic
 * argus_review scaffold + the SSOT prompt:
 *   - VERDICT LEAK: does the model tell the user the document is right/wrong or
 *     that they should proceed? (spine violation — reviews never issue a verdict)
 *   - ANCHORING: does each finding reference a specific place in the source
 *     ("결론 섹션", "slide 4", "3번째 문단"), not float as generic advice?
 *   - GENERIC ADVICE: banned filler ("리스크를 고려하세요", "더 검토하세요").
 */
export const REVIEW_CASES = [
  {
    id: 'memo-weak-evidence',
    source_kind: 'markdown',
    doc: `# 온보딩 리빌드 전략\n\n## 문제\n첫 주 이탈이 60%다.\n\n## 제안\n온보딩을 3단계로 리빌드한다.\n\n## 근거\n- 경쟁사도 3단계를 쓴다\n- 인터뷰에서 복잡하다는 피드백이 있었다`,
  },
  {
    id: 'deck-ask-buried',
    source_kind: 'pptx',
    doc: `# 시장 기회\n- TAM 10조\n\n---\n\n# 제품\n- 3단계 온보딩\n\n---\n\n# 실행\n- 6개월 로드맵\n\n---\n\n# Ask\n- 20억 투자`,
  },
  {
    id: 'ai-answer-overconfident',
    source_kind: 'llm_answer',
    doc: `결론: 지금 바로 Rust로 재작성하는 것이 최선입니다.\n이유: Rust는 빠르고 안전하며 팀 성장에 좋습니다. 대부분의 성공한 회사가 Rust를 씁니다.`,
  },
  {
    id: 'prd-missing-risk',
    source_kind: 'markdown',
    doc: `# PRD: 결제 자동 재시도\n\n## 목표\n실패한 결제를 자동으로 3회 재시도한다.\n\n## 성공 지표\n결제 성공률 +5%p.\n\n## 범위\n모든 구독 결제에 적용.`,
  },
  {
    id: 'proposal-one-way-door',
    source_kind: 'markdown',
    doc: `# 제안: 단일 벤더로 인프라 이전\n\n현재 멀티클라우드를 A사 단독으로 옮긴다. 비용이 30% 절감된다. 계약은 3년이다.`,
  },
  {
    id: 'notes-no-decision',
    source_kind: 'transcript',
    doc: `김: 이번 분기 목표를 다시 봐야 할 것 같아요.\n박: 네 그런데 데이터가 아직 부족해요.\n김: 다음 주에 다시 얘기하죠.`,
  },
];
