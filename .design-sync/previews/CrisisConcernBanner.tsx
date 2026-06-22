import { CrisisConcernBanner } from 'argus';

// CrisisConcernBanner — the deterministic crisis backstop's visible surface
// (warn + a real resource, NEVER a hard block). It takes `locale` as a prop, so
// each cell can pick its own language directly. The concern copy comes from
// crisis-gate's formatConcernMessage; the triggering substring is never shown.
// While `blocking` is true the "그래도 계속 진행할게요 / Continue anyway" escape
// is offered; once continued (blocking=false) the resource stays pinned with no
// continue affordance. Cells sweep category × blocking × locale.

// The banner enters via framer-motion (initial opacity:0, y:-8). A static capture
// never scrolls and reports no reduced-motion, so the JS entrance stays at its
// initial frame → blank. Force the rest state for the screenshot (same approach
// the bp-fade-up previews use). Scoped to .fm-static so nothing else is touched.
if (typeof document !== 'undefined' && !document.getElementById('fm-static-style')) {
  const s = document.createElement('style');
  s.id = 'fm-static-style';
  s.textContent = '.fm-static, .fm-static *{opacity:1 !important;transform:none !important}';
  document.head.appendChild(s);
}

const frame: React.CSSProperties = {
  maxWidth: 520,
  margin: '0 auto',
  padding: '12px 0',
  background: 'var(--bg)',
};

// Self-harm, still blocking — the most load-bearing copy + the conscious-continue escape.
export const SelfHarmBlocking = () => (
  <div className="fm-static" style={frame}>
    <CrisisConcernBanner
      crisis={{ isCrisis: true, category: 'self_harm' }}
      locale="ko"
      blocking
      onContinue={() => {}}
    />
  </div>
);

// Financial-ruin, already continued — resource stays pinned, no continue button.
export const FinancialRuinContinued = () => (
  <div className="fm-static" style={frame}>
    <CrisisConcernBanner
      crisis={{ isCrisis: true, category: 'financial_ruin' }}
      locale="ko"
      blocking={false}
      onContinue={() => {}}
    />
  </div>
);

// English locale, abuse/coercion, blocking — same surface, US hotline copy.
export const AbuseEnglishBlocking = () => (
  <div className="fm-static" style={frame}>
    <CrisisConcernBanner
      crisis={{ isCrisis: true, category: 'abuse_coercion' }}
      locale="en"
      blocking
      onContinue={() => {}}
    />
  </div>
);

// Dangerous-medical, English, continued — shorter clinician-first concern line.
export const DangerousMedicalContinued = () => (
  <div className="fm-static" style={frame}>
    <CrisisConcernBanner
      crisis={{ isCrisis: true, category: 'dangerous_medical' }}
      locale="en"
      blocking={false}
      onContinue={() => {}}
    />
  </div>
);
