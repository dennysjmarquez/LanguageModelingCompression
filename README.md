# Language Modeling Compression

**Compresión es predicción.** Un proyecto 100% funcional que implementa el argumento de:

- [Compression is prediction](https://ngrok.com/blog/compression-is-prediction) — Annie Sexton, ngrok
- [Language Modeling Is Compression](https://arxiv.org/abs/2309.10668) — DeepMind, ICLR 2024

Los modelos de lenguaje y los compresores lossless resuelven el mismo problema: estimar \(P(\text{símbolo}\mid\text{contexto})\). El entropy coder (arithmetic coding) convierte esas probabilidades en un bitstream. Mejor modelo → menos bits.

Este repo no es un resumen: **comprime y descomprime de verdad**, en el navegador y por CLI, con round-trip lossless.

## Qué incluye

### Laboratorio interactivo (web)

Recrea los demos del artículo de ngrok:

1. Minificación vs. compresión real  
2. Run-length encoding (`AAAAAAAAABBBBCCDAAADDDDDDDDD` → `A9B4C2D1A3D9`)  
3. Anatomía: transforms · model · entropy coder  
4. Arithmetic coding paso a paso — el rango final de `ABABAAC` es `[0.38730, 0.38855)` y el número mágico `0.3876953125` (10 bits), igual que en el artículo  
5. Descompresión aritmética (el truco inverso)  
6. Distribuciones sesgadas y bits/símbolo  
7. Entropía de Shannon y Huffman (`bits = −log₂(p)`)  
8. Contexto order-1 (`TO BE OR NOT TO BE`)  
9. Un LLM como compressor: el modelo no elige el token, **paga** `−log₂(p)`  
10. Dickens vs. n-gramas vs. las cifras GPT-2 del artículo  

### Compresor real

Formato **LMC1**, todo en local:

| Método | Idea |
| --- | --- |
| RLE | Transform de rachas |
| Huffman | Codewords de longitud entera |
| Arithmetic order-0…3 | N-grama adaptativo (Laplace + backoff) + coder Witten–Neal–Cleary |
| gzip | DEFLATE nativo del navegador, para comparar |

El decoder reconstruye el modelo al vuelo (setting *online* / in-context del paper). Descarga `.lmc` y vuelve a abrir el archivo para descomprimir.

## Web

```bash
cd web
npm install
npm run dev
```

Abre el preview. Pestaña **Compresor** para el playground.

```bash
npx tsx scripts/roundtrip.mjs   # tests lossless
npm run build
```

## CLI Python

```bash
PYTHONPATH=python python3 -m lmc compress texto.txt -n 2 -o texto.lmc
PYTHONPATH=python python3 -m lmc decompress texto.lmc -o texto.out
```

`-n` es el orden del n-grama (0–3). El header LMC1 es compatible con el playground web.

## Cómo funciona

1. El **modelo** mira los últimos \(k\) bytes y produce un intervalo acumulado `[cumLow, cumHigh) / total` para el byte actual (suavizado de Laplace; si el contexto es nuevo, hace backoff).  
2. El **arithmetic coder** recorta el rango entero `[low, high]` a esa rebanada y renormaliza, emitiendo bits.  
3. Encoder y decoder arrancan con las mismas tablas vacías y **actualizan después de cada símbolo**. Por eso no hay que guardar el modelo en el archivo.  
4. La cruz-entropía \(\sum -\log_2 P(s_i\mid c_i)\) es el piso: el bitstream se queda a unos pocos bits de esa cifra.

Eso es exactamente “language modeling is compression”.

## Fuentes

- Sexton, A. *Compression is prediction*. ngrok blog.  
- Delétang et al. *Language Modeling Is Compression*. arXiv:2309.10668.  
- Witten, Neal, Cleary. *Arithmetic coding for data compression*. CACM 1987.  
- Shannon. *A Mathematical Theory of Communication*. 1948.

El HTML original del artículo está en `Articulo info/`.
