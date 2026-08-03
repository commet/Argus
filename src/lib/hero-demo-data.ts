/**
 * hero-demo-data — fixtures for the landing HeroLoopDemo.
 *
 * GENERATED CONTENT — do not hand-edit the analyses. Every analysis below was
 * produced by the PRODUCTION prompts (buildInitialAnalysisPrompt +
 * buildDeepeningPrompt, model claude-sonnet-5) via scripts/generate-hero-demo.ts
 * on 2026-08-03 against the v2 judgment harness. When the production prompts
 * change meaningfully, regenerate:
 *
 *   npx tsx scripts/generate-hero-demo.ts out.json
 *
 * and rebuild this file from the output.
 *
 * THE ONLY HAND-WRITTEN PARTS are the user's own words: `sampleAnswers` (short
 * replies a person might type) and `sealExample` (a closing line). Both are
 * labeled as examples in the UI. The product's half — frame, analysis,
 * question, refined analysis — is generated, never authored.
 *
 * WHY sampleAnswers EXIST: the v2 harness stopped manufacturing multiple-choice
 * branches ("Use a short answer by default"), so `next_question` has no options
 * to walk. The demo supplies plausible replies instead, and each one has its own
 * REAL generated continuation. The UI must present them as example replies —
 * never as choices the product offered.
 *
 * WHY en/hire IS ABSENT: on both 2026-08-03 generation runs the harness answered
 * that English problem entirely in Korean (frame, insight, question, and every
 * refined snapshot). Rather than ship a locale-leaked example, the English set
 * carries two walkthroughs. Restore it once the leak is fixed.
 */

export interface HeroDemoRefined {
  insight: string;
  real_question: string;
  hidden_assumptions: string[];
  skeleton: string[];
}

export interface HeroDemoExample {
  id: string;
  problem: string;
  initial: {
    real_question: string;
    insight?: string;
    hidden_assumptions: string[];
    skeleton: string[];
    /** v2 asks a short question; it carries no options. */
    next_question: { text: string; subtext?: string };
  };
  /** Authored short replies — the user's half of the demo, shown as examples. */
  sampleAnswers: string[];
  /** Keyed by sample answer — that reply's REAL generated refined analysis. */
  refined: Record<string, HeroDemoRefined>;
  /** Illustrative user-authored closing line (labeled "예시" in the UI). */
  sealExample: string;
}

export const HERO_DEMO_EXAMPLES: Record<'ko' | 'en', HeroDemoExample[]> = {
  "ko": [
    {
      "id": "job",
      "problem": "지금 회사 3년 다녔는데 연봉 25% 올려주는 이직 제안을 받았어. 근데 지금 팀도 좋고 내년에 승진 가능성도 있어서 고민이야.",
      "initial": {
        "real_question": "팀도 좋고 승진 얘기도 있는데, 이직 쪽은 25% 인상까지 나왔네요.",
        "insight": "승진은 아직 가능성 얘기고, 이직 제안은 25%라는 숫자로 이미 와 있네요.",
        "hidden_assumptions": [],
        "skeleton": [],
        "next_question": {
          "text": "내년 승진 얘기는 누가 한 거예요? 그냥 분위기상 그런 건지, 실제로 얘기가 나온 건지 궁금해요."
        }
      },
      "sampleAnswers": [
        "팀장님이 연말 평가 때 직접 얘기해주신 거예요",
        "아직 공식적으로 들은 건 아니고 제 예상이에요"
      ],
      "refined": {
        "팀장님이 연말 평가 때 직접 얘기해주신 거예요": {
          "insight": "승진 얘기가 팀장님이 연말 평가 자리에서 직접 한 말이라는 게 나왔어요. 분위기가 아니라 실제 대화였다는 거죠.",
          "real_question": "팀장님이 연말 평가에서 직접 승진 얘기를 꺼내신 상황이고, 이직 쪽은 25% 인상 제안이 있는 상태네요.",
          "hidden_assumptions": [],
          "skeleton": []
        },
        "아직 공식적으로 들은 건 아니고 제 예상이에요": {
          "insight": "승진 얘기가 회사에서 나온 게 아니라 본인 예상이라는 게 확인됐어요.",
          "real_question": "팀도 좋고, 승진은 아직 본인 예상 단계인데, 이직 쪽은 25% 인상 제안이 실제로 나온 상황이에요.",
          "hidden_assumptions": [],
          "skeleton": []
        }
      },
      "sealExample": "일단 남는다 — 다음 분기 면담에서 승진 시점이 공식화되지 않으면 그때는 미련 없이 움직인다."
    },
    {
      "id": "hire",
      "problem": "1인 디자인 스튜디오를 하는데 일이 밀려서 첫 직원을 뽑을까 고민이야. 월급 줄 만큼 일이 계속 들어올지 확신이 없어.",
      "initial": {
        "real_question": "지금은 일이 밀려 있는데, 이게 월급 낼 만큼 계속될지는 아직 모르시는 거네요.",
        "insight": "일이 밀린 건 지금 확실한데, 그 흐름이 이어질지는 아직 안 보이시는 거고요.",
        "hidden_assumptions": [],
        "skeleton": [],
        "next_question": {
          "text": "지금 밀린 일이 일시적인 건지, 아니면 다음 달 이후로도 이미 잡힌 의뢰가 있는지 봐둔 게 있어요?"
        }
      },
      "sampleAnswers": [
        "지금 계약된 것만 4개월치 정도 밀려 있어요",
        "한 달치쯤 밀렸고 나머지는 들어올 것 같은 정도예요"
      ],
      "refined": {
        "지금 계약된 것만 4개월치 정도 밀려 있어요": {
          "insight": "일이 그냥 밀려 있다는 것에서, 계약으로 확정된 게 4개월치라는 구체적인 숫자가 나왔어요.",
          "real_question": "지금 계약된 일은 4개월치 있고, 그 이후로도 계속 들어올지는 아직 모르시는 거네요.",
          "hidden_assumptions": [],
          "skeleton": []
        },
        "한 달치쯤 밀렸고 나머지는 들어올 것 같은 정도예요": {
          "insight": "확정된 일감은 한 달 치이고, 그 다음은 '들어올 것 같다'는 감 정도라는 게 나왔어요. 밀린 일 자체는 유한하고, 그 이후는 아직 근거가 없는 상태네요.",
          "real_question": "확정된 일은 한 달치뿐이고 그 다음은 감으로만 예상되는 상태에서, 월급 낼 직원을 뽑을지 고민 중이시네요.",
          "hidden_assumptions": [],
          "skeleton": []
        }
      },
      "sealExample": "정규직 채용은 보류하고 다음 두 프로젝트를 외주로 돌려본다 — 외주비가 월급의 70%를 넘으면 그때 뽑는다."
    },
    {
      "id": "home",
      "problem": "전세 만기가 다가오는데 집주인이 보증금을 올려달래. 더 올려주고 계속 살지, 대출을 더 받아서 집을 살지 고민이야.",
      "initial": {
        "real_question": "보증금 더 올려주고 계속 살지, 대출 늘려서 아예 살지 갈리시는 거네요.",
        "insight": "보증금 더 올려주고 계속 살지, 대출 늘려서 아예 살지 갈리시는 거네요.",
        "hidden_assumptions": [],
        "skeleton": [],
        "next_question": {
          "text": "보증금은 얼마나 올려달라는 거고, 집을 사면 대출은 얼마나 더 받아야 하는 거예요?"
        }
      },
      "sampleAnswers": [
        "보증금은 5천 더 달라고 하고, 사려면 2억쯤 대출이 더 필요해요",
        "보증금 인상분은 감당되는데 매수는 계산을 아직 안 해봤어요"
      ],
      "refined": {
        "보증금은 5천 더 달라고 하고, 사려면 2억쯤 대출이 더 필요해요": {
          "insight": "보증금 5천이랑 매수 시 대출 2억, 이 격차가 꽤 크게 나왔네요. 두 선택의 부담 규모가 얼마나 다른지 숫자로 보이는 거고요.",
          "real_question": "보증금 5천 올려주고 계속 살지, 대출 2억 더 받아서 집을 살지 갈리시는 거네요.",
          "hidden_assumptions": [],
          "skeleton": []
        },
        "보증금 인상분은 감당되는데 매수는 계산을 아직 안 해봤어요": {
          "insight": "보증금 올리는 쪽은 감당 가능하다는 게 확인됐고, 매수 쪽은 대출 계산을 아직 안 해보셨네요.",
          "real_question": "보증금 인상은 감당되는 상태에서, 매수 쪽 대출 계산을 안 해본 채로 두 선택을 놓고 고민 중이신 거네요.",
          "hidden_assumptions": [],
          "skeleton": []
        }
      },
      "sealExample": "이번엔 전세를 연장한다 — 6개월 안에 대출 한도와 실거래가를 확인하고 내년 봄에 다시 판단한다."
    }
  ],
  "en": [
    {
      "id": "job",
      "problem": "I got a job offer with a 25% raise, but I like my current team and I'm up for promotion next year. Should I take it?",
      "initial": {
        "real_question": "A 25% raise offer is in hand, while the promotion where you are is still next year, not yet happened.",
        "insight": "You've named two things pulling in different directions: a raise you can take now, and a promotion you're expecting later.",
        "hidden_assumptions": [],
        "skeleton": [],
        "next_question": {
          "text": "How firm is next year's promotion — has it been discussed with your manager, or is it your own expectation so far?"
        }
      },
      "sampleAnswers": [
        "My manager brought it up directly in my year-end review",
        "It hasn't been confirmed — it's what I'm expecting"
      ],
      "refined": {
        "My manager brought it up directly in my year-end review": {
          "insight": "The prior question asked how firm the promotion was — self-expectation or discussed. You answered with a fact: your manager raised it directly in your year-end review, not something you inferred on your own.",
          "real_question": "A 25% raise offer is in hand, while the promotion where you are was raised directly by your manager in your year-end review, but it still hasn't happened yet.",
          "hidden_assumptions": [],
          "skeleton": []
        },
        "It hasn't been confirmed — it's what I'm expecting": {
          "insight": "You've clarified that next year's promotion hasn't been discussed with your manager or confirmed in any way — it's your own expectation.",
          "real_question": "You have a firm 25% raise offer in hand, while your promotion next year is still your own expectation, not something confirmed with your manager.",
          "hidden_assumptions": [],
          "skeleton": []
        }
      },
      "sealExample": "I'll stay for now — if the promotion isn't formalized by March, I start looking again."
    },
    {
      "id": "home",
      "problem": "My lease is ending and the landlord is raising the rent. Do I renew at the higher price, or stretch my budget and buy a place?",
      "initial": {
        "real_question": "Rent is going up, and buying would stretch the budget instead.",
        "insight": "You've named two options — renew at a higher rent, or stretch to buy — but not yet what 'stretch' would mean month to month.",
        "hidden_assumptions": [],
        "skeleton": [],
        "next_question": {
          "text": "When you say 'stretch your budget' for buying, what would that actually change month-to-month compared to the new rent?"
        }
      },
      "sampleAnswers": [
        "Rent goes up about 15%, and buying would run roughly 30% more per month",
        "I know the new rent, but I haven't priced out what buying would cost"
      ],
      "refined": {
        "Rent goes up about 15%, and buying would run roughly 30% more per month": {
          "insight": "You quantified the comparison: rent is going up about 15%, and buying would run roughly 30% more per month than that new rent.",
          "real_question": "Rent is rising ~15%, and buying would cost roughly 30% more per month — the choice is between the higher rent and that larger monthly stretch.",
          "hidden_assumptions": [],
          "skeleton": []
        },
        "I know the new rent, but I haven't priced out what buying would cost": {
          "insight": "The comparison this decision depends on doesn't exist yet — you know the new rent number but haven't priced out what buying would actually cost month-to-month.",
          "real_question": "Rent is going up to a known number, and buying is still an unpriced option — so renew at the higher price, or find out what buying would actually cost before deciding.",
          "hidden_assumptions": [],
          "skeleton": []
        }
      },
      "sealExample": "We renew this year — and I get pre-qualified within six months so next year's call is made with real numbers."
    }
  ]
};
