"""The real ChatOpenAI -> openai SDK path, with only the HTTP layer faked.

This is the test that notices a silent model downgrade: through langchain.llms.OpenAI the request used to
go out as gpt-3.5-turbo with a stray model_name field, and on a newer SDK it failed on the first call.
"""
import json

import pytest

httpx2 = pytest.importorskip("httpx2", reason="the pinned openai 3.x SDK sends its requests through httpx2")

import narrative_deducer  # noqa: E402


def _chat_completion(content, model):
    return {
        "id": "chatcmpl-test",
        "object": "chat.completion",
        "created": 0,
        "model": model,
        "choices": [{"index": 0, "finish_reason": "stop", "message": {"role": "assistant", "content": content}}],
        "usage": {"prompt_tokens": 1, "completion_tokens": 1, "total_tokens": 2},
    }


def test_make_chapter_sends_a_gpt4_chat_completion(monkeypatch):
    sent = []

    def fake_send(self, request, **kwargs):
        body = json.loads(request.content)
        sent.append((request.method, str(request.url), body))
        chapter = {
            "id": "A1", "title": "A title", "time_period": ["2023-01-01", "2023-05-02"],
            "Topic": ["Economic Boom"], "entity": ["Mayor Lina"], "content": "A short chapter.",
        }
        return httpx2.Response(200, request=request, json=_chat_completion(json.dumps(chapter), body["model"]))

    monkeypatch.setattr(httpx2.Client, "send", fake_send)

    chapter = narrative_deducer.make_chapter(
        id="A1",
        topic="Economic Boom",
        theme_context="A city booms.",
        entity=["Mayor Lina"],
        time_period=["2023-01-01", "2023-05-02"],
        narrative_structure="Arch",
        prev_content="",
        temperature=0.5,
    )

    assert chapter.id == "A1"
    [(method, url, body)] = sent
    assert method == "POST"
    assert url.endswith("api.openai.com/v1/chat/completions")
    assert body["model"] == "gpt-4"
    assert body["temperature"] == 0.5
    assert set(body) <= {"messages", "model", "n", "stream", "temperature"}, "stray request fields"
    assert [m["role"] for m in body["messages"]] == ["user"]
    assert "Topic: Economic Boom" in body["messages"][0]["content"]
