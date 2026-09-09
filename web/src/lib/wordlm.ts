/**
 * Tiny word-level language model used by the "LLM as compressor" lab.
 * Not GPT — a real n-gram predictor that still demonstrates the same math:
 * the model emits P(token | context), and −log₂(p) is the bit cost.
 */

const DEFAULT_CORPUS = `
The rain in Spain falls mainly on the plain.
The rain in Spain stays mainly in the mountains.
It was the best of times, it was the worst of times, it was the age of wisdom, it was the age of foolishness, it was the epoch of belief, it was the epoch of incredulity, it was the season of Light, it was the season of Darkness.
To be or not to be, that is the question.
Yesterday I saw an animal when I was walking downtown. It was a bird. It was a squirrel. It was a cat. It was a fox. It was a bear.
Compression is prediction. Language modeling is compression.
The quick brown fox jumps over the lazy dog.
In the beginning was the Word, and the Word was with God.
All happy families are alike; each unhappy family is unhappy in its own way.
Call me Ishmael. Some years ago never mind how long precisely having little or no money in my purse.
`

const TOKEN_RE = /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ']+|[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ'\s]|\s+/g

export function tokenize(text: string): string[] {
  return text.match(TOKEN_RE) ?? []
}

export class WordLM {
  private unigram = new Map<string, number>()
  private bigram = new Map<string, Map<string, number>>()
  private uniTotal = 0
  vocab: string[] = []

  constructor(corpus = DEFAULT_CORPUS) {
    const toks = tokenize(corpus)
    for (let i = 0; i < toks.length; i++) {
      const t = toks[i]
      this.unigram.set(t, (this.unigram.get(t) ?? 0) + 1)
      this.uniTotal++
      if (i > 0) {
        const prev = toks[i - 1]
        if (!this.bigram.has(prev)) this.bigram.set(prev, new Map())
        const m = this.bigram.get(prev)!
        m.set(t, (m.get(t) ?? 0) + 1)
      }
    }
    this.vocab = [...this.unigram.keys()]
  }

  private uniP(tok: string): number {
    const V = this.vocab.length || 1
    return ((this.unigram.get(tok) ?? 0) + 1) / (this.uniTotal + V)
  }

  /** P(next | previous token), Laplace-smoothed with unigram backoff. */
  probability(next: string, prev: string | null): number {
    if (!prev) return this.uniP(next)
    const m = this.bigram.get(prev)
    if (!m) return this.uniP(next)
    let tot = 0
    for (const c of m.values()) tot += c
    const V = this.vocab.length
    const c = m.get(next) ?? 0
    const lambda = 0.7
    const pBi = (c + 1) / (tot + V)
    return lambda * pBi + (1 - lambda) * this.uniP(next)
  }

  topK(prev: string | null, k = 5): { token: string; p: number }[] {
    const scored = this.vocab.map((token) => ({
      token,
      p: this.probability(token, prev),
    }))
    scored.sort((a, b) => b.p - a.p)
    const top = scored.slice(0, k)
    const z = top.reduce((a, b) => a + b.p, 0) || 1
    return top.map((t) => ({ token: t.token, p: t.p / z }))
  }

  /** Bit cost of encoding `text` under this model (word tokens). */
  encodeBits(text: string): { tokens: { token: string; p: number; bits: number }[]; totalBits: number } {
    const toks = tokenize(text)
    const tokens: { token: string; p: number; bits: number }[] = []
    let totalBits = 0
    let prev: string | null = null
    for (const token of toks) {
      const p = Math.max(this.probability(token, prev), 1e-12)
      const bits = -Math.log2(p)
      tokens.push({ token, p, bits })
      totalBits += bits
      prev = token
    }
    return { tokens, totalBits }
  }
}

export const defaultWordLM = new WordLM()

/** Scripted next-token demo matching the ngrok article's "rain in Spain" walkthrough. */
export const SPAIN_SCRIPT: {
  prompt: string
  options: { token: string; p: number }[]
  actual: string
}[] = [
  {
    prompt: '',
    options: [
      { token: 'The', p: 0.45 },
      { token: 'A', p: 0.25 },
      { token: 'In', p: 0.15 },
      { token: 'It', p: 0.1 },
      { token: 'This', p: 0.05 },
    ],
    actual: 'The',
  },
  {
    prompt: 'The',
    options: [
      { token: 'rain', p: 0.52 },
      { token: 'sun', p: 0.18 },
      { token: 'king', p: 0.12 },
      { token: 'cat', p: 0.1 },
      { token: 'end', p: 0.08 },
    ],
    actual: 'rain',
  },
  {
    prompt: 'The rain',
    options: [
      { token: 'in', p: 0.7 },
      { token: 'on', p: 0.12 },
      { token: 'fell', p: 0.08 },
      { token: 'was', p: 0.06 },
      { token: 'and', p: 0.04 },
    ],
    actual: 'in',
  },
  {
    prompt: 'The rain in',
    options: [
      { token: 'Spain', p: 0.82 },
      { token: 'Bermuda', p: 0.06 },
      { token: 'France', p: 0.05 },
      { token: 'the', p: 0.04 },
      { token: 'vain', p: 0.03 },
    ],
    actual: 'Spain',
  },
  {
    prompt: 'The rain in Spain',
    options: [
      { token: 'falls', p: 0.65 },
      { token: 'stays', p: 0.15 },
      { token: 'comes', p: 0.1 },
      { token: 'pours', p: 0.06 },
      { token: 'goes', p: 0.04 },
    ],
    actual: 'falls',
  },
  {
    prompt: 'The rain in Spain falls',
    options: [
      { token: 'mainly', p: 0.78 },
      { token: 'gently', p: 0.08 },
      { token: 'hard', p: 0.06 },
      { token: 'on', p: 0.05 },
      { token: 'down', p: 0.03 },
    ],
    actual: 'mainly',
  },
  {
    prompt: 'The rain in Spain falls mainly',
    options: [
      { token: 'on', p: 0.72 },
      { token: 'in', p: 0.16 },
      { token: 'upon', p: 0.06 },
      { token: 'over', p: 0.04 },
      { token: 'at', p: 0.02 },
    ],
    actual: 'on',
  },
  {
    prompt: 'The rain in Spain falls mainly on',
    options: [
      { token: 'the', p: 0.88 },
      { token: 'a', p: 0.05 },
      { token: 'plain', p: 0.04 },
      { token: 'my', p: 0.02 },
      { token: 'that', p: 0.01 },
    ],
    actual: 'the',
  },
  {
    prompt: 'The rain in Spain falls mainly on the',
    options: [
      { token: 'plain', p: 0.81 },
      { token: 'ground', p: 0.07 },
      { token: 'roof', p: 0.05 },
      { token: 'hills', p: 0.04 },
      { token: 'sea', p: 0.03 },
    ],
    actual: 'plain',
  },
]
