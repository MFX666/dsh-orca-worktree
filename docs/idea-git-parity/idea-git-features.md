# IntelliJ IDEA Git 功能全集调研报告（GitPanel 功能对齐目标）

> 目的：为 DSH 插件 GitPanel（当前仅有 diff 查看 + 按文件勾选 commit + push）梳理 IntelliJ IDEA 的 Git 功能全集，作为功能对齐与规划参考。
> 依据：JetBrains 官方文档（IntelliJ IDEA 2025.x–2026.x help，抓取于 2026-11）+ AI Assistant 文档。文中链接均为来源。
> 约定：每条功能给出 **功能名（中/英）｜作用｜IDEA UI 入口｜关键交互细节**。快捷键默认按 IDEA Windows/Linux 键位标注（macOS 将 Ctrl 换成 ⌘、Alt 换成 ⌥）。

---

## 0. UI 总体架构

IDEA 的 Git 能力分布在 6 个常驻 UI 载体 + 一批对话框：

| 载体 | 说明 |
|---|---|
| **Commit 工具窗** (Commit tool window, Alt+0) | 左侧竖条；本地改动、changelist、shelf/stash、staged 的家 |
| **Git 工具窗** (Git tool window, Alt+9) | Log / History / Shelf / Stash / Worktrees / Update Info 等标签页 |
| **VCS widget**（窗口顶部 Git 小组件） | 当前分支、incoming/outgoing 提示、分支弹窗入口、Abort/Continue rebase 等 |
| **编辑器 gutter 变更标记** | 行级改动标记、点击可 commit/查看 diff/上一处/下一处改动 |
| **Gutter 注释 (Annotate with Git Blame)** | 行号旁显示 blame 信息 |
| **对话框群** | Push、Pull、Update、Git Reset、Interactive Rebase、Resolve Conflicts、Apply Patch 等 |
| **Find Action** (Ctrl+Shift+A) / Git 主菜单 | 所有 Git 命令都能按键入名字执行；Ctrl+Shift+D 弹出 diff 命令面板 |

入口全景参考：[Git integration](https://www.jetbrains.com/help/idea/using-git-integration.html)、[Working with Git tutorial](https://www.jetbrains.com/help/idea/working-with-git-tutorial.html)。

---

## 1. Commit 工具窗与提交流程

来源：[Commit and push changes](https://www.jetbrains.com/help/idea/commit-and-push-changes.html)、[Commit tool window 细节](https://www.jetbrains.com/help/idea/commit-dialog.html)。

### 1.1 Commit（提交改动）
- **作用**：把选中的本地改动写入本地仓库。
- **入口**：Commit 工具窗选文件/整个 changelist → Ctrl+K；Ctrl+Alt+K = Commit and Push。
- **细节**：Ctrl+K 默认全选当前 active changelist；提交前可在下方 diff 预览逐块勾选（见 1.6 部分提交）。

### 1.2 Unversioned Files（未版本控制文件）
- **作用**：新文件默认不进 Git；集中在 Commit 工具窗 "Unversioned Files" 节点。
- **入口**：Commit 工具窗 Unversioned Files 节点。
- **细节**：直接勾选即可随本次 commit 一起提交（IDE 一步完成 add+commit）；新文件创建时 IDE 会提示是否 add（Settings | Version Control | Confirmation 可改 "When files are created/deleted" 行为）。

### 1.3 Changelists（变更列表 / 多变更列表）
- **作用**：把改动按任务分组；默认有 "Changes" 与 "Unversioned Files" 两个。
- **入口**：Commit 工具窗右键 → New Changelist / Move to Another Changelist (Alt+Shift+M) / Set Active / Delete。
- **细节**：可拖拽移动文件；新 changelist 的 comment 会显示在 commit 对话框 Comment 区；Set active 可配 Track context（IDEA 记住该任务打开的编辑器文件，激活时自动恢复）；changelist 是 IDEA 私有概念，不落 .git。

### 1.4 Staging area（暂存区模式）
- **作用**：给习惯 git add 的人用真·staging 模型替代 changelists。
- **入口**：Settings | Version Control | Git → **Enable staging area**。
- **细节**：Commit 工具窗分成 Staged / Unstaged 两区；整文件 Ctrl+Alt+A stage，或在 diff 预览的 chunk gutter 上点 "Stage"——**可 stage 单行、同一文件的多个独立改动块，同一行内的部分改动也能 stage**；外部 git 命令 stage 的文件也会显示（空心变更标记）；提供 "Compare HEAD, Staged and Local Versions" 三窗格视图（左=HEAD 只读、右=本地、中=staged 可编辑）；切换模式不丢改动（开启时 changelist 会被删除，关闭时全部恢复）。

### 1.5 Amend / 修改提交
- **作用**：把新改动并入上一个（或选定的本地）commit。
- **入口**：Commit 工具窗勾选 **Amend** 选项 + 点击 commit 图标选择目标 commit → Amend Commit。
- **细节**：对更早 commit 用 fixup/squash（见 §8.3）。

### 1.6 部分提交（Partial commit / chunk 级勾选）
- **作用**：只提交文件内选中的改动块。
- **入口**：Commit 工具窗选中文件后，下方 diff 预览内操作。
- **细节**：每个改动 chunk 有复选框；右键 chunk → **Move to Another Changelist**；右键行 → **Split Chunks and Include Selected Lines into Commit**（把选中的行拆成独立 chunk 再勾选）；gutter 上可逐行勾选。这是 IDEA commit 粒度的杀手级细节。

### 1.7 Commit message（提交消息）
- **作用**：写/复用/生成提交消息。
- **入口**：Commit 工具窗消息框。
- **细节**：下拉可选历史 commit message；支持 git config commit.template 模板；Settings | Version Control | Commit 可配消息规则与 inspection（如缺少 scope 警告）。
- **AI 生成消息**：commit 消息框点 ✨ **Generate Commit Message with AI Assistant**（2023.3+，需 AI Assistant 插件/订阅），按 diff 生成消息；还提供 **Explain Commit**（在 Log 中让 AI 解释一个 commit 的改动）。来源：[Get AI assistance for VCS commits](https://www.jetbrains.com/help/idea/work-with-commits.html)、[AI in version control](https://www.jetbrains.com/help/ai-assistant/ai-in-vcs-integration.html)。

### 1.8 Commit 前 checks（提交前检查）
- **作用**：提交前自动跑代码整理与验证。
- **入口**：Commit 工具窗右下角齿轮 / **Commit Options**（Ctrl+O）。
- **细节**：
  - 代码整理：**Reformat code**、**Rearrange code**、**Optimize imports**、**Cleanup**、**Update copyright**。
  - 安全检查：**Check for vulnerable dependencies**（NPM/PyPI 恶意依赖检查）。
  - 高级检查（Advanced Commit Checks）：**Analyze code**（用指定 inspection profile）、**Check TODO**（可选 filter）、**Run Configuration**（提交前跑测试等运行配置）、**Run tool**（外部工具）。
  - **Run advanced checks after a commit is done**：失败时仍保留提交（后台模式）；modal 提交界面下不可用。
  - 其他选项：改 **Author**、**Sign-off commit**；After Commit 可接 FTP/SFTP 上传部署。

### 1.9 Run hooks（执行 Git hooks）
- **作用**：commit 时自动执行 .git/hooks 里的 pre-commit/commit-msg 等钩子。
- **入口**：默认执行；单次在 commit 设置里取消 "Run Git hooks"；全局 Settings | Advanced Settings | Version Control → "Do not run Git commit hooks"。
- **细节**：pull --no-verify 选项可跳过 merge 钩子（见 §7.3）。

### 1.10 Commit 工具窗视图行为
- **细节**：Options → View Mode（Window/Float）、**Close Tool Window After Committing**；Show on Double-Click = Diff 或 Source；diff 可在 editor tab 或独立窗口打开；关闭 "Enable Commit tool window" 后 Local Changes 变成 Git 工具窗 Log 的一个 tab；老式模态 commit 对话框可用 Modal Commit Interface 插件恢复；编辑器 gutter 的变更标记点击后可直接 commit（含 Amend）或移入其他 changelist。

---

## 2. Diff 查看器（Differences Viewer）

来源：[Comparing file versions](https://www.jetbrains.com/help/idea/comparing-file-versions.html)、[Differences viewer](https://www.jetbrains.com/help/idea/differences-viewer.html)、[Diff & Merge 设置](https://www.jetbrains.com/help/idea/settings-tools-diff-and-merge.html)、[外部工具](https://www.jetbrains.com/help/idea/settings-tools-external-diff-tools.html)。

- **作用**：任意两版本对比 + 直接编辑。
- **入口**：Commit 工具窗选文件 Ctrl+D / 双击；Project 视图右键 Git | Compare With Revision / Compare With Branch or Tag；Log 右侧 Changed Files 面板 Ctrl+D。
- **关键交互**：
  - **布局**：**Side-by-side（并排）/ Unified（统一）** 可切换；两种模式都支持 Accept/Append/Revert 片段；只有右侧（统一视图下半部=本地版本）可编辑——**从 diff 直接改代码，无需打开编辑器**。
  - **左侧信息**：左面板顶部 hover 显示 base 版本来源 commit 的 hash/消息/作者/时间；点 hash 跳 Log；左面板 Revert 按钮可撤销"该改动"。
  - **导航**：Previous/Next Difference Shift+F7 / F7（文件尾再按可跳下一个文件）；**Jump to Source** F4；Compare Previous/Next File Alt+Left/Right（多文件 diff 时）；Ctrl+Shift+Tab 左右窗格焦点切换。
  - **折叠**：Collapse Unchanged Fragments（上下文行数在 Settings | Tools | Diff & Merge 调）。
  - **空白处理**：Settings → Ignore Differences 五档：None / Trim whitespaces / Ignore whitespaces / Ignore whitespaces and empty lines / **Ignore imports and formatting**（字符串字面量内空白仍算差异）。
  - **差异粒度**：Highlighting = Words / Lines / Split changes（大块拆小）/ Characters / None。
  - **对齐与滚动**：Align Changes in Side-by-Side Diff（相似改动行对齐）、Synchronize Scrolling。
  - **应用代码片段（cherry-pick hunk）**：diff 面板内可直接 **Accept（采纳）/ Append（追加）/ Revert（还原）** 某个差异块，把一侧的 hunk 应用到另一侧——即块级 cherry-pick。
  - **gutter 联动**：diff 视图 gutter 右键可 **Annotate with Git Blame**。
  - **外部 diff 工具**：Settings | Tools | External Diff Tools → 启用后配置自定义 diff/merge 程序（参数 %1 left、%2 right、%3 base、%4 output(merge)，可按文件类型关联，示例 Beyond Compare）。
  - **打开方式**：editor tab 或独立窗口（Show Diff in Separate Window）。

---

## 3. 冲突解决（Conflicts / 三方合并）

来源：[Resolve Git conflicts](https://www.jetbrains.com/help/idea/resolve-conflicts.html)。

- **冲突来源**：pull / merge / rebase / cherry-pick / unshelve / apply patch。
- **Conflicts 对话框**：操作后自动弹出；每个冲突文件三选：**Accept Yours（用本地）/ Accept Theirs（用仓库）/ Resolve（手动三方合并）**；顶部按钮可先自动合并所有文件中的非冲突变更。
- **关闭对话框后**：Commit 工具窗出现 **Merge Conflicts** 节点，顶部有 Resolve Conflicts 与 **Abort**（放弃合并回到操作前状态）。
- **三方合并窗口**：
  - 布局：左=Local（只读）、右=Repository/Incoming（只读）、中=结果 editor（初始为 base 版本，**可自由编辑**）。
  - 颜色语义：修改行 / 删除行 / 新增行 / 冲突行 用不同颜色与 gutter 标记；中间窗有 change preview。
  - 工具栏：**Apply All Non-Conflicting Changes**（一键应用所有非冲突块）、**Apply Non-Conflicting Changes from the Left/Right Side**、**Resolve simple conflicts**（对简单冲突一键合并出结果）。
  - 冲突块上：Accept Left / Accept Right / Ignore；中间结果窗右键 → **Resolve using Left / Resolve using Right**。
  - 全部解决后点 Apply 生成合并结果并自动进入 commit 流程。
  - 附带：Rerun Merge（重跑合并）、LF/CRLF 处理；Settings | Tools | Diff & Merge 中有 "Automatically apply non-conflicting changes" 与 "Highlight modified lines in gutter" 开关。
- **辅助**：合并审查时可在 Log 选 merge commit，用 two-panel/three-panel diff 复核冲突是如何被解决的（见 §5.6）。

---

## 4. Git Log（Git 工具窗 Log）

来源：[Investigate changes](https://www.jetbrains.com/help/idea/investigate-changes.html)。

### 4.1 分支图与多仓库
- Log 显示所有分支（含远程）的提交图；多仓库项目左侧色条标识 root，一个 Log 聚合所有仓库。
- 左右方向键在 parent/child commit 间跳转；长分支有箭头跳到下一 commit。
- **Show Repository at Revision**：右键 commit 打开该时点的项目快照工具窗。

### 4.2 搜索与过滤
- 搜索：commit 消息片段 / revision 号 / 正则；Ctrl+L 聚焦搜索框；工具栏 **Go to Hash/Branch/Tag**（Ctrl+F）。
- 过滤器：**branch**（含 favorite 分支）/ **user** / **date** / **folder**（多仓库时可按 root+目录过滤）；可按当前过滤条件开新 Log tab。
- **Branch | Select** 支持区间语法 branch1..branch2（列出 branch2 有而 branch1 没有的提交）；cherry-pick 时可开 **Highlight | Non-Picked Commits** 灰显已应用提交。
- Git Log Indexing（Settings | Version Control | Confirmation | Log）开启后过滤/文件历史更快、可跨分支显示；Search Everywhere 也能搜历史 commit。

### 4.3 Commit 详情与文件列表
- 选中 commit 右侧显示 author/时间/hash/消息 + Changed Files 面板；文件可 Ctrl+D 看与 parent 的 diff。
- **Compare Versions**：选两个 commit → 文件列表 + diff。

### 4.4 从 Log 直接操作（右键菜单）
- checkout / push all up to here / new branch / new tag / revert / undo / drop / reset / edit message / fixup / squash / interactively rebase / cherry-pick / create patch / annotate… 基本所有历史操作与改写都挂在 Log 右键菜单上（详见 §8、§5）。

---

## 5. 历史与追溯

### 5.1 File History（文件历史）
- **入口**：任意视图选文件 → Git | Show History（或右键 Git | Show History）；结果在 Git 工具窗 History tab。
- **细节**：选 revision 即时显示与上一版 diff；工具栏：Branch 过滤、Refresh、Show Diff Ctrl+D、**Show All Affected Files** Alt+Shift+A（Paths Affected in Revision）、Show Commit Timestamp/Details/Diff Preview、Open on GitHub/GitLab；文件重命名历史可展开查看；从 revision 右键 **Get** 可把文件回退到该版本；右键 Create Patch 生成该 revision 补丁。

### 5.2 Selection History（选区历史）
- **入口**：编辑器选中一段代码 → Git | Show History for Selection（不选则当前行）。
- **作用**：追踪"这一段代码"的演变，不受文件整体历史干扰。

### 5.3 Annotate with Git Blame（逐行追溯）
- **入口**：编辑器或 diff 的 gutter 右键 → Annotate with Git Blame（Keymap 可设快捷键）。
- **细节**：行号旁显示 commit/作者/日期；当前 HEAD 修改的行**加粗 + 星号**；不同 commit 默认不同颜色；点击 annotation 或 hover 点 hash **跳到 Log 对应 commit**；hover 高亮该 commit 改动的行；右键 Open on GitHub；消息里的 issue 链接可直接打开问题单；可配置显示哪些字段。

### 5.4 目录历史
- Project 视图选目录 → Git | Show History，查看目录相关提交。

### 5.5 本地 vs 已提交
- Log 右侧文件窗格可直接 diff 本地版本与历史版本；右键 Get from Revision 回退单文件。

### 5.6 合并/PR 审查
- Log 选 merge commit：无冲突 → 按 parent 分组的 two-panel diff；有冲突 → 文件列表标记，Show Diff 打开 three-panel diff 复核冲突解决方案。

---

## 6. 分支管理（Branches）

来源：[Manage Git branches](https://www.jetbrains.com/help/idea/manage-branches.html)。

- **Branches 弹窗**：VCS widget 点击分支名 / Git | Branches；Git 工具窗左侧也有 Branches pane。所有分支操作（checkout/new/delete/rename/favorite/compare/rebase/pull into…）都从这里发起。
- **创建分支**：New Branch（从当前 HEAD）/ New Branch from Selected（从所选本地或远程分支）/ Log 右键 commit → New Branch；输入名字时按已有分支前缀联想。
- **Checkout / Switch**：双击本地分支或右键 Checkout；checkout 远程分支自动建 tracked 本地分支；本地有未提交改动时 IDEA 会保底处理（提示 stash/shelve/merge）；**Checkout Tag or Revision**（detached HEAD，可检出任一 commit/tag）。
- **Compare with Current**：列出所选分支有而当前分支没有的 commits（Swap Branches 可换基准）；Ctrl+A 看双方不同的文件列表。
- **Show Diff with Working Tree**：分支与本地工作区比较（含未提交改动），文件三色标注：灰=只在所选分支、绿=只在当前、蓝=两边都有差异；文件右键 **Get from Branch** 可把整个文件从另一分支复制过来（见 §8.5）。
- **两-dot 区间过滤**：Log Branch 过滤输入 main..feature 只看 feature 独有提交。
- **Rename**：重命名本地分支；可选 **Unset upstream branch**（下次 push 自动创建并跟踪新名远程分支）。
- **Delete**：即使含未合并提交也允许删除（相当于 -D），通知里给 "view unmerged commits" 链接与 **Restore**（恢复删除分支）链接；tracked 远程分支可从通知里一并删除。
- **Favorite branches**：star 标记（Space 键）；favorite 分支永远置顶显示；主分支默认 favorite。
- **Group branches**：按存储位置（本地/远程/自定义组）分组。
- **Rebase onto**：分支右键 → Checkout and Rebase onto <current>、Rebase <current> onto <selected>、Pull into <current> Using Rebase（详见 §8）。
- **Synchronous branch control**：Settings | Version Control | Git → Execute branch operations on all roots：多仓库项目所有 root 同时执行分支操作；失败时回滚已成功 root，防止 diverge；单一 root 单独 checkout 会提示 "Branches have diverged" 警告。
- **Push All up to Here**：Log 右键 commit 推送到指定点。

---

## 7. Push / Pull / Fetch / Update

来源：[Sync with a remote repository](https://www.jetbrains.com/help/idea/sync-with-a-remote-repository.html)、[Git settings](https://www.jetbrains.com/help/idea/settings-version-control-git.html)。

### 7.1 Fetch
- Git | Fetch / VCS widget 图标 / **自动 fetch**：Settings | Version Control | Git | Update → Fetch remote changes automatically（后台任务，默认每 20 分钟，registry 键 git.update.incoming.info.time 可调）。
- VCS widget 上蓝/绿箭头显示未拉取/未推送 commit 数。

### 7.2 Push（推送对话框）
- **入口**：Ctrl+Shift+K / Git | Push；Log 右键 "Push All up to Here…"。
- **细节**：多仓库一起列出（同步控制的仓库合并处理）；每仓库列出待推 commits；点仓库名可改目标仓库（Define remote 输新 URL；Git | Manage Remotes 管理）；点目标分支名可改/新建（Edit all targets 批量；本地分支不可改目标）；选中 commit 预览 diff；Ctrl+Q 看详情；Enter **内联编辑 commit message**（逐 commit 改消息再推）。
- **Push tags 复选框**：All = push --tags；Current Branch = push --follow-tags。
- **Force push**：Push 按钮下拉 → Force push（IDEA 实际执行 --force-with-lease，更安全）；**Protected branches**（Settings | Version Control | Git 配置）内禁止 force push 与历史改写；GitHub 上标记 protected 的分支 checkout 时自动继承该标记。
- **Push Rejected**：被拒时弹对话框选 Rebase/Merge 更新本地，可勾 "Remember the update method choice…"；对应设置 Auto-update if push of the current branch was rejected。

### 7.3 Pull（拉取对话框）
- Git | Pull → Pull Changes 对话框：多仓库选仓库、多 remote 选 remote、选源分支（默认 tracked 分支；换过一次会记住）。
- **Modify options**：--rebase（fetch 后 rebase 本地未推提交）、--ff-only、--no-ff、--squash、--no-commit（先看结果再提交）、--no-verify（跳过 pre-merge/commit-msg hooks）。
- **Update branch**：VCS widget/Branches pane 分支右键 Update，按设置的默认策略 pull。

### 7.4 Update Project（更新整个项目）
- Ctrl+T / Git | Update Project：多仓库/全分支 fetch + 应用。
- **三种更新方式**：Merge the incoming changes（= git pull --no-rebase）/ Rebase the current branch on top of incoming changes（= git pull --rebase）/ **Reset to the Remote Branch**（丢弃本地提交与远程对齐）。
- 更新完成自动开 **Update Info** tab，列出新增 commits 与受影响文件（Advanced Settings 可关自动打开）。
- 附：欢迎界面可不开项目直接 Update Project。

---

## 8. 历史改写与跨分支应用改动

来源：[Apply changes from one branch to another](https://www.jetbrains.com/help/idea/apply-changes-from-one-branch-to-another.html)、[Undo changes](https://www.jetbrains.com/help/idea/undo-changes.html)、[Edit project history](https://www.jetbrains.com/help/idea/edit-project-history.html)。

### 8.1 Rebase（变基）
- **入口**：Git | Rebase 对话框：选目标分支；**Modify options**：--onto（新基 + 截断点）、Select another branch to rebase（rebase 未 checkout 的分支，自动先 checkout）、--rebase-merges、--keep-empty、--root、--update-refs、--autosquash。
- 进行中：VCS widget 顶部 **Abort / Continue**。
- 冲突时走三方合并窗口（§3），每解决一个 commit 继续 rebase。

### 8.2 Interactive Rebase（交互式变基 UI）
- **入口**：Log 过滤出当前分支 → 选中系列中最早的 commit 右键 **Interactively Rebase from Here**。
- **Interactive Rebase 对话框**：列出其后所有 commit，可上下移动排序；每个 commit 可设动作：**Pick** / **Stop to Edit**（rebase 停在该 commit，弹通知继续/中止，可 Revert/Undo/Amend）/ **Reword**（双击内联改消息）/ **Squash**（并入上一个，默认合并消息）/ **Fixup**（并入且丢弃消息）/ **Drop**（丢弃）。
- 禁用条件（hover 菜单看状态栏原因）：commit 有多个 parent、不在当前分支、protected 分支。

### 8.3 Amend / Fixup / Squash Into（改写提交内容）
- Amend：Commit 工具窗勾 Amend + 选 commit（见 §1.5）。
- 给更早 commit 追加改动：Commit 工具窗选改动 → Log 右键目标 commit → **Fixup**（丢弃新消息）或 **Squash Into**（合并消息）→ Commit 按钮下拉 **Commit and Rebase**。file History 里同样可做。
- **Squash Commits**：Log 多选两个 commit 右键 → 编辑合并消息。
- **Edit Commit Message**：Log 右键或 F2；commit 成功通知上也有 Edit Commit Message。
- **Extract Selected Changes to Separate Commit**：Log 右侧 Changed Files 选文件右键，把部分文件的改动拆成独立 commit（两个 commit 都得到新 hash）。

### 8.4 Cherry-pick（拣选提交）
- **入口**：Log 选中 commit → 工具栏/右键 **Cherry-pick**（先 checkout 目标分支）。
- **细节**：多选可连续 pick；冲突时改动进入 Commit 工具窗待处理，可配置冲突时自动建 changelist（Settings | Version Control | Changelists）；状态栏/VCS widget 显示进行中状态，Abort/Continue Cherry-Pick；保护分支的提交被 pick 时可配置自动加 "cherry-picked from <hash>" 后缀。

### 8.5 Apply separate changes / files（应用单独改动/文件）
- **Apply separate changes**：跨分支应用某 commit 中选中文件的部分改动到一个 changelist（不 pick 整个 commit、不立即提交）。
- **Apply separate files（Get from Branch）**：把一个文件的完整内容从另一分支复制过来（目标分支没有该文件、或该文件经过多次提交改动时最方便）；入口：Show Diff with Working Tree 的文件列表右键，或 Project 视图 Git | Compare with Branch 后点 Get。

### 8.6 Undo / Revert / Drop / Reset / Rollback（撤销族谱）
| 操作 | 作用 | 入口 | 说明 |
|---|---|---|---|
| **Rollback（丢弃未提交改动 / discard local changes）** | 文件回到最近 commit 状态 | Commit 工具窗选文件 Ctrl+Alt+Z 或右键 Rollback | 对话框列出将回退的文件；可勾 **Delete local copies of added files**；staging 模式下 unstage 单独进行 |
| **Undo Commit（撤销最后一次提交）** | 最后一个 commit 退回为本地改动 | Log 右键最后 commit → Undo Commit | 弹 Select Target Changelist（改动去哪个 changelist、Set active、Track context）；protected 分支禁用 |
| **Revert Commit（反转已推送提交）** | 生成反向 commit，历史保留 | Log/文件 History 右键 → Revert Commit | 自动生成提交消息；多选多个 commit 各生成一个 revert；可在 commit 对话框取消部分文件（部分反转） |
| **Revert Selected Changes（只反转部分文件）** | 只反向 commit 中的部分文件 | Log 右侧 Changed Files 右键 | 同样生成反向 commit |
| **Drop Commit（丢弃提交）** | 无痕迹删除 commit（区别于 revert） | Log 右键 → Drop Commit | 需要 force push；protected 分支禁用 |
| **Drop Selected Changes** | 丢弃 commit 中部分文件的改动 | Log 右侧 Changed Files 右键 | 已推送则需 force push 或先 update 再推 merge commit |
| **Reset Current Branch to Here（分支重置）** | HEAD 移到指定 commit | Log 右键 → Reset Current Branch to Here | 四种模式：**Soft**（改动进 staging/Commit 窗）、**Mixed**（保留改动不 stage）、**Hard**（全部丢弃）、**Keep**（丢弃已提交改动、保留本地未提交改动） |
| **Get（单文件回退）** | 文件回到某 revision | 文件 History 右键 Get | 见 §5.1 |

- **改历史的通用限制**：protected 分支一律禁止；只能改当前 checkout 分支包含的 commits；已推送的改写需要 force push。

---

## 9. Shelf 与 Stash（临时收起改动）

来源：[Shelve or stash changes](https://www.jetbrains.com/help/idea/shelving-and-unshelving-changes.html)。

### 9.1 Shelve / Unshelve（搁置与恢复）
- **Shelve**：Commit 工具窗右键文件或整个 changelist → Shelve Changes；可只搁置部分文件；commit message 框输入 shelf 名；**unversioned 文件不能 shelve**（stash 同样只覆盖已跟踪改动）。
- **Unshelve**：Shelf tab → Ctrl+Shift+U；选择目标 changelist（新建/现有、Set active、Track context）；可勾 **Remove successfully applied files from the shelf**；unshelved 文件进 "Already Unshelved" 节点，误删可 **Restore**；**Unshelve Silently** Ctrl+Alt+U 或直接把 shelf 拖进 Commit tab（按住 Ctrl 拖 = 复制不删除）。
- 冲突时走三方合并；Settings | Version Control | Shelf 可开启 **Shelve base revisions**（shelve 的 base 版本也存起来，unshelve 冲突时用于三方合并）。
- Shelf 本质是 IDEA 自己生成的 patch（存 .idea/shelf，可改位置/团队共享）；**同一 shelf 可反复应用多次**；**Import Patches** 可把外部 patch 导入 shelf。
- Stash 与 Shelf 两个 tab 可合并为一个（Settings | Version Control | Git | Stash → Combine stashes and shelves in one tab）。

### 9.2 Stash（git stash 封装）
- **入口**：Commit 工具窗右键 → Git | Stash Changes；**Shelf 是 IDEA 私有格式，Stash 是标准 git 格式（IDE 外也能用）**。
- **Stash 对话框**：选 Git root、Message、**Keep Index**（staged 改动同时保留在工作区）→ Create Stash。
- **Stash tab**：双击文件看 stash diff；**Apply**（应用并保留在列表）/ **Pop**（应用并删除）；右键 **Unstash** 对话框可 **As new branch**（基于 stash 建新分支）、**Reinstate Index**（恢复 staged 状态）；**Drop / Clear** 删除。
- 区别要点：stash 覆盖全部未提交改动，shelve 可挑选；stash 在 dirty 工作区不能 apply。

---

## 10. 补丁（Patches）

来源：[Use patches](https://www.jetbrains.com/help/idea/using-patches.html)。

- **创建**：① 本地未提交改动 → Commit 工具窗右键 **Create Patch from Local Changes**；② Log 右键 commit → **Create Patch**；③ 文件 History 选 revision → Create Patch。
- **Patch File Settings**：保存位置（文件或 **To clipboard**）、Base path、**Reverse patch**（生成反向补丁）、Encoding；或直接 **Copy as Patch to Clipboard**。
- **应用**：Git | Patch | **Apply Patch**（选文件）或 **Apply Patch from Clipboard**；可直接把 patch 文件/邮件附件拖进编辑器；git format-patch 格式会自动提取 commit message 与 author 预填。
- 冲突检测：Apply Patch 对话框内 Show Diff，冲突行红色；**Change Directory Paths**：Map Base Directory / Remove Leading Directory 处理路径不匹配。

---

## 11. Tag（标签）

来源：[Use tags](https://www.jetbrains.com/help/idea/use-tags-to-mark-specific-commits.html)。

- **新建**：Log 右键 commit → New Tag；Git | New Tag 对话框支持 annotated tag（Message 填了就是 annotated）、branch~N 表达式定位、**Force** 重指已有 tag。
- **使用**：Go to Hash/Branch/Tag（Ctrl+F）跳转；Tags 节点/Checkout Tag or Revision checkout（detached HEAD）；Fetch tags 策略 Auto/Sync/Always/Never；Push 对话框 Push tags（All/Current Branch）；Tags 节点右键 Delete。

---

## 12. Git Worktree（工作树）

来源：[Use Git worktrees](https://www.jetbrains.com/help/idea/use-git-worktrees.html)。

- **作用**：同一仓库多个分支同时 checkout 到不同目录（共享 .git 历史），不用 stash、不用切分支。
- **入口**：Git 工具窗 **Worktrees tab** → New Worktree；VCS widget / Git | New Worktree；分支右键 New Worktree from '<branch>'；欢迎界面 Version Control → New Worktree。
- **细节**：可选 local/remote branch 或 tag 作源（同一分支不能同时开两个 worktree，可先 New branch）；**Copy local project setup**：按 .worktreeinclude 复制未提交的本地文件（.env 等）+ 运行 setup script；创建后作为独立项目打开；**在 worktree 中审 pull/merge request**（本地审 PR 专用）；Lock/Unlock、Delete、Prune 管理；子模块上建 worktree 不会替换父仓库的 submodule。

---

## 13. 其他支撑能力

- **Local History（本地历史，非 Git）**：[来源](https://www.jetbrains.com/help/idea/local-history.html)。IDE 自动记录每次编辑/测试/部署的项目状态快照（与 VCS 无关），可恢复单文件/多文件/被删文件、按内容搜索历史版本、**Put Label** 打标签；常作为 commit 前的安全网。入口：右键 → Local History | Show History / File | Local History。
- **多仓库（multi-root）**：一个项目多个 Git root；Log 聚合显示+色条区分；Push/Pull 按仓库分组；同步分支操作（§6）；Push 对话框逐仓库处理。
- **Submodule（子模块）**：IDEA 支持但较薄——Update Project 时自动更新在分支上的 submodule；detached HEAD submodule 执行 git submodule update；官方文档将细节指向 git-scm 手册（[Set up a Git repository](https://www.jetbrains.com/help/idea/set-up-a-git-repository.html)）。
- **Protected branches（保护分支）**：Settings | Version Control | Git 配置；禁 force push 与历史改写；GitHub protected 分支自动识别。
- **GPG 签名**：Settings | Version Control | Git → Configure GPG Key。
- **行尾安全**：提交 CRLF 前 Smart CRLF 警告（建议 core.autocrlf）；detached HEAD/rebase 中提交会警告。
- **远程与凭据**：Git | Manage Remotes；多 remote、密码策略（Settings | Version Control | Git）。
- **IDEA 未覆盖的 git 能力**：bisect、sparse-checkout、git update-index 类操作无原生 UI，需命令行或第三方插件——属功能差距项，GitPanel 无需对齐。

---

## 14. 对本地 Git 审查面板最重要的 Top 20

> 按"代码审查（review 未提交/已提交改动）"场景优先级排序。P0 = 面板核心体验；P1 = 高频效率项；P2 = 锦上添花。

| # | 功能 | 对齐理由 | 优先级 |
|---|---|---|---|
| 1 | Diff 查看器：并排/统一 + 词级高亮 + 空白忽略档位 | 审查的基本盘，直接决定可读性 | P0 |
| 2 | Diff 内直接编辑 + Accept/Revert hunk（块级应用/撤销） | 审查后顺手修复、挑选性采纳 | P0 |
| 3 | Commit 前逐文件勾选 + **chunk/行级部分提交** | 拆分提交、只提交审查通过的改动 | P0 |
| 4 | Git Log：分支图 + 过滤（author/date/branch/folder）+ commit 详情面板 | 审查入口视图 | P0 |
| 5 | 从 diff 查看来源 commit/作者/时间并可跳转（base hash hover → Log） | 追溯上下文 | P0 |
| 6 | Annotate/Blame（gutter 集成 + 点击跳 commit + 当前行加粗） | "这行为什么这么写" | P0 |
| 7 | Push 对话框：逐 commit 预览、内联改 message、force push（force-with-lease）+ protected 分支防护 | 推送是审查闭环最后一步 | P0 |
| 8 | File History + Selection History | 文件/片段级追溯 | P1 |
| 9 | Undo Commit / Reset（Soft/Mixed/Hard/Keep）四模式对话框 | 审查发现问题后的常用退路 | P1 |
| 10 | Revert Commit / Revert Selected Changes（部分文件反转） | 已推送内容的修正 | P1 |
| 11 | Cherry-pick（含只 pick 部分文件）+ Non-Picked 高亮 | hotfix/backport 高频 | P1 |
| 12 | 三方合并冲突解决窗（Apply Non-Conflicting / Accept Left/Right / 中间可编辑） | 冲突处理体验标杆 | P1 |
| 13 | Branches 弹窗：checkout/compare with branch/show diff with working tree/Get from Branch | 分支级审查 | P1 |
| 14 | Amend + Fixup/Squash Into + Edit Commit Message（F2） | 审查意见落地为提交修订 | P1 |
| 15 | Shelf/Stash 双轨（可挑文件 shelve；stash 对话框含 keep-index/new-branch） | 审查时暂存未完成工作 | P1 |
| 16 | Staging area 模式（HEAD/Staged/Local 三窗格、行级 stage） | 精确控制提交内容 | P1 |
| 17 | Commit 前 checks（reformat/optimize imports/分析/TODO/跑测试）+ run hooks 开关 | 质量门禁自动化 | P2 |
| 18 | 补丁：从改动/commit/revision 创建 + 从剪贴板应用 | 审查意见离线传递 | P2 |
| 19 | AI 生成 commit message（+ Explain Commit） | 提效项，需模型服务 | P2 |
| 20 | 自动后台 fetch + incoming/outgoing 指示 | 保证审查基于新鲜数据 | P2 |

**明确不建议对齐的**：changelist 全套语义（IDEA 私有、心智负担大，staging 模式更通用）、Local History（超范围）、Worktree 管理（可后置）、tag 管理（低频）。

---

## 15. 参考来源

- [Git integration](https://www.jetbrains.com/help/idea/using-git-integration.html)
- [Commit and push changes](https://www.jetbrains.com/help/idea/commit-and-push-changes.html) / [Commit dialog](https://www.jetbrains.com/help/idea/commit-dialog.html)
- [Group changes into changelists](https://www.jetbrains.com/help/idea/managing-changelists.html) / [Enable staging area](https://www.jetbrains.com/help/idea/enable-and-manage-the-staging-area.html)
- [Shelve or stash changes](https://www.jetbrains.com/help/idea/shelving-and-unshelving-changes.html)
- [Comparing file versions](https://www.jetbrains.com/help/idea/comparing-file-versions.html) / [Differences viewer](https://www.jetbrains.com/help/idea/differences-viewer.html) / [Diff & Merge settings](https://www.jetbrains.com/help/idea/settings-tools-diff-and-merge.html) / [External Diff Tools](https://www.jetbrains.com/help/idea/settings-tools-external-diff-tools.html)
- [Resolve Git conflicts](https://www.jetbrains.com/help/idea/resolve-conflicts.html)
- [Investigate changes](https://www.jetbrains.com/help/idea/investigate-changes.html)
- [Manage Git branches](https://www.jetbrains.com/help/idea/manage-branches.html)
- [Apply changes from one branch to another](https://www.jetbrains.com/help/idea/apply-changes-from-one-branch-to-another.html)
- [Undo changes](https://www.jetbrains.com/help/idea/undo-changes.html) / [Edit project history](https://www.jetbrains.com/help/idea/edit-project-history.html)
- [Use patches](https://www.jetbrains.com/help/idea/using-patches.html)
- [Sync with a remote repository](https://www.jetbrains.com/help/idea/sync-with-a-remote-repository.html)
- [Set up a Git repository](https://www.jetbrains.com/help/idea/set-up-a-git-repository.html) / [Git settings](https://www.jetbrains.com/help/idea/settings-version-control-git.html)
- [Use tags](https://www.jetbrains.com/help/idea/use-tags-to-mark-specific-commits.html) / [Use Git worktrees](https://www.jetbrains.com/help/idea/use-git-worktrees.html) / [Local History](https://www.jetbrains.com/help/idea/local-history.html)
- [Get AI assistance for VCS commits](https://www.jetbrains.com/help/idea/work-with-commits.html) / [AI in version control (AI Assistant)](https://www.jetbrains.com/help/ai-assistant/ai-in-vcs-integration.html)
- [Tutorial: Getting started with Git](https://www.jetbrains.com/help/idea/working-with-git-tutorial.html)
