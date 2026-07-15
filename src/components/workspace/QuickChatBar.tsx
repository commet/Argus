'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, MessageSquare, X, Check } from 'lucide-react';
import { callLLMJson } from '@/lib/llm';
import { useReframeStore } from '@/stores/useReframeStore';
import { useRecastStore } from '@/stores/useRecastStore';
import { useAgentAttentionStore } from '@/stores/useAgentAttentionStore';
import type { StepId } from '@/stores/useWorkspaceStore';
import { getCurrentLanguage } from '@/lib/i18n';
import { useT } from '@/contexts/LocaleProvider';
import { useLocale } from '@/hooks/useLocale';

interface QuickChatBarProps {
  activeStep: StepId;
  onNavigate: (step: string) => void;
}

interface ChatAction {
  action: string;
  params: Record<string, unknown>;
  message: string;
}

const SYSTEM_PROMPT_KO = `당신은 Argus 워크스페이스의 어시스턴트입니다. 사용자가 자연어로 요청하면 적절한 액션을 JSON으로 응답하세요.

현재 단계: {step}

사용 가능한 액션:
- navigate: 다른 단계로 이동. params: { step: "reframe" | "recast" | "rehearse" }
- update_actor: 선원 배치에서 특정 스텝의 담당자 변경. params: { stepIndex: number, actor: "ai" | "human" | "both" }
- add_step: 선원 배치에 새 단계 추가. params: { task: string }
- remove_step: 선원 배치에서 단계 제거. params: { stepIndex: number }
- select_question: 항로 재설정에서 질문 선택. params: { questionIndex: number }
- message: 단순 응답 (액션 없음). params: {}

반드시 JSON만 응답하세요. message 필드는 반드시 한국어로 작성하세요:
{ "action": "...", "params": {...}, "message": "사용자에게 보여줄 확인 메시지" }`;

const SYSTEM_PROMPT_EN = `You are the assistant for the Argus workspace. When the user asks in natural language, respond with the appropriate action as JSON.

Current step: {step}

Available actions:
- navigate: Go to another step. params: { step: "reframe" | "recast" | "rehearse" }
- update_actor: Change the owner of a step in Crew Assignment. params: { stepIndex: number, actor: "ai" | "human" | "both" }
- add_step: Add a new step in Crew Assignment. params: { task: string }
- remove_step: Remove a step in Crew Assignment. params: { stepIndex: number }
- select_question: Select a question in Set the Heading. params: { questionIndex: number }
- message: Plain reply (no action). params: {}

Respond with JSON only. The message field MUST be written in English:
{ "action": "...", "params": {...}, "message": "confirmation message to show the user" }`;

function getSystemPrompt(): string {
  return getCurrentLanguage() === 'ko' ? SYSTEM_PROMPT_KO : SYSTEM_PROMPT_EN;
}

export function QuickChatBar({ activeStep, onNavigate }: QuickChatBarProps) {
  const t = useT();
  const locale = useLocale();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'info' } | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const recastStore = useRecastStore();
  const reframeStore = useReframeStore();

  // Clear feedback after 3s
  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  const executeAction = (action: ChatAction) => {
    switch (action.action) {
      case 'navigate':
        onNavigate(action.params.step as string);
        break;

      case 'update_actor': {
        const currentId = recastStore.currentId;
        if (currentId) {
          recastStore.updateStep(currentId, action.params.stepIndex as number, {
            actor: action.params.actor as 'ai' | 'human' | 'both',
          });
        }
        break;
      }

      case 'add_step': {
        const currentId = recastStore.currentId;
        if (currentId) {
          recastStore.addStep(currentId);
          const items = recastStore.items;
          const item = items.find(i => i.id === currentId);
          if (item) {
            const lastIdx = item.steps.length; // new step is at end
            recastStore.updateStep(currentId, lastIdx, {
              task: action.params.task as string,
            });
          }
        }
        break;
      }

      case 'remove_step': {
        const currentId = recastStore.currentId;
        if (currentId) {
          recastStore.removeStep(currentId, action.params.stepIndex as number);
        }
        break;
      }

      case 'confirm':
      case 'reanalyze': {
        // Unwired actions — never echo the LLM's success message (it would
        // claim something happened when nothing did). Honest info instead.
        setFeedback({
          message: locale === 'ko'
            ? '이 동작은 아직 지원하지 않아요 — 질문 카드에서 직접 답해 주세요.'
            : 'This action isn\'t supported yet — please answer directly on the question card.',
          type: 'info',
        });
        return;
      }

      case 'message':
      default:
        break;
    }

    setFeedback({ message: action.message, type: action.action === 'message' ? 'info' : 'success' });
  };

  const handleSubmit = async () => {
    if (!input.trim() || loading) return;

    // Quick local commands first (no LLM needed)
    const lowerInput = input.trim().toLowerCase();
    const nextKeywords = [
      t('quickChat.nextKeyword1').toLowerCase(),
      t('quickChat.nextKeyword2').toLowerCase(),
      t('quickChat.nextKeyword3').toLowerCase(),
    ];
    if (nextKeywords.includes(lowerInput)) {
      const stepOrder: StepId[] = ['reframe', 'recast', 'rehearse'];
      const currentIdx = stepOrder.indexOf(activeStep);
      if (currentIdx >= 0 && currentIdx < stepOrder.length - 1) {
        onNavigate(stepOrder[currentIdx + 1]);
        setFeedback({ message: t('quickChat.navDone', { step: stepOrder[currentIdx + 1] }), type: 'success' });
        setInput('');
        return;
      }
    }

    setLoading(true);
    useAgentAttentionStore.getState().ping('chat');
    try {
      const systemPrompt = getSystemPrompt().replace('{step}', activeStep);
      const result = await callLLMJson<ChatAction>(
        [{ role: 'user', content: input }],
        { system: systemPrompt, maxTokens: 500 }
      );
      executeAction(result);
    } catch {
      setFeedback({ message: t('quickChat.failure'), type: 'info' });
    } finally {
      setLoading(false);
      setInput('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  // Collapsed state — just a small button
  if (!isOpen) {
    return (
      <div className="border-t border-[var(--border)] bg-[var(--surface)] px-4 py-2">
        <button
          onClick={() => { setIsOpen(true); setTimeout(() => inputRef.current?.focus(), 100); }}
          className="flex items-center gap-2 text-[12px] text-[var(--text-secondary)] hover:text-[var(--accent)] cursor-pointer transition-colors"
        >
          <MessageSquare size={14} />
          {t('quickChat.open')}
        </button>
      </div>
    );
  }

  return (
    <div className="border-t border-[var(--border)] bg-[var(--surface)]">
      {/* Feedback toast */}
      {feedback && (
        <div className={`px-4 py-2 text-[12px] font-medium animate-fade-in ${
          feedback.type === 'success' ? 'bg-[var(--collab)] text-[var(--success)]' : 'bg-[var(--ai)] text-[var(--ai-fg)]'
        }`}>
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? <Check size={12} /> : <MessageSquare size={12} />}
            {feedback.message}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="flex items-center gap-2 px-4 py-2.5">
        <div className="flex-1 relative">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              activeStep === 'recast' ? t('quickChat.placeholderRecast') :
              activeStep === 'reframe' ? t('quickChat.placeholderReframe') :
              t('quickChat.placeholderGeneric')
            }
            className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[var(--accent)] placeholder:text-[var(--text-secondary)]"
            disabled={loading}
          />
        </div>
        <button
          onClick={handleSubmit}
          disabled={!input.trim() || loading}
          className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg bg-[var(--accent)] text-[var(--bg)] disabled:opacity-40 cursor-pointer hover:bg-[var(--accent-light)] transition-colors shrink-0"
          aria-label="Send"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
        </button>
        <button
          onClick={() => setIsOpen(false)}
          className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg)] cursor-pointer transition-colors shrink-0"
          aria-label="Close"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
