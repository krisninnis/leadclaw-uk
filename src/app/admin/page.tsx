import { readFile } from 'fs/promises'
import path from 'path'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import LogoutButton from '@/components/logout-button'
import OpsSummary from '@/components/ops-summary'
import LeadImporter from '@/components/lead-importer'
import LeadsTable from '@/components/leads-table'
import LeadCommandCenter from '@/components/lead-command-center'
import OpsActivityLog from '@/components/ops-activity-log'

type AppRow = {
  id?: string
  clinic_name: string
  contact_name: string
  email: string
  city: string
  status: string
  created_at: string
}

export default async function AdminPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  const adminEmails = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)

  const isAdminEmail = !!user.email && adminEmails.includes(user.email.toLowerCase())
  const isAdmin = profile?.role === 'admin' || isAdminEmail

  if (!isAdmin) {
    redirect('/portal')
  }

  let applications: AppRow[] = []
  let source = 'local_fallback'

  const admin = createAdminClient()
  if (admin) {
    const { data } = await admin
      .from('applications')
      .select('id,clinic_name,contact_name,email,city,status,created_at')
      .order('created_at', { ascending: false })
      .limit(20)

    applications = (data as AppRow[]) || []
    source = 'supabase'
  } else {
    try {
      const file = path.join(process.cwd(), 'data', 'applications.jsonl')
      const txt = await readFile(file, 'utf8')
      const rows = txt.trim() ? txt.trim().split('\n').map((l) => JSON.parse(l)) : []
      applications = rows.slice(-20).reverse()
    } catch {}
  }

  const { count: subCount } = admin
    ? await admin.from('subscriptions').select('*', { count: 'exact', head: true })
    : { count: 0 }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Admin Dashboard (MVP)</h1>
          <p className="text-sm text-slate-600">Data source: {source}</p>
        </div>
        <LogoutButton />
      </div>

      <OpsSummary />

      <div className="rounded-xl border bg-white p-4 text-sm">
        Active/known subscriptions: <strong>{subCount || 0}</strong>
      </div>

      <LeadImporter />
      <LeadsTable />
      <LeadCommandCenter />
      <OpsActivityLog />

      <div className="rounded-xl border bg-white p-6">
        <h2 className="mb-3 text-lg font-semibold">Latest applications</h2>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b">
              <th className="py-2">Clinic</th>
              <th>Contact</th>
              <th>Email</th>
              <th>City</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {applications.map((a, i) => (
              <tr key={a.id || `${a.email}-${i}`} className="border-b last:border-0">
                <td className="py-2">{a.clinic_name}</td>
                <td>{a.contact_name}</td>
                <td>{a.email}</td>
                <td>{a.city}</td>
                <td>{a.status}</td>
              </tr>
            ))}
            {applications.length === 0 && (
              <tr>
                <td className="py-3 text-slate-500" colSpan={5}>No applications yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
