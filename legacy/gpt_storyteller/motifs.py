import numpy as np
import matplotlib.pyplot as plt
import itertools
import pandas as pd


def valid_configuration_general(matrix, m, n, X):
    """Check if a matrix configuration is valid based on the constraints."""
    if np.sum(matrix) != X:
        return False
    col_sums = np.sum(matrix, axis=0)
    if np.sum(col_sums > 0) < 2:
        return False
    for i in range(n - 1):
        if col_sums[i] == 0 and col_sums[i + 1] != 0:
            return False
    return True


def find_narrative_motifs(m, n, X):
    """Find all valid narrative motifs for a general m x n grid with X nodes."""
    configurations = []
    unique_configs = set()
    for matrix in itertools.product([0, 1], repeat=m * n):
        matrix = np.array(matrix).reshape(m, n)
        if valid_configuration_general(matrix, m, n, X):
            matrix_tuple = tuple(map(tuple, matrix))
            if matrix_tuple not in unique_configs:
                unique_configs.add(matrix_tuple)
                for perm in itertools.permutations(matrix_tuple):
                    unique_configs.add(perm)
                configurations.append(matrix)
    return configurations


def calculate_metrics(motif, m, n):
    """Calculate the defined metrics for a given motif.
    Time Coverage: Measures the range of time the narrative covers. A higher value indicates a longer coverage.
    Theme Complexity: Indicates how many different themes are engaged in a narrative. A higher value suggests a more complex theme engagement.
    Theme Persistence: Measures how long a theme persists over time on average. A higher value means a theme persists longer.
    Transitions: Counts the number of edges that cross different rows (themes). A higher value indicates more transitions.
    Density: Measures how "packed" the narrative is. A value closer to 1 suggests a denser narrative.
    Centralization: Checks the distribution of the narrative across themes. A lower value means the narrative is more evenly spread out.

    """

    # Time Coverage
    time_coverage = (
        np.max(np.where(np.any(motif, axis=0))[0])
        - np.min(np.where(np.any(motif, axis=0))[0])
        + 1
    )

    # Theme Complexity
    theme_complexity = np.sum(np.sum(motif, axis=1) > 0)

    # Theme Persistence
    theme_persistence = np.mean(
        [max(map(len, "".join(map(str, row)).split("0"))) for row in motif]
    )

    # Transitions
    transitions = 0
    for c in range(n - 1):  # we skip the last column
        for r in range(m):
            if motif[r][c] == 1:
                # Count all the 1s in the next column except the current row
                transitions += sum(motif[:, c + 1]) - motif[r][c + 1]

    # Density
    density = np.sum(motif) / (m * n)

    # Centralization
    centralization = np.var(np.sum(motif, axis=1))

    metrics = {
        "time_coverage": time_coverage,
        "theme_complexity": theme_complexity,
        "theme_persistence": theme_persistence,
        "transitions": transitions,
        # "density": density,
        "centralization": centralization,
    }

    return metrics


def plot_motifs_with_metrics(configurations, metrics_df, m, n):
    """Plot the narrative motifs with metrics as captions."""
    num_configs = len(configurations)
    cols = int(np.ceil(np.sqrt(num_configs)))
    rows = (num_configs + cols - 1) // cols
    colors = plt.cm.viridis(np.linspace(0, 1, m))
    labels = [chr(65 + i) for i in range(m)]

    fig, axs = plt.subplots(rows, cols, figsize=(5 * cols, 5 * rows))
    axs = np.array(axs).reshape(rows, -1)

    for i in range(rows):
        for j in range(cols):
            idx = i * cols + j
            ax = axs[i, j]
            if idx < num_configs:
                matrix = configurations[idx]
                for x in range(n):
                    for y in range(m):
                        if matrix[y, x] == 1:
                            circle = plt.Circle(
                                (x, m - 1 - y),
                                0.4,
                                color=colors[y],
                                ec="black",
                                zorder=2,
                            )
                            ax.add_patch(circle)
                            ax.text(
                                x,
                                m - 1 - y,
                                f"{labels[y]}{x+1}",
                                color="white",
                                weight="bold",
                                ha="center",
                                va="center",
                                zorder=3,
                            )

                for x in range(n - 1):
                    for y1 in range(m):
                        for y2 in range(m):
                            if matrix[y1, x] == 1 and matrix[y2, x + 1] == 1:
                                ax.plot(
                                    [x, x + 1],
                                    [m - 1 - y1, m - 1 - y2],
                                    color="black",
                                    zorder=1,
                                )

                ax.set_xlim(-1, n)
                ax.set_ylim(-1, m)
                ax.axis("off")
                ax.set_aspect("equal", "box")
                metrics_text = "\n".join(
                    [
                        f"{col}: {metrics_df.iloc[idx][col]:.2f}"
                        for col in metrics_df.columns
                    ]
                )
                ax.set_title(metrics_text, fontsize=12, y=-0.15)
            else:
                ax.axis("off")

    plt.suptitle(f"Narrative Motifs for {m}x{n} Grid with {X} Nodes", fontsize=16)
    plt.tight_layout()
    plt.subplots_adjust(top=0.92)
    plt.show()


if __name__ == "__main__":
    # m is the number of themes
    # n is the number of time frames
    # X is the number of nodes
    m, n, X = 3, 3, 3
    configurations = find_narrative_motifs(m, n, X)
    motif_metrics = [calculate_metrics(motif, m, n) for motif in configurations]
    df_metrics = pd.DataFrame(motif_metrics)
    plot_motifs_with_metrics(configurations, df_metrics, m, n)
