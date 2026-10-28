"""Aligning a TTNG graph (step 2 of the refactor): the same alignment the old aligner gives, from a graph."""
import json
from pathlib import Path

import pytest

import ttng_align
from narrative_alignmenter import align_theme_entity
from narrative_deducer import create_story
from ttng_align import align_graph, graph_from_structure
from ttng_edges import derive_edges

STRUCTURES = [
    "Linear", "Arch", "Ladder", "ShortFork", "LongFork",
    "WideBranch", "WideMerge", "SharpMerge", "SharpBranch",
]
SEEDS = [1, 42, 777]
PYTHON_DIR = Path(__file__).resolve().parent.parent
DATES = {"Time Period": ["2024-01-01", "2024-01-31"]}
PAIRS = [(name, seed) for name in STRUCTURES for seed in SEEDS]


def comparable(alignment):
    # list(set(...)) leaves the entities in set order, which is not a property worth asserting
    return {n: {**d, "Entity": sorted(d["Entity"])} for n, d in alignment.items()}


def node(id, time, track, topic="T", **attributes):
    return {"id": id, "time": time, "track": track, "attributes": {"Topic": [topic], **attributes}}


POOL = [{
    "symbol": "X", "theme": "T", "description": "About T.", "time": ["2024-01-01", "2024-03-31"],
    "entities": [{"name": n, "type": "people"} for n in "abcdefg"],
}]


@pytest.mark.parametrize("name,seed", PAIRS, ids=lambda p: str(p))
def test_a_graph_of_a_structure_aligns_exactly_like_the_structure(structure_of, name, seed):
    structure = structure_of(name)
    graph, context = graph_from_structure(structure)
    expected = align_theme_entity(narrative_obj=structure, seed=seed)
    actual = align_graph(graph, context=context, structure=structure, seed=seed)
    assert list(actual) == list(expected)  # same processing order
    assert comparable(actual) == comparable(expected)


@pytest.mark.parametrize("name", STRUCTURES)
def test_the_graph_of_a_structure_fits_the_graph_schema(structure_of, graph_validator, name):
    graph, _ = graph_from_structure(structure_of(name))
    assert list(graph_validator.iter_errors(graph)) == []


@pytest.mark.parametrize("name", STRUCTURES)
def test_the_graph_of_a_structure_is_laid_out_on_the_grid(structure_of, name):
    structure = structure_of(name)
    graph, _ = graph_from_structure(structure)
    for n in graph["nodes"]:
        assert n["time"] == int(n["id"][-1]) - 1
    # edges only join neighbouring columns and rows, so the editor's rule could draw them
    by_id = {n["id"]: n for n in graph["nodes"]}
    for e in graph["edges"]:
        s, t = by_id[e["sourceId"]], by_id[e["targetId"]]
        assert t["time"] == s["time"] + 1 and abs(t["track"] - s["track"]) <= 1


def test_the_same_seed_gives_the_same_alignment():
    graph = {"nodes": [node("a", 0, 0), node("b", 1, 0)]}
    first = align_graph(graph, context=POOL, seed=5)
    assert comparable(align_graph(graph, context=POOL, seed=5)) == comparable(first)


def test_entities_the_graph_carries_are_kept():
    graph = {"nodes": [node("a", 0, 0, Entity=["Ana", "Ben"], **DATES), node("b", 1, 0, Entity=["Ben", "Cy"], **DATES)]}
    result = align_graph(graph, seed=1)  # no context needed when the graph says everything
    assert sorted(result["a"]["Entity"]) == ["Ana", "Ben"]
    assert sorted(result["b"]["Entity"]) == ["Ben", "Cy"]  # already shares Ben, so nothing is added


def test_a_node_sharing_nothing_with_its_parent_gets_one_parent_entity():
    graph = {
        "nodes": [node("a", 0, 0, Entity=["Ana"], **DATES), node("b", 1, 0, Entity=["Cy"], **DATES)],
        "edges": [{"id": "edge-a-b", "sourceId": "a", "targetId": "b"}],
    }
    assert sorted(align_graph(graph, seed=1, context=None)["b"]["Entity"]) == ["Ana", "Cy"]


def test_the_entity_added_for_a_parent_is_drawn_from_all_of_the_parents_entities():
    parent = ["p1", "p2", "p3", "p4", "p5"]
    graph = {
        "nodes": [node("a", 0, 0, Entity=parent, **DATES), node("b", 1, 0, Entity=["x"], **DATES)],
        "edges": [{"id": "edge-a-b", "sourceId": "a", "targetId": "b"}],
    }
    added = set()
    for seed in range(1, 40):
        extra = set(align_graph(graph, seed=seed)["b"]["Entity"]) - {"x"}
        assert len(extra) == 1 and extra <= set(parent)
        added |= extra
    assert len(added) > 1


def test_a_node_without_entities_is_sampled_from_its_topic_and_shares_with_the_parent():
    graph = {
        "nodes": [node("a", 0, 0), node("b", 1, 0, Entity=["zed"])],
        "edges": [{"id": "edge-a-b", "sourceId": "a", "targetId": "b"}],
    }
    result = align_graph(graph, context=POOL, seed=3)
    pool = {e["name"] for e in POOL[0]["entities"]}
    assert 1 <= len(result["a"]["Entity"]) <= 4 and set(result["a"]["Entity"]) <= pool
    assert set(result["a"]["Entity"]) & set(result["b"]["Entity"])
    assert "zed" in result["b"]["Entity"]


def test_parents_come_from_the_edge_rule_when_the_graph_declares_none():
    nodes = [node("a", 0, 0, Entity=["Ana"], **DATES), node("b", 1, 1, Entity=["Ana"], **DATES), node("c", 1, 5, Entity=["Ana"], **DATES)]
    result = align_graph({"nodes": nodes}, seed=1)
    expected = derive_edges(nodes, "Entity", 2)
    assert [e["sourceId"] for e in expected] == ["a"]  # the rule links a to b only: c is too far away
    assert result["b"]["Prev"] == ["a"] and result["c"]["Prev"] == []


def test_declared_edges_beat_the_edge_rule():
    nodes = [node("a", 0, 0, Entity=["Ana"], **DATES), node("b", 1, 0, Entity=["Ana"], **DATES)]
    graph = {"nodes": nodes, "edges": []}
    assert align_graph(graph, seed=1)["b"]["Prev"] == []


def test_time_comes_from_the_node_when_it_has_two_dates():
    graph = {"nodes": [node("a", 0, 0, Entity=["Ana"], **{"Time Period": ["2024-05-01", "2024-05-31"]})]}
    assert align_graph(graph)["a"]["Time"] == ["2024-05-01", "2024-05-31"]


def test_time_otherwise_is_a_slice_of_the_topic_range_per_column():
    graph = {"nodes": [node(f"n{i}", i, 0, Entity=["Ana"]) for i in range(3)]}
    times = [align_graph(graph, context=POOL)[f"n{i}"]["Time"] for i in range(3)]
    assert times[0][0] == "2024-01-01" and times[-1][1] == "2024-03-31"
    assert all(a[1] <= b[0] or a[1] == b[0] for a, b in zip(times, times[1:]))


def test_the_theme_and_its_description_come_from_the_topic():
    graph = {"nodes": [node("a", 0, 0, Entity=["Ana"])]}
    assert align_graph(graph, context=POOL)["a"]["ThemeDescription"] == "About T."
    assert align_graph({"nodes": [node("a", 0, 0, topic="Tax", Entity=["Ana"], **{"Time Period": ["2024-01-01", "2024-01-02"]})]})["a"]["ThemeDescription"] == "Tax"


def test_off_grid_nodes_are_left_out():
    graph = {"nodes": [node("a", 0, 0, Entity=["Ana"]), node("gone", 0, -1, Entity=["Ana"])]}
    assert list(align_graph(graph, context=POOL)) == ["a"]


def test_an_empty_graph_aligns_to_nothing():
    assert align_graph({"nodes": []}) == {}


@pytest.mark.parametrize("graph,context,message", [
    ({"nodes": [node("a", 0, 0), node("a", 1, 0)]}, POOL, "unique"),
    ({"nodes": [node("a", 0, 0)]}, None, "no Entity"),
    ({"nodes": [node("a", 0, 0, topic="Other")]}, POOL, "no pool"),
    ({"nodes": [node("a", 0, 0, Entity=["Ana"])]}, None, "Time Period"),
    ({"nodes": [{"id": "a", "time": 0, "track": 0, "attributes": {"Entity": ["Ana"]}}]}, POOL, "exactly one Topic"),
    ({"nodes": [{"id": "a", "time": 0, "track": 0, "attributes": {"Topic": ["A", "B"], "Entity": ["Ana"]}}]}, POOL, "exactly one Topic"),
    ({"nodes": [node("a", 0, 0, Entity=["Ana"])], "edges": [{"id": "e", "sourceId": "a", "targetId": "zz"}]}, POOL, "not a node"),
    ({"nodes": [node("a", 0, 0, Entity=["Ana"]), node("b", 1, 0, Entity=["Ana"])],
      "edges": [{"id": "1", "sourceId": "a", "targetId": "b"}, {"id": "2", "sourceId": "b", "targetId": "a"}]}, POOL, "cycle"),
    ({"nodes": [node("a", 0, 0, Entity=["Ana"], **{"Time Period": ["Jan 2024", "Feb 2024"]})]}, None, "does not match"),
])
def test_bad_input_is_refused_with_a_reason(graph, context, message):
    with pytest.raises(ValueError, match=message):
        align_graph(graph, context=context)


def test_the_writer_takes_an_aligned_graph(fake_chat, structure_of):
    structure = structure_of("WideMerge")
    graph, context = graph_from_structure(structure)
    alignment = align_graph(graph, context=context, structure=structure, seed=42)
    story = create_story(alignment)
    assert [c.id for c in story.chapters] == list(alignment)
    merge_prompt = fake_chat.prompts[list(alignment).index("B2")]
    assert "Content of A1" in merge_prompt and "Content of C1" in merge_prompt


def test_the_command_line_reads_a_graph_and_writes_an_alignment(tmp_path, capsys, structure_of):
    structure = structure_of("Arch")
    graph, _ = graph_from_structure(structure)
    (tmp_path / "graph.json").write_text(json.dumps({"graph": graph}))  # the wrapped form the editor accepts
    context = str(PYTHON_DIR / "meta" / "narrative_context_a.json")

    ttng_align.main([str(tmp_path / "graph.json"), "--context", context, "--structure", "Arch",
                     "--seed", "42", "-o", str(tmp_path / "out.json")])
    written = json.loads((tmp_path / "out.json").read_text())
    assert comparable(written) == comparable(align_theme_entity(narrative_obj=structure, seed=42))

    ttng_align.main([str(tmp_path / "graph.json"), "--context", context, "--structure", "Arch", "--seed", "42"])
    assert json.loads(capsys.readouterr().out) == written


def test_the_command_line_names_the_structures_when_asked_for_a_missing_one(tmp_path, capsys):
    (tmp_path / "graph.json").write_text(json.dumps({"nodes": []}))
    with pytest.raises(SystemExit):
        ttng_align.main([str(tmp_path / "graph.json"), "--context",
                         str(PYTHON_DIR / "meta" / "narrative_context_a.json"), "--structure", "Nope"])
    assert "Arch" in capsys.readouterr().err
