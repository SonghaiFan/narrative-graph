{
 "cells": [
  {
   "cell_type": "code",
   "execution_count": 7,
   "metadata": {},
   "outputs": [],
   "source": [
    "import json\n",
    "\n",
    "# Reading the content of the provided files\n",
    "with open(\"stories/story_Politics_Convergence_seed42.json\", \"r\") as story_file:\n",
    "    story_data = json.load(story_file)\n",
    "\n",
    "with open(\"meta/narrative_structure.json\", \"r\") as structure_file:\n",
    "    structure_data = json.load(structure_file)\n",
    "\n",
    "# Displaying the first few records for understanding\n",
    "story_data_preview = story_data[\"chapters\"][:2] if \"chapters\" in story_data else {}\n",
    "structure_data_preview = structure_data"
   ]
  },
  {
   "cell_type": "code",
   "execution_count": 2,
   "metadata": {},
   "outputs": [
    {
     "data": {
      "text/plain": [
       "{'nodes': [{'index': 1,\n",
       "   'label': 'A1: Media Influence and the Bridgeside Pact',\n",
       "   'time_period': ['2020-03-04', '2020-12-13'],\n",
       "   'themes': ['Media Influence'],\n",
       "   'entity': ['The Bridgeside Pact Signing',\n",
       "    'Chancellor Eric Weber',\n",
       "    'Gregory Collins',\n",
       "    'Rashida Al-Amin']},\n",
       "  {'index': 2,\n",
       "   'label': 'B1: Democratic Renewal',\n",
       "   'time_period': ['2020-03-04', '2020-12-13'],\n",
       "   'themes': ['Democratic Renewal', 'The Grand Assembly Inauguration'],\n",
       "   'entity': ['Chancellor Eric Weber']},\n",
       "  {'index': 3,\n",
       "   'label': 'A2: Chancellor Weber',\n",
       "   'time_period': ['2020-12-13', '2021-09-23'],\n",
       "   'themes': ['Media Influence'],\n",
       "   'entity': ['Chancellor Eric Weber']},\n",
       "  {'index': 4,\n",
       "   'label': 'A3: Media Influence and the Bridgeside Pact',\n",
       "   'time_period': ['2021-09-23', '2022-07-05'],\n",
       "   'themes': ['Media Influence'],\n",
       "   'entity': ['The Bridgeside Pact Signing', 'Chancellor Eric Weber']}],\n",
       " 'edges': [{'start_node': 1, 'end_node': 3, 'labels': 'Chancellor Weber'},\n",
       "  {'start_node': 3,\n",
       "   'end_node': 4,\n",
       "   'labels': 'Media Influence and the Bridgeside Pact'},\n",
       "  {'start_node': 2, 'end_node': 3, 'labels': 'Chancellor Weber'}]}"
      ]
     },
     "execution_count": 2,
     "metadata": {},
     "output_type": "execute_result"
    }
   ],
   "source": [
    "def generate_graph_data(story_data, structure_data):\n",
    "    \"\"\"\n",
    "    Generate graph data based on story data and narrative structure.\n",
    "    \n",
    "    Args:\n",
    "    - story_data (dict): Contains chapters with details.\n",
    "    - structure_data (list): List of narrative structures.\n",
    "    \n",
    "    Returns:\n",
    "    - dict: Graph data with nodes and edges.\n",
    "    \"\"\"\n",
    "    \n",
    "    # Extract chapters from story data\n",
    "    chapters = story_data[\"chapters\"]\n",
    "    \n",
    "    # Identify the correct structure based on the chapters in the story data\n",
    "    structure = None\n",
    "    for s in structure_data:\n",
    "        if all(chapter[\"id\"] in s[\"nodes\"] for chapter in chapters):\n",
    "            structure = s\n",
    "            break\n",
    "    \n",
    "    if not structure:\n",
    "        return {\"error\": \"No matching structure found.\"}\n",
    "    \n",
    "    # Generate nodes\n",
    "    nodes = []\n",
    "    for index, chapter in enumerate(chapters, start=1):\n",
    "        nodes.append({\n",
    "            \"index\": index,\n",
    "            \"label\": f\"{chapter['id']}: {chapter['title'].split(':')[0]}\",\n",
    "            \"time_period\": chapter[\"time_period\"],\n",
    "            \"themes\": chapter[\"themes\"],\n",
    "            \"entity\": chapter[\"entity\"]\n",
    "        })\n",
    "    \n",
    "    # Generate edges\n",
    "    edges = []\n",
    "    for edge in structure[\"edges\"]:\n",
    "        start_node = next((node[\"index\"] for node in nodes if node[\"label\"].split(\":\")[0] == edge[\"from\"]), None)\n",
    "        end_node = next((node[\"index\"] for node in nodes if node[\"label\"].split(\":\")[0] == edge[\"to\"]), None)\n",
    "        label = next((node[\"label\"].split(\":\")[1].strip() for node in nodes if node[\"label\"].split(\":\")[0] == edge[\"to\"]), None)\n",
    "        \n",
    "        edges.append({\n",
    "            \"start_node\": start_node,\n",
    "            \"end_node\": end_node,\n",
    "            \"labels\": label\n",
    "        })\n",
    "    \n",
    "    return {\n",
    "        \"nodes\": nodes,\n",
    "        \"edges\": edges\n",
    "    }\n",
    "\n",
    "# Generating graph data using the function\n",
    "graph_data = generate_graph_data(story_data, structure_data_preview)\n",
    "graph_data\n"
   ]
  },
  {
   "cell_type": "code",
   "execution_count": 9,
   "metadata": {},
   "outputs": [],
   "source": [
    "import json\n",
    "import pygraphviz as pgv\n",
    "\n",
    "def save_graph_json(graph_json, output_file=\"graph.json\"):\n",
    "    # Convert to JSON string if it's a dict\n",
    "    if isinstance(graph_json, dict):\n",
    "        graph_json = json.dumps(graph_json, indent=4)\n",
    "\n",
    "    with open(output_file, \"w\") as f:\n",
    "        f.write(graph_json)\n",
    "        print(\"Graph json saved to\", output_file)\n",
    "\n",
    "\n",
    "\n",
    "def plot_graph(graph_json, output_file=\"output.png\", direction=\"LR\"):\n",
    "    # Parse the JSON if it's a string\n",
    "    if isinstance(graph_json, str):\n",
    "        graph_data = json.loads(graph_json)\n",
    "    else:\n",
    "        graph_data = graph_json\n",
    "\n",
    "    # Create a new graph\n",
    "    G = pgv.AGraph(directed=True, rankdir=direction)\n",
    "\n",
    "    # Add nodes\n",
    "    for node in graph_data[\"nodes\"]:\n",
    "        label = \", \".join(node[\"time_period\"]) + \" \" + node[\"label\"]\n",
    "        G.add_node(node[\"index\"], label=label)\n",
    "\n",
    "    # Add edges\n",
    "    for edge in graph_data[\"edges\"]:\n",
    "        G.add_edge(edge[\"start_node\"], edge[\"end_node\"], label=edge[\"labels\"])\n",
    "\n",
    "    # Draw the graph\n",
    "    G.draw(output_file, prog=\"dot\")\n",
    "    print(\"Graph saved to\", output_file)\n",
    "    "
   ]
  },
  {
   "cell_type": "code",
   "execution_count": 10,
   "metadata": {},
   "outputs": [
    {
     "name": "stdout",
     "output_type": "stream",
     "text": [
      "Graph saved to graphs/graph.png\n",
      "Graph json saved to graphs/graph.json\n"
     ]
    }
   ],
   "source": [
    "out_graphs_path = \"graphs/graph\"\n",
    "plot_graph(graph_data, f\"{out_graphs_path}.png\", direction=\"TB\")\n",
    "save_graph_json(graph_data, f\"{out_graphs_path}.json\")"
   ]
  },
  {
   "cell_type": "code",
   "execution_count": null,
   "metadata": {},
   "outputs": [],
   "source": []
  }
 ],
 "metadata": {
  "kernelspec": {
   "display_name": "nlp",
   "language": "python",
   "name": "python3"
  },
  "language_info": {
   "codemirror_mode": {
    "name": "ipython",
    "version": 3
   },
   "file_extension": ".py",
   "mimetype": "text/x-python",
   "name": "python",
   "nbconvert_exporter": "python",
   "pygments_lexer": "ipython3",
   "version": "3.8.16"
  },
  "orig_nbformat": 4
 },
 "nbformat": 4,
 "nbformat_minor": 2
}
