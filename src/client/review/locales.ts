/**
 * Locale dictionaries for the git review panel. Lives under the `gitReview`
 * namespace; keys cover the conversation-view Git tab only.
 * @module dsh-git-review-plugin/client/locales
 */

export const NS = 'gitReview'

export type GitReviewKey =
  | 'view.gitTab'
  | 'dialog.commit.loading'
  | 'dialog.commit.clean'
  | 'dialog.commit.cleanSub'
  | 'dialog.commit.msgPlaceholder'
  | 'dialog.commit.ai'
  | 'dialog.commit.aiDoing'
  | 'dialog.commit.submit'
  | 'dialog.commit.submitting'
  | 'dialog.commit.changes'
  | 'dialog.commit.selectAll'
  | 'dialog.commit.selectFile'
  | 'dialog.commit.refresh'
  | 'dialog.commit.staged'
  | 'dialog.commit.ignoreWs'
  | 'dialog.commit.push'
  | 'dialog.commit.pushNoUpstream'
  | 'dialog.commit.modeSingle'
  | 'dialog.commit.modeAll'
  | 'dialog.commit.noTarget'
  | 'dialog.commit.truncated'
  | 'dialog.commit.noDiffText'
  | 'notice.pushed'
  | 'notice.committed'
  | 'notice.error'
  | 'gp.tab.changes'
  | 'gp.tab.log'
  | 'gp.tab.compare'
  | 'gp.log.all'
  | 'gp.log.ahead'
  | 'gp.log.filter'
  | 'gp.log.empty'
  | 'gp.log.limit'
  | 'gp.log.noUpstream'
  | 'gp.graph.title'
  | 'gp.graph.empty'
  | 'gp.graph.more'
  | 'gp.detail.back'
  | 'gp.detail.files'
  | 'gp.detail.truncated'
  | 'gp.history'
  | 'gp.blame'
  | 'gp.blame.lineTitle'
  | 'gp.hunk.stage'
  | 'gp.hunk.stageTitle'
  | 'gp.hunk.staged'
  | 'gp.hunk.discard'
  | 'gp.hunk.discardTitle'
  | 'gp.hunk.discarded'
  | 'gp.hunk.discardConfirm'
  | 'gp.hunk.select'
  | 'gp.commit.hunkHint'
  | 'gp.push.title'
  | 'gp.push.forceLease'
  | 'gp.push.confirm'
  | 'gp.push.cancel'
  | 'gp.push.empty'
  | 'gp.compare.pick'
  | 'gp.compare.pickHint'
  | 'gp.compare.empty'

export const zh: Record<GitReviewKey, string> = {
  'view.gitTab': '审查',
  'dialog.commit.loading': '正在读取改动…',
  'dialog.commit.clean': '工作区干净，暂无未提交改动',
  'dialog.commit.cleanSub': '修改代码后，可在此审阅差异并使用 AI 生成提交说明',
  'dialog.commit.msgPlaceholder': '输入提交说明（首行标题，Cmd/Ctrl+Enter 快速提交）…',
  'dialog.commit.ai': 'AI 生成',
  'dialog.commit.aiDoing': '生成中…',
  'dialog.commit.submit': '提交更改 ({count})',
  'dialog.commit.submitting': '提交中…',
  'dialog.commit.changes': '更改',
  'dialog.commit.selectAll': '全选 / 取消全选',
  'dialog.commit.selectFile': '选择 {file}',
  'dialog.commit.refresh': '刷新状态',
  'dialog.commit.staged': '包含已暂存改动',
  'dialog.commit.ignoreWs': '忽略空白差异',
  'dialog.commit.push': '推送到远程（领先 {count} 个提交）',
  'dialog.commit.pushNoUpstream': '推送并建立上游分支',
  'dialog.commit.modeSingle': '单文件',
  'dialog.commit.modeAll': '全部差异',
  'dialog.commit.noTarget': '请先打开一个对话，再查看其工作树改动',
  'dialog.commit.truncated': '差异内容较大，仅展示前 {count} 行',
  'dialog.commit.noDiffText': '二进制文件或空文件变更，无可展示文本差异',
  'notice.pushed': '已推送 {branch} → {upstream}',
  'notice.committed': '已提交 {commit} · {summary}',
  'notice.error': '操作失败：{message}',
  'gp.tab.changes': '变更',
  'gp.tab.log': '日志',
  'gp.tab.compare': '比较',
  'gp.log.all': '全部',
  'gp.log.ahead': '未推送',
  'gp.log.filter': '过滤 subject / 作者 / hash…',
  'gp.log.empty': '无提交',
  'gp.log.limit': '仅显示前 {count} 条',
  'gp.log.noUpstream': '未设置 upstream，无法筛选未推送提交',
  'gp.graph.title': '提交图谱',
  'gp.graph.empty': '无提交',
  'gp.graph.more': '另有 {count} 个引用',
  'gp.detail.back': '返回',
  'gp.detail.files': '{count} 个文件',
  'gp.detail.truncated': '提交内容过大，仅显示部分差异',
  'gp.history': '历史',
  'gp.blame': 'Blame',
  'gp.blame.lineTitle': '{meta}',
  'gp.hunk.stage': '暂存',
  'gp.hunk.stageTitle': '将该 hunk 暂存到 index',
  'gp.hunk.staged': '已暂存 1 个 hunk',
  'gp.hunk.discard': '丢弃',
  'gp.hunk.discardTitle': '丢弃该 hunk 的未暂存改动',
  'gp.hunk.discarded': '已丢弃 1 个 hunk',
  'gp.hunk.discardConfirm': '确认丢弃该 hunk 的未暂存改动？此操作不可撤销。',
  'gp.hunk.select': '该 hunk 参与本次提交',
  'gp.commit.hunkHint': 'hunk 勾选仅在文件未整体勾选时生效；整体勾选优先。',
  'gp.push.title': '推送 {count} 个提交',
  'gp.push.forceLease': '使用 --force-with-lease 覆盖远程',
  'gp.push.confirm': '确认推送',
  'gp.push.cancel': '取消',
  'gp.push.empty': '本地无待推提交',
  'gp.compare.pick': '选择基准分支…',
  'gp.compare.pickHint': '从右上角选择一个基准分支以比较差异',
  'gp.compare.empty': '相对 {ref} 无差异',
}

export const en: Record<GitReviewKey, string> = {
  'view.gitTab': 'Review',
  'dialog.commit.loading': 'Loading changes…',
  'dialog.commit.clean': 'Working tree clean',
  'dialog.commit.cleanSub': 'Edit files to inspect diffs and generate commit messages with AI',
  'dialog.commit.msgPlaceholder': 'Commit message (first line subject, Cmd/Ctrl+Enter to commit)…',
  'dialog.commit.ai': 'AI Write',
  'dialog.commit.aiDoing': 'Writing…',
  'dialog.commit.submit': 'Commit ({count})',
  'dialog.commit.submitting': 'Committing…',
  'dialog.commit.changes': 'Changes',
  'dialog.commit.selectAll': 'Toggle select all',
  'dialog.commit.selectFile': 'Select {file}',
  'dialog.commit.refresh': 'Refresh status',
  'dialog.commit.staged': 'Has staged changes',
  'dialog.commit.ignoreWs': 'Ignore whitespace changes',
  'dialog.commit.push': 'Push to remote ({count} commit(s) ahead)',
  'dialog.commit.pushNoUpstream': 'Push and set upstream',
  'dialog.commit.modeSingle': 'Selected file',
  'dialog.commit.modeAll': 'All diffs',
  'dialog.commit.noTarget': 'Open a conversation first to review its checkout',
  'dialog.commit.truncated': 'Large diff — showing first {count} lines',
  'dialog.commit.noDiffText': 'Binary or empty file change — no text diff',
  'notice.pushed': 'Pushed {branch} → {upstream}',
  'notice.committed': 'Committed {commit} · {summary}',
  'notice.error': 'Action failed: {message}',
  'gp.tab.changes': 'Changes',
  'gp.tab.log': 'Log',
  'gp.tab.compare': 'Compare',
  'gp.log.all': 'All',
  'gp.log.ahead': 'Unpushed',
  'gp.log.filter': 'Filter subject, author, hash…',
  'gp.log.empty': 'No commits',
  'gp.log.limit': 'Showing first {count} commits',
  'gp.log.noUpstream': 'No upstream configured — unpushed filter unavailable',
  'gp.graph.title': 'Commit Graph',
  'gp.graph.empty': 'No commits',
  'gp.graph.more': '{count} more refs',
  'gp.detail.back': 'Back',
  'gp.detail.files': '{count} file(s)',
  'gp.detail.truncated': 'Large commit — showing partial diff',
  'gp.history': 'History',
  'gp.blame': 'Blame',
  'gp.blame.lineTitle': '{meta}',
  'gp.hunk.stage': 'Stage',
  'gp.hunk.stageTitle': 'Stage this hunk into the index',
  'gp.hunk.staged': 'Staged 1 hunk',
  'gp.hunk.discard': 'Discard',
  'gp.hunk.discardTitle': 'Discard unstaged changes in this hunk',
  'gp.hunk.discarded': 'Discarded 1 hunk',
  'gp.hunk.discardConfirm': 'Discard the unstaged changes in this hunk? This cannot be undone.',
  'gp.hunk.select': 'Include this hunk in this commit',
  'gp.commit.hunkHint': 'Hunk selection applies only when its file is not fully selected; whole-file wins.',
  'gp.push.title': 'Push {count} commit(s)',
  'gp.push.forceLease': 'Overwrite remote with --force-with-lease',
  'gp.push.confirm': 'Push',
  'gp.push.cancel': 'Cancel',
  'gp.push.empty': 'Nothing to push',
  'gp.compare.pick': 'Choose base branch…',
  'gp.compare.pickHint': 'Pick a base branch above to compare changes',
  'gp.compare.empty': 'No differences vs {ref}',
}
