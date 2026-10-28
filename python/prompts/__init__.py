"""Prompt templates. The text lives in the .md files here, not in the code."""
from pathlib import Path

_DIR = Path(__file__).resolve().parent


def render(name, **fields):
    """Fill the placeholders of prompts/<name>.md, written as {field}. The text is otherwise kept as it is."""
    return (_DIR / f"{name}.md").read_text().format(**fields)
