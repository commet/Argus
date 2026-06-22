'use client';

import { LocaleLink } from '@/components/ui/LocaleLink';
import { ArrowLeft } from 'lucide-react';
import { useLocale } from '@/hooks/useLocale';

export default function TermsPage() {
  const locale = useLocale();
  const ko = locale === 'ko';
  const L = (k: string, e: string) => (ko ? k : e);

  return (
    <div className="max-w-2xl mx-auto px-5 py-12">
      <LocaleLink href="/login" className="inline-flex items-center gap-1 text-[13px] text-[var(--accent)] hover:underline mb-6">
        <ArrowLeft size={14} /> {L('돌아가기', 'Back')}
      </LocaleLink>

      <h1 className="text-[24px] font-bold text-[var(--text-primary)] mb-2">{L('서비스 이용약관', 'Terms of Service')}</h1>
      <p className="text-[13px] text-[var(--text-secondary)] mb-8">{L('최종 수정일: 2026년 6월 11일', 'Last updated: June 11, 2026')}</p>

      <div className="prose prose-sm max-w-none space-y-6 text-[14px] text-[var(--text-primary)] leading-relaxed">
        <section>
          <h2 className="text-[16px] font-bold mb-2">{L('제1조 (목적)', 'Article 1 (Purpose)')}</h2>
          <p>{L(
            '이 약관은 SAYU(이하 "회사")가 운영하는 Argus(이하 "서비스")와 이를 이용하는 회원(이하 "이용자") 간의 권리, 의무 및 책임사항을 규정함을 목적으로 합니다.',
            'These Terms set out the rights, obligations, and responsibilities between SAYU (hereinafter "the Company"), which operates Argus (hereinafter "the Service"), and members who use it (hereinafter "Users").',
          )}</p>
        </section>

        <section>
          <h2 className="text-[16px] font-bold mb-2">{L('제2조 (서비스의 내용)', 'Article 2 (Service Description)')}</h2>
          <p>{L(
            '서비스는 의사결정 지원 도구로, 질문 명확화, AI 에이전트 기반 분석·검토, 이해관계자 시뮬레이션, 결정 기록 및 사후 확인 기능을 제공합니다. 서비스의 구체적인 기능과 범위는 회사의 판단에 따라 변경될 수 있습니다.',
            'The Service is a decision-support tool offering question clarification, AI-agent analysis and review, stakeholder simulation, and decision records with later follow-up. Specific features and scope may change at the Company\'s discretion.',
          )}</p>
        </section>

        <section>
          <h2 className="text-[16px] font-bold mb-2">{L('제3조 (회원가입 및 계정)', 'Article 3 (Signup and Account)')}</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>{L('이용자는 Google 계정 또는 이메일/비밀번호를 통해 가입할 수 있습니다.', 'Users may sign up via a Google account or email/password.')}</li>
            <li>{L('이용자는 정확한 정보를 제공해야 하며, 타인의 정보를 사용해서는 안 됩니다.', 'Users must provide accurate information and may not use someone else\'s information.')}</li>
            <li>{L('계정 관리 책임은 이용자에게 있으며, 비밀번호 유출로 인한 피해는 회사가 책임지지 않습니다.', 'Account management is the User\'s responsibility; the Company is not liable for damage caused by password leaks.')}</li>
          </ul>
        </section>

        <section>
          <h2 className="text-[16px] font-bold mb-2">{L('제4조 (서비스 이용 제한)', 'Article 4 (Restrictions on Use)')}</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>{L('서비스를 불법적 목적으로 사용하는 행위', 'Using the Service for unlawful purposes')}</li>
            <li>{L('서비스의 정상 운영을 방해하는 행위', 'Interfering with normal operation of the Service')}</li>
            <li>{L('타인의 개인정보를 무단으로 수집하거나 이용하는 행위', 'Collecting or using others\' personal information without authorization')}</li>
            <li>{L('서비스를 이용하여 제3자의 권리를 침해하는 행위', 'Using the Service to infringe the rights of third parties')}</li>
          </ul>
          <p className="mt-2">{L(
            '위 행위가 확인된 경우, 회사는 사전 통보 없이 서비스 이용을 제한하거나 계정을 삭제할 수 있습니다.',
            'When any of the above is confirmed, the Company may restrict use or delete the account without prior notice.',
          )}</p>
        </section>

        <section>
          <h2 className="text-[16px] font-bold mb-2">{L('제5조 (AI 생성 결과물)', 'Article 5 (AI-Generated Outputs)')}</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>{L(
              '서비스가 생성하는 AI 분석 결과는 참고 자료이며, 최종 판단과 결정의 책임은 이용자에게 있습니다.',
              'AI analysis produced by the Service is reference material; final judgment and decisions are the User\'s responsibility.',
            )}</li>
            <li>{L('AI 생성 결과물의 정확성, 완전성, 적합성을 보장하지 않습니다.', 'We do not guarantee the accuracy, completeness, or suitability of AI-generated outputs.')}</li>
            <li>{L('이용자가 서비스를 통해 입력한 데이터의 소유권은 이용자에게 있습니다.', 'Ownership of data submitted to the Service belongs to the User.')}</li>
          </ul>
        </section>

        <section>
          <h2 className="text-[16px] font-bold mb-2">{L('제6조 (서비스 변경 및 중단)', 'Article 6 (Changes and Suspension)')}</h2>
          <p>{L(
            '회사는 운영상 필요한 경우 서비스의 전부 또는 일부를 변경하거나 중단할 수 있으며, 이 경우 사전에 공지합니다. 다만, 불가피한 사유가 있는 경우 사후에 공지할 수 있습니다.',
            'The Company may change or suspend all or part of the Service when operationally necessary, with prior notice. In unavoidable cases, notice may be provided after the fact.',
          )}</p>
        </section>

        <section>
          <h2 className="text-[16px] font-bold mb-2">{L('제7조 (면책)', 'Article 7 (Disclaimers)')}</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>{L('천재지변, 전쟁 등 불가항력으로 인한 서비스 중단에 대해 책임지지 않습니다.', 'Not liable for service interruption due to force majeure such as natural disasters or war.')}</li>
            <li>{L('이용자의 귀책사유로 인한 서비스 이용 장애에 대해 책임지지 않습니다.', 'Not liable for service issues caused by the User.')}</li>
            <li>{L('서비스를 통해 얻은 정보에 기반한 이용자의 의사결정에 대해 책임지지 않습니다.', 'Not liable for User decisions based on information obtained through the Service.')}</li>
          </ul>
        </section>

        <section>
          <h2 className="text-[16px] font-bold mb-2">{L('제8조 (분쟁 해결)', 'Article 8 (Dispute Resolution)')}</h2>
          <p>{L(
            '이 약관에 관한 분쟁은 대한민국 법률에 따르며, 민사소송법에 따른 관할 법원에서 해결합니다.',
            'Disputes regarding these Terms are governed by the laws of the Republic of Korea and resolved in the competent courts under the Civil Procedure Act.',
          )}</p>
        </section>
      </div>
    </div>
  );
}
