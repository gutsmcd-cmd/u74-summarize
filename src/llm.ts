// Shared "brain" for Universe 74 apps: a small instruct model running in the browser
// (transformers.js, WebGPU with WASM fallback), downloaded once and cached.
// Optional: a user's own free Gemini key, off by default.

export type Msg = { role: 'system' | 'user' | 'assistant'; content: string }
export type Engine = 'small' | 'better' | 'gemini'

export const MODELS = {
  small: { id: 'onnx-community/Qwen2.5-0.5B-Instruct', gpuDtype: 'q4f16', cpuDtype: 'q8', gpuMB: 483, cpuMB: 512 },
  better: { id: 'onnx-community/Qwen2.5-1.5B-Instruct', gpuDtype: 'q4f16', cpuDtype: 'q4f16', gpuMB: 1222, cpuMB: 1222 },
} as const

export const isMock = new URLSearchParams(location.search).has('mock')

export async function hasWebGPU(): Promise<boolean> {
  try {
    const gpu = (navigator as unknown as { gpu?: { requestAdapter(): Promise<unknown> } }).gpu
    return !!gpu && !!(await gpu.requestAdapter())
  } catch { return false }
}

let worker: Worker | null = null
let seq = 0
const waits = new Map<number, { onToken?: (t: string) => void; resolve: (s: string) => void; reject: (e: Error) => void }>()
let loadP: Promise<void> | null = null
let loadKey = ''

function getWorker(): Worker {
  if (worker) return worker
  worker = new Worker(new URL('./llm.worker.ts', import.meta.url), { type: 'module' })
  worker.onmessage = (e) => {
    const d = e.data
    const w = d.id != null ? waits.get(d.id) : undefined
    if (d.type === 'token') w?.onToken?.(d.text)
    else if (d.type === 'done') { w?.resolve(d.text); waits.delete(d.id) }
    else if (d.type === 'error' && w) { w.reject(new Error(d.message)); waits.delete(d.id) }
  }
  return worker
}

export interface LoadInfo { device: 'webgpu' | 'wasm' | 'mock' | 'cloud'; sizeMB: number }

export async function loadModel(engine: Engine, onProgress: (frac: number, loadedMB: number, totalMB: number) => void): Promise<LoadInfo> {
  if (isMock) { onProgress(1, 1, 1); return { device: 'mock', sizeMB: 0 } }
  if (engine === 'gemini') return { device: 'cloud', sizeMB: 0 }
  const gpu = await hasWebGPU()
  const spec = MODELS[engine]
  const device = gpu ? 'webgpu' : 'wasm'
  const dtype = gpu ? spec.gpuDtype : spec.cpuDtype
  const key = `${spec.id}|${device}|${dtype}`
  if (loadP && loadKey === key) { await loadP; return { device, sizeMB: gpu ? spec.gpuMB : spec.cpuMB } }
  loadKey = key
  const w = getWorker()
  loadP = new Promise<void>((resolve, reject) => {
    const h = (e: MessageEvent) => {
      const d = e.data
      if (d.type === 'progress' && d.total) onProgress(d.loaded / d.total, d.loaded / 1e6, d.total / 1e6)
      else if (d.type === 'ready') { w.removeEventListener('message', h); resolve() }
      else if (d.type === 'error' && d.id == null) { w.removeEventListener('message', h); loadP = null; reject(new Error(d.message)) }
    }
    w.addEventListener('message', h)
    w.postMessage({ type: 'load', model: spec.id, device, dtype })
  })
  await loadP
  return { device, sizeMB: gpu ? spec.gpuMB : spec.cpuMB }
}

export const GEMINI_KEY = 'u74-gemini-key'

async function gemini(messages: Msg[], maxNewTokens: number): Promise<string> {
  const key = localStorage.getItem(GEMINI_KEY) || ''
  if (!key) throw new Error('No Gemini key saved')
  const sys = messages.filter(m => m.role === 'system').map(m => m.content).join('\n')
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: sys ? { parts: [{ text: sys }] } : undefined,
      contents: messages.filter(m => m.role !== 'system').map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
      generationConfig: { maxOutputTokens: Math.max(maxNewTokens * 4, 2048), temperature: 0.4 },
    }),
  })
  if (!res.ok) throw new Error(`Gemini: ${res.status} ${(await res.text()).slice(0, 200)}`)
  const j = await res.json()
  return (j.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? '').join('')
}

// Deterministic fake for automated tests (?mock).
function mock(messages: Msg[]): string {
  const u = messages[messages.length - 1].content
  if ((window as unknown as { __mockReply?: (u: string) => string }).__mockReply) return (window as unknown as { __mockReply: (u: string) => string }).__mockReply(u)
  const words = u.replace(/\s+/g, ' ').split(' ').filter(w => w.length > 3).slice(-12)
  return `MOCK: ${words.join(' ')}`
}

export async function generate(engine: Engine, messages: Msg[], maxNewTokens: number, onToken?: (t: string) => void): Promise<string> {
  if (isMock) { const s = mock(messages); onToken?.(s); await new Promise(r => setTimeout(r, 30)); return s }
  if (engine === 'gemini') { const s = await gemini(messages, maxNewTokens); onToken?.(s); return s }
  const id = ++seq
  return new Promise((resolve, reject) => {
    waits.set(id, { onToken, resolve, reject })
    getWorker().postMessage({ type: 'generate', id, messages, maxNewTokens })
  })
}
