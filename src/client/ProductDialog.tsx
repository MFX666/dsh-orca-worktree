import { useEffect, useId, useRef, useState, type ReactElement } from 'react'
import type { ProductView } from '../product-protocol.ts'
import type { WorktreeApi } from './api.ts'

export interface ProductDialogProps {
  api: WorktreeApi
  product?: ProductView
  t: (key: string, params?: Record<string, string | number>) => string
  onSaved: (product: ProductView) => void
  onRemoved: () => void
  onClose: () => void
}

export function ProductDialog({ api, product, t, onSaved, onRemoved, onClose }: ProductDialogProps): ReactElement {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const id = useId()
  const [manifestPath, setManifestPath] = useState(product?.manifestPath ?? '')
  const [name, setName] = useState('')
  const [importing, setImporting] = useState(false)
  const creating = product === undefined && !importing
  const [text, setText] = useState(() => JSON.stringify({
    name: product?.name,
    projects: product?.projects.map(({ name, path }) => ({ name, path })) ?? [],
  }, null, 2))
  const [version] = useState(product?.version)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmRemove, setConfirmRemove] = useState(false)

  useEffect(() => {
    const dialog = dialogRef.current
    dialog?.showModal()
    return () => { dialog?.close() }
  }, [])

  const run = async (action: 'create' | 'save' | 'import' | 'remove'): Promise<void> => {
    if (busy || (action === 'save' && product?.error)) return
    setError(null)
    if ((action === 'save' || action === 'import') && !/^(?:\/|[A-Za-z]:[\\/]|\\\\)/.test(manifestPath.trim())) {
      setError(t('product.dialog.invalidPath'))
      return
    }
    setBusy(true)
    try {
      if (action === 'create') {
        onSaved(await api.createProduct(name.trim()))
      } else if (action === 'remove') {
        if (!product || !confirmRemove) return
        await api.removeProduct(product.id)
        onRemoved()
      } else {
        if (action === 'save') JSON.parse(text)
        const saved = await api.saveProduct(manifestPath.trim(), action === 'save' ? text : undefined, action === 'save' ? version : undefined)
        onSaved(saved)
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <style>{`
        dialog.owt-product-dialog:not([open]) { display: none; }
        dialog.owt-product-dialog::backdrop { background: color-mix(in srgb, #0f172a 20%, transparent); }
      `}</style>
      <dialog
        ref={dialogRef}
        className="owt-modal owt-product-dialog"
        style={{ width: 'min(560px, calc(100vw - 32px))', maxHeight: 'calc(100dvh - 32px)', overflowY: 'auto' }}
        aria-labelledby={`${id}-title`}
        aria-busy={busy}
        onCancel={event => { event.preventDefault(); if (!busy) onClose() }}
        onClose={event => { if (!event.currentTarget.open) onClose() }}
      >
        <form
          style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
          onSubmit={event => { event.preventDefault(); if (!confirmRemove) void run(creating ? 'create' : importing ? 'import' : 'save') }}
        >
          <h2 id={`${id}-title`} className="owt-modal-title" style={{ margin: 0 }}>
            {t(product ? 'product.dialog.editTitle' : 'product.dialog.createTitle')}
          </h2>
          {creating ? <div className="owt-field">
            <label className="owt-field-label" htmlFor={`${id}-name`}>{t('product.dialog.name')}</label>
            <input id={`${id}-name`} className="owt-input" value={name} disabled={busy} autoFocus required
              placeholder={t('product.dialog.defaultName')} onChange={event => { setName(event.target.value) }} />
            <div className="owt-modal-desc">{t('product.dialog.createHint')}</div>
          </div> : <div className="owt-field">
            <label className="owt-field-label" htmlFor={`${id}-path`}>{t('product.dialog.manifestPath')}</label>
            <input
              id={`${id}-path`}
              className="owt-input"
              value={manifestPath}
              readOnly={product !== undefined}
              disabled={busy}
              autoFocus
              spellCheck={false}
              aria-describedby={`${id}-path-hint`}
              onChange={event => { setManifestPath(event.target.value) }}
            />
            <div id={`${id}-path-hint`} className="owt-modal-desc">{t('product.dialog.pathHint')}</div>
          </div>}
          {product && <div className="owt-field">
            <label className="owt-field-label" htmlFor={`${id}-json`}>{t('product.dialog.json')}</label>
            <textarea
              id={`${id}-json`}
              className="owt-input"
              style={{ height: 260, minHeight: 120, padding: 9, resize: 'vertical', fontFamily: 'var(--owt-font-code)' }}
              value={text}
              disabled={busy || Boolean(product?.error)}
              spellCheck={false}
              aria-describedby={`${id}-json-hint`}
              onChange={event => { setText(event.target.value) }}
            />
            <div id={`${id}-json-hint`} className="owt-modal-desc">{t('product.dialog.jsonHint')}</div>
          </div>}
          {product?.error && <div className="owt-modal-desc" data-kind="danger" role="alert">{product.error}<br />{t('product.repairHint')}</div>}
          {error && <div className="owt-modal-desc" data-kind="danger" role="alert">{error}</div>}
          {busy && <div className="owt-modal-desc" role="status">{t('product.dialog.working')}</div>}
          {confirmRemove && <div className="owt-modal-desc">{t('product.dialog.removeHint')}</div>}
          <div className="owt-modal-foot" style={{ flexWrap: 'wrap' }}>
            {confirmRemove ? (
              <>
                <button className="owt-btn" type="button" disabled={busy} onClick={() => { setConfirmRemove(false) }}>
                  {t('product.dialog.cancel')}
                </button>
                <button className="owt-btn" data-kind="danger" type="button" disabled={busy} onClick={() => { void run('remove') }}>
                  {t('product.dialog.removeConfirm')}
                </button>
              </>
            ) : (
              <>
                {product && (
                  <button className="owt-btn" data-kind="danger" type="button" disabled={busy} onClick={() => { setConfirmRemove(true) }}>
                    {t('product.dialog.remove')}
                  </button>
                )}
                <button className="owt-btn" type="button" disabled={busy} onClick={onClose}>{t('product.dialog.cancel')}</button>
                <button className="owt-btn" type="button" disabled={busy} onClick={() => {
                  if (product) { void run('import'); return }
                  setImporting(value => !value)
                  setError(null)
                }}>
                  {t(creating || product ? 'product.dialog.import' : 'product.dialog.back')}
                </button>
                <button className="owt-btn" data-kind="primary" type="submit"
                  disabled={busy || (creating ? !name.trim() : !manifestPath.trim() || Boolean(product?.error))}>
                  {t(creating ? 'product.dialog.create' : importing ? 'product.dialog.import' : 'product.dialog.save')}
                </button>
              </>
            )}
          </div>
        </form>
      </dialog>
    </>
  )
}
