import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import type { Contact, ContactCreate } from '../types'

interface ContactFormProps {
  initial?: Contact
  onSubmit: (data: ContactCreate) => void
  onCancel: () => void
  isPending: boolean
}

export function ContactForm({ initial, onSubmit, onCancel, isPending }: ContactFormProps) {
  const [name, setName]       = useState(initial?.name ?? '')
  const [webhook, setWebhook] = useState(initial?.config.webhook_url ?? '')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSubmit({ name, type: 'teams', config: { webhook_url: webhook } })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1">
        <span className="text-xs text-[var(--text-2)]">Name</span>
        <Input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. Ops Team Channel"
          required
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-[var(--text-2)]">Teams Webhook URL</span>
        <Input
          value={webhook}
          onChange={e => setWebhook(e.target.value)}
          placeholder="https://your-org.webhook.office.com/..."
          type="url"
          required
          className="font-mono text-[10px]"
        />
        <span className="text-[10px] text-[var(--text-3)]">
          Use a Teams Workflows webhook — not the legacy Office 365 Connector.
        </span>
      </label>
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="default" size="sm" disabled={isPending || !name.trim() || !webhook.trim()}>
          {isPending ? 'Saving…' : initial ? 'Save changes' : 'Add contact'}
        </Button>
      </div>
    </form>
  )
}
