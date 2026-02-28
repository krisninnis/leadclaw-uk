import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default function LogoutButton() {
  async function logout() {
    'use server'
    const supabase = await createClient()
    await supabase.auth.signOut()
    redirect('/login')
  }

  return (
    <form action={logout}>
      <button className="rounded-lg border border-slate-300 px-3 py-1 text-sm" type="submit">
        Logout
      </button>
    </form>
  )
}
