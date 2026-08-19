# Argus UI vocabulary pass

Source reviewed: [Name That UI](https://namethatui.com/) and its Web index, 2026-07-13.

This note turns the vocabulary into product decisions. A named pattern is not a
decoration: its interaction contract, state model, and accessibility semantics
come with it.

## Vocabulary map

| Pattern | Precise meaning | Argus rule |
| --- | --- | --- |
| Overflow menu | Secondary actions behind a horizontal ellipsis (meatballs) or vertical ellipsis (kebab) | Keep low-frequency destinations in the header More menu; label the trigger and expose menu state. |
| Command palette | Keyboard-first searchable command/destination surface | `Cmd/Ctrl+K` opens quick navigation across primary and utility routes. |
| Combobox | Text input whose value filters or chooses from a listbox | The command palette search owns `aria-controls`, active option, arrow movement, and Enter selection. |
| Popover | Click-triggered rich anchored overlay that persists until dismissal | Use for compact contextual controls, never for primary navigation or destructive confirmation. |
| Dropdown menu | Click-triggered keyboard-navigable action list | Header More and account actions use menu semantics and close after selection/Escape. |
| Tooltip | Brief, non-interactive label on hover and keyboard focus | Use only when an icon's visible label is intentionally absent; never place controls inside it. |
| Hover card | Rich preview reachable by hover and focus | Reserve for agent/persona previews; always provide a touch/focus path. |
| Dialog | Centered modal surface for a focused task or decision | Desktop modals remain centered, trap focus, close with Escape, and return focus to the trigger. |
| Drawer | Side-attached contextual workspace surface | Voyage map, crew, and logbook rails belong here when they preserve the main task context. |
| Sheet | Edge-attached modal, usually bottom-aligned on compact screens | Shared modal becomes a bottom sheet on mobile and a dialog from `sm` upward. |
| Scrim / backdrop | Translucent layer between a modal and the inert page | Shared modal uses a dimmed, slightly blurred scrim with light-dismiss. |
| Toast / snackbar | Temporary non-modal status message | Use for save/copy/sync outcomes; announce non-urgent updates politely and avoid covering task controls. |
| Empty state | Designed state for zero content or zero results | Explain what is absent and provide one recovery action; command search uses a live no-results state. |
| Skeleton | Layout-shaped loading placeholder | Use only when the final layout is predictable and reserve its space. |
| Spinner | Indeterminate work indicator | Use only when remaining progress is unknown. |
| Progress bar/ring | Determinate progress indicator with a known value | Keep visible percentage and accessible value synchronized. |
| Tabs | Labels for mutually exclusive content panels | Use `tablist`/`tab`/`tabpanel`; do not use tabs for changing a setting. |
| Toggle group / segmented control | Compact persistent selection that changes a mode or view | Language and view-mode choices behave like one selection, not content tabs. |
| Switch | Binary setting that takes effect immediately | Use for instant preferences such as behavioral toggles. |
| Checkbox | Independent value, often committed with Save/Submit | Use when several values may be selected independently. |
| Radio group | Exactly one value from a named set | Use for exclusive form choices when all choices should remain visible. |
| Form field | Label, control, optional helper, validation message, and required state | Shared Field binds label/control, helper/error with `aria-describedby`, and invalid state. Placeholder is never the label. |
| Focus ring | Keyboard focus indicator, normally via `:focus-visible` | Keep the global gold ring; components must not erase it with `outline-none`. |
| Divider / separator / rule | Thematic break, structural separator, or decorative border | Choose semantics based on meaning; decorative hairlines stay unannounced. |
| Breadcrumbs | Hierarchical location trail | Use on deep settings/admin paths, not inside the linear decision voyage. |
| Badge / chip / pill / tag | Status/count, interactive compact object, shape, or taxonomy label | Name components by behavior: count/status = badge; removable/filterable object = chip/tag. “Pill” only describes shape. |
| Truncation | End ellipsis, line clamp, middle truncation, or fade | Preserve access to full project/branch names via title or a detail surface; flex children need `min-width: 0`. |
| Sticky vs fixed | Sticky participates in its scroll container; fixed attaches to the viewport | App header is sticky; mobile drawers may be fixed only when they must remain viewport-attached. |
| Drag and drop | Direct manipulation with handle, preview, and drop indicator | Do not add until reorder has product value; provide keyboard alternatives and announce results. |
| Lightbox | Modal image viewer over a scrim | Appropriate for evidence/image inspection, not general document editing. |
| Marquee | Auto-scrolling repeated strip | Avoid in the decision workspace; if used in marketing, pause on hover and honor reduced motion. |

## Applied in this pass

- Added a searchable command palette with a dialog, combobox, listbox selection,
  keyboard navigation, no-results empty state, and `Cmd/Ctrl+K` shortcut.
- Clarified the header's anchored menus with menu/menuitem semantics, Escape
  dismissal, stronger selected navigation state, and a translucent sticky layer.
- Rebuilt shared field anatomy so labels, helper text, and validation state are
  programmatically connected.
- Made the shared modal behave as a bottom sheet on compact screens and a
  centered dialog on larger screens, over a distinct scrim.

## Next high-value passes

1. Standardize every transient save/sync notice through one toast viewport.
2. Audit view switchers and content tabs, then give each the correct keyboard model.
3. Replace bespoke sidebar overlays with one drawer primitive and consistent
   focus/scroll behavior.
4. Add purposeful empty states to Projects, Teams, and review receipts.
5. Audit icon-only buttons for visible tooltips on hover and keyboard focus.
