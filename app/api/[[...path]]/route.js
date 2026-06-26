import { NextResponse } from 'next/server'
import { supabaseAdmin, supabasePublic } from '@/lib/supabase'
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

async function handle(request, { params }) {
  const { path = [] } = await params
  const route = `/${path.join('/')}`
  const method = request.method
  try {
    if (route === '/' && method === 'GET') {
      return cors(NextResponse.json({ ok: true, service: 'pharmacy-search' }))
    }

    // -------- STATS --------
    if (route === '/stats' && method === 'GET') {
      const sb = supabaseAdmin()
      const { data, error } = await sb.from('stats_overview').select('*').maybeSingle()
      if (error) throw error
      return cors(NextResponse.json(data || {}))
    }

    // -------- UPLOADS LIST --------
    if (route === '/uploads' && method === 'GET') {
      const sb = supabaseAdmin()
      const { data, error } = await sb.from('uploads').select('*').order('created_at', { ascending: false }).limit(100)
      if (error) throw error
      return cors(NextResponse.json(data || []))
    }

    // -------- UPLOAD FILE (admin) --------
    if (route === '/upload' && method === 'POST') {
      const formData = await request.formData()
      const file = formData.get('file')
      const warehouseHint = formData.get('warehouse') || null
      const uploaderEmail = formData.get('uploader_email') || null
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
        uploaded_by_email: uploaderEmail,
      }).select('*').single()
      if (upErr) throw upErr

      // Insert in batches of 500
      const BATCH = 500
      let inserted = 0
      for (let i = 0; i < records.length; i += BATCH) {
        const batch = records.slice(i, i + BATCH).map(r => ({
          ...r,
          upload_id: uploadRow.id,
          warehouse: r.warehouse || warehouseHint || null,
        }))
        const { error: insErr } = await sb.from('medicines').insert(batch)
        if (insErr) {
          console.error('Batch insert error:', insErr)
          throw insErr
        }
        inserted += batch.length
      }

      return cors(NextResponse.json({
        ok: true,
        upload_id: uploadRow.id,
        filename: file.name,
        rows_inserted: inserted,
        headers, mapped,
      }))
    }

    // -------- LIVE SUGGESTIONS --------
    if (route === '/suggest' && method === 'GET') {
      const url = new URL(request.url)
      const q = (url.searchParams.get('q') || '').trim()
      if (!q) return cors(NextResponse.json([]))
      const sb = supabaseAdmin()
      const { data, error } = await sb.rpc('search_medicines_suggestions', { q, max_results: 10 })
      if (error) throw error
      return cors(NextResponse.json(data || []))
    }

    // -------- SEARCH (full results) --------
    if (route === '/search' && method === 'GET') {
      const url = new URL(request.url)
      const q = (url.searchParams.get('q') || '').trim()
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '200'), 1000)
      const sb = supabaseAdmin()
      let query = sb.from('medicines').select('*').order('created_at', { ascending: false }).limit(limit)
      if (q) {
        // Use ilike on search_text for partial Arabic/English match
        query = query.ilike('search_text', `%${q.toLowerCase()}%`)
      }
      const { data, error } = await query
      if (error) throw error
      return cors(NextResponse.json(data || []))
    }

    // -------- HISTORY for a specific medicine name --------
    if (route === '/history' && method === 'GET') {
      const url = new URL(request.url)
      const name = (url.searchParams.get('name') || '').trim()
      if (!name) return cors(NextResponse.json([]))
      const sb = supabaseAdmin()
      const { data, error } = await sb.from('medicines')
        .select('*')
        .ilike('name', name)
        .order('invoice_date', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(500)
      if (error) throw error
      return cors(NextResponse.json(data || []))
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
