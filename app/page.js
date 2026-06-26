'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Search, Upload, Pill, Building2, FileSpreadsheet, Database, Calendar, DollarSign, Hash, Package, History, Loader2, ShieldCheck, X, LogOut, UserPlus, User, Trash2, Users as UsersIcon } from 'lucide-react'
import { toast } from 'sonner'
import { getBrowserSupabase } from '@/lib/supabaseBrowser'

function formatNumber(n) {
  if (n === null || n === undefined || n === '') return '—'
  const num = typeof n === 'number' ? n : parseFloat(n)
  if (isNaN(num)) return String(n)
  return num.toLocaleString('en-US', { maximumFractionDigits: 2 })
}
function formatDate(d) {
  if (!d) return '—'
  try { return new Date(d).toLocaleDateString('en-CA') } catch { return String(d) }
}

// Helper: authenticated fetch using current session token
function useAuthedFetch(session) {
  return useCallback(async (url, opts = {}) => {
    const headers = new Headers(opts.headers || {})
    if (session?.access_token) headers.set('Authorization', `Bearer ${session.access_token}`)
    if (!(opts.body instanceof FormData) && opts.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
    return fetch(url, { ...opts, headers })
  }, [session?.access_token])
}

function StatCard({ icon: Icon, label, value, accent }) {
  return (
    <Card className="border-0 shadow-sm bg-gradient-to-br from-white to-slate-50">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-3xl font-bold mt-1 num">{value}</p>
          </div>
          <div className={`size-12 rounded-xl flex items-center justify-center ${accent}`}><Icon className="size-6" /></div>
        </div>
      </CardContent>
    </Card>
  )
}

function MedicineDetailDialog({ record, open, onOpenChange, authedFetch }) {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || !record?.name) return
    setLoading(true)
    authedFetch(`/api/history?name=${encodeURIComponent(record.name)}`)
      .then(r => r.json()).then(d => setHistory(Array.isArray(d) ? d : []))
      .catch(() => setHistory([])).finally(() => setLoading(false))
  }, [open, record?.name, authedFetch])

  if (!record) return null
  const fields = [
    { label: 'ID', value: record.source_id, icon: Hash },
    { label: 'الاسم العلمي', value: record.scientific_name, icon: Pill },
    { label: 'الشركة', value: record.company, icon: Building2 },
    { label: 'المخزن', value: record.warehouse, icon: Database },
    { label: 'رقم الفاتورة', value: record.invoice_number, icon: Hash },
    { label: 'تاريخ الفاتورة', value: formatDate(record.invoice_date), icon: Calendar },
    { label: 'الكمية', value: formatNumber(record.quantity), icon: Package },
    { label: 'سعر الشراء', value: formatNumber(record.unit_price), icon: DollarSign },
    { label: 'السعر الكلي', value: formatNumber(record.total_price), icon: DollarSign },
    { label: 'السعر الأصلي', value: formatNumber(record.original_price), icon: DollarSign },
    { label: 'سعر البيع', value: formatNumber(record.selling_price), icon: DollarSign },
    { label: 'هدية', value: formatNumber(record.gift), icon: Package },
    { label: 'هدية مندوب', value: formatNumber(record.rep_gift), icon: Package },
    { label: 'رقم الدفعة', value: record.batch_number, icon: Hash },
    { label: 'تاريخ الانتهاء', value: record.expiry_raw || formatDate(record.expiry_date), icon: Calendar },
    { label: 'الباركود', value: record.barcode, icon: Hash },
    { label: 'ملاحظات', value: record.notes, icon: FileSpreadsheet },
    { label: 'تاريخ الرفع', value: formatDate(record.created_at), icon: Calendar },
  ]
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-3">
            <div className="size-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center"><Pill className="size-5" /></div>
            {record.name}
          </DialogTitle>
          <DialogDescription>كل المعلومات المتوفرة + سجل الشراء الكامل</DialogDescription>
        </DialogHeader>
        <ScrollArea className="flex-1 pr-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
            {fields.map((f, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/40 border">
                <f.icon className="size-4 text-primary mt-1 flex-shrink-0" />
                <div className="min-w-0 flex-1"><p className="text-xs text-muted-foreground">{f.label}</p><p className="font-medium truncate">{f.value || '—'}</p></div>
              </div>
            ))}
          </div>
          <div>
            <h3 className="text-lg font-bold flex items-center gap-2 mb-3"><History className="size-5 text-primary" /> سجل الشراء الكامل {history.length > 0 && <Badge variant="secondary" className="num">{history.length}</Badge>}</h3>
            {loading ? (
              <div className="flex items-center gap-2 text-muted-foreground p-4"><Loader2 className="size-4 animate-spin" /> جاري التحميل...</div>
            ) : history.length === 0 ? (
              <p className="text-muted-foreground p-4">لا يوجد سجل آخر.</p>
            ) : (
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted text-muted-foreground"><tr><th className="p-2 text-right">ID</th><th className="p-2 text-right">التاريخ</th><th className="p-2 text-right">المخزن</th><th className="p-2 text-right">الفاتورة</th><th className="p-2 text-right">الكمية</th><th className="p-2 text-right">سعر الوحدة</th><th className="p-2 text-right">السعر الكلي</th><th className="p-2 text-right">الانتهاء</th></tr></thead>
                  <tbody>{history.map((h) => (<tr key={h.id} className="border-t hover:bg-muted/30"><td className="p-2 num font-medium">{h.source_id || '—'}</td><td className="p-2 num">{formatDate(h.invoice_date)}</td><td className="p-2">{h.warehouse || '—'}</td><td className="p-2 num">{h.invoice_number || '—'}</td><td className="p-2 num">{formatNumber(h.quantity)}</td><td className="p-2 num">{formatNumber(h.unit_price)}</td><td className="p-2 num">{formatNumber(h.total_price)}</td><td className="p-2 num">{h.expiry_raw || formatDate(h.expiry_date)}</td></tr>))}</tbody>
                </table>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}

function SearchTab({ authedFetch }) {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [showSuggest, setShowSuggest] = useState(false)
  const [results, setResults] = useState([])
  const [selected, setSelected] = useState(null)
  const [open, setOpen] = useState(false)
  const debounceRef = useRef(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const q = query.trim()
    if (!q) {
      setSuggestions([])
      authedFetch('/api/search?q=&limit=50').then(r => r.json()).then(d => setResults(Array.isArray(d) ? d : []))
      return
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const [sRes, rRes] = await Promise.all([
          authedFetch(`/api/suggest?q=${encodeURIComponent(q)}`),
          authedFetch(`/api/search?q=${encodeURIComponent(q)}&limit=200`),
        ])
        const sData = await sRes.json()
        const rData = await rRes.json()
        setSuggestions(Array.isArray(sData) ? sData : [])
        setResults(Array.isArray(rData) ? rData : [])
      } catch (e) { console.error(e) }
    }, 180)
  }, [query, authedFetch])

  const grouped = useMemo(() => {
    const map = new Map()
    for (const r of results) {
      const k = (r.name || '').toLowerCase()
      if (!map.has(k)) map.set(k, { name: r.name, latest: r, count: 0, items: [] })
      const g = map.get(k)
      g.count++; g.items.push(r)
      if (new Date(r.created_at) > new Date(g.latest.created_at)) g.latest = r
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count).slice(0, 60)
  }, [results])

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute right-4 top-1/2 -translate-y-1/2 size-5 text-muted-foreground" />
        <Input
          value={query}
          onChange={e => { setQuery(e.target.value); setShowSuggest(true) }}
          onFocus={() => setShowSuggest(true)}
          onBlur={() => setTimeout(() => setShowSuggest(false), 200)}
          placeholder="ابحث عن دواء بالعربي أو الإنجليزي، أو الشركة، أو الباركود..."
          className="h-14 pr-12 text-lg shadow-sm border-2 focus-visible:ring-primary"
        />
        {query && (<button onClick={() => setQuery('')} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X className="size-5" /></button>)}
        {showSuggest && suggestions.length > 0 && (
          <div className="absolute z-30 mt-2 w-full rounded-lg border bg-popover shadow-lg overflow-hidden">
            {suggestions.map((s, i) => (
              <button key={i} onMouseDown={(e) => { e.preventDefault(); setQuery(s.name); setShowSuggest(false) }}
                className="w-full text-right px-4 py-3 hover:bg-accent border-b last:border-b-0 flex items-center justify-between gap-3">
                <div className="min-w-0"><p className="font-medium truncate">{s.name}</p><p className="text-xs text-muted-foreground truncate">{s.company || s.scientific_name || '—'}</p></div>
                <Badge variant="outline" className="num">{s.hits} سجل</Badge>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="flex items-center justify-between text-sm text-muted-foreground px-1">
        <span>{grouped.length > 0 ? <>عُثر على <span className="num font-bold text-foreground">{grouped.length}</span> دواء — <span className="num">{results.length}</span> سجل</> : 'لا توجد نتائج'}</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {grouped.map((g) => {
          const r = g.latest
          return (
            <Card key={g.name} className="hover:shadow-md hover:border-primary/40 transition cursor-pointer" onClick={() => { setSelected(r); setOpen(true) }}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2"><h3 className="font-bold text-base leading-tight line-clamp-2">{g.name}</h3><Badge className="shrink-0 num">{g.count}</Badge></div>
                {r.source_id && <p className="text-[11px] text-muted-foreground flex items-center gap-1"><Hash className="size-3" /> ID: <span className="num font-medium text-foreground">{r.source_id}</span></p>}
                <div className="text-xs text-muted-foreground space-y-1">{r.scientific_name && <p className="truncate">{r.scientific_name}</p>}{r.company && <p className="flex items-center gap-1"><Building2 className="size-3" /> {r.company}</p>}</div>
                <div className="grid grid-cols-3 gap-2 pt-2 border-t">
                  <div><p className="text-[10px] text-muted-foreground">السعر</p><p className="font-semibold text-sm num">{formatNumber(r.unit_price)}</p></div>
                  <div><p className="text-[10px] text-muted-foreground">آخر كمية</p><p className="font-semibold text-sm num">{formatNumber(r.quantity)}</p></div>
                  <div><p className="text-[10px] text-muted-foreground">آخر فاتورة</p><p className="font-semibold text-xs num">{formatDate(r.invoice_date)}</p></div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
      <MedicineDetailDialog record={selected} open={open} onOpenChange={setOpen} authedFetch={authedFetch} />
    </div>
  )
}

function AdminTab({ authedFetch }) {
  const [file, setFile] = useState(null)
  const [warehouse, setWarehouse] = useState('')
  const [uploading, setUploading] = useState(false)
  const [stats, setStats] = useState(null)
  const [uploads, setUploads] = useState([])
  const [lastResult, setLastResult] = useState(null)

  const refresh = useCallback(async () => {
    try {
      const [s, u] = await Promise.all([
        authedFetch('/api/stats').then(r => r.json()),
        authedFetch('/api/uploads').then(r => r.json()),
      ])
      setStats(s); setUploads(Array.isArray(u) ? u : [])
    } catch (e) { console.error(e) }
  }, [authedFetch])
  useEffect(() => { refresh() }, [refresh])

  async function handleUpload() {
    if (!file) { toast.error('اختر ملفاً أولاً'); return }
    setUploading(true); setLastResult(null)
    try {
      const fd = new FormData(); fd.append('file', file); if (warehouse) fd.append('warehouse', warehouse)
      const res = await authedFetch('/api/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) { toast.error(data?.error || 'فشل الرفع'); setLastResult(data) }
      else { toast.success(`تم استيراد ${data.rows_inserted} سجل بنجاح`); setLastResult(data); setFile(null); refresh() }
    } catch (e) { toast.error(e?.message || 'فشل الاتصال') } finally { setUploading(false) }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard icon={Database} label="إجمالي السجلات" value={formatNumber(stats?.total_records || 0)} accent="bg-primary/10 text-primary" />
        <StatCard icon={Pill} label="عدد الأدوية" value={formatNumber(stats?.unique_medicines || 0)} accent="bg-cyan-500/10 text-cyan-700" />
        <StatCard icon={FileSpreadsheet} label="الملفات المرفوعة" value={formatNumber(stats?.total_uploads || 0)} accent="bg-amber-500/10 text-amber-700" />
        <StatCard icon={Building2} label="الشركات" value={formatNumber(stats?.companies_count || 0)} accent="bg-indigo-500/10 text-indigo-700" />
        <StatCard icon={Package} label="المخازن" value={formatNumber(stats?.warehouses_count || 0)} accent="bg-emerald-500/10 text-emerald-700" />
      </div>
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Upload className="size-5 text-primary" /> رفع ملف Excel جديد</CardTitle><CardDescription>كل صف يُحفظ كسجل تاريخي جديد ولا يُستبدل أي سجل سابق.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="md:col-span-2 cursor-pointer">
              <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary hover:bg-primary/5 transition">
                <FileSpreadsheet className="size-10 text-primary mx-auto mb-2" />
                <p className="font-medium">{file?.name || 'اختر ملف .xlsx أو .xls أو .csv'}</p>
                <p className="text-xs text-muted-foreground mt-1">سيتم التعرف على الأعمدة تلقائياً (عربي / إنجليزي)</p>
              </div>
              <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
            </label>
            <div className="space-y-3">
              <Input placeholder="اسم المخزن (اختياري)" value={warehouse} onChange={e => setWarehouse(e.target.value)} />
              <Button onClick={handleUpload} disabled={uploading || !file} className="w-full h-11">
                {uploading ? <><Loader2 className="size-4 animate-spin ml-2" /> جاري الرفع...</> : <><Upload className="size-4 ml-2" /> ارفع وأضف للقاعدة</>}
              </Button>
            </div>
          </div>
          {lastResult?.ok && (<div className="rounded-lg border bg-emerald-50 border-emerald-200 p-3 text-sm">تم استيراد <span className="num font-bold">{lastResult.rows_inserted}</span> سجل من "{lastResult.filename}".</div>)}
          {lastResult && !lastResult.ok && (<div className="rounded-lg border bg-red-50 border-red-200 p-3 text-sm text-red-700">{lastResult.error}</div>)}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><History className="size-5 text-primary" /> آخر الملفات المرفوعة</CardTitle></CardHeader>
        <CardContent>
          {uploads.length === 0 ? (<p className="text-muted-foreground text-sm">لم يُرفع أي ملف بعد.</p>) : (
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted text-muted-foreground"><tr><th className="p-2 text-right">الملف</th><th className="p-2 text-right">المخزن</th><th className="p-2 text-right">عدد السجلات</th><th className="p-2 text-right">رفع بواسطة</th><th className="p-2 text-right">تاريخ الرفع</th></tr></thead>
                <tbody>{uploads.map(u => (<tr key={u.id} className="border-t hover:bg-muted/30"><td className="p-2 font-medium truncate max-w-xs">{u.filename}</td><td className="p-2">{u.warehouse_hint || '—'}</td><td className="p-2 num">{formatNumber(u.rows_count)}</td><td className="p-2 text-xs">{u.uploaded_by_email || '—'}</td><td className="p-2 num">{formatDate(u.created_at)}</td></tr>))}</tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function UsersTab({ authedFetch, currentUser }) {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ email: '', password: '', full_name: '', role: 'staff' })
  const [creating, setCreating] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const r = await authedFetch('/api/users'); const d = await r.json()
      setUsers(Array.isArray(d) ? d : [])
    } finally { setLoading(false) }
  }, [authedFetch])
  useEffect(() => { refresh() }, [refresh])

  async function create() {
    if (!form.email || !form.password) { toast.error('البريد وكلمة المرور مطلوبان'); return }
    setCreating(true)
    try {
      const r = await authedFetch('/api/users', { method: 'POST', body: JSON.stringify(form) })
      const d = await r.json()
      if (!r.ok) toast.error(d?.error || 'فشل الإنشاء')
      else { toast.success('تم إنشاء المستخدم'); setOpen(false); setForm({ email: '', password: '', full_name: '', role: 'staff' }); refresh() }
    } finally { setCreating(false) }
  }

  async function remove(id) {
    if (!confirm('حذف هذا المستخدم؟')) return
    const r = await authedFetch(`/api/users/${id}`, { method: 'DELETE' }); const d = await r.json()
    if (!r.ok) toast.error(d?.error); else { toast.success('تم الحذف'); refresh() }
  }
  async function changeRole(id, role) {
    const r = await authedFetch(`/api/users/${id}`, { method: 'PATCH', body: JSON.stringify({ role }) })
    const d = await r.json(); if (!r.ok) toast.error(d?.error); else { toast.success('تم التحديث'); refresh() }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h2 className="text-xl font-bold flex items-center gap-2"><UsersIcon className="size-5 text-primary" /> إدارة المستخدمين</h2><p className="text-sm text-muted-foreground">أضف موظفي الصيدلية الذين سيستخدمون النظام للبحث فقط.</p></div>
        <Button onClick={() => setOpen(true)} className="gap-2"><UserPlus className="size-4" /> إضافة مستخدم</Button>
      </div>
      <Card><CardContent className="p-0 overflow-hidden">
        {loading ? <div className="p-6 text-center text-muted-foreground"><Loader2 className="size-5 animate-spin inline-block ml-2" /> جاري التحميل...</div> : (
          <table className="w-full text-sm">
            <thead className="bg-muted text-muted-foreground"><tr><th className="p-3 text-right">الاسم</th><th className="p-3 text-right">البريد</th><th className="p-3 text-right">الدور</th><th className="p-3 text-right">تاريخ الإنشاء</th><th className="p-3"></th></tr></thead>
            <tbody>{users.map(u => (
              <tr key={u.id} className="border-t hover:bg-muted/30">
                <td className="p-3 font-medium">{u.full_name || '—'} {u.id === currentUser?.id && <Badge variant="secondary" className="mr-2">أنت</Badge>}</td>
                <td className="p-3">{u.email}</td>
                <td className="p-3">
                  <Select value={u.role} onValueChange={(v) => changeRole(u.id, v)} disabled={u.id === currentUser?.id}>
                    <SelectTrigger className="w-32 h-8"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="admin">رئيس</SelectItem><SelectItem value="staff">موظف</SelectItem></SelectContent>
                  </Select>
                </td>
                <td className="p-3 num text-muted-foreground">{formatDate(u.created_at)}</td>
                <td className="p-3 text-left">{u.id !== currentUser?.id && (<Button size="sm" variant="ghost" onClick={() => remove(u.id)}><Trash2 className="size-4 text-destructive" /></Button>)}</td>
              </tr>
            ))}{users.length === 0 && (<tr><td colSpan="5" className="p-6 text-center text-muted-foreground">لا يوجد مستخدمون.</td></tr>)}</tbody>
          </table>
        )}
      </CardContent></Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="flex items-center gap-2"><UserPlus className="size-5 text-primary" /> إضافة مستخدم جديد</DialogTitle><DialogDescription>سيتم إنشاء الحساب فوراً بدون الحاجة لتأكيد البريد.</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="الاسم الكامل" value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} />
            <Input placeholder="البريد الإلكتروني" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
            <Input placeholder="كلمة المرور (8 أحرف أو أكثر)" type="text" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
            <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="staff">موظف (بحث فقط)</SelectItem><SelectItem value="admin">رئيس (بحث + رفع + إدارة)</SelectItem></SelectContent>
            </Select>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button><Button onClick={create} disabled={creating}>{creating ? <Loader2 className="size-4 animate-spin" /> : 'إنشاء'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function LoginScreen({ onLoggedIn }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  async function submit(e) {
    e?.preventDefault()
    setLoading(true)
    try {
      const sb = getBrowserSupabase()
      const { data, error } = await sb.auth.signInWithPassword({ email, password })
      if (error) toast.error(error.message || 'فشل تسجيل الدخول')
      else onLoggedIn(data.session)
    } finally { setLoading(false) }
  }
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-white to-cyan-50 p-4">
      <Card className="w-full max-w-md shadow-xl border-0">
        <CardHeader className="text-center space-y-3 pb-4">
          <div className="size-16 rounded-2xl bg-gradient-to-br from-primary to-cyan-600 text-white flex items-center justify-center shadow-lg mx-auto"><Pill className="size-8" /></div>
          <div><CardTitle className="text-2xl">نظام بحث الأدوية</CardTitle><CardDescription>الصيدلية — نظام داخلي خاص</CardDescription></div>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-1"><label className="text-sm font-medium">البريد الإلكتروني</label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="h-11" placeholder="name@pharmacy.com" /></div>
            <div className="space-y-1"><label className="text-sm font-medium">كلمة المرور</label><Input type="password" value={password} onChange={e => setPassword(e.target.value)} required className="h-11" placeholder="••••••••" /></div>
            <Button type="submit" className="w-full h-11 mt-2" disabled={loading}>{loading ? <Loader2 className="size-4 animate-spin" /> : 'دخول'}</Button>
          </form>
          <p className="text-xs text-muted-foreground text-center mt-4">للموظفين حصراً — تواصل مع الرئيس للحصول على حساب</p>
        </CardContent>
      </Card>
    </div>
  )
}

function App() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [bootLoading, setBootLoading] = useState(true)
  const [tab, setTab] = useState('search')

  useEffect(() => {
    const sb = getBrowserSupabase()
    sb.auth.getSession().then(({ data }) => { setSession(data.session); setBootLoading(false) })
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => { setSession(s); if (!s) setProfile(null) })
    return () => sub.subscription.unsubscribe()
  }, [])

  const authedFetch = useAuthedFetch(session)

  useEffect(() => {
    if (!session) { setProfile(null); return }
    authedFetch('/api/me').then(r => r.json()).then(p => { if (p?.id) setProfile(p) }).catch(() => {})
  }, [session, authedFetch])

  async function logout() {
    await getBrowserSupabase().auth.signOut()
    setSession(null); setProfile(null); setTab('search')
  }

  if (bootLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="size-8 animate-spin text-primary" /></div>
  if (!session) return <LoginScreen onLoggedIn={setSession} />
  if (!profile) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="size-8 animate-spin text-primary" /></div>

  const isAdmin = profile?.role === 'admin'

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <header className="border-b bg-white/80 backdrop-blur sticky top-0 z-20">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-gradient-to-br from-primary to-cyan-600 text-white flex items-center justify-center shadow-md"><Pill className="size-5" /></div>
            <div><h1 className="font-bold text-lg leading-tight">نظام بحث الأدوية</h1><p className="text-xs text-muted-foreground">الصيدلية — نظام داخلي</p></div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 text-sm bg-muted px-3 py-1.5 rounded-full">
              <User className="size-4 text-primary" />
              <span className="font-medium">{profile?.full_name || profile?.email || '...'}</span>
              <Badge variant={isAdmin ? 'default' : 'secondary'} className="text-[10px]">{isAdmin ? 'رئيس' : 'موظف'}</Badge>
            </div>
            <Button variant="outline" size="sm" onClick={logout} className="gap-2"><LogOut className="size-4" /> خروج</Button>
          </div>
        </div>
      </header>
      <main className="container mx-auto px-4 py-6">
        <Tabs value={tab} onValueChange={setTab} className="space-y-6">
          <TabsList className={`grid ${isAdmin ? 'grid-cols-3 max-w-2xl' : 'grid-cols-1 max-w-xs'}`}>
            <TabsTrigger value="search" className="gap-2"><Search className="size-4" /> بحث</TabsTrigger>
            {isAdmin && <TabsTrigger value="admin" className="gap-2"><ShieldCheck className="size-4" /> رفع وإدارة</TabsTrigger>}
            {isAdmin && <TabsTrigger value="users" className="gap-2"><UsersIcon className="size-4" /> المستخدمون</TabsTrigger>}
          </TabsList>
          <TabsContent value="search"><SearchTab authedFetch={authedFetch} /></TabsContent>
          {isAdmin && <TabsContent value="admin"><AdminTab authedFetch={authedFetch} /></TabsContent>}
          {isAdmin && <TabsContent value="users"><UsersTab authedFetch={authedFetch} currentUser={profile} /></TabsContent>}
        </Tabs>
      </main>
      <footer className="border-t mt-12 py-4 text-center text-xs text-muted-foreground">نظام بحث الأدوية — Supabase + Next.js</footer>
    </div>
  )
}

export default App
