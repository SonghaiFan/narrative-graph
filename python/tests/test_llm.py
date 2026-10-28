"""OpenAIClient: the openai SDK with only the HTTP layer faked."""
import json

import pytest

from llm import OpenAIClient

httpx2 = pytest.importorskip("httpx2", reason="the pinned openai 3.x SDK sends its requests through httpx2")


@pytest.fixture
def server(monkeypatch):
    sent = []

    def fake_send(self, request, **kwargs):
        body = json.loads(request.content)
        sent.append((request.method, str(request.url), dict(request.headers), body))
        reply = {
            "id": "c", "object": "chat.completion", "created": 0, "model": body["model"],
            "choices": [{"index": 0, "finish_reason": "stop", "message": {"role": "assistant", "content": "the reply"}}],
            "usage": {"prompt_tokens": 1, "completion_tokens": 1, "total_tokens": 2},
        }
        return httpx2.Response(200, request=request, json=reply)

    monkeypatch.setattr(httpx2.Client, "send", fake_send)
    return sent


def test_it_sends_one_chat_completion_and_returns_the_reply(server):
    reply = OpenAIClient().complete("write a chapter", model="gpt-4", temperature=0.5)
    assert reply == "the reply"
    [(method, url, headers, body)] = server
    assert method == "POST" and url.endswith("api.openai.com/v1/chat/completions")
    assert body["model"] == "gpt-4" and body["temperature"] == 0.5
    assert body["messages"] == [{"role": "user", "content": "write a chapter"}]
    assert set(body) <= {"messages", "model", "n", "stream", "temperature"}, "stray request fields"
    assert headers["authorization"] == "Bearer sk-test-not-a-real-key"  # the key comes from OPENAI_API_KEY


def test_the_model_and_temperature_are_whatever_is_asked_for(server):
    OpenAIClient().complete("p", model="gpt-4o-mini", temperature=0)
    assert server[0][3]["model"] == "gpt-4o-mini" and server[0][3]["temperature"] == 0


def test_a_key_and_a_base_url_can_be_given(server):
    OpenAIClient(api_key="sk-other", base_url="https://llm.example.test/v1").complete("p", model="m", temperature=0)
    [(_, url, headers, _)] = server
    assert url == "https://llm.example.test/v1/chat/completions" and headers["authorization"] == "Bearer sk-other"


def test_building_the_client_needs_no_key_and_no_network(monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY")
    OpenAIClient()  # nothing is built until the first call


# --- OpenRouter: the same protocol at another address, with its own key ---

from llm import DEFAULT_MODELS, OPENROUTER_BASE_URL, OpenRouterClient, make_client  # noqa: E402


def test_openrouter_sends_to_openrouter_with_its_own_key(server, monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "sk-or-test")
    reply = OpenRouterClient().complete("write", model="anthropic/claude-haiku-5.5", temperature=0.2)
    assert reply == "the reply"
    [(method, url, headers, body)] = server
    assert url == f"{OPENROUTER_BASE_URL}/chat/completions"
    assert headers["authorization"] == "Bearer sk-or-test"
    assert body["model"] == "anthropic/claude-haiku-5.5" and body["temperature"] == 0.2
    assert body["messages"] == [{"role": "user", "content": "write"}]


def test_openrouter_never_sends_the_openai_key(server, monkeypatch):
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
    monkeypatch.setenv("OPENAI_API_KEY", "sk-openai-secret")
    with pytest.raises(RuntimeError, match="OPENROUTER_API_KEY"):
        OpenRouterClient().complete("p", model="openai/gpt-4o-mini", temperature=0)
    assert server == []  # nothing was sent anywhere


def test_openrouter_takes_a_key_given_directly(server, monkeypatch):
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
    OpenRouterClient(api_key="sk-or-direct").complete("p", model="m/x", temperature=0)
    assert server[0][2]["authorization"] == "Bearer sk-or-direct"


def test_a_provider_name_makes_the_right_client(monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "k")
    assert type(make_client("openai")) is OpenAIClient
    assert type(make_client("openrouter")) is OpenRouterClient
    with pytest.raises(ValueError, match="unknown provider"):
        make_client("nope")


def test_the_default_models():
    assert DEFAULT_MODELS == {"openai": "gpt-4", "openrouter": "openai/gpt-4o-mini"}
