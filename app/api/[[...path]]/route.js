import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase'
import { parseSheetBuffer } from '@/lib/parseSheet'

export const runtime = 'nodejs'
export const maxDuration = 60

function cors(res) {
  res.headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGINS || '*')
  res.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  return res
}

export async function OPTIONS() { return cors(new NextResponse(null, { status: 200 })) }

// Verify the user's access token and return their profile (with role)
async function getUserProfile(request) {
  const auth = request.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return null
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
  const { data: { user }, error } = await sb.auth.getUser(token)
  if (error || !user) return null
  const admin = supabaseAdmin()
  const { data: profile } = await admin.from('profiles').select('*').eq('id', user.id).maybeSingle()
  if (!profile) return { id: user.id, email: user.email, role: 'staff', full_name: user.user_metadata?.full_name || null }
  return profile
}

async function handle(request, { params }) {
  const { path = [] } = await params
  const route = `/${path.join('/')}`
  const method = request.method
  try {
    if (route === '/' && method === 'GET') {
      return cors(NextResponse.json({ ok: true, service: 'pharmacy-search' }))
    }

    // -------- WHOAMI: return current profile --------
    if (route === '/me' && method === 'GET') {
      const profile = await getUserProfile(request)
      if (!profile) return cors(NextResponse.json({ error: 'unauthenticated' }, { status: 401 }))
      return cors(NextResponse.json(profile))
    }

    // -------- STATS (auth required) --------
    if (route === '/stats' && method === 'GET') {
      const profile = await getUserProfile(request)
      if (!profile) return cors(NextResponse.json({ error: 'unauthenticated' }, { status: 401 }))
      const sb = supabaseAdmin()
      const { data, error } = await sb.from('stats_overview').select('*').maybeSingle()
      if (error) throw error
      return cors(NextResponse.json(data || {}))
    }

    // -------- UPLOADS LIST (auth required) --------
    if (route === '/uploads' && method === 'GET') {
      const profile = await getUserProfile(request)
      if (!profile) return cors(NextResponse.json({ error: 'unauthenticated' }, { status: 401 }))
      const sb = supabaseAdmin()
      const { data, error } = await sb.from('uploads').select('*').order('created_at', { ascending: false }).limit(100)
      if (error) throw error
      return cors(NextResponse.json(data || []))
    }

    // -------- UPLOAD FILE (ADMIN ONLY) --------
    if (route === '/upload' && method === 'POST') {
      const profile = await getUserProfile(request)
      if (!profile) return cors(NextResponse.json({ error: 'unauthenticated' }, { status: 401 }))
      if (profile.role !== 'admin') return cors(NextResponse.json({ error: 'forbidden: admin only' }, { status: 403 }))
      const formData = await request.formData()
      const file = formData.get('file')
      const warehouseHint = formData.get('warehouse') || null
      if (!file) return cors(NextResponse.json({ error: 'No file provided' }, { status: 400 }))

      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      const { records, headers, mapped } = parseSheetBuffer(buffer, file.name)

      if (!records.length) {
        return cors(NextResponse.json({
          error: 'لم يتم العثور على أي صفوف صالحة. تأكد من وجود عمود "اسم الدواء".',
          headers, mapped,
        }, { status: 400 }))
      }

      const sb = supabaseAdmin()
      const { data: uploadRow, error: upErr } = await sb.from('uploads').insert({
        filename: file.name,
        rows_count: records.length,
        warehouse_hint: warehouseHint,
        uploaded_by: profile.id,
        uploaded_by_email: profile.email,
      }).select('*').single()
      if (upErr) throw upErr

      const BATCH = 500
      let inserted = 0
      for (let i = 0; i < records.length; i += BATCH) {
        const batch = records.slice(i, i + BATCH).map(r => ({
          ...r,
          upload_id: uploadRow.id,
          warehouse: r.warehouse || warehouseHint || null,
        }))
        const { error: insErr } = await sb.from('medicines').insert(batch)
        if (insErr) { console.error('Batch insert error:', insErr); throw insErr }
        inserted += batch.length
      }

      return cors(NextResponse.json({ ok: true, upload_id: uploadRow.id, filename: file.name, rows_inserted: inserted, headers, mapped }))
    }

    // Helper to get latest upload id (for "current dataset" filtering)
    async function getLatestUploadId(sb) {
      const { data } = await sb.from('uploads').select('id').order('created_at', { ascending: false }).limit(1).maybeSingle()
      return data?.id || null
    }

    // -------- LIVE SUGGESTIONS (auth required) - filters to LATEST UPLOAD ONLY --------
    if (route === '/suggest' && method === 'GET') {
      const profile = await getUserProfile(request)
      if (!profile) return cors(NextResponse.json({ error: 'unauthenticated' }, { status: 401 }))
      const url = new URL(request.url)
      const q = (url.searchParams.get('q') || '').trim()
      if (!q) return cors(NextResponse.json([]))
      const sb = supabaseAdmin()
      const latestId = await getLatestUploadId(sb)
      if (!latestId) return cors(NextResponse.json([]))
      const { data, error } = await sb.from('medicines')
        .select('name, scientific_name, company, source_id')
        .eq('upload_id', latestId)
        .ilike('search_text', `%${q.toLowerCase()}%`)
        .limit(200)
      if (error) throw error
      // Group by name in JS
      const map = new Map()
      for (const r of data || []) {
        const key = r.name
        if (!map.has(key)) map.set(key, { name: r.name, scientific_name: r.scientific_name, company: r.company, hits: 0, max_id: parseInt(r.source_id) || 0 })
        const g = map.get(key); g.hits++
        const sid = parseInt(r.source_id); if (!isNaN(sid) && sid > g.max_id) g.max_id = sid
      }
      const out = Array.from(map.values())
        .sort((a, b) => {
          const aStarts = a.name.toLowerCase().startsWith(q.toLowerCase()) ? 0 : 1
          const bStarts = b.name.toLowerCase().startsWith(q.toLowerCase()) ? 0 : 1
          if (aStarts !== bStarts) return aStarts - bStarts
          return b.max_id - a.max_id
        })
        .slice(0, 10)
      return cors(NextResponse.json(out))
    }

    // -------- SEARCH (auth required) - filters to LATEST UPLOAD ONLY --------
    if (route === '/search' && method === 'GET') {
      const profile = await getUserProfile(request)
      if (!profile) return cors(NextResponse.json({ error: 'unauthenticated' }, { status: 401 }))
      const url = new URL(request.url)
      const q = (url.searchParams.get('q') || '').trim()
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '200'), 2000)
      const sb = supabaseAdmin()
      const latestId = await getLatestUploadId(sb)
      if (!latestId) return cors(NextResponse.json([]))
      let query = sb.from('medicines').select('*').eq('upload_id', latestId).order('created_at', { ascending: false }).limit(limit)
      if (q) query = query.ilike('search_text', `%${q.toLowerCase()}%`)
      const { data, error } = await query
      if (error) throw error
      return cors(NextResponse.json(data || []))
    }

    // -------- DELETE AN UPLOAD (admin only) -------- 
    if (route.startsWith('/uploads/') && method === 'DELETE') {
      const profile = await getUserProfile(request)
      if (!profile) return cors(NextResponse.json({ error: 'unauthenticated' }, { status: 401 }))
      if (profile.role !== 'admin') return cors(NextResponse.json({ error: 'forbidden' }, { status: 403 }))
      const id = route.split('/')[2]
      const sb = supabaseAdmin()
      const { error: dmErr } = await sb.from('medicines').delete().eq('upload_id', id)
      if (dmErr) return cors(NextResponse.json({ error: dmErr.message }, { status: 400 }))
      const { error: duErr } = await sb.from('uploads').delete().eq('id', id)
      if (duErr) return cors(NextResponse.json({ error: duErr.message }, { status: 400 }))
      return cors(NextResponse.json({ ok: true }))
    }

    // -------- HISTORY (auth required) --------
    if (route === '/history' && method === 'GET') {
      const profile = await getUserProfile(request)
      if (!profile) return cors(NextResponse.json({ error: 'unauthenticated' }, { status: 401 }))
      const url = new URL(request.url)
      const name = (url.searchParams.get('name') || '').trim()
      if (!name) return cors(NextResponse.json([]))
      const sb = supabaseAdmin()
      const { data, error } = await sb.from('medicines')
        .select('*').ilike('name', name)
        .order('invoice_date', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false }).limit(500)
      if (error) throw error
      return cors(NextResponse.json(data || []))
    }

    // -------- USERS LIST (admin only) --------
    if (route === '/users' && method === 'GET') {
      const profile = await getUserProfile(request)
      if (!profile) return cors(NextResponse.json({ error: 'unauthenticated' }, { status: 401 }))
      if (profile.role !== 'admin') return cors(NextResponse.json({ error: 'forbidden' }, { status: 403 }))
      const sb = supabaseAdmin()
      const { data, error } = await sb.from('profiles').select('*').order('created_at', { ascending: false })
      if (error) throw error
      return cors(NextResponse.json(data || []))
    }

    // -------- CREATE USER (admin only) --------
    if (route === '/users' && method === 'POST') {
      const profile = await getUserProfile(request)
      if (!profile) return cors(NextResponse.json({ error: 'unauthenticated' }, { status: 401 }))
      if (profile.role !== 'admin') return cors(NextResponse.json({ error: 'forbidden' }, { status: 403 }))
      const body = await request.json()
      const { email, password, full_name, role = 'staff' } = body || {}
      if (!email || !password) return cors(NextResponse.json({ error: 'البريد وكلمة المرور مطلوبان' }, { status: 400 }))
      if (!['admin','staff'].includes(role)) return cors(NextResponse.json({ error: 'invalid role' }, { status: 400 }))

      const admin = supabaseAdmin()
      const { data: created, error: cErr } = await admin.auth.admin.createUser({
        email, password, email_confirm: true, user_metadata: { full_name },
      })
      if (cErr) return cors(NextResponse.json({ error: cErr.message }, { status: 400 }))
      const { error: pErr } = await admin.from('profiles').upsert({
        id: created.user.id, email, full_name: full_name || null, role,
      })
      if (pErr) return cors(NextResponse.json({ error: pErr.message }, { status: 400 }))
      return cors(NextResponse.json({ ok: true, user: { id: created.user.id, email, full_name, role } }))
    }

    // -------- DELETE USER (admin only) --------
    if (route.startsWith('/users/') && method === 'DELETE') {
      const profile = await getUserProfile(request)
      if (!profile) return cors(NextResponse.json({ error: 'unauthenticated' }, { status: 401 }))
      if (profile.role !== 'admin') return cors(NextResponse.json({ error: 'forbidden' }, { status: 403 }))
      const id = route.split('/')[2]
      if (id === profile.id) return cors(NextResponse.json({ error: 'لا يمكنك حذف نفسك' }, { status: 400 }))
      const admin = supabaseAdmin()
      const { error: dErr } = await admin.auth.admin.deleteUser(id)
      if (dErr) return cors(NextResponse.json({ error: dErr.message }, { status: 400 }))
      return cors(NextResponse.json({ ok: true }))
    }

    // -------- UPDATE USER ROLE (admin only) --------
    if (route.startsWith('/users/') && method === 'PATCH') {
      const profile = await getUserProfile(request)
      if (!profile) return cors(NextResponse.json({ error: 'unauthenticated' }, { status: 401 }))
      if (profile.role !== 'admin') return cors(NextResponse.json({ error: 'forbidden' }, { status: 403 }))
      const id = route.split('/')[2]
      const body = await request.json()
      const { role, password } = body || {}
      const admin = supabaseAdmin()
      if (password) {
        const { error } = await admin.auth.admin.updateUserById(id, { password })
        if (error) return cors(NextResponse.json({ error: error.message }, { status: 400 }))
      }
      if (role && ['admin','staff'].includes(role)) {
        const { error } = await admin.from('profiles').update({ role }).eq('id', id)
        if (error) return cors(NextResponse.json({ error: error.message }, { status: 400 }))
      }
      return cors(NextResponse.json({ ok: true }))
    }

    return cors(NextResponse.json({ error: `Route ${route} not found` }, { status: 404 }))
  } catch (e) {
    console.error('API error:', e)
    return cors(NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 }))
  }
}

export const GET = handle
export const POST = handle
export const PUT = handle
export const DELETE = handle
export const PATCH = handle
