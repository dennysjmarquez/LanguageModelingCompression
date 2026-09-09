import { useEffect, useState } from 'react'
import {
  Anatomy,
  ArithmeticLab,
  ContextLab,
  DickensLab,
  EntropyLab,
  LlmLab,
  MinifyLab,
  RleLab,
  SkewLab,
  WildLab,
} from './components/Labs'
import { Playground } from './components/Playground'

type Page = 'lab' | 'play'

function pageFromHash(): Page {
  return location.hash.replace('#', '') === 'compresor' ? 'play' : 'lab'
}

export default function App() {
  const [page, setPage] = useState<Page>(pageFromHash)

  useEffect(() => {
    const onHash = () => setPage(pageFromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  function go(p: Page) {
    location.hash = p === 'play' ? 'compresor' : 'laboratorio'
    setPage(p)
  }

  return (
    <div className="app">
      <nav className="nav">
        <a className="brand" href="#laboratorio" onClick={() => go('lab')}>
          <span className="brand-mark" />
          LMC
        </a>
        <div className="nav-links">
          <button className={'nav-link' + (page === 'lab' ? ' active' : '')} onClick={() => go('lab')}>
            Laboratorio
          </button>
          <button className={'nav-link' + (page === 'play' ? ' active' : '')} onClick={() => go('play')}>
            Compresor
          </button>
          {page === 'lab' ? (
            <>
              <a href="#aritmetica">Arithmetic</a>
              <a href="#contexto">Contexto</a>
              <a href="#llm">LLM</a>
            </>
          ) : null}
        </div>
        <div className="nav-spacer" />
        <span className="pill">lossless · in-browser</span>
      </nav>

      {page === 'lab' ? (
        <main className="page">
          <header className="hero">
            <p className="kicker">Language modeling is compression</p>
            <h1>Compresión es predicción.</h1>
            <p className="lede">
              Los compresores y los modelos de lenguaje resuelven el mismo problema:
              <strong> dado el contexto, ¿cuál es el próximo símbolo y con qué probabilidad?</strong>
              Este laboratorio implementa de verdad lo que cuenta el artículo de ngrok
              y el paper de DeepMind: un coder aritmético lossless alimentado por un
              modelo de lenguaje.
            </p>
            <div className="btn-row" style={{ marginTop: 22 }}>
              <button className="btn primary" onClick={() => go('play')}>
                Abrir el compresor
              </button>
              <a className="btn" href="#aritmetica">
                Ver arithmetic coding
              </a>
            </div>
          </header>

          <MinifyLab />
          <RleLab />
          <Anatomy />
          <ArithmeticLab />
          <SkewLab />
          <EntropyLab />
          <ContextLab />
          <LlmLab />
          <DickensLab />
          <WildLab />
        </main>
      ) : (
        <main className="page">
          <Playground />
        </main>
      )}

      <footer className="footer">
        Basado en{' '}
        <a href="https://ngrok.com/blog/compression-is-prediction" target="_blank" rel="noreferrer">
          Compression is prediction
        </a>{' '}
        (Annie Sexton / ngrok) y{' '}
        <a href="https://arxiv.org/abs/2309.10668" target="_blank" rel="noreferrer">
          Language Modeling Is Compression
        </a>{' '}
        (DeepMind, ICLR 2024). Implementación 100% local — nada se sube a un servidor.
      </footer>
    </div>
  )
}
