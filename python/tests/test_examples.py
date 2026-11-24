"""The sample graphs in examples/ work with the Python side too."""
import json

from conftest import PYTHON_DIR
from ttng_align import align_graph, structure_of, unwrap

EXAMPLES = PYTHON_DIR.parent / "examples"
RED_HOOD = json.loads((EXAMPLES / "little-red-riding-hood.json").read_text())


def test_little_red_riding_hood_matches_the_file_schema(file_validator):
    assert list(file_validator.iter_errors(RED_HOOD)) == []


def test_little_red_riding_hood_aligns_with_a_period_alone():
    alignment = align_graph(unwrap(RED_HOOD), period=["2024-01-01", "2024-12-31"], seed=1)
    assert sorted(alignment, key=lambda i: int(i[1:])) == [f"n{i}" for i in range(1, 10)]
    # the wolf's lunge and Red's visit (n7, n8) both follow the wolf eating Grandma and the hunter's tracking
    assert sorted(alignment["n7"]["Prev"]) == ["n5", "n6"] and sorted(alignment["n8"]["Prev"]) == ["n5", "n6"]
    assert sorted(alignment["n9"]["Prev"]) == ["n7", "n8"]
    assert alignment["n1"]["Theme"] == "Journey" and alignment["n9"]["Theme"] == "Rescue"
    assert alignment["n1"]["Time"] == alignment["n2"]["Time"]  # same column
    # given entities stay; the last chapter has three
    assert sorted(alignment["n9"]["Entity"]) == ["Hunter", "Red", "Wolf"]


def test_little_red_riding_hood_already_has_its_text():
    # a finished demo to read in the editor, not a blank for ttng_story to fill
    assert all(node["content"] for node in RED_HOOD["graph"]["nodes"])


def test_little_red_riding_hood_declares_its_structure():
    assert structure_of(RED_HOOD) == {
        "organising": "Topic",
        "linking": "Entity",
        "predicate": "share",
        "priority": ["Journey", "Deception", "Rescue"],
    }


def test_little_red_riding_hood_in_the_entity_view_follows_the_track_priority():
    # thesis, Entity view: Hunter > Red > Wolf; each node takes the first of its entities in that order
    options = {"organising": "Entity", "priority": RED_HOOD["structure"]["priority"]["Entity"]}
    alignment = align_graph(unwrap(RED_HOOD), period=["2024-01-01", "2024-12-31"], seed=1, **options)
    assert {n: a["Theme"] for n, a in alignment.items()} == {
        "n1": "Red", "n2": "Wolf", "n3": "Red", "n4": "Red", "n5": "Wolf",
        "n6": "Hunter", "n7": "Red", "n8": "Red", "n9": "Hunter",
    }
