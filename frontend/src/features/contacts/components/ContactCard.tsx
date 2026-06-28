import { useState } from 'react'
import { Pencil, Trash2, Send, CheckCircle, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { Sheet } from '@/components/ui/sheet'
import { useToast } from '@/components/ui/toast'
import { useUpdateContact, useDeleteContact, useTestContact } from '../api'
import { ContactForm } from './ContactForm'
import type { Contact, ContactCreate } from '../types'

interface ContactCardProps {
  contact: Contact
}

export function ContactCard({ contact }: ContactCardProps) {
  const { toast } = useToast()
  const [editing,   setEditing]   = useState(false)
  const [deleting,  setDeleting]  = useState(false)
  const [testState, setTestState] = useState<'idle' | 'ok' | 'err'>('idle')

  const update    = useUpdateContact(contact.id)
  const deleteOp  = useDeleteContact()
  const testOp    = useTestContact()

  function handleUpdate(data: ContactCreate) {
    update.mutate(
      { name: data.name, config: data.config },
      {
        onSuccess: () => { toast('Contact updated', 'success'); setEditing(false) },
        onError:   () => toast('Failed to update', 'error'),
      },
    )
  }

  function handleDelete() {
    deleteOp.mutate(contact.id, {
      onSuccess: () => toast('Contact deleted', 'success'),
      onError:   () => toast('Failed to delete', 'error'),
    })
  }

  function handleTest() {
    setTestState('idle')
    testOp.mutate(contact.id, {
      onSuccess: () => { setTestState('ok'); toast('Test notification sent!', 'success') },
      onError:   () => { setTestState('err'); toast('Test failed — check webhook URL', 'error') },
    })
  }

  const raw = contact.config?.webhook_url ?? ''
  const webhookDisplay = raw ? raw.replace(/^https:\/\//, '').slice(0, 48) + '…' : '—'

  return (
    <>
      <div className="flex items-start justify-between rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-[var(--text-1)]">{contact.name}</span>
            <span className="rounded bg-[var(--accent-bg)] px-1.5 py-px font-mono text-[9px] font-semibold text-[var(--accent)]">
              {contact.type}
            </span>
            {!contact.active && (
              <span className="rounded bg-[var(--skipped-bg)] px-1.5 py-px font-mono text-[9px] text-[var(--skipped)]">
                inactive
              </span>
            )}
          </div>
          <div className="mt-1 font-mono text-[10px] text-[var(--text-3)]">
            {webhookDisplay}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1 pl-4">
          {/* Test */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleTest}
            disabled={testOp.isPending}
            title="Send test notification"
          >
            {testState === 'ok'  ? <CheckCircle size={13} style={{ color: 'var(--success)' }} /> :
             testState === 'err' ? <AlertCircle size={13} style={{ color: 'var(--failure)' }} /> :
             <Send size={13} />}
          </Button>
          {/* Edit */}
          <Button variant="ghost" size="icon" onClick={() => setEditing(true)} title="Edit">
            <Pencil size={13} />
          </Button>
          {/* Delete */}
          <Button variant="ghost" size="icon" onClick={() => setDeleting(true)} title="Delete">
            <Trash2 size={13} style={{ color: 'var(--failure)' }} />
          </Button>
        </div>
      </div>

      {/* Edit sheet */}
      <Sheet open={editing} onClose={() => setEditing(false)} title="Edit contact" width="480px">
        <div className="p-5">
          <ContactForm
            initial={contact}
            onSubmit={handleUpdate}
            onCancel={() => setEditing(false)}
            isPending={update.isPending}
          />
        </div>
      </Sheet>

      {/* Delete confirm */}
      <Dialog
        open={deleting}
        onClose={() => setDeleting(false)}
        title="Delete contact?"
        description={`"${contact.name}" will be permanently removed. Jobs using this contact will no longer receive immediate notifications.`}
      >
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => setDeleting(false)}>Cancel</Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={deleteOp.isPending}
          >
            {deleteOp.isPending ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogFooter>
      </Dialog>
    </>
  )
}
