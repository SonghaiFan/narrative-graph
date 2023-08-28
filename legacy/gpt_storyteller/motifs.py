import numpy as np
import matplotlib.pyplot as plt
import itertools
import pandas as pd

# Redefining all the necessary functions


def valid_configuration_general(matrix, n):
    """Check if a matrix configuration is valid based on the constraints for a general n x n grid."""
    if np.sum(matrix) != n:
        return False
    col_sums = np.sum(matrix, axis=0)
    if np.sum(col_sums > 0) < 2:
        return False
    for i in range(n - 1):
        if col_sums[i] == 0 and col_sums[i + 1] != 0:
            return False
    return True


def find_narrative_motifs(n):
    """Find all valid narrative motifs for a general n x n grid."""
    configurations = []
    unique_configs = set()
    for matrix in itertools.product([0, 1], repeat=n * n):
        matrix = np.array(matrix).reshape(n, n)
        if valid_configuration_general(matrix, n):
            matrix_tuple = tuple(map(tuple, matrix))
            if matrix_tuple not in unique_configs:
                unique_configs.add(matrix_tuple)
                for perm in itertools.permutations(matrix_tuple):
                    unique_configs.add(perm)
                configurations.append(matrix)
    return configurations


def calculate_metrics(motif, n):
    """
    Calculate the defined metrics for a given motif.

    Parameters:
    - motif: A 2D numpy array representing the narrative motif.
    - n: The number of themes or rows in the motif.

    Returns:
    A dictionary containing metrics.
    """
    metrics = {}

    # Time Coverage: The range of time the narrative covers.
    cols_with_nodes = np.where(np.sum(motif, axis=0) > 0)[0]
    metrics["time_coverage"] = cols_with_nodes[-1] - cols_with_nodes[0] + 1

    # Theme Complexity: Indicates how many different themes are engaged in a narrative.
    metrics["theme_complexity"] = np.sum(np.sum(motif, axis=1) > 0)

    return metrics


# Redefine the plot function and generate the plot
def plot_motifs_with_metrics(configurations, metrics_df, n):
    """Plot the narrative motifs with metrics as captions."""
    num_configs = len(configurations)
    cols = 4
    rows = (num_configs + cols - 1) // cols
    colors = plt.cm.viridis(np.linspace(0, 1, n))
    labels = [chr(65 + i) for i in range(n)]

    fig, axs = plt.subplots(rows, cols, figsize=(5 * cols, 5 * rows))
    if rows == 1:
        axs = axs.reshape(1, -1)
    for i in range(rows):
        for j in range(cols):
            idx = i * cols + j
            ax = axs[i, j]
            if idx < num_configs:
                matrix = configurations[idx]
                for x in range(n):
                    for y in range(n):
                        if matrix[y, x] == 1:
                            circle = plt.Circle(
                                (x, n - 1 - y),
                                0.4,
                                color=colors[y],
                                ec="black",
                                zorder=2,
                            )
                            ax.add_patch(circle)
                            ax.text(
                                x,
                                n - 1 - y,
                                f"{labels[y]}{x+1}",
                                color="white",
                                weight="bold",
                                ha="center",
                                va="center",
                                zorder=3,
                            )
                for x in range(n - 1):
                    for y1 in range(n):
                        for y2 in range(n):
                            if matrix[y1, x] == 1 and matrix[y2, x + 1] == 1:
                                ax.plot(
                                    [x, x + 1],
                                    [n - 1 - y1, n - 1 - y2],
                                    color="black",
                                    zorder=1,
                                )
                ax.set_xlim(-1, n)
                ax.set_ylim(-1, n)
                ax.axis("off")
                ax.set_aspect("equal", "box")
                metrics_text = "\n".join(
                    [
                        f"{col}: {metrics_df.iloc[idx][col]:.2f}"
                        for col in metrics_df.columns
                    ]
                )
                ax.set_title(metrics_text, fontsize=8, y=-0.15)
            else:
                ax.axis("off")
    plt.suptitle(f"Narrative Motifs for {n}x{n} Grid with {n} Nodes", fontsize=16)
    plt.tight_layout()
    plt.subplots_adjust(top=0.92)
    plt.show()


if __name__ == "__main__":
    # Re-generate the narrative motifs and metrics for a 3x3 grid
    n = 3
    configurations_3x3 = find_narrative_motifs(n)
    motif_metrics_3x3 = [calculate_metrics(motif, n) for motif in configurations_3x3]
    df_metrics = pd.DataFrame(motif_metrics_3x3)
    plot_motifs_with_metrics(configurations_3x3, df_metrics, n)
