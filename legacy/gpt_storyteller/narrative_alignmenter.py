import json
import datetime
import random


with open("meta/narrtaive_structure.json", "r") as file:
    structure_instructions_list = json.load(file)

with open("meta/simple_narrative_structure.json", "r") as file:
    simple_structure_instructions_list = json.load(file)

# Load data from 'narrative_context.json'
with open("meta/narrative_context.json", "r") as file:
    narrative_context = json.load(file)


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


def align_theme_entity(narrative_obj, context, seed=None):
    # Set seed for reproducibility
    if seed:
        random.seed(seed)

    themes = context["Themes"].copy()
    entities_data = context["Entities"]
    times = context["Time"]

    # Collect all entities into a list E and sample 5
    E = [ent for category in entities_data.values() for ent in category]
    E = random.sample(E, 7)

    print("entities_data", E)

    # Identify unique prefixes in the narrative structure
    prefixes = set(node[0] for node in narrative_obj["nodes"])

    print("prefixes", prefixes)

    # Pre-allocate a unique theme for each prefix
    theme_allocation = {}
    for prefix in prefixes:
        theme_allocation[prefix] = themes.pop(random.randrange(len(themes)))

    # Generate time periods
    if len(times) == 2:  # If only start and end dates are provided
        num_periods = max([int(n[-1]) for n in narrative_obj["nodes"]])
        print("num_periods", num_periods)
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
    for i, node in enumerate(narrative_obj["nodes"]):
        num_entities_for_node = random.randint(
            1, len(E) - len(narrative_obj["nodes"]) + i + 1
        )  # Ensure all entities are used
        entities_for_node = [
            ent["name"] for ent in random.sample(E, num_entities_for_node)
        ]

        theme_obj = theme_allocation[node[0]]

        alignment[node] = {
            "Theme": theme_obj["name"],
            "Entity": entities_for_node,
            "Time": periods[int(node[-1]) - 1],
            "Prev": parent_mapping.get(node, []),
            "Description": f"{theme_obj['name']}: {theme_obj['description']}"
            + "\n"
            + "\n".join(
                [
                    f"{e['name']}: {e['description']}"
                    for e in E
                    if e["name"] in entities_for_node
                ]
            ),
        }

    return alignment


def get_alignment(
    topic="Politics",
    structure="SharpMerge",
    level="Simple",
    seed=None,
):
    instructions_list = (
        simple_structure_instructions_list
        if level == "Simple"
        else structure_instructions_list
    )

    # Safely extract the desired narrative structure or default to the first one if not found
    structure_instruction = next(
        (s for s in instructions_list if s["name"] == structure),
        None,
    )

    if not structure_instruction:
        print(
            f"No structure found with the name: {structure}. Using the first structure in the list."
        )
        structure_instruction = instructions_list[0]

    print("Selected structure_instruction:", structure_instruction)

    # The align_theme_entity function expects 'narrative_obj' and 'context' as its parameters.

    alignment_results = align_theme_entity(
        narrative_obj=structure_instruction, context=narrative_context[topic], seed=seed
    )

    return alignment_results


if __name__ == "__main__":
    TOPIC = "Science & Health"
    NARRATIVE_STRUCTURE = "SharpMerge"

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
