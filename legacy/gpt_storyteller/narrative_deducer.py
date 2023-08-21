# Load environment variables from .env file
from dotenv import load_dotenv, find_dotenv

load_dotenv(find_dotenv())

from langchain.llms import OpenAI
from langchain.chat_models import ChatOpenAI
from langchain.prompts import PromptTemplate
from typing import Union, List
from langchain.output_parsers import PydanticOutputParser
from meta.my_types import Chapter, Story

from typing import List


import json
import warnings

warnings.filterwarnings("ignore")

# class Chapter(BaseModel):
#     title: str = Field(description="Title of the chapter.")
#     time_period: List[str] = Field(
#         description="Time period of the chapter (start date, end date), in format YYYY-MM-DD."
#     )
#     themes: List[str] = Field(description="Themes related within chapter.")
#     entity: List[str] = Field(description="Entity mentioned within chapter.")
#     content: str = Field(description="Content of the chapter.")


# class Story(BaseModel):
#     chapters: List[Chapter] = Field(description="List of chapters.")


def make_chapter(
    theme: str,
    entity: List[str],
    time_period: List[str],
    description: str,
    prev_content: str,
    model_name: str = "gpt-4",
    temperature: int = 0,
) -> Chapter:
    """
    Function to generate a fictional news chapter continuing from a previous story.
    """
    # Parser for the model's output
    chapter_parser = PydanticOutputParser(pydantic_object=Chapter)

    time_period_str = f"{time_period[0]} to {time_period[1]}"

    prev_content_str = prev_content if prev_content else "None"

    # Create a prompt template
    prompt_template = f"""
    You are a senior reporter at the New York Times and you are writing a fictional news story that continues from a previous story. Your writing style is concise and crisp, without rhetoric or superfluous narration. The continuation chapter needs to be closely related to the previous chapter while focusing on the following entities and themes:

    Time Period: {time_period_str}
    Themes: {theme}
    Entity: {', '.join(entity)}

    Describtion: {description}
    Previous content: {prev_content_str}

    {chapter_parser.get_format_instructions()}
    """
    print("-" * 50)
    print(prompt_template)
    print("-" * 50)

    model = OpenAI(model_name=model_name, temperature=temperature)
    output = model(prompt_template)

    return chapter_parser.parse(output)


def create_story(alignment):
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
            theme=details["Theme"],
            entity=details["Entity"],
            time_period=details["Time"],
            description=details["Description"],
            prev_content=prev_content,
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
