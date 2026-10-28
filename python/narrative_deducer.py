# Load environment variables from .env file
import warnings
import json
from typing import List, Optional
from meta.types import Chapter, Story
from langchain_core.output_parsers import PydanticOutputParser
from dotenv import load_dotenv, find_dotenv

import prompts
from llm import LLMClient, OpenAIClient

load_dotenv(find_dotenv())


warnings.filterwarnings("ignore")


def make_chapter(
    id: str,
    topic: str,
    theme_context: str,
    entity: List[str],
    time_period: List[str],
    narrative_structure: str,
    prev_content: str,
    model_name: str = "gpt-4",
    temperature: float = 0,
    client: Optional[LLMClient] = None,
) -> Chapter:
    """
    Function to generate a fictional news chapter continuing from a previous story.
    """
    # Parser for the model's output
    chapter_parser = PydanticOutputParser(pydantic_object=Chapter)

    time_period_str = f"{time_period[0]} to {time_period[1]}"

    prev_content_str = prev_content if prev_content else "None"

    # The prompt text lives in prompts/chapter.md
    prompt_template = prompts.render(
        "chapter",
        id=id,
        time_period=time_period_str,
        topic=topic,
        theme_context=theme_context,
        entity=", ".join(entity),
        narrative_structure=narrative_structure,
        prev_content=prev_content_str,
        format_instructions=chapter_parser.get_format_instructions(),
    )
    print("-" * 50)
    print(prompt_template)
    print("-" * 50)

    output = (client or OpenAIClient()).complete(
        prompt_template, model=model_name, temperature=temperature)

    return chapter_parser.parse(output)


def create_story(alignment, client: Optional[LLMClient] = None):
    client = client or OpenAIClient()
    story = Story(chapters=[])

    content_cache = {}

    print("Generating story...")

    print("Narrative structure:")

    for node, details in alignment.items():
        print("=" * 50)
        print(f"Generating chapter {node}...")
        print(f"This chapter based on previous chapter: {details['Prev']}")
        prev_content = "\n\n".join(
            [
                content_cache[prev_node]
                for prev_node in details["Prev"]
                if prev_node in content_cache
            ]
        )
        print(f"Previous content: {prev_content}")

        new_chapter = make_chapter(
            id=node,
            topic=details["Theme"],
            theme_context=details["ThemeDescription"],
            entity=details["Entity"],
            time_period=details["Time"],
            narrative_structure=details["StuctureInstruction"],
            prev_content=prev_content,
            temperature=0.5,
            client=client,
        )

        new_chapter_dict = new_chapter.dict()
        print("~" * 50)
        print(f"New chapter << {new_chapter_dict['title']} >> Finished!")
        print(new_chapter_dict["content"])
        print("~" * 50)
        story.chapters.append(new_chapter)
        content_cache[node] = new_chapter_dict["content"]

    return story


if __name__ == "__main__":
    # load alignment_results.json
    with open("alignment_results.json", "r") as file:
        alignment_results = json.load(file)
    story = create_story(alignment_results)
    with open("story.json", "w") as file:
        json.dump(story.dict(), file, indent=4)
