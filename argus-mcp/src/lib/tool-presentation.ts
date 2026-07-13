interface ToolPresentation {
  titleKo: string;
  descriptionKo: string;
}

/** Bilingual tools/list copy. MCP tool discovery has no request-locale field,
 * so metadata must be understandable in either language without guessing. */
const KO_TOOL_PRESENTATION: Record<string, ToolPresentation> = {
  // 공개 표면 6종 (호스트가 tools/list에서 보는 이름). 내부 핸들러 이름 항목은 아래에 유지한다.
  argus_capture: { titleKo: '결정 다루기', descriptionKo: '결정을 대신 내리지 않고, 결정이 기대는 전제와 아직 열린 질문을 사용자의 말 그대로 포착합니다. 기록된 결정의 전제·현재 사실·예측 문장·상태도 관리합니다.' },
  argus_predict: { titleKo: '예측 저장', descriptionKo: '현실이 확인할 수 있는 예측과 확인일을 저장하고 작성 주체를 정직하게 기록합니다.' },
  argus_resolve: { titleKo: '실제 결과 기록', descriptionKo: '확인일이 된 예측에 실제로 일어난 일을 기록합니다. Argus는 결과를 평가하지 않습니다.' },
  argus_patterns: { titleKo: '판단 기록 보기', descriptionKo: '진행 중인 결정, 전체 계약, 판단 영수증, 전제, 누적 기록을 읽고, 당신이 쓴 예측·전제와 그 결과를 되읽는 reflection을 봅니다.' },
  argus_open_decision: { titleKo: '결정 열기', descriptionKo: '중요하고 되돌리기 어려운 진짜 갈림길인지 확인하고, 맞다면 중립적인 핵심 질문 하나로 결정을 엽니다.' },
  argus_review: { titleKo: '문서 판단 검수', descriptionKo: '기존 문서의 주장·근거·숨은 전제·사람이 판단할 지점을 원문 위치에 연결해 검수합니다.' },
  argus_premises: { titleKo: '결정 전제 추적', descriptionKo: '결정이 기대는 사실과 미결 질문을 출처와 함께 추가·수정·정리합니다.' },
  argus_seal: { titleKo: '예측 봉인', descriptionKo: '현실이 확인할 수 있는 예측과 확인일을 봉인합니다. 예측의 작성 주체를 정직하게 기록합니다.' },
  argus_recheck: { titleKo: '전제 재확인', descriptionKo: '추적 중인 전제 사실을 최신 근거와 다시 비교하고 변화 여부를 기록합니다.' },
  argus_settle: { titleKo: '현실과 정산', descriptionKo: '확인일이 된 예측에 실제로 일어난 일을 기록하고 판단 영수증을 만듭니다.' },
  argus_check_in: { titleKo: '확인할 기록 보기', descriptionKo: '확인일이 됐거나 다시 살펴볼 결정·전제·미결 질문을 보여줍니다.' },
  argus_recall: { titleKo: '판단 기록 불러오기', descriptionKo: '결정, 전제, 판단 영수증, 누적 기록을 읽습니다.' },
  argus_sync: { titleKo: '계정 기록 동기화', descriptionKo: '로컬 판단 기록과 Argus 계정의 영수증·확인일을 동기화합니다.' },
  argus_amend: { titleKo: '봉인 전 결정 수정', descriptionKo: '현실이 답하기 전에 예측 문장이나 확인일을 바꾸고 이전 기록은 보존합니다.' },
  argus_dismiss: { titleKo: '결정 접기', descriptionKo: '더는 답이 필요 없는 결정을 평결 없이 닫습니다.' },
  argus_candidates: { titleKo: '결정 후보 관리', descriptionKo: '작업 중 포착한 결정 후보를 확인하고 연결·정리·미룹니다.' },
  argus_watch: { titleKo: '오늘의 기록 남기기', descriptionKo: '오늘의 목표나 작업 중 포착한 문장을 평가 없이 그대로 기록합니다.' },
  argus_init: { titleKo: 'Argus 초기화', descriptionKo: '프로젝트의 .argus 기록 공간과 개인정보 보호 설정을 초기화합니다. 반복 호출해도 안전합니다.' },
  argus_config: { titleKo: 'Argus 설정', descriptionKo: '언어, 담당자, 팀, 보관 및 알림 관련 설정을 읽거나 수정합니다.' },
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
