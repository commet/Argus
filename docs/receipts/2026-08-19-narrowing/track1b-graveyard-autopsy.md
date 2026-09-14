# 1b — 결정 기록 제품의 무덤 부검

> 조사 에이전트 보고 원문 (2026-08-19). 주 세션 검수: 핵심 주장 구조 확인.

**이 조사가 기각하면 무너지는 것:** "AI가 기록 비용(α)과 재열람 부재(δ)를 해소했으므로 결정 장부는 이번엔 산다"는 존립 전제 — 결론: **α·δ 해소는 실증 지지, β는 절반, γ는 잔존을 넘어 증폭 위험. 단, 최대 사인은 넷 밖에 있을 수 있다(수요 부재).**

## 부검 표

| 제품/관행 | 사인 | 출처 |
|---|---|---|
| 설계 근거 도구 (gIBIS·QOC, 1980–90s) | 기록 고비용·침습성(α) + "효과가 지각되지 않음"(β) + 활용 곤란(δ) | [DR 캡처 요인 연구](https://www.researchgate.net/publication/245118859_A_Tool_for_Capturing_Design_Rationale) · [Grudin 1994: 일하는 자≠득 보는 자](https://bpb-us-e1.wpmucdn.com/blogs.cornell.edu/dist/4/2619/files/2016/07/grudin_EightChallengesForDevelopers-1nwclfd.pdf) |
| Cloverpop (결정 추적 SaaS 개척자, 2012~) | 12년 누적 ~$13–17M, 2022년 직원 5명, 2026-05 피인수·재배치. HN 증언 사인: "경영진이 시간 낭비 취급" — **수요 부재** | [Tracxn](https://tracxn.com/d/companies/cloverpop/__r2ONytLakb4P0XWxdR60DzVUG-mG-y7INgqCMYO1eIw) · [피인수 공지](https://www.cloverpop.com/resources/cloverpop-was-acquired-by-clearbox-decisions) |
| 결정 저널 (Farnam Street 보급) | "결국 나 혼자 유지" · "진짜 이유를 공개 문서에 쓰긴 창피"(γ-경량형). 생존은 개인+즉시 피드백(투자 저널)뿐 | [HN 스레드](https://news.ycombinator.com/item?id=22694014) · [fs.blog](https://fs.blog/decision-journal/) |
| ADR | 85.1%가 중요하다면서 시간·도구 부재로 미기록, 74.2%는 자기 결정 절반 이상 망각. "쓰이되 읽히지 않음"은 구조 문제 | [Tang 2006 설문](https://www.researchgate.net/publication/222665704_A_survey_of_architecture_design_rationale) · [JavaCodeGeeks 2026](https://www.javacodegeeks.com/2026/05/the-reason-most-architecture-decision-records-get-written-and-never-read-is-architectural-not-cultural.html) |
| OKR 도구 | MS Viva Goals 2025-12-31 은퇴(사용량 미달). 주간 리듬 생략 팀은 포기 확률 3배 | [MS 공지](https://learn.microsoft.com/en-us/viva/goals/goals-retirement) · [OKRs Tool 집계](https://www.okrstool.com/blog/why-okrs-fail) |
| 팀 위키 | 낡은 문서 1건 → 전체 불신 → 갱신 중단의 나선 | [dev.to](https://dev.to/kislay/why-your-engineering-wiki-is-a-graveyard-and-how-to-fix-it-2eme) |

## 가설 판정 — α·β·γ·δ 전부 확증

- **α (기록 비용)** 확증 — Tang 2006 최다 미기록 사유 = 시간·예산.
- **β (보상 지연)** 확증 — OKR 은 보상 루프를 주 단위로 당긴 팀만 생존.
- **γ (책임 추궁 무기화 공포)** 확증 — 결정적 증거: Google 은 "Communicate with Care" 교육 + 채팅 24시간 자동삭제로 **기록 최소화를 제도화**했고 소송에서 제재받았다 ([Legal Dive](https://www.legaldive.com/news/doj-google-spoliation-hangouts-auto-delete-discovery-antitrust-mehta/643536/)).
- **δ (재열람 장치 부재)** 확증 — 74.2%가 자기 결정을 망각하는데 재열람은 구조에 없었다.

## AI가 바꾼 것 / 못 바꾼 것

- **α: 대체로 해소 — 단 '캡처'만.** 자동 캡처는 팔린다 (Granola 2026-03 $1.5B 밸류·이탈률 ~0, [YipitData](https://www.yipitdata.com/resources/granola-vs-fathom-otter-fireflies-ai-notetaking)). 그러나 팔리는 건 회의록이지 구조화된 결정+저자성이 아니다 — 채택은 사람 몫으로 남는다.
- **δ: 기계가 생겼고 돈이 움직인다** (Glean ARR $300M, [mlq.ai](https://mlq.ai/news/glean-crosses-300m-arr-tripling-enterprise-ai-search-revenue-in-15-months/)). 단 낡은 기록 위 검색은 "무로그보다 나쁜 거짓 확신"을 증폭 가능.
- **β: 절반만 압축** — 기록 행위의 보상은 즉시화 가능(오늘 쓸 주입·검색의 부산물로 장부가 쌓임), 결정 자체의 정산(현실의 몇 주)은 압축 불가.
- **γ: 미해소 + 증폭 위험** — AI 캡처는 디스커버리 대상 기록을 늘린다. 기업 변호사들이 회의에서 AI 봇을 축출하는 것이 관행화 ([ABA](https://www.americanbar.org/groups/gpsolo/resources/ereport/2025-september/ai-you-confidentiality-risks-meeting-transcription-note-taking-software/), [Mayer Brown](https://www.mayerbrown.com/en/insights/publications/2026/06/ai-notetakers-productivity-tool-or-emerging-legal-risk)). **캡처가 쉬워질수록 γ의 단가는 올라간다.**

## 블레임리스 설계의 실효 — γ의 해독제는 실재한다

- **항공 ASRS (1976~):** 비처벌+제한적 면책 설계만으로 50년간 누적 180만+ 건, 연 ~10만 건의 자발 보고 유지 ([NASA ASRS](https://asrs.arc.nasa.gov/publications/callback/cb_555.html)). 무징벌 구조가 기록 관행을 반세기 살린 가장 강한 단일 증거.
- Etsy 블레임리스 포스트모템 → Google SRE 표준화; 심리적 안전 높은 팀 니어미스 보고 64%↑ ([Etsy 원문](https://www.etsy.com/codeascraft/blameless-postmortems)).
- 반론: 블레임리스도 의식으로 형해화된다 — 해독제는 문화 선언이 아니라 **구조(면책·즉시 효용)**일 때만 듣는다 ([odd.fyi](https://odd.fyi/blog/article/incident-post-mortems-that-change-nothing-the-ritual-of-blameless-accountability/)).

## 이 방향에 가장 불리한 발견 (정직하게)

**Cloverpop 은 α·β·δ 때문에 죽지 않았을 가능성이 높다 — 장부를 원하는 구매자가 없었다(수요 부재).** AI 는 공급(기록 비용·재열람)을 고치지 수요를 만들어주지 않는다. 생존 전례는 전부 '개인 + 즉시 효용 + 무징벌'(투자 저널, ASRS)이라는 좁은 문이며, 팀·조직 장부로 확장하는 순간 γ와 수요 부재가 동시에 되살아난다. **결정 장부가 살려면 "기록이 쉬워졌다"가 아니라 "기록의 보상이 오늘 도착하고, 기록이 무기가 될 수 없음이 구조로 보증된다"를 제품이 증명해야 한다.**

(출처 전체 목록은 본문 링크로 갈음 — 17종)
