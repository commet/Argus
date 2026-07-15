/**
 * Interactive Demo Data (English) — 3 hardcoded scenarios + branching data
 *
 * Structure: base analysis -> Q1 patch -> Q2 patch -> workers (fixed) -> draft -> DM (Q1-based) -> final (DM toggle-based)
 */

import type {
  AnalysisSnapshot, FlowQuestion, WorkerPersona,
  MixResult, DMFeedbackResult, DMConcern,
} from '@/stores/types';

// ─── Demo Scenario Type ───

/** v2 condensed draft card — used in scenario 1 (others keep MixResult) */
export interface DemoDraftV2 {
  title: string;
  decisionLineDefault: string;
  workerSummariesDefault: Array<{
    personaId: string;
    headline: string;
    lines: string[];
  }>;
  weakestAssumptionDefault: {
    assumption: string;
    explanation: string;
  };
  nextThreeDaysDefault: string[];
}

export interface DemoScenario {
  id: string;
  title: string;
  icon: string;
  desc: string;
  /** Onboarding scenarios must be important but return a visible signal quickly. */
  checkInDays: number;
  problemText: string;
  team: WorkerPersona[];
  analysis: AnalysisSnapshot;
  q1: {
    question: FlowQuestion;
    effects: Record<string, {
      snapshotPatch: Partial<AnalysisSnapshot>;
      dmKey: string;
      // v2 — Q1 answer decides third worker + decision line
      thirdWorker?: {
        persona: WorkerPersona;
        task: string;
        completionNote: string;
        result: string;
        joinMessage: string;
      };
      decisionLine?: string;
    }>;
  };
  q2: {
    question: FlowQuestion;
    effects: Record<string, {
      snapshotPatch: Partial<AnalysisSnapshot>;
      // v2 — Q2 answer decides weakest assumption + next 3 days + DM first reaction
      weakestAssumption?: { assumption: string; explanation: string };
      nextThreeDays?: string[];
      dmFirstReaction?: string;
    }>;
  };
  workers: Array<{
    persona: WorkerPersona;
    task: string;
    completionNote: string;
    result: string;
  }>;
  draft: MixResult;
  // v2 condensed card — only filled for scenarios using v2
  draftV2?: DemoDraftV2;
  dmVariants: Record<string, DMFeedbackResult>;
  finalBase: string;
  finalPatches: [string, string]; // [concern0 applied text, concern1 applied text]
  // NOTE: this interface is a duplicate of the one in demo-data.ts (pre-existing).
  // Keep the two in sync — seal/settle mirror the KO type. (Dedup is a separate cleanup.)
  seal: {
    prediction: string;
  };
  settle: {
    verdict: 'held' | 'partial' | 'broke';
    happened: string;
    learning: string;
  };
}

// ─── Utility ───

export function applyPatch(base: AnalysisSnapshot, patch: Partial<AnalysisSnapshot>): AnalysisSnapshot {
  return {
    ...base,
    ...patch,
    version: base.version + 1,
  };
}

/** Dynamic data extracted from Q1/Q2 answers — injected into buildFinal to substitute placeholders */
export interface BuildFinalDynamicData {
  decisionLine?: string | null;
  thirdWorker?: {
    persona: { emoji: string; name: string };
    task: string;
    completionNote: string;
  } | null;
  weakestAssumption?: { assumption: string; explanation: string } | null;
  nextThreeDays?: string[] | null;
}

/** Insert concern-applied results + Q1/Q2 dynamic substitution into finalBase */
export function buildFinal(
  scenario: DemoScenario,
  concerns: DMConcern[],
  dynamic?: BuildFinalDynamicData,
): string {
  let doc = scenario.finalBase;

  // Existing: concern PATCH_0/1 substitution
  doc = doc.replace('<!-- PATCH_0 -->', concerns[0]?.applied ? scenario.finalPatches[0] : '');
  doc = doc.replace('<!-- PATCH_1 -->', concerns[1]?.applied ? scenario.finalPatches[1] : '');

  // v2: substitute placeholders from Q1/Q2 answers (fallback to draftV2 defaults)
  const draftV2 = scenario.draftV2;

  // {{decisionLine}}
  const decisionLine = dynamic?.decisionLine ?? draftV2?.decisionLineDefault ?? '';
  doc = doc.replace('{{decisionLine}}', decisionLine ? `"${decisionLine}"` : '');

  // {{thirdWorkerBlock}} — paragraph for the teammate who joined based on Q1
  const tw = dynamic?.thirdWorker;
  const thirdWorkerBlock = tw
    ? `## ${tw.persona.emoji} ${tw.persona.name} — ${tw.task}\n\n> "${tw.completionNote}"`
    : '';
  doc = doc.replace('{{thirdWorkerBlock}}', thirdWorkerBlock);

  // {{weakestAssumption}}
  const wa = dynamic?.weakestAssumption ?? draftV2?.weakestAssumptionDefault;
  const weakestBlock = wa
    ? `> **"${wa.assumption}"**\n>\n> ${wa.explanation}`
    : '';
  doc = doc.replace('{{weakestAssumption}}', weakestBlock);

  // {{nextSteps}}
  const steps = dynamic?.nextThreeDays ?? draftV2?.nextThreeDaysDefault;
  const nextStepsBlock = steps && steps.length > 0
    ? steps.map((s, i) => `${i + 1}. ${s}`).join('\n')
    : '';
  doc = doc.replace('{{nextSteps}}', nextStepsBlock);

  return doc.trim();
}

// ─── Shared Personas ───

const SUJIN: WorkerPersona = {
  id: 'researcher', name: 'Sophie', role: 'Research Analyst',
  emoji: '🔍', expertise: 'Market research, data analysis', tone: 'Thorough and evidence-based', color: '#3B82F6',
};
const HYUNWOO: WorkerPersona = {
  id: 'strategist', name: 'Nathan', role: 'Strategist',
  emoji: '🎯', expertise: 'Strategy design, positioning', tone: 'Direct and to the point', color: '#8B5CF6',
};
const MINJAE: WorkerPersona = {
  id: 'numbers', name: 'Ethan', role: 'Numbers Analyst',
  emoji: '📊', expertise: 'Finance, quantitative analysis', tone: 'Numbers-driven', color: '#10B981',
};
const DONGHYUK: WorkerPersona = {
  id: 'critic', name: 'Blake', role: 'Risk Reviewer',
  emoji: '⚠️', expertise: 'Risk analysis, counterarguments', tone: 'Sharp but constructive', color: '#EF4444',
};
const SEOYEON: WorkerPersona = {
  id: 'copywriter', name: 'Claire', role: 'Copywriter',
  emoji: '✍️', expertise: 'Document structuring, persuasive writing', tone: 'Clear and compelling', color: '#F59E0B',
};

// ─── Scenario 1 third-worker pool (joins based on Q1 answer) ───
const DOHYUN: WorkerPersona = {
  id: 'biz_analyst', name: 'Owen', role: 'Business Strategist',
  emoji: '📈', expertise: 'Existing vs new business comparison, synergy/risk', tone: 'Balanced and measured', color: '#EC4899',
};
const JIYUN: WorkerPersona = {
  id: 'pm', name: 'Riley', role: 'Execution PM',
  emoji: '🛠', expertise: 'Weekly milestones, Go/No-Go criteria', tone: 'Practical and clear', color: '#14B8A6',
};
const YUNSEO: WorkerPersona = {
  id: 'interviewer', name: 'Maya', role: 'User Researcher',
  emoji: '💬', expertise: 'Interview design, intent discovery, listening', tone: 'Gentle and organizing', color: '#F97316',
};

// ═══════════════════════════════════════════════════════════════
// ═══ SCENARIO 1: 📋 Business Plan ═══
// ═══════════════════════════════════════════════════════════════

const scenario1: DemoScenario = {
  id: 'planning',
  title: 'Business Plan',
  icon: '📋',
  desc: 'First time planning — where do you even start?',
  checkInDays: 7,
  problemText: 'The CEO suddenly asked for a new business proposal in 2 weeks. We\'re a 5-person backend team — I\'ve never planned anything before. The timing feels urgent because a competitor just announced an AI customer support service. We also have to keep maintaining our existing product.',

  team: [SUJIN, HYUNWOO],

  // ─── v0: Initial Analysis (a bridge to next step, not a verdict) ───
  analysis: {
    version: 0,
    real_question: 'There\'s only one question to answer. "What decision should the CEO make after reading this?" If that one line is unclear, you\'ll write 30 pages and have to start over in 2 weeks.',
    hidden_assumptions: [
      'A 2-week deadline probably isn\'t "bring me a perfect report." It\'s closer to "help me decide, fast." 50 pages won\'t get written in time, and the CEO won\'t read them all anyway.',
      'The CEO only saw the news article, but your dev team can sign up for the competitor\'s product and see the weaknesses in an hour. That information gap is actually on your side.',
      '"First time planning" isn\'t a weakness — it\'s a weapon. "This timeline is doable" carries totally different weight when the people building it say it versus when a strategy person says it. The line the CEO most wants to hear is one only you can write.',
    ],
    skeleton: [
      'First — why is the CEO asking *now*? Competitor? Revenue? Personal conviction? Without this, any amount of pages is wasted paper.',
      'Then — sign up for the competitor\'s product and use it for an hour. You\'ll see 3 weaknesses. That\'s the first weapon of the plan.',
      'Here\'s the fork — "same thing, faster" vs "something different." This decides how to split your 5 people.',
      'Split the 5 — how many on the new venture, how many on maintenance. Start without this and both will wobble. The headcount table needs to be in the plan.',
      'And the last page — "Here\'s what I\'ll show you next." That one line is what the CEO will read and decide on.',
    ],
    insight: 'Feeling lost is normal. The hard part of a plan isn\'t filling 30 pages — it\'s getting one line right on the first page: "What decision should the CEO make after reading this?" Once that line is there, the length takes care of itself.',
  },

  // ─── Q1: Understanding the context ───
  q1: {
    question: {
      id: 'demo-q1',
      text: 'Why do you think the CEO assigned this?',
      subtext: 'This single answer completely changes the plan\'s structure.',
      options: ['A competitor beat us to the punch', 'Revenue growth has stalled', 'The CEO has already decided', 'I\'m not sure'],
      type: 'select',
      engine_phase: 'reframe',
    },
    effects: {
      'A competitor beat us to the punch': {
        dmKey: 'ceo',
        decisionLine: 'I\'ll prove one thing the competitor can\'t do, in 4 weeks.',
        thirdWorker: {
          persona: MINJAE,
          task: 'Reverse-engineer competitor pricing + break-even',
          completionNote: '1/3 the price, 48% margin. Profitable at 25 customers.',
          joinMessage: 'The competitor opened the market — we differentiate on price. 📊 Ethan joined.',
          result: '**Took Nathan\'s structure (2 dedicated devs / 4-week MVP) and built a price model by reverse-engineering the competitor.**\n\n| Item | Competitor | Us |\n|---|---|---|\n| Monthly subscription | $800-2000 | **$290** (1/3) |\n| Setup | Separate consulting | Free (pre-trained) |\n| Target | Enterprise | E-commerce sellers |\n\n**Margin structure:** AI cost is around $0.05 per query. SMB sellers average ~3,000 queries/month, so AI cost per customer is ~$150. At $290 subscription, **margin per customer is $140 (48%)**.\n\n**6-month costs:**\n- Headcount: existing salaries ($0 incremental)\n- Infrastructure: $12,000\n- Marketing: $3,000\n- **Total: $15,000**\n\n**Break-even: 25 paying customers.** (Revenue $7,250 - AI cost $3,750 - fixed $2,500 = $1,000 profit)',
        },
        snapshotPatch: {
          real_question: 'The competitor opened the market. The question narrows: "Can we pull 2 of our 5 people to build something the competitor can\'t do, in 4 weeks?" Just that.',
          hidden_assumptions: [
            'A competitor going first proves the market exists. They saved you the validation cost.',
            'Building the same thing puts you at a late-mover disadvantage. You need to find what they *can\'t* do — and that\'s not in the press release. You\'ll see it after using the product for an hour.',
            '2 weeks of planning + 4 weeks of dev = MVP in 6 weeks. By then the competitor will be getting their first market reactions — the timing is actually right.',
          ],
          skeleton: [
            'Today — sign up for the competitor\'s product. As an SMB seller, an hour of use will reveal 3 weaknesses. That\'s the first weapon.',
            'Tomorrow — internal check: "Can 3 people maintain the existing product if we pull 2?" If that doesn\'t work, the plan is blocked.',
            'This week — call 3 sellers using the competitor: "What\'s most frustrating?" That\'s your market validation. No survey needed.',
            'Key — find one thing the competitor can\'t do. Builders judge technical feasibility most accurately.',
            'Last page of the plan — "Here\'s them, here\'s us" comparison + "I\'ll show you the working version in 4 weeks."',
          ],
          insight: 'The timing is actually good. 2 weeks planning + 4 weeks dev = MVP in 6 weeks. The competitor paid for the market education.',
        },
      },
      'Revenue growth has stalled': {
        dmKey: 'executive',
        decisionLine: 'Existing business +12% vs new venture +35%. New venture wins after 6 months.',
        thirdWorker: {
          persona: DOHYUN,
          task: 'Existing vs new venture comparison simulation',
          completionNote: 'Existing +12% vs new +35%. New venture wins after 6 months.',
          joinMessage: 'When revenue is flat, the plan IS the comparison. 📈 Owen joined.',
          result: '**Took Nathan\'s structure (2 dedicated devs) and ran a 6-month simulation comparing it to improving the existing business.**\n\n| 6 months out | Improve existing | New venture (AI support) |\n|---|---|---|\n| Revenue impact | +12% (gradual) | **+35%** (new revenue stream) |\n| Risk | Low | Medium (2-person reallocation impact) |\n| Initial investment | $0 | $15,000 |\n| Downside | None | -8% (sunk if it fails) |\n\n**Reading the table:**\n- Improving the existing product is safe but **doesn\'t solve the underlying reason revenue isn\'t growing.**\n- The new venture has higher expected value, but the real risk is the 2-person reallocation.\n- **Nathan\'s "2 dedicated + 3 maintenance" structure caps the downside at -8% instead of -20%.**\n\n**Synergy line:** About 20% of our existing customer base are e-commerce sellers. Some of the first 25 can come straight from there.',
        },
        snapshotPatch: {
          real_question: 'Revenue is stalling. So the question is: "Improving the existing business vs starting a new venture — which is better?" That comparison needs to be in the plan, or leadership won\'t approve.',
          hidden_assumptions: [
            'Whether revenue is flat because of market or execution matters — the answer changes which direction makes sense.',
            'Pulling all 5 people would shake the existing product. "2 dedicated + 3 maintenance" is a realistic starting point.',
            'Leadership doesn\'t read proposals without numbers. A "this is better" comparison table is the entry ticket.',
          ],
          skeleton: [
            'First — write one line: why isn\'t existing revenue growing? Market saturated, or execution gap?',
            'Then — does AI customer support have a connection to the existing product? Same customer base or same data → 2x more persuasive.',
            'Must include — "improve existing vs new venture" comparison table. With a comparison, leadership can decide cleanly.',
            'Headcount — 2 dedicated, 3 maintenance. Without this the timeline falls apart.',
            'Last page — first-year revenue estimate + "this is X% better than the alternative" comparison. The decision line lives here.',
          ],
          insight: 'The strongest single page is "this is a better bet than improving what we already have." Numbers in that table move leadership.',
        },
      },
      'The CEO has already decided': {
        dmKey: 'ceo',
        decisionLine: 'Week 1-4 milestones — proving "this actually works" in 4 weeks.',
        thirdWorker: {
          persona: JIYUN,
          task: 'First 4-week execution milestones + Go/No-Go criteria',
          completionNote: 'Week 4 demo to one seller is the Go/No-Go.',
          joinMessage: 'When the decision is already made, the plan IS the execution roadmap. 🛠 Riley joined.',
          result: '**Took Nathan\'s structure (2 dedicated devs / 4-week MVP) and broke it into the first 4 weeks of milestones.**\n\n| Week | What we do | Check | Output |\n|---|---|---|---|\n| Week 1 | Pre-training PoC (50 industry terms) | Working in a day? | One demo video |\n| Week 2 | API + templates | 5 categories complete? | Postman tests |\n| Week 3 | Simple dashboard | Auto-response rate 70%? | Demo recording |\n| Week 4 | **Beta demo to 1 seller** | Does the customer say "I\'d use this"? | One-page CEO report |\n\n**Go/No-Go in one line:**\n- ✅ Week 4 seller says "I\'d use this" → continue\n- ❌ Pre-training PoC fails by Week 2 → stop, write off sunk cost\n\n**Risk mitigation:** Week 2 PoC might not work. Have a Plan B ready in advance so Weeks 3-4 don\'t become wasted time.',
        },
        snapshotPatch: {
          real_question: 'The CEO already wants to do this. So the question shrinks: "What can 5 people build in the first month?" That one line is what gets approved.',
          hidden_assumptions: [
            'A plan written when the decision is made isn\'t for approval — it\'s for committing to execution.',
            'Knowing what convinced the CEO gives you the starting point. It might even be the same competitor news.',
            'Pulling all 5 will shake the existing product. "2 dedicated + 3 maintenance" is the starting line.',
          ],
          skeleton: [
            'First — ask the CEO: "What made you feel this would work?" That\'s the starting point.',
            'Then — validate that conviction with one method. Three seller calls is enough.',
            'Then — first-month execution plan. 2 dedicated, 3 things to build, the budget. This is the body.',
            'Decision criterion — "If this works in 4 weeks, continue. If not, stop." One line is enough.',
            'Add one honest risk — "If we pull people from maintenance, incident response slows down." Hiding it leads to bigger blowups later.',
          ],
          insight: 'When the direction is set, the plan\'s value is showing a feasible first step. "What can 5 people build in 4 weeks?" — that one line gets approved.',
        },
      },
      'I\'m not sure': {
        dmKey: 'ceo',
        decisionLine: '3 days to lock the direction, 11 days for actual planning. One page in 2 weeks.',
        thirdWorker: {
          persona: YUNSEO,
          task: 'CEO intent confirmation + seller interview design',
          completionNote: 'One line for the CEO + 3 questions for 3 sellers.',
          joinMessage: 'When the direction is fuzzy, interviews are the starting point. 💬 Maya joined.',
          result: '**Even with Nathan\'s structure (2 dedicated / 4-week MVP), two conversations need to happen first.**\n\n**① One line to the CEO (one Slack message)**\n\n> "Is this because of the competitor news, or revenue, or something else?"\n\nThis one line turns 3 days into 3 hours. A 15-minute conversation saves 2 weeks.\n\n**② 3 sellers, 3 core questions (15-minute calls each)**\n\n1. "How do you handle customer support today?" (current state)\n2. "If an AI handled 80% of replies for $290/month, would you use it?" (price + function)\n3. "What\'s the most frustrating CS task right now?" (opportunity)\n\n**Output:** Map responses on two axes — price sensitivity / feature priority — onto one page → CEO mid-check.\n\n**Time:** Direction locked within 3 days → remaining 11 days are actual planning time.',
        },
        snapshotPatch: {
          real_question: 'There\'s only one question to answer — "Why is the CEO asking *now*?" Without that, 30 pages drifts off-course and gets rewritten. One Slack message resolves it.',
          hidden_assumptions: [
            'Asking "why are we doing this?" isn\'t pushy — it\'s the normal first step. The CEO probably finds it easier too.',
            'Right after competitor news, it\'s probably a competitive response. Still, confirm before assuming.',
            'While you\'re asking, add one bonus question — "What format should I bring it back in?" That answer sets the page count.',
          ],
          skeleton: [
            'Today — Slack the CEO. "Is this because of the competitor news?" One line is enough.',
            'Based on the answer — competitor, revenue, or conviction. The structure follows.',
            'While you wait — sign up for the competitor\'s product and use it for an hour. Needed regardless of the reason.',
            'Also — internal check: "How many of our 5 can we pull onto this?" If there\'s no answer, the plan is blocked from the start.',
            '3 days to lock direction → 11 days of actual planning time.',
          ],
          insight: 'A 15-minute conversation saves 2 weeks. Right after competitor news the reason is probably obvious, but confirming before starting is safer.',
        },
      },
    },
  },

  // ─── Q2: Validation method (after seeing worker results, decide next 3 days) ───
  q2: {
    question: {
      id: 'demo-q2',
      text: 'The team has built the answer. Now — what\'s the first thing to validate?',
      subtext: 'Whichever validation you start with decides your next 3 days.',
      options: [
        'Call 5 e-commerce sellers directly',
        'Show one seller a working beta',
        'Dig deeper into competitor reviews',
        'Check if any existing customers are sellers',
      ],
      type: 'select',
      engine_phase: 'reframe',
    },
    effects: {
      'Call 5 e-commerce sellers directly': {
        snapshotPatch: {
          insight: 'Talking is the fastest and most honest validation. Even with a high rejection rate, you get real answers.',
        },
        weakestAssumption: {
          assumption: 'Will sellers actually pick up a cold call?',
          explanation: 'You may need to try 20 to get 5 to talk. Lots of rejection is normal.',
        },
        nextThreeDays: [
          'Today — list 20 e-commerce sellers from communities or your network',
          '15-minute calls each — "Would you pay $290/month?" + "What\'s your single biggest pain?"',
          'Compile 5 responses → one-page summary for the CEO',
        ],
        dmFirstReaction: 'Calling 5 sellers, fine. But how are you getting to those 5? Cold calls have a high rejection rate.',
      },
      'Show one seller a working beta': {
        snapshotPatch: {
          insight: 'Action beats words. Show one seller a working version and you don\'t need to convince anyone.',
        },
        weakestAssumption: {
          assumption: 'Can we actually get something working in 4 weeks with tech we\'ve never used?',
          explanation: 'Pre-trained models are new territory for the team. If the timeline slips, the demo doesn\'t happen.',
        },
        nextThreeDays: [
          'Start the pre-training PoC — confirm it works for 50 e-commerce terms first',
          'Pre-arrange a beta seller from your team\'s network',
          'Block the Week 4 demo date + the CEO\'s calendar at the same time',
        ],
        dmFirstReaction: 'Beta demo, sounds good. But can you really get something working in 4 weeks with a pre-training model the team\'s never built?',
      },
      'Dig deeper into competitor reviews': {
        snapshotPatch: {
          insight: 'Complaints from people who already paid are the most honest data. Active users\' words are the best research.',
        },
        weakestAssumption: {
          assumption: 'Are review writers the same people as paying customers?',
          explanation: 'Reviews skew toward the angriest. The satisfied majority don\'t write anything.',
        },
        nextThreeDays: [
          'Read 50 competitor app store reviews and categorize complaints',
          'Collect related posts from seller communities (Reddit, forums)',
          'Compile a one-page "opportunity areas" summary → CEO',
        ],
        dmFirstReaction: 'Review analysis is fast, but are review writers the same as paying customers? Only the unhappy ones write.',
      },
      'Check if any existing customers are sellers': {
        snapshotPatch: {
          insight: 'Five minutes and you have an answer. The fastest first customer is someone who already knows you.',
        },
        weakestAssumption: {
          assumption: 'Are there actually any e-commerce sellers in our existing customer base?',
          explanation: 'If our existing product targets a different industry, there might be zero. Then you\'re blocked on day one.',
        },
        nextThreeDays: [
          'Search the existing customer DB for e-commerce sellers (5 minutes)',
          'If any — call 1-2 immediately, leverage the existing relationship',
          'If none — switch immediately to the "5 cold calls" strategy',
        ],
        dmFirstReaction: 'Five-minute DB check — do that first. But if there are none, then what?',
      },
    },
  },

  // ─── Workers (default 2 — third joins via q1.effects.thirdWorker based on Q1 answer) ───
  workers: [
    {
      persona: SUJIN,
      task: 'Market narrowing + first target decision',
      completionNote: 'Compared 3 candidates → e-commerce sellers are the entry point.',
      result: '**AI customer support — first narrowed down who to sell to.**\n\nThe market is too broad, so I spent an hour each on three candidates.\n\n| Candidate | Market size | Entry difficulty | Our strength | Verdict |\n|---|---|---|---|---|\n| Large retailers | Very large | Very high (long sales cycles) | ❌ Doesn\'t work for an 8-person company | ✗ Out |\n| **E-commerce sellers** | **Large** | **Medium** | **✅ Plays to our backend strength** | **✓ In** |\n| Local shops | Medium | Low | ❌ Per-customer revenue too low | ✗ Out |\n\n**→ E-commerce sellers as the first target.**\n\nThen I **signed up for the competitor as a seller and used it for an hour.** Saw weaknesses that don\'t show up in press releases:\n\n- **Weakness 1 — 2-week setup**: Industry terms have to be taught manually one by one. "Return request" gets misclassified as "refund."\n- **Weakness 2 — Starting at $800/month**: For a seller doing $30K/month in revenue, that\'s a burden.\n- **Weakness 3 — Top review complaint: "Doesn\'t fit our industry, so a human ends up answering anyway."**\n\nThese three are our opportunity, as-is.',
    },
    {
      persona: HYUNWOO,
      task: '4-week MVP structure + headcount allocation',
      completionNote: 'Took Sophie\'s 3 weaknesses and built a structure that works in 4 weeks.',
      result: '**Took the e-commerce seller focus + 3 weaknesses Sophie identified, and laid out a 4-week MVP.**\n\n| Competitor weakness | Our direction |\n|---|---|\n| 2-week setup | E-commerce pre-training → **1-day setup** |\n| Misses industry terms | Built-in industry templates, "return request" recognized instantly |\n| $800/month | 1/3 or less. → Pricing model handled by whoever joins next. |\n\n**Headcount allocation (this is the core of approval):**\n- **2 dedicated** (1 senior + 1 junior) — pre-training model + API\n- **3 stay on existing maintenance.** If something breaks, 1 of the dedicated 2 returns immediately.\n\n**4-week MVP scope:** Auto-response + e-commerce templates + simple dashboard.\n\nThis structure protects the existing product *while* putting something working in front of the CEO in 4 weeks.',
    },
  ],

  // ─── Draft ───
  draft: {
    title: 'New Business Proposal',
    executive_summary: 'The market is growing 20%+ annually, and there\'s no specialized solution for SMBs. Leveraging our existing development capabilities, we\'ll launch an MVP within 4 weeks and reach break-even at 30 paying customers.',
    sections: [
      { heading: 'Market Opportunity', content: 'The market is growing over 20% annually. But most solutions are generic enterprise tools, and **there\'s no specialized service built for SMBs.** The #1 customer complaint: "It doesn\'t fit our industry."' },
      { heading: 'Our Differentiation', content: 'We go **industry-specific** instead of generic. What large vendors take 6 months to customize, we deliver in 1 week through pre-training. MVP is achievable in 4 weeks using our existing backend capabilities.' },
      { heading: 'Revenue Model', content: 'Monthly subscription at $300-500, break-even at 30 paying customers. Year 1 target: $200K in revenue. Initial costs are dev-team driven, no large upfront investment required.' },
    ],
    key_assumptions: [
      'Existing team can build MVP within 4 weeks',
      'SMBs willing to pay $300-500/month',
      'Industry specialization works as real differentiation',
    ],
    next_steps: [
      'Interview 5 potential customers — validate pain points',
      'Finalize MVP spec + begin development',
      'CEO first review (in 2 weeks)',
    ],
  },

  // ─── Draft V2 (condensed card — Q1 decisionLine/thirdWorker + Q2 weakestAssumption/nextThreeDays override at runtime) ───
  draftV2: {
    title: 'AI Customer Support — E-commerce Sellers (First Entry)',
    decisionLineDefault: 'In 4 weeks, I\'ll demo a working beta to one e-commerce seller.',
    workerSummariesDefault: [
      {
        personaId: 'researcher', // SUJIN — Sophie
        headline: 'Market narrowing + competitor weaknesses',
        lines: [
          '3 candidates compared → **e-commerce sellers** are the entry point (large retailers ❌, local shops ❌)',
          'Competitor weaknesses: 2-week setup / $800/mo / "doesn\'t fit our industry"',
        ],
      },
      {
        personaId: 'strategist', // HYUNWOO — Nathan
        headline: '4-week MVP + headcount',
        lines: [
          'Structure that flips all 3 weaknesses — pre-trained 1-day setup + industry templates',
          'Headcount: **2 dedicated + 3 maintenance**. If something breaks, 1 dedicated returns immediately',
        ],
      },
    ],
    weakestAssumptionDefault: {
      assumption: 'Will an e-commerce seller really pay $290 a month?',
      explanation: 'We haven\'t asked a single seller yet. That\'s the biggest risk.',
    },
    nextThreeDaysDefault: [
      'Call 5 e-commerce sellers — confirm purchase intent',
      'Lock in which 2 people are dedicated, internally',
      'One Slack message to the CEO — "Is this the right direction?"',
    ],
  },

  // ─── DM Variants (Q1 answer decides DM persona, Q2 answer decides first_reaction) ───
  dmVariants: {
    ceo: {
      persona_name: 'Mr. Kim',
      persona_role: 'CEO',
      first_reaction: 'I see the market is big. But why WE should do this is weak. What makes us different from everyone else?',
      good_parts: [
        'The 4-week MVP timeline is realistic and well-staged',
        'Break-even at 30 customers — clear, concrete number',
      ],
      concerns: [
        {
          text: 'I don\'t understand what "industry-specific" actually means. Which industry? Give me one concrete example.',
          severity: 'critical',
          fix_suggestion: 'Pick one target industry and add a specific problem-to-solution case study',
          applied: false,
        },
        {
          text: 'How do we land the first customers? There\'s no sales plan here.',
          severity: 'important',
          fix_suggestion: 'Add a customer acquisition strategy — existing network, free pilot program, etc.',
          applied: false,
        },
      ],
      would_ask: [
        'If competitors copy us, what\'s our moat?',
        'How much does AI cost eat into our margins?',
      ],
      approval_condition: 'If the target industry and customer acquisition method get specific, I\'d put this on the leadership meeting agenda.',
    },
    executive: {
      persona_name: 'Director Park',
      persona_role: 'VP of Business',
      first_reaction: 'The structure is fine. But there are no answers to what the CFO will ask in the leadership meeting.',
      good_parts: [
        'Market growth data is clear and well-sourced',
        'Including exit criteria upfront is a smart move',
      ],
      concerns: [
        {
          text: 'Exact initial investment cost is missing. That\'s the first thing the CFO will ask.',
          severity: 'critical',
          fix_suggestion: 'Add a detailed 6-month cost table (headcount, infrastructure, marketing — line by line)',
          applied: false,
        },
        {
          text: 'I don\'t see the synergy with our existing business. Need an answer to "why us?"',
          severity: 'important',
          fix_suggestion: 'Make the connection to existing assets explicit (customer base, tech stack)',
          applied: false,
        },
      ],
      would_ask: [
        'Do we need to pull people off existing projects?',
        'If it fails after 6 months, what\'s the sunk cost?',
      ],
      approval_condition: 'With a cost table and clear synergy with existing business, this can go on the next leadership meeting agenda.',
    },
    investor: {
      persona_name: 'Partner Lee',
      persona_role: 'VC Partner',
      first_reaction: 'The market is good, but the evidence that THIS team can win in THIS market is thin.',
      good_parts: [
        'Market size and growth rate meet investment criteria',
        '4-week MVP is a strong signal of team execution speed',
      ],
      concerns: [
        {
          text: 'There must be similar services already. The competitive analysis is too shallow.',
          severity: 'critical',
          fix_suggestion: 'Add a 3-competitor comparison matrix + our positioning',
          applied: false,
        },
        {
          text: 'No early traction plan. How do you get the first 10 customers?',
          severity: 'important',
          fix_suggestion: 'Add a 1-page go-to-market strategy — channels, first customers, conversion approach',
          applied: false,
        },
      ],
      would_ask: [
        'What domain experience does the team have?',
        'What\'s the 12-month KPI target?',
      ],
      approval_condition: 'With a stronger competitive analysis and GTM strategy, I\'d schedule a follow-up meeting.',
    },
  },

  // ─── Final Document ───
  finalBase: `# AI Customer Support — E-commerce Sellers (First Entry)

> The competitor opened the market. But the e-commerce seller slot is still empty. **1-day setup · 1/3 the price**, $15K to start, profitable at 25 customers.

## Decision line

> {{decisionLine}}

## One-page summary

| Item | Competitor | Us |
|------|--------|------|
| Target | Enterprise | **E-commerce sellers (SMB)** |
| Setup | 2 weeks | **1 day** (pre-trained, assumption) |
| Price | $800/mo+ | **$290/mo** |
| Headcount | PM + outsourced | **1 senior + 1 junior, dedicated** |

After signing up for the competitor as a seller and using it for an hour — the biggest weakness is **"doesn't fit our industry, so a human ends up answering anyway."** Industry-specificity is our opportunity.

{{thirdWorkerBlock}}
<!-- PATCH_0 -->

## 6-month execution

- **MVP in 4 weeks** — auto-response + e-commerce templates + dashboard
- **Cost $15K** — infrastructure $12K + marketing $3K (no incremental headcount)
- **Break-even at 25 customers** — revenue $7,250 / monthly profit $1,000
- **Safety net** — if existing product breaks, 1 dedicated person returns immediately
<!-- PATCH_1 -->

## Weakest assumption (validate first)

{{weakestAssumption}}

## Next steps

{{nextSteps}}`,

  finalPatches: [
    // concern[0] applied: Specific target industry
    `
### Target Industry: E-commerce

Specific case: 80% of e-commerce seller support tickets follow repeat patterns (shipping/exchanges/returns). Industry-specific automation can **cut support staff costs by 30%**.

Generic solutions require 2-3 months to learn industry-specific terminology and workflows. We deliver in **under 1 week** through pre-training.`,
    // concern[1] applied: Customer acquisition strategy
    `

### Customer Acquisition Strategy

- **Existing network**: Propose free pilots to 10 SMBs within the team's personal network
- **Free trial**: 1 month free, then convert to paid after demonstrating results (target 30% conversion rate)
- **Content marketing**: Industry-specific success story blog posts to drive inbound leads`,
  ],
  seal: {
    prediction: 'This week I get 3 e-commerce sellers on a call, and at least one says "yeah, that’s bleeding money right now."',
  },
  settle: {
    verdict: 'partial',
    happened: 'Talked to 3 sellers. All three agreed the problem is real — but two of them asked "how much?" first.',
    learning: 'The problem was real. The weak spot was pricing — next time I test price before building the beta.',
  },
};

// ═══════════════════════════════════════════════════════════════
// ═══ SCENARIO 2: 🎯 Competitive Proposal ═══
// ═══════════════════════════════════════════════════════════════

const scenario2: DemoScenario = {
  id: 'proposal',
  title: 'Competitive Proposal',
  icon: '🎯',
  desc: 'How to win a pitch against a big competitor',
  checkInDays: 7,
  problemText: 'Next Friday is a competitive pitch for logistics automation at a major retailer. We\'re going up against Company S (a large SI firm) — we\'re an 8-person startup. The client\'s logistics team lead saw our past project and referred us, which is how we got the slot. Budget is around $300K.',

  team: [SUJIN, HYUNWOO],

  // ─── v0: Referral opened the door — what\'s left is proving trust ───
  analysis: {
    version: 0,
    real_question: 'The referral got you halfway in. The other half — "Is picking 8 people instead of Company S safe?" — is what you need to prove at the pitch.',
    hidden_assumptions: [
      'A referral from the logistics lead = operational trust earned. But approval comes from above. The pitch is for convincing the people upstairs.',
      'Company S is "the choice nobody gets blamed for." To beat that, you need to prove "the better choice" — and add "and also safe" as a bonus.',
      '8 people isn\'t a weakness. On a $300K Company S project, the actual senior involved is often just one PM. 3 of our seniors hands-on means stronger real capacity.',
    ],
    skeleton: [
      'First — one line to the logistics lead: "What matters most to you in this pitch?" That answer sets the direction.',
      'With that — identify Company S\'s weaknesses. The big SI playbook: 15 slides about themselves + generic solution + "PM assigned after kickoff."',
      'Here — "Company S comes to introduce themselves; we come to solve your problem." This one sentence runs through the whole pitch.',
      'From that sentence — anticipate objections. "But you\'re small" / "References?" / "What about after the project?" — answers ready for each.',
      '3 pitch slides — the client\'s problem (proof we already know) / why us instead of Company S / prototype in 2 weeks.',
    ],
    insight: 'Company S brings a generic deck. If your pitch opens with the client\'s actual numbers — in that moment "this team is different" gets locked in.',
  },

  // ─── Q1: The one line Company S can\'t write (choose our attack vector) ───
  q1: {
    question: {
      id: 'demo-q1-2',
      text: 'What\'s the one line Company S can never put in their proposal?',
      subtext: 'This line decides who the third teammate is.',
      options: [
        'I\'ll show you a working prototype in the first week',
        'I already know the 3 problems your logistics lead has been sitting on',
        'Same outcome, and we leave $100K on your side',
        'If results miss the bar, we don\'t charge 20% of the fee',
      ],
      type: 'select',
      engine_phase: 'reframe',
    },
    effects: {
      'I\'ll show you a working prototype in the first week': {
        dmKey: 'clevel',
        decisionLine: 'At the pitch I\'ll commit to "a working version in 2 weeks."',
        thirdWorker: {
          persona: JIYUN,
          task: 'Post-pitch 2-week PoC schedule + Go/No-Go',
          completionNote: 'A schedule that gets a working demo out by Week 2.',
          joinMessage: 'Speed has to be proven with a schedule. 🛠 Riley joined.',
          result: '**Took Nathan\'s last slide ("here\'s what I\'ll send you in 2 weeks") and turned it into an actual schedule.**\n\n| Week | What | Output | Go/No-Go |\n|---|---|---|---|\n| W1 D1-2 | 1:1 with logistics lead → real data samples + 3 core scenarios | Data / scenarios | If no samples, flag immediately |\n| W1 D3-5 | Adapt existing project architecture → port auto-classification engine | One working demo video | No video = No-Go |\n| W2 D1-3 | UI + 3 scenario flows | Demoable screens | If stuck, cut to 1 scenario |\n| W2 D4-5 | Demo to logistics lead + feedback | Demo video + feedback notes | Reaction decides full-build kickoff |\n\n**Why Company S can\'t use this schedule:**\n- Company S burns 6-8 weeks on kickoff reporting → PM assignment → requirements doc. At our Week 2, they\'re still assigning the PM.\n- We already have the past-project code to adapt. Starting from zero like Company S is structurally incompatible with 2 weeks.\n\n**The promise at the pitch:** "I\'ll show you a working version before the ink on the contract dries."',
        },
        snapshotPatch: {
          real_question: 'You picked the speed attack. So the question narrows: "Can we actually show something working in 2 weeks?" Riley\'s schedule is the proof.',
          hidden_assumptions: [
            'Company S spends 6-8 weeks on the requirements doc alone. Showing something that works in that window makes "same $300K, different pace" visible to the decision-maker.',
            'The 2-week prototype isn\'t built from scratch — it\'s an adaptation of the past project\'s code. Only a team with prior work can do this.',
            'The speed card only works if there\'s zero gap between "promise" and "actually running." Present the schedule at the pitch, and Week 1 Day 1 needs to start the moment they sign.',
          ],
          skeleton: [
            'First — check which past-project modules can be reused. Open the Postman collection.',
            'Then — put Riley\'s schedule on the last slide of the pitch. Week by week, what you\'ll show.',
            'Core line — "I\'ll send you a working version within 2 weeks of the pitch." This closes the meeting.',
            'Rehearse — expect "is that actually possible?" Have a past-project example ready.',
            'Safety net — one fallback scenario if the demo fails. "If we get stuck, Week 2 shrinks to a single scenario." Pre-announcing this actually builds trust.',
          ],
          insight: 'While Company S is assigning their PM, we\'re showing something that works. Same $300K, different pace in front of the decision-maker — that\'s the heart of the speed attack.',
        },
      },
      'I already know the 3 problems your logistics lead has been sitting on': {
        dmKey: 'manager',
        decisionLine: 'In the opening minutes, I\'ll bring up 3 problems your logistics lead has already raised.',
        thirdWorker: {
          persona: YUNSEO,
          task: 'Extract 3 real problems from the past 6 months of conversations',
          completionNote: 'Pulled 3 real problems from meeting notes, Slack, and minutes.',
          joinMessage: 'Information you already hold is the strongest weapon. 💬 Maya joined.',
          result: '**Went back through everything we have from the past project with the logistics lead.** Meeting notes, minutes, Slack DMs — all of it.\n\n**Three recurring real problems:**\n\n> **Problem 1 — "Inventory movement isn\'t showing up in real time."**\n>\n> Source: 2024-05-23 meeting notes (said directly by the logistics lead)\n> "When we move stock from warehouse B to C, it only shows up the next day. If an order comes in between, inventory is off and shipping gets delayed."\n\n> **Problem 2 — "Every department sees different KPI dashboards, so Monday meetings don\'t work."**\n>\n> Source: 2024-07-12 minutes\n> "Sales, logistics, and customer service are all looking at different numbers. We spend 30 minutes of Monday\'s meeting just explaining the same number."\n\n> **Problem 3 — "The warehouse staff\'s mobile app is slow."**\n>\n> Source: Slack DM, 2024-09-04\n> "Every scan takes 3 seconds. A thousand scans a day means the staff spends an hour just waiting."\n\n**Put these 3 quotes directly in the first 12 minutes of the pitch.** When the logistics lead sees their own words on a slide — internal support ticks up a notch. For the decision-maker, it\'s proof "this team has been listening for 6 months."\n\n**Why Company S can\'t use this:** No prior conversation history. They\'d need to visit the client and start with "what\'s the problem?" — which happens 3-4 weeks after kickoff.\n\n**Check before the pitch:** Before putting the quotes on slides, ping the logistics lead: "Would it be okay to quote these in the pitch?" One sentence is enough.',
        },
        snapshotPatch: {
          real_question: 'You picked the information attack. Proving at the pitch that we already know. Maya pulled three sentences from old conversations. That\'s the spine of the first 12 minutes.',
          hidden_assumptions: [
            'Company S has zero prior relationship with the client, so their pitch opens with questions at the "is that number right?" level. We have 6 months of logs. That\'s a structural advantage.',
            'Quoting the logistics lead directly is a double-edged sword. Confirming the quotes in advance strengthens the internal alliance. Dropping them cold can feel invasive.',
            'The decision-maker doesn\'t hear everything the lead thinks about. When the lead\'s words appear on a slide, the decision-maker discovers "this is what our lead has been worrying about" — the pitch also delivers value *to* the decision-maker.',
          ],
          skeleton: [
            'Today — Maya already combed the past project notes, Slack, and minutes. Three sentences are ready.',
            'Tomorrow — quick confirm with the logistics lead: "Would it be okay to quote these three in the pitch?"',
            'After confirm — those three sentences become the spine of the first 12 minutes. One sentence per slide.',
            'Next to each quote — one line on "how we\'d solve this." (Details come in the build phase.)',
            'At the pitch — the logistics lead\'s expression when seeing these slides is the strongest signal for the decision-maker. That moment is the design core.',
          ],
          insight: 'Turning information you already have into a weapon is the heart of the information attack. Six months with the logistics lead compressed into 12 pitch minutes. Company S cannot build those 12 minutes.',
        },
      },
      'Same outcome, and we leave $100K on your side': {
        dmKey: 'executive',
        decisionLine: 'Same outcome, ~$100K stays on your side of the balance sheet.',
        thirdWorker: {
          persona: MINJAE,
          task: 'Reverse-engineer $300K budget + $100K savings proposal',
          completionNote: 'Same outcome, about $100K stays with the client.',
          joinMessage: 'To win the decision-maker on price, the numbers come first. 📊 Ethan joined.',
          result: '**Built the numbers slide for Nathan\'s "how we\'re different from Company S" chapter.** Broke the $300K down into what actually gets spent and what doesn\'t.\n\n**Company S $300K estimated structure** (mid-size SI industry averages — not Company S\'s actual internal numbers):\n\n| Line item | Share | Amount | Meaning |\n|---|---|---|---|\n| Senior labor | 25% | $75K | 1 full-time PM |\n| Outsourced dev labor | 35% | $105K | Actual build work |\n| Overhead | 20% | $60K | HQ costs |\n| Margin | 20% | $60K | Company S profit |\n| **Total** | **100%** | **$300K** | |\n\n**Our $180K structure** (actual costs):\n\n| Line item | Amount | Meaning |\n|---|---|---|\n| 3 seniors × 6 months | $135K | Direct labor |\n| Infrastructure/cloud | $15K | Dev + ops |\n| Internal overhead | $10K | Our 8-person company\'s real overhead |\n| Margin | $20K | (Honest) |\n| **Total** | **$180K** | |\n\n**The $120K gap is cash the decision-maker can actually use:**\n- **Contingency** (project risk buffer)\n- **Phase 2 expansion** funding\n- **Retained cash** — stays on the balance sheet\n\n**Last slide of the pitch, directly to the decision-maker:**\n> "You handed me $300K. I need $180K. The remaining $120K stays with you."\n\n**Why Company S can\'t use this:** Disclosing internal cost structure + margin compression is structurally impossible at a large SI firm. It requires HQ approval that doesn\'t come at the proposal stage.\n\n**Honest risk:** This proposal significantly cuts our margin. Only works as a first-contract / reference-building play. Add a contract clause: **"exclusive reference rights for the first year."**',
        },
        snapshotPatch: {
          real_question: 'You picked the price attack. There\'s only one thing to prove — "Why $180K is enough for the same outcome, not $300K." Ethan broke it down.',
          hidden_assumptions: [
            'Large SI quotes carry heavy HQ overhead and margin. We don\'t, so the same outcome can come at a lower price. This is industry-average estimation, not Company S\'s actual internals — make that distinction clear at the pitch.',
            'Framing the $120K gap as "we\'re cheap" vs "stays with you" lands very differently. "Money left in your organization" is vastly more direct value for the decision-maker.',
            'This proposal seriously compresses our margin. Only works as a first-contract reference play. Internal alignment — "this is not a repeatable model" — has to happen before we commit.',
          ],
          skeleton: [
            'First — Ethan\'s cost breakdown table becomes the hero slide of chapter 2. Company S estimate vs our actual, side by side.',
            'Then — frame it as "$120K stays with the client." That\'s what lodges in the decision-maker\'s head.',
            'Must include — one line: "This is an estimate based on mid-size SI industry averages." Honesty builds trust.',
            'Contract — pre-draft the "first-year exclusive reference" clause. This is how we justify the margin cut internally.',
            'Final line — "If you need $300K, take it. But $180K is enough for us." Humility is the weapon.',
          ],
          insight: 'The price attack isn\'t "we\'re cheap" — it\'s "we leave money with you." Once the decision-maker thinks "our organization keeps $120K," Company S can\'t win on numbers.',
        },
      },
      'If results miss the bar, we don\'t charge 20% of the fee': {
        dmKey: 'clevel',
        decisionLine: 'If results fall short of the bar, we hold back 20% of the fee in the contract.',
        thirdWorker: {
          persona: DOHYUN,
          task: 'Design the 20% performance-linked fee structure',
          completionNote: 'A structure where 20% of the fee is held back if results miss.',
          joinMessage: 'Risk-sharing eases the decision-maker\'s burden. 📈 Owen joined.',
          result: '**Reframed Nathan\'s "promise" chapter as a performance-linked contract.**\n\n**Base structure:**\n- **20% of contract value is performance-linked** ($36K on a $180K contract)\n- The other 80% ($144K) is paid normally — we cover the development regardless\n- **Three performance criteria** written into the contract\n\n**Three performance metrics** (tied directly to the real pains Maya found from the logistics lead):\n\n| Metric | How to measure | Threshold | If missed |\n|---|---|---|---|\n| Shipping processing time | System average processing time | 30% faster than today | $12K held back |\n| Inventory error rate | Monthly inventory audit variance | 50% fewer errors | $12K held back |\n| Floor satisfaction | Quarterly user survey | 3.8+ out of 5 | $12K held back |\n\n**All three hit → 20% paid in full. Partial misses → only that portion held back.**\n\n**Why Company S can\'t use this:**\n- Fixed-price contracts are the standard at large SI firms. Performance-linked terms count as financial risk at HQ, so they won\'t survive the proposal review.\n- This single clause proves the structural gap. **"We stand behind the result"** is a sentence a large firm cannot write.\n\n**Last slide of the pitch, directly to the decision-maker:**\n> "We stand behind the result. This clause goes into the contract as-is."\n\n**Honest risk (our side):**\n- All three metrics currently have no baseline measurement. We need to **do baseline measurement together before the contract is signed.** That\'s the first 2 weeks of work.\n- Maximum loss on a miss: $36K. About 2 months of team payroll. Manageable, but not trivial.',
        },
        snapshotPatch: {
          real_question: 'You picked the risk-sharing attack. The decision-maker\'s biggest fear is "paying and getting nothing." Owen took 20% of that fear onto our side of the ledger.',
          hidden_assumptions: [
            'Performance-linked clauses are structurally impossible at large SI firms. They get blocked at proposal review as HQ financial risk. This one clause proves the structural gap with Company S.',
            'Performance metrics have to be measurable. Ambiguous metrics become dead clauses and actively destroy trust. Doing baseline measurement in the 2 weeks before the contract is the key.',
            '20% held back is a real risk for us too. A $36K miss is about 2 months of team payroll. In return, "we stand behind the result" lodges in the decision-maker\'s head at the pitch. Whether that trade is fair needs internal sign-off first.',
          ],
          skeleton: [
            'First — confirm Owen\'s 3 metrics. One check-in with the logistics lead ("are these the right three?").',
            'Then — baseline measurement plan. Document how each metric will be measured in the 2 weeks before contract. Fuzzy measurement kills the clause.',
            'Must include — offer the first 2 weeks of baseline measurement for free. Trust-building before the contract.',
            'Internal alignment — does the team accept the possibility of a $36K loss? 1:1 with the founder first.',
            'Last line — "We stand behind the result. This clause goes into the contract." That closes the pitch.',
          ],
          insight: 'Risk-sharing turns "we\'re better" from a claim into an action. It directly addresses the decision-maker\'s fear (paying for nothing). This is a card a large firm is structurally prevented from playing.',
        },
      },
    },
  },

  // ─── Q2: 4 days until pitch — what to do first (validation/action, after seeing worker results) ───
  q2: {
    question: {
      id: 'demo-q2-2',
      text: '4 days until the pitch. What do you do first?',
      subtext: 'Where you spend the time decides how heavy the pitch lands.',
      options: [
        'Invite the logistics lead to dinner — get decision-maker hints',
        'Analyze 2 reference cases from the client\'s industry',
        'Build a working mini-prototype in 4 days',
        'Reframe 2 past projects in the decision-maker\'s language',
      ],
      type: 'select',
      engine_phase: 'reframe',
    },
    effects: {
      'Invite the logistics lead to dinner — get decision-maker hints': {
        snapshotPatch: {
          insight: 'Your referrer is also your intel source. Meeting them one more time to hear what the decision-maker cares about is the highest leverage use of 4 days.',
        },
        weakestAssumption: {
          assumption: 'Is the logistics lead actually on our side, or neutral?',
          explanation: 'They referred you, sure, but there could be internal politics in play. Until you meet, you don\'t really know where they stand.',
        },
        nextThreeDays: [
          'Today — suggest dinner to the logistics lead (one Slack message)',
          'At dinner, three questions only — "Why did you refer us?" / "What does the decision-maker care about most?" / "How do you feel about Company S?"',
          'Based on the answers, write the first 30 seconds of the pitch + 2 pre-written answers to likely decision-maker concerns',
        ],
        dmFirstReaction: 'You met the logistics lead ahead of time? Reasonable move — but watch the fairness optics. Frame it clearly as "pitch prep," and you pick up the dinner tab.',
      },
      'Analyze 2 reference cases from the client\'s industry': {
        snapshotPatch: {
          insight: 'How similar companies have solved similar problems is a strong reinforcement for the pitch. But you have to be able to answer "are they really similar to us?"',
        },
        weakestAssumption: {
          assumption: 'Do those reference cases actually look like the client\'s situation?',
          explanation: 'Force-fitting the mapping collapses under one question: "that\'s not us." You have to split commonalities and differences honestly.',
        },
        nextThreeDays: [
          'Day 1 — collect public cases of logistics automation at 2 companies in the same industry (press, conference talks)',
          'Day 2-3 — 3 commonalities / 2 differences mapped out. "Reference, not copy"',
          'Day 4 — one slide: "Company A solved this problem this way; we\'d adjust it for your situation like this"',
        ],
        dmFirstReaction: 'You brought up other companies\' cases. Are they really like us, though? If you lump us together it feels off. Call out the differences too.',
      },
      'Build a working mini-prototype in 4 days': {
        snapshotPatch: {
          insight: 'One working screen beats a hundred words. But shipping something that actually runs in 4 days is a gamble.',
        },
        weakestAssumption: {
          assumption: 'Can we really build something that runs in 4 days?',
          explanation: 'Mock data without real data, and the pitch collapses under one "this is fake, right?" question. Getting real data takes time by itself.',
        },
        nextThreeDays: [
          'Day 1 — identify reusable modules from past-project code + prep mock data',
          'Day 2-3 — build one working screen (minimum viable feature)',
          'Day 4 — live demo rehearsal + record a 30-second fallback video (in case it freezes)',
        ],
        dmFirstReaction: 'A live demo is double-edged. If it lands, you close a big one. If it freezes, the whole contract walks — that\'s a real loss for us. How are you mitigating that risk?',
      },
      'Reframe 2 past projects in the decision-maker\'s language': {
        snapshotPatch: {
          insight: 'Thin references are a weakness. But "we\'ve already solved a problem like this" flips it into a weapon.',
        },
        weakestAssumption: {
          assumption: 'Do the past projects really resemble logistics?',
          explanation: 'Force-fitting breaks under one decision-maker question. "That was B2B SaaS, totally different" — one line is enough.',
        },
        nextThreeDays: [
          'Day 1 — organize deliverables from 2 past projects (KPI gains + architecture diagrams)',
          'Day 2-3 — one slide: "Not logistics, but same problem pattern." No forced mapping — map the pattern.',
          'Day 4 — one rehearsal + prepared answer for "but do you have the experience?"',
        ],
        dmFirstReaction: 'You don\'t have logistics experience? The past projects you showed look like B2B SaaS — very different from the floor. How do you plan to close that gap?',
      },
    },
  },

  // ─── Workers (default 2 — third joins via q1.effects.thirdWorker based on Q1 answer) ───
  workers: [
    {
      persona: SUJIN,
      task: 'Company S pattern analysis + our weapons inventory',
      completionNote: 'Company S comes to introduce themselves; we come to solve the problem.',
      result: '**Put Company S and us on the same axis.** (SI industry public cases + internal team review)\n\n| Dimension | Company S (large SI) | Us (8-person startup) |\n|---|---|---|\n| Pitch style | 15-slide company intro + generic solution | (Our choice) |\n| Staffing | Sales/PM + outsourced dev | **3 seniors hands-on** |\n| First deliverable after kickoff | Requirements doc (6-8 weeks) | Working demo possible |\n| Decision-making | 3 internal layers | Immediate |\n| Prior relationship with client | **None** | **6 months with the logistics lead** |\n\n(Industry data: 70%+ of mid-size SI projects run on PM + outsourced structures. Not always, but common at Company S\'s scale.)\n\n**Three weapons we\'re holding** (from internal asset review):\n\n1. **2 past projects** — not logistics directly, but B2B backend + real-time processing. Postman collections + architecture diagrams all on hand, ready to adapt.\n2. **Seniors at the pitch itself** — something only possible for a company our size. Company S sends sales + PM. Questions get answered **in the room**.\n3. **6 months of conversations with the logistics lead** — meeting notes and Slack logs accumulated through the past project. We already know where the real problems are.\n\n**Compressed into one line:**\n\n> **"Company S comes to introduce themselves; we come to solve *your* problem."**\n\nThis sentence runs through the entire pitch. Company S can\'t write it — no prior relationship with the client.',
    },
    {
      persona: HYUNWOO,
      task: 'Pitch 3-chapter skeleton + 30-minute time box',
      completionNote: '20 of the 30 minutes are about the client.',
      result: '**Took Sophie\'s 3 weapons and laid out a 3-chapter pitch.** 30 minutes, run in the exact opposite direction of how Company S spends their time.\n\n| Chapter | Title | Time | Core |\n|---|---|---|---|\n| 1 | **"The client\'s real problem"** | 12 min | Quote 3 conversations with the logistics lead. Proof: "we\'ve been listening" |\n| 2 | **"How we differ from Company S"** | 8 min | One comparison table on what\'s different for the same $300K *(details filled in by whoever joins next)* |\n| 3 | **"Here\'s what I\'ll send you one week after the pitch"** | 10 min | Post-pitch deliverable promise — action, not words |\n\n**What the time split means:**\n- Company S spends **15 of 30 minutes introducing their company** (standard 15-slide formula).\n- We spend **20 minutes on the client\'s story**.\n- That difference is what stays in the decision-maker\'s memory.\n\n**Pitch room setup:**\n- **All 3 seniors present.** Questions answered in the room. Company S sends sales + PM.\n- One person driving slides, the other two taking notes + ready for questions.\n- "The people who answer questions in real-time are sitting here" — that\'s what 8 people actually gives you.\n\nThe **decisive last line** of the last slide gets finished by whoever joins next.',
    },
  ],

  draft: {
    title: 'Competitive Pitch Proposal',
    executive_summary: 'We deeply understand the client\'s digital transformation challenges. We win with what large firms can\'t offer: **a tailored approach + fast execution.** The team you see at the pitch is the team that delivers your project, start to finish.',
    sections: [
      { heading: 'The Client\'s Challenge', content: 'The core challenge is succeeding at digital transformation in a rapidly shifting market. But generic solutions from large vendors **can\'t deliver the industry-specific speed you need.**' },
      { heading: 'Why Us', content: 'At large firms, PMs rotate and subcontractors do the actual work. With us, **the team you meet at the pitch sees the project through to the end.** Decisions are fast. You get our full attention.' },
      { heading: 'Execution Plan', content: '**Prototype delivered within 2 weeks** of kickoff. Large firms take 4-6 weeks. Weekly progress reviews to adjust direction together.' },
    ],
    key_assumptions: [
      'Client values speed and customization over brand name',
      'We can demonstrate deep understanding at the pitch',
      'Lack of references can be offset by execution speed',
    ],
    next_steps: [
      'Final review of pitch materials + rehearsal',
      'Pre-pitch interview with client contact (if possible)',
      'Prepare 20 anticipated Q&A questions for pitch day',
    ],
  },

  // ─── Draft V2 (condensed card — Q1 decisionLine/thirdWorker + Q2 weakestAssumption/nextThreeDays override at runtime) ───
  draftV2: {
    title: 'Logistics Automation — Competitive Pitch Strategy (vs Company S)',
    decisionLineDefault: 'Company S comes to introduce themselves; we come to solve your problem.',
    workerSummariesDefault: [
      {
        personaId: 'researcher', // SUJIN — Sophie
        headline: 'Company S vs us information gap',
        lines: [
          'Company S pattern: PM+outsourced / 15-slide company intro / requirements doc 6-8 weeks',
          'Our weapons: **2 past projects** + **3 seniors at the pitch** + **6 months of logistics lead conversations**',
        ],
      },
      {
        personaId: 'strategist', // HYUNWOO — Nathan
        headline: 'Pitch 3-chapter skeleton',
        lines: [
          '12 min client problem + 8 min Company S difference + 10 min "here\'s what I\'ll send in a week"',
          'Company S spends 15 min introducing themselves. **We spend 20 min on the client\'s story** — that\'s what sticks',
        ],
      },
    ],
    weakestAssumptionDefault: {
      assumption: 'Will the logistics lead\'s referral alone carry through to executive approval?',
      explanation: 'A referral opens the door, executives make the call. The evidence to convince the executives is still thin.',
    },
    nextThreeDaysDefault: [
      'Decide how to spend the remaining pitch-prep time (Q2 answer decides this)',
      'Lock in that all 3 seniors attend the pitch — devs in the room, not sales',
      'One rehearsal — first 30 seconds + 5 likely questions',
    ],
  },

  dmVariants: {
    manager: {
      persona_name: 'Team Lead Lee',
      persona_role: 'Client Project Manager',
      first_reaction: 'I can feel the enthusiasm, but... to get this approved upstairs, I need more objective evidence.',
      good_parts: [
        'It\'s clear you understand our industry',
        'The timeline is specific, which builds confidence',
      ],
      concerns: [
        {
          text: 'I can\'t tell if you\'ve done a project of similar scale before. Even one reference would help.',
          severity: 'critical',
          fix_suggestion: 'Add 1 similar-scale/industry project case study (or relevant capability evidence if none exists)',
          applied: false,
        },
        {
          text: 'With a small team, I\'m worried about how much focus our project actually gets.',
          severity: 'important',
          fix_suggestion: 'Add a dedicated staffing plan + explicitly state "this project is our #1 priority"',
          applied: false,
        },
      ],
      would_ask: [
        'Are you running other projects at the same time?',
        'What guarantees that our contact person won\'t change mid-project?',
      ],
      approval_condition: 'With a clear reference and dedicated staffing plan, I can bring this to upper management.',
    },
    clevel: {
      persona_name: 'EVP Jung',
      persona_role: 'Client Head of Digital Innovation',
      first_reaction: 'The proposal itself isn\'t bad, but the reason to pick you over the big firm is still weak.',
      good_parts: [
        'The fast execution speed is attractive',
        'Having the founder directly involved feels genuine',
      ],
      concerns: [
        {
          text: 'I need more evidence that a company your size can handle a project like ours.',
          severity: 'critical',
          fix_suggestion: 'Add detailed team capabilities + contingency scaling plan (partner network, etc.)',
          applied: false,
        },
        {
          text: 'There\'s no long-term partnership perspective. What happens after this project ends?',
          severity: 'important',
          fix_suggestion: 'Add a 1-page post-project maintenance/expansion roadmap',
          applied: false,
        },
      ],
      would_ask: [
        'Will this company still be around in 3 years?',
        'What about security and compliance?',
      ],
      approval_condition: 'With a team capability plan and long-term partnership vision, you\'d stay in the final shortlist.',
    },
    executive: {
      persona_name: 'CFO Park',
      persona_role: 'Client CFO',
      first_reaction: 'The numbers are attractive. But I can\'t take "$100K stays with you" on face value. Your Company S estimate is industry averages — if real Company S numbers are different, the whole claim collapses.',
      good_parts: [
        'Breaking the $300K down instead of just quoting a total — that\'s rare. Most pitches don\'t.',
        'Disclosing "our margin is $20K" openly. Tells me you\'re not the lying type.',
      ],
      concerns: [
        {
          text: '"Company S overhead 20%, margin 20%" — you said industry average. If actual Company S numbers are far off, the whole pitch looks like false advertising. Make "estimate" more visible on the slide.',
          severity: 'critical',
          fix_suggestion: 'Footnote under the estimate table: "Based on mid-size SI industry averages." Cite the source.',
          applied: false,
        },
        {
          text: 'At this margin, where does your company stand a year from now? After the first reference, you need to get back to normal pricing.',
          severity: 'important',
          fix_suggestion: 'Contract clauses: "Exclusive reference rights for year 1" + "Normal pricing from year 2"',
          applied: false,
        },
      ],
      would_ask: [
        'What if you ask for a budget increase mid-project?',
        'What are the contract termination terms?',
      ],
      approval_condition: 'With the estimate source cited and the reference-rights clause in, I can put this on the budget review table.',
    },
  },

  // ─── Final Document (placeholders: {{decisionLine}}, {{thirdWorkerBlock}}, {{weakestAssumption}}, {{nextSteps}}) ───
  finalBase: `# Logistics Automation — Competitive Pitch Strategy (vs Company S)

> Company S comes to introduce themselves; we come to solve *your* problem.

## The core line

> {{decisionLine}}

## Us vs Company S

| Dimension | Company S (large SI) | Us (8-person) |
|------|-----|------|
| At the pitch | Sales + PM | **3 seniors hands-on** |
| First deliverable after kickoff | Requirements doc (6-8 weeks) | Working demo possible |
| Decision-making | 3 internal layers | Immediate |
| Prior relationship with client | None | **6 months with the logistics lead** |

(Company S pattern = estimated from mid-size SI industry averages. Not every Company S project runs this way.)

## The 3-chapter pitch (30 minutes)

| Chapter | Time | Content |
|---|---|---|
| 1. The client's real problem | **12 min** | 3 problems extracted from 6 months of logistics lead conversations |
| 2. How we're different from Company S | 8 min | What's different for the same $300K |
| 3. The post-pitch promise | 10 min | Concrete deliverables within 1 week of the pitch |

Company S spends 15 of 30 minutes introducing themselves. **We spend 20 minutes on the client's story.**

{{thirdWorkerBlock}}
<!-- PATCH_0 -->

## The honest line (weakest assumption)

{{weakestAssumption}}
<!-- PATCH_1 -->

## Next 3 days / pitch prep

{{nextSteps}}`,

  finalPatches: [
    // concern[0]: past projects + dedicated staffing
    `
### Past projects + dedicated staffing

| Past project (B2B backend domain) | Duration | Result |
|---------|------|------|
| Past project 1 | ~10 weeks | Significant reduction in manual processing time |
| Past project 2 | ~8 weeks | Stabilized real-time processing |

(Details shared separately once NDA is in place.)

**Dedicated staffing**: 3 seniors hands-on + founder in weekly reviews. **"Priority #1" written into the contract.**
`,
    // concern[1]: long-term safety
    `

### Long-term safety

- **3 months of free maintenance** post-launch — bug fixes + performance tuning
- **Full code & documentation handover** — your internal team can run it without us
- **Backup capacity** — partner firm MOU, 2 additional engineers within 48 hours if needed`,
  ],
  seal: {
    prediction: 'On PT day, the logistics lead names us first or backs us in front of the execs.',
  },
  settle: {
    verdict: 'held',
    happened: 'The logistics lead opened with "I saw your last project." The exec questions moved from price to how we’d execute.',
    learning: 'An inside champion actually opened the door. Next PT, "secure someone who’ll back us" comes first.',
  },
};

// ═══════════════════════════════════════════════════════════════
// ═══ SCENARIO 3: ⚖️ Competitive Response ═══
// ═══════════════════════════════════════════════════════════════

const scenario3: DemoScenario = {
  id: 'strategy',
  title: 'Competitive Response',
  icon: '⚖️',
  desc: 'Competitor slashed prices — how do we respond?',
  checkInDays: 7,
  problemText: 'Company T just cut their subscription pricing by 30% out of nowhere. We\'re a B2B SaaS — $100K monthly revenue, 80 customers. Sales already pinged me: "3 customers asked about Company T\'s price." I have to bring a response strategy to Friday\'s leadership meeting.',

  team: [SUJIN, HYUNWOO],

  // ─── v0: Urgent feels urgent, but look at the numbers first ───
  analysis: {
    version: 0,
    real_question: '3 out of 80 asked = 96% haven\'t moved. It feels urgent, but the numbers may show more room than your gut tells you.',
    hidden_assumptions: [
      'Why did Company T cut 30%? If it\'s burning investor cash, just outlasting them ends it. If they\'re structurally cheaper, you\'ll never win on price.',
      '"Asked about it" ≠ "leaving." Asking is normal. Separating real churn intent from shopping is the first move.',
      'A blanket price cut destroys the margin on $100K/month revenue — calculate how long you can survive that before you decide.',
    ],
    skeleton: [
      'Today — ask sales precisely: "What exactly did those 3 customers say? Real churn intent, or price comparison?"',
      'Based on that — separate real risk from casual shopping. How many of the 80 are actually at risk?',
      'Tomorrow — check margin structure. If you cut 30%, what happens to monthly profit? This number decides "can we match at all?"',
      'This week — figure out why Company T cut. Recent Series B → probably burning cash.',
      'Friday report — 3 options (match / differentiate / selective discount) + side-by-side 6-month outcomes.',
    ],
    insight: '3 customers asking is real. But 3 out of 80 is real too. The bigger risk isn\'t fear — it\'s overreaction. A blanket cut stops churn but kills margin.',
  },

  // ─── Q1: Gut instinct (strategy dimension — third worker validates the instinct) ───
  q1: {
    question: {
      id: 'demo-q1-3',
      text: 'What does your gut tell you to do?',
      subtext: 'No right answer. The third teammate validates whether the instinct actually holds up.',
      options: [
        'We should match — I\'m scared of losing customers',
        'We shouldn\'t match — we have to protect our value',
        'Don\'t move yet — let\'s see how long they can last',
        'This is actually an opportunity — push harder on differentiation',
      ],
      type: 'select',
      engine_phase: 'reframe',
    },
    effects: {
      'We should match — I\'m scared of losing customers': {
        dmKey: 'meeting',
        decisionLine: 'Only as far down as the margin can bear (~15%), and only for customers who ask to match Company T.',
        thirdWorker: {
          persona: MINJAE,
          task: 'Calculate the price cut limit where margin survives',
          completionNote: '15% is the floor. A full 30% match is impossible.',
          joinMessage: 'A defensive gut has to be checked against the numbers. 📊 Ethan joined.',
          result: '**Recalculated Nathan\'s Scenario A (match the cut) from a margin-first angle.**\n\n**Current structure (our side, estimates):**\n- Monthly revenue $100K\n- Estimated margin ~30% → monthly profit $30K\n- Fixed costs (payroll, infra) ~$70K\n\n**Price cut simulation:**\n\n| Cut | Monthly revenue | Monthly profit | Profit change |\n|---|---|---|---|\n| 0% (current) | $100K | $30K | baseline |\n| 10% | $90K | $20K | **-33%** |\n| 15% | $85K | $15K | **-50%** |\n| 20% | $80K | $10K | **-67%** |\n| 30% (match Company T) | $70K | **$0** | **-100%** |\n\n**Reading it:**\n- 30% cut = $0 monthly profit. Structurally impossible to sustain.\n- **10-15% is the floor.** Anything below that tips into structural loss.\n- But 10-15% doesn\'t catch Company T\'s 30%. **"Match the cut" is fundamentally not a viable strategy.**\n\n**🔍 What the instinct missed:**\n> The biggest trap in matching isn\'t "how much to cut." It\'s **"why are you cutting?" — and you have no answer when existing customers ask.** Once you cut, existing customers start thinking "so they were ripping us off," and trust starts bleeding.\n\n**Realistic path:**\nInstead of a blanket cut, **"only offer a 15% discount to customers who come asking to match Company T"** — that\'s actually workable. Everyone else stays at full price.\n\n*Estimate caveat: 30% margin is an assumption. Need finance to confirm actual numbers first.*',
        },
        snapshotPatch: {
          real_question: 'Following the "match the cut" instinct, the real question is one thing — "How far can we survive cutting?" Ethan found the floor.',
          hidden_assumptions: [
            'The instinct to match is normal. In the face of churn fear, it feels like the safest option.',
            'But when you run the margin math, a 30% match is structurally impossible. You have to see the gap between instinct and numbers.',
            'A 15% partial match actually converges on Scenario B (selective discounts). The instinct survives, but the form changes.',
          ],
          skeleton: [
            'First — get actual margin from finance. Confirm whether the 30% estimate is real.',
            'Then — put the "15% cut" profit simulation directly in the report.',
            'Core — prove with data that "a blanket cut is impossible." Why the instinct can\'t survive, in numbers.',
            'Alternative — "only for customers who ask to match Company T, individual 15% discount." This is the viable form of the instinct.',
            'At the leadership meeting — "The instinct said match, but the data says partial match is the ceiling." Be honest about it.',
          ],
          insight: 'The instinct isn\'t wrong. The discovery is that you can\'t execute it as-is. The 15% floor is a new starting point.',
        },
      },
      'We shouldn\'t match — we have to protect our value': {
        dmKey: 'ceo',
        decisionLine: 'Selective discounts for 10 at-risk customers only. Value script + discount-authority matrix for the other 70.',
        thirdWorker: {
          persona: JIYUN,
          task: 'Simulate whether the value script actually lands in sales conversations',
          completionNote: 'The script alone isn\'t enough. It needs a discount-authority matrix alongside.',
          joinMessage: 'Whether the instinct survives in the field is what matters. 🛠 Riley joined.',
          result: '**Pressure-tested Nathan\'s Scenario B (value defense) from a sales-floor angle.**\n\n**"Why we\'re worth more" value script (3 lines):**\n> 1. "We respond within 4 hours. Company T averages 24."\n> 2. "We come pre-configured for your industry. Company T needs template customization."\n> 3. "At Company T\'s price, getting our level of service ends up costing extra anyway."\n\n**Field simulation (sales rep A roleplay):**\n- Customer: "Company T is 30% cheaper."\n- Rep: *delivers lines 1-3*\n- Customer: "Okay, I hear that, but 30% is still a lot."\n- Rep: *stuck* → **the discount request repeats because the rep has no authority.**\n\n**🔍 What the instinct missed:**\n> The value script alone isn\'t enough. **"What do we do when the customer still wants a discount after hearing the script three times?"** isn\'t defined. If the rep ends with "I\'m sorry" and no discount authority, that customer walks out of the room. **A discount-authority matrix has to ride with the script.**\n\n**Recommended reinforcement — 3-tier matrix:**\n\n| Tier | Customer count | Revenue share | Response |\n|---|---|---|---|\n| **Top** | 20 | 60% | Value script + **15% selective discount if churn risk** (sales lead approval) |\n| **Mid** | 40 | 35% | Value script only, no discount |\n| **Bottom** | 20 | 5% | Allow natural churn (revenue impact under 1%) |\n\nWithout this matrix, "I want a discount too" spreads to all 80 and the strategy degenerates into Scenario A. The matrix is how the instinct survives in the field.',
        },
        snapshotPatch: {
          real_question: 'The "protect the value" instinct is right. The real question is — "How does the sales team actually execute it in the field?" Riley built the matrix.',
          hidden_assumptions: [
            'The value instinct is close to the correct answer. Given the switching cost of the top 20 customers, there\'s no reason to get pulled into a price war.',
            'But if you only ship the script, the field ends with "no discount authority" and customers still leave. The authority matrix is how the instinct gets executed.',
            '"Allow natural churn for the bottom 20" is a scary decision. But at 1% revenue impact, it\'s rational — and pre-deciding it relieves the sales team\'s burden.',
          ],
          skeleton: [
            'First — segment the 80 customers by revenue: top 20 / mid 40 / bottom 20.',
            'Then — one page: 3-line value script + discount matrix.',
            'Core — only the sales lead has discount approval. Regular sales runs "script + escalate to lead."',
            'At the leadership meeting — emphasize "shipping only the script is a trap. The matrix has to go with it."',
            'Execution — share the matrix at Monday\'s sales meeting immediately.',
          ],
          insight: 'To carry the instinct into the field, you need field tools. Script + matrix = the executable form of "value defense." The teammate caught this, and the instinct became reality.',
        },
      },
      'Don\'t move yet — let\'s see how long they can last': {
        dmKey: 'ceo',
        decisionLine: 'Bet that Company T can\'t hold 18 months. Only the top 20 get active defense. Everyone else: monitoring.',
        thirdWorker: {
          persona: DOHYUN,
          task: 'Company T vs our long-term endurance',
          completionNote: 'Company T: 12-18 months. Us: 24+ months. But with a condition.',
          joinMessage: 'The wait strategy needs a long-term view to back it up. 📈 Owen joined.',
          result: '**Rechecked Nathan\'s Scenario C (wait) from a Company T vs us endurance angle.**\n\n**Company T endurance estimate** (based on public info Sophie collected):\n- Series B ~$20M raised (2 months ago)\n- Monthly burn estimate: payroll + marketing + discount absorption = $1.5-2M/month\n- **Runway: roughly 12-18 months**\n- After that, if they can\'t raise again → price normalization or shrinking operations\n\n**Our endurance** (current structure):\n- Monthly revenue $100K, monthly profit $30K (at 30% margin, estimated)\n- With 6+ months of cash reserves, **we can handle churn up to 15% for 18+ months.**\n- But above 25% churn, fixed costs ($70K) start threatening the whole structure.\n\n**Three conditions for winning the endurance war:**\n1. **Churn defended under 15%** (don\'t let 3.75% escalate)\n2. **Top 20 customers (60% of revenue) stay locked** — if they move, the structure collapses\n3. **Maintain 6+ months cash reserves** — operational runway in an emergency\n\n**🔍 What the instinct missed:**\n> "Wait" turning into "do nothing" is dangerous. **You have to wait *while* actively defending the top 20.** By the time they start moving, it\'s already too late. Waiting is "no blanket response" — it\'s not "no monitoring."\n\n**Recommended reinforcement:**\n- Wait strategy = "no blanket price cut" + "**dedicated manager regular contact with top 20, intensified**"\n- Monthly churn dashboard. If it goes over 5%, trigger partial response.\n- Pre-book the 12-month reassessment meeting on the calendar.\n\n*Estimate caveat: Company T\'s monthly burn rate is based on industry averages, not precise numbers. Flag it as "estimated" in the report.*',
        },
        snapshotPatch: {
          real_question: 'The "don\'t move" instinct is reasonable. The real question is one thing — "How do we protect the top 20 while we wait?" Owen laid out the conditions.',
          hidden_assumptions: [
            'The wait instinct comes from the intuition that we\'re stronger in an endurance war. Actually checks out — Company T 12-18 months vs us 24+ months. The intuition is right.',
            'But if "wait" gets translated to "no response," it\'s dangerous. By the time the top 20 wobble, you\'re already late. Active defense is mandatory.',
            'Pre-scheduling a 12-month reassessment trigger keeps "waiting" from turning into "neglect."',
          ],
          skeleton: [
            'First — finalize the top 20 customer list. By revenue contribution + contract duration.',
            'Then — assign dedicated managers + regular contact schedules. Monthly check-in + quarterly meeting.',
            'Parallel — monthly churn dashboard. Above 5% triggers partial response.',
            '12-month mark — pre-book the Company T reassessment meeting on the calendar. Put "that date" on a real date.',
            'Leadership meeting — "wait + active defense + 12-month reassessment" as 3 parallel tracks.',
          ],
          insight: 'Waiting isn\'t non-response. "No blanket response" + "top 20 active defense" + "12-month reassessment" is one set. The instinct is right, but the details are what make the instinct work.',
        },
      },
      'This is actually an opportunity — push harder on differentiation': {
        dmKey: 'meeting',
        decisionLine: 'Short-term: defensive selective discounts. Mid-term (6 months): prepare a premium tier. Two-track.',
        thirdWorker: {
          persona: YUNSEO,
          task: 'Validate whether customers would accept a premium repositioning',
          completionNote: 'Attractive, but needs 6 months of lead time. Not doable by Friday.',
          joinMessage: 'A counter-attack is exciting, but customer perception has to catch up. 💬 Maya joined.',
          result: '**Validated Nathan\'s Scenario D (premium repositioning) from a customer perception angle.**\n\n**What does "move upmarket as premium" actually mean?**\n- Raise pricing 2-3x above Company T\n- Redesign features/services for customers "with more to spend"\n- Stop competing in the same market as low-cost players like Company T\n\n**Current perception of the 80 customers (estimate):**\n- Most customers perceive current pricing as "reasonable." Raising it suddenly gets "why all of a sudden?"\n- Premium brand transitions usually need **6-12 months of lead time**. Perception doesn\'t shift overnight.\n- You can raise at contract renewal naturally, but renewal is annual, so the effect is slow.\n\n**🔍 What the instinct missed:**\n> Premium repositioning is attractive, but **it doesn\'t fit the "report by Friday" timeline.** This is a 6-month strategy, not a Friday answer. Trying to execute the instinct as-is, the leadership meeting stalls on "what are we supposed to do right now?"\n\n**Recommended — short-term/mid-term two-track:**\n\n| Timeframe | Strategy | Concrete actions |\n|---|---|---|\n| **Short-term** (this quarter) | Selective discounts + value script (Scenario B) | 15% discount for 10 at-risk customers, value delivery to the other 70 |\n| **Mid-term** (6 months) | Start designing premium tier | Interview top 20, validate premium value hypothesis |\n| **Long-term** (12 months) | Launch premium tier + price increase at renewal | Natural transition at renewal |\n\nFor Friday\'s meeting, bringing a **"short-term B + mid-term D"** two-step roadmap is realistic. Doesn\'t kill the instinct, keeps it alive within the schedule.',
        },
        snapshotPatch: {
          real_question: '"This is an opportunity" might be the right answer long-term. The real question is — "What do we do *right now* while preparing the 6-month premium pivot?" Maya solved it with a two-track.',
          hidden_assumptions: [
            'Offensive instincts often prove rational in the long run. Company T\'s price cut lowers the market price band, so we can move up into the empty space above.',
            'But you can\'t ignore the time constraint. Showing up at Friday\'s leadership meeting with "let\'s go premium" gets "and what about right now?" — no answer.',
            'Short-term B + mid-term D as a two-track translates the instinct into an executable form. Doesn\'t kill the instinct, keeps it alive.',
          ],
          skeleton: [
            'Short-term — execute Scenario B immediately. Selective discounts + value script.',
            'Mid-term prep 1 — interview 5-7 of the top 20. "What kind of value would make you willing to pay more?"',
            'Mid-term prep 2 — write 3 premium tier hypotheses. To validate within 6 months.',
            'Leadership meeting — two-step roadmap: "short-term defense + mid-term premium prep." Honor the instinct, fit the schedule.',
            '12-month — launch the premium tier + natural price increase at renewal.',
          ],
          insight: 'The offensive instinct can be right, but it collapses if you ignore the clock. Short-term defense + mid-term offense is how you save the instinct inside the schedule constraint.',
        },
      },
    },
  },

  // ─── Q2: 3 days until Friday — what to check first (validation dimension, after seeing worker results) ───
  q2: {
    question: {
      id: 'demo-q2-3',
      text: '3 days until Friday\'s leadership meeting. What do you check first?',
      subtext: 'Which check you do first decides how much the report weighs.',
      options: [
        'Sales 1:1 — get the exact words those 3 customers used',
        'CEO calls the top 5 accounts directly — casual check-in',
        'Company T filings/press — lock down the runway estimate',
        'Finance — real margin rate + scenario simulation',
      ],
      type: 'select',
      engine_phase: 'reframe',
    },
    effects: {
      'Sales 1:1 — get the exact words those 3 customers used': {
        snapshotPatch: {
          insight: 'There can be a gap between felt panic and what was actually said. Filtering the sales team\'s "crisis" signal through exact wording is the fastest validation.',
        },
        weakestAssumption: {
          assumption: 'Is sales\'s "3 customers asked" even accurate, or colored by panic?',
          explanation: 'Sales teams are human too — they tend to dress things up as crises. Hearing the exact wording and context one more time is the safe move.',
        },
        nextThreeDays: [
          'Today — 1:1 with the sales lead. Get "exactly what those 3 said" in their own words',
          'Tomorrow — split "price shopping" vs "real churn intent." If it\'s real intent, get permission to call them directly',
          'Day before the meeting — quote the clean wording in the report. First-party data, no speculation',
        ],
        dmFirstReaction: 'Filter the sales team\'s read too. They tend to package things as crises. Exact wording matters.',
      },
      'CEO calls the top 5 accounts directly — casual check-in': {
        snapshotPatch: {
          insight: 'A CEO direct call is a strong signal. But the intent has to land right — you don\'t want it read as panic.',
        },
        weakestAssumption: {
          assumption: 'Does a CEO direct call get an honest answer, or just add pressure?',
          explanation: 'A CEO call is a double-edged sword. Even framed as a casual check-in, customers can read "are you worried about something?" into it.',
        },
        nextThreeDays: [
          'Today — pick the 5 highest-revenue accounts out of the top 20',
          'Tomorrow — 10-minute calls, light touch: "Checking in — how are you reading the market lately?"',
          'Day before the meeting — organize the responses: reassurance signals vs churn signals. Quote the key lines directly',
        ],
        dmFirstReaction: 'Direct calls are double-edged. Even framed as a check-in, customers might read "is there a problem?" Keep it to one question. Warm tone.',
      },
      'Company T filings/press — lock down the runway estimate': {
        snapshotPatch: {
          insight: 'The leadership meeting wants an answer to "how long can Company T last?" Tightening the basis of the estimate raises the credibility of the whole report.',
        },
        weakestAssumption: {
          assumption: 'Can we really know burn rate precisely from public info?',
          explanation: 'Filings and press alone can\'t give you an exact monthly burn rate. You have to flag the limit of the estimate explicitly.',
        },
        nextThreeDays: [
          'Today — pull recent filings + 6 months of press coverage',
          'Tomorrow — hiring posts + marketing spend patterns → estimate monthly burn',
          'Day before the meeting — validate the "12-18 months" hypothesis + write the word "estimated" into the report',
        ],
        dmFirstReaction: 'Company T numbers are estimates, remember. The word "estimated" needs to appear at least once in the report. Don\'t state it like it\'s confirmed — you\'ll have to answer for it later.',
      },
      'Finance — real margin rate + scenario simulation': {
        snapshotPatch: {
          insight: 'The most important number in the leadership meeting is our margin rate. Reporting with an estimated 30% gets you stuck on the CEO\'s first question.',
        },
        weakestAssumption: {
          assumption: 'Is the finance number actually current?',
          explanation: 'Unless it\'s right after quarterly close, the number could be a month old. Needs to reflect recent trends.',
        },
        nextThreeDays: [
          'Today — request "last 3 months margin rate + fixed cost structure" from finance',
          'Tomorrow — build a 4-scenario sim table (current / 15% / 20% / 30% cuts)',
          'Day before the meeting — get finance sign-off. Confirmed twice, these numbers become weapons in the room',
        ],
        dmFirstReaction: 'Finance numbers are the core of what goes to the meeting. Get them double-checked. Walk in with a wrong number and you\'ll get torn apart on the spot.',
      },
    },
  },

  // ─── Workers (default 2 — third joins via q1.effects.thirdWorker based on Q1 answer) ───
  workers: [
    {
      persona: SUJIN,
      task: 'Company T background + our 80-customer churn reality',
      completionNote: 'Real churn risk is 1 customer, 1.1% of revenue. Look at data, not the panic.',
      result: '**Looked at Company T and our 80 customers side by side.**\n\n**Why Company T cut 30% (public info):**\n- Just closed Series B ~$20M (2 months ago). Classic "burn cash for share" pattern.\n- Monthly burn estimate: payroll + marketing + discount absorption = ~$1.5-2M/month\n- **Runway: roughly 12-18 months.** After that, price normalization expected if they can\'t raise again.\n- Company T reviews (app stores/communities): "Cheap but slow response and no custom fit." Non-price satisfaction is low.\n\n**Our 80-customer churn reality (1st-pass sales data):**\n- 3 price inquiries = **3.75%** of total. Of those, real churn intent is **1 customer**; the other 2 are "price comparison shopping."\n- All 3 are **bottom 20% revenue customers** (average $450/month) → total revenue impact **1.1%**\n- **Top 20 customers haven\'t budged at all.** They\'re 60% of revenue.\n\n**Reading it:**\n- The felt panic is larger than reality. There\'s a gap between the sales team\'s "crisis" signal and the actual data.\n- But 6 months of inaction can let it spread. **"Not moving ≠ not monitoring"** — that distinction matters.\n\n*Estimate caveat: Company T\'s monthly burn rate is based on industry averages, not exact numbers. "Estimated" has to go into the report for safety.*',
    },
    {
      persona: HYUNWOO,
      task: '4 response scenarios — simulated on $100K monthly revenue',
      completionNote: 'All 4 are valid. Which one is right depends on your instinct.',
      result: '**Built 4 scenario simulations on Sophie\'s data.** On purpose, no recommendation — the right answer shifts based on instinct.\n\n| | A. Match the cut | B. Selective discount + value defense | C. Wait / endure | D. Premium repositioning |\n|---|---|---|---|---|\n| Price | Blanket cut | 15% discount only for 10 at-risk | Hold | Raise instead |\n| Churn (6 mo) | ~0% | 3-5% (bottom tier) | 10-15% | 5-10% (transition) |\n| Monthly profit change | **-75%** ($30K → $7.5K) | **-3%** (~$29K) | 0% now, -15% in 6 mo | -10% short-term, +20% long-term |\n| Lead time | Immediate | Within a week | Immediate (monitoring) | **6+ months** |\n| Core risk | Margin collapse | Discount requests spread | Top 20 left unguarded | Perception shift fails |\n\n**The essence of each scenario:**\n- **A** comes from the instinct "stopping churn is priority one."\n- **B** comes from the balanced instinct "protect price, but block the real risks."\n- **C** comes from the wait instinct "Company T will break first."\n- **D** comes from the offensive instinct "use this to move up."\n\n**Next step:** Which scenario to pick is a call on your instinct. **Whether the instinct actually holds up** gets validated by whoever joins next. Every instinct misses something.',
    },
  ],

  draft: {
    title: 'Competitor Price Cut Response Strategy',
    executive_summary: 'The competitor\'s 30% price cut is a funding-fueled land grab — unlikely to be sustained long-term. **We recommend not matching the cut and instead raising our value.** Selective discounts for at-risk customers will be applied alongside this approach.',
    sections: [
      { heading: 'Competitor Analysis', content: 'The 30% cut follows a recent funding round — it\'s a market share play. **Prices are expected to normalize once funding burns through.** This is not a market-wide decline.' },
      { heading: 'Recommended Strategy: Differentiate + Selective Discounts', content: 'Instead of a blanket price cut, we respond with **service differentiation.** A targeted 15% discount applies only to high-churn-risk customers (price-sensitive segment). This minimizes margin impact while retaining key accounts.' },
      { heading: 'Projected Impact', content: 'Accept 5-10% churn, maintain margin structure. In 6 months, when the competitor\'s prices normalize, we\'ll be in the stronger position.' },
    ],
    key_assumptions: [
      'Competitor price cut won\'t last beyond 12 months',
      '70%+ of our customers prioritize quality/service over price',
      'Selective discounts can be contained without spreading to all customers',
    ],
    next_steps: [
      'Extract at-risk customer list immediately',
      'Finalize selective discount criteria + process (this week)',
      'Design the differentiation package (next week)',
    ],
  },

  // ─── Draft V2 (condensed card — Q1 decisionLine/thirdWorker + Q2 weakestAssumption/nextThreeDays override at runtime) ───
  draftV2: {
    title: 'Company T 30% Cut — Leadership Meeting Response Strategy',
    decisionLineDefault: 'Selective discounts + value clarification. Protect margin while defending.',
    workerSummariesDefault: [
      {
        personaId: 'researcher', // SUJIN — Sophie
        headline: 'Company T background + our 80-customer reality',
        lines: [
          'Company T Series B $20M → 12-18 month runway (monthly burn $1.5-2M, estimated)',
          '3 of 80 customers (3.75%) asked, real churn intent = 1. **Top 20 haven\'t moved**',
        ],
      },
      {
        personaId: 'strategist', // HYUNWOO — Nathan
        headline: '4 scenarios compared',
        lines: [
          'Match -75% / Selective discount -3% / Wait -15% / Premium (6-month lead time)',
          'Each scenario\'s essence is "which instinct does it come from." Teammate validates the instinct',
        ],
      },
    ],
    weakestAssumptionDefault: {
      assumption: 'Are those 3 customers actually churning, or just price-shopping?',
      explanation: 'There may be a gap between sales\'s "crisis" signal and the actual words. Checking the exact wording one more time is the first move.',
    },
    nextThreeDaysDefault: [
      'Sales 1:1 — exact wording from the 3 customers',
      'Top 20 customer churn signal check',
      'Before the meeting — lock finance numbers with a sign-off',
    ],
  },

  // ─── DM Variants (Q1 answer decides DM persona, Q2 answer decides first_reaction) ───
  dmVariants: {
    ceo: {
      persona_name: 'Mr. Kim',
      persona_role: 'CEO',
      first_reaction: 'The differentiation direction is right, but "what specific value are we adding?" isn\'t concrete enough. Think from the customer\'s perspective.',
      good_parts: [
        'Competitor analysis is clear-eyed and objective',
        'The 3-scenario comparison is genuinely helpful for decision-making',
      ],
      concerns: [
        {
          text: '"Differentiation" is too abstract. What tangible value does the customer actually feel?',
          severity: 'critical',
          fix_suggestion: 'Specify 3 concrete customer-facing value adds (dedicated account manager, fast response, custom features, etc.)',
          applied: false,
        },
        {
          text: 'You said 5-10% churn — what does that mean in revenue? Show me the number.',
          severity: 'important',
          fix_suggestion: 'Quantify the churn impact by scenario (monthly revenue basis)',
          applied: false,
        },
      ],
      would_ask: [
        'What\'s the criteria for selective discounts?',
        'What if the competitor holds the price for over 6 months?',
      ],
      approval_condition: 'If the differentiation is specific and the churn impact is quantified, I\'ll greenlight execution immediately.',
    },
    meeting: {
      persona_name: 'Leadership Meeting',
      persona_role: 'Executive Team',
      first_reaction: 'We agree on the direction, but each department will have different questions. Sales wants churn data, finance wants margins, product wants the differentiation plan.',
      good_parts: [
        'The scenario comparison is objective and well-structured',
        '"No price war" direction is sound and rational',
      ],
      concerns: [
        {
          text: 'Sales needs a customer-facing script they can use immediately. They need to explain "why we cost more."',
          severity: 'critical',
          fix_suggestion: 'Add a customer response FAQ: "Why are you more expensive?" with 3 value-based answers',
          applied: false,
        },
        {
          text: 'If selective discount criteria are subjective, the field teams will be confused. We need a clear decision matrix.',
          severity: 'important',
          fix_suggestion: 'Add a discount eligibility matrix (customer size x churn risk level)',
          applied: false,
        },
      ],
      would_ask: [
        'What\'s the impact on this quarter\'s revenue target?',
        'How much does the differentiation package cost to build?',
      ],
      approval_condition: 'With a customer response script and clear discount criteria, we can approve execution this week.',
    },
  },

  // ─── Final Document (placeholders: {{decisionLine}}, {{thirdWorkerBlock}}, {{weakestAssumption}}, {{nextSteps}}) ───
  finalBase: `# Company T 30% Cut — Leadership Meeting Response Strategy

> Company T 30% cut is a short-term play funded by Series B $20M (monthly burn $1.5-2M est → ~12-18 month runway). Of our 80 customers, real churn intent is 1, revenue impact 1.1%.

## Recommended one-liner

> {{decisionLine}}

## 4 response scenarios (reference)

| Option | A. Match | B. Selective discount + value defense | C. Wait / endure | D. Premium repositioning |
|---|---|---|---|---|
| Price | Blanket cut | 15% for 10 at-risk only | Hold | Raise |
| Monthly profit | **-75%** | **-3%** | 0% → -15% | -10% short, +20% long |
| Lead time | Immediate | Within a week | Immediate | **6+ months** |
| Comes from | Defensive instinct | Balanced instinct | Wait instinct | Offensive instinct |

Every instinct misses something. A teammate validated and reinforced each one.

{{thirdWorkerBlock}}
<!-- PATCH_0 -->

## Weakest assumption (validate first)

{{weakestAssumption}}
<!-- PATCH_1 -->

## Next 3 days (before Friday's meeting)

{{nextSteps}}

## Monitoring (after the meeting)

- Monthly churn rate review — >5% triggers partial response
- Pre-book 12-month Company T reassessment on the calendar

*Estimate caveats: Company T monthly burn rate and our margin rate are both estimates. The word "estimated" must appear in the report.*`,

  finalPatches: [
    `

### Customer-Facing Value (Differentiation Specifics)

The value our customers get that justifies the premium:

1. **Dedicated account manager**: Competitor uses a call center; we give you a direct line to your person
2. **Custom configuration**: Industry-specific pre-optimization — results from week one
3. **Fast response**: Under 4 hours to respond (competitor average: 24 hours)`,
    `

### Churn Impact Quantified

| Churn Rate | Monthly Revenue Loss | Annual Impact |
|------------|---------------------|---------------|
| 5% | ~$5,000 | $60,000 |
| 10% | ~$10,000 | $120,000 |
| 15% | ~$15,000 | $180,000 |

At the estimated 5-10% churn rate, **annual impact is $60K-$120K.** The goal is to keep churn below 5% through the differentiation strategy.`,
  ],
  seal: {
    prediction: 'This week, at most 1 of the 3 "we’re leaving" accounts actually files a cancellation.',
  },
  settle: {
    verdict: 'broke',
    happened: 'Two accounts actually cancelled. I thought it was price-shopping — one was already about to sign with a competitor.',
    learning: 'I underweighted the churn signal — next time I meet top accounts while they’re still just "comparing."',
  },
};

// ─── Export ───

export const DEMO_SCENARIOS_EN: DemoScenario[] = [scenario1, scenario2, scenario3];
