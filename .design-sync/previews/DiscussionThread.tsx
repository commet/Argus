import { DiscussionThread } from 'argus';

// DiscussionThread — the stakeholders talk to EACH OTHER, not just to the user.
// Avatars connect in a vertical timeline; a "reacting_to" line shows who each
// message answers and how (동의 / 반박 / 보충 / 질문), and an optional gold
// takeaway box closes the thread. Korean role labels need the locale seeded.
if (typeof window !== 'undefined') {
  window.localStorage.setItem('sot_settings', JSON.stringify({ language: 'ko' }));
}

const now = '2026-06-15T09:00:00.000Z';
const persona = (id: string, name: string, role: string, influence: 'high' | 'medium' | 'low') => ({
  id, name, role, organization: '', priorities: '', communication_style: '',
  known_concerns: '', relationship_notes: '', influence,
  extracted_traits: [], feedback_logs: [], created_at: now, updated_at: now,
});

const personas = [
  persona('p-cfo', '김도현', 'CFO', 'high'),
  persona('p-pm', '박서연', '프로덕트 리드', 'medium'),
  persona('p-eng', '이준호', '시니어 엔지니어', 'low'),
];

const wrap: React.CSSProperties = { maxWidth: 600, padding: 24 };
const NoMotion = () => <style>{`.dt-stage .phrase-entrance > * { animation: none !important; opacity: 1 !important; }`}</style>;

// A full debate: an opening concern, a rebuttal, a build-on, and a question —
// ending on the key takeaway.
export const FullDebate = () => (
  <div className="dt-stage" style={wrap}>
    <NoMotion />
    <DiscussionThread
      personas={personas}
      messages={[
        { persona_id: 'p-cfo', type: 'question', message: '월 29만 원에 셀러가 실제로 결제할 근거가 있나요? 회수 가정이 거기서 시작합니다.' },
        { persona_id: 'p-pm', type: 'disagreement', reacting_to: 'p-cfo', message: '가격이 문제가 아니라 가치 전달이 문제예요. 첫 주에 매출 리포트 한 장만 보여주면 ARPU가 따라옵니다.' },
        { persona_id: 'p-eng', type: 'elaboration', reacting_to: 'p-pm', message: '그 리포트를 실시간으로 주려면 캐시 레이어를 먼저 분리해야 해요. 마이그레이션과 충돌하지 않게 순서를 잡겠습니다.' },
        { persona_id: 'p-cfo', type: 'agreement', reacting_to: 'p-eng', message: '순서가 보이면 됐어요. 인터뷰 10건으로 의향만 확인되면 4주 예산은 통과시키죠.' },
      ]}
      keyTakeaway="가격이 아니라 첫 주 가치 전달이 핵심 — 셀러 인터뷰 10건으로 구매 의향을 먼저 검증한다."
    />
  </div>
);

// A short two-turn exchange without a takeaway — the lighter shape.
export const ShortExchange = () => (
  <div className="dt-stage" style={wrap}>
    <NoMotion />
    <DiscussionThread
      personas={personas}
      messages={[
        { persona_id: 'p-pm', type: 'question', message: '두 명을 한 달 빼면 기존 로드맵은 어떻게 되죠?' },
        { persona_id: 'p-eng', type: 'agreement', reacting_to: 'p-pm', message: '유지보수만 남기고 신규 기능은 한 달 미루는 걸로. 그 정도는 감당돼요.' },
      ]}
    />
  </div>
);
