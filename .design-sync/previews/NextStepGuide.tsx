import { NextStepGuide } from 'argus';

// NextStepGuide — a "Next step" card that recommends the next tool in the
// Argus pipeline based on the current one. The recommended option is
// highlighted (accent border + "Recommended" badge); a project overview link
// appears when a projectId is present. We sweep the currentTool axis.

export const FromReframe = () => (
  <NextStepGuide currentTool="reframe" projectId="proj-japan-entry" />
);

export const FromRecast = () => (
  <NextStepGuide currentTool="recast" projectId="proj-japan-entry" />
);

export const FromRehearse = () => (
  <NextStepGuide currentTool="rehearse" projectId="proj-japan-entry" />
);

export const FromRefine = () => (
  <NextStepGuide currentTool="refine" />
);
