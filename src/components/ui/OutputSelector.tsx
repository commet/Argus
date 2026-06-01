'use client';

import { useState } from 'react';
import { Button } from './Button';
import { CopyButton } from './CopyButton';
import { FileText, MessageSquare, Code, CheckSquare, Download, ChevronDown, ChevronUp } from 'lucide-react';
import type { Project, MetaReflection } from '@/stores/types';
import { useProjectStore } from '@/stores/useProjectStore';
import { Field } from './Field';
import { generateProjectBrief } from '@/lib/project-brief';
import { generatePromptChain } from '@/lib/prompt-chain';
import { generateAgentSpec } from '@/lib/agent-spec';
import { generateChecklist } from '@/lib/checklist';
import { generateDecisionRationale } from '@/lib/decision-rationale';
import { track } from '@/lib/analytics';
import { Scale } from 'lucide-react';
import { useLocale } from '@/hooks/useLocale';

interface OutputSelectorProps {
  project: Project;
}

interface OutputFormat {
  key: string;
  icon: React.ReactNode;
  label: string;
  description: string;
  generator: (project: Project) => string;
  fileExt: string;
}

function getFormats(locale: 'ko' | 'en'): OutputFormat[] {
  const ko = locale === 'ko';
  return [
    {
      key: 'brief',
      icon: <FileText size={18} />,
      label: ko ? '프로그램 노트 · Project Brief' : 'Project Brief · 프로그램 노트',
      description: ko
        ? '경영진이나 팀에 공유하는 의사결정 기록. 가장 먼저 만드세요.'
        : 'Decision record to share with leadership or the team. Start here.',
      generator: generateProjectBrief,
      fileExt: 'md',
    },
    {
      key: 'prompt-chain',
      icon: <MessageSquare size={18} />,
      label: ko ? '파트보 · Prompt Chain' : 'Prompt Chain · 파트보',
      description: ko
        ? 'Claude/ChatGPT에 순서대로 입력할 프롬프트 세트. AI 실행 시 사용.'
        : 'A sequenced prompt set to paste into Claude/ChatGPT. For AI execution.',
      generator: generatePromptChain,
      fileExt: 'md',
    },
    {
      key: 'agent-spec',
      icon: <Code size={18} />,
      label: ko ? '총보 · Agent Spec' : 'Agent Spec · 총보',
      description: ko
        ? 'LangGraph/CrewAI 구현의 출발점이 되는 설계서.'
        : 'Starting spec for LangGraph / CrewAI implementations.',
      generator: generateAgentSpec,
      fileExt: 'yaml',
    },
    {
      key: 'checklist',
      icon: <CheckSquare size={18} />,
      label: ko ? '셋리스트 · Execution Checklist' : 'Execution Checklist · 셋리스트',
      description: ko
        ? '각 단계를 하나씩 확인하며 실행하는 체크리스트.'
        : 'Step-by-step checklist to verify as you execute.',
      generator: generateChecklist,
      fileExt: 'md',
    },
    {
      key: 'rationale',
      icon: <Scale size={18} />,
      label: ko ? '판단 근거서 · Decision Rationale' : 'Decision Rationale · 판단 근거서',
      description: ko
        ? '각 단계에서 왜 이렇게 판단했는지, 설계 세계관을 공유합니다.'
        : 'Shares the reasoning and worldview behind each decision.',
      generator: generateDecisionRationale,
      fileExt: 'md',
    },
  ];
}

export function OutputSelector({ project }: OutputSelectorProps) {
  const locale = useLocale();
  const L = (ko: string, en: string) => locale === 'ko' ? ko : en;
  const formats = getFormats(locale);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [preview, setPreview] = useState<string>('');
  const [codaOpen, setCodaOpen] = useState(false);
  const [codaForm, setCodaForm] = useState<MetaReflection>({
    understanding_change: project.meta_reflection?.understanding_change || '',
    surprising_discovery: project.meta_reflection?.surprising_discovery || '',
    next_time_differently: project.meta_reflection?.next_time_differently || '',
    created_at: project.meta_reflection?.created_at || '',
  });
  const [codaSaved, setCodaSaved] = useState(!!project.meta_reflection);
  const { updateProject } = useProjectStore();

  const handleSaveCoda = () => {
    updateProject(project.id, {
      meta_reflection: {
        ...codaForm,
        created_at: new Date().toISOString(),
      },
    });
    setCodaSaved(true);
  };

  const handleSelect = (format: OutputFormat) => {
    if (selectedKey === format.key) {
      setSelectedKey(null);
      setPreview('');
      return;
    } else {
      setSelectedKey(format.key);
      setPreview(format.generator(project));
      track('output_generated', { format: format.key });
    }
  };

  const selectedFormat = formats.find((f) => f.key === selectedKey);

  const handleDownload = () => {
    if (!selectedFormat || !preview) return;
    const blob = new Blob([preview], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name}-${selectedFormat.key}.${selectedFormat.fileExt}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3">
      <h3 className="text-[14px] font-bold text-[var(--text-primary)]">{L('이타카 — 산출물 선택', 'Ithaca — Choose output')}</h3>
      <p className="text-[12px] text-[var(--text-secondary)]">{L('같은 항해에서 목적에 맞는 형식으로 내보냅니다.', 'From the same voyage, export in the format that fits your destination.')}</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {formats.map((format) => (
          <button
            key={format.key}
            onClick={() => handleSelect(format)}
            className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all cursor-pointer ${
              selectedKey === format.key
                ? 'border-[var(--accent)] bg-[var(--ai)] shadow-sm'
                : 'border-[var(--border)] hover:border-[var(--accent)]'
            }`}
          >
            <div className={`mt-0.5 shrink-0 ${selectedKey === format.key ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)]'}`}>
              {format.icon}
            </div>
            <div>
              <p className="text-[13px] font-semibold text-[var(--text-primary)]">{format.label}</p>
              <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">{format.description}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Preview */}
      {selectedKey && preview && (
        <div className="animate-fade-in">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[12px] font-semibold text-[var(--text-secondary)]">{L('미리보기', 'Preview')}</span>
            <div className="flex gap-2">
              <CopyButton getText={() => preview} label={L('복사', 'Copy')} />
              <Button variant="secondary" size="sm" onClick={handleDownload}>
                <Download size={12} /> {L('다운로드', 'Download')}
              </Button>
            </div>
          </div>
          <pre className="bg-[#1a1a2e] text-[#e2e4ea] rounded-xl p-4 text-[12px] leading-relaxed overflow-x-auto max-h-[400px] overflow-y-auto font-mono">
            {preview}
          </pre>
        </div>
      )}

      {/* Logbook: 항해 후 성찰 */}
      <div className="border-t border-[var(--border-subtle)] pt-4 mt-4">
        <button
          onClick={() => setCodaOpen(!codaOpen)}
          className="flex items-center gap-2 text-[13px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer transition-colors w-full"
        >
          {codaOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {L('항해일지 · 되돌아보기', 'Logbook · Reflect')}
          {codaSaved && <span className="text-[10px] text-[var(--success)] font-medium ml-1">{L('저장됨', 'Saved')}</span>}
        </button>
        {codaOpen && (
          <div className="mt-4 space-y-4 animate-fade-in">
            <p className="text-[12px] text-[var(--text-secondary)] leading-relaxed">
              {L(
                '항해가 끝났습니다. 이 항로를 되돌아보는 것은 다음 항해를 위한 가장 좋은 준비입니다.',
                "The voyage has ended. Reflecting on the route is the best preparation for the next one.",
              )}
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-[12px] font-semibold text-[var(--text-primary)] block mb-1">
                  {L(
                    '1. 처음 지시를 받았을 때의 이해와 지금의 이해가 어떻게 달라졌습니까?',
                    '1. How has your understanding shifted from when you first received the brief?',
                  )}
                </label>
                <Field
                  value={codaForm.understanding_change || ''}
                  onChange={(e) => setCodaForm(prev => ({ ...prev, understanding_change: e.target.value }))}
                  rows={2}
                  animatedPlaceholders={locale === 'ko' ? [
                    '처음에는 단순한 과제라고 생각했지만...',
                    '핵심 이해관계자의 관점이 완전히 달라 보이기 시작했다',
                    '문제의 범위가 예상보다 넓다는 것을 알게 되었다',
                    '기술적 해결이 아닌 조직적 문제라는 걸 깨달았다',
                  ] : [
                    "At first I thought it was a simple task, but...",
                    "A key stakeholder's perspective started to look completely different",
                    'The scope turned out to be wider than expected',
                    'I realized it was an organizational problem, not a technical one',
                  ]}
                />
              </div>
              <div>
                <label className="text-[12px] font-semibold text-[var(--text-primary)] block mb-1">
                  {L(
                    '2. 이 과정에서 가장 놀라운 발견은 무엇이었습니까?',
                    '2. What was the most surprising discovery along the way?',
                  )}
                </label>
                <Field
                  value={codaForm.surprising_discovery || ''}
                  onChange={(e) => setCodaForm(prev => ({ ...prev, surprising_discovery: e.target.value }))}
                  rows={2}
                  animatedPlaceholders={locale === 'ko' ? [
                    '예상하지 못했던 리스크나 새로운 관점...',
                    '이해관계자가 실제로는 다른 것을 원하고 있었다',
                    '가정이 틀렸다는 걸 데이터가 보여줬다',
                    '가장 작은 단계가 가장 큰 영향을 줄 수 있었다',
                  ] : [
                    'An unexpected risk or a new angle...',
                    'The stakeholder actually wanted something different',
                    'The data showed my assumption was wrong',
                    'The smallest step could make the biggest impact',
                  ]}
                />
              </div>
              <div>
                <label className="text-[12px] font-semibold text-[var(--text-primary)] block mb-1">
                  {L(
                    '3. 다음에 비슷한 과제를 만나면 무엇을 다르게 하겠습니까?',
                    '3. What would you do differently next time?',
                  )}
                </label>
                <Field
                  value={codaForm.next_time_differently || ''}
                  onChange={(e) => setCodaForm(prev => ({ ...prev, next_time_differently: e.target.value }))}
                  rows={2}
                  animatedPlaceholders={locale === 'ko' ? [
                    '이해관계자를 더 일찍 참여시키거나...',
                    '가정 검증을 첫 단계에서 했을 것이다',
                    '리스크를 미리 시뮬레이션해 봤을 것이다',
                    '작은 파일럿으로 먼저 검증했을 것이다',
                  ] : [
                    "Bring stakeholders in earlier, or...",
                    'Validate assumptions in the first step',
                    'Simulate the risks up front',
                    'Run a small pilot to verify first',
                  ]}
                />
              </div>
              <Button size="sm" onClick={handleSaveCoda}>
                {codaSaved ? L('업데이트', 'Update') : L('성찰 저장', 'Save reflection')}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
