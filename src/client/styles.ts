/**
 * VS Code Explorer / Source Control Minimalist Tree Styles (Light-First).
 *
 * Design rules:
 * - Workspace / Repo header: `[chevron] repo-name` (no folder icon, crisp section header).
 * - Git branch row: `[git-branch-icon] branch-name` (clean Codicon glyph, subtle status tint).
 * - Tree hierarchy: single clean 1px vertical indent guide per level (VS Code indent rail),
 *   zero dashed lines, zero heavy capsule shadows, flat 4px-radius row selection.
 * @module dsh-worktree-plugin/client/styles
 */

const STYLE_ID = 'dsh-worktree-plugin-styles'

export const TREE_INDENT_PX = 16

const CSS = `
.owt-root {
  --owt-hairline: var(--dsh-hairline-width, 0.5px);
  --owt-font-code: var(--ds-font-family-code, "SF Mono", "JetBrains Mono", Menlo, Consolas, ui-monospace, monospace);
  --owt-hover-bg: color-mix(in srgb, var(--dsw-alias-label-primary) 5%, transparent);
  --owt-active-bg: color-mix(in srgb, var(--dsw-alias-brand-primary) 10%, transparent);
  --owt-indent-guide: color-mix(in srgb, var(--dsw-alias-label-primary) 10%, transparent);
  --owt-indent-guide-active: color-mix(in srgb, var(--dsw-alias-label-primary) 22%, transparent);
  --owt-muted: color-mix(in srgb, var(--dsw-alias-label-secondary) 78%, transparent);

  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  box-sizing: border-box;
  color: var(--dsw-alias-label-primary);
  font-size: 13px;
  user-select: none;
  -webkit-user-select: none;
  -webkit-font-smoothing: antialiased;
}

/* Collapsed 56px sidebar rail */
.owt-rail {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 6px 0;
}

/* VS Code-style flat filter input + "+" action */
.owt-toolbar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 6px 6px 6px;
  flex: none;
}

.owt-search-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 0;
  height: 26px;
  padding: 0 6px 0 8px;
  border-radius: 5px;
  border: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-base);
  color: var(--dsw-alias-label-secondary);
  transition: border-color 100ms ease;
}

.owt-search-wrap:focus-within {
  border-color: var(--dsw-alias-brand-primary);
}

.owt-search-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--owt-muted);
  flex: none;
}

.owt-search-wrap input {
  flex: 1;
  min-width: 0;
  border: 0;
  outline: 0;
  padding: 0;
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 12px;
  line-height: 18px;
}

.owt-search-wrap input::placeholder {
  color: var(--owt-muted);
}

.owt-kbd-hint {
  flex: none;
  font-family: var(--owt-font-code);
  font-size: 10px;
  line-height: 15px;
  padding: 0 3px;
  color: var(--owt-muted);
  opacity: 0.75;
  pointer-events: none;
}

.owt-clear-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
  flex: none;
}

.owt-clear-btn:hover {
  color: var(--dsw-alias-label-primary);
  background: var(--owt-hover-bg);
}

.owt-add-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  padding: 0;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
  flex: none;
}

.owt-add-btn:hover {
  color: var(--dsw-alias-label-primary);
  background: var(--owt-hover-bg);
}

.owt-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 2px 4px 16px 4px;
}

.owt-group {
  margin-bottom: 4px;
}

/* ============================================================================
   VS Code Section / Workspace Header Row:  ▾ workspace-name (NO folder icon)
   ============================================================================ */
.owt-repo-row {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 26px;
  padding: 0 4px 0 4px;
  border-radius: 5px;
  cursor: pointer;
}

.owt-repo-row:hover {
  background: var(--owt-hover-bg);
}

.owt-repo-chevron {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  color: var(--dsw-alias-label-secondary);
  flex: none;
}

.owt-repo-name {
  flex: 1;
  min-width: 0;
  font-size: 12.5px;
  font-weight: 600;
  line-height: 18px;
  color: var(--dsw-alias-label-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.owt-repo-row[data-missing="true"] .owt-repo-name {
  opacity: 0.55;
}

.owt-repo-count {
  flex: none;
  font-variant-numeric: tabular-nums;
  font-size: 11px;
  line-height: 16px;
  padding: 0 4px;
  color: var(--owt-muted);
}

.owt-repo-row:hover .owt-repo-count,
.owt-repo-row:focus-within .owt-repo-count {
  display: none;
}

.owt-hover-actions {
  display: none;
  align-items: center;
  gap: 1px;
  flex: none;
}

.owt-repo-row:hover .owt-hover-actions,
.owt-repo-row:focus-within .owt-hover-actions,
.owt-wt-row:hover .owt-hover-actions,
.owt-wt-row:focus-within .owt-hover-actions,
.owt-chat-row:hover .owt-hover-actions,
.owt-chat-row:focus-within .owt-hover-actions {
  display: inline-flex;
}

@media (hover: none) {
  .owt-hover-actions {
    display: inline-flex;
  }
  .owt-repo-count {
    display: none;
  }
}

.owt-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
  flex: none;
}

.owt-icon-btn:hover {
  color: var(--dsw-alias-label-primary);
  background: color-mix(in srgb, var(--dsw-alias-label-primary) 8%, transparent);
}

/* ============================================================================
   VS Code Indent Guide Containers (1px crisp vertical line aligned to chevron)
   ============================================================================ */
.owt-repo-children {
  display: flex;
  flex-direction: column;
  margin-left: 11.5px;
  padding-left: 7px;
  border-left: 1px solid var(--owt-indent-guide);
}

.owt-group:hover > .owt-repo-children {
  border-left-color: var(--owt-indent-guide-active);
}

.owt-wt-block {
  display: flex;
  flex-direction: column;
}

/* ============================================================================
   Git Worktree Branch Row:  [git-branch-icon] branch-name
   ============================================================================ */
.owt-wt-row {
  position: relative;
  display: flex;
  align-items: center;
  gap: 6px;
  height: 27px;
  padding: 0 5px 0 6px;
  border-radius: 5px;
  cursor: pointer;
}

.owt-wt-row:hover {
  background: var(--owt-hover-bg);
}

.owt-wt-row[data-active="true"] {
  background: var(--owt-active-bg);
  color: var(--dsw-alias-brand-primary);
}

/* Leading 16px icon slot: Git branch icon (idle / active / warn / running) */
.owt-git-icon {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 15px;
  height: 15px;
  flex: none;
  color: var(--dsw-alias-label-secondary);
}

.owt-wt-row[data-active="true"] .owt-git-icon {
  color: var(--dsw-alias-brand-primary);
}

.owt-git-icon[data-status="running"] {
  color: var(--dsw-alias-brand-primary);
}

.owt-git-icon[data-status="pending"] {
  color: var(--dsw-alias-state-warn-primary);
}

@keyframes owt-spin {
  to { transform: rotate(360deg); }
}

@media (prefers-reduced-motion: reduce) {
  .owt-loading {
    animation: none;
  }
}

/* Compact spinner used when a branch or chat is actively running */
.owt-loading {
  width: 10px;
  height: 10px;
  box-sizing: border-box;
  border-radius: 999px;
  flex: none;
  border: 1.4px solid color-mix(in srgb, var(--dsw-alias-brand-primary) 26%, transparent);
  border-top-color: var(--dsw-alias-brand-primary);
  animation: owt-spin 0.8s linear infinite;
}

.owt-wt-branch-wrap {
  flex: 1;
  min-width: 0;
  display: inline-flex;
  align-items: baseline;
  gap: 5px;
  overflow: hidden;
}

.owt-wt-branch {
  min-width: 0;
  font-size: 13px;
  font-weight: 400;
  line-height: 20px;
  color: var(--dsw-alias-label-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.owt-wt-row[data-active="true"] .owt-wt-branch {
  font-weight: 500;
}

.owt-wt-plain-label {
  flex: 1;
  min-width: 0;
  font-size: 12.5px;
  font-weight: 400;
  line-height: 19px;
  color: var(--dsw-alias-label-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.owt-wt-row[data-active="true"] .owt-wt-plain-label {
  font-weight: 500;
}

/* VS Code SCM-style plain text status count (no heavy pill border) */
.owt-dirty-pill {
  flex: none;
  font-variant-numeric: tabular-nums;
  font-size: 11px;
  font-weight: 500;
  line-height: 16px;
  padding: 0 3px;
  color: var(--dsw-alias-state-warn-primary);
}

.owt-missing-pill {
  flex: none;
  font-size: 10.5px;
  line-height: 15px;
  padding: 0 4px;
  color: var(--dsw-alias-state-warn-primary);
}

.owt-count-pill {
  flex: none;
  font-variant-numeric: tabular-nums;
  font-size: 11px;
  color: var(--owt-muted);
}

/* Minimal chat counter trigger */
.owt-chat-pill {
  display: inline-flex;
  align-items: center;
  gap: 2.5px;
  height: 18px;
  padding: 0 4px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--owt-muted);
  font: inherit;
  font-variant-numeric: tabular-nums;
  font-size: 11px;
  line-height: 1;
  cursor: pointer;
  flex: none;
}

.owt-chat-pill:hover,
.owt-chat-pill[aria-expanded="true"] {
  background: var(--owt-hover-bg);
  color: var(--dsw-alias-label-primary);
}

/* Star button: quiet at rest unless pinned */
.owt-star-btn {
  display: none;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--owt-muted);
  cursor: pointer;
  flex: none;
}

.owt-star-btn[data-pinned="true"] {
  display: inline-flex;
  color: var(--dsw-alias-state-warn-primary);
}

.owt-wt-row:hover .owt-star-btn,
.owt-wt-row:focus-within .owt-star-btn {
  display: inline-flex;
}

.owt-star-btn:hover {
  color: var(--dsw-alias-state-warn-primary);
}

/* ============================================================================
   Conversation Sub-Rows & Child Worktree Subtree (VS Code 1px Indent Guides)
   ============================================================================ */
.owt-chats {
  display: flex;
  flex-direction: column;
  margin-left: 13px;
  padding-left: 8px;
  border-left: 1px solid var(--owt-indent-guide);
}

.owt-chat-row {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 25px;
  padding: 0 5px 0 6px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12.5px;
  line-height: 18px;
  color: var(--dsw-alias-label-secondary);
}

.owt-chat-row:hover {
  background: var(--owt-hover-bg);
  color: var(--dsw-alias-label-primary);
}

.owt-chat-row[data-selected="true"] {
  background: var(--owt-active-bg);
  color: var(--dsw-alias-label-primary);
  font-weight: 500;
}

.owt-chat-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.owt-chat-time {
  flex: none;
  font-variant-numeric: tabular-nums;
  font-size: 10.5px;
  color: var(--owt-muted);
}

.owt-chat-row:hover .owt-chat-time,
.owt-chat-row:focus-within .owt-chat-time {
  display: none;
}

/* Collapsed-chat-list expander row ("Show N more chats" / "Collapse chats") */
.owt-chats-more {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 22px;
  margin-top: 1px;
  padding: 0 5px 0 5px;
  border: none;
  border-radius: 4px;
  background: transparent;
  cursor: pointer;
  font-size: 11.5px;
  line-height: 16px;
  color: var(--owt-muted);
}

.owt-chats-more:hover {
  background: var(--owt-hover-bg);
  color: var(--dsw-alias-label-primary);
}

/* Child-worktree lineage nested directly on the VS Code indent guide */
.owt-lineage-rail {
  display: flex;
  flex-direction: column;
  margin-left: 13px;
  padding-left: 8px;
  border-left: 1px solid var(--owt-indent-guide);
}

.owt-wt-block:hover > .owt-lineage-rail {
  border-left-color: var(--owt-indent-guide-active);
}

/* Minimal inline tree toggle for derived worktrees (only needed when user wants to collapse/expand) */
.owt-lineage-toggle {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 20px;
  padding: 0 5px;
  margin: 1px 0;
  width: fit-content;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--owt-muted);
  font: inherit;
  font-size: 11px;
  cursor: pointer;
}

.owt-lineage-toggle:hover {
  background: var(--owt-hover-bg);
  color: var(--dsw-alias-label-secondary);
}

.owt-lineage-children {
  display: flex;
  flex-direction: column;
}

.owt-mini-dot {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: var(--dsw-alias-brand-primary);
  flex: none;
}

.owt-mini-dot[data-tone="warn"] {
  background: var(--dsw-alias-state-warn-primary);
}

.owt-empty {
  padding: 24px 12px;
  text-align: center;
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
}

.owt-toast {
  margin: 2px 6px 6px;
  padding: 5px 9px;
  border-radius: 5px;
  border: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-base);
  color: var(--dsw-alias-label-secondary);
  font-size: 11.5px;
}

.owt-toast[data-kind="error"] {
  color: var(--dsw-alias-state-error-primary);
}

/* ============================================================================
   Minimalist Modals (VS Code Quick-Input / Clean Dialog Style)
   ============================================================================ */
.owt-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, #0f172a 20%, transparent);
}

.owt-modal {
  --owt-font-code: var(--ds-font-family-code, "SF Mono", "JetBrains Mono", Menlo, Consolas, ui-monospace, monospace);
  width: min(380px, calc(100vw - 32px));
  box-sizing: border-box;
  padding: 16px 18px;
  border-radius: 10px;
  border: 1px solid var(--dsw-alias-border-l2);
  background: var(--dsw-alias-bg-overlay, var(--dsw-alias-bg-base));
  box-shadow: var(--dsw-elevation-prominent, 0 10px 30px rgba(15, 23, 42, 0.12));
  color: var(--dsw-alias-label-primary);
  font-size: 13px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.owt-modal-head {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.owt-modal-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 600;
  line-height: 20px;
}

.owt-modal-title-icon {
  display: inline-flex;
  align-items: center;
  color: var(--dsw-alias-label-secondary);
}

.owt-modal-sub {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
  font-size: 12px;
  color: var(--dsw-alias-label-secondary);
}

.owt-code-chip {
  font-family: var(--owt-font-code);
  font-size: 11px;
  padding: 0 5px;
  border-radius: 4px;
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-primary);
}

.owt-modal-desc {
  font-size: 12px;
  color: var(--dsw-alias-label-secondary);
  line-height: 1.5;
}

.owt-modal-desc[data-kind="danger"] {
  color: var(--dsw-alias-state-error-primary);
}

.owt-input-shell {
  position: relative;
  display: flex;
  align-items: center;
}

.owt-input {
  width: 100%;
  box-sizing: border-box;
  height: 30px;
  padding: 0 9px;
  border-radius: 5px;
  border: 1px solid var(--dsw-alias-border-l2);
  background: var(--dsw-alias-bg-base);
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 12.5px;
}

.owt-input[data-mono="true"] {
  padding-right: 60px;
}

.owt-input-enter-hint {
  position: absolute;
  right: 8px;
  font-size: 10.5px;
  color: var(--dsw-alias-label-secondary);
  opacity: 0.65;
  pointer-events: none;
}

.owt-input:focus,
.owt-select:focus {
  outline: none;
  border-color: var(--dsw-alias-brand-primary);
}

.owt-field {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.owt-field-label {
  font-size: 11.5px;
  color: var(--dsw-alias-label-secondary);
}

.owt-field-hint {
  font-size: 11px;
  line-height: 1.4;
  color: var(--dsw-alias-state-warn-primary);
}

.owt-select-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.owt-select {
  flex: 1;
  min-width: 0;
  box-sizing: border-box;
  height: 30px;
  padding: 0 8px;
  border-radius: 5px;
  border: 1px solid var(--dsw-alias-border-l2);
  background: var(--dsw-alias-bg-base);
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 12.5px;
  cursor: pointer;
}

.owt-fetch-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  padding: 0;
  border-radius: 5px;
  border: 1px solid var(--dsw-alias-border-l2);
  background: var(--dsw-alias-bg-base);
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
  flex: none;
}

.owt-fetch-btn:hover:not(:disabled) {
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-primary);
}

.owt-fetch-btn:disabled {
  opacity: 0.45;
  cursor: default;
}

.owt-modal-check {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  cursor: pointer;
}

.owt-modal-foot {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 2px;
}

.owt-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  height: 28px;
  padding: 0 12px;
  border-radius: 5px;
  border: 1px solid var(--dsw-alias-border-l2);
  background: var(--dsw-alias-bg-base);
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}

.owt-btn:hover:not(:disabled) {
  background: var(--dsw-alias-bg-layer-1);
}

.owt-btn:disabled {
  opacity: 0.45;
  cursor: default;
}

.owt-btn[data-kind="primary"] {
  background: var(--dsw-alias-brand-primary);
  border-color: var(--dsw-alias-brand-primary);
  color: #ffffff;
}

.owt-btn[data-kind="danger"] {
  color: var(--dsw-alias-state-error-primary);
}

.owt-btn-xs {
  height: 23px;
  padding: 0 8px;
  font-size: 11.5px;
  border-radius: 4px;
}

/* ============================================================================
   Settings -> Archived Sessions (Minimalist VS Code Tree List, NO Folder Icon)
   ============================================================================ */
.owt-arch-root {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  color: var(--dsw-alias-label-primary);
  font-size: 13px;
}

.owt-arch-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.owt-arch-title-wrap {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.owt-arch-title {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 600;
  line-height: 22px;
}

.owt-arch-count {
  font-variant-numeric: tabular-nums;
  font-size: 11px;
  font-weight: 500;
  line-height: 18px;
  padding: 0 6px;
  border-radius: 999px;
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-secondary);
}

.owt-arch-desc {
  font-size: 12px;
  line-height: 18px;
  color: var(--dsw-alias-label-secondary);
}

.owt-arch-search {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 30px;
  padding: 0 9px;
  border-radius: 5px;
  border: 1px solid var(--dsw-alias-border-l2);
  background: var(--dsw-alias-bg-base);
  color: var(--dsw-alias-label-secondary);
}

.owt-arch-search:focus-within {
  border-color: var(--dsw-alias-brand-primary);
}

.owt-arch-search input {
  flex: 1;
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 12.5px;
}

.owt-arch-empty {
  padding: 32px 16px;
  text-align: center;
  border-radius: 8px;
  border: 1px dashed var(--dsw-alias-border-l1);
  color: var(--dsw-alias-label-secondary);
  font-size: 12.5px;
}

.owt-arch-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.owt-arch-card {
  border-radius: 8px;
  border: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-base);
  overflow: hidden;
}

.owt-arch-repo-head {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  cursor: pointer;
  user-select: none;
}

.owt-arch-repo-head:hover {
  background: var(--dsw-alias-bg-layer-1);
}

.owt-arch-repo-name {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.owt-arch-repo-meta {
  flex: none;
  font-variant-numeric: tabular-nums;
  font-size: 11px;
  color: var(--dsw-alias-label-secondary);
}

.owt-arch-branches {
  display: flex;
  flex-direction: column;
  border-top: 1px solid var(--dsw-alias-border-l1);
  padding: 4px 8px 8px;
  gap: 4px;
}

.owt-arch-branch-group {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.owt-arch-branch-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 3px 6px;
  border-radius: 5px;
}

.owt-arch-branch-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  flex: 1;
  cursor: pointer;
  color: var(--dsw-alias-label-primary);
}

.owt-arch-branch-icon {
  display: inline-flex;
  align-items: center;
  color: var(--dsw-alias-label-secondary);
}

.owt-arch-branch-name {
  font-size: 12.5px;
  font-weight: 500;
  color: var(--dsw-alias-label-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.owt-arch-removed-tag {
  flex: none;
  font-size: 10.5px;
  color: var(--dsw-alias-label-secondary);
  opacity: 0.75;
}

.owt-arch-link-btn {
  border: 0;
  background: transparent;
  padding: 2px 6px;
  border-radius: 4px;
  font: inherit;
  font-size: 11.5px;
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
  flex: none;
}

.owt-arch-link-btn:hover:not(:disabled) {
  color: var(--dsw-alias-label-primary);
  background: var(--dsw-alias-bg-layer-1);
}

.owt-arch-sessions {
  display: flex;
  flex-direction: column;
}

.owt-arch-sessions[data-indented="true"] {
  margin-left: 13px;
  padding-left: 10px;
  border-left: 1px solid color-mix(in srgb, var(--dsw-alias-label-primary) 10%, transparent);
}

.owt-arch-session-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 30px;
  padding: 2px 8px;
  border-radius: 5px;
}

.owt-arch-session-row:hover,
.owt-arch-session-row:focus-within {
  background: var(--dsw-alias-bg-layer-1);
}

.owt-arch-session-main {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 10px;
}

.owt-arch-session-title {
  flex: 1;
  min-width: 0;
  font-size: 12.5px;
  color: var(--dsw-alias-label-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.owt-arch-session-time {
  flex: none;
  font-variant-numeric: tabular-nums;
  font-size: 11px;
  color: var(--dsw-alias-label-secondary);
}

.owt-arch-session-actions {
  display: none;
  align-items: center;
  gap: 6px;
  flex: none;
}

.owt-arch-session-row:hover .owt-arch-session-actions,
.owt-arch-session-row:focus-within .owt-arch-session-actions,
.owt-arch-session-row[data-busy="true"] .owt-arch-session-actions {
  display: inline-flex;
}

@media (hover: none) {
  .owt-arch-session-actions {
    display: inline-flex;
  }
}

`

export function injectStyles(): void {
  const existing = document.getElementById(STYLE_ID)
  if (existing !== null) {
    existing.textContent = CSS
    return
  }
  const element = document.createElement('style')
  element.id = STYLE_ID
  element.textContent = CSS
  document.head.append(element)
}

export function removeStyles(): void {
  document.getElementById(STYLE_ID)?.remove()
}