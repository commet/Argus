import { Modal, Button } from 'argus';

export const Open = () => (
  <Modal open onClose={() => {}} title="이 결정을 봉인할까요?">
    <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 0 16px' }}>
      봉인하면 정한 날짜에 Argus가 먼저 돌아와 결과를 묻습니다. 그 전까지는 수정할 수 있어요.
    </p>
    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
      <Button variant="ghost">취소</Button>
      <Button variant="accent">봉인하기</Button>
    </div>
  </Modal>
);
