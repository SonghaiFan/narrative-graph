"""storytale.py end to end: align, write, save. Runs in a temp folder because all paths are relative."""
import json
import sys

import pytest

import storytale

STRUCTURES = [
    "Linear", "Arch", "Ladder", "ShortFork", "LongFork",
    "WideBranch", "WideMerge", "SharpMerge", "SharpBranch",
]


@pytest.mark.parametrize("name", STRUCTURES)
def test_one_structure_produces_alignment_story_and_log(tmp_path, monkeypatch, fake_chat, context_a, structure_of, name):
    monkeypatch.chdir(tmp_path)
    monkeypatch.setattr(sys, "stdout", sys.stdout)  # generate_story_files closes stdout; this restores it
    monkeypatch.setattr(storytale, "narrative_context", context_a, raising=False)  # what __main__ loads

    storytale.generate_story_files("Set_A2", name, seed=42)

    suffix = f"Set_A2_{name}_seed42.json"
    alignment = json.loads((tmp_path / "alignment" / f"alignment_{suffix}").read_text())
    story = json.loads((tmp_path / "stories" / f"story_{suffix}").read_text())
    log = (tmp_path / "logs" / f"log_{suffix}").read_text()

    nodes = structure_of(name)["nodes"]
    assert sorted(alignment) == sorted(nodes)
    assert [c["id"] for c in story["chapters"]] == list(alignment)
    assert f"Selected narrative structure: {name}" in log
    assert len(fake_chat.prompts) == len(nodes)


def test_an_unknown_structure_falls_back_to_the_first_one(tmp_path, monkeypatch, fake_chat, context_a):
    monkeypatch.chdir(tmp_path)
    monkeypatch.setattr(sys, "stdout", sys.stdout)
    monkeypatch.setattr(storytale, "narrative_context", context_a, raising=False)

    storytale.generate_story_files("Set_A2", "NoSuchStructure", seed=1)

    story = json.loads((tmp_path / "stories" / "story_Set_A2_NoSuchStructure_seed1.json").read_text())
    assert [c["id"] for c in story["chapters"]] == context_a[0]["nodes"]
