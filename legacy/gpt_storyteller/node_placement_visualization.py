def is_valid_general(matrix, m, n, X):
    total_nodes = sum(sum(row) for row in matrix)
    if total_nodes != X:
        return False

    columns_with_nodes = sum(1 for j in range(n) if any(matrix[i][j] for i in range(m)))
    if columns_with_nodes < 2:
        return False

    for j in range(n - 1):
        if sum(matrix[i][j] for i in range(m)) == 0 and any(
            matrix[i][j + 1] for i in range(m)
        ):
            return False

    return True


def canonical_form_general(matrix):
    return tuple(sorted(tuple(row) for row in matrix))


def find_matrices_general(index, matrix, m, n, current_X, X, unique_matrices):
    if current_X == 0:
        if is_valid_general(matrix, m, n, X):
            unique_matrices.add(canonical_form_general(matrix))
        return

    if index == m * n or (m * n - index < current_X):
        return

    row, col = divmod(index, n)

    matrix[row][col] = 1
    find_matrices_general(index + 1, matrix, m, n, current_X - 1, X, unique_matrices)

    matrix[row][col] = 0
    find_matrices_general(index + 1, matrix, m, n, current_X, X, unique_matrices)


def generalized_solution(m, n, X):
    matrix = [[0] * n for _ in range(m)]
    unique_matrices = set()

    find_matrices_general(0, matrix, m, n, X, X, unique_matrices)

    unique_matrices_list = [
        list(list(row) for row in matrix_tuple) for matrix_tuple in unique_matrices
    ]
    return unique_matrices_list


import numpy as np
import matplotlib.pyplot as plt


def plot_matrices(matrices, m, n, X):
    num_matrices = len(matrices)
    cols = int(np.ceil(np.sqrt(num_matrices)))
    rows = (num_matrices + cols - 1) // cols
    colors = plt.cm.viridis(np.linspace(0, 1, m))
    labels = [chr(65 + i) for i in range(m)]
    fig, axs = plt.subplots(rows, cols, figsize=(5 * cols, 5 * rows))
    axs = np.array(axs).reshape(rows, -1)
    for i in range(rows):
        for j in range(cols):
            idx = i * cols + j
            ax = axs[i, j]
            if idx < num_matrices:
                matrix = matrices[idx]
                for row_idx, row in enumerate(matrix):
                    for col_idx, value in enumerate(row):
                        if value == 1:
                            x, y = col_idx, m - 1 - row_idx
                            circle = plt.Circle(
                                (x, y),
                                0.4,
                                color=colors[row_idx % len(colors)],
                                ec="black",
                                zorder=2,
                            )
                            ax.add_patch(circle)
                            node_label = f"{labels[row_idx]}{col_idx+1}"
                            ax.text(
                                x,
                                y,
                                node_label,
                                color="white",
                                weight="bold",
                                ha="center",
                                va="center",
                                zorder=3,
                            )
                ax.set_xlim(-1, n)
                ax.set_ylim(-1, m)
                ax.axis("off")
                ax.set_aspect("equal", "box")
            else:
                ax.axis("off")
    plt.suptitle(f"Matrices for {m}x{n} Grid with {X} Nodes", y=1.02)
    plt.tight_layout()
    plt.show()


if __name__ == "__main__":
    m = 3
    n = 3
    X = 4
    solution = generalized_solution(m, n, X)
    plot_matrices(solution, m, n, X)
