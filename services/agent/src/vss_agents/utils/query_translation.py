# SPDX-FileCopyrightText: Copyright (c) 2025-2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
# SPDX-License-Identifier: Apache-2.0
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import asyncio
import logging
import os
from pathlib import Path
import re
import threading

import sentencepiece as spm
import torch
from transformers import MarianMTModel

logger = logging.getLogger(__name__)

DEFAULT_KO_EN_MODEL_ID = "Helsinki-NLP/opus-mt-tc-big-ko-en"
DEFAULT_CONTAINER_MODEL_PATH = "/vss-agent/models/opus-mt-tc-big-ko-en"
_HANGUL_PATTERN = re.compile(r"[\u1100-\u11ff\u3130-\u318f\uac00-\ud7a3]")


def contains_hangul(text: str) -> bool:
    """Return whether text contains a Hangul syllable or jamo character."""
    return bool(_HANGUL_PATTERN.search(text))


def _default_model_location() -> str:
    configured_model = os.getenv("VSS_QUERY_TRANSLATION_MODEL")
    if configured_model:
        return configured_model
    if os.path.isdir(DEFAULT_CONTAINER_MODEL_PATH):
        return DEFAULT_CONTAINER_MODEL_PATH
    return DEFAULT_KO_EN_MODEL_ID


class KoreanToEnglishTranslator:
    """Lazy, thread-safe Korean-to-English Marian translation model."""

    def __init__(self, model_name_or_path: str | None = None) -> None:
        model_location = model_name_or_path or _default_model_location()
        logger.info("Loading Korean-to-English query translation model: %s", model_location)
        model_path = Path(model_location)
        self._source_processor = spm.SentencePieceProcessor(model_file=str(model_path / "source.spm"))
        self._target_processor = spm.SentencePieceProcessor(model_file=str(model_path / "target.spm"))
        self._model = MarianMTModel.from_pretrained(model_location)
        self._model.to("cpu")
        self._model.eval()
        self._inference_lock = threading.Lock()
        logger.info("Korean-to-English query translation model loaded")

    def translate(self, query: str) -> str:
        """Translate a Korean query to English; non-Korean input is returned unchanged."""
        if not contains_hangul(query):
            return query

        input_ids = self._source_processor.encode(query, out_type=int)[:127]
        input_ids.append(self._source_processor.eos_id())
        input_tensor = torch.tensor([input_ids], dtype=torch.long)
        with self._inference_lock, torch.inference_mode():
            output_ids = self._model.generate(
                input_ids=input_tensor,
                attention_mask=torch.ones_like(input_tensor),
                max_new_tokens=64,
                num_beams=2,
                do_sample=False,
            )

        special_ids = {
            self._target_processor.unk_id(),
            self._target_processor.bos_id(),
            self._target_processor.eos_id(),
        }
        target_vocab_size = self._target_processor.vocab_size()
        decoded_ids = [
            token_id
            for token_id in output_ids[0].tolist()
            if 0 <= token_id < target_vocab_size and token_id not in special_ids
        ]
        translated = self._target_processor.decode(decoded_ids).strip()
        return translated or query


_translator: KoreanToEnglishTranslator | None = None
_translator_lock = threading.Lock()


def _get_translator() -> KoreanToEnglishTranslator:
    global _translator
    if _translator is None:
        with _translator_lock:
            if _translator is None:
                _translator = KoreanToEnglishTranslator()
    return _translator


async def translate_query_if_korean(query: str) -> str:
    """Translate Hangul-containing queries on a worker thread and preserve input on failure."""
    if not contains_hangul(query):
        return query

    try:
        translated = await asyncio.to_thread(_get_translator().translate, query)
    except Exception:
        logger.exception("Korean-to-English query translation failed; using the original query")
        return query

    logger.info("Translated Korean search query: original=%r translated=%r", query, translated)
    return translated
