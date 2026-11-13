# 开源项目 "IDEA 级别本地 Git 审查能力" 调研报告

> 调研方式：DeepWiki（deepwiki.com）逐仓库问答 + 官方 keybindings/文档核实。日期：2026-11-13。
> 背景：插件 GitPanel（`src/client/GitPanel.tsx`）目前仅有：双栏工作台（分支条 + AI commit message + 按目录分组文件树逐文件勾选暂存）、结构化 unified diff（sticky 文件头/hunk 横幅/双行号列/单文件与全部切换）、commit/push/refresh/忽略空白。缺 changelist、历史/blame、log 图、分支管理、stash、补丁、三方合并、分支比较、回滚、交互式 rebase。

## 1. 各仓库功能清单

### 1.1 JetBrains/intellij-community（git4idea / IntelliJ VCS）—— 基准线

| 能力 | 状态 | 关键实现/入口（DeepWiki 证据） |
|---|---|---|
| Diff 查看（unified + side-by-side） | ✅ | 平台 `PatchDiffTool$Unified` / `PatchDiffTool$SideBySide`；`GitStageDiffAction` |
| 部分暂存（hunk/行级 stage/unstage） | ✅ | Non-Modal Staging Area：`GitStagePanel`、`GitStageTree`、`GitStageLineStatusTracker`（行范围跟踪/导航/回滚） |
| Changelist 变更列表 | ✅ | 平台 `ChangesGroupingSupport`、`ChangesTree`、`ChangesView.GroupBy` |
| Shelve 搁置 | ✅ | 平台 Shelf：`ChangesView.Shelve`、`ShelveChangeManagerProjectActivity`、`ShelvedChangesViewManager` |
| Blame/annotate | ✅ | `GitAnnotationProvider$DefaultGitAnnotationProvider` |
| Log 拓扑图 | ✅ | `Vcs.Show.Log`、Git log UI factory（图形绘制在平台 vcs-log 模块） |
| 冲突三方合并 | ✅ | `GitResolveConflictsAction`、`GitStageThreeSideDiffAction`（三版本比较） |
| Stash 管理 | ✅ | `GitStashContentProvider`、`GitStashUIHandlerImpl`（pop/apply/unstash as/drop/clear） |
| 补丁创建/应用 | ✅ | 暂存树菜单 create-patch dialog；平台 `ApplyPatchMergeTool`、`ApplyPatchDiffTool`、.patch 编辑器 |
| Interactive rebase UI | ✅ | `GitInteractiveRebaseAction`（squash/fixup/reorder/remove/reword 对话框） |
| 与分支比较 | ✅ | `GitCompareWithRefAction`、`GitCompareWithBranchAction`、`GitShowDiffWithRefAction` |
| 回滚/撤销 commit/revert | ✅ | `GitResetAction`、`GitUncommitAction`、`GitRevertAction` |

### 1.2 gitbutlerapp/gitbutler —— 虚拟分支 / patch 级工作流

| 能力 | 状态 | 证据 |
|---|---|---|
| Diff 查看 | ⚠️ 部分 | unified diff（E2E 测试 `unified-diff-view`）；未见 side-by-side；`crates/but-gpui/src/ui/diff.rs` |
| 部分暂存 | ⚠️ 变体 | 按行/hunk 选择构建提交（不走 git index），可分多次部分提交 |
| Changelist | ❌（替代品） | 虚拟分支（Virtual Branches）承担"并行分组工作"的角色，非传统 changelist |
| Shelve | ❌ | 无实现证据；`but pull` 直接携带未提交更改 |
| Blame | ❌ | 仅允许只读 `git blame` 命令，无产品 UI |
| Log 拓扑图 | ❌ | 无 |
| 冲突三方合并 | ⚠️ 部分 | `crates/but-api/src/resolve/mod.rs`：冲突暴露为文件内 hunks，可选 ours/theirs/自定义，支持部分解决逐步应用；无三栏 merge editor |
| Stash | ❌ | 明确禁止用 `git stash` 写入，无 stash UI |
| 补丁 | ❌ | 无 patch 导出/应用 |
| Interactive rebase | ⚠️ 变体 | 声称"不必再用 rebase -i"：拖放/CLI 完成 uncommit、reword、amend、move、split、squash（`but move`/`but squash`/`but reword`） |
| 与分支比较 | ❌ | `but diff` 不接受两个 ref；只可借 `git diff a b` |
| 回滚/撤销 | ✅ 变体 | Undo Timeline + `but undo`/`but redo`（基于快照的操作历史），`but uncommit` 可把提交/文件/hunk 移出提交 |

### 1.3 gitkraken/vscode-gitlens —— VS Code 生态最强插件

| 能力 | 状态 | 证据 |
|---|---|---|
| Diff/历史/比较 | ✅ | 文件/行历史、revision 比较；multi-diff editor 单标签页看多文件；`src/commands/diffWithPrevious.ts` 等 |
| 部分暂存 | ⚠️ | stage/unstage 入口存在，逐 hunk/逐行依赖 VS Code 原生 SCM |
| Changelist | ❌ | 仅 `Changes`/`Staged Changes` 两组，无可自定义分组 |
| Shelve | ❌ | 无（stash ≠ shelve） |
| Blame/annotate | ✅ | 行内 inline blame、状态栏 blame、changes/heatmap annotations；`src/annotations/lineAnnotationController.ts` |
| Commit Graph 拓扑图 | ✅ | `src/webviews/plus/graph/graphWebview.ts`（注：Graph 属 Plus 付费功能） |
| 冲突三方合并 | ❌ 自带 | 依赖 VS Code Merge Editor，无自带实现 |
| Stash 管理 | ✅ | apply/drop/rename/save、从 stash 打开变更（`src/constants.commands.generated.ts`） |
| 补丁 | ✅ 轻量 | 从文件/commit/stash/comparison 复制 patch 到剪贴板 + `Apply Copied Patch` |
| Interactive rebase UI | ✅ | 自带 Interactive Rebase Editor：拖动排序 + edit/squash/drop（`gitlens.rebase.*`） |
| 与分支比较 | ✅ | Search & Compare（ref/range 搜索）；Graph 内 `Select for Compare`/`Compare with Selected`；`src/views/viewCommands.ts` |
| 回滚/撤销 | ✅ | reset/revert/undo commit；区分 `resetCommit`/`resetToCommit`/`resetToTip` |

### 1.4 jesseduffield/lazygit —— TUI 全能选手

| 能力 | 状态 | 证据（keybindings_en.md 核实） |
|---|---|---|
| Diff 查看 | ✅ | 暂存/未暂存切换、diff context 调节、空白开关、多 renderer、difftool 外接、文件内跳转 |
| 部分暂存 | ✅ | staging 面板 `Space` 切行、`v` 范围选择、`a` hunk/行模式（pkg/gui/controllers/） |
| Changelist | ⚠️ | Files 面板文件树/平铺分组，无可自定义变更列表 |
| Shelve | ❌ | 无（keybindings 无 shelve） |
| Blame | ❌ | 无内置 blame（已知长期缺口） |
| Log 拓扑图 | ✅ | commit graph 显示/隐藏、`--all` 全图、高亮选中提交的父链 |
| 冲突解决 UI | ⚠️ | 自带冲突面板：选 hunk/双方、跳转冲突、撤销上次解决；非三栏 editor |
| Stash 管理 | ✅ | stash 全部/仅 staged/仅 unstaged/含未跟踪；apply/pop/drop/rename（`pkg/commands/git.go` StashCommands） |
| 自定义补丁 | ✅ 独有 | `Ctrl+P` custom patch：从提交中选文件/行 → 应用到 working tree/反向应用/移入 index/新提交/其他提交；另有 cherry-pick（`pkg/gui/modes/cherrypicking/`） |
| Interactive rebase | ✅ | squash/fixup/drop/edit/pick/reword/排序/继续 rebase、`--onto` 选 base（RebaseCommands） |
| 与分支比较 | ✅ | `W` diffing options：对任意 ref diff、反转方向 |
| 回滚/撤销 | ✅ | reset soft/mixed/hard、revert、reflog 驱动 Undo/Redo（不含 working tree）、bisect（`b`）、Reflog 面板 |

## 2. 对比矩阵

功能 ×（IDEA / GitButler / GitLens / lazygit / 本插件 GitPanel 现状）：

| 能力 | IDEA | GitButler | GitLens | lazygit | 本插件现状 |
|---|---|---|---|---|---|
| unified diff | ✅ | ✅ | ✅ | ✅ | ✅ |
| side-by-side diff | ✅ | ❌ | 借 VSCode | ❌ | ❌ |
| hunk/行级暂存 | ✅ | 行选择✅ | ⚠️依赖宿主 | ✅ | ❌（仅文件级） |
| changelist | ✅ | ❌(虚拟分支) | ❌ | ⚠️ | ❌（目录树） |
| shelve | ✅ | ❌ | ❌ | ❌ | ❌ |
| stash 管理 | ✅ | ❌ | ✅ | ✅ | ❌ |
| blame/annotate | ✅ | ❌ | ✅ | ❌ | ❌ |
| log 拓扑图 | ✅ | ❌ | ✅(付费) | ✅ | ❌ |
| 三方合并冲突 UI | ✅ | ⚠️ | 借宿主 | ⚠️ | ❌ |
| 补丁 | ✅ | ❌ | ✅轻量 | ✅ | ❌ |
| interactive rebase | ✅ | 变体 | ✅ | ✅ | ❌ |
| 与分支比较 | ✅ | ❌ | ✅ | ✅ | ❌ |
| reset/revert/undo | ✅ | ✅变体 | ✅ | ✅ | ❌ |
| AI commit message | ✅(AI Assistant 另购) | ✅ | ⚠️ | ❌ | ✅ |

## 3. 结论

1. **没有任何单一开源项目完整复刻 IDEA 的 git 审查能力。** IDEA 是唯一在"changelist + shelve + hunk 级 staging + 三方合并 + 拓扑图 + interactive rebase + 分支比较"全部 12 项上打勾的实现（且 diff 观感、shelf、log 图是 20 年平台积累）。
2. **最接近的是 JetBrains 之外的两个**：
   - **GitLens**：在 VS Code 宿主内覆盖最广（blame、graph、rebase editor、compare、stash、patch、reset/revert），但核心重合部分（逐行暂存、merge editor、部分 diff UI）大量外包给 VS Code 原生能力；Commit Graph 为 Plus 付费；无 changelist/shelve。
   - **lazygit**：TUI 内能力最完整且全部免费开源（行级暂存、custom patch、rebase、reflog undo、bisect、分支比较、stash），但无 blame/shelve、无 side-by-side、冲突解决非三栏。
3. **GitButler 走的不是复刻路线**：用虚拟分支取代 changelist/shelve/stash 三件套，用 Undo Timeline 取代 reflog 管理，patch 级提交编辑（uncommit/split/move 拖拽）体验独树一帜；但传统审查刚需（blame、log 图、分支比较）全缺。

### 对本插件的可借鉴清单（按性价比排序）

**来自 lazygit（可直接照抄交互模型）：**
- 行级/hunk 级暂存：在现有 diff 视图加行选 + stage/unstage（对应 `Space`/`v`/`a`），是当前 GitPanel 文件级勾选的自然升级。
- 与 ref 比较：diff 模式支持"与选中分支比较 + 反转方向"（`W` 模式），复用现有 diff 渲染。
- reset soft/mixed/hard + revert + reflog undo 的分层撤销。

**来自 GitLens：**
- blame/annotate（行内 hover + 整文件 annotation）。
- Search & Compare（任意 ref/range 比较 + 按作者/消息过滤提交）。
- 自带 Interactive Rebase Editor（拖拽排序 + pick/squash/drop/reword 下拉）——纯前端可实现，后端只需拼 `git rebase -i` todo。
- patch 复制/应用（轻量，剪贴板 + apply 即可用）。

**来自 GitButler：**
- 拖拽式提交编辑（move/split/squash/reword/uncommit）作为 interactive rebase 的现代 UI。
- Undo Timeline（把 reflog 翻译成人类可读操作历史，一键 undo）。
- "虚拟分组"思路可启发 changelist 替代方案。

**若对标 IDEA 必须自建（无现成开源可搬）：** changelist 持久化分组、shelve（IDEA Shelf 是 JSON 快照而非 git stash）、三栏合并编辑器。
