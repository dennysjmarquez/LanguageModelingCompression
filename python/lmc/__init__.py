"""Language-model compression: adaptive n-gram + arithmetic coding."""

from .compressor import compress, decompress

__all__ = ["compress", "decompress"]
