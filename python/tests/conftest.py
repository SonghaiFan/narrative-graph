"""Shared test setup: no network, no real key, and a fake chat model."""
import json
import os
import re
import socket
from pathlib import Path
from types import SimpleNamespace

import pytest
from jsonschema import Draft202012Validator

# Set before any test module imports narrative_deducer. Its load_dotenv() never overrides an existing
# variable, so a real key sitting in python/.env cannot reach a test run.
os.environ["OPENAI_API_KEY"] = "sk-test-not-a-real-key"

PYTHON_DIR = Path(__file__).resolve().parent.parent
SCHEMA_DIR = PYTHON_DIR.parent / "schema"  # the JSON Schemas and the fixtures the web tests read too


def load_fixture(name):
    return json.loads((SCHEMA_DIR / "fixtures" / name).read_text())


def load_schema(name):
    return json.loads((SCHEMA_DIR / f"{name}.schema.json").read_text())


@pytest.fixture(autouse=True)
def isolated_from_the_outside_world(monkeypatch):
    def blocked(*args, **kwargs):
        raise RuntimeError("network access is blocked in tests")

    monkeypatch.setattr(socket.socket, "connect", blocked)
    monkeypatch.setattr(socket, "getaddrinfo", blocked)
    for name in ("OPENAI_API_BASE", "OPENAI_BASE_URL", "OPENAI_ORGANIZATION", "OPENAI_PROXY"):
        monkeypatch.delenv(name, raising=False)


@pytest.fixture(scope="session")
def context_a():
    return json.loads((PYTHON_DIR / "meta" / "narrative_context_a.json").read_text())


@pytest.fixture(scope="session")
def structure_of(context_a):
    return lambda name: next(s for s in context_a if s["name"] == name)


@pytest.fixture(scope="session")
def graph_validator():
    return Draft202012Validator(load_schema("graph"))


@pytest.fixture(scope="session")
def story_validator():
    return Draft202012Validator(load_schema("story"))


@pytest.fixture(scope="session")
def sample_alignment():
    return json.loads((PYTHON_DIR / "alignment_results.json").read_text())


@pytest.fixture
def fake_chat(monkeypatch):
    """Replace ChatOpenAI in narrative_deducer; record how it was built and what it was asked."""
    import narrative_deducer

    rec = SimpleNamespace(inits=[], prompts=[])

    class FakeChat:
        def __init__(self, **kwargs):
            rec.inits.append(kwargs)

        def invoke(self, prompt):
            rec.prompts.append(prompt)
            chapter_id = re.search(r"Chapter ID: (\S+)", prompt).group(1)
            topic = re.search(r"\n\s*Topic: (.+)", prompt).group(1).strip()
            reply = {
                "id": chapter_id,
                "title": f"Title {chapter_id}",
                "time_period": ["2023-01-01", "2023-02-01"],
                "Topic": [topic],
                "entity": ["Someone"],
                "content": f"Content of {chapter_id}",
            }
            return SimpleNamespace(content=json.dumps(reply))

    monkeypatch.setattr(narrative_deducer, "ChatOpenAI", FakeChat)
    return rec
