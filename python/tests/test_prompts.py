"""The chapter prompt now lives in prompts/chapter.md. It must read exactly as the prompt that used to be an f-string."""
import json

import pytest
from langchain_core.output_parsers import PydanticOutputParser

from conftest import PYTHON_DIR
from meta.types import Chapter
import prompts

GOLDEN = json.loads((PYTHON_DIR / "tests" / "golden" / "chapter_prompt.json").read_text())
FIELDS = dict(
    id="B2",
    time_period="2023-05-02 to 2023-09-01",
    topic="Ecological Crisis",
    theme_context="A city faces a crisis.",
    entity="Mayor Lina, Harbor Board",
    narrative_structure="The narrative structure is Arch.",
    format_instructions=PydanticOutputParser(pydantic_object=Chapter).get_format_instructions(),
)


def test_the_prompt_reads_exactly_as_it_did_in_the_code():
    # tests/golden/chapter_prompt.json was captured from the f-string version, before it was moved
    assert prompts.render("chapter", prev_content="Prev one.\n\nPrev two.", **FIELDS) == GOLDEN["with_parent"]
    assert prompts.render("chapter", prev_content="None", **FIELDS) == GOLDEN["without_parent"]


def test_values_are_not_parsed_as_placeholders():
    text = prompts.render("chapter", **{**FIELDS, "topic": "{curly} {topic}"}, prev_content="{id}")
    assert "Topic: {curly} {topic}" in text and "Previous context: {id}" in text


def test_a_missing_field_is_an_error_not_a_blank():
    with pytest.raises(KeyError):
        prompts.render("chapter", id="A1")
