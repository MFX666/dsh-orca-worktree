# Orca Folder Workspace 与侧边栏"子目录树形嵌套"样式调研

> 调研方式：DeepWiki（https://deepwiki.com/stablyai/orca ）
> 调研时间：2026-11-07
> 前置文档：[Orca Worktree 管理调研](./orca-worktree-management-research.md)、[DSH 复刻可行性评估](./dsh-worktree-feasibility.md)
>
> ⚠️ DeepWiki 为 AI 生成内容，实现前请以仓库源码复核；样式常量以
> `src/renderer/src/components/sidebar/worktree-list/rows/indentation.ts` 为准。

---

## 1. 结论先行

Orca 侧边栏的"子目录"观感由**两套独立的树**叠加而成，调研和落地时必须分开对待：

| 树 | 解决什么问题 | 挂在哪里 |
| --- | --- | --- |
| **Project Group / Folder Workspace** | 组织层：一个磁盘父目录装多个独立 git 仓库，聚合成一个"项目组" | 侧边栏的分组标题下 |
| **Worktree Lineage** | 工作层：worktree 派生子 worktree（主任务拆子任务），表现为卡片下缩进嵌套 | 任意 worktree 卡片下 |

你说的"子目录的样式很实用"，两者都有贡献：Folder Workspace 给出**"目录 → 多仓库"的分组树**，
Lineage 给出**"父工作区 → 子工作区"的缩进嵌套树**（18px 步进缩进、可折叠、过滤时保祖先）。
这两套样式叠加后，侧边栏呈现的就是一个完整的文件树式工作区浏览器。

---

## 2. Folder Workspace（文件夹工作区）

### 2.1 数据模型

```
ProjectGroup（侧边栏分组标题）
 ├── Repo (kind: 'git')            ← 常规导入的单个 git 仓库
 ├── Repo (kind: 'folder')         ← 非仓库的普通目录（无源代码管理）
 └── FolderWorkspace               ← 挂在父目录级的工作区条目
       ├── id / name / folderPath
       ├── projectGroupId          ← 归属的项目组
       ├── linkedTask              ← 绑定的任务（GitHub issue / Linear / Jira）
       └── linkedTaskSourceContext ← 任务提供方上下文（provider/projectId/hostId/site key）
```

要点：

- `FolderWorkspace` **不是 git 仓库**，是一个"指向磁盘目录的工作区记录"；一个父目录可以在
  同一个 ProjectGroup 下聚合多个**互不相干**的 git 仓库。
- 与 `Repo (kind:'folder)` 的区别：后者只是把非 git 目录注册为项目（无 worktree、无源代码管理）；
  前者是"父目录级的工作区"，用来在多仓库项目组下承载任务绑定与子 worktree 挂载。
- 展示层做了合成：`FolderWorkspace` 会被合成为一个合成 `Worktree` 对象，其 `repoId` 槽位
  用来命名所属 ProjectGroup —— 因此侧边栏渲染管线可以统一处理它（这是很取巧的设计：
  **一种卡片类型渲染两种实体**）。

### 2.2 创建路径

1. **UI**：`WorktreeList.tsx` 的 `handleCreateFolderWorkspace` → 打开 `new-workspace-composer`
   弹窗，提交时走 `submitFolderWorkspaceCreate` → `RepoSlice` 的 `createFolderWorkspace`
   （参数：`projectGroupId, name, folderPath, linkedTask, linkedTaskSourceContext`）。
2. **导入父目录**：导入一个含多个 git 仓库的父目录 → 自动聚合为一个 ProjectGroup →
   组内可继续建 FolderWorkspace。
3. **CLI**：`orca repo add --kind folder <path>`（`addRepoPath` action，`kind: 'folder'`）。
4. **`setup-existing-folder`**：把已有目录设为某 host 上的项目位置（用于远程/SSH 场景的
   "Set project location"，不离开创建表单完成）。

### 2.3 任务源绑定

FolderWorkspace 可把 Linear/Jira/GitHub 任务源绑定到"底层某一个仓库"上：
`linkedTask` + `linkedTaskSourceContext`（如 `{provider:'jira', projectId, hostId, providerIdentity}`），
保证任务面板/链接永远解析到正确的仓库，而不是模棱两可的父目录。

### 2.4 生命周期语义（与 git worktree 删除的关键差异）

| 操作 | git worktree | FolderWorkspace |
| --- | --- | --- |
| 删除 | 删磁盘目录 + 删分支（带确认/安全网） | **只删 Orca 记录，磁盘原样保留** |
| 主 worktree 删除 | git 本身不允许 → 路由到 **"confirm-remove-folder"** 弹窗（语义变为"从 Orca 移除该项目"，磁盘保留） | 同左 |
| folder 模式的根工作区 | `worktrees:remove` 直接报错 "Cannot delete the project root workspace" | 同左 |
| 删除时级联 | `getWorkspaceDeleteLineage` 找出全部后代，确认框明示"将同时删除 N 个子工作区" | 同左 |

---

## 3. 侧边栏"子目录树形嵌套"样式规格（核心）

### 3.1 视觉结构示意

```
▾ my-monorepo（ProjectGroup）
    ▸ dsh-fix-login          dsh-fix-login · 3+1 · PR #42 ✓   ← 普通 worktree 卡片
    ▾ dsh-refactor-api       main ← origin/main               ← 父卡片（含子工作区，可折叠）
        │  ● codex    working…                                ← 父卡内的 agent 状态行
        │   ┌────────────────────────────────────┐
        │   │ dsh-refactor-api/sub-auth          │            ← 子卡片（缩进 18px）
        │   │ claude · awaiting permission       │
        │   └────────────────────────────────────┘
        │   ┌────────────────────────────────────┐
        │   │ dsh-refactor-api/sub-docs          │            ← 第二个子卡片
        │   └────────────────────────────────────┘
    ▸ docs-site (folder ws)   ⚿ folder workspace              ← FolderWorkspace 合成卡
```

### 3.2 数据模型：WorktreeLineage

```ts
WorktreeLineage {
  worktreeId
  parentWorktreeId
  origin: 'orchestration' | 'cli' | 'manual'   // 谁建立的这条关系
  capture: { source: 'explicit-cli-flag' | ... } // 建立方式细节
}
```

- 存放在渲染端 store 的只读 record：`worktreeLineageById`（主进程侧由
  `recordWorkspaceLineageForCreatedWorktree` 在创建时写入）。
- **谱系是 Orca 层的元数据，与 git 无关**——子 worktree 的 git 基点可以随便选
  （`--parent-worktree` 只影响侧边栏谱系，不影响分支谱系）。这是"样式"与"git 事实"解耦的关键。

### 3.3 创建子 worktree 的入口

| 入口 | 参数 | lineage.origin |
| --- | --- | --- |
| CLI | `orca worktree create --parent-worktree active`（挂到当前工作区） | `cli` / `explicit-cli-flag` |
| CLI | `--parent-worktree folder:<folderId>`（挂到 FolderWorkspace） | `cli` |
| UI/编排 | agent 编排拆分任务时自动派生 | `orchestration` |
| 手动 | 用户在卡片菜单里创建 | `manual` |

### 3.4 渲染管线与缩进规格（indentation.ts）

| 常量/函数 | 值/行为 |
| --- | --- |
| `SIDEBAR_TREE_INDENT` | **18px**，每层谱系的缩进步长 |
| `LINEAGE_CHILDREN_INLINE_OFFSET` | 子卡片容器（`data-worktree-lineage-children`）的 `marginLeft` 计算基准，使子卡对齐父卡**标题列** |
| `LINEAGE_IMMEDIATE_PARENT_STEP` | 直系子代的对齐步长（保证与父卡内容列对齐） |
| `getWorktreeCardContentIndent` | 综合分组深度 + 谱系深度计算内容缩进 |
| 子卡片自身 | `surfaceInset = 0`、`cardContentIndent = 0` —— **缩进打在容器上，子卡自身不额外内边距**（保证卡片边框与父卡对齐成一条竖线） |
| 递归渲染 | `renderWorktreeLineageDescendants` 递归渲染后代 |
| 虚拟化 | `buildRenderableRows`（`renderable-rows.ts`）把"父卡 + 可见后代"折叠成一个虚拟行，由 `WorktreeCard` 内联渲染 —— 树形结构与虚拟滚动兼容 |
| 折叠 | 父卡持有 `lineageChildCount` / `lineageCollapsed`；折叠时子卡不渲染（计数徽标常驻） |
| 事件隔离 | 子卡的 click / dblclick / dragstart 阻止冒泡，防止误激活父卡 |
| 过滤保树 | `useVisibleSidebarWorktrees`：子卡命中过滤条件时**祖先强制保留**，树形不散架 |
| 排序 | `useSidebarWorktreeSortOrder` 排序只在分组边界内进行，不跨组打乱树 |

### 3.5 FolderWorkspaceWorktreesPanel（folder 视角的子目录面板）

激活某个 FolderWorkspace 后，右栏的 `FolderWorkspaceWorktreesPanel` 展示挂在其下的
git worktree：按**最近活动排序**的附属 `WorktreeCard` 列表，其下再嵌套渲染各自的
lineage 子代 —— 即"项目组 → 工作区 → 子工作区"三层树在同一个面板里贯通。

### 3.6 删除级联

删除父工作区时：`getWorkspaceDeleteLineage()` 计算全部后代 → `DeleteWorktreeDialog`
确认框明示波及范围（"N 个子工作区将一并删除"）→ 逐个走标准删除流（含各子的保留分支安全网）。

---

## 4. 对 DSH 的落地启示

结合前一份可行性评估（`docs/dsh-worktree-feasibility.md`），这两套树在 DSH 的映射成本都不高：

| Orca 概念 | DSH 现状 | 落地建议 | 估时 |
| --- | --- | --- | --- |
| Worktree Lineage | 无。Registry（W2）还没有 parent 字段 | registry 加 `parentWorktreeId + origin` 两列；`worktree create` 工具与 UI 加 `parent` 参数（DSH session 的 `cwd` 天然可推导"当前 = 父"） | +0.5–1 天 |
| 子目录树 UI | 无对应面板（二期 W6 才建） | **直接把 W6 的面板按树形设计**：18px 缩进、子卡容器缩进（卡面 inset=0）、折叠计数、过滤保祖先、点击/拖拽隔离。这些是纯 CSS/渲染约定，不增加结构性工作量 | W6 内 +1–2 天 |
| Folder Workspace | `workspaceController` 已有 Workspace 概念（session 可绑定 workspaceId） | 二期之后可选：把"非 git 目录 + 多仓库聚合"做成 Workspace 的一种 kind；若你的场景是 monorepo/多仓库客户端项目，这个分组层比 lineage 更先产生价值 | 另计 3–5 天 |

优先级建议：**先 lineage 后 folder**。Lineage 是纯元数据 + 渲染约定，几乎白送；
Folder Workspace 涉及 workspace 模型扩展和任务源绑定，建议等一/二期验收后再评估。

样式上最值得原样照抄的四条：

1. `SIDEBAR_TREE_INDENT = 18px` 固定步进，缩进打在**容器**上，卡片本体 inset 保持 0（竖线对齐）；
2. 子卡事件阻断冒泡（click/dblclick/drag 三类）；
3. 过滤/排序保祖先——树形列表的一切过滤都必须"子命中、父保留"；
4. 父卡折叠但显示 `lineageChildCount` 徽标；虚拟化场景把父+子折叠为一个渲染单元。

---

## 5. 参考

- DeepWiki 检索记录：
  - Folder Workspace: https://deepwiki.com/search/explain-orcas-folder-workspace_288ca363-8f08-477c-baa3-6cd5b27671c2
  - Lineage 树形样式: https://deepwiki.com/search/describe-the-sidebars-parentch_f8ca5fd0-2435-4754-8a5a-e1c0f6bbd14d
  - Folder/lineage 生命周期: https://deepwiki.com/search/explain-folder-workspace-and-l_74727cd6-729ae2-a6bb-4754-8a5a（以实际会话链接为准）
- 官方文档：https://www.onorca.dev/docs/model/worktrees
- 关键源码（DeepWiki 标注）：`src/renderer/src/components/sidebar/worktree-list/rows/indentation.ts`、`worktree-list/listing/renderable-rows.ts`、`WorktreeList.tsx`、`WorktreeCard.tsx`、`worktree-card-parent-content.tsx`、`FolderWorkspaceWorktreesPanel.tsx`、`src/renderer/src/store/slices/worktrees.ts`
