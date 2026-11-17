import type { WorktreeEnvelope } from './protocol.ts'

export interface ProductProject {
  readonly name: string
  readonly path: string
}

export interface ProductView {
  readonly id: string
  readonly name: string
  readonly manifestPath: string
  readonly version: string
  readonly projects: readonly ProductProject[]
  readonly error?: string
}

export interface ProductWorkspaceAddValue extends ProductView {
  readonly added: boolean
}

export interface ProductSnapshot {
  readonly products: readonly ProductView[]
  readonly sessionProducts: Readonly<Record<string, string>>
}

export interface ProductRemote {
  products(): Promise<WorktreeEnvelope<ProductSnapshot>>
  createProduct(name: string): Promise<WorktreeEnvelope<ProductView>>
  addProductWorkspace(productId: string, path: string): Promise<WorktreeEnvelope<ProductWorkspaceAddValue>>
  /** Omit text to import an existing manifest. */
  saveProduct(manifestPath: string, text?: string, version?: string): Promise<WorktreeEnvelope<ProductView>>
  removeProduct(productId: string): Promise<WorktreeEnvelope<{ productId: string }>>
  bindProduct(sessionId: string, productId: string): Promise<WorktreeEnvelope<{ sessionId: string; productId: string }>>
}
