"""Witten–Neal–Cleary arithmetic coder (30-bit state)."""

CODE_BITS = 30
TOP_VALUE = (1 << CODE_BITS) - 1
FIRST_QTR = (TOP_VALUE >> 2) + 1
HALF = FIRST_QTR * 2
THIRD_QTR = FIRST_QTR * 3
MAX_FREQ = FIRST_QTR - 1


class BitWriter:
    def __init__(self) -> None:
        self.bits: list[int] = []

    def write(self, bit: int) -> None:
        self.bits.append(bit & 1)

    def to_bytes(self) -> tuple[bytes, int]:
        n = len(self.bits)
        out = bytearray((n + 7) // 8)
        for i, b in enumerate(self.bits):
            if b:
                out[i >> 3] |= 1 << (7 - (i & 7))
        return bytes(out), n


class BitReader:
    def __init__(self, data: bytes, bit_count: int) -> None:
        bits: list[int] = []
        for byte in data:
            for j in range(7, -1, -1):
                if len(bits) >= bit_count:
                    break
                bits.append((byte >> j) & 1)
            if len(bits) >= bit_count:
                break
        self.bits = bits
        self.pos = 0

    def read(self) -> int:
        if self.pos >= len(self.bits):
            return 0
        b = self.bits[self.pos]
        self.pos += 1
        return b


class Encoder:
    def __init__(self) -> None:
        self.low = 0
        self.high = TOP_VALUE
        self.pending = 0
        self.out = BitWriter()

    def _bpf(self, bit: int) -> None:
        self.out.write(bit)
        opp = 1 - bit
        while self.pending:
            self.out.write(opp)
            self.pending -= 1

    def encode(self, cum_low: int, cum_high: int, total: int) -> None:
        rng = self.high - self.low + 1
        self.high = self.low + rng * cum_high // total - 1
        self.low = self.low + rng * cum_low // total
        while True:
            if self.high < HALF:
                self._bpf(0)
            elif self.low >= HALF:
                self._bpf(1)
                self.low -= HALF
                self.high -= HALF
            elif self.low >= FIRST_QTR and self.high < THIRD_QTR:
                self.pending += 1
                self.low -= FIRST_QTR
                self.high -= FIRST_QTR
            else:
                break
            self.low *= 2
            self.high = self.high * 2 + 1

    def finish(self) -> tuple[bytes, int]:
        self.pending += 1
        if self.low < FIRST_QTR:
            self._bpf(0)
        else:
            self._bpf(1)
        return self.out.to_bytes()


class Decoder:
    def __init__(self, data: bytes, bit_count: int) -> None:
        self.low = 0
        self.high = TOP_VALUE
        self.reader = BitReader(data, bit_count)
        self.value = 0
        for _ in range(CODE_BITS):
            self.value = (self.value << 1) | self.reader.read()

    def target(self, total: int) -> int:
        rng = self.high - self.low + 1
        return ((self.value - self.low + 1) * total - 1) // rng

    def advance(self, cum_low: int, cum_high: int, total: int) -> None:
        rng = self.high - self.low + 1
        self.high = self.low + rng * cum_high // total - 1
        self.low = self.low + rng * cum_low // total
        while True:
            if self.high < HALF:
                pass
            elif self.low >= HALF:
                self.value -= HALF
                self.low -= HALF
                self.high -= HALF
            elif self.low >= FIRST_QTR and self.high < THIRD_QTR:
                self.value -= FIRST_QTR
                self.low -= FIRST_QTR
                self.high -= FIRST_QTR
            else:
                break
            self.low *= 2
            self.high = self.high * 2 + 1
            self.value = self.value * 2 + self.reader.read()
