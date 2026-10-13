import { generate, type Engine, type Msg } from './llm'
import { chunk, type Doc } from './parse'

export type Mode = 'short' | 'detailed' | 'chapters' | 'kids'
export type OutLang = 'en' | 'ja'

const SYS: Record<OutLang, string> = {
  en: 'You are a careful summarizer. Only use facts from the given text. Write in clear, natural English.',
  ja: 'あなたは丁寧な要約者です。与えられた文章の内容だけを使ってください。自然でわかりやすい日本語で書いてください。',
}
const NOTE: Record<OutLang, string> = {
  en: 'Summarize this passage as 3 to 6 short bullet points covering the key ideas, events and names.',
  ja: 'この文章の要点（主な考え・出来事・人名）を、3〜6個の短い箇条書きでまとめてください。',
}
const FINAL: Record<OutLang, Record<Exclude<Mode, 'chapters'>, string>> = {
  en: {
    short: 'Write a short summary of the whole text in 3 to 5 sentences.',
    detailed: 'Write a detailed summary of the whole text: a one-sentence overview, then the main points under short headings with bullet points, then the key takeaway.',
    kids: 'Explain what this text is about for an 8-year-old child. Use simple words, short sentences and a friendly tone. 5 to 8 sentences.',
  },
  ja: {
    short: '文章全体を3〜5文で短く要約してください。',
    detailed: '文章全体をくわしく要約してください。まず一文で全体像、次に短い見出しと箇条書きで主なポイント、最後に一番大事なことを書いてください。',
    kids: '小学2年生くらいの子どもにもわかるように、この文章が何について書かれているかを説明してください。やさしい言葉と短い文で、親しみやすく。5〜8文で。',
  },
}
const CHAPTER: Record<OutLang, string> = {
  en: 'Summarize this chapter in 2 to 4 sentences.',
  ja: 'この章を2〜4文で要約してください。',
}

export interface Progress { done: number; total: number; label: string }

function ask(lang: OutLang, instr: string, text: string): Msg[] {
  return [
    { role: 'system', content: SYS[lang] },
    { role: 'user', content: `${instr}\n\n---\n${text}\n---\n\n${instr}` },
  ]
}

export async function summarize(
  doc: Doc, mode: Mode, lang: OutLang, engine: Engine,
  onProgress: (p: Progress) => void, onStream: (s: string) => void, isStopped: () => boolean,
): Promise<string> {
  const size = engine === 'gemini' ? 200000 : engine === 'better' ? 3500 : 2400
  const maxNew = engine === 'gemini' ? 4000 : 400
  const plan = doc.chapters.map(c => ({ title: c.title, pieces: chunk(c.text, size) }))
  const totalPieces = plan.reduce((a, c) => a + c.pieces.length, 0)
  const single = totalPieces === 1
  const total = single ? 1 : totalPieces + plan.filter(c => c.pieces.length > 1).length + (mode === 'chapters' ? 0 : 1)
  let done = 0
  const tick = (label: string) => onProgress({ done, total, label })
  const run = async (msgs: Msg[], max = maxNew, stream = false) => {
    if (isStopped()) throw new Error('stopped')
    let acc = ''
    const out = await generate(engine, msgs, max, stream ? (t) => { acc += t; onStream(acc) } : undefined)
    done++
    return out.trim()
  }

  if (single) {
    const text = plan[0].pieces[0]
    tick(plan[0].title)
    const instr = mode === 'chapters' ? CHAPTER[lang] : FINAL[lang][mode]
    return run(ask(lang, instr, text), maxNew + 200, true)
  }

  // Map: notes per piece; reduce per chapter.
  const chapterSums: { title: string; sum: string }[] = []
  for (const c of plan) {
    const notes: string[] = []
    for (const p of c.pieces) {
      tick(c.title)
      notes.push(await run(ask(lang, NOTE[lang], p)))
    }
    let sum = notes.join('\n')
    if (c.pieces.length > 1) {
      tick(c.title)
      sum = await run(ask(lang, CHAPTER[lang], sum))
    } else if (mode === 'chapters') {
      sum = notes[0]
    }
    chapterSums.push({ title: c.title, sum })
    if (mode === 'chapters') onStream(chapterSums.map(s => `## ${s.title}\n${s.sum}`).join('\n\n'))
  }
  if (mode === 'chapters') return chapterSums.map(s => `## ${s.title}\n${s.sum}`).join('\n\n')

  // Reduce: shrink chapter summaries until they fit, then the final style.
  let joined = chapterSums.map(s => `${s.title}: ${s.sum}`).join('\n\n')
  while (joined.length > size * 1.4) {
    const parts = chunk(joined, size)
    const next: string[] = []
    for (const p of parts) { onProgress({ done, total: total + 1, label: '…' }); next.push(await run(ask(lang, NOTE[lang], p))) }
    joined = next.join('\n')
  }
  tick('✦')
  return run(ask(lang, FINAL[lang][mode], joined), maxNew + 200, true)
}
