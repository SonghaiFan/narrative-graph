"""The LLM chapter writer (step 3), driven through a fake chat model."""
from meta.types import Story
from narrative_alignmenter import align_theme_entity
from narrative_deducer import create_story


def test_chapters_come_out_in_graph_order(fake_chat, sample_alignment):
    story = create_story(sample_alignment)
    assert [c.id for c in story.chapters] == list(sample_alignment)
    assert len(fake_chat.prompts) == len(sample_alignment)


def test_each_prompt_carries_the_theme_and_the_time_period(fake_chat, sample_alignment):
    create_story(sample_alignment)
    for (node, details), prompt in zip(sample_alignment.items(), fake_chat.prompts):
        start, end = details["Time"]
        assert f"Chapter ID: {node}" in prompt
        assert f"Topic: {details['Theme']}" in prompt
        assert f"Time Period: {start} to {end}" in prompt
        assert all(entity in prompt for entity in details["Entity"])


def test_a_chapter_continues_from_its_parent(fake_chat, sample_alignment):
    create_story(sample_alignment)
    first, second, third = fake_chat.prompts
    assert "Previous context: None" in first
    assert "Content of A1" in second  # B2 follows A1
    assert "Content of B2" in third  # A3 follows B2


def test_a_merge_chapter_sees_every_parent(fake_chat, structure_of):
    alignment = align_theme_entity(narrative_obj=structure_of("WideMerge"), seed=42)
    create_story(alignment)
    merge_prompt = fake_chat.prompts[list(alignment).index("B2")]
    assert "Content of A1" in merge_prompt
    assert "Content of C1" in merge_prompt


def test_the_model_is_gpt4_at_temperature_half(fake_chat, sample_alignment):
    create_story(sample_alignment)
    assert fake_chat.inits == [{"model_name": "gpt-4", "temperature": 0.5}] * len(sample_alignment)


def test_the_result_is_a_valid_story(fake_chat, sample_alignment):
    story = create_story(sample_alignment)
    dumped = story.dict()
    assert Story.model_validate(dumped) == story
    assert set(dumped["chapters"][0]) == {"id", "title", "time_period", "Topic", "entity", "content"}
