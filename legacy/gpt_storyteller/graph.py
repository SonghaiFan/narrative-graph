import json
import json
import os
import pygraphviz as pgv


def generate_graph_data(story_data, structure_data):
    """
    Generate graph data based on story data and narrative structure.

    Args:
    - story_data (dict): Contains chapters with details.
    - structure_data (list): List of narrative structures.

    Returns:
    - dict: Graph data with nodes and edges.
    """

    # Extract chapters from story data
    chapters = story_data["chapters"]

    # Identify the correct structure based on the chapters in the story data
    structure = None
    for s in structure_data:
        if all(chapter["id"] in s["nodes"] for chapter in chapters):
            structure = s
            break

    if not structure:
        return {"error": "No matching structure found."}

    # Generate nodes
    nodes = []
    for index, chapter in enumerate(chapters, start=1):
        nodes.append(
            {
                "index": index,
                "label": f"{chapter['id']}: {chapter['title'].split(':')[0]}",
                "time_period": chapter["time_period"],
                "themes": chapter["themes"],
                "entity": chapter["entity"],
            }
        )

    # Generate edges
    # Generate edges
    edges = []
    for edge in structure["edges"]:
        start_node = next(
            (node for node in nodes if node["label"].split(":")[0] == edge["from"]),
            None,
        )
        end_node = next(
            (node for node in nodes if node["label"].split(":")[0] == edge["to"]), None
        )

        # Identify common entities between the connected nodes
        common_entities = list(
            set(start_node["entity"]).intersection(set(end_node["entity"]))
        )
        label = ", ".join(common_entities)

        edges.append(
            {
                "start_node": start_node["index"],
                "end_node": end_node["index"],
                "labels": label,
            }
        )

    return {"nodes": nodes, "edges": edges}


def save_graph_json(graph_json, output_file="graph.json"):
    # Convert to JSON string if it's a dict
    if isinstance(graph_json, dict):
        graph_json = json.dumps(graph_json, indent=4)

    with open(output_file, "w") as f:
        f.write(graph_json)
        print("Graph json saved to", output_file)


def plot_graph_no_sub(graph_json, output_file, direction="LR"):
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


def plot_graph_theme_sub(graph_json, output_file, direction="LR"):
    """Plot the graph using the given graph data."""
    # Parse the JSON if it's a string
    if isinstance(graph_json, str):
        graph_data = json.loads(graph_json)
    else:
        graph_data = graph_json

    # Create a new graph
    G = pgv.AGraph(directed=True, rankdir=direction, strict=False, overlap=False)

    # Add nodes
    themes_to_nodes = {}
    for node in graph_data["nodes"]:
        label = ", ".join(node["time_period"]) + " " + node["label"]
        G.add_node(node["index"], label=label)
        for theme in node["themes"]:
            if theme not in themes_to_nodes:
                themes_to_nodes[theme] = []
            themes_to_nodes[theme].append(node["index"])

    # Group nodes by themes using subgraphs
    for theme, nodes in themes_to_nodes.items():
        sub = G.add_subgraph(nodes, name=f"cluster_{theme}")
        sub.graph_attr["label"] = theme

    # Add edges
    for edge in graph_data["edges"]:
        G.add_edge(edge["start_node"], edge["end_node"], label=edge["labels"])

    # Draw the graph
    G.draw(output_file, prog="dot")
    print("Graph saved to", output_file)


def plot_graph_time_sub(graph_json, output_file, direction="LR"):
    """Plot the graph using the given graph data."""
    # Parse the JSON if it's a string
    if isinstance(graph_json, str):
        graph_data = json.loads(graph_json)
    else:
        graph_data = graph_json

    # Create a new graph
    G = pgv.AGraph(directed=True, rankdir=direction, strict=False, overlap=False)

    # Add nodes
    time_periods_to_nodes = {}
    for node in graph_data["nodes"]:
        label = ", ".join(node["time_period"]) + " " + node["label"]
        G.add_node(node["index"], label=label)
        time_period_str = ", ".join(node["time_period"])
        if time_period_str not in time_periods_to_nodes:
            time_periods_to_nodes[time_period_str] = []
        time_periods_to_nodes[time_period_str].append(node["index"])

    # Group nodes by time_period using subgraphs
    for time_period, nodes in time_periods_to_nodes.items():
        sub = G.add_subgraph(nodes, name=f"cluster_{time_period}")
        sub.graph_attr["label"] = time_period

    # Add edges
    for edge in graph_data["edges"]:
        G.add_edge(edge["start_node"], edge["end_node"], label=edge["labels"])

    # Draw the graph
    G.draw(output_file, prog="dot")
    print("Graph saved to", output_file)


def process_story_files(stories_path, structure_data, graphs_path):
    """Loop over all JSON files in the stories folder and generate graphs."""
    for file_name in os.listdir(stories_path):
        if file_name.endswith(".json"):
            story_file_path = os.path.join(stories_path, file_name)

            # Load story data
            with open(story_file_path, "r") as story_file:
                story_data = json.load(story_file)

            # Generate graph data
            graph_data = generate_graph_data(story_data, structure_data)

            # Save and plot the graph
            base_name = os.path.splitext(file_name)[
                0
            ]  # Get the filename without extension
            output_graph_file = os.path.join(graphs_path, f"{base_name}.png")
            output_json_file = os.path.join(graphs_path, f"{base_name}.json")

            # plot_graph_no_sub(graph_data, output_graph_file, direction="TB")
            # plot_graph_theme_sub(graph_data, output_graph_file, direction="TB")
            plot_graph_time_sub(graph_data, output_graph_file, direction="TB")

            save_graph_json(graph_data, output_json_file)


if __name__ == "__main__":
    # Load narrative structure data
    with open("meta/narrative_structure.json", "r") as structure_file:
        structure_data = json.load(structure_file)

    # Process all story files and generate corresponding graphs
    stories_path = "stories"
    graphs_path = "graphs"
    if not os.path.exists(graphs_path):
        os.makedirs(graphs_path)

    process_story_files(stories_path, structure_data, graphs_path)
