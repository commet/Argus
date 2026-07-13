interface ToolPresentation {
  titleKo: string;
  descriptionKo: string;
}

/** Bilingual tools/list copy. MCP tool discovery has no request-locale field,
 * so metadata must be understandable in either language without guessing. */
const KO_TOOL_PRESENTATION: Record<string, ToolPresentation> = {
  argus_clarify_decision: { titleKo: '결정 명료화', descriptionKo: '결정을 대신 내리지 않고, 새 결정을 정리하거나 기록된 결정의 전제·미결 질문·현재 사실·예측 문장·상태를 관리합니다.' },
  argus_review_document: { titleKo: '문서 검토', descriptionKo: '문서의 주장·근거·숨은 전제와 사람이 판단해야 할 지점을 찾아 연결합니다.' },
  argus_save_prediction: { titleKo: '예측 저장', descriptionKo: '현실이 확인할 수 있는 예측과 확인일을 저장하고 작성 주체를 정직하게 기록합니다.' },
  argus_record_result: { titleKo: '실제 결과 기록', descriptionKo: '확인일이 된 예측에 실제로 일어난 일을 기록합니다. Argus는 결과를 평가하지 않습니다.' },
  argus_check_in: { titleKo: '확인할 기록 보기', descriptionKo: '확인일이 됐거나 다시 살펴볼 결정·전제·미결 질문을 보여줍니다.' },
  argus_history: { titleKo: '판단 기록 보기', descriptionKo: '진행 중인 결정, 전체 계약, 판단 영수증, 전제, 누적 기록을 읽습니다.' },
  argus_settings: { titleKo: 'Argus 설정', descriptionKo: '언어와 알림, 전제 동기화 설정을 관리하고 필요할 때 계정 기록을 동기화합니다.' },
};

export function bilingualToolPresentation(
  name: string,
  englishTitle: string | undefined,
  englishDescription: string,
): { title: string; description: string } {
  const ko = KO_TOOL_PRESENTATION[name];
  if (!ko) return { title: englishTitle ?? name, description: englishDescription };
  return {
    title: `${ko.titleKo} · ${englishTitle ?? name}`,
    description: `${ko.descriptionKo}\n\n${englishDescription}`,
  };
}
