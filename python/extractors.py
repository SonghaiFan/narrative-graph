"""Plugins that turn the text of a node into its attributes: f(text) = attributes.

A TTNG organises and links nodes by their attributes (Entity, Topic, Polarity, ...), and something has to
produce them from text. That something is an extractor, and the model does not care which one it is: a word
list, a language model, a classifier or an embedding with clusters all give the same thing back.

An extractor is any object with

    name: str                                   what it is called in messages
    attributes: sequence of str                 the attributes it can give, and no others
    extract(text) -> {attribute: [value, ...]}  values are strings; an attribute it has nothing for may be left out

Where plugins come from, in the order they are looked up by `build_extractor`:

- a built-in name: `lexicon` (a word list) or `llm` (a language model);
- `module:attribute`, a function or class that is imported and called with the options, for a plugin that is
  only a file on the path;
- an entry point in the group `ttng.extractors`, for a plugin that is installed with pip.

Whatever an extractor returns is checked against the contract (`run`), so a faulty plugin is stopped at its
own door and not found later as a strange graph.
"""
import importlib
import json
import re
from importlib import metadata

import prompts
from llm import DEFAULT_MODELS, make_client

ENTRY_POINT_GROUP = "ttng.extractors"


class ExtractorError(ValueError):
    """An extractor, or its configuration, does not meet the contract."""


# --- the contract ---

def check_extractor(extractor):
    for member in ("name", "attributes", "extract"):
        if not hasattr(extractor, member):
            raise ExtractorError(f"{extractor!r} is not an extractor: it has no `{member}`")
    if not callable(extractor.extract):
        raise ExtractorError(f"{extractor.name}: `extract` is not callable")
    if isinstance(extractor.attributes, str) or not all(isinstance(a, str) and a for a in extractor.attributes):
        raise ExtractorError(f"{extractor.name}: `attributes` must be a list of attribute names")
    return extractor


def check_distinct(extractors):
    """No two extractors may give the same attribute: which one would win?"""
    owner = {}
    for extractor in extractors:
        for attribute in extractor.attributes:
            if attribute in owner:
                raise ExtractorError(f"{attribute!r} is given by both {owner[attribute]!r} and {extractor.name!r}")
            owner[attribute] = extractor.name
    return extractors


def run(extractor, text):
    """What `extractor` finds in `text`, checked: only its own attributes, lists of non-empty strings.

    Repeats are dropped and so are attributes with no value, which leaves the node without that attribute.
    """
    found = extractor.extract(text)
    if not isinstance(found, dict):
        raise ExtractorError(f"{extractor.name}: extract() must return a dict, not {type(found).__name__}")
    result = {}
    for attribute, values in found.items():
        if attribute not in extractor.attributes:
            raise ExtractorError(f"{extractor.name} gave {attribute!r}, which it does not declare")
        if not isinstance(values, list) or not all(isinstance(v, str) for v in values):
            raise ExtractorError(f"{extractor.name}: the values of {attribute!r} must be a list of strings")
        values = list(dict.fromkeys(v for v in values if v.strip()))
        if values:
            result[attribute] = values
    return result


def run_all(extractors, text):
    """The attributes of one text from every extractor."""
    merged = {}
    for extractor in extractors:
        merged.update(run(extractor, text))
    return merged


# --- built-in extractors ---

class LexiconExtractor:
    """Looks for words. `lexicon` is {attribute: {value: [trigger words]}}; a value with no trigger words
    is found by its own name. Matching ignores case and needs whole words. Values come in the order in which
    they first appear in the text. It is deterministic and needs no key, which suits small controlled corpora.
    """

    name = "lexicon"

    def __init__(self, lexicon):
        self.lexicon = lexicon
        self.attributes = tuple(lexicon)
        self._patterns = {
            attribute: {
                value: [re.compile(rf"(?<!\w){re.escape(word)}(?!\w)", re.IGNORECASE) for word in (words or [value])]
                for value, words in values.items()
            }
            for attribute, values in lexicon.items()
        }

    def extract(self, text):
        found = {}
        for attribute, values in self._patterns.items():
            hits = []
            for value, patterns in values.items():
                starts = [m.start() for p in patterns if (m := p.search(text))]
                if starts:
                    hits.append((min(starts), value))
            found[attribute] = [value for _, value in sorted(hits)]
        return found


class LLMExtractor:
    """Asks a language model. `spec` is {attribute: {"description": str, "values": [allowed values],
    "single": bool}}, all three optional. With `values` the answer must be one of them (case is fixed to the
    spec's); with `single` it must be one value. A reply that breaks either rule is an error, not a guess.
    """

    name = "llm"

    def __init__(self, spec, client, model, temperature=0.0):
        self.spec = {attribute: dict(options or {}) for attribute, options in spec.items()}
        self.attributes = tuple(self.spec)
        self.client = client
        self.model = model
        self.temperature = temperature

    def _describe(self):
        lines = []
        for attribute, options in self.spec.items():
            parts = [options.get("description", "")]
            if options.get("values"):
                parts.append("choose from: " + ", ".join(options["values"]))
            parts.append("exactly one value" if options.get("single") else "any number of values")
            lines.append(f"- {attribute}: " + "; ".join(p for p in parts if p))
        return "\n".join(lines)

    def extract(self, text):
        prompt = prompts.render("extract", attributes=self._describe(), text=text)
        reply = self.client.complete(prompt, model=self.model, temperature=self.temperature)
        answer = _json_object(reply)
        found = {}
        for attribute, options in self.spec.items():
            values = answer.get(attribute, [])
            values = [values] if isinstance(values, str) else values
            if not isinstance(values, list) or not all(isinstance(v, str) for v in values):
                raise ExtractorError(f"llm: the reply gives {attribute!r} as {values!r}, not a list of strings")
            allowed = options.get("values")
            if allowed:
                by_lowercase = {a.lower(): a for a in allowed}
                unknown = [v for v in values if v.strip().lower() not in by_lowercase]
                if unknown:
                    raise ExtractorError(f"llm: {attribute!r} must be one of {allowed}, the reply has {unknown}")
                values = [by_lowercase[v.strip().lower()] for v in values]
            if options.get("single") and len(set(values)) > 1:
                raise ExtractorError(f"llm: {attribute!r} must have one value, the reply has {values}")
            found[attribute] = values
        return found


def _json_object(reply):
    """The JSON object in a model's reply, which may be wrapped in a code fence or in a sentence."""
    start, end = reply.find("{"), reply.rfind("}")
    if start < 0 or end < start:
        raise ExtractorError(f"llm: the reply has no JSON object: {reply[:80]!r}")
    try:
        answer = json.loads(reply[start:end + 1])
    except json.JSONDecodeError as error:
        raise ExtractorError(f"llm: the reply is not valid JSON ({error}): {reply[:80]!r}") from error
    if not isinstance(answer, dict):
        raise ExtractorError("llm: the reply is not a JSON object")
    return answer


def _json_option(value, what):
    """A path to a JSON file, or the data itself when a program passes it."""
    if isinstance(value, str):
        with open(value) as file:
            return json.load(file)
    if isinstance(value, dict):
        return value
    raise ExtractorError(f"{what} must be the path of a JSON file")


def build_lexicon(lexicon=None):
    if lexicon is None:
        raise ExtractorError("lexicon needs `lexicon=<a JSON file of {attribute: {value: [words]}}>`")
    return LexiconExtractor(_json_option(lexicon, "lexicon"))


def build_llm(spec=None, provider="openai", model=None, client=None, temperature="0"):
    if spec is None:
        raise ExtractorError("llm needs `spec=<a JSON file of {attribute: {description, values, single}}>`")
    if provider not in DEFAULT_MODELS:
        raise ExtractorError(f"unknown provider {provider!r}; use one of: {', '.join(DEFAULT_MODELS)}")
    return LLMExtractor(
        _json_option(spec, "spec"),
        client or make_client(provider),
        model or DEFAULT_MODELS[provider],
        float(temperature),
    )


BUILTIN = {"lexicon": build_lexicon, "llm": build_llm}


# --- finding a plugin ---

def available():
    names = list(BUILTIN)
    names += [ep.name for ep in metadata.entry_points(group=ENTRY_POINT_GROUP) if ep.name not in names]
    return names


def build_extractor(spec, options=None, client=None):
    """The extractor `spec` names, built with `options` (a dict of keyword arguments).

    `client` is handed only to the built-in `llm`; a plugin makes its own connections.
    """
    options = dict(options or {})
    if spec in BUILTIN:
        factory = BUILTIN[spec]
        if spec == "llm" and client is not None:
            options["client"] = client
    elif ":" in spec:
        module_name, _, attribute = spec.partition(":")
        try:
            factory = getattr(importlib.import_module(module_name), attribute)
        except (ImportError, AttributeError) as error:
            raise ExtractorError(f"cannot load the plugin {spec!r}: {error}") from error
    else:
        matches = [ep for ep in metadata.entry_points(group=ENTRY_POINT_GROUP) if ep.name == spec]
        if not matches:
            raise ExtractorError(
                f"no extractor called {spec!r}. Available: {', '.join(available())}. "
                f"A plugin can also be given as module:attribute."
            )
        factory = matches[0].load()
    try:
        extractor = factory(**options)
    except TypeError as error:
        raise ExtractorError(f"cannot build {spec!r} with the options {sorted(options)}: {error}") from error
    return check_extractor(extractor)
