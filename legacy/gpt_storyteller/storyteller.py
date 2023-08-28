import json
import os
import sys
from typing import Optional

# from narrative_alignmenter import get_alignment
from narrative_alignmenter2 import get_alignment
from narrative_deducer import create_story


def generate_story_files(section: str, narrative_structure: str, seed: int):
    # Define folders
    alignment_folder = "alignment"
    stories_folder = "stories"
    log_folder = "logs"

    # Generate filenames based on the provided inputs
    filename_suffix = f"{section}_{narrative_structure}_seed{seed}.json"
    alignment_filename = f"alignment_{filename_suffix}"
    story_filename = f"story_{filename_suffix}"
    log_filename = f"log_{filename_suffix}"

    # Check if folders exist, if not, create them
    for folder in [alignment_folder, stories_folder, log_folder]:
        if not os.path.exists(folder):
            os.makedirs(folder)

    # Paths for the files
    alignment_path = os.path.join(alignment_folder, alignment_filename)
    story_path = os.path.join(stories_folder, story_filename)
    log_path = os.path.join(log_folder, log_filename)

    # Redirect standard output to log file
    sys.stdout = open(log_path, "w")

    print("Fetching alignment results...")
    # Get the alignment results
    alignment_results = get_alignment(
        topic=section,
        structure=narrative_structure,
        seed=seed,
    )
    print(f"Alignment results fetched for topic: {section}.")

    # Save the alignment results to a JSON file
    with open(alignment_path, "w") as file:
        json.dump(alignment_results, file)
    print(f"Alignment results saved to {alignment_path}.")

    # Load alignment results from the file
    with open(alignment_path, "r") as file:
        loaded_alignment_results = json.load(file)

    print("Generating story based on alignment results...")
    # Create a story based on the loaded alignment results
    story = create_story(loaded_alignment_results)
    print("Story generation complete!")

    # Save the story to a JSON file
    with open(story_path, "w") as file:
        json.dump(story.dict(), file, indent=4)
    print(f"Story saved to {story_path}.")

    # Close the log file
    sys.stdout.close()


# with open("meta/narrative_structure.json", "r") as file:
#     structure_instructions_list = json.load(file)

# narrative_structure = [item["name"] for item in structure_instructions_list]

# print("narrative_structure", narrative_structure)

# # Load data from 'narrative_context.json'
# with open("meta/narrative_context2.json", "r") as file:
#     narrative_context = json.load(file)

# print("narrative_context", narrative_context)

# keys_narrative_context = list(narrative_context.keys())

# Example usage:
if __name__ == "__main__":
    the_keys_narrative_context = [
        "World_News",
        # "Politics",
        # "Business_and_Economy",
        # "Science_and_Technology",
        # "Culture_and_Entertainment"
    ]

    the_narrative_structure = [
        "SimpleLinear",
        # "SimpleFork",
        # "SimpleWideMerge",
        # "SimpleWideBranch",
        # "SimpleSharpMerge",
        # "SimpleSharpBranch",
        # "Linear",
        # "Divergence",
        # "Convergence",
        # "Diamond",
        # "Hanger",
        # "Parallelogram",
        # "ComplexCombined"
    ]

    # For the simple narrative structures
    for section in the_keys_narrative_context:
        for structure in the_narrative_structure:
            generate_story_files(section, structure, 29)
