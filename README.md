# まとめ屋 / Summarizer — Universe 74

Open a PDF, EPUB or TXT (or paste text) and get a summary: short, detailed, chapter by chapter, or for kids, in Japanese or English.

- The AI runs in your browser with [transformers.js](https://github.com/huggingface/transformers.js): Qwen2.5-0.5B-Instruct (~0.5 GB, WebGPU q4f16 or WASM q8) by default, Qwen2.5-1.5B-Instruct (~1.2 GB, WebGPU only) as the smarter option. Downloaded once, then cached.
- Long books are split into pieces, summarized piece by piece, then combined (map-reduce), with progress and a time estimate.
- Optional: your own free Gemini key (off by default, stored only on your device).
- Free. No ads. No login. Part of the [Universe 74 App House](https://gutsmcd-cmd.github.io/universe-74/).

Test without downloading a model: add `?mock` to the URL.
