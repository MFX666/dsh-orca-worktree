# GitPanel 与 IDEA Git 审查能力差距分析与路线图

> 调研时间：2026-11-13 ｜ 基线：dsh-worktree-plugin 0.2.2（代码实证）
> 配套调研（本目录）：
> - [opensource-git-review-research.md](./opensource-git-review-research.md) — DeepWiki 逐仓库调研：是否有开源项目已具备 IDEA 级 git 审查
> - [idea-git-features.md](./idea-git-features.md) — 基于 JetBrains 官方文档的 IDEA Git 功能全集（16 章节）

## 0. 两个调研问题的答案

**Q1：是否有开源项目已具备 IDEA 级别的 git 审查能力？——没有。**
IDEA（git4idea）是唯一在 hunk/行级暂存、changelist、shelve、blame、log 拓扑图、三方合并、stash、补丁、interactive rebase、分支比较、reset/revert 全部打勾的实现。最接近者各有硬缺口：
- **GitLens**（VS Code）：覆盖最广，但逐行暂存/merge editor 外包给 VS Code 原生，Commit Graph 是 Plus 付费，无 changelist/shelve。
- **lazygit**（免费开源）：能力最全（行级暂存、custom patch、rebase、reflog undo、bisect），但无 blame/shelve/side-by-side，冲突 UI 非三栏。
- **GitButler**：不走复刻路线（虚拟分支 + Undo Timeline + 拖拽提交编辑），传统审查刚需（blame、log 图、分支比较）全缺。
→ 结论：**功能需自研，但交互模型可大量借鉴**（见 §2 借鉴来源列）。

**Q2：IDEA 功能全集？** 见 [idea-git-features.md](./idea-git-features.md)，含每功能的 UI 入口、交互细节与审查场景 Top 20 排序（P0=diff 内编辑+部分提交+Log 过滤+blame+push 对话框；P1=history/undo/cherry-pick/三方合并/分支弹窗/amend/shelf-stash/staging；P2=commit checks/补丁/自动 fetch）。

## 1. 现状基线（代码实证）

### 1.1 已有

**Host RPC**（src/protocol.ts + rWorktreeManager）12 个动词：overview / archivedMeta / branches / create / ensureWorkspace / setPinned / remove / status / diff / commit / push / suggestCommitMessage。

**GitPanel UI**（src/client/GitPanel.tsx，799 行）：
- 左栏：分支+upstream 条（ahead/behind）、push、刷新、AI commit message、逐文件勾选（目录分组树+全选）、commit
- 右栏：结构化 unified diff（git diff HEAD + untracked 合并视图）：sticky 文件头、hunk 横幅、双行号列、单文件/全部切换、忽略空白、行数上限截断
- **独有优势**：AI commit message 内置（IDEA 要另购 AI Assistant）；worktree-native（审查对象天然是分支工作树，可绑定会话继续让 agent 修复）

### 1.2 差距矩阵（✅=有 ⚠️=部分/变体 ❌=无）

| 能力 | IDEA | GitLens | lazygit | 本插件 | 借鉴来源 |
|---|---|---|---|---|---|
| unified diff | ✅ | ✅ | ✅ | ✅ | — |
| side-by-side diff | ✅ | 借宿主 | ❌ | ❌ | IDEA 布局 |
| hunk/行级暂存 | ✅ | ⚠️宿主 | ✅ | ❌（仅文件级） | lazygit Space/v/a |
| changelist | ✅ | ❌ | ⚠️ | ❌（目录树） | GitButler 虚拟分组 |
| shelve | ✅ | ❌ | ❌ | ❌ | 自建（IDEA 私有 patch 模型） |
| stash 管理 | ✅ | ✅ | ✅ | ❌ | GitLens/lazygit |
| blame/annotate | ✅ | ✅ | ❌ | ❌ | GitLens 行内+整文件 |
| log 拓扑图 | ✅ | ✅付费 | ✅ | ❌ | lazygit（开源图渲染） |
| 三方合并冲突 UI | ✅ | ⚠️ | ⚠️ | ❌ | 自建（IDEA 三栏模型） |
| 补丁 | ✅ | ✅轻量 | ✅ | ❌ | GitLens 剪贴板 patch |
| interactive rebase | ✅ | ✅ | ✅ | ❌ | GitLens 拖拽 Rebase Editor |
| 与分支比较 | ✅ | ✅ | ✅ | ❌ | lazygit W 模式（复用现有 diff 渲染） |
| reset/revert/undo | ✅ | ✅ | ✅ | ❌ | lazygit 分层撤销 + GitButler Undo Timeline |
| push 对话框（force-with-lease/逐 commit 编辑） | ✅ | ⚠️ | ⚠️ | ❌（一键 push） | IDEA |
| amend / fixup / squash | ✅ | ✅ | ✅ | ❌ | IDEA |
| diff 内直接编辑 + Accept/Append/Revert hunk | ✅ | ⚠️ | ⚠️ | ❌ | IDEA |
| commit 前 checks / hooks 控制 | ✅ | ⚠️ | ❌ | ❌ | IDEA（P2） |
| AI commit message | ✅另购 | ⚠️ | ❌ | **✅** | 已有，保持领先 |
| file/selection history | ✅ | ✅ | ✅ | ❌ | GitLens |
| 冲突文件列表 + Abort | ✅ | ⚠️ | ✅ | ❌ | lazygit |

## 2. 分期路线图（对齐 IDEA Top 20，按审查场景性价比排序）

### 一期 P0 — 让审查成立（改动集中在 GitPanel + 少量新 RPC）
1. **部分提交（hunk/行级勾选）**：diff 视图 hunk 横幅加勾选框 + 行选（借鉴 lazygit 三键模型）；后端 commit 改为 git apply --cached 管线（当前是整文件级）。
2. **与分支/任意 ref 比较**：分支条加比较目标选择，diff 从 git diff HEAD 切换为 git diff <ref>..HEAD（复用全部现有渲染；lazygit W 模式）。
3. **Log 视图（最小版）**：该 worktree 分支的提交列表 + branch1..branch2 区间过滤 + 点提交看该 commit 的 diff（复用渲染器）；拓扑图渲染可后置。
4. **file history / 单文件历史**：git log --follow -- <file> 列表 → 点开看版本间 diff。
5. **push 升级**：push 前显示待推 commit 列表，支持 force-with-lease 开关。
6. **diff 内 hunk 操作**：Accept/Revert hunk（工作区丢弃/应用）；从 diff 直接编辑后置。
7. **blame/annotate（gutter 模式）**：git blame --porcelain 渲染到现有双行号列旁，行 hover 显示 commit 摘要（GitLens 模型）。

### 二期 P1 — 分支操作与历史改写
8. 分支管理 UI（checkout/delete/rename/compare，复用 branches RPC 扩展）。
9. amend / fixup / squash into（--amend + git rebase --autosquash）。
10. reset（soft/mixed/hard）+ revert + undo commit（安全确认框）。
11. stash 管理（save/pop/apply/drop，含未跟踪文件）。
12. cherry-pick（从 Log 多选到当前分支）。
13. interactive rebase UI：拖拽排序 + pick/squash/drop/reword 下拉（纯前端拼 todo，GitLens 模型）。
14. 冲突解决：冲突文件列表 + Abort + 三栏合并编辑器（工作量最大，放本期末；可先做 Accept Yours/Theirs + 非冲突自动应用，三栏编辑器后置）。

### 三期 P2 — 补齐与差异化
15. shelf（IDEA 私有 patch 模型，JSON 快照落插件持久层）/ patch 创建·应用·剪贴板。
16. staged/unstaged 双区视图 + HEAD/Staged/Local 三窗格。
17. commit 前 checks（跑测试/hook 控制）。
18. 差异化（不追 IDEA）：AI 审查增强——AI commit message 之外加 Explain Commit / AI 冲突解法建议 / 提交质量检查；GitButler 式 Undo Timeline（reflog → 人类可读操作历史）。
19. **明确不对齐**：changelist 语义（私有概念，用目录树+勾选替代）、Local History、tag 管理、submodule（IDEA 自身也弱）。

## 3. 工作量直觉

一期 ≈ 2–3 周（P0.1 部分提交是唯一动后端提交管线的大件；其余多为新只读 RPC + 前端视图复用）。二期 ≈ 3–4 周（rebase 族 + 三栏合并是大头）。三期按需。细节验收标准可按 idea-git-features.md 对应章节逐条落地。