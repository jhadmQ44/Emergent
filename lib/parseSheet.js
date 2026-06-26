import * as XLSX from 'xlsx'

// Map of possible header names (Arabic & English) → canonical field
const FIELD_MAP = {
  // id from source file
  'id': 'source_id',
  'ID': 'source_id',
  'رقم': 'source_id',
  // file number
  'رقم الملف': 'file_number',
  'file number': 'file_number',
  'file_number': 'file_number',
  // warehouse
  'المخذخر': 'warehouse',
  'المخزن': 'warehouse',
  'المستودع': 'warehouse',
  'warehouse': 'warehouse',
  'الموزع': 'warehouse',
  // date
  'التاريخ': 'invoice_date',
  'تاريخ الفاتورة': 'invoice_date',
  'invoice date': 'invoice_date',
  'date': 'invoice_date',
  // invoice number
  'id_القائمة': 'invoice_number',
  'ID_القائمة': 'invoice_number',
  'رقم القائمة': 'invoice_number',
  'رقم الفاتورة': 'invoice_number',
  'invoice number': 'invoice_number',
  'invoice_number': 'invoice_number',
  // name
  'اسم الدواء': 'name',
  'الدواء': 'name',
  'الصنف': 'name',
  'name': 'name',
  'medicine': 'name',
  'medicine name': 'name',
  // scientific
  'الاسم العلمي': 'scientific_name',
  'scientific name': 'scientific_name',
  'scientific_name': 'scientific_name',
  // company
  'الشركة': 'company',
  'الشركة المصنعة': 'company',
  'company': 'company',
  'manufacturer': 'company',
  // quantity
  'الكمية': 'quantity',
  'quantity': 'quantity',
  'qty': 'quantity',
  // gift
  'هدية': 'gift',
  'gift': 'gift',
  // rep gift
  'هدية مندوب': 'rep_gift',
  'rep gift': 'rep_gift',
  // expiry
  'انتهاء الصلاحية': 'expiry_raw',
  'تاريخ الانتهاء': 'expiry_raw',
  'expiry': 'expiry_raw',
  'expiry date': 'expiry_raw',
  'exp': 'expiry_raw',
  // unit price
  'سعر الوحدة': 'unit_price',
  'unit price': 'unit_price',
  'unit_price': 'unit_price',
  'price': 'unit_price',
  // total price
  'السعر الكلي': 'total_price',
  'total price': 'total_price',
  'total_price': 'total_price',
  'total': 'total_price',
  // original price
  'السعر الاصلي': 'original_price',
  'السعر الأصلي': 'original_price',
  'original price': 'original_price',
  // selling price
  'سعر البيع': 'selling_price',
  'selling price': 'selling_price',
  // batch
  'رقم الدفعة': 'batch_number',
  'الباتش': 'batch_number',
  'batch': 'batch_number',
  'batch number': 'batch_number',
  'lot': 'batch_number',
  // barcode
  'الباركود': 'barcode',
  'barcode': 'barcode',
  // notes
  'ملاحظات': 'notes',
  'notes': 'notes',
  'note': 'notes',
}

function normaliseHeader(h) {
  if (h === null || h === undefined) return ''
  return String(h).trim().toLowerCase()
}

function mapHeaders(headers) {
  const lowered = {}
  Object.keys(FIELD_MAP).forEach(k => { lowered[k.toLowerCase()] = FIELD_MAP[k] })
  return headers.map(h => {
    const key = normaliseHeader(h)
    return lowered[key] || null
  })
}

function parseNumber(v) {
  if (v === null || v === undefined || v === '') return null
  if (typeof v === 'number') return v
  const s = String(v).replace(/[$,\s]/g, '').replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
  const n = parseFloat(s)
  return isNaN(n) ? null : n
}

function parseDate(v) {
  if (v === null || v === undefined || v === '') return null
  // Excel serial date
  if (typeof v === 'number' && v > 1000 && v < 60000) {
    const d = XLSX.SSF.parse_date_code(v)
    if (d) {
      const dt = new Date(Date.UTC(d.y, d.m - 1, d.d))
      return dt.toISOString().slice(0, 10)
    }
  }
  const s = String(v).trim()
  // Try common formats: m/d/yyyy, d/m/yyyy, yyyy-mm-dd
  let m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/)
  if (m) {
    let [_, a, b, y] = m
    a = parseInt(a); b = parseInt(b); y = parseInt(y)
    if (y < 100) y += 2000
    // Heuristic: if a>12 → a is day; else assume m/d/yyyy (US — matches sample)
    let mo, da
    if (a > 12) { da = a; mo = b } else { mo = a; da = b }
    if (mo < 1 || mo > 12 || da < 1 || da > 31) return null
    return `${y.toString().padStart(4,'0')}-${mo.toString().padStart(2,'0')}-${da.toString().padStart(2,'0')}`
  }
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (m) {
    const [_, y, mo, d] = m
    const moN = parseInt(mo), dN = parseInt(d)
    if (moN < 1 || moN > 12 || dN < 1 || dN > 31) return null
    return `${y}-${mo.padStart(2,'0')}-${d.padStart(2,'0')}`
  }
  return null
}

function findHeaderRow(rows) {
  // Find the row that has more than 3 string cells containing known header keywords
  const keys = Object.keys(FIELD_MAP).map(k => k.toLowerCase())
  let bestIdx = 0
  let bestScore = 0
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const r = rows[i] || []
    let score = 0
    for (const cell of r) {
      const c = normaliseHeader(cell)
      if (c && keys.includes(c)) score++
    }
    if (score > bestScore) { bestScore = score; bestIdx = i }
  }
  return bestScore >= 3 ? bestIdx : 0
}

export function parseSheetBuffer(buffer, filename) {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: false })
  const sheetName = wb.SheetNames[0]
  const sheet = wb.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' })
  if (!rows || rows.length === 0) return { headers: [], records: [] }

  const headerIdx = findHeaderRow(rows)
  const headers = rows[headerIdx]
  const mapped = mapHeaders(headers)
  const records = []
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i] || []
    // Skip empty rows
    const nonEmpty = r.some(c => c !== '' && c !== null && c !== undefined)
    if (!nonEmpty) continue
    const rec = {}
    for (let c = 0; c < mapped.length; c++) {
      const field = mapped[c]
      if (!field) continue
      let val = r[c]
      if (val === '' || val === null || val === undefined) continue
      if (['quantity','gift','rep_gift','unit_price','total_price','original_price','selling_price'].includes(field)) {
        val = parseNumber(val)
      } else if (field === 'invoice_date') {
        val = parseDate(val)
      } else if (field === 'expiry_raw') {
        // Keep raw, also try to parse to expiry_date
        const parsed = parseDate(val)
        rec.expiry_raw = String(val)
        if (parsed) rec.expiry_date = parsed
        continue
      } else {
        val = String(val).trim()
      }
      if (val !== null && val !== '') rec[field] = val
    }
    // Require at least a name
    if (rec.name && String(rec.name).trim()) {
      records.push(rec)
    }
  }
  return { headers, mapped, records }
}
