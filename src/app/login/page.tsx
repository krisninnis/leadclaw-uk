'use client'

import { FormEvent, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('')

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setStatus('Sending magic link...')
    const supabase = createClient()

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/portal`,
      },
    })

    if (error) {
      setStatus(error.message)
      return
    }

    setStatus('Magic link sent. Check your email.')
  }

  return (
    <div className="mx-auto max-w-lg rounded-xl border bg-white p-6">
      <h1 className="mb-2 text-2xl font-bold">Sign in</h1>
      <p className="mb-4 text-sm text-slate-600">Use a secure magic link (no password).</p>
      <form onSubmit={onSubmit} className="space-y-3">
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          required
          placeholder="you@clinic.com"
          className="w-full rounded-lg border border-slate-300 p-2"
        />
        <button className="rounded-lg bg-slate-900 px-4 py-2 text-white" type="submit">
          Send magic link
        </button>
      </form>
      {status && <p className="mt-3 text-sm text-slate-700">{status}</p>}
    </div>
  )
}
