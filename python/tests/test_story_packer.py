"""story_packer.py runs on import and moves files, so pin down what it does before anyone touches it."""
import json
import runpy

from conftest import PYTHON_DIR


def test_packer_bundles_the_stories_then_moves_everything_into_arc(tmp_path, monkeypatch):
    for folder in ("stories", "logs", "alignment"):
        (tmp_path / folder).mkdir()
    (tmp_path / "stories" / "story_Set_A2_Arch_seed7.json").write_text(json.dumps({"chapters": [{"id": "A1"}]}))
    (tmp_path / "stories" / "story_Muddle_Puddle_Linear_seed9.json").write_text(json.dumps({"chapters": []}))
    (tmp_path / "logs" / "log_Set_A2_Arch_seed7.json").write_text("log")
    (tmp_path / "alignment" / "alignment_Set_A2_Arch_seed7.json").write_text("{}")
    monkeypatch.chdir(tmp_path)

    runpy.run_path(str(PYTHON_DIR / "story_packer.py"), run_name="__main__")

    combined = json.loads((tmp_path / "stories" / "arc" / "combined_stories.json").read_text())
    assert {(s["section"], s["structure"], s["seed"]) for s in combined} == {
        ("Set_A2", "Arch", 7),
        ("Muddle_Puddle", "Linear", 9),
    }
    for folder in ("stories", "logs", "alignment"):
        assert [p.name for p in (tmp_path / folder).iterdir()] == ["arc"]
    assert (tmp_path / "logs" / "arc" / "log_Set_A2_Arch_seed7.json").exists()
    assert (tmp_path / "alignment" / "arc" / "alignment_Set_A2_Arch_seed7.json").exists()
