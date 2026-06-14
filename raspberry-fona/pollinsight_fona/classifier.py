from __future__ import annotations

import time
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from PIL import Image

try:
    from tflite_runtime.interpreter import Interpreter
except ImportError:
    from ai_edge_litert.interpreter import Interpreter


@dataclass(frozen=True)
class Classification:
    filename: str
    infected: bool
    score: float
    inference_ms: float


class QuantizedClassifier:
    def __init__(self, model_path: Path, threshold: float = 0.5):
        self.threshold = threshold
        self.interpreter = Interpreter(model_path=str(model_path))
        self.interpreter.allocate_tensors()
        self.input_details = self.interpreter.get_input_details()[0]
        self.output_details = self.interpreter.get_output_details()[0]

    def classify(self, image_path: Path) -> Classification:
        started = time.perf_counter()
        height = int(self.input_details["shape"][1])
        width = int(self.input_details["shape"][2])
        with Image.open(image_path) as image:
            image = image.convert("RGB").resize((width, height), Image.Resampling.NEAREST)
            values = np.expand_dims(np.asarray(image), 0)

        scale, zero_point = self.input_details["quantization"]
        quantized = np.clip(
            values / scale + zero_point,
            np.iinfo(self.input_details["dtype"]).min,
            np.iinfo(self.input_details["dtype"]).max,
        ).astype(self.input_details["dtype"])

        self.interpreter.set_tensor(self.input_details["index"], quantized)
        self.interpreter.invoke()
        raw_output = self.interpreter.get_tensor(self.output_details["index"]).flatten()[0]
        output_scale, output_zero = self.output_details["quantization"]
        score = float(output_scale * (float(raw_output) - output_zero))

        return Classification(
            filename=image_path.name,
            infected=score >= self.threshold,
            score=score,
            inference_ms=(time.perf_counter() - started) * 1000,
        )
