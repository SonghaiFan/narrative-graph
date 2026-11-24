"""The edge rule in Python, held to the same fixtures as the web implementation.

apps/web/tests/computeEdges.test.ts reads the very same files from schema/fixtures/. The fixtures are the
reference: changing the rule here fails these tests first, and updating the fixtures to match then fails
the web tests until the web follows.
"""
import copy

import pytest

from conftest import load_fixture
from ttng_edges import PREDICATES, derive_edges

FILES = ["edges.json", "edges.random.json"]
CASES = [pytest.param(case, id=f"{file}: {case['name']}") for file in FILES for case in load_fixture(file)["cases"]]


def derive(case):
    return derive_edges(case["nodes"], case["linkingAttribute"], case["maxTime"], case.get("predicate", "share"))


@pytest.mark.parametrize("case", CASES)
def test_edges_match_the_fixture_in_content_and_order(case):
    edges = derive(case)
    assert [[e["sourceId"], e["targetId"]] for e in edges] == case["expectedEdges"]
    assert [e["id"] for e in edges] == [f"edge-{source}-{target}" for source, target in case["expectedEdges"]]


@pytest.mark.parametrize("case", CASES)
def test_the_input_nodes_are_left_alone(case):
    before = copy.deepcopy(case["nodes"])
    derive(case)
    assert case["nodes"] == before


@pytest.mark.parametrize("case", CASES)
def test_a_graph_with_its_derived_edges_is_valid(case, graph_validator):
    errors = list(graph_validator.iter_errors({"nodes": case["nodes"], "edges": derive(case)}))
    assert not errors, errors[0].message


def test_the_fixture_files_are_not_hollow():
    hand = load_fixture("edges.json")["cases"]
    random = load_fixture("edges.random.json")["cases"]
    assert len(hand) >= 20
    assert any(c["expectedEdges"] for c in hand) and any(not c["expectedEdges"] for c in hand)
    assert sum(1 for c in random if c["expectedEdges"]) >= 20
    assert sum(1 for c in random if not c["expectedEdges"]) >= 3


@pytest.mark.parametrize("case", CASES)
def test_the_tracks_play_no_part(case):
    # Move every node on the grid to another track, in a way that changes who is next to whom. The edges stay.
    moved = [{**n, "track": n["track"] + 7 * (i % 3) if n["track"] >= 0 else n["track"]} for i, n in enumerate(case["nodes"])]
    assert derive_edges(moved, case["linkingAttribute"], case["maxTime"], case.get("predicate", "share")) == derive(case)


def test_a_node_off_the_grid_still_links_nothing_whatever_the_tracks():
    nodes = [
        {"id": "a", "time": 0, "track": -1, "attributes": {"Entity": ["Ana"]}},
        {"id": "b", "time": 1, "track": 0, "attributes": {"Entity": ["Ana"]}},
    ]
    assert derive_edges(nodes, "Entity", 5) == []


@pytest.mark.parametrize("source,target,share,equal", [
    ([], [], False, False),
    (["a"], [], False, False),
    (["a"], ["a"], True, True),
    (["a", "b"], ["b"], True, False),
    (["a", "b"], ["b", "a"], True, True),
    (["a", "a"], ["a"], True, True),
    (["a"], ["A"], False, False),
])
def test_the_predicates_on_their_own(source, target, share, equal):
    assert PREDICATES["share"](source, target) is share
    assert PREDICATES["equal"](source, target) is equal


def test_a_predicate_may_be_a_function():
    nodes = [{"id": "a", "time": 0, "track": 0, "attributes": {"Entity": ["x"]}},
             {"id": "b", "time": 1, "track": 0, "attributes": {"Entity": ["y"]}}]
    assert derive_edges(nodes, "Entity", 5, lambda source, target: source != target)[0]["id"] == "edge-a-b"
    assert derive_edges(nodes, "Entity", 5, lambda source, target: False) == []


def test_an_unknown_predicate_is_refused_by_name():
    with pytest.raises(ValueError, match="unknown link predicate 'similar'.*share, equal"):
        derive_edges([], "Entity", 5, "similar")
