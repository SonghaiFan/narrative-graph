"""Plugins that turn text into attributes (extractors.py), and the graph built from them (ttng_extract.py)."""
import json
from types import SimpleNamespace

import pytest

import extractors
import ttng_extract
from conftest import PYTHON_DIR
from extractors import ExtractorError, LexiconExtractor, LLMExtractor, build_extractor, check_distinct, run, run_all
from ttng_align import align_graph, structure_of, unwrap
from ttng_edges import derive_edges

RED_HOOD = json.loads((PYTHON_DIR.parent / "examples" / "little-red-riding-hood.json").read_text())


class Stub:
    def __init__(self, name, attributes, result):
        self.name, self.attributes, self._result = name, tuple(attributes), result

    def extract(self, text):
        return self._result


class FakeModel:
    """Answers each prompt from a queue and keeps what it was asked."""

    def __init__(self, *replies):
        self.replies, self.calls = list(replies), []

    def complete(self, prompt, *, model, temperature):
        self.calls.append({"prompt": prompt, "model": model, "temperature": temperature})
        return self.replies.pop(0)


# --- the contract ---

def test_an_attribute_the_extractor_does_not_declare_is_refused():
    with pytest.raises(ExtractorError, match="does not declare"):
        run(Stub("s", ["Tone"], {"Tone": ["calm"], "Secret": ["x"]}), "text")


@pytest.mark.parametrize("answer", [["calm"], {"Tone": "calm"}, {"Tone": [1]}, {"Tone": None}, "calm"])
def test_an_answer_that_is_not_attributes_of_strings_is_refused(answer):
    with pytest.raises(ExtractorError):
        run(Stub("s", ["Tone"], answer), "text")


def test_values_are_cleaned_up_and_an_attribute_without_values_is_left_out():
    result = run(Stub("s", ["Tone", "Place"], {"Tone": ["calm", " ", "calm", "dry"], "Place": []}), "text")
    assert result == {"Tone": ["calm", "dry"]}


def test_two_extractors_may_not_give_the_same_attribute():
    with pytest.raises(ExtractorError, match="both"):
        check_distinct([Stub("a", ["Tone"], {}), Stub("b", ["Tone"], {})])


def test_several_extractors_give_one_set_of_attributes():
    result = run_all([Stub("a", ["Tone"], {"Tone": ["calm"]}), Stub("b", ["Place"], {"Place": ["Oslo"]})], "t")
    assert result == {"Tone": ["calm"], "Place": ["Oslo"]}


# --- the lexicon ---

LEXICON = {"Entity": {"Red": ["Red", "Little Red Riding Hood"], "Wolf": [], "Grandma": ["Grandmother", "Grandma"]}}


def test_the_lexicon_finds_values_in_the_order_they_appear():
    text = "The Wolf watches Red. Later Grandma waves."
    assert run(LexiconExtractor(LEXICON), text) == {"Entity": ["Wolf", "Red", "Grandma"]}


def test_the_lexicon_needs_whole_words_and_ignores_case():
    extractor = LexiconExtractor(LEXICON)
    assert run(extractor, "He was Reduced to tears; the wolves howled.") == {}
    assert run(extractor, "the WOLF and little red riding hood") == {"Entity": ["Wolf", "Red"]}


def test_a_value_with_several_trigger_words_is_found_once_at_the_earliest():
    assert run(LexiconExtractor(LEXICON), "Grandmother and Grandma.") == {"Entity": ["Grandma"]}


def test_the_lexicon_on_the_thesis_example_agrees_with_the_table_but_for_one_node():
    # The entities of the thesis table say who acts. A word list finds who is named. They differ at v2:
    # "The Wolf watches Red ..." names Red too, which the table does not list.
    lexicon = {"Entity": {name: [] for name in ("Red", "Wolf", "Hunter")}}
    extractor = LexiconExtractor(lexicon)
    differences = {}
    for node in RED_HOOD["graph"]["nodes"]:
        found = set(run(extractor, node["content"]).get("Entity", []))
        if found != set(node["attributes"]["Entity"]):
            differences[node["label"]] = sorted(found)
    assert differences == {"v2": ["Red", "Wolf"]}


# --- the language model ---

SPEC = {
    "Entity": {"description": "who or what the passage is about"},
    "Topic": {"description": "the theme", "single": True},
    "Polarity": {"values": ["negative", "neutral", "positive"], "single": True},
}


def llm(*replies):
    model = FakeModel(*replies)
    return LLMExtractor(SPEC, model, "some/model"), model


def test_the_prompt_carries_the_text_and_what_is_asked_for():
    extractor, model = llm('{"Entity": ["Ana"], "Topic": ["Tax"], "Polarity": ["positive"]}')
    run(extractor, "Ana cut the tax {twice}.")
    prompt = model.calls[0]["prompt"]
    assert "Ana cut the tax {twice}." in prompt
    assert "- Entity: who or what the passage is about; any number of values" in prompt
    assert "- Polarity: choose from: negative, neutral, positive; exactly one value" in prompt
    assert model.calls[0]["model"] == "some/model" and model.calls[0]["temperature"] == 0.0


def test_the_reply_may_be_wrapped_in_a_fence_or_a_sentence():
    reply = 'Here you go:\n```json\n{"Entity": ["Ana"], "Topic": "Tax", "Polarity": ["Positive"]}\n```'
    extractor, _ = llm(reply)
    assert run(extractor, "t") == {"Entity": ["Ana"], "Topic": ["Tax"], "Polarity": ["positive"]}


def test_an_attribute_the_reply_leaves_out_is_left_out():
    extractor, _ = llm('{"Entity": ["Ana"]}')
    assert run(extractor, "t") == {"Entity": ["Ana"]}


@pytest.mark.parametrize("reply,message", [
    ("no json here", "no JSON object"),
    ('{"Entity": ["Ana"', "no JSON object"),
    ('{"Entity": ["Ana",]}', "not valid JSON"),
    ('["Ana"]', "no JSON object"),
    ('{"Entity": 3}', "not a list of strings"),
    ('{"Polarity": ["happy"]}', "must be one of"),
    ('{"Topic": ["Tax", "Budget"]}', "must have one value"),
])
def test_a_reply_that_breaks_the_spec_is_an_error_not_a_guess(reply, message):
    extractor, _ = llm(reply)
    with pytest.raises(ExtractorError, match=message):
        run(extractor, "t")


# --- finding a plugin ---

def test_the_built_in_names_are_known():
    assert {"lexicon", "llm"} <= set(extractors.available())


def test_a_plugin_is_loaded_by_module_and_attribute_with_its_options():
    extractor = build_extractor("plugin_example:make", {"loud": "shouting"})
    assert run(extractor, "Stop!") == {"Tone": ["shouting"]}
    assert run(extractor, "Stop.") == {"Tone": ["calm"]}


def test_a_plugin_is_loaded_from_an_installed_entry_point(monkeypatch):
    import plugin_example

    entry = SimpleNamespace(name="tone", load=lambda: plugin_example.make)
    monkeypatch.setattr(extractors.metadata, "entry_points", lambda group: [entry] if group == "ttng.extractors" else [])
    assert "tone" in extractors.available()
    assert build_extractor("tone").attributes == ("Tone",)


@pytest.mark.parametrize("spec,options,message", [
    ("nonesuch", {}, "no extractor called 'nonesuch'. Available: lexicon, llm"),
    ("no_such_module:make", {}, "cannot load the plugin"),
    ("plugin_example:no_such_factory", {}, "cannot load the plugin"),
    ("plugin_example:make", {"colour": "red"}, "cannot build"),
    ("plugin_example:not_an_extractor", {}, "is not an extractor"),
    ("lexicon", {}, "needs `lexicon="),
    ("llm", {}, "needs `spec="),
])
def test_a_plugin_that_cannot_be_built_says_why(spec, options, message):
    with pytest.raises(ExtractorError, match=message):
        build_extractor(spec, options)


def test_a_plugin_that_gives_more_than_it_declared_is_stopped_when_it_runs():
    extractor = build_extractor("plugin_example:overreaching")
    with pytest.raises(ExtractorError, match="does not declare"):
        run(extractor, "t")


def test_the_client_goes_to_the_llm_and_to_no_one_else():
    model = FakeModel()
    llm_extractor = build_extractor("llm", {"spec": SPEC, "model": "m"}, client=model)
    assert llm_extractor.client is model and llm_extractor.model == "m"
    # a factory that is not the llm does not take a client, so passing it on would be an error
    assert build_extractor("plugin_example:make", client=model).attributes == ("Tone",)
    assert build_extractor("lexicon", {"lexicon": WORDS}, client=model).attributes == ("Topic", "Entity")


def test_the_llm_cannot_be_given_an_unknown_provider():
    with pytest.raises(ExtractorError, match="unknown provider"):
        build_extractor("llm", {"spec": SPEC, "provider": "nonesuch"})


# --- the graph ---

WORDS = {"Topic": {"Journey": ["walks"], "Deception": ["lies"], "Rescue": ["saves"]},
         "Entity": {"Red": [], "Wolf": [], "Hunter": []}}
STORY = [
    "Red walks to the cottage.",
    "The Wolf walks behind Red.",
    "The Wolf lies to Red.",
    "The Wolf lies, and Red believes.",
    "The Hunter saves Red from the Wolf.",
]


def graph_of(passages, **options):
    return ttng_extract.extract_graph(ttng_extract.read_passages(passages), [LexiconExtractor(WORDS)], **options)


def test_each_passage_becomes_a_node_with_its_text_attributes_and_column(file_validator):
    document = graph_of(STORY)
    assert list(file_validator.iter_errors(document)) == []
    nodes = document["graph"]["nodes"]
    assert [n["id"] for n in nodes] == ["n1", "n2", "n3", "n4", "n5"]
    assert [n["time"] for n in nodes] == [0, 1, 2, 3, 4]
    assert nodes[1]["content"] == "The Wolf walks behind Red."
    assert nodes[1]["attributes"] == {"Topic": ["Journey"], "Entity": ["Wolf", "Red"]}
    assert document["layout"] == {"rows": 3, "cols": 5}


def test_tracks_follow_the_order_in_which_values_first_appear_unless_a_priority_is_given():
    first_seen = graph_of(STORY)
    assert [n["track"] for n in first_seen["graph"]["nodes"]] == [0, 0, 1, 1, 2]
    assert first_seen["structure"] == {
        "organising": "Topic", "linking": "Entity", "priority": {"Topic": ["Journey", "Deception", "Rescue"]}}
    chosen = graph_of(STORY, priority=["Rescue", "Deception", "Journey"])
    assert [n["track"] for n in chosen["graph"]["nodes"]] == [2, 2, 1, 1, 0]


def test_a_node_with_several_organising_values_takes_the_one_with_priority():
    document = graph_of(["Red walks and the Wolf lies."], priority=["Deception", "Journey"])
    assert document["graph"]["nodes"][0]["track"] == 0  # Deception
    document = graph_of(["Red walks and the Wolf lies."], priority=["Journey", "Deception"])
    assert document["graph"]["nodes"][0]["track"] == 0  # Journey
    assert document["graph"]["nodes"][0]["attributes"]["Topic"] == ["Journey", "Deception"]


def test_a_node_without_an_organising_value_or_outside_the_priority_is_off_the_grid():
    document = graph_of(["Red sleeps.", "The Hunter saves Red."], priority=["Journey", "Deception"])
    assert [n["track"] for n in document["graph"]["nodes"]] == [-1, -1]


def test_passages_may_name_their_id_and_column_and_share_a_column():
    document = graph_of([{"text": "Red walks.", "id": "a", "time": 0}, {"text": "The Wolf walks.", "id": "b", "time": 0},
                         {"text": "The Wolf lies to Red.", "id": "c", "time": 2}])
    assert [(n["id"], n["time"]) for n in document["graph"]["nodes"]] == [("a", 0), ("b", 0), ("c", 2)]
    assert document["layout"]["cols"] == 3


@pytest.mark.parametrize("passages,message", [
    ([], "non-empty list"), ("text", "non-empty list"), ([""], "non-empty `text`"), ([3], "non-empty `text`"),
    ([{"text": "a", "time": -1}], "column number"), ([{"text": "a", "time": True}], "column number"),
    ([{"text": "a", "id": "x"}, {"text": "b", "id": "x"}], "unique"),
])
def test_bad_passages_are_refused(passages, message):
    with pytest.raises(ValueError, match=message):
        ttng_extract.read_passages(passages)


def test_a_misspelt_organising_or_linking_attribute_is_caught():
    with pytest.raises(ExtractorError, match="organising attribute 'Topics'"):
        graph_of(STORY, organising="Topics")
    with pytest.raises(ExtractorError, match="linking attribute 'Who'"):
        graph_of(STORY, linking="Who")


def test_the_graph_has_edges_where_neighbouring_passages_share_an_entity():
    nodes = graph_of(STORY)["graph"]["nodes"]
    edges = [(e["sourceId"], e["targetId"]) for e in derive_edges(nodes, "Entity", 5)]
    assert edges == [("n1", "n2"), ("n2", "n3"), ("n3", "n4"), ("n4", "n5")]


def test_the_graph_goes_on_into_the_aligner():
    document = graph_of(STORY)
    alignment = align_graph(unwrap(document), period=["2024-01-01", "2024-12-31"], seed=1,
                            **structure_of(document))
    assert alignment["n5"]["Theme"] == "Rescue" and alignment["n5"]["Prev"] == ["n4"]
    assert sorted(alignment["n2"]["Entity"]) == ["Red", "Wolf"]


# --- the command line ---

def write(path, data):
    path.write_text(json.dumps(data))
    return str(path)


def test_the_command_builds_a_graph_file_from_a_word_list(tmp_path, file_validator):
    out = tmp_path / "graph.json"
    ttng_extract.main([write(tmp_path / "p.json", STORY), "--extractor", f"lexicon?lexicon={write(tmp_path / 'w.json', WORDS)}",
                       "-o", str(out)])
    document = json.loads(out.read_text())
    assert list(file_validator.iter_errors(document)) == []
    assert len(document["graph"]["nodes"]) == 5


def test_the_command_runs_a_plugin_and_a_word_list_together(tmp_path):
    out = tmp_path / "graph.json"
    ttng_extract.main([
        write(tmp_path / "p.json", ["Red walks!", "The Wolf lies."]),
        "--extractor", f"lexicon?lexicon={write(tmp_path / 'w.json', WORDS)}",
        "--extractor", "plugin_example:make?loud=shouting",
        "--priority", "Deception", "Journey", "-o", str(out)])
    nodes = json.loads(out.read_text())["graph"]["nodes"]
    assert [n["attributes"]["Tone"] for n in nodes] == [["shouting"], ["calm"]]
    assert [n["track"] for n in nodes] == [1, 0]


def test_the_command_asks_a_model_for_the_attributes(tmp_path):
    out = tmp_path / "graph.json"
    model = FakeModel('{"Entity": ["Ana"], "Topic": ["Tax"], "Polarity": ["negative"]}',
                      '{"Entity": ["Ana", "Ben"], "Topic": ["Tax"], "Polarity": ["positive"]}')
    ttng_extract.main([write(tmp_path / "p.json", ["Ana lost.", "Ben helped Ana."]),
                       "--extractor", f"llm?spec={write(tmp_path / 's.json', SPEC)}&model=vendor/m&temperature=0.2",
                       "-o", str(out)], client=model)
    nodes = json.loads(out.read_text())["graph"]["nodes"]
    assert [n["attributes"]["Polarity"] for n in nodes] == [["negative"], ["positive"]]
    assert [c["model"] for c in model.calls] == ["vendor/m", "vendor/m"]
    assert [c["temperature"] for c in model.calls] == [0.2, 0.2]


@pytest.mark.parametrize("argv,message", [
    (["--extractor", "nonesuch"], "no extractor called"),
    (["--extractor", "plugin_example:make", "--organising", "Nope"], "organising attribute 'Nope'"),
])
def test_the_command_reports_a_problem_without_a_traceback(tmp_path, capsys, argv, message):
    with pytest.raises(SystemExit):
        ttng_extract.main([write(tmp_path / "p.json", ["Red walks."]), *argv, "-o", str(tmp_path / "x.json")])
    assert message in capsys.readouterr().err
    assert not (tmp_path / "x.json").exists()
