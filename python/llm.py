"""The language-model client the chapter writer talks to.

A client is anything with `complete(prompt, *, model, temperature) -> str`. The writer asks for a model
and a temperature on every call and never learns which provider answers, so a different provider, a local
model or a test double is one small class.
"""
import os
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


OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"


class OpenRouterClient(OpenAIClient):
    """OpenRouter, which speaks the same protocol, so one key reaches many models. The key comes from
    OPENROUTER_API_KEY. Models are named `vendor/model`, for example `openai/gpt-4o-mini`.

    It never falls back to OPENAI_API_KEY: that key would otherwise be sent to a third party.
    """

    def __init__(self, api_key=None):
        super().__init__(api_key=api_key or os.environ.get("OPENROUTER_API_KEY"), base_url=OPENROUTER_BASE_URL)

    def complete(self, prompt, *, model, temperature):
        if not self._options["api_key"]:
            raise RuntimeError("OPENROUTER_API_KEY is not set")
        return super().complete(prompt, model=model, temperature=temperature)


# The model each provider uses when none is asked for. OpenAI keeps the model the pipeline was written for.
DEFAULT_MODELS = {"openai": "gpt-4", "openrouter": "openai/gpt-4o-mini"}


def make_client(provider):
    if provider == "openai":
        return OpenAIClient()
    if provider == "openrouter":
        return OpenRouterClient()
    raise ValueError(f"unknown provider {provider!r}; use one of: {', '.join(DEFAULT_MODELS)}")
