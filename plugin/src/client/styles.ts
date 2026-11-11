/**
 * Orca-style sidebar tree styles using strictly host `--dsw-alias-*` and
 * `--dsh-sidebar-*` CSS variables so light and dark themes switch natively.
 * @module dsh-worktree-plugin/client/styles
 */

const STYLE_ID = 'dsh-worktree-plugin-styles'

/** Orca lineage child indent step (18px per level). */
export const TREE_INDENT_PX = 18

const CSS = `
.owt-root {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  box-sizing: border-box;
  color: var(--dsw-alias-label-primary);
  font-size: 13px;
  user-select: none;
  -webkit-user-select: none;
}

.owt-rail {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 6px 0;
}

.owt-toolbar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px 6px 14px;
  flex: none;
}

.owt-toolbar-title {
  font-size: 12px;
  font-weight: 500;
  color: var(--dsw-alias-label-secondary);
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.owt-search-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 0;
  height: 26px;
  padding: 0 8px;
  border-radius: 7px;
  border: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-layer-1);
}

.owt-search-wrap input {
  flex: 1;
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 12px;
}

.owt-search-wrap input::placeholder {
  color: var(--dsw-alias-label-secondary);
}

.owt-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 2px 8px 16px 8px;
}

.owt-group {
  margin-bottom: 10px;
}

/* Repository header row: 📁 repo-name   ⌄ ••• + */
.owt-repo-row {
  display: flex;
  align-items: center;
  gap: 7px;
  min-height: 30px;
  padding: 2px 6px;
  border-radius: 8px;
  cursor: pointer;
}

.owt-repo-row:hover {
  background: var(--dsw-alias-bg-layer-2);
}

.owt-repo-icon {
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
  font-size: 13.5px;
  font-weight: 600;
  line-height: 20px;
  color: var(--dsw-alias-label-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.owt-hover-actions {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  opacity: 0;
  transition: opacity 100ms ease;
  flex: none;
}

.owt-repo-row:hover .owt-hover-actions,
.owt-repo-row:focus-within .owt-hover-actions,
.owt-wt-row:hover .owt-hover-actions,
.owt-wt-row:focus-within .owt-hover-actions,
.owt-chat-row:hover .owt-hover-actions {
  opacity: 1;
}

@media (hover: none) {
  .owt-hover-actions {
    opacity: 1;
  }
}

.owt-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
  flex: none;
}

.owt-icon-btn:hover {
  color: var(--dsw-alias-label-primary);
  background: var(--dsw-alias-bg-layer-1);
}

/* Worktree branch row: ● feat_gen_task         ★ */
.owt-wt-block {
  display: flex;
  flex-direction: column;
}

.owt-wt-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 34px;
  padding: 3px 8px 3px 9px;
  margin: 1px 0;
  border-radius: 9px;
  cursor: pointer;
  transition: background-color 100ms ease;
}

.owt-wt-row:hover {
  background: var(--dsw-alias-bg-layer-1);
}

.owt-wt-row[data-active="true"] {
  background: var(--dsw-alias-bg-layer-2);
}

/* Status dot (green idle/ready, brand pulsing when running, warn when waiting) */
.owt-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  flex: none;
  background: var(--dsw-alias-state-success-primary);
}

.owt-dot[data-status="running"] {
  background: var(--dsw-alias-state-success-primary);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--dsw-alias-state-success-primary) 24%, transparent);
  animation: owt-pulse 1.4s ease-in-out infinite;
}

.owt-dot[data-status="pending"] {
  background: var(--dsw-alias-state-warn-primary);
}

@keyframes owt-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.45; }
}

@keyframes owt-spin {
  to { transform: rotate(360deg); }
}

/* Conversation running marker: ring spinner (idle conversations show nothing, like stock DSH) */
.owt-loading {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  flex: none;
  border: 1.5px solid color-mix(in srgb, var(--dsw-alias-brand-primary) 30%, transparent);
  border-top-color: var(--dsw-alias-brand-primary);
  animation: owt-spin 0.8s linear infinite;
}

.owt-wt-branch {
  flex: 1;
  min-width: 0;
  font-size: 13.5px;
  font-weight: 450;
  line-height: 20px;
  color: var(--dsw-alias-label-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.owt-dirty-pill {
  flex: none;
  font-size: 10.5px;
  line-height: 15px;
  padding: 0 5px;
  border-radius: 999px;
  color: var(--dsw-alias-label-secondary);
  border: 1px solid var(--dsw-alias-border-l1);
}

.owt-missing-pill {
  flex: none;
  font-size: 10.5px;
  line-height: 15px;
  padding: 0 5px;
  border-radius: 999px;
  color: var(--dsw-alias-state-warn-primary);
  border: 1px solid color-mix(in srgb, var(--dsw-alias-state-warn-primary) 45%, transparent);
}

.owt-repo-row[data-missing="true"] .owt-repo-name {
  opacity: 0.65;
}

/* Chat count / expand pill when a worktree hosts conversations */
.owt-chat-pill {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  height: 18px;
  padding: 0 5px;
  border-radius: 5px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: 11px;
  cursor: pointer;
  flex: none;
}

.owt-chat-pill:hover,
.owt-chat-pill[aria-expanded="true"] {
  border-color: var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-primary);
}

/* Yellow star button: resting visible when pinned, hover-visible when unpinned */
.owt-star-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
  flex: none;
  opacity: 0;
  transition: opacity 100ms ease, transform 100ms ease;
}

.owt-star-btn[data-pinned="true"] {
  color: var(--dsw-alias-state-warn-primary);
  opacity: 1;
}

.owt-wt-row:hover .owt-star-btn,
.owt-wt-row:focus-within .owt-star-btn {
  opacity: 1;
}

.owt-star-btn:hover {
  transform: scale(1.1);
}

/* Orca child-worktree lineage capsule row: [ ⑂ 2 | ● 1 ● 1 ⌄ ] */
.owt-capsule-wrap {
  display: flex;
  align-items: center;
  padding: 1px 8px 4px 24px;
}

.owt-capsule {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 21px;
  padding: 0 7px;
  border-radius: 6px;
  border: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-base);
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 11.5px;
  line-height: 1;
  cursor: pointer;
}

.owt-capsule:hover {
  border-color: var(--dsw-alias-border-l2);
  background: var(--dsw-alias-bg-layer-1);
}

.owt-capsule-sep {
  width: 1px;
  height: 11px;
  background: var(--dsw-alias-border-l1);
}

.owt-capsule-stat {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  color: var(--dsw-alias-label-secondary);
}

.owt-mini-dot {
  width: 6.5px;
  height: 6.5px;
  border-radius: 999px;
  background: var(--dsw-alias-state-success-primary);
}

.owt-mini-dot[data-tone="warn"] {
  background: var(--dsw-alias-state-warn-primary);
}

/* Expandable conversation sub-rows under a worktree */
.owt-chats {
  display: flex;
  flex-direction: column;
  gap: 1px;
  margin: 1px 0 4px 23px;
  padding-left: 8px;
  border-left: 1px solid var(--dsw-alias-border-l1);
}

.owt-chat-row {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 27px;
  padding: 2px 6px 2px 8px;
  border-radius: 7px;
  cursor: pointer;
  font-size: 12.5px;
  color: var(--dsw-alias-label-secondary);
}

.owt-chat-row:hover {
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-primary);
}

.owt-chat-row[data-selected="true"] {
  background: var(--dsw-alias-bg-layer-2);
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

.owt-empty {
  padding: 24px 12px;
  text-align: center;
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
}

.owt-toast {
  margin: 4px 10px 8px;
  padding: 6px 10px;
  border-radius: 8px;
  border: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-secondary);
  font-size: 11.5px;
}

.owt-toast[data-kind="error"] {
  color: var(--dsw-alias-state-error-primary);
}

/* Lightweight modal overlay portaled to document.body */
.owt-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--dsw-alias-bg-base) 55%, transparent);
  backdrop-filter: blur(2px);
}

.owt-modal {
  width: min(380px, calc(100vw - 32px));
  box-sizing: border-box;
  padding: 16px;
  border-radius: 12px;
  border: 1px solid var(--dsw-alias-border-l2);
  background: var(--dsw-alias-bg-overlay);
  color: var(--dsw-alias-label-primary);
  font-size: 13px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.owt-modal-title {
  font-size: 14px;
  font-weight: 600;
}

.owt-modal-desc {
  font-size: 12px;
  color: var(--dsw-alias-label-secondary);
  line-height: 1.45;
}

.owt-modal-desc[data-kind="danger"] {
  color: var(--dsw-alias-state-error-primary);
}

.owt-input {
  width: 100%;
  box-sizing: border-box;
  height: 32px;
  padding: 0 10px;
  border-radius: 8px;
  border: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-base);
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 12.5px;
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
  height: 32px;
  padding: 0 8px;
  border-radius: 8px;
  border: 1px solid var(--dsw-alias-border-l1);
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
  width: 32px;
  height: 32px;
  padding: 0;
  border-radius: 8px;
  border: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
  flex: none;
}

.owt-fetch-btn:hover:not(:disabled) {
  border-color: var(--dsw-alias-border-l2);
  background: var(--dsw-alias-bg-layer-2);
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
  margin-top: 4px;
}

.owt-btn {
  height: 30px;
  padding: 0 12px;
  border-radius: 7px;
  border: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 12.5px;
  cursor: pointer;
}

.owt-btn:hover:not(:disabled) {
  border-color: var(--dsw-alias-border-l2);
  background: var(--dsw-alias-bg-layer-2);
}

.owt-btn:disabled {
  opacity: 0.45;
  cursor: default;
}

.owt-btn[data-kind="primary"] {
  background: var(--dsw-alias-brand-primary);
  border-color: var(--dsw-alias-brand-primary);
  color: var(--dsw-alias-bg-base);
}

.owt-btn[data-kind="danger"] {
  color: var(--dsw-alias-state-error-primary);
}

.owt-btn-xs {
  height: 25px;
  padding: 0 9px;
  font-size: 11.5px;
  border-radius: 6px;
}

/* Settings -> Archived Sessions section */
.owt-arch-root {
  display: flex;
  flex-direction: column;
  gap: 14px;
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
  gap: 4px;
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
  font-size: 11.5px;
  font-weight: 500;
  line-height: 18px;
  padding: 0 7px;
  border-radius: 999px;
  background: var(--dsw-alias-bg-layer-2);
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
  height: 32px;
  padding: 0 10px;
  border-radius: 8px;
  border: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-layer-1);
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

.owt-arch-search input::placeholder {
  color: var(--dsw-alias-label-secondary);
}

.owt-arch-empty {
  padding: 36px 16px;
  text-align: center;
  border-radius: 12px;
  border: 1px dashed var(--dsw-alias-border-l1);
  color: var(--dsw-alias-label-secondary);
  font-size: 12.5px;
}

.owt-arch-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.owt-arch-card {
  border-radius: 12px;
  border: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-layer-1);
  overflow: hidden;
}

.owt-arch-repo-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  cursor: pointer;
  user-select: none;
}

.owt-arch-repo-head:hover {
  background: var(--dsw-alias-bg-layer-2);
}

.owt-arch-repo-name {
  flex: 1;
  min-width: 0;
  font-size: 13.5px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.owt-arch-branches {
  display: flex;
  flex-direction: column;
  border-top: 1px solid var(--dsw-alias-border-l1);
  padding: 6px 10px 10px;
  gap: 6px;
}

.owt-arch-branch-group {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.owt-arch-branch-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 4px 6px;
  border-radius: 7px;
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

.owt-arch-branch-name {
  font-size: 12.5px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.owt-arch-link-btn {
  border: 0;
  background: transparent;
  padding: 2px 6px;
  border-radius: 5px;
  font: inherit;
  font-size: 11.5px;
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
  flex: none;
}

.owt-arch-link-btn:hover:not(:disabled) {
  color: var(--dsw-alias-label-primary);
  background: var(--dsw-alias-bg-layer-2);
}

.owt-arch-sessions {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.owt-arch-sessions[data-indented="true"] {
  margin-left: 18px;
  padding-left: 10px;
  border-left: 1px solid var(--dsw-alias-border-l1);
}

.owt-arch-session-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 34px;
  padding: 4px 8px;
  border-radius: 8px;
}

.owt-arch-session-row:hover {
  background: var(--dsw-alias-bg-layer-2);
}

.owt-arch-session-main {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.owt-arch-session-title {
  flex: 1;
  min-width: 0;
  font-size: 12.5px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.owt-arch-session-time {
  flex: none;
  font-size: 11px;
  color: var(--dsw-alias-label-secondary);
}

.owt-arch-session-actions {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex: none;
}
`

export function injectStyles(): void {
  if (document.getElementById(STYLE_ID) !== null) return
  const element = document.createElement('style')
  element.id = STYLE_ID
  element.textContent = CSS
  document.head.append(element)
}

export function removeStyles(): void {
  document.getElementById(STYLE_ID)?.remove()
}
