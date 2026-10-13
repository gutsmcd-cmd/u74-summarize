import JSZip from 'jszip'

export interface Doc { title: string; chapters: { title: string; text: string }[] }

export async function readFile(file: File): Promise<Doc> {
  const name = file.name.toLowerCase()
  const base = file.name.replace(/\.[^.]+$/, '')
  if (name.endsWith('.pdf')) return { title: base, chapters: splitChapters(await readPdf(file)) }
  if (name.endsWith('.epub')) return readEpub(file, base)
  return { title: base, chapters: splitChapters(await file.text()) }
}

async function readPdf(file: File): Promise<string> {
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()
  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise
  const pages: string[] = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const tc = await page.getTextContent()
    let line = ''
    let out = ''
    for (const it of tc.items as { str: string; hasEOL?: boolean }[]) {
      line += it.str
      if (it.hasEOL) { out += line + '\n'; line = '' }
    }
    pages.push(out + line)
  }
  return pages.join('\n\n')
}

async function readEpub(file: File, fallbackTitle: string): Promise<Doc> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer())
  const container = await zip.file('META-INF/container.xml')?.async('string')
  if (!container) throw new Error('Not a valid EPUB')
  const dp = new DOMParser()
  const opfPath = dp.parseFromString(container, 'application/xml').querySelector('rootfile')?.getAttribute('full-path') ?? ''
  const opf = dp.parseFromString((await zip.file(opfPath)?.async('string')) ?? '', 'application/xml')
  const dir = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/') + 1) : ''
  const title = opf.getElementsByTagName('dc:title')[0]?.textContent?.trim() || fallbackTitle
  const items = new Map<string, string>()
  opf.querySelectorAll('manifest > item').forEach(i => items.set(i.getAttribute('id') ?? '', i.getAttribute('href') ?? ''))
  const chapters: Doc['chapters'] = []
  for (const ref of Array.from(opf.querySelectorAll('spine > itemref'))) {
    const href = items.get(ref.getAttribute('idref') ?? '')
    if (!href) continue
    const html = await zip.file(decodeURIComponent(dir + href))?.async('string')
    if (!html) continue
    const doc = dp.parseFromString(html, 'text/html')
    const text = (doc.body?.innerText || doc.body?.textContent || '').replace(/\n{3,}/g, '\n\n').trim()
    if (text.length < 200) continue // skip covers, title pages, empty spacers
    const h = doc.querySelector('h1,h2,h3,title')?.textContent?.trim()
    chapters.push({ title: h || `Part ${chapters.length + 1}`, text })
  }
  if (!chapters.length) throw new Error('No readable text found in this EPUB')
  return { title, chapters }
}

const HEAD = /^\s*((chapter|part|book)\s+([0-9]+|[ivxlc]+|one|two|three|four|five|six|seven|eight|nine|ten)\b.*|第[0-9０-９一二三四五六七八九十百]+[章部話節].*)$/i

export function splitChapters(text: string): Doc['chapters'] {
  text = text.replace(/\r/g, '').trim()
  const lines = text.split('\n')
  const out: Doc['chapters'] = []
  let cur = { title: '', text: '' }
  for (const l of lines) {
    if (HEAD.test(l) && l.trim().length < 80) {
      if (cur.text.trim().length > 0) out.push(cur)
      cur = { title: l.trim(), text: '' }
    } else cur.text += l + '\n'
  }
  if (cur.text.trim()) out.push(cur)
  const real = out.filter(c => c.text.trim().length > 300)
  if (real.length >= 2) return real.map(c => ({ title: c.title || 'Opening', text: c.text.trim() }))
  // No headings: fall back to evenly sized parts so "chapter by chapter" still works.
  const size = Math.max(6000, Math.ceil(text.length / 12))
  return chunk(text, size).map((t, i) => ({ title: `Part ${i + 1}`, text: t }))
}

// Split on paragraph / sentence boundaries into ~size-char pieces.
export function chunk(text: string, size: number): string[] {
  const parts: string[] = []
  let rest = text.trim()
  while (rest.length > size) {
    let cut = rest.lastIndexOf('\n\n', size)
    if (cut < size * 0.5) cut = Math.max(rest.lastIndexOf('. ', size), rest.lastIndexOf('。', size))
    if (cut < size * 0.5) cut = size
    parts.push(rest.slice(0, cut + 1).trim())
    rest = rest.slice(cut + 1).trim()
  }
  if (rest) parts.push(rest)
  return parts
}
