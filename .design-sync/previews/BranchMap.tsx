import { BranchMap } from 'argus';

// BranchMap — the 해도's branching course-graph (git-graph style). Pure SVG laid
// out by lib/branch-map-layout from checkpoints + branches: one row per
// checkpoint (time flows down), one lane per branch, forks are diagonal edges.
// Node color = owning branch; the active checkpoint is ringed; an anchored head
// shows ⚑; an abandoned branch is dimmed; a checkpoint carrying a ship's-log
// waypoint is filled (vs hollow). Full-width SVG → set to cardMode column.

const ts = (i: number) => `2026-06-1${i}T0${i}:00:00.000Z`;
const cp = (id: string, parent: string | null, stage: string, label: string, i: number) => ({
  id, parent_id: parent, stage, label, created_at: ts(i), state_snapshot: {},
});

// A linear voyage that forked once at the crew-set point: the main course
// sailed on to an anchorage; the alternative was weighed and abandoned.
const branchedCheckpoints = [
  cp('c1', null, 'origin', '출항 — AI 고객상담 신사업', 0),
  cp('c2', 'c1', 'briefing', '진짜 질문: 4주 안에 가능한가', 1),
  cp('c3', 'c2', 'crew_set', '선원 배치 — 본 항로', 2),
  cp('c4', 'c3', 'crew_done', '베타 시연 설계', 3),
  cp('c5', 'c4', 'anchored', '정박 — 임원회의로', 4),
  // fork off c2 — "직접 제작 대신 외부 솔루션" 갈래, 끝내 접음
  cp('f1', 'c2', 'crew_set', '분기: 외부 솔루션 검토', 2),
  cp('f2', 'f1', 'crew_done', '단가·종속성 평가', 3),
];

const branchedBranches = [
  { id: 'b-main', name: '본 항로', head_checkpoint_id: 'c5', forked_from_checkpoint_id: null, status: 'anchored', color: '#c79a3a', created_at: ts(0) },
  { id: 'b-fork', name: '분기: 외부 솔루션', head_checkpoint_id: 'f2', forked_from_checkpoint_id: 'c2', status: 'abandoned', color: '#7c8aa5', created_at: ts(2) },
];

const branchedWaypoints = [
  { id: 'w1', checkpoint_id: 'c1', type: 'departure', headline: '출항', created_at: ts(0) },
  { id: 'w2', checkpoint_id: 'c2', type: 'course_change', headline: '침로 변경', created_at: ts(1) },
  { id: 'w3', checkpoint_id: 'c5', type: 'anchorage', headline: '정박', created_at: ts(4) },
];

const Frame = ({ children }: { children: React.ReactNode }) => (
  <div style={{ maxWidth: 320, padding: 16 }} className="text-[var(--text-primary)]">
    <p className="bp-mono" style={{ fontSize: 11, letterSpacing: '0.08em', color: 'var(--text-tertiary)', margin: '0 0 10px' }}>
      항로 지도 · BRANCH MAP
    </p>
    {children}
  </div>
);

// A still-sailing branched voyage: the anchored main course (⚑ on its head) and
// the dimmed abandoned fork, with the user currently parked on the briefing node.
export const BranchedVoyage = () => (
  <Frame>
    <BranchMap
      checkpoints={branchedCheckpoints}
      branches={branchedBranches}
      waypoints={branchedWaypoints}
      activeBranchId="b-main"
      activeCheckpointId="c2"
      onPick={() => {}}
    />
  </Frame>
);

// The opening state — a single straight course with two waypoints, before any
// fork exists. Floors to the MIN_VIEW_W so the few nodes don't upscale huge.
const linearCheckpoints = [
  cp('c1', null, 'origin', '출항', 0),
  cp('c2', 'c1', 'briefing', '진짜 질문', 1),
  cp('c3', 'c2', 'crew_set', '선원 배치', 2),
];
const linearBranches = [
  { id: 'b-main', name: '본 항로', head_checkpoint_id: 'c3', forked_from_checkpoint_id: null, status: 'sailing', color: '#c79a3a', created_at: ts(0) },
];
const linearWaypoints = [
  { id: 'w1', checkpoint_id: 'c1', type: 'departure', headline: '출항', created_at: ts(0) },
];

export const LinearCourse = () => (
  <Frame>
    <BranchMap
      checkpoints={linearCheckpoints}
      branches={linearBranches}
      waypoints={linearWaypoints}
      activeBranchId="b-main"
      activeCheckpointId="c3"
      onPick={() => {}}
    />
  </Frame>
);
