/**
 * hero-demo-data — fixtures for the landing HeroLoopDemo.
 *
 * GENERATED CONTENT — do not hand-edit the analyses. Every analysis below was
 * produced by the PRODUCTION prompts (buildInitialAnalysisPrompt +
 * buildDeepeningPrompt, model claude-sonnet-5) via scripts/generate-hero-demo.ts
 * on 2026-07-31, then curated (trimmed, seal examples authored by hand).
 * When the production prompts change meaningfully, regenerate:
 *
 *   npx tsx scripts/generate-hero-demo.ts out.json
 *
 * and rebuild this file from the output. The seal lines are illustrative
 * user-authored examples (labeled as examples in the UI) — they are the only
 * hand-written part.
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
    next_question: { text: string; subtext?: string; options: string[] };
  };
  /** Keyed by option text — each option's REAL post-answer refined analysis. */
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
        "real_question": "내년 승진 가능성이 실제로 매니저에게 확인된 구체적인 경로인지, 아니면 아직 본인의 기대치에 가까운지가 이 결정의 출발점 아닐까요?",
        "insight": "이직 여부보다, 내년 승진이 시점과 폭까지 어느 정도 확정된 경로인지 먼저 확인해야 해요. 승진이 막연한 기대치에 가깝다면 25%라는 손에 잡히는 숫자와 비교 자체가 성립하지 않거든요.",
        "hidden_assumptions": [
          "'승진 가능성이 있다'는 게 매니저가 명시적으로 언급한 건지, 아니면 팀 분위기상 본인이 기대하는 수준인지가 다를 수 있어요",
          "이직 제안의 25%가 기본급 인상인지 사이닝보너스·스톡 등이 섞인 총보상 인상인지에 따라 실제 체감 차이가 커요",
          "'지금 팀이 좋다'는 현재 상태가 승진 후에도 같은 팀·같은 리더로 유지된다는 보장은 아닐 수 있어요"
        ],
        "skeleton": [
          "먼저 — 승진 관련해서 매니저와 나눈 대화를 되짚어보세요. '내년에 가능성 있다'가 실제 문장이었는지, 본인의 해석이었는지부터 구분해야 이후 비교가 의미 있어져요",
          "그다음 — 승진 시 예상되는 인상률과 역할 변화를 대략이라도 가늠해보세요. 이직 제안 25%와 나란히 놓고 봐야 진짜 비교가 돼요",
          "그리고 — 이직 제안한 회사의 팀 분위기나 실제 업무 강도를 아는 사람을 통해 한 번 더 확인하세요. 3년차에 팀이 좋다는 게 지금 얼마나 큰 가치인지 가늠하는 기준이 돼요",
          "여기서 중요한 건 — 이직 제안의 회신 기한과 회사 내부 승진 발표 시점이 겹치는지 캘린더에 표시하는 거예요. 둘 중 하나라도 먼저 확정되면 나머지 고민이 자연히 정리돼요",
          "마지막으로 — 두 시나리오(이직 vs 잔류+승진 대기)를 각각 1년 후 관점에서 짧게 적어보세요. 숫자보다 어느 쪽이 후회를 덜 남길지가 더 잘 보여요"
        ],
        "next_question": {
          "text": "승진했을 때 예상되는 인상률이나 역할 변화가 대략 어느 정도인지 감이 있나요?",
          "subtext": "이 답에 따라 이 결정은 '돈 vs 안정'이 아니라 '비슷한 조건 중 어디가 더 나은지'로 완전히 바뀌어요",
          "options": [
            "승진하면 인상률/역할이 이직 제안(25%)과 비슷하거나 더 클 것 같다",
            "승진해도 인상률은 25%에 확실히 못 미칠 것 같다",
            "승진 자체가 아직 확정 안 된 막연한 이야기다",
            "전혀 감이 없다, 추측만 하고 있다"
          ]
        }
      },
      "refined": {
        "승진하면 인상률/역할이 이직 제안(25%)과 비슷하거나 더 클 것 같다": {
          "insight": "인상률과 역할 변화가 이직 제안과 비슷하거나 더 크다면, 이제 이 결정에서 '돈'은 더 이상 저울을 기울이는 요인이 아니에요. 그렇다면 남은 저울추는 순수하게 '승진이 실제로 얼마나 확실한가'로 좁혀져요.",
          "real_question": "보상 차이가 크지 않다면, 승진이 매니저에게 확인된 확정에 가까운 건지 아니면 아직 본인의 기대인지가 이 결정을 가르는 지점 아닐까요?",
          "hidden_assumptions": [
            "'승진 가능성이 있다'는 게 매니저의 명시적 언급인지, 팀 분위기상 본인의 기대인지에 따라 리스크 크기가 완전히 달라져요",
            "승진이 예상보다 늦어지거나 무산될 경우, 지금 받은 이직 제안이 그때도 유효할지는 알 수 없어요",
            "'지금 팀이 좋다'는 현재 상태가 승진 후에도 같은 팀·같은 리더로 유지된다는 보장은 아닐 수 있어요"
          ],
          "skeleton": [
            "먼저 — 승진 관련해서 매니저와 나눈 대화를 되짚어보세요. '내년에 가능성 있다'가 실제 문장이었는지, 본인의 해석이었는지부터 구분하는 게 이제 가장 중요한 변수예요",
            "그다음 — 인상률 차이가 크지 않다는 걸 확인했으니, 승진 발표나 심사 시점이 정확히 언제인지 확인하세요. 이 시점이 이직 제안 회신 기한보다 먼저인지 나중인지가 결정을 좌우해요",
            "그리고 — 이직 제안한 회사의 팀 분위기나 실제 업무 강도를 아는 사람을 통해 한 번 더 확인하세요. 보상이 비슷하다면 이 부분이 실질적인 차별점이 될 수 있어요",
            "여기서 중요한 건 — 이직 제안의 회신 기한과 회사 내부 승진 발표 시점이 겹치는지 캘린더에 표시하는 거예요. 둘 중 하나라도 먼저 확정되면 나머지 고민이 자연히 정리돼요",
            "마지막으로 — 두 시나리오(이직 vs 잔류+승진 대기)를 각각 1년 후 관점에서 짧게 적어보세요. 보상이 비슷해진 지금은 숫자보다 어느 쪽이 후회를 덜 남길지가 더 잘 보여요"
          ]
        },
        "승진해도 인상률은 25%에 확실히 못 미칠 것 같다": {
          "insight": "승진해도 25%엔 못 미친다는 답으로 금전적 비교는 사실상 끝났어요. 이제 이 결정은 숫자가 아니라 승진이 주는 비금전적인 것들 — 역할, 타이틀, 커리어 경로, 팀 안정성 — 이 그 차이를 메울 만큼 본인에게 큰지에 달려있어요.",
          "real_question": "금전적으로는 이직 쪽이 확실히 우위라는 게 확인됐으니, 승진이 주는 연봉 외의 가치(역할 확장, 타이틀, 커리어 경로)가 그 25% 차이를 상쇄할 만큼 큰지가 이제 진짜 질문 아닐까요?",
          "hidden_assumptions": [
            "승진해도 인상률이 25%보다 낮다는 건 확인됐으니, 남는 건 '승진' 자체가 연봉 외에 주는 게 뭔지 — 역할 확장인지, 타이틀인지, 아니면 그냥 심리적 안정감인지가 다를 수 있어요",
            "이직 제안 25%가 기본급 인상인지 사이닝보너스·스톡 등이 섞인 총보상 인상인지에 따라 실제 체감 차이가 달라질 수 있어요",
            "'지금 팀이 좋다'는 게 승진 이후에도 같은 팀·같은 리더 구성으로 유지된다는 보장은 아닐 수 있어요"
          ],
          "skeleton": [
            "먼저 — 승진 관련해서 매니저와 나눈 대화를 되짚어보세요. '내년에 가능성 있다'가 실제 문장이었는지, 본인의 해석이었는지부터 구분해야 이후 비교가 의미 있어져요",
            "그다음 — 인상률 비교는 정리됐으니, 승진이 연봉 말고 실제로 뭘 주는지 구체화해보세요. 역할이 커지는지, 타이틀이 바뀌는지, 아니면 향후 이직 시 몸값에 영향을 주는지가 다 다른 무게예요",
            "그리고 — 이직 제안한 회사의 팀 분위기나 실제 업무 강도를 아는 사람을 통해 한 번 더 확인하세요. 3년차에 팀이 좋다는 게 지금 얼마나 큰 가치인지 가늠하는 기준이 돼요",
            "여기서 중요한 건 — 이직 제안의 회신 기한과 회사 내부 승진 발표 시점이 겹치는지 캘린더에 표시하는 거예요. 둘 중 하나라도 먼저 확정되면 나머지 고민이 자연히 정리돼요",
            "마지막으로 — 두 시나리오(이직 vs 잔류+승진 대기)를 각각 1년 후 관점에서 짧게 적어보세요. 숫자보다 어느 쪽이 후회를 덜 남길지가 더 잘 보여요"
          ]
        },
        "승진 자체가 아직 확정 안 된 막연한 이야기다": {
          "insight": "승진이 아직 확정되지 않은 막연한 이야기라는 게 분명해졌으니, 이제 비교 축은 '확정된 25% 인상' 대 '불확실한 미래 가능성'으로 더 선명해졌어요. 그 말은 승진 인상률을 가늠하는 건 의미가 없어지고, 대신 이 불확실성을 얼마나 감내할 수 있는지가 핵심이 됐다는 뜻이에요.",
          "real_question": "확정된 25% 인상 제안과, 아직 매니저 언급조차 없는 막연한 승진 가능성 사이에서 그 불확실성을 얼마나 감내할 수 있는지가 이 결정의 출발점 아닐까요?",
          "hidden_assumptions": [
            "'승진 가능성'은 매니저의 명시적 언급이 아니라 본인의 기대치에 가깝다는 게 이번에 확인됐어요",
            "이직 제안의 25%가 기본급 인상인지 총보상 인상인지에 따라 실제 체감 차이가 커요",
            "'지금 팀이 좋다'는 게 승진과 무관하게 그 자체로 남을 이유인지, 아니면 승진 기대와 얽혀있는 건지가 아직 구분되지 않았어요"
          ],
          "skeleton": [
            "먼저 — 승진이 아직 확정되지 않았다는 전제 위에서, 언제쯤 구체화될지(다음 리뷰나 연말 평가 시점 등) 매니저에게 직접 물어볼 여지가 있는지 생각해보세요",
            "그다음 — 인상률을 가늠하는 대신, 이 막연한 가능성을 1년 더 기다렸는데 실현 안 됐을 때의 기회비용을 짧게 적어보세요",
            "그리고 — 이직 제안한 회사의 팀 분위기나 업무 강도를 아는 사람을 통해 한 번 더 확인하세요. 3년차에 팀이 좋다는 게 지금 얼마나 큰 가치인지 가늠하는 기준이 돼요",
            "여기서 중요한 건 — 이직 제안 회신 기한 안에 승진 관련 구체적 신호(넥스트 리뷰 언급 등)가 나올 가능성이 있는지 캘린더에 표시하는 거예요",
            "마지막으로 — 두 시나리오(이직 vs 잔류+불확실한 승진 대기)를 각각 1년 후 관점에서 짧게 적어보세요. 숫자보다 어느 쪽이 후회를 덜 남길지가 더 잘 보여요"
          ]
        },
        "전혀 감이 없다, 추측만 하고 있다": {
          "insight": "승진 시 인상률이나 역할 변화에 대해 '전혀 감이 없다'는 건, 지금 승진 가능성이 매니저와 구체적으로 확인된 경로라기보다 아직 본인의 기대와 추측에 가깝다는 뜻이에요. 비교 대상 하나가 숫자가 아니라 안개인 상태라, 이직 제안의 확실한 25%와 나란히 놓고 저울질하기 어려운 게 지금 고민의 실체예요.",
          "real_question": "이직 제안의 회신 기한 안에 매니저와 승진 조건(시기·인상률·역할)을 확인할 시간적 여유가 있는지가 이제 관건 아닐까요?",
          "hidden_assumptions": [
            "'승진 가능성이 있다'는 게 매니저의 명시적 언급이 아니라 본인의 추측에 가깝다는 게 이번 답으로 드러났어요",
            "이직 제안의 25%가 기본급 인상인지 총보상 인상인지에 따라 실제 체감 차이가 커요",
            "'지금 팀이 좋다'는 현재 상태가 승진 후에도 유지된다는 보장은 아닐 수 있어요"
          ],
          "skeleton": [
            "먼저 — 승진 관련해서 매니저와 나눈 대화를 되짚어보세요. '내년에 가능성 있다'가 실제 문장이었는지, 본인의 해석이었는지부터 구분해야 이후 비교가 의미 있어져요",
            "그다음 — 추측만으로는 비교가 안 되니까, 매니저에게 승진 시기·인상률·역할 변화를 직접 물어볼 수 있는지 확인하세요. 이게 가능하냐 아니냐에 따라 이후 전략이 완전히 갈려요",
            "그리고 — 이직 제안한 회사의 팀 분위기나 실제 업무 강도를 아는 사람을 통해 한 번 더 확인하세요. 3년차에 팀이 좋다는 게 지금 얼마나 큰 가치인지 가늠하는 기준이 돼요",
            "여기서 중요한 건 — 이직 제안의 회신 기한을 먼저 캘린더에 표시하고, 그 안에 매니저와 대화할 시간이 실제로 있는지 따져보는 거예요",
            "마지막으로 — 두 시나리오(이직 vs 잔류+승진 대기)를 각각 1년 후 관점에서 짧게 적어보세요. 숫자보다 어느 쪽이 후회를 덜 남길지가 더 잘 보여요"
          ]
        }
      },
      "sealExample": "일단 남는다 — 다음 분기 면담에서 승진 시점이 공식화되지 않으면 그때는 미련 없이 움직인다."
    },
    {
      "id": "hire",
      "problem": "1인 디자인 스튜디오를 하는데 일이 밀려서 첫 직원을 뽑을까 고민이야. 월급 줄 만큼 일이 계속 들어올지 확신이 없어.",
      "initial": {
        "real_question": "지금 밀려드는 일이 앞으로도 반복될 수요인지, 아니면 최근 몇 달의 일시적 쏠림인지 어떻게 구분할 수 있을까요?",
        "insight": "채용 여부보다, 지금 밀려드는 일감이 반복 가능한 수요인지 일시적 쏠림인지를 먼저 가려야 해요. 정규직 채용의 진짜 위험은 사람을 뽑는 것 자체가 아니라, 특정 시기의 물량을 영구적 고정비로 착각하는 데 있어요.",
        "hidden_assumptions": [
          "지금의 일감 증가가 앞으로도 같은 속도로 이어질 거라고 가정하고 있을 수 있어요 — 특정 프로젝트나 시즌성 때문일 수도 있어요",
          "정규직 채용이 유일한 해법이라고 가정하고 있을 수 있어요 — 프리랜서 외주나 파트타임으로 먼저 검증하는 길도 있어요",
          "월급만 계산하고 있을 수 있는데, 4대보험·퇴직금 등 부가 비용까지 더하면 실제 고정비는 월급보다 꽤 커질 수 있어요"
        ],
        "skeleton": [
          "먼저 — 최근 3~6개월 동안 들어온 일이 특정 고객사 한두 곳에 몰린 건지, 여러 곳에서 골고루 늘어난 건지 매출 내역을 직접 펼쳐서 확인하세요. 이게 반복 수요인지 일시적 쏠림인지 가르는 첫 신호예요",
          "그다음 — 지금 밀려있는 일 중 일부를 프리랜서나 외주로 먼저 처리해보고, 그 비용이 정규직 월급보다 얼마나 차이 나는지 실제 숫자로 비교하세요",
          "여기서 중요한 건 — 앞으로 3~6개월치 월급을 커버할 만한 확정된 계약이나 파이프라인이 실제로 있는지 확인하는 거예요. '일이 밀린다'는 체감과 '확정된 물량'은 다를 수 있어요",
          "그리고 — 바로 정규직이 아니라 파트타임이나 3개월 계약직으로 먼저 테스트해볼 수 있는지 검토하세요. 1인 스튜디오 입장에선 되돌리기 쉬운 형태로 먼저 확인하는 게 리스크가 적어요",
          "마지막으로 — 채용을 하더라도 수습기간과 계약 조건을 미리 정해서, 예상만큼 일이 안 들어올 경우 어떻게 정리할지 시작 전에 합의해두세요"
        ],
        "next_question": {
          "text": "지금 밀려있는 일이 특정 고객사 한두 곳에 집중돼 있나요, 아니면 여러 곳에서 골고루 들어오고 있나요?",
          "subtext": "이 답에 따라 '한 고객 잃으면 끝나는 리스크'인지 '진짜 시장 수요 증가'인지가 갈려요",
          "options": [
            "특정 고객사 1~2곳에 집중돼 있어요",
            "여러 고객사에서 골고루 늘었어요",
            "신규 문의가 눈에 띄게 늘었어요",
            "아직 제대로 살펴본 적 없어요"
          ]
        }
      },
      "refined": {
        "특정 고객사 1~2곳에 집중돼 있어요": {
          "insight": "일감이 특정 고객사 1~2곳에 몰려 있다는 건 반복 수요처럼 보이던 게 사실 소수 거래처 의존 구조일 수 있다는 뜻이에요. 이제 관건은 '일이 많다'가 아니라 '그 한두 곳과의 관계가 얼마나 오래, 얼마나 확실하게 이어지느냐'예요.",
          "real_question": "지금 집중된 1~2개 고객사와의 관계가 앞으로도 안정적으로 이어질 수 있는 구조인지 어떻게 확인할 수 있을까요?",
          "hidden_assumptions": [
            "그 1~2곳이 앞으로도 계속 일을 줄 거라고 가정하고 있을 수 있어요 — 실제로는 정식 계약 없이 프로젝트 단위로 들어오는 걸 수도 있어요",
            "정규직 채용이 유일한 해법이라고 가정하고 있을 수 있어요 — 이 고객사들 물량만 기준으로는 프리랜서 활용으로도 충분히 커버될 수 있어요",
            "월급만 계산하고 있을 수 있는데, 4대보험·퇴직금 등 부가 비용까지 더하면 실제 고정비는 월급보다 꽤 커질 수 있어요"
          ],
          "skeleton": [
            "먼저 — 그 1~2곳 고객사와의 계약 형태를 확인하세요. 리테이너나 장기 계약인지, 매번 새로 협의하는 프로젝트 단위인지에 따라 위험도가 완전히 달라져요",
            "그다음 — 그 고객사들이 왜 최근에 일을 늘렸는지 물어보거나 짐작해보세요. 특정 프로젝트 확장 때문이면 그 프로젝트가 끝나는 시점이 곧 위험 신호예요",
            "그리고 — 지금 밀려있는 일 중 일부를 프리랜서나 외주로 먼저 처리해보고, 그 비용이 정규직 월급보다 얼마나 차이 나는지 실제 숫자로 비교하세요",
            "이어서 — 이 1~2곳 중 한 곳이라도 빠졌을 때 남은 물량만으로 월급을 감당할 수 있는지 계산해보세요. 고객사 집중도가 높을수록 이 숫자가 결정적이에요",
            "마지막으로 — 채용을 하더라도 수습기간과 계약 조건을 미리 정해서, 이 고객사향 물량이 줄었을 때 어떻게 정리할지 시작 전에 합의해두세요"
          ]
        },
        "여러 고객사에서 골고루 늘었어요": {
          "insight": "여러 고객사에서 골고루 늘었다는 건 특정 프로젝트 하나에 기대던 리스크는 낮다는 뜻이라, '일시적 쏠림'일 가능성은 줄어든 셈이에요. 다만 이게 반복 가능한 수요인지는 아직 확정된 게 아니라, 그 여러 고객사가 원래 거래하던 곳인지 새로 들어온 곳인지가 다음 갈림길이에요.",
          "real_question": "여러 고객사에서 늘어난 이 일감이 기존 고객의 재주문 증가 때문인지, 신규 고객 유입 때문인지에 따라 이게 앞으로도 이어질 수요인지 판단이 달라지지 않을까요?",
          "hidden_assumptions": [
            "여러 곳에서 골고루 늘었으니 안정적인 수요라고 단정하고 있을 수 있는데, 신규 고객 유입이라면 한때의 유행이나 소개 효과일 수도 있어요",
            "정규직 채용이 유일한 해법이라고 가정하고 있을 수 있어요 — 프리랜서 외주나 파트타임으로 먼저 검증하는 길도 있어요",
            "월급만 계산하고 있을 수 있는데, 4대보험·퇴직금 등 부가 비용까지 더하면 실제 고정비는 월급보다 꽤 커질 수 있어요"
          ],
          "skeleton": [
            "먼저 — 늘어난 일감이 원래 거래하던 고객들의 재주문인지, 새로 유입된 고객인지 최근 계약 목록에서 구분해보세요. 재주문 비중이 높으면 반복 수요 신호가 더 강해요",
            "그다음 — 지금 밀려있는 일 중 일부를 프리랜서나 외주로 먼저 처리해보고, 그 비용이 정규직 월급보다 얼마나 차이 나는지 실제 숫자로 비교하세요",
            "여기서 중요한 건 — 앞으로 3~6개월치 월급을 커버할 만한 확정된 계약이나 파이프라인이 실제로 있는지 확인하는 거예요. '일이 밀린다'는 체감과 '확정된 물량'은 다를 수 있어요",
            "그리고 — 바로 정규직이 아니라 파트타임이나 3개월 계약직으로 먼저 테스트해볼 수 있는지 검토하세요. 되돌리기 쉬운 형태로 먼저 확인하는 게 리스크가 적어요",
            "마지막으로 — 채용을 하더라도 수습기간과 계약 조건을 미리 정해서, 예상만큼 일이 안 들어올 경우 어떻게 정리할지 시작 전에 합의해두세요"
          ]
        },
        "신규 문의가 눈에 띄게 늘었어요": {
          "insight": "신규 문의가 늘었다는 건 기존 고객의 재주문이 아니라 새로운 유입이 늘었다는 뜻이라, 반복 수요 여부를 고객 충성도가 아니라 문의가 어디서 왜 늘었는지로 따져봐야 하는 쪽으로 넘어갔어요. 소개로 늘었는지 마케팅 때문인지 우연인지에 따라 앞으로도 이어질지가 완전히 달라지거든요.",
          "real_question": "지금 늘어난 신규 문의가 어디서 왜 발생하고 있고, 그중 실제 계약으로 이어지는 비율은 얼마나 되나요?",
          "hidden_assumptions": [
            "신규 문의가 늘었다는 걸 곧 일감이 확정됐다는 뜻으로 여기고 있을 수 있어요 — 문의와 실제 계약은 전환율이 다를 수 있어요",
            "지금의 문의 유입 경로가 계속 재현될 거라 가정하고 있을 수 있어요 — 소개인지 마케팅인지 일시적 노출인지에 따라 다시 안 늘어날 수도 있어요",
            "정규직 채용이 유일한 해법이라고 가정하고 있을 수 있어요 — 프리랜서 외주나 파트타임으로 먼저 검증하는 길도 있어요"
          ],
          "skeleton": [
            "먼저 — 최근 늘어난 신규 문의가 어디서 들어왔는지(지인 소개, SNS, 검색, 기존 고객 추천 등) 하나씩 짚어보고, 그중 실제로 계약까지 이어진 비율을 확인하세요",
            "그다음 — 지금 밀려있는 일 중 일부를 프리랜서나 외주로 먼저 처리해보고, 그 비용이 정규직 월급보다 얼마나 차이 나는지 실제 숫자로 비교하세요",
            "여기서 중요한 건 — 앞으로 3~6개월치 월급을 커버할 만한 확정된 계약이나 파이프라인이 실제로 있는지 확인하는 거예요. '문의가 늘었다'는 체감과 '확정된 물량'은 다를 수 있어요",
            "그리고 — 바로 정규직이 아니라 파트타임이나 3개월 계약직으로 먼저 테스트해볼 수 있는지 검토하세요. 되돌리기 쉬운 형태로 먼저 확인하는 게 리스크가 적어요",
            "마지막으로 — 채용을 하더라도 수습기간과 계약 조건을 미리 정해서, 예상만큼 일이 안 들어올 경우 어떻게 정리할지 시작 전에 합의해두세요"
          ]
        },
        "아직 제대로 살펴본 적 없어요": {
          "insight": "아직 매출 내역을 들여다본 적이 없다는 건, 지금까지의 '일이 밀린다'는 판단이 감으로만 내려지고 있었다는 뜻이에요. 채용 여부를 정하기 전에 이 확인 자체가 먼저 해결돼야 할 부분이라, 계획의 첫 단계가 그대로 가장 급한 일이 됐어요.",
          "real_question": "최근 일감이 특정 고객사에 몰린 건지 여러 곳에서 늘어난 건지 아직 안 살펴보셨는데, 이걸 확인하기 전까지는 무엇을 기준으로 채용 시점을 판단할 수 있을까요?",
          "hidden_assumptions": [
            "일감 증가 패턴을 아직 확인 안 해봤다는 건, 지금 채용 고민이 실제 데이터보다는 체감('일이 계속 밀린다')에서 출발했을 가능성이 커요",
            "정규직 채용이 유일한 해법이라고 가정하고 있을 수 있어요 — 프리랜서 외주나 파트타임으로 먼저 검증하는 길도 있어요",
            "월급만 계산하고 있을 수 있는데, 4대보험·퇴직금 등 부가 비용까지 더하면 실제 고정비는 월급보다 꽤 커질 수 있어요"
          ],
          "skeleton": [
            "먼저 — 최근 3~6개월 매출 내역을 직접 펼쳐서, 일이 특정 고객사 한두 곳에 몰렸는지 여러 곳에서 골고루 늘었는지 이번 주 안에 확인하세요. 아직 안 보셨다면 이게 다른 무엇보다 먼저예요",
            "그다음 — 지금 밀려있는 일 중 일부를 프리랜서나 외주로 먼저 처리해보고, 그 비용이 정규직 월급보다 얼마나 차이 나는지 실제 숫자로 비교하세요",
            "여기서 중요한 건 — 앞으로 3~6개월치 월급을 커버할 만한 확정된 계약이나 파이프라인이 실제로 있는지 확인하는 거예요. '일이 밀린다'는 체감과 '확정된 물량'은 다를 수 있어요",
            "그리고 — 바로 정규직이 아니라 파트타임이나 3개월 계약직으로 먼저 테스트해볼 수 있는지 검토하세요. 1인 스튜디오 입장에선 되돌리기 쉬운 형태로 먼저 확인하는 게 리스크가 적어요",
            "마지막으로 — 채용을 하더라도 수습기간과 계약 조건을 미리 정해서, 예상만큼 일이 안 들어올 경우 어떻게 정리할지 시작 전에 합의해두세요"
          ]
        }
      },
      "sealExample": "정규직 채용은 보류하고 다음 두 프로젝트를 외주로 돌려본다 — 외주비가 월급의 70%를 넘으면 그때 뽑는다."
    },
    {
      "id": "home",
      "problem": "전세 만기가 다가오는데 집주인이 보증금을 올려달래. 더 올려주고 계속 살지, 대출을 더 받아서 집을 살지 고민이야.",
      "initial": {
        "real_question": "전세금 인상분과 대출을 받아 집을 살 때의 월 상환 부담을 실제 숫자로 비교했을 때, 어느 쪽이 지금 형편에서 감당 가능한가요?",
        "insight": "전세로 남을지 매수할지 정하기 전에, 실제 대출 한도가 원하는 매매가를 감당하는지와 지금 이 집을 살 건지 다른 집을 볼 건지부터 확정해야 해요. 이 두 가지가 안 정해진 상태에서는 인상액 협상도 매수 계획도 숫자 없는 감정적 결정이 되기 쉬워요.",
        "hidden_assumptions": [
          "'대출을 더 받으면 살 수 있다'고 가정하지만, 실제 DSR·LTV 기준 대출 한도가 원하는 매매가를 감당하는지는 아직 확인 안 됐을 수 있어요",
          "집주인이 부른 인상액이 실제 시세 상승분과 같다고 가정하고 있을 수 있어요 — 협상 여지가 있을 수도 있어요",
          "'대출로 집을 산다'는 게 지금 살고 있는 전셋집을 사는 건지, 다른 집을 알아보는 건지가 아직 정해지지 않았을 수 있어요"
        ],
        "skeleton": [
          "먼저 — 국토부 실거래가 공개시스템(molit.go.kr)에서 이 집 또는 주변 단지의 최근 전세 실거래가를 확인해서, 집주인이 부른 인상액이 시세 대비 합리적인지부터 확인하세요.",
          "그다음 — 은행 앱이나 대출 상담으로 본인 소득 기준 실제 DSR 한도와 대출 가능 금액을 계산해서, '대출로 산다'가 숫자로 실현 가능한 선택지인지부터 확정하세요."
        ],
        "next_question": {
          "text": "대출 더 받아서 사려는 집이 지금 살고 있는 이 전셋집인가요, 아니면 다른 집인가요?",
          "subtext": "이 답에 따라 협상 전략(집주인과의 매수 협상)과 대출·매물 탐색 계획이 완전히 달라져요",
          "options": [
            "지금 살고 있는 전셋집을 사는 것",
            "다른 지역이나 다른 집을 알아보는 것",
            "아직 정하지 않았고 둘 다 열어둔 상태"
          ]
        }
      },
      "refined": {
        "지금 살고 있는 전셋집을 사는 것": {
          "insight": "지금 살고 있는 집을 사는 거라면, 고민의 축이 '어느 집을 살까'에서 '이 집을 실제로 살 수 있는가'로 좁혀져요. 집주인이 팔 의향이 있는지, 판다면 얼마에 팔 생각인지가 정해져야 대출 비교 자체가 의미 있는 계산이 돼요.",
          "real_question": "지금 이 집을 실제로 매수할 수 있는 상황인지(집주인 매도 의향과 희망 매매가), 그리고 그 가격을 대출로 감당했을 때의 월 상환액이 전세금 인상분보다 나은가요?",
          "hidden_assumptions": [
            "집주인이 실제로 이 집을 팔 의향이 있는지, 판다면 얼마에 팔 생각인지가 아직 확인 안 됐을 수 있어요",
            "DSR·LTV 기준 실제 대출 한도가 이 집 매매가를 감당하는지는 아직 계산 안 됐을 수 있어요",
            "집주인이 부른 전세 인상액이 이 집 주변 시세 상승분과 같다는 보장은 없어요 — 협상 여지가 있을 수도 있어요"
          ],
          "skeleton": [
            "먼저 집주인에게 이 집을 팔 의향이 있는지, 판다면 얼마에 팔 생각인지부터 확인하세요 — 이게 없으면 이후 계산이 다 무의미해요.",
            "그다음 국토부 실거래가 공개시스템에서 이 집 주변 매매 시세를 확인해서, 집주인이 부를 가격이 합리적인지 가늠하세요.",
            "그리고 은행 상담으로 본인 소득 기준 DSR 한도와 실제 대출 가능액을 계산해서, 그 매매가를 숫자로 감당할 수 있는지 확인하세요.",
            "마지막으로 전세금 인상분과 매수 시 월 상환액을 실제 숫자로 나란히 놓고 비교하세요."
          ]
        },
        "다른 지역이나 다른 집을 알아보는 것": {
          "insight": "다른 집을 알아보는 거라면 지금 이 집의 전세금 인상 여부와 매매 결정이 완전히 분리된 문제가 돼요. 어느 지역이나 조건의 집을 원하는지가 아직 안 정해졌다면, 대출 한도를 계산해도 비교 대상 자체가 흔들려요.",
          "real_question": "전세금 인상분과, 다른 지역·다른 집을 대출로 매입할 때 드는 비용을 비교했을 때 어느 쪽이 지금 형편에서 감당 가능한가요?",
          "hidden_assumptions": [
            "'대출로 산다'가 지금 생활권과 비슷한 조건의 집을 뜻하는지, 아니면 예산에 맞춰 지역을 완전히 바꾸는 것도 포함하는지 아직 안 정해졌을 수 있어요",
            "다른 지역으로 옮길 경우 통근·자녀 학교 같은 생활 조건 변화까지 감당 가능한지는 따로 확인 안 됐을 수 있어요",
            "집주인이 부른 인상액이 실제 시세 상승분과 같다고 가정하고 있을 수 있어요 — 협상 여지가 있을 수도 있어요"
          ],
          "skeleton": [
            "먼저 — 국토부 실거래가 공개시스템(molit.go.kr)에서 지금 사는 집 또는 주변 단지의 최근 전세 실거래가를 확인해서, 집주인이 부른 인상액이 시세 대비 합리적인지부터 확인하세요.",
            "그다음 — 이사를 고려 중인 지역 후보를 좁혀서, 그 지역 매매 시세와 본인 소득 기준 DSR 한도를 대조해 대출로 실현 가능한 예산 범위부터 정하세요.",
            "그리고 — 전세 재계약 시 총비용(인상분 + 대출이자 없이 유지)과 매입 시 총비용(대출원리금 + 취등록세 등 부대비용)을 같은 기간 기준으로 숫자로 나란히 비교하세요."
          ]
        },
        "아직 정하지 않았고 둘 다 열어둔 상태": {
          "insight": "지금 집을 살지 다른 집을 알아볼지 둘 다 열어뒀다는 건, 단순히 '이 집이냐 아니냐'가 아니라 집을 찾는 데 걸리는 시간까지 고민에 들어와야 한다는 뜻이에요. 전세 만기까지 남은 시간 안에 다른 집을 보고 계약까지 끝낼 수 있는지가, 두 선택지 중 하나를 아예 못 쓰게 만들 수도 있는 변수예요.",
          "real_question": "전세금 인상분과 대출로 집을 사는 월 상환 부담을 비교하는 것과 별개로, 전세 만기까지 남은 시간 안에 원하는 집(지금 집이든 다른 집이든)을 구하고 대출 실행까지 마칠 수 있나요?",
          "hidden_assumptions": [
            "'대출을 더 받으면 살 수 있다'고 가정하지만, 실제 DSR·LTV 기준 대출 한도가 원하는 매매가를 감당하는지는 아직 확인 안 됐을 수 있어요",
            "집주인이 부른 인상액이 실제 시세 상승분과 같다고 가정하고 있을 수 있어요 — 협상 여지가 있을 수도 있어요",
            "지금 집이든 다른 집이든 둘 다 열어뒀다는 건, 집을 찾고 계약하는 데 걸리는 시간이 전세 만기 일정과 부딪히지 않는다는 전제가 아직 확인 안 됐다는 뜻일 수 있어요"
          ],
          "skeleton": [
            "먼저 — 국토부 실거래가 공개시스템(molit.go.kr)에서 이 집 또는 주변 단지의 최근 전세 실거래가를 확인해서, 집주인이 부른 인상액이 시세 대비 합리적인지부터 확인하세요.",
            "그다음 — 은행 앱이나 대출 상담으로 본인 소득 기준 실제 DSR 한도와 대출 가능 금액을 계산해서, '대출로 산다'가 숫자로 실현 가능한 선택지인지부터 확정하세요.",
            "그리고 — 전세 만기까지 남은 날짜와, 집을 알아보는 데 걸리는 기간(매물 탐색, 대출 실행, 계약)을 겹쳐봐서 '다른 집'이 시간상으로도 가능한 선택지인지 확인하세요.",
            "필요하면 — 집주인과 만기 연장이나 인상 유예 협상이 가능한지도 같이 알아보면, 시간에 쫓기지 않고 두 선택지를 비교할 여유가 생겨요."
          ]
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
        "real_question": "How certain is the promotion — is it a committed timeline from your manager, or a hope based on how things have been going?",
        "insight": "Before comparing the two offers, find out whether the promotion is a formalized commitment with a timeline or an informal expectation you've inferred. A promotion that's already scheduled is a very different bet than one that could slip, get deprioritized, or depend on budget approval you haven't seen yet.",
        "hidden_assumptions": [
          "That the promotion next year is a near-certain outcome rather than a hoped-for one — many promotions get delayed by budget cycles, reorgs, or a manager change",
          "That the 25% raise is the new role's ceiling rather than its floor — the offer's growth trajectory (comp bands, scope) matters as much as the entry number",
          "That liking your current team is separate from your compensation trajectory there — staying with people you like doesn't guarantee the raise materializes on schedule"
        ],
        "skeleton": [
          "First — go back to your manager (or whoever signaled the promotion) and ask directly: is there a committed timeline, or is it still contingent on budget/performance cycle? This tests the core assumption the whole decision rests on.",
          "Then — find out what the promotion would actually move your comp to, and compare that number directly against the 25% raise, not against a vague sense of 'it'll be good.'",
          "Next — ask the new company about growth trajectory beyond the entry raise: comp bands, review cycle, scope of the role — a 25% raise with a flat ceiling is a different offer than 25% with room to keep growing.",
          "The key here — check if the offer has a hard deadline. If you can, ask for a short extension; a rushed decision on a partial-information promotion is the riskiest version of this choice.",
          "Finally — weigh which uncertainty is bigger for you: the promotion timeline slipping, or the new team/culture being worse than you expect. Whichever risk feels heavier to live with if it goes wrong is the one to weight more."
        ],
        "next_question": {
          "text": "Has your manager given you a specific timeline for the promotion, or is it something you're inferring from how things have gone?",
          "subtext": "This single fact changes whether staying is a low-risk bet or a leap of faith — it reshapes the whole comparison.",
          "options": [
            "Manager gave an explicit timeline and next steps",
            "It's been mentioned informally but nothing is scheduled",
            "I'm inferring it from performance reviews / general trajectory",
            "I haven't actually asked directly yet"
          ]
        }
      },
      "refined": {
        "Manager gave an explicit timeline and next steps": {
          "insight": "With a confirmed timeline and concrete next steps from your manager, the promotion risk that was the biggest open variable is now largely resolved, so the decision shifts from 'will this happen' to 'which path pays off more.' The deciding contrast now is a straight numbers comparison: what the promotion actually moves your comp to versus the 25% offer, not whether the promotion is real.",
          "real_question": "Now that the promotion timeline is confirmed, does the promotion's actual comp increase match or exceed the 25% offer, or does staying mean accepting a smaller raise for the team and role you prefer?",
          "hidden_assumptions": [
            "That the promotion's comp increase is comparable to or better than 25% — a confirmed timeline doesn't guarantee the raise size matches the outside offer",
            "That the new company's growth trajectory beyond the entry raise (comp bands, scope) still needs checking before comparing offers directly",
            "That liking your current team is a factor you're willing to weigh against a possible comp gap, not something that automatically overrides it"
          ],
          "skeleton": [
            "First — find out what the promotion would actually move your comp to, and compare that number directly against the 25% raise, since the timeline is now confirmed and the number is the open variable.",
            "Then — ask the new company about growth trajectory beyond the entry raise: comp bands, review cycle, scope of the role, since 25% with a flat ceiling is a different offer than 25% with room to keep growing.",
            "Next — check if the offer has a hard deadline; if you can, ask for a short extension so the promotion's actual number can land before you decide.",
            "Finally — once both numbers are in front of you, weigh whether the comp gap (if any) is worth more to you than staying with the team and role you prefer."
          ]
        },
        "It's been mentioned informally but nothing is scheduled": {
          "insight": "This confirms the promotion is currently a hope, not a commitment, which shifts real weight toward the raise being the more concrete number on the table. The deciding contrast now is whether that informal mention can be converted into something firmer before you have to answer the offer, or whether you'd be deciding blind either way.",
          "real_question": "Can the informal promotion mention be turned into something concrete (a quarter, a written note, explicit next steps) before you have to respond to the offer, or does this decision have to be made without that clarity?",
          "hidden_assumptions": [
            "That an informal mention carries the same weight as a scheduled promotion - it doesn't; informal signals are more exposed to budget cycles, reorgs, or a manager change than a committed timeline",
            "That the 25% raise is the new role's ceiling rather than its floor - the offer's growth trajectory (comp bands, scope) matters as much as the entry number",
            "That liking your current team is separate from your compensation trajectory there - staying with people you like doesn't guarantee the raise materializes on schedule"
          ],
          "skeleton": [
            "First - go back to your manager and ask for something more specific than the informal mention: a quarter, a written note, or explicit next steps. This tests whether the signal can firm up at all.",
            "Then - find out what the promotion would actually move your comp to, and compare that number directly against the 25% raise, not against a vague sense of 'it'll be good.'",
            "Next - ask the new company about growth trajectory beyond the entry raise: comp bands, review cycle, scope of the role - a 25% raise with a flat ceiling is a different offer than 25% with room to keep growing.",
            "Check if the offer has a hard deadline. If you can, ask for a short extension; a rushed decision on an informal promotion is the riskiest version of this choice.",
            "Finally - weigh which uncertainty is bigger for you: the promotion staying informal indefinitely, or the new team/culture being worse than you expect. Whichever risk feels heavier to live with if it goes wrong is the one to weight more."
          ]
        },
        "I'm inferring it from performance reviews / general trajectory": {
          "insight": "Confirming the promotion is inferred rather than committed turns the core assumption from a hypothetical risk into a live one — performance trajectory signals readiness, but it doesn't control budget cycles, reorgs, or a manager's follow-through. That means the comparison is now sharper: a guaranteed 25% raise today versus a promotion whose timing and existence you don't fully control.",
          "real_question": "Given that the promotion is based on inference rather than a committed timeline, how much weight should the certainty of the new offer carry against the uncertainty of the promotion actually landing next year?",
          "hidden_assumptions": [
            "That performance trajectory reliably predicts promotion timing — strong reviews signal readiness but don't guarantee budget approval or a manager's follow-through",
            "That the 25% raise is the new role's ceiling rather than its floor — the offer's growth trajectory (comp bands, scope) matters as much as the entry number",
            "That liking your current team is separate from your compensation trajectory there — staying with people you like doesn't guarantee the raise materializes on schedule"
          ],
          "skeleton": [
            "First — since the promotion is inferred rather than confirmed, go back to your manager and ask directly whether there's a real timeline or if it's still contingent on the next budget/performance cycle. This is now the most load-bearing step, since nothing else here is confirmed.",
            "Then — find out what the promotion would actually move your comp to, and compare that number directly against the 25% raise, not against a vague sense of 'it'll be good.'",
            "Next — ask the new company about growth trajectory beyond the entry raise: comp bands, review cycle, scope of the role — a 25% raise with a flat ceiling is a different offer than 25% with room to keep growing.",
            "Check if the offer has a hard deadline. If you can, ask for a short extension; deciding on an inferred promotion with no real answer from your manager is the riskiest version of this choice.",
            "Finally — weigh which uncertainty is heavier for you: the promotion timeline slipping, or the new team/culture being worse than you expect. Whichever risk feels harder to live with if it goes wrong is the one to weight more."
          ]
        },
        "I haven't actually asked directly yet": {
          "insight": "Not having asked yet means the promotion is still an open assumption rather than a confirmed fact, so the whole decision is currently resting on inference, not information. The real fork now is whether you have room to close that gap before the offer forces your hand, or whether you'll have to decide while it's still unresolved.",
          "real_question": "Do you have enough time before the offer's deadline to ask your manager directly about the promotion timeline, or will you have to decide before that conversation can happen?",
          "hidden_assumptions": [
            "That the promotion next year is a near-certain outcome rather than a hoped-for one — right now it's unverified, not confirmed",
            "That the 25% raise is the new role's ceiling rather than its floor — the offer's growth trajectory matters as much as the entry number",
            "That liking your current team is separate from your compensation trajectory there — staying doesn't guarantee the raise materializes on schedule"
          ],
          "skeleton": [
            "First — have the direct conversation with your manager now: ask whether there's a committed promotion timeline or if it's still contingent on budget or performance cycles, since this hasn't happened yet and everything else depends on it.",
            "Then — check the offer's deadline against that conversation: is there room to get an answer before you have to respond, or would you need to decide first?",
            "Next — find out what the promotion would actually move your comp to, and compare that number directly against the 25% raise.",
            "Also — ask the new company about growth trajectory beyond the entry raise: comp bands, review cycle, scope of the role.",
            "Finally — weigh which uncertainty is heavier for you: the promotion timeline slipping, or the new team/culture being worse than you expect."
          ]
        }
      },
      "sealExample": "I'll stay for now — if the promotion isn't formalized by March, I start looking again."
    },
    {
      "id": "hire",
      "problem": "I run a one-person design studio and work keeps piling up. Should I hire my first employee? I'm not sure the work will keep coming in.",
      "initial": {
        "real_question": "Is the current overload a sustained trend in your revenue, or a temporary spike from a few big projects?",
        "insight": "Before deciding to hire, verify whether the extra work reflects a durable increase in incoming revenue or just a cluster of big projects hitting at once. A fixed employee cost only makes sense against a recurring pipeline — a one-time surge is better absorbed with a contractor.",
        "hidden_assumptions": [
          "Hiring a full-time employee is assumed to be the only fix — a contractor or part-time freelancer could solve the overflow without the fixed monthly cost",
          "The current pace of inquiries is assumed to predict the next 6 months, when it may just reflect this quarter's client mix",
          "Taking on an employee is assumed to be reversible if work slows — but letting someone go has real cost (severance, reputation, your own time to re-hire later)"
        ],
        "skeleton": [
          "First — pull your last 6-12 months of revenue or signed-project data and check whether the overflow is a steady climb or a spike tied to one or two clients; this tests whether the 'work keeps coming' feeling matches the actual numbers.",
          "Then — calculate the break-even: what monthly revenue would you need to comfortably cover a salary plus taxes/benefits, and compare that to your average of the last few months, not just the busiest one.",
          "Next — before committing to a hire, run one project through a freelance or contract designer; this tells you whether outsourcing solves the immediate crunch without locking in fixed cost.",
          "Next — look at what's actually in your pipeline for the next 2-3 months (signed contracts or firm proposals, not just inquiries) — this is the real test of whether the demand is durable.",
          "Finally — if you do hire, structure it as a trial (part-time or contract-to-hire) tied to a clear revenue threshold, so the decision stays reversible until the trend is confirmed."
        ],
        "next_question": {
          "text": "Is the extra workload coming from a few existing clients giving you more work, or from new clients you're winning at a faster rate?",
          "subtext": "Concentrated growth from a few clients is a fragile signal; broad-based new client growth is a much stronger case for hiring.",
          "options": [
            "A few key clients have significantly increased their work with me",
            "I've been steadily winning new clients",
            "It's inconsistent — busy some months, quiet others",
            "I took on one large one-off project"
          ]
        }
      },
      "refined": {
        "A few key clients have significantly increased their work with me": {
          "insight": "Since the extra load comes from a handful of existing clients rather than broader market pull, the real risk shifts from general demand forecasting to relationship concentration: your hire decision now rides on just a few accounts continuing to expand. The deciding contrast is whether these clients have formalized more work (retainers, expanded contracts) or are simply sending more one-off projects that could taper off just as fast.",
          "real_question": "Is the increased work from these few key clients a durable, structural expansion (new retainer or scope) or a temporary surge in their project needs?",
          "hidden_assumptions": [
            "The plan assumed demand growth was broad-based, but it's concentrated in a few client relationships, so sustainability now depends on those specific accounts, not the general market",
            "Hiring is assumed reversible if work slows, but if these key clients pull back, both the workload and the revenue to support the hire could disappear together",
            "The current pace of increased work is assumed to reflect a lasting shift in scope, when it may just be these clients' current project cycle"
          ],
          "skeleton": [
            "First — talk directly with these key clients about their expected workload over the next 2-3 quarters; this tests whether the increase is a lasting shift or tied to their current projects",
            "Then — check what share of your total revenue these few clients represent; high concentration means the hire's viability hinges on very few relationships continuing",
            "Next — calculate the break-even: what monthly revenue you'd need to cover salary plus taxes/benefits, compared to your average months, not just the busiest one",
            "Next — before committing to a hire, run one project through a freelance or contract designer to see if outsourcing covers the crunch without fixed cost",
            "Finally — if you do hire, structure it as a trial tied to continued work from these specific clients, not just a general revenue threshold"
          ]
        },
        "I've been steadily winning new clients": {
          "insight": "Winning new clients at a steadier rate (rather than a few existing accounts piling on more work) is a stronger signal of market-level demand than of one relationship's temporary spike, so the case for durable demand looks a bit stronger than in the original picture. But the deciding factor now shifts to what's driving that new-client flow, since a referral cluster or a one-time campaign can taper just as easily as a single big client's project ending.",
          "real_question": "Is your steady stream of new clients coming from a repeatable, scalable source, or from a channel that could dry up once the current cluster is exhausted?",
          "hidden_assumptions": [
            "Winning new clients steadily is assumed to mean the demand is broad-based, but it could still trace back to one referral chain or campaign that eventually runs its course",
            "Hiring a full-time employee is assumed to be the only fix — a contractor or part-time freelancer could absorb new-client work without the fixed monthly cost",
            "Taking on an employee is assumed to be reversible if the new-client rate slows, but letting someone go has real cost (severance, reputation, your own time to re-hire later)"
          ],
          "skeleton": [
            "First — map where your new clients over the last 6-12 months actually came from (referrals, a specific marketing push, inbound/organic) to see if the source is repeatable or a one-time cluster.",
            "Then — calculate the break-even: what monthly revenue would you need to comfortably cover a salary plus taxes/benefits, and compare that to your average of the last few months, not just the busiest one.",
            "Next — before committing to a hire, run one project through a freelance or contract designer; this tells you whether outsourcing solves the immediate crunch without locking in fixed cost.",
            "Next — look at what's actually in your pipeline for the next 2-3 months (signed contracts or firm proposals, not just inquiries) — this is the real test of whether the new-client trend is durable.",
            "Finally — if you do hire, structure it as a trial (part-time or contract-to-hire) tied to a clear revenue threshold, so the decision stays reversible until the trend is confirmed."
          ]
        },
        "It's inconsistent — busy some months, quiet others": {
          "insight": "The inconsistency itself is the finding — this isn't a spike-vs-trend question anymore, it's a volatility question, and volatile demand is the scenario where a fixed salary carries the most risk. The deciding factor now is whether your revenue in the quiet months still covers a salary, or whether hiring would mean eating losses every other month.",
          "real_question": "Does your revenue during the quiet months still cover the cost of a salaried employee, or would the inconsistency leave you underwater in slow periods?",
          "hidden_assumptions": [
            "Hiring a full-time employee is assumed to be the only fix — a contractor or part-time freelancer could absorb the busy months without carrying fixed cost through the quiet ones",
            "The 'busy some months, quiet others' pattern is assumed to average out fine over a year, but it's the worst individual quiet months, not the average, that determine whether a salary is survivable",
            "Taking on an employee is assumed to be reversible if work slows — but letting someone go has real cost (severance, reputation, your own time to re-hire later)"
          ],
          "skeleton": [
            "First — pull your last 6-12 months of revenue and mark the quiet months specifically; check what your lowest-revenue month looked like, since that's the real stress test, not the busy-month average.",
            "Then — calculate the break-even: what monthly revenue would you need to cover a salary plus taxes/benefits, and compare that against your worst month, not your best or your average.",
            "Next — before committing to a hire, run one project through a freelance or contract designer during a busy stretch; this tells you whether outsourcing absorbs the peaks without locking in cost through the quiet ones.",
            "Next — look at what's actually in your pipeline for the next 2-3 months (signed contracts or firm proposals, not just inquiries), since durable demand is what would make the inconsistency less risky going forward.",
            "Finally — if you do hire, structure it as a trial (part-time or contract-to-hire) tied to a revenue floor, so the decision stays reversible if a quiet stretch runs longer than expected."
          ]
        },
        "I took on one large one-off project": {
          "insight": "This answer points the overload toward a temporary spike rather than a steady trend, since it's one large project rather than a broader lift in client volume or inquiry rate. The real fork now is whether this project opens follow-on work with the same client or others, versus ending cleanly with your workload returning to normal.",
          "real_question": "Once this large project wraps up, is there follow-on work or new pipeline that would sustain a hire, or does the overload disappear with it?",
          "hidden_assumptions": [
            "Hiring a full-time employee is assumed to be the only fix — a contractor or part-time freelancer could absorb this specific project's overflow without fixed monthly cost",
            "The project is assumed to be genuinely isolated — but it's worth checking if the same client typically brings repeat or referral work",
            "Taking on an employee is assumed to be reversible if work slows — but letting someone go has real cost (severance, reputation, your own time to re-hire later)"
          ],
          "skeleton": [
            "First — clarify what happens once this large project ends: does it open a retainer, follow-on phase, or referrals from this client, or is it a clean one-time engagement?",
            "Then — calculate the break-even: what monthly revenue would you need to comfortably cover a salary plus taxes/benefits, and compare that to your average of the last few months excluding this one project.",
            "Next — run the rest of this large project (or the next one that comes in) through a freelance or contract designer; this tells you whether outsourcing covers the crunch without locking in fixed cost.",
            "Next — look at what's actually in your pipeline beyond this client for the next 2-3 months (signed contracts or firm proposals, not just inquiries) — this is the real test of durable demand.",
            "Finally — if you do hire, structure it as a trial (part-time or contract-to-hire) tied to a clear revenue threshold, so the decision stays reversible until the trend is confirmed."
          ]
        }
      },
      "sealExample": "No full-time hire yet — the next two projects go to a contractor; if that costs more than 70% of a salary, I hire."
    },
    {
      "id": "home",
      "problem": "My lease is ending and the landlord is raising the rent. Do I renew at the higher price, or stretch my budget and buy a place?",
      "initial": {
        "real_question": "Given how long you actually expect to stay in this home, does buying's higher stretch pay off before you'd likely move again?",
        "insight": "Before choosing, verify your realistic time horizon in this home and how much true financial buffer would be left after the stretch — not just the monthly payment comparison. Renting keeps flexibility with rising cost, while buying trades that flexibility for equity, but only if you stay long enough and have enough cushion to absorb the risk.",
        "hidden_assumptions": [
          "That 'stretching the budget' is a temporary squeeze — a mortgage stretch is a multi-year commitment, not a one-time adjustment like negotiating rent.",
          "That renewing at the higher rent is the 'safe' default — but repeated annual increases compound, so the real comparison is this year's rent vs. this year's mortgage AND next few years' likely rent trajectory.",
          "That you'll qualify for the mortgage size buying would require — lender debt-to-income limits may cap what's actually available, regardless of what you'd prefer to stretch to."
        ],
        "skeleton": [
          "First — write out the true monthly cost of buying (mortgage + property tax + insurance + a maintenance reserve), not just the mortgage payment, and compare that real number to the new rent.",
          "Then — be honest about your realistic horizon in this location (job stability, relationship, any planned moves) — this single factor decides whether buying's upfront costs have time to pay off.",
          "Next — check what you'd have left in savings after down payment and closing costs; if it's under 3-6 months of expenses, the 'stretch' carries real risk beyond the monthly number.",
          "The key here — get a lender pre-qualification conversation going now, since it tells you the actual ceiling on what you could buy, not just what you're hoping to stretch to.",
          "Finally — run your actual numbers (price, rent, horizon) through a rent-vs-buy calculator rather than deciding on the sticker-price comparison alone; the breakeven point is usually a specific number of years, and it's easy to underestimate."
        ],
        "next_question": {
          "text": "How long do you realistically expect to stay in this home or area?",
          "subtext": "This one answer flips the math — a short horizon usually favors renewing even at the higher rent; a long one changes what 'stretch' is worth.",
          "options": [
            "1-2 years (job or life plans uncertain)",
            "3-5 years (fairly stable, but open to change)",
            "5+ years (settled, planning to stay)",
            "Genuinely don't know yet"
          ]
        }
      },
      "refined": {
        "1-2 years (job or life plans uncertain)": {
          "insight": "A 1-2 year uncertain horizon means buying's upfront costs (closing costs, agent fees if you sell) have very little time to amortize before you'd likely be moving again. The real question isn't rent vs. mortgage anymore, it's whether you have an exit that isn't 'sell at a loss on transaction costs' if you leave in year two.",
          "real_question": "If you do move again within 1-2 years like you expect, what's your actual exit — sell the place, or could you rent it out — and does that change whether stretching to buy still makes sense?",
          "hidden_assumptions": [
            "That the 1-2 year horizon means you'd have to sell if you move — but if renting the place out afterward is realistic, the breakeven math changes completely.",
            "That a mortgage stretch is a temporary squeeze — it's a multi-year commitment regardless of how long you personally stay in the home.",
            "That you'll qualify for the mortgage size buying would require — lender debt-to-income limits may cap what's actually available."
          ],
          "skeleton": [
            "First — write out the true monthly cost of buying (mortgage + property tax + insurance + maintenance reserve) and compare that real number to the new rent.",
            "Then — given the 1-2 year horizon, look up the breakeven point on a rent-vs-buy calculator for your actual numbers; this tells you concretely whether that timeframe is enough or falls short.",
            "Next — check what you'd have left in savings after down payment and closing costs; if it's under 3-6 months of expenses, the stretch carries real risk on top of the short-horizon risk.",
            "The key here — get a lender pre-qualification conversation going now, since it tells you the actual ceiling on what you could buy.",
            "Finally — clarify your realistic exit if you do move in 1-2 years (sell vs. rent out), since that single factor determines whether the short horizon kills the buying case or not."
          ]
        },
        "3-5 years (fairly stable, but open to change)": {
          "insight": "A 3-5 year horizon lands right in the zone where rent-vs-buy outcomes can go either way, so the decision now hinges on your specific breakeven math rather than the horizon question itself. The 'open to change' part matters too: if you sold in year 2 or 3 instead of year 5, agent fees and closing costs on the sale could erase any savings buying was supposed to deliver.",
          "real_question": "Given a 3-5 year horizon that could shorten, does your specific breakeven point (price, rent, transaction costs) fall inside that window, or does the risk of an early exit tip it back toward renewing?",
          "hidden_assumptions": [
            "That a mortgage stretch is a multi-year commitment, not a one-time squeeze like negotiating rent.",
            "That the horizon is a fixed 3-5 years — but 'open to change' means it could be shorter, making resale transaction costs (agent fees, closing costs) a real risk, not just the monthly comparison.",
            "That you'll qualify for the mortgage size buying would require — lender debt-to-income limits may cap what's actually available."
          ],
          "skeleton": [
            "First — write out the true monthly cost of buying (mortgage + property tax + insurance + maintenance reserve) and compare that to the new rent.",
            "Then — since your horizon is 3-5 years but could shorten, run the breakeven math including resale costs (agent fees, closing costs) if you had to sell in year 2 or 3, not just year 5.",
            "Next — check what you'd have left in savings after down payment and closing costs; if it's under 3-6 months of expenses, the stretch carries real risk beyond the monthly number.",
            "The key here — get a lender pre-qualification conversation going now, since it tells you the actual ceiling on what you could buy.",
            "Finally — run your actual price, rent, and horizon numbers through a rent-vs-buy calculator rather than deciding on the sticker-price comparison alone."
          ]
        },
        "5+ years (settled, planning to stay)": {
          "insight": "With a settled 5+ year horizon, the timing question that used to be the main risk is essentially resolved in buying's favor, since most rent-vs-buy breakeven points fall well inside that window. The deciding variable now shifts from 'how long will you stay' to 'can your finances sustainably absorb the stretch' — meaning affordability and reserves matter more than the horizon ever did.",
          "real_question": "Given you're settled for 5+ years, does your financial capacity (income stability, savings reserves, actual mortgage qualification) support the stretch, rather than whether buying pays off over time?",
          "hidden_assumptions": [
            "That the horizon was the main open risk — with 5+ years confirmed, the timing math likely favors buying, so the real risk has moved to affordability, not duration.",
            "That you'll qualify for the mortgage size buying would require — lender debt-to-income limits may cap what's actually available regardless of preference.",
            "That renewing at the higher rent is the 'safe' default — but repeated annual increases compound, so even the rent side isn't static over a 5+ year stay."
          ],
          "skeleton": [
            "First — write out the true monthly cost of buying (mortgage + property tax + insurance + maintenance reserve) and compare it to the new rent, since this comparison now carries more weight with the horizon settled.",
            "Then — check what you'd have left in savings after down payment and closing costs; since you're committing long-term, a thin post-purchase buffer is a real risk regardless of the horizon being favorable.",
            "Next — get a lender pre-qualification conversation going, since it tells you the actual ceiling on what you could buy, not just what you're hoping to stretch to.",
            "Finally — run your actual numbers (price, rent, 5+ year horizon) through a rent-vs-buy calculator to confirm the breakeven math genuinely works in your favor rather than assuming it does."
          ]
        },
        "Genuinely don't know yet": {
          "insight": "Not knowing your horizon isn't a gap to fill in later — it's information: it means the breakeven math can't resolve to one clean number right now. The deciding contrast is whether that uncertainty comes from something concrete (a likely job or life change) versus being genuinely open-ended, since each points toward a different way to make the decision robust to not-knowing.",
          "real_question": "Given that your horizon is genuinely unclear right now, should the decision wait on something specific resolving, or should you choose the option that holds up best across a range of possible horizons?",
          "hidden_assumptions": [
            "That 'stretching the budget' is a temporary squeeze — a mortgage stretch is a multi-year commitment, not a one-time adjustment like negotiating rent.",
            "That renewing at the higher rent is the 'safe' default — but repeated annual increases compound, so the real comparison is this year's rent vs. this year's mortgage AND next few years' likely rent trajectory.",
            "That the horizon question has a clean answer waiting to be found — if it's genuinely open-ended, the decision may need to be built around downside protection instead of a single breakeven year."
          ],
          "skeleton": [
            "First — write out the true monthly cost of buying (mortgage + property tax + insurance + a maintenance reserve), not just the mortgage payment, and compare that real number to the new rent.",
            "Then — since the horizon is genuinely unclear right now, identify what's actually driving that (career move on the table, relationship/life changes, or just no particular signal) — that's what would need to resolve before the buy/rent math has a fixed input.",
            "Next — check what you'd have left in savings after down payment and closing costs; if it's under 3-6 months of expenses, the 'stretch' carries real risk beyond the monthly number.",
            "The key here — get a lender pre-qualification conversation going now, since it tells you the actual ceiling on what you could buy, not just what you're hoping to stretch to.",
            "Finally — run your numbers through a rent-vs-buy calculator across a couple of realistic horizon scenarios (say, 2 years vs. 5+ years) rather than one point estimate, since the breakeven and your downside look very different depending which one turns out true."
          ]
        }
      },
      "sealExample": "We renew this year — and I get pre-qualified within six months so next year's call is made with real numbers."
    }
  ]
};
