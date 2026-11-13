# P0 Git 审查功能验收指南

> 交付基线：`pnpm build` 通过（host 96.25 kB / client 250.64 kB），`tsc --noEmit` 0 错，`node --test test/*.test.mjs` 20/20。

## 生效方式

重新加载插件宿主（重启 DSH 会话或重载插件），让新的 `lib/` 被加载后打开 worktree 面板。

## 验收清单（按 docs/p0-git-review-contract.md 冻结范围）

### 1. 部分提交（hunk 级）
- 右栏「变更」tab：每个 hunk 横幅出现勾选框 + [暂存] + [丢弃]。
- 勾选某文件的部分 hunk（不整体勾选文件）→ 填 message → 提交：
  - 确认 HEAD 只包含选中的 hunk；
  - 工作区仍保留未选中改动（git diff 仍在）；
  - 用户的 index 未被污染（git diff --cached 与提交前一致）。
- untracked 文件的 hunk 勾选 → 自动退化为整文件提交（composer 下有提示文案）。
- 文件整体勾选优先于其 hunk 勾选。
- [暂存]：仅把该 hunk 写入 index（git diff --cached 可见）；[丢弃]：弹 confirm 后反向应用，改动消失。

### 2. 日志 tab
- 提交列表 ≤200 条，shortHash / author / date / subject；过滤框按 subject/author/shortHash 实时过滤。
- 有 upstream 时可切「未推送 upstream..HEAD」；无 upstream 该预设禁用。
- 点提交 → 详情（变更表 + diff 只读渲染，返回按钮回列表）。

### 3. 历史（文件级）
- 变更 tab 文件头 [历史] → 该文件提交列表 → 点提交看该提交详情。

### 4. Blame
- 文件头 [Blame] → 整文件视图，左 gutter 显示 shortHash/author/date/subject（hover title 为全量）；>5000 行提示 truncated；可返回。

### 5. 比较 tab
- ref 下拉列出本地分支（排除当前分支）→ 与当前分支比较：提交列表 + diff。

### 6. Push 确认浮层
- 有 upstream：push 弹浮层（待推提交列表 + --force-with-lease 勾选）。
- 无 upstream：保持原有 `-u` 直推行为。

## 测试覆盖（自动化，20/20）

- 新增 8 组：log 解析（--follow/unborn）、showCommit（rename/root）、compare（ref 校验/截断）、blame（porcelain/5000 上限）、applyPatch（cached/reverse/绝对路径与 `..` 逃逸拒绝）、hunk commit（临时索引、index/工作区零污染）、untracked hunk commit、push --force-with-lease（真实远端）。
- 客户端：assemblePatch 7 例（多 hunk round-trip、上下文、rename/delete 头、no-newline、空选、filterCommits）。

## 已知边界（契约明确不做）

行级选块、amend、stash、cherry-pick、rebase、三栏冲突、side-by-side diff —— 见路线图 P1/P2。
