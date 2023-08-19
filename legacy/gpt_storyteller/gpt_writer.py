# Standard Library Imports
import os
import json
from datetime import date
from typing import List

# Third-party Imports
from dotenv import load_dotenv, find_dotenv
from pydantic import BaseModel, Field

# Project-specific Imports
from langchain.output_parsers import PydanticOutputParser
from langchain.prompts import PromptTemplate
from langchain.llms import OpenAI
from langchain.chat_models import ChatOpenAI
from typing import Optional, Union
from gpt_cartographer import Node, Edge, Graph

import warnings

warnings.filterwarnings("ignore")

load_dotenv(find_dotenv())  # Load environment variables from .env file


class Chapter(BaseModel):
    title: str = Field(description="Title of the chapter.")
    time_period: List[date] = Field(
        description="Time period of the chapter (start date, end date)."
    )
    themes: List[str] = Field(description="Themes related within chapter.")
    entity: List[str] = Field(description="Entity mentioned within chapter.")
    content: str = Field(description="Content of the chapter.")


def generate_chapter_prompt(
    title, time_period, themes, entity, node_instructions, format_instructions
):
    return f"""
    You are an experienced New York Times journalist. Your task is to write an article around:
    Title: {title}
    Time Period: {time_period}
    Themes: {themes}
    Entity: {entity}
    {node_instructions}
    {format_instructions}
    """


def make_chapter(
    node: Node,
    incoming_edge: Optional[Edge] = None,
    model_name: str = "gpt-4",
    temperature: int = 0,
) -> Chapter:
    chapter_parser = PydanticOutputParser(pydantic_object=Chapter)

    # If there's no incoming_edge, the node_instructions will be an empty string
    node_instructions = incoming_edge.labels if incoming_edge else ""

    formatted_prompt = generate_chapter_prompt(
        title=node.label,
        time_period=node.time_period,
        themes=node.themes,
        entity=node.entity,
        node_instructions=node_instructions,
        format_instructions=chapter_parser.get_format_instructions(),
    )

    model = OpenAI(model_name=model_name, temperature=temperature)
    output = model(formatted_prompt)
    return chapter_parser.parse(output)


class Story(BaseModel):
    chapters: List[Chapter] = Field(description="List of chapters.")


def make_story(
    time_range: str,
    entities: str,
    themes: str,
    model_name: str = "gpt-4",
    temperature: int = 0,
) -> Story:
    story_parser = PydanticOutputParser(pydantic_object=Story)
    formatted_prompt = f"""
    Craft a fictional story spanning:
    Time Range: {time_range}
    Entities: {entities}
    Themes: {themes}
    {story_parser.get_format_instructions()}
    """

    model = OpenAI(model_name=model_name, temperature=temperature)
    output = model(formatted_prompt)
    return story_parser.parse(output)


def add_chapter_to_story(story: Story, graph: Graph, nodeId: str) -> Story:
    node = graph.nodes[nodeId - 1]
    incoming_edges = [edge for edge in graph.edges if edge.end_node == nodeId]

    if incoming_edges:
        # assuming only one incoming edge for simplicity
        new_chapter = make_chapter(node, incoming_edges[0])
        story.chapters.append(new_chapter)
    else:
        print(f"Node {node.label} has no incoming edges, add without context.")
        new_chapter = make_chapter(node, None)
        story.chapters.append(new_chapter)

    return story


def create_story_from_graph(graph: Graph) -> Story:
    story = Story(chapters=[])

    print("Creating story from graph...")
    print(story)

    for node in graph.nodes:
        print(f"Adding chapter {node.label} to story...")
        story = add_chapter_to_story(story, graph, node.index)

    return story


def load_graph_from_directory(directory: str = "graphs") -> Graph:
    """
    Load the first JSON graph file from a given directory.
    Returns the Graph instance.
    """
    json_files = [file for file in os.listdir(directory) if file.endswith(".json")]

    if not json_files:
        raise ValueError("No JSON files found in the directory.")

    with open(os.path.join(directory, json_files[0]), "r") as file:
        data = json.load(file)

    print(f"Loaded graph from {json_files[0]}")

    return Graph(**data)


class DateEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, date):
            return obj.isoformat()
        return super(DateEncoder, self).default(obj)


if __name__ == "__main__":
    # This is where you can test or execute your methods.
    # load graph from graphs folder, use the first json file for testing
    graph = load_graph_from_directory()
    story = create_story_from_graph(graph)
    print(story)
    # save story to json file

    with open("story.json", "w") as file:
        json.dump(story.dict(), file, indent=4, cls=DateEncoder)

    pass
