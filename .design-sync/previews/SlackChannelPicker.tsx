import { SlackChannelPicker } from 'argus';

// SlackChannelPicker — overlay (Modal) for sending a decision brief to a Slack
// channel. open=true forces it visible. The channel list comes from useSlackStore,
// whose loadChannels() needs a Supabase session + /api/slack/channels fetch — both
// inert in a standalone capture — so the modal renders its real disconnected state:
// title, search box, and the "channels not found" hint + cancel. title/content are
// realistic so the surface reads as a true share dialog. (Showing a populated
// channel list would require seeding useSlackStore — see learnings.)

export const Open = () => (
  <SlackChannelPicker
    open
    onClose={() => {}}
    title="[Argus] AI 고객 상담 — 이커머스 셀러 진입 결정 브리프"
    content={'경쟁사가 시장을 열었습니다. 이커머스 셀러 자리는 비어 있어요.\n세팅 1일 · 가격 1/3로 진입, 6개월 1,500만원, 25곳이면 흑자.'}
  />
);
