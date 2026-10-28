"""Properties of the rule-based aligner (step 2 of the pipeline).

These assert what must hold for any seed instead of freezing one random draw: random.sample and
random.choice sequences are not guaranteed to stay the same across Python versions.
"""
from datetime import date

import pytest

from narrative_alignmenter import align_theme_entity

STRUCTURES = [
    "Linear", "Arch", "Ladder", "ShortFork", "LongFork",
    "WideBranch", "WideMerge", "SharpMerge", "SharpBranch",
]
SEEDS = [1, 42, 777]


@pytest.fixture(
    params=[(name, seed) for name in STRUCTURES for seed in SEEDS],
    ids=lambda p: f"{p[0]}-seed{p[1]}",
)
def aligned(request, structure_of):
    name, seed = request.param
    structure = structure_of(name)
    return structure, align_theme_entity(narrative_obj=structure, seed=seed)


def test_context_file_holds_the_nine_structures(context_a):
    assert [s["name"] for s in context_a] == STRUCTURES


def test_every_node_is_aligned_once(aligned):
    structure, alignment = aligned
    assert sorted(alignment) == sorted(structure["nodes"])


def test_parents_come_before_children(aligned):
    _, alignment = aligned
    position = {node: i for i, node in enumerate(alignment)}
    for node, details in alignment.items():
        assert all(position[parent] < position[node] for parent in details["Prev"])


def test_prev_matches_the_edges(aligned):
    structure, alignment = aligned
    for node, details in alignment.items():
        assert details["Prev"] == [e["from"] for e in structure["edges"] if e["to"] == node]


def test_theme_comes_from_the_node_symbol(aligned):
    structure, alignment = aligned
    themes = {c["symbol"]: c for c in structure["context"]}
    for node, details in alignment.items():
        assert details["Theme"] == themes[node[0]]["theme"]
        assert details["ThemeDescription"] == themes[node[0]]["description"]


def test_entities_are_few_unique_and_linked_to_a_parent(aligned):
    structure, alignment = aligned
    themes = {c["symbol"]: {e["name"] for e in c["entities"]} for c in structure["context"]}
    for node, details in alignment.items():
        entities = details["Entity"]
        assert 1 <= len(entities) <= 5
        assert len(set(entities)) == len(entities)
        inherited = {e for parent in details["Prev"] for e in alignment[parent]["Entity"]}
        assert set(entities) <= themes[node[0]] | inherited
        if details["Prev"]:
            assert set(entities) & inherited, f"{node} shares nothing with its parents"


def test_time_slices_stay_inside_the_theme_range_and_advance(aligned):
    structure, alignment = aligned
    ranges = {c["symbol"]: [date.fromisoformat(d) for d in c["time"]] for c in structure["context"]}
    by_symbol = {}
    for node, details in alignment.items():
        start, end = (date.fromisoformat(d) for d in details["Time"])
        low, high = ranges[node[0]]
        assert low <= start <= end <= high
        by_symbol.setdefault(node[0], []).append((int(node[1:]), start))
    for chapters in by_symbol.values():
        starts = [start for _, start in sorted(chapters)]
        assert starts == sorted(starts)


def test_instruction_names_the_structure_and_the_node(aligned):
    structure, alignment = aligned
    for node, details in alignment.items():
        assert structure["name"] in details["StuctureInstruction"]  # key is misspelled in the data
        assert node in details["StuctureInstruction"]


@pytest.mark.parametrize("name", STRUCTURES)
def test_same_seed_gives_the_same_alignment(structure_of, name):
    structure = structure_of(name)
    assert align_theme_entity(narrative_obj=structure, seed=5) == align_theme_entity(
        narrative_obj=structure, seed=5
    )
