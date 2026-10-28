"""The edge rule in Python, held to the same fixtures as the web implementation.

apps/web/tests/computeEdges.test.ts reads the very same files from schema/fixtures/. The fixtures are the
reference: changing the rule here fails these tests first, and updating the fixtures to match then fails
the web tests until the web follows.
"""
import copy

import pytest

from conftest import load_fixture
from ttng_edges import derive_edges

FILES = ["edges.json", "edges.random.json"]
CASES = [pytest.param(case, id=f"{file}: {case['name']}") for file in FILES for case in load_fixture(file)["cases"]]


def derive(case):
    return derive_edges(case["nodes"], case["linkingAttribute"], case["maxTime"])


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
