"""Guards that protect the other tests, and one regression guard for the writer."""
import socket

import pytest

from conftest import PYTHON_DIR


def test_sockets_are_blocked():
    sock = socket.socket()
    try:
        with pytest.raises(RuntimeError, match="blocked"):
            sock.connect(("203.0.113.1", 80))  # TEST-NET-3, never routable
    finally:
        sock.close()


def test_dns_lookups_are_blocked():
    with pytest.raises(RuntimeError, match="blocked"):
        socket.getaddrinfo("example.com", 80)


def test_the_writer_does_not_go_back_to_a_langchain_model_wrapper():
    source = (PYTHON_DIR / "narrative_deducer.py").read_text()
    assert "langchain.llms" not in source
    assert "ChatOpenAI" not in source and "langchain_community" not in source


def test_the_prompt_is_not_written_into_the_code_again():
    assert "senior reporter" not in (PYTHON_DIR / "narrative_deducer.py").read_text()
    assert "senior reporter" in (PYTHON_DIR / "prompts" / "chapter.md").read_text()
