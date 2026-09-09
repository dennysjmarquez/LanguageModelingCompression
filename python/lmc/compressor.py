from __future__ import annotations

from .arithmetic import MAX_FREQ, Decoder, Encoder

ALPHABET = 256
MAGIC = b"LMC1"


class AdaptiveNgram:
    def __init__(self, order: int) -> None:
        self.order = order
        self.tables: list[dict[bytes, list[int]]] = [dict() for _ in range(order + 1)]

    def _resolve(self, ctx: bytes) -> list[int] | None:
        max_o = min(self.order, len(ctx))
        for o in range(max_o, 0, -1):
            key = ctx[-o:]
            freq = self.tables[o].get(key)
            if freq is not None:
                return freq
        return self.tables[0].get(b"")

    def interval(self, symbol: int, ctx: bytes) -> tuple[int, int, int]:
        freq = self._resolve(ctx)
        if freq is None:
            return symbol, symbol + 1, ALPHABET
        total = ALPHABET
        cum = 0
        for i, f in enumerate(freq):
            total += f
            if i < symbol:
                cum += f + 1
        return cum, cum + freq[symbol] + 1, total

    def lookup(self, t: int, ctx: bytes) -> tuple[int, int, int, int]:
        freq = self._resolve(ctx)
        if freq is None:
            s = min(max(t, 0), ALPHABET - 1)
            return s, s, s + 1, ALPHABET
        total = ALPHABET + sum(freq)
        cum = 0
        for i, f in enumerate(freq):
            w = f + 1
            if cum + w > t:
                return i, cum, cum + w, total
            cum += w
        return ALPHABET - 1, cum, total, total

    def update(self, symbol: int, ctx: bytes) -> None:
        max_o = min(self.order, len(ctx))
        for o in range(0, max_o + 1):
            key = b"" if o == 0 else ctx[-o:]
            freq = self.tables[o].get(key)
            if freq is None:
                freq = [0] * ALPHABET
                self.tables[o][key] = freq
            if sum(freq) + ALPHABET + 1 >= MAX_FREQ:
                for i in range(ALPHABET):
                    freq[i] = (freq[i] + 1) >> 1
            freq[symbol] += 1


def compress(data: bytes, order: int = 1) -> bytes:
    model = AdaptiveNgram(order)
    enc = Encoder()
    ctx = b""
    for b in data:
        cl, ch, tot = model.interval(b, ctx)
        enc.encode(cl, ch, tot)
        model.update(b, ctx)
        ctx = (ctx + bytes([b]))[-order:] if order else b""
    payload, nbits = enc.finish()
    method = 2 + order  # matches the browser LMC1 method ids (AC0=2…)
    header = (
        MAGIC
        + bytes([1, method])
        + len(data).to_bytes(4, "big")
        + nbits.to_bytes(4, "big")
        + len(payload).to_bytes(4, "big")
    )
    return header + payload


def decompress(archive: bytes) -> bytes:
    if archive[:4] != MAGIC:
        raise ValueError("not an LMC1 file")
    method = archive[5]
    order = method - 2 if method >= 2 else method
    orig = int.from_bytes(archive[6:10], "big")
    nbits = int.from_bytes(archive[10:14], "big")
    plen = int.from_bytes(archive[14:18], "big")
    payload = archive[18 : 18 + plen]
    if orig == 0:
        return b""
    model = AdaptiveNgram(order)
    dec = Decoder(payload, nbits)
    out = bytearray()
    ctx = b""
    for _ in range(orig):
        _cl, _ch, tot = model.interval(0, ctx)
        t = dec.target(tot)
        sym, cl, ch, tot = model.lookup(t, ctx)
        dec.advance(cl, ch, tot)
        out.append(sym)
        model.update(sym, ctx)
        ctx = (ctx + bytes([sym]))[-order:] if order else b""
    return bytes(out)
