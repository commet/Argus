import { Tab } from 'argus';

const tabs = [
  { key: 'reframe', label: '문제 재정의' },
  { key: 'recast', label: '실행 설계', count: 3 },
  { key: 'rehearse', label: '사전 검증' },
  { key: 'synthesize', label: '종합' },
];

export const Default = () => <Tab tabs={tabs} activeKey="recast" onChange={() => {}} />;

export const FirstActive = () => <Tab tabs={tabs} activeKey="reframe" onChange={() => {}} />;
