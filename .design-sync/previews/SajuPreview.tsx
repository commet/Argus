import { SajuPreview } from 'argus';

// SajuPreview — the birth-date "for fun" mini-readout under the boss setup form.
// Korean locale: element (오행) + Korean zodiac animal (띠) + month-based sign.
// English locale: Chinese zodiac (year) + Western zodiac (month/day). Pure props
// (year/month/day); no server calls. NOTE: it debounces 300ms before it shows
// anything (initial displayed = year 0 → renders null), so the capture must
// settle past the first frame. We seed Korean locale to match the boss set.
// MOTION SETTLE (see ChatMessage.tsx for the full rationale): framer-motion
// enters via an inline opacity tween the capture can shoot mid-flight; a
// stylesheet `!important` rule pins the settled value so the card is never blank.
if (typeof window !== 'undefined') {
  try {
    window.localStorage.setItem('sot_settings', JSON.stringify({ language: 'ko' }));
  } catch {}
}
if (typeof document !== 'undefined' && !document.getElementById('ds-motion-settle')) {
  const s = document.createElement('style');
  s.id = 'ds-motion-settle';
  s.textContent = '[style*="opacity"]{opacity:1!important}';
  document.head.appendChild(s);
}

export const FullBirthdate = () => <SajuPreview year={1990} month={5} day={12} />;

export const YearAndMonth = () => <SajuPreview year={1988} month={11} />;

export const YearOnly = () => <SajuPreview year={1975} />;
