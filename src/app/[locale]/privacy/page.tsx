'use client';

import { LocaleLink } from '@/components/ui/LocaleLink';
import { ArrowLeft } from 'lucide-react';
import { useLocale } from '@/hooks/useLocale';

export default function PrivacyPage() {
  const locale = useLocale();
  const ko = locale === 'ko';
  const L = (k: string, e: string) => (ko ? k : e);

  return (
    <div className="max-w-2xl mx-auto px-5 py-12">
      <LocaleLink href="/login" className="mb-6 inline-flex min-h-11 items-center gap-1 text-[13px] text-[var(--accent)] hover:underline">
        <ArrowLeft size={14} /> {L('돌아가기', 'Back')}
      </LocaleLink>

      <h1 className="text-[24px] font-bold text-[var(--text-primary)] mb-2">{L('개인정보처리방침', 'Privacy Policy')}</h1>
      <p className="text-[13px] text-[var(--text-secondary)] mb-8">{L('최종 수정일: 2026년 7월 10일', 'Last updated: July 10, 2026')}</p>

      <div className="prose prose-sm max-w-none space-y-6 text-[14px] text-[var(--text-primary)] leading-relaxed">
        <section>
          <h2 className="text-[16px] font-bold mb-2">{L('1. 수집하는 개인정보 항목', '1. Information We Collect')}</h2>
          <table className="w-full text-[13px] border-collapse block overflow-x-auto">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="text-left py-2 pr-4 font-semibold">{L('구분', 'Type')}</th>
                <th className="text-left py-2 pr-4 font-semibold">{L('항목', 'Item')}</th>
                <th className="text-left py-2 font-semibold">{L('수집 방법', 'Method')}</th>
              </tr>
            </thead>
            <tbody className="text-[var(--text-secondary)]">
              <tr className="border-b border-[var(--border-subtle)]">
                <td className="py-2 pr-4">{L('필수', 'Required')}</td>
                <td className="py-2 pr-4">{L('이메일 주소', 'Email address')}</td>
                <td className="py-2">{L('회원가입 시 직접 입력 또는 Google OAuth', 'Provided at signup or via Google OAuth')}</td>
              </tr>
              <tr className="border-b border-[var(--border-subtle)]">
                <td className="py-2 pr-4">{L('자동 수집', 'Automatic')}</td>
                <td className="py-2 pr-4">{L('서비스 이용 기록, 접속 로그', 'Usage records, access logs')}</td>
                <td className="py-2">{L('서비스 이용 과정에서 자동 생성', 'Generated automatically during use')}</td>
              </tr>
              <tr>
                <td className="py-2 pr-4">{L('Google 로그인 시', 'Google sign-in')}</td>
                <td className="py-2 pr-4">{L('이름, 프로필 이미지 URL', 'Name, profile image URL')}</td>
                <td className="py-2">{L('Google OAuth 동의 시 제공', 'Provided upon Google OAuth consent')}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section>
          <h2 className="text-[16px] font-bold mb-2">{L('2. 개인정보의 수집 및 이용 목적', '2. Purpose of Collection and Use')}</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>{L('회원 식별 및 가입 의사 확인', 'Member identification and verification of signup intent')}</li>
            <li>{L('서비스 제공 및 기능 개선', 'Service delivery and feature improvement')}</li>
            <li>{L('서비스 이용 기록 분석 (사용 패턴 기반 AI 학습 품질 향상)', 'Analysis of usage records (improving AI quality based on usage patterns)')}</li>
            <li>{L('고객 문의 대응', 'Customer support')}</li>
          </ul>
        </section>

        <section>
          <h2 className="text-[16px] font-bold mb-2">{L('3. 개인정보의 보유 및 이용 기간', '3. Retention and Use Period')}</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>{L('회원 탈퇴 시까지 보유하며, 탈퇴 즉시 파기합니다.', 'Held until account deletion; destroyed immediately upon deletion.')}</li>
            <li>{L('관련 법령에 의해 보존이 필요한 경우, 해당 법령에서 정한 기간 동안 보관합니다.', 'When retention is required by law, kept for the period specified by that law.')}</li>
            <li>{L('전자상거래법에 따른 계약/거래 기록: 5년', 'Contract/transaction records under e-commerce law: 5 years')}</li>
            <li>{L('통신비밀보호법에 따른 접속 기록: 3개월', 'Access records under communications privacy law: 3 months')}</li>
          </ul>
        </section>

        <section>
          <h2 className="text-[16px] font-bold mb-2">{L('4. 개인정보의 제3자 제공', '4. Third-Party Sharing')}</h2>
          <p>{L(
            'Argus(이하 "회사")는 이용자의 동의 없이 개인정보를 제3자에게 제공하지 않습니다. 다만, 다음의 경우에는 예외로 합니다.',
            'Argus (hereinafter "the Company") does not share personal information with third parties without the user\'s consent. The following are exceptions.',
          )}</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>{L('법령에 의해 요구되는 경우', 'When required by law')}</li>
            <li>{L('수사 목적으로 법정 절차에 따라 요청되는 경우', 'When requested under legal procedures for investigative purposes')}</li>
          </ul>
        </section>

        <section>
          <h2 className="text-[16px] font-bold mb-2">{L('5. 개인정보 처리 위탁', '5. Data Processing Subcontractors')}</h2>
          <table className="w-full text-[13px] border-collapse block overflow-x-auto">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="text-left py-2 pr-4 font-semibold">{L('수탁 업체', 'Subcontractor')}</th>
                <th className="text-left py-2 pr-4 font-semibold">{L('위탁 업무', 'Service')}</th>
              </tr>
            </thead>
            <tbody className="text-[var(--text-secondary)]">
              <tr className="border-b border-[var(--border-subtle)]">
                <td className="py-2 pr-4">Supabase Inc.</td>
                <td className="py-2">{L('데이터 저장 및 인증 서비스', 'Data storage and authentication')}</td>
              </tr>
              <tr className="border-b border-[var(--border-subtle)]">
                <td className="py-2 pr-4">Anthropic PBC</td>
                <td className="py-2">{L('AI 분석 API 제공 (입력 데이터 처리)', 'AI analysis API (processes input data)')}</td>
              </tr>
              <tr>
                <td className="py-2 pr-4">Vercel Inc.</td>
                <td className="py-2">{L('웹 서비스 호스팅', 'Web service hosting')}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section>
          <h2 className="text-[16px] font-bold mb-2">{L('6. 이용자의 입력 데이터 처리', '6. Handling of User Input Data')}</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>{L(
              '이용자가 서비스에 입력하는 과제, 분석 결과, 피드백 등의 데이터는 이용자의 소유입니다.',
              'Data you submit to the service — tasks, analysis results, feedback — is owned by you.',
            )}</li>
            <li>{L(
              'AI 분석을 위해 Anthropic API에 전송되며, Anthropic의 데이터 정책에 따라 처리됩니다.',
              'It is sent to the Anthropic API for AI analysis and handled per Anthropic\'s data policy.',
            )}</li>
            <li>{L('회사는 이용자의 입력 데이터를 AI 모델 학습에 사용하지 않습니다.', 'The Company does not use your input data to train AI models.')}</li>
            <li>{L('이용자는 설정 페이지에서 언제든지 모든 데이터를 삭제할 수 있습니다.', 'You can delete all your data at any time from the Settings page.')}</li>
          </ul>
        </section>

        <section>
          <h2 className="text-[16px] font-bold mb-2">{L('7. MCP 도구의 익명 통계 (선택 사항)', '7. Anonymous Telemetry from the MCP Tool (Optional)')}</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>{L(
              '오픈소스 MCP 서버(argus-decision-mcp)는 기본적으로 어떤 통계도 전송하지 않습니다.',
              'The open-source MCP server (argus-decision-mcp) sends no telemetry by default.',
            )}</li>
            <li>{L(
              '이용자가 명시적으로 ARGUS_TELEMETRY=1을 설정한 경우에만, 계정·신원과 무관한 익명 통계를 전송합니다: 무작위 설치 식별자, 실행된 도구 이름과 성공 여부, 버전·OS 종류.',
              'Only when you explicitly set ARGUS_TELEMETRY=1 does it send anonymous, account-independent telemetry: a random install identifier, which tool ran and whether it succeeded, and the version and OS type.',
            )}</li>
            <li>{L(
              '결정 내용, 제목, 파일 경로, 계정 토큰 등 개인을 식별할 수 있는 정보는 전송하지 않으며, 이 데이터는 user_id 없이 익명으로만 저장됩니다.',
              'It never sends decision content, titles, file paths, or the account token — nothing that identifies you — and the data is stored anonymously, with no user_id.',
            )}</li>
            <li>{L('DO_NOT_TRACK=1을 설정하면 비활성화됩니다.', 'It is disabled when DO_NOT_TRACK=1 is set.')}</li>
          </ul>
        </section>

        <section>
          <h2 className="text-[16px] font-bold mb-2">{L('8. 이용자의 권리', '8. Your Rights')}</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>{L('개인정보 열람, 정정, 삭제를 요청할 수 있습니다.', 'You may request access, correction, or deletion of your personal information.')}</li>
            <li>{L('설정 페이지에서 직접 데이터를 내보내거나 삭제할 수 있습니다.', 'You can export or delete data yourself from the Settings page.')}</li>
            <li>{L('회원 탈퇴 시 모든 개인정보와 서비스 데이터가 즉시 삭제됩니다.', 'Upon account deletion, all personal information and service data is deleted immediately.')}</li>
          </ul>
        </section>

        <section>
          <h2 className="text-[16px] font-bold mb-2">{L('9. 개인정보의 안전성 확보 조치', '9. Security Measures')}</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>{L('비밀번호 암호화 저장 (Supabase Auth bcrypt)', 'Passwords stored encrypted (Supabase Auth bcrypt)')}</li>
            <li>{L('HTTPS 통신 암호화', 'HTTPS communication encryption')}</li>
            <li>{L('Row Level Security (RLS)를 통한 데이터 접근 통제', 'Data access controlled via Row Level Security (RLS)')}</li>
            <li>{L('관리자 접근 권한 최소화', 'Minimized admin access privileges')}</li>
          </ul>
        </section>

        <section>
          <h2 className="text-[16px] font-bold mb-2">{L('10. 개인정보 보호책임자', '10. Data Protection Officer')}</h2>
          <p>{L('개인정보 관련 문의는 아래 연락처로 접수해주세요.', 'For privacy-related inquiries, please use the contact below.')}</p>
          <p className="mt-2 text-[var(--text-secondary)]">{L('회사명: Argus', 'Company: Argus')}</p>
          <p className="text-[var(--text-secondary)]">{L('이메일: sayucurator@gmail.com', 'Email: sayucurator@gmail.com')}</p>
        </section>
      </div>
    </div>
  );
}
