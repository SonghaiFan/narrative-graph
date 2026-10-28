import json
import datetime
import random


with open("meta/narrative_structure.json", "r") as file:
    structure_instructions_list = json.load(file)

narrative_structure = [item["name"] for item in structure_instructions_list]

print("narrative_structure", narrative_structure)

# Load data from 'narrative_context.json'
with open("meta/narrative_context.json", "r") as file:
    narrative_context = json.load(file)

print("narrative_context", narrative_context)

keys_narrative_context = list(narrative_context.keys())


def generate_time_periods(start_date, end_date, num_periods):
    start = datetime.datetime.strptime(start_date, "%Y-%m-%d")
    end = datetime.datetime.strptime(end_date, "%Y-%m-%d")
    total_days = (end - start).days
    average_duration = total_days // num_periods
    periods = []

    for i in range(num_periods):
        period_start = start + datetime.timedelta(days=i * average_duration)
        period_end = period_start + datetime.timedelta(days=average_duration)

        # Ensure the last period does not exceed the end date
        if period_end > end or i == num_periods - 1:
            period_end = end

        periods.append([str(period_start.date()), str(period_end.date())])

    return periods


def process_nodes_in_order(narrative_obj):
    """Process nodes ensuring parent nodes are always processed before their child nodes."""
    nodes_to_process = narrative_obj["nodes"].copy()
    processed_nodes = []
    parent_mapping = {}

    # Build a dictionary to map each node to its parents
    for edge in narrative_obj["edges"]:
        if edge["to"] not in parent_mapping:
            parent_mapping[edge["to"]] = []
        parent_mapping[edge["to"]].append(edge["from"])

    while nodes_to_process:
        for node in nodes_to_process[:]:
            # If the node has no parents or all its parents are already processed, process this node
            if node not in parent_mapping or all(
                parent in processed_nodes for parent in parent_mapping[node]
            ):
                processed_nodes.append(node)
                nodes_to_process.remove(node)

    return processed_nodes


def align_theme_entity(narrative_obj, context_obj, seed=None):
    # Set seed for reproducibility
    if seed:
        random.seed(seed)

    # Collect themes and entities from context_obj based on categories
    themes = context_obj["Themes"].copy()
    entities_data = context_obj["Entities"].copy()
    times = context_obj["Time"].copy()

    # Sample entities
    E = random.sample(entities_data, 4)

    # Identify unique prefixes in the narrative structure
    prefixes = set(node[0] for node in narrative_obj["nodes"])

    # Pre-allocate a unique theme for each prefix
    theme_allocation = {}
    for prefix in prefixes:
        theme_allocation[prefix] = themes.pop(random.randrange(len(themes)))

    # Generate time periods
    if len(times) == 2:  # If only start and end dates are provided
        num_periods = max([int(n[-1]) for n in narrative_obj["nodes"]])
        periods = generate_time_periods(times[0], times[1], num_periods)
    else:
        periods = times

    # Build a dictionary to map each node to its parents
    parent_mapping = {}
    for edge in narrative_obj["edges"]:
        if edge["to"] not in parent_mapping:
            parent_mapping[edge["to"]] = []
        parent_mapping[edge["to"]].append(edge["from"])

    # Assign entities, themes, and parent nodes
    alignment = {}
    ordered_nodes = process_nodes_in_order(narrative_obj)

    for node in ordered_nodes:
        num_entities_for_node = random.randint(
            1, len(E) - len(narrative_obj["nodes"]) + ordered_nodes.index(node) + 1
        )  # Ensure all entities are used

        # If the current node has parent nodes
        if node in parent_mapping:
            # Fetch a shared entity from parent node(s)
            shared_entities = [
                ent
                for parent_node in parent_mapping[node]
                for ent in alignment[parent_node]["Entity"]
            ]
            # Make sure at least one shared entity is included in the current node's entities
            entities_for_node = [
                ent["name"] for ent in random.sample(E, num_entities_for_node - 1)
            ] + [random.choice(shared_entities)]
        else:
            entities_for_node = [
                ent["name"] for ent in random.sample(E, num_entities_for_node)
            ]

        theme_obj = theme_allocation[node[0]]

        alignment[node] = {
            "Theme": theme_obj["name"],
            "Entity": list(set(entities_for_node)),
            "Time": periods[int(node[-1]) - 1],
            "Prev": parent_mapping.get(node, []),
            "StuctureInstruction": f"The narrative structure is {narrative_obj['name']}, where {narrative_obj['description']} (eg. {narrative_obj['structure']}) The current chapter node is {node}, which is the {node[-1]}th chapter node in the narrative structure.",
        }

    return alignment


def get_alignment(
    topic,
    structure,
    seed=None,
):
    # Safely extract the desired narrative structure or default to the first one if not found
    structure_instruction = next(
        (s for s in structure_instructions_list if s["name"] == structure),
        None,
    )

    if not structure_instruction:
        print(
            f"No structure found with the name: {structure}. Using the first structure in the list."
        )
        structure_instruction = structure_instructions_list[0]

    print("Selected structure_instruction:", structure_instruction)

    # Check if the given topic exists in the narrative context
    if topic not in narrative_context:
        print(f"No context found for the topic: {topic}.")
        return None

    # The align_theme_entity function expects 'narrative_obj' and 'context' as its parameters.
    alignment_results = align_theme_entity(
        narrative_obj=structure_instruction,
        context_obj=narrative_context[topic],
        seed=seed,
    )

    return alignment_results


if __name__ == "__main__":
    # random select topic and structure
    TOPIC = "Muddle_Puddle"  # random.choice(keys_narrative_context)
    NARRATIVE_STRUCTURE = "Linear"  # random.choice(narrative_structure)

    print("=" * 50)

    print("Selected topic:", TOPIC)
    print("Selected narrative structure:", NARRATIVE_STRUCTURE)

    # Get the alignment results
    alignment_results = get_alignment(
        topic=TOPIC,
        structure=NARRATIVE_STRUCTURE,
        seed=42,
    )

    print("Generated alignment_results:", alignment_results)

    # Save the alignment results to a JSON file
    with open("alignment_results.json", "w") as file:
        json.dump(alignment_results, file)
