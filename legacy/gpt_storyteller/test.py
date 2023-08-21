import warnings
from gpt_cartographer import make_graph
from IPython.display import display, Markdown
import random
import json
import pygraphviz as pgv
import json
import datetime


# ignore warnings
warnings.filterwarnings("ignore")
with open("narrtaive_structure.json", "r") as file:
    structure_instructions_list = json.load(file)

with open("simple_narrative_structure.json", "r") as file:
    simple_structure_instructions_list = json.load(file)

# Load data from 'narrative_context.json'
with open("narrative_context.json", "r") as file:
    context_data = json.load(file)


# Get the list of sections
section_list = list(context_data.keys())


def save_graph_json(graph_json, output_file="graph.json"):
    with open(output_file, "w") as f:
        f.write(graph_json)
        print("Graph json saved to", output_file)


def plot_graph(graph_json, output_file="output.png", direction="LR"):
    # Parse the JSON if it's a string
    if isinstance(graph_json, str):
        graph_data = json.loads(graph_json)
    else:
        graph_data = graph_json

    # Create a new graph
    G = pgv.AGraph(directed=True, rankdir=direction)

    # Add nodes
    for node in graph_data["nodes"]:
        label = ", ".join(node["time_period"]) + " " + node["label"]
        G.add_node(node["index"], label=label)

    # Add edges
    for edge in graph_data["edges"]:
        G.add_edge(edge["start_node"], edge["end_node"], label=edge["labels"])

    # Draw the graph
    G.draw(output_file, prog="dot")
    print("Graph saved to", output_file)


def retrieve_section_data(section_name, data, seed=None):
    """
    Retrieve specified section data with random selections.

    Parameters:
        section_name (str): The name of the section to retrieve data from.
        data (dict): The data dictionary containing section data.
        seed (int, optional): The seed for the random number generator.

    Returns:
        dict: A dictionary containing randomly selected entities and themes.
    """
    # Set the seed
    random.seed(seed)

    section_data = data.get(section_name, {})
    entities_data = section_data.get("Entities", {})
    themes_data = section_data.get("Themes", {})

    # Randomly select entity types
    selected_entity_types = random.sample(
        list(entities_data.keys()),
        min(len(entities_data), random.randint(2, len(entities_data))),
    )

    new_entities_data = {}
    for entity_type in selected_entity_types:
        entities = entities_data[entity_type]
        if isinstance(entities, list):
            new_entities_data[entity_type] = random.sample(
                entities, min(len(entities), random.randint(2, len(entities)))
            )

    # Randomly select themes and convert them to a list of dictionaries
    if isinstance(themes_data, list):
        selected_themes = random.sample(
            themes_data, random.randint(2, len(themes_data))
        )
        themes_dict_list = [
            {"name": theme["name"], "description": theme["description"]}
            for theme in selected_themes
        ]
    else:
        themes_dict_list = []

    print(
        f"Selected {len(new_entities_data)} entity types and {len(themes_dict_list)} themes from {section_name} section."
    )
    print(f"Selected entity types: {new_entities_data.keys()}")
    print(
        f"Selected entities names: {[entity['name'] for entity_type in new_entities_data for entity in new_entities_data[entity_type]]}"
    )
    print(f"Selected themes names: {[theme['name'] for theme in themes_dict_list]}")

    return {
        "Entities": new_entities_data,
        "Themes": themes_dict_list,
        "Time": section_data.get("Time", ""),
    }


def parse_context_data(context_data):
    """Parse the context data into string format for entities, themes, and time range."""
    print("Parsing context data...")
    # Flatten the list of lists for entities
    entities_list = [
        entity
        for entity_group in context_data.get("Entities", {}).values()
        for entity in entity_group
    ]

    entities_str = "\n".join(
        [f"- {entity['name']} : {entity['description']}" for entity in entities_list]
    )

    themes_str = "\n".join(
        [
            f"- {theme['name']} : {theme['description']}"
            for theme in context_data.get("Themes", [])
        ]
    )

    time_str = " to ".join(context_data.get("Time", []))

    print(f"Entities str:\n{entities_str}\n")
    print(f"Themes str:\n{themes_str}\n")
    print(f"Time str:\n{time_str}\n")

    return entities_str, themes_str, time_str


def parse_instruction(instruction):
    name = instruction["name"]
    description = instruction["description"]
    structure = instruction["structure"]
    instruction_text = instruction["instructions"]

    parsed_string = (
        f"Structure similar with: {structure}\nInstructions: {instruction_text}\n"
    )
    return parsed_string


def generate_graph(section_name, structure_name, seed=None):
    """
    Generate a graph based on entities, themes, and time data from 'narrative_context.json'.

    Parameters:
        section (str): Section of the narrative context to use.
        structure_instructions (str): Instructions for the graph structure.
        seed (int, optional): Seed for reproducibility.

    Returns:
        Graph, dict: Returns the generated graph and its JSON representation.
    """

    # Set seed for reproducibility
    if seed:
        random.seed(seed)

    # Retrieve data based on section_name
    print(f"Retrieving data from '{section_name}' section...")
    context = retrieve_section_data(
        section_name=section_name, data=context_data, seed=seed
    )

    # parse data as string for make_graph
    entities_str, themes_str, time_str = parse_context_data(context)

    structure_instructions = next(
        (
            structure
            for structure in structure_instructions_list
            if structure["name"] == structure_name
        ),
        None,
    )

    if not structure_instructions:
        raise ValueError(
            f"Could not find structure instructions with name '{structure_name}'"
        )

    structure_instruction_str = parse_instruction(structure_instructions)

    general_instructions = """
    General Instructions:
    Node prefixes, like 'A', 'B', or 'C', denote nodes(chapters) has at least one common themes.
    The suffix numbers, like 1, 2, or 3, indicate chronological order, with smaller numbers representing earlier chapters.
    Node with same suffix numbers, like A1 and B1, are chapters that occur at the same time period.

    Create graph strictly follow the instructions:
    """

    final_structure_instructions = (
        f"{general_instructions}\n{structure_instruction_str}"
    )
    print(f"Structure Instructions:\n{final_structure_instructions}\n")

    print("Generating graph...")

    # Generate graph
    graph = make_graph(
        time_range=time_str,
        entities=entities_str,
        themes=themes_str,
        model_name="gpt-4",
        temperature=0,
        structure_instructions=final_structure_instructions,
    )

    print("Graph generated!")

    out_graphs_path = f"graphs/{section_name}_{structure_name}_{seed}"

    graph_json = graph.json()

    # Save graph
    plot_graph(graph_json, f"{out_graphs_path}.png", direction="TB")
    save_graph_json(graph_json, f"{out_graphs_path}.json")

    return graph


# Generate graphs
if __name__ == "__main__":
    generate_graph(section_name="Politics", structure_name="Diamond", seed=22)
    # for each in structure_instructions_list:
    #     structure_name = each["name"]
    #     print(structure_name)
    #     print("-----")
    #     generate_graph(section_name="Economics",
    #                    structure_name=structure_name, seed=42)
