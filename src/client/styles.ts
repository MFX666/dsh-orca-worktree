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

/* =====================================================================
 * Git Source-Control & Diff Review Split Workbench (.owt-gp-*)
 * Codex/Orca "quiet paper" direction: one background, hairline discipline,
 * soft add/del washes, color reserved for meaning (status letters, stats).
 * ===================================================================== */
.owt-gp-root {
  --owt-font-code: var(--ds-font-family-code, "SF Mono", "JetBrains Mono", Menlo, Consolas, ui-monospace, monospace);
  --owt-gp-hairline: color-mix(in srgb, var(--dsw-alias-border-l1) 72%, transparent);
  --owt-gp-hover: color-mix(in srgb, var(--dsw-alias-label-primary) 4%, transparent);
  --owt-gp-select: color-mix(in srgb, var(--dsw-alias-label-primary) 7%, transparent);
  --owt-gp-green: var(--dsw-alias-state-success-primary, #16a34a);
  --owt-gp-red: var(--dsw-alias-state-error-primary, #dc2626);
  --owt-gp-amber: var(--dsw-alias-state-warn-primary, #d97706);
  --owt-gp-blue: var(--dsw-alias-brand-primary, #2563eb);

  container-type: inline-size;
  container-name: owt-gp;
  display: flex;
  flex-direction: row;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  color: var(--dsw-alias-label-primary);
  background: var(--dsw-alias-bg-base);
  font-size: 13px;
  -webkit-font-smoothing: antialiased;
}

/* ---------- Left Source-Control Sidebar ---------- */
.owt-gp-sidebar {
  width: 288px;
  min-width: 260px;
  max-width: 340px;
  flex: none;
  display: flex;
  flex-direction: column;
  min-height: 0;
  border-right: 1px solid var(--owt-gp-hairline);
  background: var(--dsw-alias-bg-base);
  user-select: none;
}

.owt-gp-branchbar {
  display: flex;
  align-items: center;
  gap: 4px;
  min-height: 40px;
  box-sizing: border-box;
  padding: 6px 8px 6px 12px;
  border-bottom: 1px solid var(--owt-gp-hairline);
  flex: none;
}

.owt-gp-branch-left {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
  flex: 1;
}

.owt-gp-branch-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  max-width: 170px;
  padding: 3px 0;
  color: var(--dsw-alias-label-primary);
  font-family: var(--owt-font-code);
  font-size: 12px;
  font-weight: 600;
}

.owt-gp-branch-pill > span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Orca-style totals on the branch row: tabular, thousands-separated, right-aligned. */
.owt-gp-branch-totals {
  display: inline-flex;
  gap: 7px;
  margin-left: auto;
  font-family: var(--owt-font-code);
  font-size: 11.5px;
  font-variant-numeric: tabular-nums;
}

.owt-gp-branchbar[data-has-upstream="true"] {
  border-bottom: none;
}

.owt-gp-upstream-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  box-sizing: border-box;
  padding: 2px 10px 7px 32px;
  border-bottom: 1px solid var(--owt-gp-hairline);
  flex: none;
}

.owt-gp-upstream {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
  font-family: var(--owt-font-code);
  font-size: 11px;
  color: var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.owt-gp-upstream-counts {
  display: inline-flex;
  gap: 6px;
  font-family: var(--owt-font-code);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  flex: none;
}

.owt-gp-ahead {
  color: var(--owt-gp-green);
  font-weight: 600;
}

.owt-gp-behind {
  color: var(--owt-gp-red);
  font-weight: 600;
}

.owt-gp-iconbtn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
  flex: none;
  transition: background 120ms ease, color 120ms ease;
}

.owt-gp-iconbtn[data-active="true"] {
  color: var(--owt-gp-blue);
  background: var(--owt-gp-select);
}

.owt-gp-iconbtn:hover:not(:disabled) {
  background: var(--owt-gp-hover);
  color: var(--dsw-alias-label-primary);
}

.owt-gp-iconbtn:disabled {
  opacity: 0.4;
  cursor: default;
}

.owt-gp-root :where(button, input, textarea, [role="button"]):focus-visible {
  outline: 2px solid color-mix(in srgb, var(--owt-gp-blue) 78%, var(--dsw-alias-label-primary));
  outline-offset: 2px;
}

/* ---------- Commit Composer ---------- */
.owt-gp-composer {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 12px 12px;
  border-bottom: 1px solid var(--owt-gp-hairline);
  flex: none;
}

.owt-gp-textarea-box {
  position: relative;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--owt-gp-hairline);
  border-radius: 8px;
  background: transparent;
  transition: border-color 120ms ease, box-shadow 120ms ease;
}

.owt-gp-textarea-box:focus-within {
  border-color: color-mix(in srgb, var(--owt-gp-blue) 45%, var(--owt-gp-hairline));
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--owt-gp-blue) 8%, transparent);
}

.owt-gp-textarea {
  width: 100%;
  box-sizing: border-box;
  border: none;
  outline: none;
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font-family: inherit;
  font-size: 12.5px;
  line-height: 1.55;
  padding: 9px 34px 4px 11px;
  resize: vertical;
  min-height: 66px;
  max-height: 200px;
}

.owt-gp-textarea::placeholder {
  color: var(--dsw-alias-label-placeholder, var(--dsw-alias-label-tertiary));
}

.owt-gp-textarea:disabled {
  opacity: 0.55;
}

.owt-gp-textarea-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 3px 6px 6px 10px;
}

.owt-gp-subject-len {
  font-family: var(--owt-font-code);
  font-size: 10.5px;
  color: var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary));
  font-variant-numeric: tabular-nums;
}

.owt-gp-subject-len[data-warn="true"] {
  color: var(--owt-gp-amber);
}

/* Orca-style: sparkle floats in the box's top-right corner, icon only. */
.owt-gp-aibtn {
  position: absolute;
  top: 6px;
  right: 6px;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--owt-gp-blue);
  cursor: pointer;
  transition: background 120ms ease;
}

.owt-gp-aibtn:hover:not(:disabled) {
  background: color-mix(in srgb, var(--owt-gp-blue) 8%, transparent);
}

.owt-gp-aibtn:disabled {
  opacity: 0.4;
  cursor: default;
}

/* Orca-style file icon tinted by change status (M amber / A green / D red / R blue). */
.owt-gp-file-row[data-kind="M"] .owt-gp-file-icon {
  color: var(--owt-gp-amber);
  opacity: 0.9;
}

.owt-gp-file-row[data-kind="A"] .owt-gp-file-icon {
  color: var(--owt-gp-green);
  opacity: 0.9;
}

.owt-gp-file-row[data-kind="D"] .owt-gp-file-icon {
  color: var(--owt-gp-red);
  opacity: 0.9;
}

.owt-gp-file-row[data-kind="R"] .owt-gp-file-icon {
  color: var(--owt-gp-blue);
  opacity: 0.9;
}

/* Orca-style neutral commit bar: light gray, dark text, no brand fill. */
.owt-gp-submit {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  min-height: 36px;
  padding: 0 12px;
  border: none;
  border-radius: 8px;
  background: color-mix(in srgb, var(--dsw-alias-label-primary) 6%, transparent);
  color: var(--dsw-alias-label-primary);
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  transition: background 120ms ease;
}

.owt-gp-submit:hover:not(:disabled) {
  background: color-mix(in srgb, var(--dsw-alias-label-primary) 10%, transparent);
}

.owt-gp-submit:disabled {
  background: color-mix(in srgb, var(--dsw-alias-label-primary) 3.5%, transparent);
  color: var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary));
  cursor: default;
}

.owt-gp-alert {
  padding: 6px 9px;
  border-radius: 7px;
  font-size: 11.5px;
  line-height: 1.45;
  word-break: break-word;
}

.owt-gp-alert[data-kind="error"] {
  background: color-mix(in srgb, var(--owt-gp-red) 8%, transparent);
  color: var(--owt-gp-red);
}

.owt-gp-alert[data-kind="ok"] {
  background: color-mix(in srgb, var(--owt-gp-green) 8%, transparent);
  color: var(--owt-gp-green);
}

/* ---------- File Tree ---------- */
.owt-gp-tree-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px 6px;
  flex: none;
}

.owt-gp-checkall {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  cursor: pointer;
}

.owt-gp-checkall input[type="checkbox"],
.owt-gp-file-check {
  width: 13px;
  height: 13px;
  margin: 0;
  accent-color: var(--dsw-alias-label-secondary);
  cursor: pointer;
  flex: none;
}

.owt-gp-tree-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--dsw-alias-label-primary);
}

.owt-gp-count-pill {
  font-family: var(--owt-font-code);
  font-size: 10.5px;
  font-weight: 500;
  color: var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary));
}

.owt-gp-tree-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 2px 8px 14px;
}

.owt-gp-side-hint {
  padding: 16px 10px;
  text-align: center;
  font-size: 12px;
  color: var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary));
}

.owt-gp-group {
  display: flex;
  flex-direction: column;
  margin-bottom: 2px;
}

.owt-gp-dir-row {
  display: flex;
  align-items: center;
  gap: 5px;
  width: 100%;
  height: 25px;
  padding: 0 6px;
  border: none;
  border-radius: 5px;
  background: transparent;
  color: var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary));
  font-size: 12px;
  text-align: left;
  cursor: pointer;
}

.owt-gp-dir-row:hover {
  background: var(--owt-gp-hover);
  color: var(--dsw-alias-label-secondary);
}

.owt-gp-chevron {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 13px;
  color: var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary));
  opacity: 0.7;
  flex: none;
}

.owt-gp-dir-icon,
.owt-gp-file-icon {
  display: inline-flex;
  align-items: center;
  color: var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary));
  opacity: 0.85;
  flex: none;
}

.owt-gp-dir-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--owt-font-code);
  font-size: 11.5px;
}

.owt-gp-dir-count {
  font-family: var(--owt-font-code);
  font-size: 10.5px;
  color: var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary));
}

.owt-gp-file-row {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 28px;
  box-sizing: border-box;
  padding: 0 7px 0 6px;
  border-radius: 6px;
  cursor: pointer;
  min-width: 0;
}

.owt-gp-file-row[data-nested="true"] {
  padding-left: 15px;
}

.owt-gp-file-row:hover {
  background: var(--owt-gp-hover);
}

.owt-gp-file-row[data-active="true"] {
  background: var(--owt-gp-select);
}

.owt-gp-file-row[data-active="true"] .owt-gp-file-name {
  color: var(--dsw-alias-label-primary);
  font-weight: 600;
}

.owt-gp-file-row:focus-visible {
  outline: 2px solid var(--owt-gp-blue);
  outline-offset: -2px;
}

.owt-gp-file-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--owt-font-code);
  font-size: 12px;
}

/* Rename source half (old → new), muted so the destination stays primary. */
.owt-gp-oldname {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex-shrink: 1;
  font-family: var(--owt-font-code);
  font-size: 11.5px;
  color: var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary));
}

.owt-gp-file-stats {
  display: inline-flex;
  gap: 4px;
  flex: none;
  font-family: var(--owt-font-code);
  font-size: 10.5px;
  font-variant-numeric: tabular-nums;
}

.owt-gp-add {
  color: var(--owt-gp-green);
  font-weight: 500;
}

.owt-gp-del {
  color: var(--owt-gp-red);
  font-weight: 500;
}

/* Status letter, bare: color carries the meaning, no chip behind it. */
.owt-gp-badge {
  flex: none;
  min-width: 12px;
  text-align: center;
  font-family: var(--owt-font-code);
  font-size: 10.5px;
  font-weight: 600;
  color: var(--owt-gp-amber);
}

.owt-gp-badge[data-kind="A"] {
  color: var(--owt-gp-green);
}

.owt-gp-badge[data-kind="D"] {
  color: var(--owt-gp-red);
}

.owt-gp-badge[data-kind="R"] {
  color: var(--owt-gp-blue);
}

/* ---------- Right Diff Viewer Area ---------- */
.owt-gp-main {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: var(--dsw-alias-bg-base);
}

.owt-gp-main-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 40px;
  box-sizing: border-box;
  padding: 0 16px;
  border-bottom: 1px solid var(--owt-gp-hairline);
  flex: none;
}

.owt-gp-main-crumb {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
  color: var(--dsw-alias-label-secondary);
}

.owt-gp-crumb-text {
  font-family: var(--owt-font-code);
  font-size: 12px;
  font-weight: 500;
  color: var(--dsw-alias-label-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.owt-gp-seg {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  flex: none;
}

.owt-gp-main-actions {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
  flex: none;
}

.owt-gp-seg-btn {
  min-height: 26px;
  padding: 0 10px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font-size: 11.5px;
  font-weight: 500;
  cursor: pointer;
  transition: background 120ms ease, color 120ms ease;
}

.owt-gp-seg-btn:hover {
  background: var(--owt-gp-hover);
  color: var(--dsw-alias-label-primary);
}

.owt-gp-seg-btn[data-active="true"] {
  background: var(--owt-gp-select);
  color: var(--dsw-alias-label-primary);
  font-weight: 600;
}

.owt-gp-diff-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0 0 40px;
  box-sizing: border-box;
  scroll-padding-top: 0;
}

.owt-gp-cards {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding-top: 10px;
}

.owt-gp-card {
  background: var(--dsw-alias-bg-base);
  scroll-margin-top: 0;
}

.owt-gp-card-head {
  position: sticky;
  top: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  box-sizing: border-box;
  min-height: 34px;
  padding: 6px 16px;
  border: 0;
  border-bottom: 1px solid var(--owt-gp-hairline);
  background: var(--dsw-alias-bg-base);
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  user-select: none;
}

.owt-gp-card-head:hover {
  background: color-mix(in srgb, var(--dsw-alias-label-primary) 2.5%, var(--dsw-alias-bg-base));
}

.owt-gp-card-path {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--owt-font-code);
  font-size: 12px;
}

.owt-gp-card-dir {
  color: var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary));
}

.owt-gp-card-name {
  font-weight: 600;
  color: var(--dsw-alias-label-primary);
}

.owt-gp-card-stats {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  flex: none;
  font-family: var(--owt-font-code);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

.owt-gp-card-body {
  overflow: visible;
}

.owt-gp-card-empty {
  padding: 20px 16px;
  text-align: center;
  font-size: 12px;
  color: var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary));
}

/* ---------- Numbered Unified Diff Table ---------- */
.owt-gp-table-wrap {
  width: 100%;
  overflow-x: auto;
}

.owt-gp-table {
  width: 100%;
  border-collapse: collapse;
  font-family: var(--owt-font-code);
  font-size: 12px;
  line-height: 19px;
  tab-size: 2;
}

/* Collapsed-context strip between hunks (Orca style); label lives in title + SR text. */
.owt-gp-tr-hunk {
  background: transparent;
}

.owt-gp-td-hunk {
  padding: 4px 16px 4px 58px;
}

.owt-gp-hunk-strip {
  display: block;
  height: 9px;
  border-radius: 4.5px;
  background: color-mix(in srgb, var(--dsw-alias-label-primary) 7%, transparent);
}

.owt-gp-visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

.owt-gp-td-num {
  width: 46px;
  min-width: 46px;
  padding: 0 8px;
  text-align: right;
  font-size: 10.5px;
  font-variant-numeric: tabular-nums;
  color: color-mix(in srgb, var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary)) 72%, transparent);
  user-select: none;
  -webkit-user-select: none;
  vertical-align: top;
}

.owt-gp-td-sign {
  width: 14px;
  min-width: 14px;
  padding: 0 0 0 2px;
  text-align: center;
  font-weight: 400;
  user-select: none;
  -webkit-user-select: none;
  vertical-align: top;
}

.owt-gp-td-code {
  padding: 0 16px 0 4px;
  white-space: pre;
  user-select: text;
  -webkit-user-select: text;
  vertical-align: top;
}

.owt-gp-tr--add {
  background: color-mix(in srgb, var(--owt-gp-green) 10%, transparent);
}

.owt-gp-tr--add .owt-gp-td-num {
  color: color-mix(in srgb, var(--owt-gp-green) 70%, var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary)));
}

.owt-gp-tr--add .owt-gp-td-sign {
  color: color-mix(in srgb, var(--owt-gp-green) 75%, transparent);
}

.owt-gp-tr--del {
  background: color-mix(in srgb, var(--owt-gp-red) 10%, transparent);
}

.owt-gp-tr--del .owt-gp-td-num {
  color: color-mix(in srgb, var(--owt-gp-red) 70%, var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary)));
}

.owt-gp-tr--del .owt-gp-td-sign {
  color: color-mix(in srgb, var(--owt-gp-red) 75%, transparent);
}

/* Intra-line highlight: the exact half-line that changed inside a paired add/del row. */
.owt-gp-tr--add .owt-gp-inline-chg {
  background: color-mix(in srgb, var(--owt-gp-green) 22%, transparent);
  border-radius: 2px;
}

.owt-gp-tr--del .owt-gp-inline-chg {
  background: color-mix(in srgb, var(--owt-gp-red) 22%, transparent);
  border-radius: 2px;
}

/* Dot marking rows whose status letter says content is already staged. */
.owt-gp-staged-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--owt-gp-blue);
  flex-shrink: 0;
}

.owt-gp-truncated {
  padding: 8px 16px;
  font-size: 11.5px;
  color: var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary));
  text-align: center;
}

/* ---------- Empty / Clean States ---------- */
.owt-gp-empty-full {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 100%;
  min-height: 260px;
  padding: 32px;
  text-align: center;
}

.owt-gp-empty-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary));
  opacity: 0.8;
  margin-bottom: 4px;
}

.owt-gp-empty-icon[data-clean="true"] {
  color: var(--owt-gp-green);
}

.owt-gp-empty-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--dsw-alias-label-primary);
}

.owt-gp-empty-sub {
  font-size: 12.5px;
  color: var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary));
  max-width: 340px;
  line-height: 1.5;
}


@media (prefers-reduced-motion: reduce) {
  .owt-gp-root,
  .owt-gp-root * {
    scroll-behavior: auto !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}

/* Responsive layout follows the review pane width, not the browser viewport. */
@container owt-gp (max-width: 800px) {
  .owt-gp-root {
    flex-direction: column;
    overflow: hidden;
  }
  .owt-gp-sidebar {
    width: 100%;
    max-width: none;
    height: 42%;
    min-height: 220px;
    border-right: none;
    border-bottom: 1px solid var(--owt-gp-hairline);
  }
  .owt-gp-main {
    min-height: 0;
  }
}

/* ─ P0 git review: tabs / hunk controls / log / blame / compare / push overlay ─ */
.owt-gp-root {
  position: relative;
}
.owt-gp-card-head-btn {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0;
  border: none;
  background: none;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.owt-gp-head-actions {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex: none;
}
.owt-gp-headbtn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 20px;
  padding: 0 7px;
  border: none;
  border-radius: 5px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font-size: 11px;
  cursor: pointer;
  flex: none;
}
.owt-gp-headbtn:hover:not(:disabled) {
  background: var(--owt-gp-hover);
  color: var(--dsw-alias-label-primary);
}
.owt-gp-headbtn[data-danger='true']:hover:not(:disabled) {
  color: var(--owt-gp-red);
  background: color-mix(in srgb, var(--owt-gp-red) 8%, transparent);
}
.owt-gp-headbtn:disabled {
  opacity: 0.4;
  cursor: default;
}
.owt-gp-hunk-bar {
  display: flex;
  align-items: center;
  gap: 8px;
}
.owt-gp-hunk-check {
  width: 12px;
  height: 12px;
  margin: 0;
  accent-color: var(--dsw-alias-label-secondary);
  cursor: pointer;
  flex: none;
}
.owt-gp-commitlist {
  display: flex;
  flex-direction: column;
  padding: 8px 0 40px;
}
.owt-gp-commit-row {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 5px 16px;
  border: none;
  background: none;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
button.owt-gp-commit-row:hover {
  background: var(--owt-gp-hover);
}
.owt-gp-commit-hash {
  font-family: var(--owt-font-code);
  font-size: 11.5px;
  color: var(--owt-gp-amber);
  flex: none;
}
.owt-gp-commit-author,
.owt-gp-commit-date {
  flex: none;
  font-size: 11.5px;
  color: var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary));
}
.owt-gp-commit-subj {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
}
.owt-gp-detail-bar {
  position: sticky;
  top: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 16px;
  background: var(--dsw-alias-bg-base);
  border-bottom: 1px solid var(--owt-gp-hairline);
}
.owt-gp-detail-meta {
  font-size: 11.5px;
  color: var(--dsw-alias-label-secondary);
}
.owt-gp-blame-meta {
  padding: 0 10px 0 16px;
  font-family: var(--owt-font-code);
  font-size: 10.5px;
  color: var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary));
  white-space: nowrap;
  max-width: 340px;
  overflow: hidden;
  text-overflow: ellipsis;
}
.owt-gp-select,
.owt-gp-filter {
  min-height: 26px;
  padding: 2px 8px;
  border: 1px solid var(--owt-gp-hairline);
  border-radius: 6px;
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font-size: 11.5px;
}
.owt-gp-filter {
  width: 180px;
}
.owt-gp-hint {
  font-size: 11px;
  color: var(--owt-gp-amber);
  line-height: 1.4;
}
.owt-gp-overlay {
  position: absolute;
  inset: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--dsw-alias-label-primary) 18%, transparent);
}
.owt-gp-overlay-box {
  width: min(520px, 92%);
  max-height: 80%;
  overflow: auto;
  background: var(--dsw-alias-bg-base);
  border: 1px solid var(--owt-gp-hairline);
  border-radius: 10px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.18);
}
.owt-gp-overlay-title {
  font-weight: 600;
  font-size: 13px;
}
.owt-gp-overlay-list {
  max-height: 220px;
  overflow: auto;
  border: 1px solid var(--owt-gp-hairline);
  border-radius: 7px;
}
.owt-gp-overlay-actions {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 8px;
}
.owt-gp-push-confirm {
  width: auto;
  min-width: 120px;
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