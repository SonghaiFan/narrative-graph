from pydantic import BaseModel, Field
from typing import List, Dict
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


class Node(BaseModel):
    headline: str = Field(
        description="Headline of the news article corpus, also the title of chapter.")
    index: int = Field(description="Index of the node.")
    time_period: List[date] = Field(
        description="Time period of the chapter (start date, end date).")
    themes: List[str] = Field(description="Themes related within chapter.")
    entity: List[str] = Field(description="Entity mentioned within chapter.")


class Edge(BaseModel):
    start_node: int = Field(description="Index of start node.")
    end_node: int = Field(description="Index of end node.")
    description: str = Field(
        description="Explain the connections (edges) between nodes using concise keyword labels.")


class Graph(BaseModel):
    nodes: List[Node]
    edges: List[Edge]


def make_graph(
    time_range: str, entities: str, themes: str, structure_instructions: str, model_name: str = "gpt-4", temperature: int = 0
):
    graph_parser = PydanticOutputParser(pydantic_object=Graph)

    prompt_template = """
    Given the following specifications, create a fictional story that consists of interlinked chapters and characters:
    Time Range: {time_range}
    Entities: {entities}
    Themes: {themes}

    Please structure the story as a graph where each node represents a chapter and each edge represents the connection between chapters.

    Graph Structure:
    {structure_instructions}

    {format_instructions}
    """

    model = OpenAI(model_name=model_name, temperature=temperature)
    prompt = PromptTemplate(
        template=prompt_template,
        input_variables=["time_range", "entities", "themes"],
        partial_variables={
            "structure_instructions": structure_instructions,
            "format_instructions": graph_parser.get_format_instructions()},
    )

    formatted_prompt = prompt.format_prompt(
        time_range=time_range,
        entities=entities,
        themes=themes,
    )

    output = model(formatted_prompt.to_string())
    graph = graph_parser.parse(output)

    return graph
