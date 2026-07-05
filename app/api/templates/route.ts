// GET /api/templates?conversation_id=<uuid>
// Returns active message_templates for the branch of a conversation.
// Used by MessageComposer (client component) to show the template picker.

import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@/lib/supabase/server'
import { createAdminClient }         from '@/lib/supabase/admin'
import { getActiveOrganizationId }   from '@/lib/tenant/context'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const conversationId = req.nextUrl.searchParams.get('conversation_id')
  if (!conversationId) return NextResponse.json({ error: 'conversation_id required' }, { status: 400 })

  const organizationId = await getActiveOrganizationId()
  if (!organizationId) return NextResponse.json({ error: 'no active org' }, { status: 400 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any

  // Resolve branch from conversation (scoped to org for security)
  const { data: conv } = await sb
    .from('conversations')
    .select('branch_id')
    .eq('id', conversationId)
    .eq('organization_id', organizationId)
    .single()

  if (!conv) return NextResponse.json({ error: 'conversation not found' }, { status: 404 })

  const { data: templates } = await sb
    .from('message_templates')
    .select('id, name, body, category')
    .eq('organization_id', organizationId)
    .eq('branch_id', conv.branch_id)
    .eq('is_active', true)
    .order('category')
    .order('name')

  return NextResponse.json({ templates: templates ?? [] })
}
