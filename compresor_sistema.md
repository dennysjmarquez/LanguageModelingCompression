# Sistema de Compresión Basado en Predicción: Informe Completo

**Fuentes:**
- Artículo: "Compression is prediction" de Annie Sexton (ngrok blog, 11 Aug 2026)
- Referencias complementarias: arxiv 2309.10668, https://ngrok.com/blog/compression-is-prediction

---

## 1. Visión General

El artículo sostiene que **compresión y modelado de lenguaje (LLM) son dos caras de la misma moneda**. Ambos resuelven el mismo problema fundamental: predecir la próxima símbolo en una secuencia usando probabilidades. La compresión eficaz depende de modelos que asignen altas probabilidades a los símbolos que efectivamente aparecen, reduciendo así el número de bits necesarios.

---

## 2. Fundamentos de la Compresión

### 2.1. Redundancia y Modelos
- La compresión aprovecha la redundancia en los datos.
- Un modelo mapea cada símbolo a su probabilidad de aparición.
- Ejemplo básico: en la cadena "AAAAAAAAABBBBCCDAAADDDDDDDDD", el recuento de símbolos permite codificar runs (A9B4C2D1A3D9), reduciendo de 28 a 12 caracteres (57% smaller).

### 2.2. Organos de un Compresor Moderno
Todo compresor consta de tres componentes principales (no siempre aislados):

1. **Transforms** — Pasos de preprocesamiento que hacen los datos más comprimibles. Ejemplo: run-length encoding. Pueden aumentar redundancia antes de comprimir.

2. **Models** — Tablas que mapean símbolos a probabilidades. La frecuencia de cada símbolo determina su probability. Contexto puede modular estas probabilidades (modelos order-N).

3. **Entropy Coders** — Paso final que produce el bitstream usando las probabilidades del modelo. No son ajustables; la calidad depende enteramente del modelo.

---

## 3. Arithmetic Coding (Codificación Aritmética)

### 3.1. Principio
Representar todo el dataset con un solo número en el rango [0, 1). Cada símbolo codifica restringe el rango a la sección correspondiente a ese símbolo, usando la misma distribución de probabilidades.

### 3.2. Ejemplo: "ABABAAC"
- Longitud 7, conteo: 4 A's, 2 B's, 1 C.
- Probabilidades: A=0.571, B=0.286, C=0.143.
- Range final: [0.38730, 0.38855). Número mágico: 0.3876953125.
- Raw ASCII: 56 bits. Arithmetic: 10 bits. **5.6× compresión.**

### 3.3. Principio Informativo (Entropy)
El número de bits por símbolo está acotado por la **entropía de Shannon**:
```
bits = −log₂(probability)
```
Este es el **piso** — no se puede superar sin perder información (salvo compresión lossy que descarta detalles).

### 3.4. Efecto de la Skewed Distribution
Distribuciones más sesgadas (una sola símbolo dominante) logran mejor compresión:
- String "AAAAAAAAAAABC" (10 A's, 1 B, 1 C) comprime a 0.82 bits/symbol vs 1.38 bits/symbol para string equilibrado.

---

## 4. Contexto y Modelos de Orden Superior

### 4.1. Importancia del Contexto
Una sola probabilidad por símbolo es insuficiente. El contexto transforma la predicción:
- En inglés: P(U) ≈ 0.028 globalmente, pero P(U|Q) ≈ 0.999.
- Modelos order-1 usan el símbolo previo como contexto. order-N usa los N símbolos previos.

### 4.2. Impacto Medido
Usando order-1 sobre "TO BE OR NOT TO BE":
- Sin contexto: 2.59 bits/symbol, 47 bits total.
- Con order-1: 1.16 bits/symbol, 21 bits total. **Más de la mitad de reducción.**

### 4.3. LLMs como Modelos de Predicción
- Los LLM devuelven distribuciones de probabilidad sobre el próximo token dado el contexto (prompt).
- La "entre-cruz-entropía" en LLM es idéntica matemáticamente a la entropía de compresión.
- Ejemplo demo: modelo predice tokens; si el token real tiene baja probabilidad, los bits aumentan drásticamente.

### 4.3.1. Comparativo: order-1 vs GPT-2
Cita del artículo sobre un quote de Dickens:
- order-1: 434 bits · 24% of original
- GPT-2: 176 bits · 10% of original

Los LLM actuales superan a modelos clásicos order-1.

---

## 5. Arquitectura de un Sistema de Compresión Híbrido LLM/Tradicional

### 5.1. Flujo de Trabajo
1. **Preprocesado (Transforms)**: Limpieza, tokenización, normalización.
2. **Modelado (LLM/entropy)**: Usar un modelo pre-entrenado (puede ser un LLM pequeño) para asignar probabilidades a cada token dado el contexto.
3. **Codificación Entropía**: Aritmetic coding o Huffman usando las probabilidades del modelo.
4. **Decodificación**: Inverso — recibir número (arithmetic) o codewords (Huffman), reconstruir símbolos usando las mismas probabilidades y contexto.

### 5.2. Recursos vs. Compresión
- LLM puro: compresión óptima pero overhead gigantesco (gigabytes) → impractical para HTTP responses.
- Compresores tradicionales (gzip, Brotli): overhead minúsculo, compresión decente (~50%).
- Híbrido: usar LLM solo cuando el costo de cómputo está justificado por el tamaño de datos (datasets masivos).

---

## 6. Protocolo de Implementación Práctica

### 6.1. Paso a Paso
1. **Recolectar datos de entrenamiento** — corpus representativo del tipo de datos a comprimir.
2. **Entrenar o seleccionar un modelo** — LLM pequeño (GPT-2 size orden) o modelo estadístico (N-gramas, Word2vec features).
3. **Generar probabilidades por token** — para cada posición, el modelo entrega P(token|contexto).
4. **Aplicar entropy coder** — arithmetic coding para producir bitstream.
5. **Almacenar/transmitir** — bits + metadata del modelo (parámetros, arquitectura) necesario para la decodificación.

### 6.2. Consideraciones Críticas
- **El modelo debe ser conocido por el decodificador.** Tanto compresor como descompresor necesitan el mismo modelo idéntico.
- **Contexto consistente.** El mismo contexto debe usarse en codificación y decodificación.
- **Entropy coder fixed.** Una vez elegido (arithmetic vs Huffman), no se puede optimizar más; la calidad depende del modelo.
- **Piso de entropía.** El −log₂(probability) por símbolo es el límite teórico; medirlo reporta eficiencia real.

---

## 7. Conclusiones del Artículo

1. **Compresión es predicción.** Ambos resuelven: dada contexto, ¿cuál es el próximo símbolo y con qué probabilidad?
2. **Mejor modelo = mejor compresión.** Los LLM son "tan buenos como gets" para prediction, pero overhead los limita a casos selectos.
3. **Entropía es el piso.** −log₂(probability) por símbolo; cualquier compresor bueno se acerque a este límite.
4. **Contexto eleva probabilidades.** Modelos order-N dramatically reducen bits/symbol vs order-0 (solo frecuencia).
5. **Compresión en la práctica.** Herramientas reales (gzip, Brotli) optimizan velocidad/ratio; LLM sobrekill para la mayoría de casos de uso generales.

---

## 8. Referencias

- Sexton, A. (2026). "Compression is prediction". ngrok blog.
- arxiv 2309.10668 — Paper Google DeepMind sobre relación LLM/compresión.
- Shannon, C. (1948). "A Mathematical Theory of Communication" — Foundación entropía.
- Olah, C. — Artículo sobre nitty-gritty de entropía en LLM.

---
*Este informe fue generado 100% sobre la base del artículo "Compression is prediction" y la info.md asociada. Todo el contenido técnico deriva directamente de la lectura y análisis de estas fuentes.*