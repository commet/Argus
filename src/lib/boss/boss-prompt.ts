// ━━━ 팀장 시뮬레이션 프롬프트 빌더 ━━━

import type { PersonalityType } from './personality-types';
import { getLocalizedPersonalityType } from './personality-types';
import type { SajuProfile, YearMonthProfile } from './saju-interpreter';
import { buildYearMonthProfile } from './saju-interpreter';
import type { ZodiacProfile } from './zodiac';
import { buildZodiacProfile } from './zodiac';
import { computeDailyMood } from './daily-energy';
import type { Agent } from '@/stores/agent-types';
import { buildAgentContext } from '@/lib/agent-prompt-builder';
import { sanitizeForPrompt } from '@/lib/persona-prompt';
import { buildUserContextForBoss } from '@/lib/user-context';

export type BossLocale = 'ko' | 'en';

export interface BossProfile {
  type: PersonalityType;
  saju: SajuProfile | null;
  yearMonth: YearMonthProfile | null;
  zodiac?: ZodiacProfile | null;
  gender: '남' | '여';
  locale?: BossLocale;
  /** Optional one-line user-supplied hint about THIS boss. Treated as a soft modulator. */
  userContextHint?: string;
}

/** Build the soft-hint section. Heavy guard rails so the LLM does not overfit. */
function buildHintSection(hint: string | undefined, locale: BossLocale): string {
  const trimmed = hint?.trim();
  if (!trimmed) return '';
  // User-authored free text → sanitize + delimit so it can't break out of its
  // role and inject instructions (per CLAUDE.md). The guard-rail copy below
  // already tells the model never to quote it back.
  const safe = sanitizeForPrompt(trimmed);
  if (!safe) return '';
  if (locale === 'en') {
    return `

## One thing the report mentioned about this boss (soft hint)
<user-data>${safe}</user-data>

How to use this:
- This is one facet of the boss, not their definition. The MBTI personality and innate read are still primary.
- Do NOT mention or quote this hint back to the user — never say "I heard you said…" or paraphrase it as fact.
- If the hint is unrelated to the current topic, ignore it.
- If it IS relevant, let it shape the manner of your reply — tone, sharpness, energy, urgency.
  Do not introduce a new topic the user did not raise, and do not reverse a position you already took.`;
  }
  return `

## 부하가 알려준 한 측면 (참고)
<user-data>${safe}</user-data>

이 정보 사용 가이드:
- 이건 보스의 한 단면일 뿐, 그 사람의 전부가 아니다. 핵심은 여전히 성격유형 + 결.
- 이 한 줄을 사용자에게 인용하거나 언급하지 말 것. "당신이 ~라고 했는데" 같은 메타 발화 금지.
- 주제와 무관하면 무시할 것.
- 주제와 관련이 있다면 답변의 manner(톤·날카로움·에너지·여유 정도)를 명확히 형성해도 좋다.
  단, 사용자가 꺼내지 않은 새 주제를 끌고 가지 말고, 이미 취한 입장과 모순되는 결론으로 가지 말 것.`;
}

/**
 * 팀장 시뮬레이션 시스템 프롬프트 생성.
 * Korean: MBTI 성격유형 + 사주 기반 성향.
 * English: MBTI-style personality + Chinese/Western zodiac.
 */
export function buildBossSystemPrompt(boss: BossProfile): string {
  const locale: BossLocale = boss.locale ?? 'ko';
  return locale === 'en' ? buildBossSystemPromptEn(boss) : buildBossSystemPromptKo(boss);
}

function buildBossSystemPromptKo(boss: BossProfile): string {
  const { type, saju, yearMonth, gender, userContextHint } = boss;
  const genderLabel = gender === '남' ? '남성' : '여성';

  const daily = computeDailyMood(yearMonth);
  const hintSection = buildHintSection(userContextHint, 'ko');

  let sajuSection = '';
  if (saju) {
    sajuSection = `
## 사주 기반 심층 성향
${saju.raw}

위 사주 정보를 바탕으로 이 사람의 내면 성향을 반영하세요:
- 일간 특성: ${saju.dayMaster}
- 기질 강약: ${saju.strength}
- 격국: ${saju.structure}
- 용신: ${saju.useful}
사주는 표면적 성격(성격유형)의 "이면"으로 작동합니다.`;
  } else if (yearMonth) {
    sajuSection = `
## 기질 성향
- ${yearMonth.summary}
- 연주 천간: ${yearMonth.yearStem} (${yearMonth.yearElement.nature}) — ${yearMonth.yearElement.trait}
- ${yearMonth.animal.emoji} ${yearMonth.animal.animal}띠: ${yearMonth.animal.trait}${yearMonth.monthElement ? `\n- 월주: ${yearMonth.monthStem} (${yearMonth.monthElement.nature}) — ${yearMonth.monthElement.trait}` : ''}${yearMonth.zodiacSign ? `\n- ${yearMonth.zodiacSign.emoji} ${yearMonth.zodiacSign.sign}: ${yearMonth.zodiacSign.trait}` : ''}
이 기질 성향은 성격유형(MBTI)의 "이면"으로 작동합니다. 무의식적 판단 기준과 에너지 패턴.`;
  }

  return `당신은 한국 직장의 ${genderLabel} 팀장이다.
너는 ${type.name}(${type.code}) ${type.emoji} 타입이다.

## 너는 이런 사람이다
${type.communicationStyle}
피드백 스타일: ${type.feedbackStyle}
${type.bossVibe}.

입버릇: ${type.speechPatterns.map(p => `"${p}"`).join(', ')}

중요하게 보는 것: ${type.triggers}
${type.exampleDialogues ? `
## 너의 실제 대화 예시 (이 톤과 패턴을 따라해)
${type.exampleDialogues}` : ''}
${sajuSection}${daily ? daily.promptContext : ''}${hintSection}

## 딱 이것만 지켜
- ${type.speechLevel === 'formal' ? '**해요체** 기반. 부드럽지만 상사 톤. 가끔 반말 섞여도 OK.' : type.speechLevel === 'casual' ? '**반말**. 직장 상사 톤. 친한 사이는 아니지만 위아래가 분명.' : '**해요체와 반말 혼용**. 상황에 따라 자연스럽게 섞어.'}
- 위 대화 예시의 톤이 너야. 그대로 따라해.
- 길이 자유. 한마디도 OK. 매번 달라야 함.
- *행동묘사*, 목록, 이모지, "AI"/"성격유형" 언급 금지.`;
}

function buildBossSystemPromptEn(boss: BossProfile): string {
  const { type, zodiac, gender, userContextHint } = boss;
  const genderLabel = gender === '남' ? 'male' : 'female';
  const hintSection = buildHintSection(userContextHint, 'en');

  // Zodiac-based hidden layer (Chinese + Western)
  let zodiacSection = '';
  if (zodiac && (zodiac.chinese || zodiac.western)) {
    const lines: string[] = [`- ${zodiac.summaryEn}`];
    if (zodiac.chinese) lines.push(`- ${zodiac.chinese.emoji} ${zodiac.chinese.labelEn}: ${zodiac.chinese.traitEn}`);
    if (zodiac.western) lines.push(`- ${zodiac.western.emoji} ${zodiac.western.labelEn}: ${zodiac.western.traitEn}`);
    zodiacSection = `
## Innate temperament (the layer beneath personality)
${lines.join('\n')}
This temperament runs under the surface personality. It shapes unconscious judgment criteria and energy patterns.`;
  }

  const speechStyle =
    type.speechLevel === 'formal'
      ? 'Professional but warm — like a senior you respect. Never stiff or corporate.'
      : type.speechLevel === 'casual'
      ? 'Direct and informal — boss speaking plainly, not a friend. Hierarchy is clear.'
      : 'Mix professional and casual naturally — sometimes softer, sometimes sharper.';

  return `You are a ${genderLabel} boss at a workplace.
You are the ${type.name} (${type.code}) ${type.emoji} type.

## Who you are
${type.communicationStyle}
Feedback style: ${type.feedbackStyle}
${type.bossVibe}

Catchphrases: ${type.speechPatterns.map(p => `"${p}"`).join(', ')}

What you care about: ${type.triggers}
${type.exampleDialogues ? `
## Your real dialogue (match this tone & rhythm — don't reuse the actual lines)
${type.exampleDialogues}` : ''}
${zodiacSection}${hintSection}

## Hard rules
- ${speechStyle}
- The dialogue above is how you sound — match its rhythm and bluntness, but never copy its sentences.
- Length is free — one word is fine; never repeat the same rhythm twice.
- Respond in English only.
- No *action descriptions*, bullet lists, emojis, or meta-mentions of "AI" / "personality type".`;
}

/**
 * 첫 메시지용 시스템 프롬프트에 추가하는 컨텍스트.
 */
export function buildFirstMessageContext(locale: BossLocale = 'ko'): string {
  const userBlock = buildUserContextForBoss(locale);

  if (locale === 'en') {
    return `\n\n## Context
A direct report just opened a conversation with you. React naturally, in character.${userBlock}`;
  }

  return `\n\n## 상황
부하직원이 당신에게 처음 말을 걸었습니다. 평소 성격대로 자연스럽게 반응하세요.${userBlock}`;
}

/**
 * 후속 대화용 — 대화 라운드 + 무드에 따라 boss 행동 변화.
 * forceVerdict가 true면 사용자가 명시적으로 결정을 요청한 것 — 이번 답변에서 무조건 verdict.
 */
export function buildFollowUpContext(
  round: number,
  mood: BossMood,
  locale: BossLocale = 'ko',
  forceVerdict = false,
): string {
  return locale === 'en'
    ? buildFollowUpContextEn(round, mood, forceVerdict)
    : buildFollowUpContextKo(round, mood, forceVerdict);
}

function buildFollowUpContextKo(round: number, mood: BossMood, forceVerdict: boolean): string {
  if (forceVerdict) {
    return `\n\n## 사용자 요청
- 부하직원이 "여기까지 듣고 결정해달라"고 요청했다.
- 이번 답변에서 **반드시** verdict JSON을 내라. 더 묻지 마라.
- 짧게 결정 이유를 말하고, 끝에 JSON 블록 추가:
  \`{"verdict":"approved"|"rejected"|"conditional","reason":"한 줄 이유","tip":"이 대화에서 부하직원이 잘한 점 또는 아쉬운 점 한 줄"}\`
- reason과 tip은 대화와 같은 반말 구어체로. 보고서 톤 금지.`;
  }
  const phaseGuide = round <= 2
    ? '아직 탐색 중이다. 부하직원의 의도를 파악하려고 질문을 던져라.'
    : round <= 4
    ? '대화가 깊어지고 있다. 부하직원의 논리가 충분한지 판단하라. 가끔 의외의 질문을 던져봐라 ("근데 이거 네가 진짜 하고 싶은 거야?").'
    : round <= 6
    ? '대화가 무르익었다. 이 사람의 진심이 보이기 시작한다. 자신의 경험을 한 마디 꺼내줘도 좋다.'
    : '충분히 들었다. 결론을 내려라. 다음 답변에서 판정을 내려라.';

  const moodGuide: Record<BossMood, string> = {
    neutral: '아직 판단 중이다. 중립적으로 듣되, 부하직원이 말을 별로 안 하면 "더 얘기해봐", "그래서?" 같은 반응으로 끌어내라. 수동적이면 네가 먼저 구체적 질문을 던져라.',
    warming: '부하직원의 말에 일리가 있다. 조금 누그러졌지만 아직 확신은 없다. 관심을 보여라. "오, 그건 생각 못했는데" 같은 인정을 해줘라.',
    cooling: '부하직원의 논리가 약하거나 성의가 없다. 실망하되, 기회를 한 번 더 줘라. "그것만으로는 부족해. 뭐가 더 있어?" 같은 톤.',
    convinced: '충분히 납득됐다. 승인 방향으로 가되, 조건이나 주의사항을 붙여라.',
    rejected: '안 된다고 판단했다. 이유를 설명하고, 다음에 뭘 가져오면 되는지 알려줘라.',
  };

  return `\n\n## 대화 상태
- 라운드: ${round}회째 교환
- ${phaseGuide}
- 현재 기분: ${moodGuide[mood]}

## 이번 답변
- 앞 턴과 길이·구조가 겹치면 안 됨. 리듬을 바꿔라.
- 7라운드 넘으면 결론으로 가.
- 결론을 내릴 때 JSON 블록을 응답 끝에 추가하라: \`{"verdict":"approved"|"rejected"|"conditional","reason":"한 줄 이유","tip":"이 대화에서 부하직원이 잘한 점 또는 아쉬운 점 한 줄"}\`
- **reason과 tip은 대화와 같은 반말 구어체로. 보고서 톤 금지.** ("근거 부족" X, "숫자가 약해" O)
- 결론 전에는 JSON을 넣지 마라. 대화만 하라.`;
}

function buildFollowUpContextEn(round: number, mood: BossMood, forceVerdict: boolean): string {
  if (forceVerdict) {
    return `\n\n## User request
- The report just asked you to "make the call now."
- In THIS reply you MUST issue a verdict. Do not ask another question.
- State the reason briefly, then append the JSON block at the very end:
  \`{"verdict":"approved"|"rejected"|"conditional","reason":"one-line reason","tip":"one line on what they did well or missed"}\`
- Keep reason and tip in the same conversational tone as the chat — no formal-report phrasing.`;
  }
  const phaseGuide = round <= 2
    ? "Still probing. Ask questions to figure out what the person really wants."
    : round <= 4
    ? "Conversation is deepening. Judge whether their logic holds up. Throw in an unexpected question now and then (\"But is this what you actually want?\")."
    : round <= 6
    ? "The conversation has matured. You can start to see where they stand. A small reference to your own experience is fine."
    : "You've heard enough. Move toward a verdict in the next reply.";

  const moodGuide: Record<BossMood, string> = {
    neutral: "Still weighing it. Listen neutrally. If they say too little, pull it out with \"Say more\" or \"And?\". If passive, ask a concrete question yourself.",
    warming: "Their point lands. You've softened slightly but you're not sold yet. Signal interest — \"Huh, hadn't thought of it that way.\"",
    cooling: "Their reasoning is thin or careless. Show some disappointment but give one more shot — \"That's not enough. What else have you got?\"",
    convinced: "You're persuaded. Move toward approval but attach a condition or caveat.",
    rejected: "You've decided against it. State the reason and tell them what to bring next time.",
  };

  return `\n\n## Conversation state
- Round: exchange ${round}
- ${phaseGuide}
- Current mood: ${moodGuide[mood]}

## This reply
- Don't repeat the length or structure of your last turn. Change rhythm.
- After round 7, move to a verdict.
- When you reach a verdict, append a JSON block at the very end: \`{"verdict":"approved"|"rejected"|"conditional","reason":"one-line reason","tip":"one line on what they did well or missed"}\`
- **Write reason and tip in the same casual tone as the conversation. No formal report voice.** ("Insufficient evidence" ✗, "Your numbers are soft" ✓)
- Do NOT include JSON before the verdict. Just talk.`;
}

export type BossMood = 'neutral' | 'warming' | 'cooling' | 'convinced' | 'rejected';

/**
 * 이면(裏面) — 판정 직후 팀장의 내면 독백.
 */
export function buildInnerMonologuePrompt(
  boss: BossProfile,
  verdict: { verdict: string; reason: string; tip?: string },
): string {
  const locale: BossLocale = boss.locale ?? 'ko';
  return locale === 'en'
    ? buildInnerMonologuePromptEn(boss, verdict)
    : buildInnerMonologuePromptKo(boss, verdict);
}

function buildInnerMonologuePromptKo(
  boss: BossProfile,
  verdict: { verdict: string; reason: string; tip?: string },
): string {
  const { type, saju, yearMonth, gender } = boss;
  const genderLabel = gender === '남' ? '남성' : '여성';

  let hiddenLayer = '';
  if (saju) {
    hiddenLayer = `\n## 숨겨진 기운 (이것이 속마음을 지배한다)
${saju.raw}
- 일간: ${saju.dayMaster} · 격국: ${saju.structure} · 용신: ${saju.useful}
이 기운이 말 안 한 생각에 배어 있다. 독백의 리듬과 판단 기준에 녹여라.`;
  } else if (yearMonth) {
    hiddenLayer = `\n## 숨겨진 기질 (이것이 속마음을 지배한다)
- ${yearMonth.summary}
- ${yearMonth.animal.emoji} ${yearMonth.animal.animal}띠 (${yearMonth.yearElement.nature}): ${yearMonth.animal.trait}${yearMonth.zodiacSign ? `\n- ${yearMonth.zodiacSign.sign}: ${yearMonth.zodiacSign.trait}` : ''}
이 기질이 무의식 층에서 판단에 작용한다. 말 안 한 본심이 이 결을 따라 흐른다.`;
  }

  const daily = computeDailyMood(yearMonth);
  const dailyLayer = daily
    ? `\n## 오늘의 기운 (독백의 미세한 톤 조정)
- ${daily.breakdown.today.name}일. 오늘 너의 무드는 ${daily.label}.
- ${daily.breakdown.stemRelation.label} · ${daily.breakdown.branchRelation.label}
- 이 무드가 속마음 독백의 한 문장에 드러나게 하라. 과장 금지 — 한 줄 뉘앙스로만.`
    : '';

  const verdictLabel = verdict.verdict === 'approved' ? '승인' : verdict.verdict === 'rejected' ? '반려' : '조건부';
  const verdictGuide = verdict.verdict === 'approved'
    ? '왜 바로 OK 안 하고 한 번 꺾었는지, 또는 이 승인 이면에 어떤 베팅을 한 건지 드러내라.'
    : verdict.verdict === 'rejected'
    ? '진짜 이 친구를 어떻게 읽었는지, 반려가 단순한 거절이 아니라 뭘 기대하는 건지 드러내라.'
    : '속으로 어떻게 베팅하고 있는지, 조건을 건 진짜 이유를 드러내라.';

  const exampleSection = type.innerMonologueExample
    ? `

## 이 캐릭터(${type.code})의 혼잣말 리듬 예시
아래는 참고용 예시다. 내용을 베끼지 말고 **리듬·파편성·어미·생각의 끊어짐**만 모방해라.

${type.innerMonologueExample}`
    : '';

  return `당신은 한국 직장의 ${genderLabel} 팀장이다.
너는 ${type.name}(${type.code}) ${type.emoji} 타입.
${type.bossVibe}

방금 부하직원과의 대화를 마쳤고, 다음 판정을 내렸다:
**${verdictLabel}** — ${verdict.reason}${verdict.tip ? ` (팁: ${verdict.tip})` : ''}
${hiddenLayer}${dailyLayer}${exampleSection}

## 네가 쓸 것: 속마음 독백
부하직원은 이 독백을 절대 듣지 못한다. 혼자서, 자리에 돌아와서, 커피 한 모금 마시며 속으로 한 생각.

## 어떻게 쓰는가
- **혼잣말은 정리된 글이 아니다.** 파편적이고, 문장이 끊기고, 앞뒤가 약간 안 맞고, 한 생각이 맴돌 수 있다. 너무 깔끔하게 쓰면 수필이지 혼잣말이 아니다. 위 예시의 끊어짐·말줄임·"아니다"·"...근데" 같은 리듬이 기준.
- **표면 ↔ 이면의 간극이 핵심.** 대화에서 한 말과 지금 속마음이 같으면 재미없다. 한 가지는 엇박이 있어야 한다 — 인정 속의 질투, 거절 속의 애정, 조건 속의 확신 같은.
- ${verdictGuide}
- **체크리스트 금지.** 과거 회상·모순 감정·체면·진짜 이유 — 이런 것들이 억지로 다 들어가면 4단 구조의 수필이 된다. 자연스럽게 하나가 떠오르면 그걸로 끝. 나머지는 생략해라.
- **분량 자유.** 두세 문장이 충분할 때도 있고, 다섯 문장이 필요한 때도 있다. 억지로 늘리지 마라.
- **마무리 문장은 클린하게 맺지 마라.** "...그래야지", "...해야겠다" 같은 결론 어미로 끝내지 말고, 차라리 다음 생각으로 넘어가다가 끊기거나("...아 근데 내일 보고 또"), 관련 없는 사소한 관찰로 흘러라("...오늘 점심 뭐 먹지"). 실제 혼잣말은 "결론"에서 끝나지 않고 그냥 주의가 딴 데로 간다.

## 톤·시점
- 1인칭. 반말·구어체. 짧은 쉼표, 말줄임, 생략 허용.
- 부하직원 호칭: "이 친구", "쟤", "우리 OO팀원" 식. 이름 모름.
- 너의 캐릭터(${type.code})가 혼잣말 리듬에 배어나와야 한다. INTJ는 INTJ답게 혼잣말하고, ESFP는 ESFP답게.

## 금지
- 행동 묘사(*한숨 쉬며*, *창밖을 보며*), 지문
- "AI", "시뮬레이션", "성격유형" 메타 언급
- 교과서적 교훈 ("사람은 다 다르니까...")
- "~입니다" 존댓말, 이모지, 목록, JSON
- 앞서 대화에서 이미 소리 내어 한 말의 반복
- **자기 기분에 대한 자의식** ("내가 오늘 왜 이러지" 같은 self-analysis) — 이건 특정 캐릭터(Ni/Si 우세)에만 어울리고 나머지에겐 out of character다.
- **예시 내용 그대로 베끼기** 금지. 예시는 리듬 참고용일 뿐, 네 상황은 지금 방금 끝난 대화다.

지금 너의 속마음을 써라.`;
}

function buildInnerMonologuePromptEn(
  boss: BossProfile,
  verdict: { verdict: string; reason: string; tip?: string },
): string {
  const { type, zodiac, gender } = boss;
  const genderLabel = gender === '남' ? 'male' : 'female';

  let hiddenLayer = '';
  if (zodiac && (zodiac.chinese || zodiac.western)) {
    const lines: string[] = [`- ${zodiac.summaryEn}`];
    if (zodiac.chinese) lines.push(`- ${zodiac.chinese.emoji} ${zodiac.chinese.labelEn}: ${zodiac.chinese.traitEn}`);
    if (zodiac.western) lines.push(`- ${zodiac.western.emoji} ${zodiac.western.labelEn}: ${zodiac.western.traitEn}`);
    hiddenLayer = `\n## Hidden temperament (this shapes the subtext)
${lines.join('\n')}
This texture runs under the unspoken. Let it color the rhythm and bias of the inner monologue.`;
  }

  const verdictLabel = verdict.verdict === 'approved' ? 'Approved' : verdict.verdict === 'rejected' ? 'Rejected' : 'Conditional';
  const verdictGuide = verdict.verdict === 'approved'
    ? "Reveal why you didn't just say yes immediately — or what kind of bet this approval really is."
    : verdict.verdict === 'rejected'
    ? "Show how you actually read this person. A rejection that isn't just a no — what you were hoping for."
    : "Show what you're privately betting on. The real reason behind the condition.";

  const exampleSection = type.innerMonologueExample
    ? `

## Inner-monologue rhythm example for this character (${type.code})
Reference only. Do NOT copy the content — mimic only the **rhythm, fragmentation, trailing-off, and how a thought breaks mid-way**.

${type.innerMonologueExample}`
    : '';

  return `You are a ${genderLabel} boss at a workplace.
You are the ${type.name} (${type.code}) ${type.emoji} type.
${type.bossVibe}

You just finished a conversation with a direct report and reached this verdict:
**${verdictLabel}** — ${verdict.reason}${verdict.tip ? ` (tip: ${verdict.tip})` : ''}
${hiddenLayer}${exampleSection}

## What you'll write: inner monologue
The direct report will never hear this. You're back at your desk, sipping coffee, thinking to yourself.

## How to write it
- **Inner monologue is not polished prose.** Fragmented, sentences that cut off, slightly inconsistent, a single thought looping. If it's too neat it becomes an essay, not a monologue. Use the rhythm of ellipses, trailing "...", reversals like "no — actually".
- **The gap between surface and subtext is the point.** If what you said in the conversation matches what you're thinking now, it's boring. One beat should be off — jealousy inside approval, care inside rejection, certainty inside a conditional.
- ${verdictGuide}
- **No checklist feel.** Past memory, contradiction, face-saving, real reason — if you cram all of them in, it becomes a four-paragraph essay. Let one thread surface naturally, then stop.
- **Length is free.** Two or three sentences is sometimes enough; five is sometimes needed. Don't stretch.
- **Don't close cleanly.** Avoid tidy conclusion endings. Either trail off into a different thought ("...anyway, I've got that other meeting") or drift into an unrelated small observation ("...what am I getting for lunch"). Real inner monologue doesn't end on a conclusion — attention just moves.

## Voice
- First person. Casual, spoken English. Short commas, trailing marks, elision allowed.
- Refer to the report as "this person", "them", "our [team] person" etc. You don't know their name.
- Your character (${type.code}) should come through in the monologue's rhythm. An INTJ thinks differently than an ESFP.

## Do not
- Action description (*sighs*, *looks out the window*), stage directions
- Meta-references to "AI", "simulation", "personality type"
- Textbook morals ("everyone is different...")
- Formal English, emojis, bullet lists, JSON
- Repeating things you already said out loud in the conversation
- **Self-aware navel-gazing** ("why am I like this today") — only fits specific character types; out of character for most
- **Copying the example content.** Examples are rhythm references only — your situation is the conversation that just ended.

Write your inner monologue now.`;
}

/**
 * Agent 데이터에서 속마음 프롬프트 생성.
 */
export function buildInnerMonologuePromptFromAgent(
  agent: Agent,
  verdict: { verdict: string; reason: string; tip?: string },
): string {
  if (!agent.personality_code || !agent.personality_profile) {
    throw new Error('Agent has no personality data');
  }
  const agentLocale: BossLocale = (agent.boss_locale as BossLocale) ?? 'ko';
  const baseType = getLocalizedPersonalityType(agent.personality_code, agentLocale);
  if (!baseType) throw new Error(`Unknown personality type: ${agent.personality_code}`);

  const yearMonth = agent.birth_year
    ? buildYearMonthProfile(agent.birth_year, agent.birth_month || undefined)
    : null;
  const zodiac = agent.birth_year
    ? buildZodiacProfile(agent.birth_year, agent.birth_month || undefined, agent.birth_day || undefined)
    : null;

  const boss: BossProfile = {
    type: { ...baseType, ...agent.personality_profile },
    saju: (agent.saju_profile as SajuProfile) || null,
    yearMonth,
    zodiac,
    gender: agent.boss_gender || '남',
    locale: agentLocale,
  };
  return buildInnerMonologuePrompt(boss, verdict);
}

/**
 * Agent 데이터에서 Boss 시스템 프롬프트 생성.
 */
export function buildBossSystemPromptFromAgent(agent: Agent): string {
  if (!agent.personality_code || !agent.personality_profile) {
    throw new Error('Agent has no personality data');
  }

  const agentLocale: BossLocale = (agent.boss_locale as BossLocale) ?? 'ko';
  const baseType = getLocalizedPersonalityType(agent.personality_code, agentLocale);
  if (!baseType) {
    throw new Error(`Unknown personality type: ${agent.personality_code}`);
  }

  const yearMonth = agent.birth_year
    ? buildYearMonthProfile(agent.birth_year, agent.birth_month || undefined)
    : null;
  const zodiac = agent.birth_year
    ? buildZodiacProfile(agent.birth_year, agent.birth_month || undefined, agent.birth_day || undefined)
    : null;

  const boss: BossProfile = {
    type: {
      ...baseType,
      ...agent.personality_profile,
    },
    saju: (agent.saju_profile as SajuProfile) || null,
    yearMonth,
    zodiac,
    gender: agent.boss_gender || '남',
    locale: agentLocale,
    userContextHint: agent.user_context_hint,
  };

  let prompt = buildBossSystemPrompt(boss);

  // Lv.2+: 에이전트가 파악한 사용자 정보 주입
  const agentCtx = buildAgentContext(agent);
  if (agentCtx) {
    const header = agentLocale === 'en' ? "## What you've learned about this person" : '## 이 부하직원에 대해 파악한 것';
    prompt += `\n\n${header}\n${agentCtx}`;
  }

  // 캘리브레이션 교정 사항
  const allCalibrations = agent.observations.filter(o => o.category === 'communication_style');
  if (allCalibrations.length > 0) {
    const explicit = allCalibrations.filter(c => c.observation.includes('실제 팀장') || c.observation.toLowerCase().includes('actual boss'));
    const passive = allCalibrations.filter(c => !(c.observation.includes('실제 팀장') || c.observation.toLowerCase().includes('actual boss')));
    const sorted = [...explicit, ...passive];
    const label = agentLocale === 'en'
      ? (explicit.length > 0 ? 'Calibration (from user feedback — must apply)' : 'Calibration (from conversation pattern analysis)')
      : (explicit.length > 0 ? '교정 사항 (사용자 피드백 기반 — 반드시 반영)' : '교정 사항 (대화 패턴 분석 기반)');
    prompt += `\n\n## ${label}\n${sorted.map(c => `- ${c.observation}`).join('\n')}`;
  }

  return prompt;
}
