import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Topbar } from '@/components/layout/Topbar'
import { Button } from '@/components/ui/button'
import { Sheet } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/toast'
import { useContacts, useCreateContact } from '../api'
import { ContactCard } from '../components/ContactCard'
import { ContactForm } from '../components/ContactForm'
import type { ContactCreate } from '../types'

export function ContactsPage() {
  const { toast } = useToast()
  const { data: contacts = [], isLoading } = useContacts()
  const createContact = useCreateContact()
  const [adding, setAdding] = useState(false)

  function handleCreate(data: ContactCreate) {
    createContact.mutate(data, {
      onSuccess: () => { toast('Contact added', 'success'); setAdding(false) },
      onError:   () => toast('Failed to create contact', 'error'),
    })
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <Topbar
        title="Contacts"
        subtitle="Notification channels for immediate alerts"
        actions={
          <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
            <Plus size={12} />
            Add contact
          </Button>
        }
      />

      <div className="flex-1 overflow-auto p-5">
        {isLoading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-lg" />
            ))}
          </div>
        ) : contacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-3 text-4xl opacity-10">◎</div>
            <p className="text-sm font-semibold text-[var(--text-1)]">No contacts yet</p>
            <p className="mt-1 max-w-xs text-xs text-[var(--text-3)]">
              Add a Teams Workflows webhook to receive immediate alerts when backup jobs fail.
            </p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => setAdding(true)}>
              <Plus size={12} />
              Add first contact
            </Button>
          </div>
        ) : (
          <div className="flex max-w-2xl flex-col gap-3">
            {contacts.map(c => (
              <ContactCard key={c.id} contact={c} />
            ))}
          </div>
        )}
      </div>

      {/* Add contact sheet */}
      <Sheet open={adding} onClose={() => setAdding(false)} title="Add contact" width="480px">
        <div className="p-5">
          <ContactForm
            onSubmit={handleCreate}
            onCancel={() => setAdding(false)}
            isPending={createContact.isPending}
          />
        </div>
      </Sheet>
    </div>
  )
}
