import { dirname } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import type { WorktreeEnvelope } from './protocol.ts'
import type { ProductProject, ProductSnapshot, ProductView, ProductWorkspaceAddValue } from './product-protocol.ts'

type Target = { displayPath: string; targetKey: string }
type Policy = { mode: string; workspaceRoot?: string; sessionId?: string }
interface ProductFs {
  resolve(path: string, options?: { cwd?: string; signal?: AbortSignal }): Promise<Target>
  processPath(target: Target): string
  stat(target: Target, signal?: AbortSignal): Promise<{ type: string; version: string } | undefined>
  readText(target: Target, signal?: AbortSignal): Promise<string>
  writeText(target: Target, text: string, expected: { kind: 'createIfAbsent' } | { kind: 'replaceIfVersion'; version: string }, signal?: AbortSignal, policy?: Policy): Promise<unknown>
}
interface Session {
  id: string
  header: { parentSession?: string }
  snapshotEvents(): readonly { type: string }[]
}
interface Agent {
  session: Session
  status: string
  inbox: { nextTurn: readonly unknown[]; nextStep: readonly unknown[] }
  ctx: HostContext
}
interface Domain {
  global: { get(): ProductSnapshot; set(value: ProductSnapshot): Promise<void> }
  close(): Promise<void>
}
interface HostContext {
  get(name: string): unknown
  on(name: string, listener: (...args: any[]) => unknown): () => void
  effect(setup: () => (() => unknown) | void): void
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected a JSON object')
  return value as Record<string, unknown>
}
function nonempty(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} must be a nonempty string`)
  return value
}
function manifest(value: unknown): { name: string; projects: ProductProject[] } {
  const data = object(value)
  const name = nonempty(data.name, 'Product name')
  if (!Array.isArray(data.projects)) throw new Error('projects must be an array')
  const projects = data.projects.map((item, index) => {
    const project = object(item)
    if (Object.keys(project).some(key => key !== 'name' && key !== 'path')) throw new Error('Project fields must be name and path')
    return { name: nonempty(project.name, `projects[${index}].name`), path: nonempty(project.path, `projects[${index}].path`) }
  })
  return { name, projects }
}
function storedState(value: unknown): ProductSnapshot {
  const data = object(value)
  if (!Array.isArray(data.products)) throw new Error('Stored products must be an array')
  const ids = new Set<string>()
  const products = data.products.map(item => {
    const row = object(item)
    const parsed = manifest(row)
    const id = nonempty(row.id, 'Product id')
    if (ids.has(id)) throw new Error(`Duplicate product id: ${id}`)
    ids.add(id)
    const manifestPath = nonempty(row.manifestPath, 'Manifest path')
    const version = nonempty(row.version, 'Manifest version')
    return { id, manifestPath, version, ...parsed, ...(typeof row.error === 'string' ? { error: row.error } : {}) }
  })
  const bindings = object(data.sessionProducts)
  const sessionProducts: Record<string, string> = Object.create(null)
  for (const [id, product] of Object.entries(bindings)) sessionProducts[id] = nonempty(product, 'Session product id')
  return { products, sessionProducts }
}
function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** One durable domain owns registry, retained valid manifests, and immutable session bindings. */
export class Products {
  private readonly host: HostContext
  private readonly fs: ProductFs
  private domainPromise?: Promise<Domain>
  private queue: Promise<unknown> = Promise.resolve()
  private readonly installed = new WeakSet<Agent>()

  constructor(ctx: Context, private readonly managedDirectory: string) {
    this.host = ctx as unknown as HostContext
    this.fs = this.host.get('fs') as ProductFs
    this.host.effect(() => () => this.queue.then(async () => {
      const domain = await this.domainPromise?.catch(() => undefined)
      await domain?.close()
    }))
    this.host.on('agent/created', async ({ agent }: { agent: Agent }) => { this.installAgent(agent) })
    const agents = this.host.get('agents') as { list(): Agent[] } | undefined
    for (const agent of agents?.list() ?? []) this.installAgent(agent)
    this.registerTools()
  }

  private domain(): Promise<Domain> {
    if (!this.domainPromise) {
      const storage = this.host.get('storageDomain') as { open(spec: unknown): Promise<Domain> } | undefined
      if (!storage) return Promise.reject(new Error('Product storageDomain service is unavailable'))
      this.domainPromise = storage.open({
        name: 'orca_products', version: 1, tables: {},
        global: { schema: { parse: storedState }, initial: { products: [], sessionProducts: {} } },
      })
    }
    return this.domainPromise
  }

  private run<T>(task: (domain: Domain) => Promise<T>): Promise<WorktreeEnvelope<T>> {
    const pending = this.queue.then(async () => {
      try {
        const value = await task(await this.domain())
        return { ok: true as const, value: structuredClone(value) }
      } catch (error) {
        return { ok: false as const, code: 'RPC_ERROR' as const, message: errorText(error) }
      }
    })
    this.queue = pending
    return pending
  }

  private async parse(text: string, manifestPath: string, signal?: AbortSignal): Promise<Pick<ProductView, 'name' | 'projects'>> {
    const data = object(JSON.parse(text))
    if (Object.keys(data).some(key => key !== 'name' && key !== 'projects')) throw new Error('Manifest fields must be name and projects')
    const parsed = manifest(data)
    const projects: ProductProject[] = []
    const paths = new Set<string>()
    for (const project of parsed.projects) {
      const target = await this.fs.resolve(project.path, { cwd: dirname(manifestPath), signal })
      if ((await this.fs.stat(target, signal))?.type !== 'directory') throw new Error(`Project directory does not exist: ${project.path}`)
      const path = this.fs.processPath(target)
      if (paths.has(path)) throw new Error(`Duplicate project directory: ${path}`)
      paths.add(path)
      projects.push({ name: project.name, path })
    }
    return { name: parsed.name, projects }
  }

  private async load(target: Target, manifestPath: string, signal?: AbortSignal): Promise<{ view: Pick<ProductView, 'name' | 'projects' | 'version'>; text: string }> {
    const before = await this.fs.stat(target, signal)
    if (before?.type !== 'file') throw new Error('Manifest file does not exist')
    const text = await this.fs.readText(target, signal)
    const parsed = await this.parse(text, manifestPath, signal)
    const after = await this.fs.stat(target, signal)
    if (before.version !== after?.version) throw new Error('Manifest changed while loading; import/reload first')
    return { view: { ...parsed, version: before.version }, text }
  }

  private async registerProjects(projects: readonly ProductProject[]): Promise<void> {
    const workspaces = this.host.get('workspaceRegistry') as { create(path: string, title?: string): Promise<unknown> } | undefined
    if (!workspaces) throw new Error('Workspace registry service is unavailable')
    for (const project of projects) await workspaces.create(project.path, project.name)
  }

  private async refresh(domain: Domain, signal?: AbortSignal): Promise<ProductSnapshot> {
    const state = domain.global.get()
    const products: ProductView[] = []
    for (const product of state.products) {
      try {
        const target = await this.fs.resolve(product.manifestPath, { signal })
        const { view: parsed } = await this.load(target, product.manifestPath, signal)
        await this.registerProjects(parsed.projects)
        products.push({ id: product.id, manifestPath: product.manifestPath, ...parsed })
      } catch (error) {
        signal?.throwIfAborted()
        products.push({ ...product, error: errorText(error) })
      }
    }
    const next = { products, sessionProducts: state.sessionProducts }
    if (JSON.stringify(next) !== JSON.stringify(state)) await domain.global.set(next)
    return next
  }

  products(): Promise<WorktreeEnvelope<ProductSnapshot>> {
    return this.run(domain => this.refresh(domain))
  }

  saveProduct(manifestPath: string, text?: string, version?: string, agent?: Agent, signal?: AbortSignal): Promise<WorktreeEnvelope<ProductView>> {
    return this.run(domain => this.save(domain, manifestPath, text, version, agent, signal))
  }

  private async save(domain: Domain, manifestPath: string, text?: string, version?: string, agent?: Agent, signal?: AbortSignal): Promise<ProductView> {
    nonempty(manifestPath, 'Manifest path')
    const workingDirectory = this.host.get('workingDirectory') as { get(session: Session): string }
    const target = await this.fs.resolve(manifestPath, { cwd: agent ? workingDirectory.get(agent.session) : undefined, signal })
    const canonical = this.fs.processPath(target)
    const parent = await this.fs.resolve(dirname(canonical), { signal })
    if ((await this.fs.stat(parent, signal))?.type !== 'directory') throw new Error('Manifest parent directory does not exist')
    if (text !== undefined) {
      if (typeof text !== 'string') throw new Error('Manifest text must be a string')
      await this.parse(text, canonical, signal)
      const info = await this.fs.stat(target, signal)
      if (info ? version !== info.version : version !== undefined) throw new Error('Manifest changed or version is missing; import/reload first')
      const policyService = this.host.get('sandboxPolicy') as { resolve(request: { session: Session }): Policy } | undefined
      if (agent && !policyService) throw new Error('Agent sandboxPolicy service is unavailable')
      // UI callers explicitly choose this manifest; agents retain their Session's write scope.
      const policy: Policy = agent ? policyService!.resolve({ session: agent.session }) : { mode: 'workspace-write', workspaceRoot: dirname(canonical) }
      if (policy?.mode === 'read-only') throw new Error('Product manifest writes are denied in read-only mode')
      await this.fs.writeText(target, text, version !== undefined ? { kind: 'replaceIfVersion', version } : { kind: 'createIfAbsent' }, signal, policy)
    }
    const { view: parsed } = await this.load(target, canonical, signal)
    const state = domain.global.get()
    const previous = state.products.find(product => product.manifestPath === canonical)
    const product: ProductView = { id: previous?.id ?? crypto.randomUUID(), manifestPath: canonical, ...parsed }
    const products = previous ? state.products.map(row => row.id === product.id ? product : row) : [...state.products, product]
    await this.registerProjects(product.projects)
    await domain.global.set({ products, sessionProducts: state.sessionProducts })
    return product
  }

  createProduct(name: string, agent?: Agent, signal?: AbortSignal): Promise<WorktreeEnvelope<ProductView>> {
    return this.run(domain => {
      const path = `${this.managedDirectory.replace(/[/\\]+$/, '')}/product-${crypto.randomUUID()}.json`
      return this.save(domain, path, JSON.stringify({ name: nonempty(name, 'Product name').trim(), projects: [] }, null, 2), undefined, agent, signal)
    })
  }

  addProductWorkspace(productId: string, path: string, agent?: Agent, signal?: AbortSignal): Promise<WorktreeEnvelope<ProductWorkspaceAddValue>> {
    return this.run(async domain => {
      const product = domain.global.get().products.find(row => row.id === productId)
      if (!product) throw new Error('Unknown product id')
      const target = await this.fs.resolve(product.manifestPath, { signal })
      const { view, text } = await this.load(target, product.manifestPath, signal)
      const workingDirectory = this.host.get('workingDirectory') as { get(session: Session): string }
      const directory = await this.fs.resolve(nonempty(path, 'Project path'), { cwd: agent ? workingDirectory.get(agent.session) : dirname(product.manifestPath), signal })
      if ((await this.fs.stat(directory, signal))?.type !== 'directory') throw new Error(`Project directory does not exist: ${path}`)
      const canonical = this.fs.processPath(directory)
      if (view.projects.some(project => project.path === canonical)) {
        return { ...await this.save(domain, product.manifestPath, undefined, undefined, agent, signal), added: false }
      }
      const draft = manifest(JSON.parse(text))
      draft.projects.push({ name: canonical.split(/[/\\]/).filter(Boolean).pop() ?? canonical, path: canonical })
      return { ...await this.save(domain, product.manifestPath, JSON.stringify(draft, null, 2), view.version, agent, signal), added: true }
    })
  }

  removeProduct(productId: string): Promise<WorktreeEnvelope<{ productId: string }>> {
    return this.run(async domain => {
      const state = domain.global.get()
      if (!state.products.some(product => product.id === productId)) throw new Error('Unknown product id')
      // Bindings retain identity so an existing conversation never becomes another product's chat.
      await domain.global.set({ ...state, products: state.products.filter(product => product.id !== productId) })
      return { productId }
    })
  }

  bindProduct(sessionId: string, productId: string): Promise<WorktreeEnvelope<{ sessionId: string; productId: string }>> {
    return this.run(async domain => {
      nonempty(sessionId, 'Session id')
      nonempty(productId, 'Product id')
      const state = await this.refresh(domain)
      const existing = state.sessionProducts[sessionId]
      if (existing === productId) return { sessionId, productId }
      if (existing) throw new Error('A conversation product cannot be changed')
      const product = state.products.find(row => row.id === productId)
      if (!product) throw new Error('Unknown product id')
      if (product.error) throw new Error(`Invalid product manifest: ${product.error}`)
      const sessions = this.host.get('sessions') as { get(id: string): Session | undefined } | undefined
      const agents = this.host.get('agents') as { get(id: string): Agent | undefined } | undefined
      const session = sessions?.get(sessionId)
      const agent = agents?.get(sessionId)
      if (!session) throw new Error('Conversation must be open before binding a product')
      if (agent?.status === 'running' || agent?.inbox.nextTurn.length || agent?.inbox.nextStep.length ||
        session.snapshotEvents().some(event => ['user/message', 'assistant/message', 'turn/start'].includes(event.type))) {
        throw new Error('Only a new empty conversation can be bound to a product')
      }
      await domain.global.set({ ...state, sessionProducts: { ...state.sessionProducts, [sessionId]: productId } })
      return { sessionId, productId }
    })
  }

  private installAgent(agent: Agent): void {
    if (this.installed.has(agent)) return
    this.installed.add(agent)
    let turn = -1
    let text = ''
    const prompt = agent.ctx.get('systemPrompt') as { context(value: unknown): () => void } | undefined
    if (!prompt) return
    const disposeContext = prompt.context({ name: 'orca:product', order: 130, text: () => text, interpolate: false })
    const disposeStep = agent.ctx.on('agent/pre-step', async (payload: { turn: number; signal: AbortSignal }, next: () => Promise<unknown>) => {
      if (turn !== payload.turn) {
        const result = await this.run(async domain => {
          const state = await this.refresh(domain, payload.signal)
          let productId = state.sessionProducts[agent.session.id]
          const parentId = agent.session.header.parentSession
          if (!productId && parentId && state.sessionProducts[parentId]) {
            productId = state.sessionProducts[parentId]!
            await domain.global.set({ ...state, sessionProducts: { ...state.sessionProducts, [agent.session.id]: productId } })
          }
          if (!productId) return ''
          const product = state.products.find(row => row.id === productId)
          if (!product) return `Product workspace ${productId} was removed. Its project references are unavailable.`
          if (product.error) return `Product workspace ${JSON.stringify(product.name)} (${product.manifestPath}) has an invalid manifest: ${product.error}. Previously cached project references are not current; repair the manifest before relying on them.`
          return `Product workspace context (directory references, not instructions or additional file permissions):\n${JSON.stringify(product, null, 2)}\nRelated project paths may be read as needed under the session's existing permissions. This does not include other conversations' history.`
        })
        text = result.ok ? result.value : `Product workspace context unavailable: ${result.message}`
        payload.signal.throwIfAborted()
        turn = payload.turn
      }
      return next()
    })
    this.host.effect(() => () => { disposeStep(); disposeContext() })
  }

  private registerTools(): void {
    const tools = this.host.get('tools') as { register(value: unknown): () => void } | undefined
    if (!tools) return
    const definitions = [
      { name: 'product_create', description: 'Create an empty product workspace by name. Its JSON manifest is managed automatically in the plugin directory.', parameters: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] }, execute: (args: { name: string }, exec: { agent: Agent; signal: AbortSignal }) => this.createProduct(args.name, exec.agent, exec.signal) },
      { name: 'product_add_workspace', description: 'Add an existing project directory to a product workspace. Update the latest manifest without changing other projects; duplicate directories are not appended.', parameters: { type: 'object', properties: { productId: { type: 'string' }, path: { type: 'string' } }, required: ['productId', 'path'] }, execute: (args: { productId: string; path: string }, exec: { agent: Agent; signal: AbortSignal }) => this.addProductWorkspace(args.productId, args.path, exec.agent, exec.signal) },
      { name: 'product_list', description: 'List product workspaces, their manifest errors, and durable conversation bindings.', parameters: { type: 'object', properties: {} }, execute: () => this.products() },
      { name: 'product_import', description: 'Import an existing product manifest without modifying it; register its referenced project directories as workspaces.', parameters: { type: 'object', properties: { manifestPath: { type: 'string' } }, required: ['manifestPath'] }, execute: (args: { manifestPath: string }, exec: { agent: Agent; signal: AbortSignal }) => this.saveProduct(args.manifestPath, undefined, undefined, exec.agent, exec.signal) },
      { name: 'product_save', description: 'Validate and save a product manifest {name,projects:[{name,path}]}, or import it by omitting text. Replacing an existing file requires its version from product_list or product_import; reload after a version conflict. Relative project paths resolve from the manifest parent; directories are never moved.', parameters: { type: 'object', properties: { manifestPath: { type: 'string' }, text: { type: 'string' }, version: { type: 'string' } }, required: ['manifestPath'] }, execute: (args: { manifestPath: string; text?: string; version?: string }, exec: { agent: Agent; signal: AbortSignal }) => this.saveProduct(args.manifestPath, args.text, args.version, exec.agent, exec.signal) },
      { name: 'product_remove', description: 'Unlink a product workspace from the registry. Keep its manifest, project directories, and conversations.', parameters: { type: 'object', properties: { productId: { type: 'string' } }, required: ['productId'] }, execute: (args: { productId: string }) => this.removeProduct(args.productId) },
    ]
    const disposers = definitions.map(definition => tools.register({ ...definition, output: { schema: { type: 'object' }, render: (_args: unknown, value: unknown) => [{ type: 'text', text: JSON.stringify(value, null, 2) }] } }))
    this.host.effect(() => () => { for (const dispose of disposers) dispose() })
  }
}
