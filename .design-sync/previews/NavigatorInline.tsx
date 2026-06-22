import { NavigatorInline } from 'argus';

// NavigatorInline — the Navigator's read-only, per-step coaching layer. It builds
// a NavigatorProfile from existing stores (no new data, no LLM — deterministic
// templates) and renders up to 2 coaching items for the given step, each toned
// neutral(gold) / positive(emerald) / counterfactual(blue) / challenge(amber). An
// item with a `detail` renders the long card form (icon + message + detail); a
// short one renders a pill.
//
// At sessionCount 0 each step returns its first-use coaching. We seed
// sot_settings=ko (i18n copy) plus ONE demo_seed quality signal so the reframe/
// recast steps personalize off the demo run — which lets the four cells span
// three tones: challenge (reframe, "all accepted"), positive (recast, "balanced"),
// and counterfactual (rehearse/synthesize first-use).

if (typeof window !== 'undefined') {
  try {
    window.localStorage.setItem('sot_settings', JSON.stringify({ language: 'ko' }));
    window.localStorage.setItem('sot_quality_signals', JSON.stringify([
      {
        id: 'sig-demo',
        tool: 'voyage',
        signal_type: 'demo_seed',
        signal_data: {
          completed: true,
          doubted_count: 0,      // accepted every premise → reframe = challenge tone
          total_premises: 3,
          ai_only_steps: 2,      // neither side dominates → recast = positive (balanced)
          human_only_steps: 1,
          total_steps: 4,
        },
        created_at: '2026-06-18T09:00:00.000Z',
      },
    ]));
  } catch {}
}

const frame: React.CSSProperties = {
  maxWidth: 420,
  margin: '0 auto',
  padding: 20,
  background: 'var(--bg)',
};

// Reframe — demo showed the user accepted every premise → a challenge-toned nudge.
export const ReframeChallenge = () => (
  <div style={frame}><NavigatorInline step="reframe" /></div>
);

// Recast — demo split work between AI and human → a positive "balanced" note.
export const RecastPositive = () => (
  <div style={frame}><NavigatorInline step="recast" /></div>
);

// Rehearse — first-use counterfactual coaching (what you'd miss without it).
export const RehearseFirstUse = () => (
  <div style={frame}><NavigatorInline step="rehearse" /></div>
);

// Synthesize — first-use counterfactual coaching for the final assembly step.
export const SynthesizeFirstUse = () => (
  <div style={frame}><NavigatorInline step="synthesize" /></div>
);
