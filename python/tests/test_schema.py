"""The JSON Schemas in schema/, checked against the shared fixtures and against what the pipeline produces."""
import pytest
from jsonschema import Draft202012Validator

from conftest import load_fixture, load_schema
from narrative_alignmenter import align_theme_entity
from narrative_deducer import create_story


def messages(validator, document):
    return [error.message for error in validator.iter_errors(document)]


@pytest.mark.parametrize("name", ["graph", "story"])
def test_the_schema_is_itself_valid(name):
    Draft202012Validator.check_schema(load_schema(name))


@pytest.mark.parametrize("entry", load_fixture("graphs.json")["graphs"], ids=lambda e: e["name"])
def test_valid_graphs_pass(entry, graph_validator):
    assert messages(graph_validator, entry["graph"]) == []


@pytest.mark.parametrize("entry", load_fixture("story.json")["stories"], ids=lambda e: e["name"])
def test_valid_stories_pass(entry, story_validator):
    assert messages(story_validator, entry["story"]) == []


@pytest.mark.parametrize("entry", load_fixture("invalid.json")["cases"], ids=lambda e: f"{e['schema']}: {e['name']}")
def test_invalid_documents_are_refused(entry, graph_validator, story_validator):
    validator = {"graph": graph_validator, "story": story_validator}[entry["schema"]]
    assert messages(validator, entry["data"]), "the schema accepted a document it must refuse"


@pytest.mark.parametrize("name", ["Arch", "WideMerge", "SharpBranch"])
def test_what_the_pipeline_writes_matches_the_story_schema(fake_chat, structure_of, story_validator, name):
    alignment = align_theme_entity(narrative_obj=structure_of(name), seed=42)
    story = create_story(alignment)
    assert messages(story_validator, story.dict()) == []
