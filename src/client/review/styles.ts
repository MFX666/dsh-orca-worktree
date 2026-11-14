/**
 * Styles for the git review panel (`.owt-gp-*` classes only). One CSS blob
 * injected once under a plugin-owned style element id.
 * @module dsh-git-review-plugin/client/styles
 */

export const STYLE_ID = 'dsh-git-review-plugin-styles'

const CSS = `
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

/* ---- commit graph (left pane, below the changes tree) ---- */
.owt-gp-graph {
  flex: none;
  display: flex;
  flex-direction: column;
  min-height: 0;
  border-top: 1px solid var(--owt-gp-hairline);
  background: var(--dsw-alias-bg-base);
}
.owt-gp-graph[data-open='true'] {
  height: 42%;
  min-height: 140px;
}
.owt-gp-graph-head {
  flex: none;
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 7px 10px;
  border: none;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font-size: 11.5px;
  font-weight: 600;
  cursor: pointer;
  text-align: left;
}
.owt-gp-graph-head:hover {
  color: var(--dsw-alias-label-primary);
  background: var(--dsw-alias-interactive-bg-hover, rgba(127, 127, 127, 0.08));
}
.owt-gp-graph-title {
  flex: none;
}
.owt-gp-graph-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0 6px 10px;
}
.owt-gp-graph-row {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 24px;
  padding: 0 4px 0 0;
  border-radius: 6px;
  cursor: pointer;
  min-width: 0;
}
.owt-gp-graph-row:hover {
  background: var(--dsw-alias-interactive-bg-hover, rgba(127, 127, 127, 0.08));
}
.owt-gp-graph-row:focus-visible {
  outline: 1px solid var(--dsw-alias-border-focus, var(--owt-gp-hairline));
}
.owt-gp-graph-cell {
  flex: none;
  display: block;
}
.owt-gp-ref {
  flex: none;
  max-width: 110px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 10px;
  font-weight: 600;
  line-height: 1;
  padding: 2px 5px;
  border-radius: 999px;
  background: var(--dsw-alias-interactive-bg-hover, rgba(127, 127, 127, 0.12));
  color: var(--dsw-alias-label-secondary);
}
.owt-gp-ref-head {
  color: var(--dsw-alias-state-success-primary, #3fb950);
}
.owt-gp-ref-local {
  color: var(--dsw-alias-brand-primary, #4d6bfe);
}
.owt-gp-ref-remote {
  color: #b083f0;
}
.owt-gp-ref-tag {
  color: var(--dsw-alias-state-warn-primary, #e2a03f);
}
.owt-gp-ref-more {
  color: var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary));
  cursor: help;
}
.owt-gp-graph-subject {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  color: var(--dsw-alias-label-primary);
}
.owt-gp-graph-date {
  flex: none;
  font-family: var(--owt-font-code);
  font-size: 10.5px;
  color: var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary));
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
