import { ShareBar } from 'argus';

// ShareBar — the share row that sits under a generated decision brief. It offers
// Copy (markdown), Email (mailto), and Slack. Slack connection state lives in a
// module-singleton store that defaults to disconnected, so the captured state
// shows Copy + Email + the "Slack 연결 →" link (the real first-run state). getText/
// getTitle are () => string getters carrying a realistic decision brief.

const TITLE = '[Argus] AI 고객 상담 — 이커머스 셀러 진입 결정 브리프';
const BRIEF = `# AI 고객 상담 — 이커머스 셀러 1차 진입

> 경쟁사가 시장을 열었습니다. 그런데 이커머스 셀러 자리는 비어 있어요.
> 세팅 1일 · 가격 1/3로 진입, 6개월 1,500만원, 25곳이면 흑자.

## 결재 한 줄
4주 뒤, 이커머스 셀러 한 명 앞에서 작동하는 베타를 보여드리겠습니다.

## 가장 약한 가정 (먼저 검증할 것)
이커머스 셀러가 정말 월 29만 원을 낼까 — 아직 한 명에게도 안 물어봤어요.`;

export const Default = () => (
  <ShareBar
    getText={() => BRIEF}
    getTitle={() => TITLE}
    shareContext="project_brief"
  />
);

export const CustomCopyLabel = () => (
  <ShareBar
    getText={() => BRIEF}
    getTitle={() => TITLE}
    copyLabel="브리프 복사"
    shareContext="rehearsal_result"
  />
);
