// One-shot delivery test for the check-in reminder sender fix.
//
// WHY: checkin-due previously sent from Resend's sandbox address
// (onboarding@resend.dev), which only delivers to the Resend account owner —
// so real subscribers never got the reminder. We switched it to the verified
// argus.voyage domain with reply-to = the founder's gmail. This proves a real
// non-owner recipient (e.g. time22say@gmail.com) actually receives it.
//
// USAGE (PowerShell):
//   $env:RESEND_API_KEY="re_xxx"; node scripts/test-checkin-email.mjs time22say@gmail.com
// USAGE (bash):
//   RESEND_API_KEY=re_xxx node scripts/test-checkin-email.mjs time22say@gmail.com
//
// Optional overrides: EMAIL_FROM_DOMAIN (default argus.voyage),
//                     EMAIL_REPLY_TO    (default sayucurator@gmail.com)

import { Resend } from 'resend';

const apiKey = process.env.RESEND_API_KEY;
if (!apiKey) {
  console.error('✗ RESEND_API_KEY is not set. Get it from resend.com → API Keys, then re-run.');
  process.exit(1);
}

const to = process.argv[2] || 'time22say@gmail.com';
const fromDomain = process.env.EMAIL_FROM_DOMAIN || 'argus.voyage';
const replyTo = process.env.EMAIL_REPLY_TO || 'sayucurator@gmail.com';
const from = `Argus <hello@${fromDomain}>`;

console.log(`→ sending test reminder\n  from:    ${from}\n  replyTo: ${replyTo}\n  to:      ${to}\n`);

const resend = new Resend(apiKey);
const { data, error } = await resend.emails.send({
  from,
  replyTo,
  to,
  subject: '그래서, 어떻게 됐어요? — (Argus 배달 테스트)',
  html: `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;color:#1a1a1a">
      <p style="font-size:18px;font-weight:700;margin:0 0 12px">배달 테스트 ✓</p>
      <p style="font-size:14px;color:#57534e;line-height:1.6;margin:0 0 8px">이 메일이 보이면 체크인 리마인더 발신자 수정이 성공한 거예요. (인증된 argus.voyage 도메인에서 발송)</p>
      <p style="font-size:13px;color:#78716c;line-height:1.5;margin:0 0 16px">이 메일에 <b>답장</b>하면 ${replyTo} 로 갑니다.</p>
    </div>`,
});

if (error) {
  console.error('✗ FAILED:', JSON.stringify(error, null, 2));
  console.error('\n힌트: "domain is not verified" 류 에러면 argus.voyage가 Resend에 아직 인증 안 된 것. resend.com → Domains 에서 argus.voyage 인증 상태를 확인하세요.');
  process.exit(1);
}
console.log('✓ SENT. Resend id:', data?.id);
console.log(`\n${to} 받은편지함(+스팸함)을 확인하세요. 보이면 진짜 사용자에게도 배달됩니다.`);
