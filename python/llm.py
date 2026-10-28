"""The language-model client the chapter writer talks to.

A client is anything with `complete(prompt, *, model, temperature) -> str`. The writer asks for a model
and a temperature on every call and never learns which provider answers, so a different provider, a local
model or a test double is one small class.
"""
from typing import Protocol


class LLMClient(Protocol):
    def complete(self, prompt: str, *, model: str, temperature: float) -> str: ...


class OpenAIClient:
    """OpenAI chat completions through the openai SDK. The key comes from OPENAI_API_KEY."""

    def __init__(self, api_key=None, base_url=None):
        self._options = {"api_key": api_key, "base_url": base_url}
        self._sdk = None  # built on the first call, so importing this module needs no key

    def complete(self, prompt, *, model, temperature):
        if self._sdk is None:
            from openai import OpenAI

            self._sdk = OpenAI(**{k: v for k, v in self._options.items() if v is not None})
        response = self._sdk.chat.completions.create(
            model=model,
            temperature=temperature,
            messages=[{"role": "user", "content": prompt}],
        )
        return response.choices[0].message.content or ""
