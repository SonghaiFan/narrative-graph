from datetime import date
from typing import List

from dotenv import load_dotenv, find_dotenv
from pydantic import BaseModel, Field, validator

from langchain.output_parsers import PydanticOutputParser
from langchain.prompts import PromptTemplate
from langchain.llms import OpenAI
from langchain.chat_models import ChatOpenAI

# Load environment variables from .env file
load_dotenv(find_dotenv())


class Chapter(BaseModel):
    title: str = Field(description="Title of the chapter.")
    time_period: List[date] = Field(
        description="Time period of the chapter (start date, end date).")
    themes: List[str] = Field(description="Themes related within chapter.")
    entity: List[str] = Field(description="Entity mentioned within chapter.")
    content: str = Field(description="Content of the chapter.")


class Story(BaseModel):
    story: List[Chapter] = Field(description="The story, a list of chapters.")


def make_story(
    time_range: str, entities: str, themes: str, model_name: str = "gpt-4", temperature: int = 0
):
    story_parser = PydanticOutputParser(pydantic_object=Story)

    prompt_template = """
    You're an excellent storyteller, specializing in unraveling intricate narratives within complex stories and mapping out the storylines. 
    You advocate for exploring interwoven, non-linear storylines that contain multiple entities and themes.
    Time Range: {time_range}
    Entities: {entities}
    Themes: {themes}
    Your task is to write a fictional story that covers all the entities and themes listed above within the time range. 
    The narrative should be a coherent story that connects the entities and themes together along the timeline.
    Multiple storylines is encouraged. You should try to connect the entities and themes together in a way that is interesting and engaging.
    The story should follow fretag's pyramid structure, with a clear beginning, middle, and end. 
    {format_instructions}
    """

    model = OpenAI(model_name=model_name, temperature=temperature)
    prompt = PromptTemplate(
        template=prompt_template,
        input_variables=["time_range", "entities", "themes"],
        partial_variables={
            "format_instructions": story_parser.get_format_instructions()},
    )

    formatted_prompt = prompt.format_prompt(
        time_range=time_range,
        entities=entities,
        themes=themes,
    )

    output = model(formatted_prompt.to_string())
    story = story_parser.parse(output)

    return story
