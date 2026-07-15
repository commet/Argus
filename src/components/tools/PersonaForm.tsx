'use client';

import { useState, useRef } from 'react';
import { Field } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { AnimatedPlaceholder } from '@/components/ui/AnimatedPlaceholder';
import { callLLMJson } from '@/lib/llm';
import { useLocale } from '@/hooks/useLocale';
import { getCurrentLanguage } from '@/lib/i18n';
import type { Persona } from '@/stores/types';
import { Sparkles, Loader2, Check, Pencil, Upload, ChevronRight, ChevronLeft, FileText, UserCircle } from 'lucide-react';

interface PersonaFormProps {
  persona?: Partial<Persona>;
  onSave: (data: Partial<Persona>) => void;
  onCancel: () => void;
}

// ─── Presets & Trait Options ───

interface RolePreset {
  emoji: string;
  label: string;
  role: string;
  traitDefaults: {
    priorities: string[];
    styles: string[];
    concerns: string[];
    traits: string[];
  };
}

const buildRolePresets = (L: (ko: string, en: string) => string): RolePreset[] => [
  {
    emoji: '👔', label: L('CEO / 대표', 'CEO / Founder'), role: 'CEO',
    traitDefaults: {
      priorities: [
        L('시장 기회와 성장', 'Market opportunity & growth'),
        L('비전과 전략 방향', 'Vision & strategic direction'),
        L('투자자/이사회 관리', 'Investor / board management'),
        L('경쟁 포지셔닝', 'Competitive positioning'),
        L('팀 빌딩과 문화', 'Team building & culture'),
      ],
      styles: [
        L('큰 그림부터 듣고 싶어함', 'Wants the big picture first'),
        L('한 페이지 요약 선호', 'Prefers one-page summaries'),
        L('임팩트 중심 소통', 'Impact-driven communication'),
        L('빠른 판단을 선호', 'Prefers quick decisions'),
        L('비유와 스토리에 반응', 'Responds to analogies & stories'),
      ],
      concerns: [
        L('매출 성장률 둔화', 'Slowing revenue growth'),
        L('경쟁사 동향', 'Competitor moves'),
        L('핵심 인재 이탈', 'Key talent leaving'),
        L('시장 타이밍', 'Market timing'),
        L('브랜드 이미지', 'Brand image'),
      ],
      traits: [
        L('비전 중심', 'Vision-driven'),
        L('빠른 판단', 'Fast decisions'),
        L('임팩트 지향', 'Impact-oriented'),
        L('직관적', 'Intuitive'),
      ],
    },
  },
  {
    emoji: '📊', label: L('CFO / 재무', 'CFO / Finance'), role: 'CFO',
    traitDefaults: {
      priorities: [
        L('ROI와 비용 효율', 'ROI & cost efficiency'),
        L('정량적 근거', 'Quantitative evidence'),
        L('리스크 관리', 'Risk management'),
        L('현금 흐름', 'Cash flow'),
        L('재무 모델링', 'Financial modeling'),
      ],
      styles: [
        L('숫자로 말하기', 'Speaks in numbers'),
        L('결론부터', 'Conclusion first'),
        L('3페이지 이상 안 읽음', "Won't read past 3 pages"),
        L('근거 출처 요구', 'Requires source citations'),
        L('테이블/차트 선호', 'Prefers tables / charts'),
      ],
      concerns: [
        L('비용 초과', 'Cost overruns'),
        L('투자 대비 수익', 'Return on investment'),
        L('현금 흐름 압박', 'Cash flow pressure'),
        L('규제/컴플라이언스', 'Regulation / compliance'),
        L('예산 삭감 압력', 'Budget cut pressure'),
      ],
      traits: [
        L('숫자 중심', 'Numbers-driven'),
        L('보수적', 'Conservative'),
        L('근거 요구', 'Demands evidence'),
        L('리스크 민감', 'Risk-sensitive'),
      ],
    },
  },
  {
    emoji: '⚙️', label: L('CTO / 기술', 'CTO / Tech'), role: 'CTO',
    traitDefaults: {
      priorities: [
        L('기술 실현 가능성', 'Technical feasibility'),
        L('확장성/유지보수', 'Scalability / maintainability'),
        L('기술 부채 관리', 'Tech debt management'),
        L('보안', 'Security'),
        L('팀 생산성', 'Team productivity'),
      ],
      styles: [
        L('구체적 스펙 기반', 'Spec-based'),
        L('아키텍처 다이어그램', 'Architecture diagrams'),
        L('트레이드오프 분석', 'Tradeoff analysis'),
        L('POC 먼저', 'POC first'),
        L('비동기 소통 선호', 'Prefers async communication'),
      ],
      concerns: [
        L('기술 부채 누적', 'Accumulating tech debt'),
        L('시스템 안정성', 'System stability'),
        L('채용 난이도', 'Hiring difficulty'),
        L('레거시 마이그레이션', 'Legacy migration'),
        L('보안 취약점', 'Security vulnerabilities'),
      ],
      traits: [
        L('기술 깊이', 'Technical depth'),
        L('시스템 사고', 'Systems thinking'),
        L('리스크 민감', 'Risk-sensitive'),
        L('실용적', 'Pragmatic'),
      ],
    },
  },
  {
    emoji: '📢', label: L('마케팅 리드', 'Marketing Lead'), role: L('마케팅 디렉터', 'Marketing Director'),
    traitDefaults: {
      priorities: [
        L('고객 관점', 'Customer perspective'),
        L('브랜드 일관성', 'Brand consistency'),
        L('채널별 ROI', 'Channel-level ROI'),
        L('시장 트렌드', 'Market trends'),
        L('경쟁사 분석', 'Competitor analysis'),
      ],
      styles: [
        L('데이터 + 스토리', 'Data + story'),
        L('시각적 자료 선호', 'Prefers visual assets'),
        L('고객 사례 기반', 'Customer-case-based'),
        L('트렌드 레퍼런스', 'Trend references'),
        L('A/B 테스트 지향', 'A/B test oriented'),
      ],
      concerns: [
        L('CAC 상승', 'Rising CAC'),
        L('전환율 하락', 'Dropping conversion'),
        L('브랜드 인지도', 'Brand awareness'),
        L('채널 포화', 'Channel saturation'),
        L('경쟁사 공격적 마케팅', 'Aggressive competitor marketing'),
      ],
      traits: [
        L('고객 중심', 'Customer-centric'),
        L('데이터 드리븐', 'Data-driven'),
        L('트렌드 민감', 'Trend-sensitive'),
        L('크리에이티브', 'Creative'),
      ],
    },
  },
  {
    emoji: '💰', label: L('투자자 / VC', 'Investor / VC'), role: L('투자자', 'Investor'),
    traitDefaults: {
      priorities: [
        L('시장 규모 (TAM/SAM)', 'Market size (TAM/SAM)'),
        L('성장 지표', 'Growth metrics'),
        L('Exit 전략', 'Exit strategy'),
        L('팀 역량', 'Team capability'),
        L('유닛 이코노믹스', 'Unit economics'),
      ],
      styles: [
        L('핵심 지표 위주', 'Key-metric focused'),
        L('벤치마크 비교', 'Benchmark comparison'),
        L('간결한 덱', 'Concise decks'),
        L('포트폴리오 시너지', 'Portfolio synergy'),
        L('레퍼런스 체크', 'Reference checks'),
      ],
      concerns: [
        L('번레이트', 'Burn rate'),
        L('경쟁 우위 지속성', 'Defensibility'),
        L('시장 타이밍', 'Market timing'),
        L('팀 실행력', 'Team execution'),
        L('규제 리스크', 'Regulatory risk'),
      ],
      traits: [
        L('지표 중심', 'Metrics-focused'),
        L('비교 분석', 'Comparative analysis'),
        L('스케일 지향', 'Scale-oriented'),
        L('패턴 매칭', 'Pattern matching'),
      ],
    },
  },
  {
    emoji: '🤝', label: L('클라이언트', 'Client'), role: L('클라이언트 담당자', 'Client contact'),
    traitDefaults: {
      priorities: [
        L('납기와 품질', 'Deadline & quality'),
        L('비용 대비 가치', 'Value for money'),
        L('소통 투명성', 'Communication transparency'),
        L('리스크 사전 공유', 'Early risk disclosure'),
        L('실무적 산출물', 'Practical deliverables'),
      ],
      styles: [
        L('정기 진행 업데이트', 'Regular progress updates'),
        L('리스크 사전 공유', 'Share risks early'),
        L('실무적 언어', 'Practical language'),
        L('문서화 중시', 'Values documentation'),
        L('마일스톤 기반', 'Milestone-based'),
      ],
      concerns: [
        L('일정 지연', 'Schedule delays'),
        L('스코프 크리프', 'Scope creep'),
        L('품질 이슈', 'Quality issues'),
        L('담당자 교체', 'Contact changes'),
        L('예산 초과', 'Budget overrun'),
      ],
      traits: [
        L('실용적', 'Practical'),
        L('일정 민감', 'Schedule-sensitive'),
        L('신뢰 중시', 'Trust-focused'),
        L('결과 지향', 'Results-oriented'),
      ],
    },
  },
];

const STRUCTURE_PROMPT_KO = `사용자가 특정 이해관계자에 대해 자유롭게 작성한 텍스트를 읽고, 아래 JSON 구조로 정리하세요. 텍스트에 명시된 정보만 추출하세요. JSON만 출력.

{
  "name": "",
  "role": "",
  "organization": "",
  "priorities": "",
  "communication_style": "",
  "known_concerns": "",
  "relationship_notes": "",
  "extracted_traits": []
}

extracted_traits는 핵심 성향 2~4개의 짧은 키워드.`;

const STRUCTURE_PROMPT_EN = `Read the free-form text the user wrote about a particular stakeholder and organize it into the JSON structure below. Only extract information stated in the text. Output JSON only.

{
  "name": "",
  "role": "",
  "organization": "",
  "priorities": "",
  "communication_style": "",
  "known_concerns": "",
  "relationship_notes": "",
  "extracted_traits": []
}

extracted_traits is 2-4 short keywords for the core traits.`;

function getStructurePrompt(): string {
  return getCurrentLanguage() === 'ko' ? STRUCTURE_PROMPT_KO : STRUCTURE_PROMPT_EN;
}

const FILE_ANALYZE_PROMPT_KO = `아래 텍스트(회의록, 이메일, 채팅 등)에서 핵심 의사결정자 1명의 성향, 패턴, 스타일을 분석하여 페르소나 프로필을 생성하세요. JSON만 출력.

{
  "name": "",
  "role": "",
  "organization": "",
  "priorities": "",
  "communication_style": "",
  "known_concerns": "",
  "relationship_notes": "",
  "extracted_traits": []
}`;

const FILE_ANALYZE_PROMPT_EN = `From the text below (meeting notes, emails, chats, etc.), analyze the traits, patterns, and style of one key decision-maker and generate a persona profile. Output JSON only.

{
  "name": "",
  "role": "",
  "organization": "",
  "priorities": "",
  "communication_style": "",
  "known_concerns": "",
  "relationship_notes": "",
  "extracted_traits": []
}`;

function getFileAnalyzePrompt(): string {
  return getCurrentLanguage() === 'ko' ? FILE_ANALYZE_PROMPT_KO : FILE_ANALYZE_PROMPT_EN;
}

// ─── Chip Selector Sub-component ───

function ChipSelector({
  label,
  options,
  selected,
  onToggle,
  customValue,
  onCustomChange,
  customPlaceholder,
}: {
  label: string;
  options: string[];
  selected: string[];
  onToggle: (option: string) => void;
  customValue: string;
  onCustomChange: (val: string) => void;
  customPlaceholder: string;
}) {
  return (
    <div>
      <label className="text-[13px] font-bold text-[var(--text-primary)] mb-2 block">{label}</label>
      <div className="flex flex-wrap gap-2 mb-2">
        {options.map((opt) => {
          const isSelected = selected.includes(opt);
          return (
            <button
              key={opt}
              onClick={() => onToggle(opt)}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-medium border transition-all cursor-pointer ${
                isSelected
                  ? 'border-[var(--accent)] bg-[var(--ai)] text-[var(--text-primary)] shadow-sm'
                  : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--text-primary)]'
              }`}
            >
              {isSelected && <Check size={10} className="inline mr-1" />}
              {opt}
            </button>
          );
        })}
      </div>
      <input
        type="text"
        value={customValue}
        onChange={(e) => onCustomChange(e.target.value)}
        placeholder={customPlaceholder}
        className="w-full bg-[var(--bg)] border border-dashed border-[var(--border)] rounded-lg px-3 py-2 text-[12px] text-[var(--text-secondary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)]"
      />
    </div>
  );
}

// ─── Main Form ───

type Step = 'method' | 'preset' | 'configurator' | 'freetext' | 'structuring' | 'review';

export function PersonaForm({ persona, onSave, onCancel }: PersonaFormProps) {
  const locale = useLocale();
  const L = (ko: string, en: string) => locale === 'ko' ? ko : en;
  const ROLE_PRESETS = buildRolePresets(L);

  const [step, setStep] = useState<Step>(persona?.name ? 'review' : 'method');
  const [selectedPreset, setSelectedPreset] = useState<RolePreset | null>(null);

  // Configurator state
  const [configStep, setConfigStep] = useState(0);
  const [selectedPriorities, setSelectedPriorities] = useState<string[]>([]);
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const [selectedConcerns, setSelectedConcerns] = useState<string[]>([]);
  const [selectedTraits, setSelectedTraits] = useState<string[]>([]);
  const [customPriority, setCustomPriority] = useState('');
  const [customStyle, setCustomStyle] = useState('');
  const [customConcern, setCustomConcern] = useState('');

  // Free text state
  const [freeText, setFreeText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Final form state
  const [form, setForm] = useState({
    name: persona?.name || '',
    role: persona?.role || '',
    organization: persona?.organization || '',
    priorities: persona?.priorities || '',
    communication_style: persona?.communication_style || '',
    known_concerns: persona?.known_concerns || '',
    relationship_notes: persona?.relationship_notes || '',
    extracted_traits: persona?.extracted_traits || [] as string[],
    decision_style: persona?.decision_style as Persona['decision_style'],
    risk_tolerance: persona?.risk_tolerance as Persona['risk_tolerance'],
    success_metric: persona?.success_metric || '',
    contact: persona?.contact as { email?: string; slack_id?: string } | undefined,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Toggle a chip selection
  const toggleItem = (list: string[], setList: (l: string[]) => void, item: string) => {
    setList(list.includes(item) ? list.filter((i) => i !== item) : [...list, item]);
  };

  // Handle preset selection → enter configurator
  const handlePresetSelect = (preset: RolePreset) => {
    setSelectedPreset(preset);
    setSelectedPriorities([]);
    setSelectedStyles([]);
    setSelectedConcerns([]);
    setSelectedTraits([]);
    setConfigStep(0);
    setStep('configurator');
  };

  // Finish configurator → go to review
  const finishConfigurator = () => {
    if (!selectedPreset) return;
    const allPriorities = [...selectedPriorities, ...(customPriority ? [customPriority] : [])];
    const allStyles = [...selectedStyles, ...(customStyle ? [customStyle] : [])];
    const allConcerns = [...selectedConcerns, ...(customConcern ? [customConcern] : [])];

    setForm({
      name: '',
      role: selectedPreset.role,
      organization: '',
      priorities: allPriorities.join('. '),
      communication_style: allStyles.join('. '),
      known_concerns: allConcerns.join('. '),
      relationship_notes: '',
      extracted_traits: selectedTraits.length > 0 ? selectedTraits : selectedPreset.traitDefaults.traits.slice(0, 3),
      decision_style: undefined,
      risk_tolerance: undefined,
      success_metric: '',
      contact: undefined,
    });
    setStep('review');
  };

  // Free text → AI structure
  const handleFreeTextStructure = async () => {
    if (!freeText.trim()) return;
    setLoading(true);
    setError('');
    setStep('structuring');
    try {
      const result = await callLLMJson<Record<string, unknown>>(
        [{ role: 'user', content: freeText }],
        { system: getStructurePrompt(), maxTokens: 1000, shape: { extracted_traits: 'array' } }
      );
      setForm({
        name: (result.name as string) || '',
        role: (result.role as string) || '',
        organization: (result.organization as string) || '',
        priorities: (result.priorities as string) || '',
        communication_style: (result.communication_style as string) || '',
        known_concerns: (result.known_concerns as string) || '',
        relationship_notes: (result.relationship_notes as string) || '',
        extracted_traits: (result.extracted_traits as string[]) || [],
        decision_style: undefined,
        risk_tolerance: undefined,
        success_metric: '',
        contact: undefined,
      });
      setStep('review');
    } catch (err) {
      setError(err instanceof Error ? err.message : L('AI 구조화에 실패했습니다.', 'AI structuring failed.'));
      setStep('freetext');
    } finally {
      setLoading(false);
    }
  };

  // File upload → AI analyze
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setError('');
    setStep('structuring');
    try {
      const text = await file.text();
      const result = await callLLMJson<Record<string, unknown>>(
        [{ role: 'user', content: text }],
        { system: getFileAnalyzePrompt(), maxTokens: 1000, shape: { extracted_traits: 'array' } }
      );
      setForm({
        name: (result.name as string) || '',
        role: (result.role as string) || '',
        organization: (result.organization as string) || '',
        priorities: (result.priorities as string) || '',
        communication_style: (result.communication_style as string) || '',
        known_concerns: (result.known_concerns as string) || '',
        relationship_notes: (result.relationship_notes as string) || '',
        extracted_traits: (result.extracted_traits as string[]) || [],
        decision_style: undefined,
        risk_tolerance: undefined,
        success_metric: '',
        contact: undefined,
      });
      setStep('review');
    } catch (err) {
      setError(err instanceof Error ? err.message : L('파일 분석에 실패했습니다.', 'File analysis failed.'));
      setStep('method');
    } finally {
      setLoading(false);
    }
  };

  const handleFieldChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const configSteps = selectedPreset
    ? [
        {
          label: L('우선순위', 'Priorities'),
          desc: L(`이 ${selectedPreset.label}이 가장 중요하게 보는 것은?`, `What does this ${selectedPreset.label} care about most?`),
          options: selectedPreset.traitDefaults.priorities,
          selected: selectedPriorities,
          onToggle: (item: string) => toggleItem(selectedPriorities, setSelectedPriorities, item),
          custom: customPriority,
          onCustom: setCustomPriority,
        },
        {
          label: L('커뮤니케이션 스타일', 'Communication style'),
          desc: L('어떻게 소통하는 것을 선호하나요?', 'How do they prefer to communicate?'),
          options: selectedPreset.traitDefaults.styles,
          selected: selectedStyles,
          onToggle: (item: string) => toggleItem(selectedStyles, setSelectedStyles, item),
          custom: customStyle,
          onCustom: setCustomStyle,
        },
        {
          label: L('최근 관심사/우려', 'Recent concerns'),
          desc: L('요즘 이 사람이 신경 쓰는 것은?', "What's on their mind lately?"),
          options: selectedPreset.traitDefaults.concerns,
          selected: selectedConcerns,
          onToggle: (item: string) => toggleItem(selectedConcerns, setSelectedConcerns, item),
          custom: customConcern,
          onCustom: setCustomConcern,
        },
        {
          label: L('핵심 성향', 'Core traits'),
          desc: L('이 사람을 한마디로 표현하면?', 'How would you describe them in a word?'),
          options: selectedPreset.traitDefaults.traits,
          selected: selectedTraits,
          onToggle: (item: string) => toggleItem(selectedTraits, setSelectedTraits, item),
          custom: '',
          onCustom: () => {},
        },
      ]
    : [];

  return (
    <div className="space-y-4">

      {/* ── METHOD SELECTION ── */}
      {step === 'method' && (
        <div className="space-y-3">
          <h3 className="text-[15px] font-bold text-[var(--text-primary)]">{L('어떻게 만들까요?', 'How should we build it?')}</h3>

          <button onClick={() => setStep('preset')}
            className="w-full flex items-center gap-3 p-4 rounded-xl border border-[var(--border)] hover:border-[var(--accent)] hover:bg-[var(--ai)]/30 transition-all text-left cursor-pointer group">
            <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center shrink-0">
              <UserCircle size={20} className="text-purple-600" />
            </div>
            <div className="flex-1">
              <p className="text-[14px] font-semibold text-[var(--text-primary)]">{L('유형에서 시작', 'Start from a role')}</p>
              <p className="text-[12px] text-[var(--text-secondary)]">{L('CEO, CFO 등 선택 후 성향을 클릭으로 조합', 'Pick CEO, CFO, etc. and compose traits by clicking')}</p>
            </div>
            <ChevronRight size={16} className="text-[var(--text-secondary)] group-hover:text-[var(--accent)]" />
          </button>

          <button onClick={() => setStep('freetext')}
            className="w-full flex items-center gap-3 p-4 rounded-xl border border-[var(--border)] hover:border-[var(--accent)] hover:bg-[var(--ai)]/30 transition-all text-left cursor-pointer group">
            <div className="w-10 h-10 rounded-xl bg-[var(--ai)] flex items-center justify-center shrink-0">
              <Sparkles size={20} className="text-[var(--ai-fg)]" />
            </div>
            <div className="flex-1">
              <p className="text-[14px] font-semibold text-[var(--text-primary)]">{L('자유롭게 설명', 'Describe freely')}</p>
              <p className="text-[12px] text-[var(--text-secondary)]">{L('아는 것을 적으면 프로필로 구조화됩니다', 'Write what you know — we structure it into a profile')}</p>
            </div>
            <ChevronRight size={16} className="text-[var(--text-secondary)] group-hover:text-[var(--accent)]" />
          </button>

          <button onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center gap-3 p-4 rounded-xl border border-[var(--border)] hover:border-[var(--accent)] hover:bg-[var(--ai)]/30 transition-all text-left cursor-pointer group">
            <div className="w-10 h-10 rounded-xl bg-[var(--human)] flex items-center justify-center shrink-0">
              <FileText size={20} className="text-[var(--human-fg)]" />
            </div>
            <div className="flex-1">
              <p className="text-[14px] font-semibold text-[var(--text-primary)]">{L('파일에서 분석', 'Analyze from file')}</p>
              <p className="text-[12px] text-[var(--text-secondary)]">{L('회의록, 이메일, 채팅에서 자동 추출', 'Auto-extract from meeting notes, emails, chats')}</p>
            </div>
            <ChevronRight size={16} className="text-[var(--text-secondary)] group-hover:text-[var(--accent)]" />
          </button>
          <input ref={fileInputRef} type="file" accept=".txt,.md,.csv" onChange={handleFileUpload} className="hidden" />

          <button onClick={() => setStep('review')}
            className="w-full flex items-center gap-3 p-3 text-[13px] text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors cursor-pointer">
            <Pencil size={14} /> {L('직접 입력하기', 'Enter manually')}
          </button>
        </div>
      )}

      {/* ── PRESET SELECTION ── */}
      {step === 'preset' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-[15px] font-bold text-[var(--text-primary)]">{L('어떤 유형인가요?', 'Which role?')}</h3>
            <button onClick={() => setStep('method')} className="text-[12px] text-[var(--accent)] cursor-pointer hover:underline">{L('뒤로', 'Back')}</button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {ROLE_PRESETS.map((preset) => (
              <button
                key={preset.role}
                onClick={() => handlePresetSelect(preset)}
                className="flex flex-col items-center gap-1.5 p-4 rounded-xl border border-[var(--border)] hover:border-[var(--accent)] hover:bg-[var(--ai)]/30 transition-all cursor-pointer"
              >
                <span className="text-[28px]">{preset.emoji}</span>
                <span className="text-[13px] font-semibold text-[var(--text-primary)]">{preset.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── TRAIT CONFIGURATOR ── */}
      {step === 'configurator' && selectedPreset && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <h3 className="text-[15px] font-bold text-[var(--text-primary)]">
              {selectedPreset.emoji} {L(`${selectedPreset.label} 페르소나 설정`, `Configure ${selectedPreset.label} persona`)}
            </h3>
            <button onClick={() => setStep('preset')} className="text-[12px] text-[var(--accent)] cursor-pointer hover:underline">{L('유형 변경', 'Change role')}</button>
          </div>

          {/* Progress dots */}
          <div className="flex items-center gap-1.5 justify-center">
            {configSteps.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === configStep ? 'w-6 bg-[var(--accent)]' : i < configStep ? 'w-1.5 bg-[var(--success)]' : 'w-1.5 bg-[var(--border)]'
                }`}
              />
            ))}
          </div>

          {/* Current config step */}
          <div className="animate-fade-in" key={configStep}>
            <p className="text-[13px] text-[var(--text-secondary)] mb-3">
              {configSteps[configStep].desc}
            </p>
            <ChipSelector
              label={configSteps[configStep].label}
              options={configSteps[configStep].options}
              selected={configSteps[configStep].selected}
              onToggle={configSteps[configStep].onToggle}
              customValue={configSteps[configStep].custom}
              onCustomChange={configSteps[configStep].onCustom}
              customPlaceholder={L('+ 직접 추가...', '+ Add your own...')}
            />
          </div>

          {/* Navigation */}
          <div className="flex justify-between pt-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setConfigStep(Math.max(0, configStep - 1))}
              disabled={configStep === 0}
            >
              <ChevronLeft size={14} /> {L('이전', 'Previous')}
            </Button>
            {configStep < configSteps.length - 1 ? (
              <Button size="sm" onClick={() => setConfigStep(configStep + 1)}>
                {L('다음', 'Next')} <ChevronRight size={14} />
              </Button>
            ) : (
              <Button size="sm" onClick={finishConfigurator}>
                <Check size={14} /> {L('완료', 'Done')}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* ── FREE TEXT ── */}
      {step === 'freetext' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-[15px] font-bold text-[var(--text-primary)]">{L('이 사람에 대해 자유롭게 적어주세요', 'Describe this person freely')}</h3>
            <button onClick={() => setStep('method')} className="text-[12px] text-[var(--accent)] cursor-pointer hover:underline">{L('뒤로', 'Back')}</button>
          </div>
          <p className="text-[12px] text-[var(--text-secondary)]">{L('이름, 직책, 성격, 의사결정 스타일, 최근 관심사 — 무엇이든.', 'Name, role, personality, decision style, recent concerns — anything.')}</p>
          <div className="relative">
            <AnimatedPlaceholder
              texts={locale === 'ko' ? [
                '김 상무님은 CFO입니다. ROI를 최우선시하고, 결론부터 듣고 싶어합니다.',
                '박 대표님은 비전형 리더입니다. 큰 그림을 먼저 보고, 시장 기회를 놓치면 안 된다고 강조합니다.',
                '이 팀장은 기술 출신입니다. 실현 가능성과 구체적 스펙을 먼저 확인하려 합니다.',
                '정 이사님은 투자자입니다. 유닛 이코노믹스와 시장 규모부터 봅니다.',
                '최 부장은 클라이언트 측 PM입니다. 납기와 리스크 사전 공유를 중시합니다.',
              ] : [
                'Director Kim is our CFO. ROI comes first, and they want the conclusion up front.',
                'CEO Park is a visionary leader. They look at the big picture first and stress not missing market opportunities.',
                'Team lead Lee has an engineering background. They check feasibility and concrete specs first.',
                'Director Jung is an investor. They look at unit economics and market size first.',
                'Manager Choi is the PM on the client side. They value delivery timelines and sharing risks early.',
              ]}
              visible={!freeText.trim()}
              className="absolute left-4 top-3 text-[14px] text-[var(--text-secondary)] leading-[1.7] max-w-[calc(100%-2rem)] truncate"
            />
            <textarea
              value={freeText}
              onChange={(e) => setFreeText(e.target.value)}
              className="w-full bg-[var(--bg)] border-[1.5px] border-[var(--border)] rounded-[10px] px-4 py-3 text-[15px] leading-[1.7] placeholder:text-[var(--text-secondary)] placeholder:text-[14px] focus:outline-none focus:border-[var(--accent)] resize-none"
              rows={5}
              maxLength={2000}
            />
          </div>
          {error && <p className="text-[13px] text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
          <div className="flex justify-end">
            <Button onClick={handleFreeTextStructure} disabled={!freeText.trim() || loading}>
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              {L('AI로 정리하기', 'Structure with AI')}
            </Button>
          </div>
        </div>
      )}

      {/* ── STRUCTURING (Loading) ── */}
      {step === 'structuring' && (
        <div className="text-center py-8 space-y-3">
          <Loader2 size={28} className="mx-auto animate-spin text-[var(--accent)]" />
          <p className="text-[14px] text-[var(--text-secondary)]">{L('페르소나를 구조화하고 있습니다...', 'Structuring persona...')}</p>
        </div>
      )}

      {/* ── REVIEW & EDIT ── */}
      {step === 'review' && (
        <div className="space-y-3 animate-fade-in">
          {!persona?.name && (
            <div className="flex items-center justify-between">
              <h3 className="text-[15px] font-bold text-[var(--text-primary)]">{L('프로필 확인 및 수정', 'Review & edit profile')}</h3>
              <button onClick={() => setStep('method')} className="text-[12px] text-[var(--accent)] cursor-pointer hover:underline">{L('다른 방법으로', 'Try another method')}</button>
            </div>
          )}
          {form.extracted_traits.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-1">
              {form.extracted_traits.map((trait, i) => (
                <Badge key={i} variant="ai">{trait}</Badge>
              ))}
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[13px] font-semibold">{L('이름 *', 'Name *')}</label>
              <input type="text" value={form.name} onChange={(e) => handleFieldChange('name', e.target.value)} placeholder={L('실명 또는 별칭', 'Real name or alias')} maxLength={50}
                className="bg-[var(--bg)] border-[1.5px] border-[var(--border)] rounded-[10px] px-3 py-2 text-[14px] focus:outline-none focus:border-[var(--accent)]" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[13px] font-semibold">{L('역할 *', 'Role *')}</label>
              <input type="text" value={form.role} onChange={(e) => handleFieldChange('role', e.target.value)} placeholder={L('직책/역할', 'Title / role')} maxLength={80}
                className="bg-[var(--bg)] border-[1.5px] border-[var(--border)] rounded-[10px] px-3 py-2 text-[14px] focus:outline-none focus:border-[var(--accent)]" />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[13px] font-semibold">{L('소속', 'Organization')}</label>
            <input type="text" value={form.organization} onChange={(e) => handleFieldChange('organization', e.target.value)} placeholder={L('우리 회사 / 투자사 / 고객사', 'Our company / investor / client')} maxLength={80}
              className="bg-[var(--bg)] border-[1.5px] border-[var(--border)] rounded-[10px] px-3 py-2 text-[14px] focus:outline-none focus:border-[var(--accent)]" />
          </div>
          <Field label={L('우선순위 *', 'Priorities *')} placeholder={L('이 사람이 가장 중요하게 보는 것', 'What this person cares about most')} maxLength={300}
            value={form.priorities} onChange={(e) => handleFieldChange('priorities', e.target.value)} />
          <Field label={L('커뮤니케이션 스타일', 'Communication style')} placeholder={L('선호하는 보고/소통 방식', 'Preferred reporting / communication')} maxLength={300}
            value={form.communication_style} onChange={(e) => handleFieldChange('communication_style', e.target.value)} />
          <Field label={L('최근 관심사/우려', 'Recent concerns')} placeholder={L('요즘 신경 쓰는 것', "What's on their mind lately")} maxLength={300}
            value={form.known_concerns} onChange={(e) => handleFieldChange('known_concerns', e.target.value)} />
          <Field label={L('관계 메모', 'Relationship notes')} placeholder={L('나와의 관계, 보고 빈도 등', 'Relationship, reporting frequency, etc.')} maxLength={300}
            value={form.relationship_notes} onChange={(e) => handleFieldChange('relationship_notes', e.target.value)} />

          {/* Contact — for human agent integration */}
          <div className="pt-2 border-t border-[var(--border-subtle)]">
            <p className="text-[12px] font-semibold text-[var(--text-secondary)] mb-2">{L('연락처', 'Contact')} <span className="font-normal text-[var(--text-tertiary)]">{L('(선택 — 실제 질문 발송용)', '(optional — for sending real questions)')}</span></p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-[var(--text-tertiary)] mb-0.5 block">{L('📧 이메일', '📧 Email')}</label>
                <input type="email" value={form.contact?.email || ''} onChange={(e) => setForm(f => ({ ...f, contact: { ...f.contact, email: e.target.value || undefined } }))} placeholder="name@company.com" maxLength={120}
                  className="w-full bg-[var(--bg)] border-[1.5px] border-[var(--border)] rounded-[10px] px-3 py-2 text-[13px] focus:outline-none focus:border-[var(--accent)]" />
              </div>
              <div>
                <label className="text-[11px] text-[var(--text-tertiary)] mb-0.5 block">{L('💬 Slack ID', '💬 Slack ID')}</label>
                <input type="text" value={form.contact?.slack_id || ''} onChange={(e) => setForm(f => ({ ...f, contact: { ...f.contact, slack_id: e.target.value || undefined } }))} placeholder="U0123ABCDEF" maxLength={30}
                  className="w-full bg-[var(--bg)] border-[1.5px] border-[var(--border)] rounded-[10px] px-3 py-2 text-[13px] focus:outline-none focus:border-[var(--accent)]" />
              </div>
            </div>
            <p className="text-[10px] text-[var(--text-tertiary)] mt-1">{L('입력하면 기획 과정에서 이 사람에게 직접 질문을 보낼 수 있습니다.', "If filled, you can send direct questions to this person during planning.")}</p>
          </div>

          {/* Structured persona fields */}
          <div className="pt-2 border-t border-[var(--border-subtle)]">
            <p className="text-[12px] font-semibold text-[var(--text-secondary)] mb-2">{L('의사결정 성향 (선택)', 'Decision style (optional)')}</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mb-3">
              {[
                { value: 'analytical', label: L('데이터 중심', 'Data-driven') },
                { value: 'intuitive', label: L('직관/경험', 'Intuitive / experiential') },
                { value: 'consensus', label: L('합의 중시', 'Consensus-oriented') },
                { value: 'directive', label: L('빠른 결정', 'Fast decisions') },
              ].map(opt => (
                <button key={opt.value} type="button"
                  onClick={() => setForm(f => ({ ...f, decision_style: (f.decision_style === opt.value ? undefined : opt.value) as Persona['decision_style'] }))}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium border cursor-pointer transition-all ${
                    form.decision_style === opt.value ? 'border-[var(--accent)] bg-[var(--ai)] text-[var(--accent)]' : 'border-[var(--border)] text-[var(--text-secondary)]'
                  }`}
                >{opt.label}</button>
              ))}
            </div>
            <p className="text-[12px] font-semibold text-[var(--text-secondary)] mb-2">{L('리스크 수용도', 'Risk tolerance')}</p>
            <div className="grid grid-cols-3 gap-1.5 mb-3">
              {[
                { value: 'low', label: L('안전 우선', 'Safety first') },
                { value: 'medium', label: L('균형', 'Balanced') },
                { value: 'high', label: L('도전적', 'Aggressive') },
              ].map(opt => (
                <button key={opt.value} type="button"
                  onClick={() => setForm(f => ({ ...f, risk_tolerance: (f.risk_tolerance === opt.value ? undefined : opt.value) as Persona['risk_tolerance'] }))}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium border cursor-pointer transition-all ${
                    form.risk_tolerance === opt.value ? 'border-[var(--accent)] bg-[var(--ai)] text-[var(--accent)]' : 'border-[var(--border)] text-[var(--text-secondary)]'
                  }`}
                >{opt.label}</button>
              ))}
            </div>
            <Field label={L('OK 조건', 'Approval criteria')} placeholder={L('이 사람이 승인하려면 보여줘야 할 것 (예: ROI 데이터)', 'What you need to show for their approval (e.g. ROI data)')} maxLength={300}
              value={form.success_metric} onChange={(e) => handleFieldChange('success_metric', e.target.value)} />
          </div>
          {error && <p className="text-[13px] text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={onCancel}>{L('취소', 'Cancel')}</Button>
            <Button onClick={() => onSave(form)} disabled={!form.name || !form.role || !form.priorities}>
              <Check size={14} /> {L('저장', 'Save')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
