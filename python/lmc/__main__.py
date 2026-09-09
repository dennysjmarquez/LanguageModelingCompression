from __future__ import annotations

import argparse
from pathlib import Path

from .compressor import compress, decompress


def main() -> None:
    p = argparse.ArgumentParser(
        description="Compresor lossless por modelo de lenguaje (n-grama + arithmetic coding)."
    )
    sub = p.add_subparsers(dest="cmd", required=True)

    c = sub.add_parser("compress", help="comprimir un archivo")
    c.add_argument("input", type=Path)
    c.add_argument("-o", "--output", type=Path)
    c.add_argument("-n", "--order", type=int, default=2, choices=[0, 1, 2, 3])

    d = sub.add_parser("decompress", help="descomprimir un .lmc")
    d.add_argument("input", type=Path)
    d.add_argument("-o", "--output", type=Path)

    args = p.parse_args()
    if args.cmd == "compress":
        data = args.input.read_bytes()
        out = compress(data, args.order)
        dest = args.output or args.input.with_suffix(args.input.suffix + ".lmc")
        dest.write_bytes(out)
        ratio = 100 * len(out) / max(len(data), 1)
        print(f"{len(data)} → {len(out)} bytes ({ratio:.1f}%)  order={args.order}  {dest}")
    else:
        data = args.input.read_bytes()
        rec = decompress(data)
        dest = args.output or Path(str(args.input).removesuffix(".lmc") + ".out")
        dest.write_bytes(rec)
        print(f"{len(data)} → {len(rec)} bytes  {dest}")


if __name__ == "__main__":
    main()
