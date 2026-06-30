// Augmentation entry: adds ONLY WorkspaceHome onto the existing window.ArgusDS
// namespace, so it can be appended to the remote 117-component bundle without
// touching any existing export. React resolves to window.React (see build-snippet.mjs
// react-global plugin), matching how the toolchain's own bundle/preview wire React.
import { WorkspaceHome } from './WorkspaceHome';

const g = (window as unknown as { ArgusDS?: Record<string, unknown> });
g.ArgusDS = g.ArgusDS || {};
g.ArgusDS.WorkspaceHome = WorkspaceHome;
