"""From the file the editor writes to the same file with text in it (step 4 of the refactor)."""
import copy
import json

import pytest

import ttng_story
from conftest import PYTHON_DIR, load_fixture
from ttng_align import align_graph, unwrap
from ttng_story import fill_content, write_story

FILES = {f["name"]: f["file"] for f in load_fixture("files.json")["files"]}
EXPORT = FILES["an export with text"]
CONTEXT = str(PYTHON_DIR / "meta" / "narrative_context_a.json")
PERIOD = ["2024-01-01", "2024-12-31"]


def test_a_file_from_the_editor_aligns_with_a_period_alone():
    # the editor's Time Period values are free text; the period gives every node real dates
    alignment = align_graph(unwrap(EXPORT), period=PERIOD, seed=1)
    assert list(alignment) == ["n1", "n2", "n3"]
    assert alignment["n1"]["Time"][0] == "2024-01-01" and alignment["n2"]["Time"][1] == "2024-12-31"
    assert alignment["n2"]["Prev"] == ["n1"] and alignment["n3"]["Prev"] == ["n1"]  # linked by the edge rule
    assert alignment["n1"]["Theme"] == "Tax" and sorted(alignment["n1"]["Entity"]) == ["Ana", "Ben"]


def test_without_any_dates_the_error_says_how_to_give_them():
    with pytest.raises(ValueError, match="--period"):
        align_graph(unwrap(EXPORT))


def test_a_bare_graph_and_a_wrapped_one_are_the_same_graph():
    assert unwrap(EXPORT) is EXPORT["graph"]
    assert unwrap(EXPORT["graph"]) is EXPORT["graph"]


def test_fill_content_sets_text_by_id_and_leaves_the_rest():
    original = copy.deepcopy(EXPORT)
    filled = fill_content(EXPORT, {"n1": "new one", "n3": "new three", "nope": "ignored"})
    nodes = {n["id"]: n for n in filled["graph"]["nodes"]}
    assert nodes["n1"]["content"] == "new one" and nodes["n3"]["content"] == "new three"
    assert nodes["n2"]["content"] == "Ben asked who pays."  # not mentioned, so untouched
    assert filled["layout"] == EXPORT["layout"] and filled["metadata"] == EXPORT["metadata"]
    assert EXPORT == original  # the input is not changed


def test_the_chapters_land_in_the_nodes_they_were_written_for(fake_chat):
    filled, story = write_story(EXPORT, period=PERIOD, seed=1)
    nodes = {n["id"]: n for n in filled["graph"]["nodes"]}
    assert [c.id for c in story.chapters] == ["n1", "n2", "n3"]
    assert {i: n["content"] for i, n in nodes.items()} == {i: f"Content of {i}" for i in nodes}
    assert fake_chat.calls == [{"model": "gpt-4", "temperature": 0.5}] * 3
    assert "Content of n1" in fake_chat.prompts[1]  # n2 follows n1


def test_a_reply_with_the_wrong_id_still_lands_in_the_right_node(fake_chat):
    class Careless(fake_chat.client):
        def complete(self, prompt, *, model, temperature):
            return super().complete(prompt, model=model, temperature=temperature).replace('"id": "n', '"id": "wrong-n')

    filled, story = write_story(EXPORT, period=PERIOD, seed=1, client=Careless())
    assert [c.id for c in story.chapters] == ["wrong-n1", "wrong-n2", "wrong-n3"]  # the model's ids are not trusted
    assert [n["content"] for n in filled["graph"]["nodes"]] == ["Content of n1", "Content of n2", "Content of n3"]


def test_the_result_is_still_a_valid_graph_file(fake_chat, file_validator):
    filled, _ = write_story(EXPORT, period=PERIOD, seed=1)
    assert list(file_validator.iter_errors(filled)) == []


def test_the_command_line_writes_a_file_the_editor_can_import(tmp_path, fake_chat, file_validator):
    (tmp_path / "in.json").write_text(json.dumps(EXPORT))
    ttng_story.main([str(tmp_path / "in.json"), "--period", *PERIOD, "--seed", "1",
                     "-o", str(tmp_path / "out.json"), "--story-out", str(tmp_path / "story.json")])
    out = json.loads((tmp_path / "out.json").read_text())
    assert list(file_validator.iter_errors(out)) == []
    assert all(n["content"] for n in out["graph"]["nodes"])
    assert [c["id"] for c in json.loads((tmp_path / "story.json").read_text())["chapters"]] == ["n1", "n2", "n3"]


def test_the_command_line_takes_a_context_and_a_structure(tmp_path, fake_chat, structure_of):
    from ttng_align import graph_from_structure

    graph, _ = graph_from_structure(structure_of("Arch"))
    (tmp_path / "in.json").write_text(json.dumps({"graph": graph}))
    ttng_story.main([str(tmp_path / "in.json"), "--context", CONTEXT, "--structure", "Arch", "--seed", "42",
                     "-o", str(tmp_path / "out.json")])
    nodes = json.loads((tmp_path / "out.json").read_text())["graph"]["nodes"]
    assert [n["id"] for n in nodes] == ["A1", "B2", "A3"] and all(n["content"] for n in nodes)
    assert len(fake_chat.prompts) == 3


def test_the_command_line_needs_somewhere_to_write(tmp_path):
    (tmp_path / "in.json").write_text(json.dumps(EXPORT))
    with pytest.raises(SystemExit):
        ttng_story.main([str(tmp_path / "in.json")])


def test_the_command_line_defaults_to_openai_and_gpt4(tmp_path, fake_chat):
    (tmp_path / "in.json").write_text(json.dumps(EXPORT))
    ttng_story.main([str(tmp_path / "in.json"), "--period", *PERIOD, "-o", str(tmp_path / "out.json")])
    assert fake_chat.providers == ["openai"]
    assert {c["model"] for c in fake_chat.calls} == {"gpt-4"}


def test_the_command_line_can_use_openrouter_and_any_model(tmp_path, fake_chat):
    (tmp_path / "in.json").write_text(json.dumps(EXPORT))
    ttng_story.main([str(tmp_path / "in.json"), "--period", *PERIOD, "-o", str(tmp_path / "out.json"),
                     "--provider", "openrouter", "--model", "google/gemini-2.5-flash"])
    assert fake_chat.providers == ["openrouter"]
    assert {c["model"] for c in fake_chat.calls} == {"google/gemini-2.5-flash"}


def test_openrouter_without_a_model_gets_its_default(tmp_path, fake_chat):
    (tmp_path / "in.json").write_text(json.dumps(EXPORT))
    ttng_story.main([str(tmp_path / "in.json"), "--period", *PERIOD, "-o", str(tmp_path / "out.json"),
                     "--provider", "openrouter"])
    assert {c["model"] for c in fake_chat.calls} == {"openai/gpt-4o-mini"}


def test_an_unknown_provider_is_refused(tmp_path):
    (tmp_path / "in.json").write_text(json.dumps(EXPORT))
    with pytest.raises(SystemExit):
        ttng_story.main([str(tmp_path / "in.json"), "-o", str(tmp_path / "o.json"), "--provider", "nope"])
