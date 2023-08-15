import warnings
from IPython.display import display, Markdown
from gpt_cartographer import Node, Edge, Graph, make_graph

# ignore warnings
warnings.filterwarnings("ignore")


time_range = "2020-3-4, 2022-7-5"

# fictional entities (people, places, organizations, places, event, etc.)

entities = """
- Johnathan "Johnny" Hammersmith - A controversial tech billionaire known for his eccentric behavior and flamboyant public appearances. ;
- Amelia Spector - A prominent politician who recently announced her campaign for the presidency. ;
- Brightwood - A bustling city known for its technological innovations and vibrant nightlife. ;
- Thornfield University - A prestigious institution of higher education embroiled in a recent academic scandal. ;
- Orion Technologies - A leading tech company in Brightwood, currently under investigation for potential data privacy violations. ;
- The Emerald Coalition - An influential political organization supporting environmental causes. ;
"""

# fictional themes (topics)

themes = """
- Technology Innovation
- Data Privacy
- Politics
- Education
"""

structure_instructions = """
    The graph should contains only three nodes and two edges.
    Simlar format : A -> B -> C
    """

graph = make_graph(
    time_range=time_range,
    entities=entities,
    themes=themes,
    model_name="gpt-4",
    temperature=0,
    structure_instructions=structure_instructions,
)
display(Markdown(f"```json\n{graph.json(indent=2)}\n```"))
