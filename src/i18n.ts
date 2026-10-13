export type Lang = 'en' | 'ja'
export const STR = {
  en: {
    title: 'Summarizer', sub: 'Universe 74 · open a book, get the gist',
    drop: 'Open a PDF, EPUB or TXT file', or: 'or paste text', paste: 'Paste any text here…',
    mode: 'Kind of summary', short: 'Short', detailed: 'Detailed', chapters: 'Chapter by chapter', kids: 'For kids',
    outLang: 'Write it in', engine: 'Brain',
    small: 'Small & quick (0.5B, ~0.5 GB, once)', better: 'Smarter (1.5B, ~1.2 GB, needs WebGPU)', gemini: 'Your own Gemini key (cloud, fastest)',
    go: 'Summarize', stop: 'Stop', copy: 'Copy', save: 'Save .txt', toSongs: 'Make it a study song →', copied: 'Copied',
    loading: 'Downloading the AI model (only the first time)…', loaded: 'Model ready', working: 'Reading', eta: 'about {m} min left',
    step: 'Step {i} of {n}', done: 'Done in {s}s', stopped: 'Stopped.',
    gpu: 'Running on your graphics chip (WebGPU).', cpu: 'No WebGPU here, so it runs on the processor. Expect it to be slow.',
    honest: 'Everything runs inside this browser tab; your text is never uploaded (unless you choose a Gemini key). Speed is honest-to-goodness slow: a small model on a phone writes a few words a second, so a short article takes a minute or two and a whole book can take an hour or more. Keep the screen on. Small models get facts wrong sometimes, so check anything important.',
    keyH: 'Optional: your own free Gemini key', keyP: 'Off unless you pick it above. Big books in seconds. Get a free key at aistudio.google.com, paste it here. It stays only on this device. Your text is then sent to Google.',
    keySave: 'Save key', keyClear: 'Remove key', keySaved: 'Saved on this device.', needKey: 'Save a Gemini key first, or pick another brain.',
    needText: 'Open a file or paste some text first.', needGpu: 'This device has no WebGPU, so the smarter brain is not available. Using the small one.',
    file: '{t}: {n} parts, {c} characters', portal: '← Universe 74 App House',
  },
  ja: {
    title: 'まとめ屋', sub: 'ユニバース74・本を開けば、要点がわかる',
    drop: 'PDF・EPUB・TXTファイルを開く', or: 'または文章を貼りつけ', paste: 'ここに文章を貼りつけてください…',
    mode: '要約のタイプ', short: 'ひとことで', detailed: 'くわしく', chapters: '章ごとに', kids: '子ども向け',
    outLang: '出力の言語', engine: 'AI',
    small: '小さくて速い（0.5B・約0.5GB・初回のみ）', better: 'かしこい（1.5B・約1.2GB・WebGPUが必要）', gemini: '自分のGeminiキー（クラウド・最速）',
    go: '要約する', stop: '止める', copy: 'コピー', save: '.txtで保存', toSongs: 'これを覚え歌にする →', copied: 'コピーしました',
    loading: 'AIモデルをダウンロード中（初回のみ）…', loaded: 'モデルの準備ができました', working: '読んでいます', eta: '残り約{m}分',
    step: '{n}ステップ中{i}', done: '{s}秒で完了', stopped: '止めました。',
    gpu: 'グラフィックチップ（WebGPU）で動いています。', cpu: 'この端末はWebGPUに非対応なので、CPUで動きます。かなり時間がかかります。',
    honest: 'すべてこのブラウザの中で動くので、文章がアップロードされることはありません（Geminiキーを選んだ場合を除く）。正直に言うと遅いです。スマホの小さなモデルは1秒に数語しか書けないので、短い記事で1〜2分、本1冊だと1時間以上かかることもあります。画面はつけたままにしてください。小さなAIは事実を間違えることもあるので、大事なところは確認してください。',
    keyH: 'オプション：自分の無料Geminiキー', keyP: '上で選んだときだけ使います。分厚い本も数秒で要約できます。aistudio.google.com で無料キーを取得して貼りつけてください。キーはこの端末だけに保存されます。この場合、文章はGoogleに送信されます。',
    keySave: 'キーを保存', keyClear: 'キーを削除', keySaved: 'この端末に保存しました。', needKey: '先にGeminiキーを保存するか、別のAIを選んでください。',
    needText: 'ファイルを開くか、文章を貼りつけてください。', needGpu: 'この端末はWebGPUに非対応のため、「かしこい」は使えません。「小さくて速い」で続けます。',
    file: '{t}：{n}パート、{c}文字', portal: '← ユニバース74 アプリの家',
  },
} as const
export type Key = keyof typeof STR.en
export function fmt(s: string, v: Record<string, string | number>) { return s.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? '')) }
