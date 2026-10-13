import './style.css'
import { STR, fmt, type Lang, type Key } from './i18n'
import { readFile, splitChapters, type Doc } from './parse'
import { summarize, type Mode, type OutLang } from './summarize'
import { loadModel, hasWebGPU, isMock, GEMINI_KEY, type Engine } from './llm'

let lang: Lang = (localStorage.getItem('u74-lang') as Lang) || (navigator.language.startsWith('ja') ? 'ja' : 'en')
let mode: Mode = 'short'
let outLang: OutLang = lang
let engine: Engine = (localStorage.getItem('u74-engine') as Engine) || 'small'
let doc: Doc | null = null
let busy = false
let stopped = false
let result = ''
const t = (k: Key) => STR[lang][k]
const $ = <T extends HTMLElement>(s: string) => document.querySelector(s) as T

let pastedText = ''
function render() {
  const ta = document.querySelector<HTMLTextAreaElement>('#text'); if (ta) pastedText = ta.value
  document.documentElement.lang = lang
  document.title = `${STR.ja.title} / ${STR.en.title}`
  $('#app').innerHTML = `<main>
  <div class="top"><a href="https://gutsmcd-cmd.github.io/universe-74/">${t('portal')}</a>
    <span><button class="chip" data-l="en" aria-pressed="${lang === 'en'}">EN</button> <button class="chip" data-l="ja" aria-pressed="${lang === 'ja'}">日本語</button></span></div>
  <h1>${t('title')}</h1><p class="sub">${t('sub')}</p>
  <section class="card">
    <label class="file" id="drop"><input type="file" id="file" accept=".pdf,.epub,.txt,.md,text/plain,application/pdf,application/epub+zip">📂 ${t('drop')}</label>
    <p class="status" id="fileInfo"></p>
    <p class="note">${t('or')}</p>
    <textarea id="text" placeholder="${t('paste')}"></textarea>
  </section>
  <section class="card">
    <div class="row"><span>${t('mode')}</span>${(['short', 'detailed', 'chapters', 'kids'] as Mode[]).map(m => `<button class="chip" data-m="${m}" aria-pressed="${m === mode}">${t(m)}</button>`).join('')}</div>
    <div class="row"><span>${t('outLang')}</span><button class="chip" data-o="ja" aria-pressed="${outLang === 'ja'}">日本語</button><button class="chip" data-o="en" aria-pressed="${outLang === 'en'}">English</button></div>
    <div class="row"><span>${t('engine')}</span><select id="engine">${(['small', 'better', 'gemini'] as Engine[]).map(e => `<option value="${e}" ${e === engine ? 'selected' : ''}>${t(e)}</option>`).join('')}</select></div>
    <div class="row"><button class="go" id="go">${t('go')}</button><button class="ghost" id="stop" hidden>${t('stop')}</button></div>
    <progress id="bar" value="0" max="1" hidden></progress>
    <p class="status" id="status"></p>
  </section>
  <section class="card" id="outCard" hidden>
    <div class="out" id="out"></div>
    <div class="row"><button class="ghost" id="copy">${t('copy')}</button><button class="ghost" id="save">${t('save')}</button><a class="ghost" id="songs" href="https://gutsmcd-cmd.github.io/u74-songs/#from-summary">${t('toSongs')}</a></div>
  </section>
  <p class="note">${t('honest')}</p>
  <details class="card"><summary>${t('keyH')}</summary><p class="note">${t('keyP')}</p>
    <div class="row"><input type="password" id="key" placeholder="AIza…" autocomplete="off" value="${localStorage.getItem(GEMINI_KEY) ? '••••••••' : ''}"><button class="ghost" id="keySave">${t('keySave')}</button><button class="ghost" id="keyClear">${t('keyClear')}</button></div>
    <p class="status" id="keyMsg"></p></details>
  </main>`
  $<HTMLTextAreaElement>('#text').value = pastedText
  wire()
  if (doc) showDoc()
  if (result) showOut(result)
}

function showDoc() {
  if (!doc) return
  const c = doc.chapters.reduce((a, x) => a + x.text.length, 0)
  $('#fileInfo').textContent = fmt(t('file'), { t: doc.title, n: doc.chapters.length, c: c.toLocaleString() })
}
function showOut(s: string) { $('#outCard').hidden = false; $('#out').textContent = s }
function status(s: string, err = false) { const el = $('#status'); el.textContent = s; el.className = 'status' + (err ? ' err' : '') }

function wire() {
  document.querySelectorAll<HTMLButtonElement>('[data-l]').forEach(b => b.onclick = () => { lang = b.dataset.l as Lang; outLang = lang; localStorage.setItem('u74-lang', lang); render() })
  document.querySelectorAll<HTMLButtonElement>('[data-m]').forEach(b => b.onclick = () => { mode = b.dataset.m as Mode; render() })
  document.querySelectorAll<HTMLButtonElement>('[data-o]').forEach(b => b.onclick = () => { outLang = b.dataset.o as OutLang; render() })
  $<HTMLSelectElement>('#engine').onchange = e => { engine = (e.target as HTMLSelectElement).value as Engine; localStorage.setItem('u74-engine', engine) }
  const fileIn = $<HTMLInputElement>('#file')
  fileIn.onchange = () => fileIn.files?.[0] && open(fileIn.files[0])
  const drop = $('#drop')
  drop.ondragover = e => { e.preventDefault(); drop.classList.add('over') }
  drop.ondragleave = () => drop.classList.remove('over')
  drop.ondrop = e => { e.preventDefault(); drop.classList.remove('over'); const f = e.dataTransfer?.files[0]; if (f) open(f) }
  $<HTMLTextAreaElement>('#text').oninput = () => { doc = null; $('#fileInfo').textContent = '' }
  $('#go').onclick = run
  $('#stop').onclick = () => { stopped = true }
  $('#copy').onclick = async () => { await navigator.clipboard.writeText(result); $('#copy').textContent = t('copied') }
  $('#save').onclick = () => {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([result], { type: 'text/plain' }))
    a.download = `${doc?.title ?? 'summary'}-${mode}.txt`; a.click()
  }
  $('#songs').onclick = () => localStorage.setItem('u74-handoff', JSON.stringify({ title: doc?.title ?? '', text: result, lang: outLang, at: Date.now() }))
  $('#keySave').onclick = () => { const v = $<HTMLInputElement>('#key').value.trim(); if (v && !v.startsWith('•')) { localStorage.setItem(GEMINI_KEY, v); $('#keyMsg').textContent = t('keySaved') } }
  $('#keyClear').onclick = () => { localStorage.removeItem(GEMINI_KEY); $<HTMLInputElement>('#key').value = ''; $('#keyMsg').textContent = '' }
}

async function open(f: File) {
  try {
    status('…')
    doc = await readFile(f)
    $<HTMLTextAreaElement>('#text').value = ''
    showDoc(); status('')
  } catch (e) { doc = null; status(String((e as Error).message), true) }
}

async function run() {
  if (busy) return
  const pasted = $<HTMLTextAreaElement>('#text').value.trim()
  const d: Doc | null = doc ?? (pasted ? { title: 'text', chapters: splitChapters(pasted) } : null)
  if (!d) { status(t('needText'), true); document.body.dataset.state = 'error'; return }
  let eng = engine
  if (eng === 'gemini' && !localStorage.getItem(GEMINI_KEY) && !isMock) { status(t('needKey'), true); return }
  if (eng === 'better' && !isMock && !(await hasWebGPU())) { status(t('needGpu')); eng = 'small' }
  busy = true; stopped = false
  const go = $<HTMLButtonElement>('#go'), stop = $('#stop'), bar = $<HTMLProgressElement>('#bar')
  go.disabled = true; stop.hidden = false; bar.hidden = false; bar.value = 0
  const t0 = performance.now()
  try {
    status(t('loading'))
    const info = await loadModel(eng, (f, l, tot) => { bar.value = f; status(`${t('loading')} ${Math.round(l)} / ${Math.round(tot)} MB`) })
    const devNote = info.device === 'webgpu' ? t('gpu') : info.device === 'wasm' ? t('cpu') : ''
    const t1 = performance.now()
    result = ''
    $('#outCard').hidden = false; $('#out').textContent = ''
    result = await summarize(d, mode, outLang, eng, p => {
      bar.value = p.done / p.total
      const per = p.done ? (performance.now() - t1) / p.done : 0
      const left = per ? Math.max(1, Math.round(per * (p.total - p.done) / 60000)) : 0
      status(`${t('working')}: ${p.label} · ${fmt(t('step'), { i: p.done + 1, n: p.total })}${left ? ' · ' + fmt(t('eta'), { m: left }) : ''} ${devNote}`)
    }, s => showOut(s), () => stopped)
    showOut(result); bar.value = 1
    status(fmt(t('done'), { s: Math.round((performance.now() - t0) / 1000) }) + ' ' + devNote)
    document.body.dataset.state = 'done'
  } catch (e) {
    const m = String((e as Error).message)
    status(m === 'stopped' ? t('stopped') : m, m !== 'stopped')
    document.body.dataset.state = 'error'
  } finally {
    busy = false; go.disabled = false; stop.hidden = true
  }
}

render()
