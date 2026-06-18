import { FeedbackMessage } from 'argus';

// FeedbackMessage — one stakeholder reaction in the rehearsal feed: avatar +
// name + a category label (color-coded) + a tinted speech bubble. `variant`
// selects the bubble tint (praise/concern/risk-*/approval/reaction); `category`
// is a free label and is colored by a built-in KO+EN lookup.
//
// The component mounts with `opacity-0 animate-fade-in`; a static capture under
// reduced-motion would freeze it invisible, so the wrapper forces the end state.
const Stage = ({ children }: { children: React.ReactNode }) => (
  <div style={{ maxWidth: 560, padding: 24, display: 'grid', gap: 18 }}>
    <style>{`.fb-stage .animate-fade-in { animation: none !important; opacity: 1 !important; }`}</style>
    <div className="fb-stage" style={{ display: 'grid', gap: 18 }}>{children}</div>
  </div>
);

// The risk triad — the three colors the rehearsal uses to grade a concern.
export const RiskTriad = () => (
  <Stage>
    <FeedbackMessage personaName="김도현" personaId="p-cfo" category="핵심 위협" variant="risk-critical">
      월 29만 원 구독은 셀러 시장에서 검증된 적이 없어요. 회수 가정이 무너지면 수익 모델 전체가 흔들립니다.
    </FeedbackMessage>
    <FeedbackMessage personaName="이준호" personaId="p-eng" category="관리 가능" variant="risk-manageable">
      마이그레이션과 동시 진행은 부담이지만, 캐시 레이어를 먼저 분리하면 트래픽은 받을 수 있어요.
    </FeedbackMessage>
    <FeedbackMessage personaName="박서연" personaId="p-pm" category="침묵의 리스크" variant="risk-unspoken">
      아무도 말 안 하지만 — 2명을 빼면 기존 제품 장애 시 대응할 사람이 없어요.
    </FeedbackMessage>
  </Stage>
);

// Praise + approval — the warm/green end of the palette.
export const PraiseAndApproval = () => (
  <Stage>
    <FeedbackMessage personaName="박서연" personaId="p-pm" category="칭찬" variant="praise">
      "결정하게 해주는 한 장"으로 범위를 좁힌 게 정확해요. 50장 기획서였으면 아무도 안 읽었을 거예요.
    </FeedbackMessage>
    <FeedbackMessage personaName="김도현" personaId="p-cfo" category="승인 조건" variant="approval">
      셀러 인터뷰 10건으로 구매 의향만 확인되면, 4주 예산은 결재하겠습니다.
    </FeedbackMessage>
  </Stage>
);

// A neutral reaction + a plain question (English category — the label lookup is bilingual).
export const ReactionAndQuestion = () => (
  <Stage>
    <FeedbackMessage personaName="Leo" personaId="p-arch-leo" category="Overall reaction" variant="reaction">
      The reframing is sharp. My only hesitation is the 4-week timeline against an in-flight migration.
    </FeedbackMessage>
    <FeedbackMessage personaName="Grace" personaId="p-pm-grace" category="Question" variant="default">
      What happens to the existing roadmap if we pull two engineers for a month?
    </FeedbackMessage>
  </Stage>
);
