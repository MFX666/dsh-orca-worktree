# Orca（stablyai/orca）Worktree 管理功能模块调研报告

> 调研方式：DeepWiki（https://deepwiki.com/stablyai/orca ）+ 官方文档交叉验证
> 调研时间：2026-11-07
> 调研目的：为 DSH（DeepSeek Harness）的 worktree 管理设计提供参考
>
> ⚠️ 说明：DeepWiki 内容由 AI 基于 GitHub 仓库源码生成，函数名/文件路径以仓库当前代码为准；
> 本报告中的官方文档引用（orca.dev docs）为人工维护内容，可信度更高。两者冲突时以官方文档为准。

---

## 1. 项目概览

| 项目 | 信息 |
| --- | --- |
| 仓库 | [stablyai/orca](https://github.com/stablyai/orca) |
| 定位 | AI Orchestrator / ADE（Agent Development Environment），让多个 AI 编码代理（Claude Code、Codex、DSH 等）并行工作 |
| 技术栈 | Electron + React + TypeScript，xterm.js + node-pty，Monaco，pnpm workspace，MIT 协议 |
| 核心理念 | **Worktree-Native**：不做"单 checkout + 分支/stash 切换"，而是每个任务/工作区独占一个 `git worktree`（独立目录 + 独立分支），从而使多个 agent 并行互不干扰 |

Orca 的整个产品（侧边栏工作区、终端、diff review、CLI、自动化）都围绕 worktree 展开，
因此 worktree 管理模块是它的"地基"，而不是一个普通子功能。

---

## 2. 核心域模型

### 2.1 实体关系

```
Repo (注册的 git 仓库, repoId)
 ├── base ref（默认起点分支，通常是 origin/main）
 ├── Worktree[]（每个 = 一个 git worktree 目录 + 分支 + 元数据）
 │     ├── WorktreeIdentity（worktreeId = <repoId>::<worktreePath>）
 │     ├── WorktreeMeta（用户侧 UI 元数据，持久化）
 │     ├── start-from ref（创建时的起点，用于 diff/review）
 │     └── terminals / browser tabs / agent sessions（都归属该 worktree）
 └── Folder Workspace（非 git 目录工作区，无 worktree，是一等公民但另一条路径）
```

### 2.2 关键类型与标识

| 概念 | 定义 | 出处 |
| --- | --- | --- |
| `WorktreeIdentity` | 不可变的 host/instance 身份；`worktreeId` 为两段式地址 `<repoId>::<worktreePath>`，如 `repo-123::/Users/me/orca/fix-login` | `src/shared/worktree/types.ts`、CLI 文档 |
| `Worktree` | 聚合对象：id、path、branch、显示名、关联 issue/PR、各类状态标志 | `src/shared/types.ts:220-250` |
| `WorktreeMeta` | 用户元数据：displayName、badge 颜色、关联 PR/issue、最后访问时间、未读标记、`isArchived` | `src/shared/types.ts` |
| `WorktreeLineage` | 父子 worktree 关系（嵌套工作区），只读 record，支持 `--parent-worktree` 派生子工作区 | `src/renderer/src/store/slices/worktrees.ts` |
| Base Ref | 每个 worktree 的"起点分支"，持久化在 **`git config branch.<name>.base`**（存在 git 本身，而非 Orca 自己的存储） | `src/main/git/worktree-add.ts` |

**设计亮点：base ref 写进 git config 而非私有数据库**。好处是任何工具（包括 agent 在终端里）
都能读回"这个分支从哪来的"；写失败时会主动清掉 stale 值（unset），保证下游永远读不到过期谱系。

---

## 3. 架构分层（Electron 三进程模型）

```
Renderer (React/Zustand)
   │  window.api.worktrees.*        ← preload contextBridge
   ▼
Preload (src/preload/api/worktrees-bridge.ts → worktreesApi)
   │  ipcRenderer.invoke / on
   ▼
Main (src/main/ipc/worktrees.ts：注册 worktrees:create / list / remove / prefetch / hooks / meta ...)
   │
   ├─► src/main/git/worktree.ts        薄封装层：addWorktree / removeWorktree / moveWorktree /
   │                                    addSparseWorktree / parseWorktreeList / listWorktreesStrict
   ├─► src/main/git/worktree-add.ts    创建核心：解析 base、写 branch.<name>.base
   ├─► src/main/git/worktree-listing.ts 列表与 describeCreatedWorktree（创建后重建信息）
   ├─► src/main/git/worktree-removal.ts 删除核心 + 安全检查
   ├─► src/main/worktree-create-preparation.ts / -pool.ts  后台预准备（降延迟）
   └─► src/main/git/runner.ts           统一 git/gh 子进程执行器（超时、重试、WSL 路径翻译）
```

补充通道：

- **Runtime RPC**（`OrcaRuntimeRpcServer`）：CLI 与 agent 通过 JSON-RPC 调 `worktree.create/list/remove` 等，与 IPC 共用同一套主进程服务。
- **SSH/远程**：`src/ipc/worktree-remote.ts` + relay 的 git-handler，把 worktree CRUD、status、diff 代理到远程主机，行为与本地 porcelain 一致。
- **持久化**（`src/main/persistence.ts`）：单一 `orca-data.json`，按 `worktreeId` 索引 `WorktreeMeta`；`WorkspaceSessionState` 保存 `activeWorktreeId`、`tabsByWorktree`、终端布局。写入策略为 **debounce + 临时文件 + 原子 rename**，关机时同步 flush。

---

## 4. Worktree 生命周期

官方文档定义的五段式（https://www.onorca.dev/docs/model/worktrees）：
**Create → Work → Review → Ship → Archive/Delete**。

### 4.1 创建（Create）

```
用户在 Composer（NewWorkspaceComposerCard/Modal + useComposerState）填写：
任务名、start-from 选择器、可选关联 GitHub PR / Linear / Jira / GitLab MR
        │
        ▼
runBackgroundWorktreeCreation()            (src/renderer/src/lib/worktree-creation-flow.ts)
  注册 pendingWorktreeCreations[creationId] —— UI 保持可交互，可切换到其他 worktree
        │  IPC: worktrees:create
        ▼
主进程：
  1. prepareWorktreeCreateForRepo()        后台预准备（后台 fetch/prefetch base，减少感知延迟）
  2. resolveWorktreeAddBaseContext()       解析 base：git merge-base --is-ancestor 校验
  3. 名称消毒 / 冲突检查                    (src/main/ipc/worktree-logic.ts)
  4. addWorktree() 或 addSparseWorktree()  实际执行 git worktree add
  5. persistWorktreeCreationBase()         git config --local --replace-all branch.<b>.base <base>
  6. runWorktreeChangeInvalidators()       失效各处缓存（scan generation 等）
  7. resolveCreatedWorktree() / describeCreatedWorktree()   创建后重建 Worktree 对象
        │  进度事件 emitCreateWorktreeProgress（'fetching' / 'creating' ...）
        ▼
Renderer: onCreateProgress → beginPendingWorktreeCreation / updatePendingWorktreeCreation
          → WorktreeCreationPanel 展示阶段 + 已耗时
```

细节要点：

- **稀疏检出**：创建时给了 `sparseDirectories` 就走 `addSparseWorktree`，否则普通 `addWorktree`；worktree 的 sparse 状态在生命周期内有专门的缓存失效处理。
- **文件夹工作区（folder workspace）是另一条路径**：`createFolderWorkspace`，没有 git worktree/源代码管理，但可以聚合多个 git 仓库、承载任务来源。
- **运行目标（Run on）**：本地 / SSH 主机 / 远程 Orca Server；在创建表单内即可补完 host 的项目位置（浏览或 clone），不会"创建死胡同"。
- **agent 默认项**：Create 对话框里的 Agent 选择器可"设为该 agent 的默认"，含 Blank Terminal。

### 4.2 列表与外部 worktree 检测（List）

- `listWorktrees` / `listWorktreesStrict` → `parseWorktreeList` 解析 `git worktree list --porcelain`，带缓存与失效代（`bumpWorktreeScanGeneration`）。
- **外部 worktree**：用户自己 `git worktree add` 创建的不会自动进侧边栏；若存在，sidebar 显示一张 "hidden worktrees" 卡片 → 打开 "Non-Orca worktrees" 对话框 → 按需 "Show"。全局默认可在 Settings → General → Workspace 配置，项目级可覆盖。
- 渲染端 `WorktreeSlice` 的状态键：`worktreesByRepo`、`detectedWorktreesByRepo`、`worktreeLineageById`、`activeWorktreeId`、`pendingWorktreeCreations`、`deleteStateByWorktreeId`。

### 4.3 切换与激活（Work / Switch）

- 核心动作 `setActiveWorktree`：更新 `activeWorktreeId` + `activeWorkspaceKey`；创建仍在进行时也允许切换。
- 激活副作用（`repos.ts` slice）：
  1. 视图切换到终端视图；
  2. 记录访问历史（`recordWorktreeVisit`，支持前进/后退导航）；
  3. **睡眠 agent 会话恢复**：`activateAndRevealWorktree()` → `resumeSleepingAgentSessionsForWorktree()` → 用 pane 归属 claim key 去重后 `launchSleepingAgentSession()` 重连 PTY。
- 主 worktree 的激活有 blocked 检查（`folderWorkspaceActivationBlocked`）。

### 4.4 Review 与 Ship

- **Diff 基准**：`resolveSourceControlBaseRef` 优先读取 `branch.<name>.base`（即 start-from ref）作为 diff 目标——所以 review 面板始终是"相对这个工作区创建点"的差异，而不是简单对 main。
- Review 面板：Annotate AI Diff（对任意 diff 行留言并回发给 agent）、Attribution。
- Ship：commit / push / 开 PR / 等 CI checks 全部 inline；PR 与 checks 状态缓存在 `hostedReviewCache` / `prCache` 并显示在工作区卡片上。
- **纯 git 兼容**：每个 worktree 都是真实 git worktree，用户/agent 在里面随便 `git rebase / cherry-pick`，Orca 下一次渲染自动感知；不锁死 git 状态。

### 4.5 删除 / 归档（Archive/Delete）

官方语义：删除 worktree = 同时删目录 + 删分支（带确认）。删除**委托给 git 执行**
（`git worktree remove`），"让 git 移除 checkout"意味着删除不会卡死聊天或文件操作。

```
DeleteWorktreeDialog（确认）
   → runWorktreeDelete(worktreeId)         (delete-worktree-flow.ts)
   → 主机/实例校验：主 worktree 走 folder 移除确认，而非裸 git worktree remove
   → 谱系分析：getWorkspaceDeleteLineage() 若存在子工作区则警告
   → 终端/PTY 清理：终端布局、活动 tab 记录清空，PTY 进程终止
   → 安全断言：
       assertWorktreeCleanForRemoval()          未提交变更默认拦截
       assertNoPendingWorktreeRemovalConflict() 防并发删除冲突
   → removeWorktree({ force? })             git worktree remove [--force]
       · 不设超时：大 checkout 删 30s+ 属正常，宁可慢不可半途截断
       · admissionExempt: true 独立排队，不受通用并发闸门限制
   → deleteBranchAfterWorktreeRemoval()
       · 分支含未合并提交 → git 拒删 → 返回 preservedBranch → 侧边栏提示
         "保留分支 + 可 review 后强删"（Preserved branches 流程）
   → 失败兜底：git 删不掉时工作区保留在列表中可重试；Force Delete 为分离控件，
     箭头菜单提供 "Always force delete" 记忆选择
   → 孤儿清理：finishUnregisteredWorktreeRemoval() 对 git 已不认领的 worktree
     清理残留管理记录 + git worktree prune；中断的删除由
     runtime-interrupted-local-worktree-removal.ts 恢复收尾
```

另有 `forgetLocal`：仅从 Orca 移除记录（不动 git/磁盘），与真删分离。

---

## 5. 安全与健壮性设计清单

| 机制 | 说明 |
| --- | --- |
| `isWithinWorktree` | `discardChanges` / `bulkDiscardChanges` 执行 `rm -rf` 前强制校验目标在 worktree 根内，防路径穿越 |
| 超时常量族 | `WORKTREE_ADD_TIMEOUT_MAX_MS`、`WORKTREE_REMOVAL_PREFLIGHT_TIMEOUT_MS` 等；**唯一例外是 `git worktree remove` 本身不设超时**（理由见上） |
| Base ref 防腐化 | `git config branch.<name>.base` 写失败时 unset stale 值，避免下游读到错误谱系 |
| 缓存失效代 | `bumpWorktreeScanGeneration` / `runWorktreeChangeInvalidators`：任何 mutation 后一次性失效扫描/状态缓存 |
| WSL 适配 | `translateWslOutputPaths` 把 `git worktree list` 的 Linux 路径翻译成 Windows UNC；`assertWslMoveRepoWritable` 在迁移前确认可写；git 子进程统一经 `runner.ts` 的 `wsl.exe -d <distro>` 路由 |
| 中断恢复 | 创建可取消（preparation cancel 有延迟基准测试）；删除中断可恢复收尾 |
| Renderer↔Main 对账 | 启动 hydration + 后台文件系统/git 状态监听；外部改动（手动删目录等）在周期性重评估中被剪掉 |

---

## 6. 周边支撑机制

### 6.1 Hooks（orca.yaml）

仓库根 `orca.yaml` 定义：

- `setup`：worktree 创建后执行；`createSetupRunnerScript` 生成 runner 脚本；可延迟到该 worktree 第一个终端 tab 就绪时执行；UI 侧有 `SetupScriptPromptCard` 提示/重校验。
- `archive`：归档/删除时执行；**CLI 的 worktree remove 默认跳过 archive hook**，除非显式要求。

### 6.2 Trust Presets

`agent-trust-worktree` / `agent-trust-folder` 设置项，按工作区控制是否绕过 agent 启动确认提示
（`AgentWorkspaceTrustSetting`），让 agent 冷启动不被权限弹窗打断。

### 6.3 Agent-Awake（防休眠）

"Keep computer awake: Agent" 模式——agent 工作期间（如 hook 事件 `UserPromptSubmit`）激活
power-save blocker（macOS 用应用持有的 `caffeinate` 断言，其他平台用 Electron `powerSaveBlocker`），
`Stop` 事件解除。保证长任务不被系统睡眠打断。

### 6.4 CLI 与 RPC（agent 可编程入口）

```bash
orca worktree create --name fix-login [--repo <sel> | --project <id>] \
    [--parent-worktree active | folder:<id> | worktree:<id>] [--no-parent] \
    [--agent <id> --prompt <text>] [--json] [--host ssh:<target> | --environment <server>]
orca worktree list [--repo <sel>] [--json]
orca worktree remove|delete <id> [--force]
```

- worktree id 为 `<repoId>::<worktreePath>` 两段地址，`--json` 输出中的 `id` 字段是唯一权威引用。
- Project 选择与 parent 选择是**正交的**：folder 父只提供谱系不给 git 目标；在 Orca 管理的 checkout 内可省略 `--repo/--project`。
- 这些 CLI 命令直接映射 Runtime RPC 的 `worktree.create/list/remove` 方法——**"UI 能做的，agent 也能做"** 是 orca CLI 的设计原则（README 原话），官方甚至给 agent 提供了 `skill-guides/orca-cli.md` 使用指南。

---

## 7. UI 层实现要点（Renderer）

- **WorktreeList**（`src/renderer/src/components/sidebar/WorktreeList.tsx`）：虚拟化视口（`VirtualizedWorktreeViewport`）+ 管道式过滤（`useVisibleSidebarWorktrees`，过滤时保留祖先以维持 lineage 树）/分组（按仓库、状态、PR、项目）/排序（`useSidebarWorktreeSortOrder`）+ 滚动锚点（"Reveal in Sidebar"）。
- **WorktreeCard**（`WorktreeCard.tsx` + `useWorktreeCardController`）：聚合 agent 状态点（`AgentStateDot`：working / idle / interrupted / awaiting-permission）、未读徽标、PR/MR 展示、快捷操作、右键菜单（打开浏览器、重命名、管理 lineage 等）。
- **谱系嵌套**：`lineageChildren` 递归渲染 + 缩进规则（`worktree-list/rows/indentation.ts`）。
- **删除中状态**：卡片 `aria-busy="true"` + 进度指示；`deleteStateByWorktreeId` 覆盖父子节点。

---

## 8. 对 DSH worktree 管理的借鉴建议

按"直接可抄的设计"到"需要取舍"排序：

### 强烈建议采纳

1. **worktreeId 两段式地址 `<repoId>::<path>`**：全局唯一、自解释、天然支持同 repo 多 worktree，也方便 CLI `--json` 输出被 agent 消费。
2. **base ref 持久化到 `git config branch.<name>.base`**：不引入私有存储即可回答"这个分支从哪分出来的"；写失败要清 stale 值。这是 diff/review 正确性的基石。
3. **删除委托给 `git worktree remove`，不设超时**：避免 UI 卡死和半途截断；保留分支（preserved branches）作为未合并提交的安全网，Force Delete 做成分离控件 + 可记忆。
4. **安全断言前置**：删除前的 clean 断言、并发删除冲突断言、`rm -rf` 前的 `isWithinWorktree` 边界校验。
5. **外部 worktree 检测而非收编**：解析 `git worktree list --porcelain` 发现非托管 worktree，用"隐藏卡片 + Show"方式让用户选择性纳管——尊重用户已有工作流。
6. **创建流程后台化 + 进度事件流**：注册 pending 状态让 UI 不阻塞；`prepare` 预取降低感知延迟；创建中允许切换上下文。

### 值得考虑

7. **orca.yaml hooks（setup/archive）**：仓库级、随代码走（clone 即得）的钩子比全局配置更适合 monorepo 初始化（装依赖、起服务等）。注意 CLI 删除默认跳过 archive hook 的取舍。
8. **CLI 即 RPC**：把 worktree 管理同时暴露为 IPC 和 CLI/RPC，agent 才能自助"开工作区干活"——这与 DSH 的 agent-first 定位高度契合。
9. **谱系（parent worktree）**：支持从当前工作区派生子工作区（`--parent-worktree active`），适合"主任务拆子任务"的多 agent 编排；UI 过滤时要保留祖先节点。
10. **睡眠会话恢复**：切换回 worktree 时自动重连/复活 agent 会话，配合防休眠策略。

### 需要按 DSH 实际取舍

11. **Folder workspace 与 git worktree 双轨**：orca 把"纯目录"也做成一等工作区（无源代码管理）。DSH 若场景明确是代码仓库，可先只做 git 轨道。
12. **稀疏检出**：大仓库 + agent 场景收益大，但实现/边界（缓存失效、状态检测）复杂，建议二期。
13. **`orca-data.json` 单文件原子写持久化**：简单可靠；DSH 若已有更强存储（SQLite 等）可替换，但"按 worktreeId 索引元数据 + 会话状态"的切分方式值得保留。

---

## 9. 参考来源

- DeepWiki: https://deepwiki.com/stablyai/orca （重点页：2.1 IPC API Reference、2.2 Persistence Layer、2.3 Git & GitHub Integration、2.6 CLI & Runtime RPC、3.2 Worktree Lifecycle in the Renderer、4.1 Worktree List & Cards）
- 官方文档 Worktrees: https://www.onorca.dev/docs/model/worktrees
- 仓库: https://github.com/stablyai/orca （含 `skill-guides/orca-cli.md`）
- 关键源码路径（由 DeepWiki 标注）：`src/main/git/worktree.ts`、`worktree-add.ts`、`worktree-listing.ts`、`worktree-removal.ts`、`worktree-create-preparation.ts`、`src/main/ipc/worktrees.ts`、`src/main/ipc/worktree-remote.ts`、`src/preload/api/worktrees-bridge.ts`、`src/shared/worktree/types.ts`、`src/renderer/src/store/slices/worktrees.ts`、`src/renderer/src/lib/worktree-creation-flow.ts`、`src/main/persistence.ts`
