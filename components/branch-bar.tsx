import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveContext }  from '@/lib/tenant/context'
import { switchBranch }      from '@/app/actions/branches'
import Link                  from 'next/link'

export async function BranchBar() {
  const ctx = await getActiveContext()
  if (!ctx) return null

  const sb = createAdminClient() as any
  const { data: branches } = await sb
    .from('branches')
    .select('id, name')
    .eq('organization_id', ctx.organizationId)
    .is('deleted_at', null)
    .order('created_at')

  const list = (branches ?? []) as { id: string; name: string }[]
  if (list.length <= 1) return null

  return (
    <div className="bg-white border-b border-fog px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto flex items-center gap-1 overflow-x-auto py-1.5 scrollbar-none">
        <span className="text-[10px] font-semibold text-slate uppercase tracking-wider shrink-0 mr-1">
          Sucursal:
        </span>
        {list.map((branch) => {
          const isActive = branch.id === ctx.branchId
          const action   = switchBranch.bind(null, branch.id)
          return (
            <form key={branch.id} action={action}>
              <button
                type="submit"
                className={`text-xs font-medium px-3 py-1 rounded-full whitespace-nowrap transition-colors ${
                  isActive
                    ? 'bg-brand-600 text-white'
                    : 'text-slate hover:text-ink hover:bg-mist'
                }`}
              >
                {branch.name}
              </button>
            </form>
          )
        })}
        <Link
          href="/settings/branches"
          className="text-[10px] text-slate hover:text-ink ml-auto shrink-0 underline"
        >
          Gestionar
        </Link>
      </div>
    </div>
  )
}
