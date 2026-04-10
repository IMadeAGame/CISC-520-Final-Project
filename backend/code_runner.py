import subprocess
import tempfile
import os
import base64
from pathlib import Path


PREAMBLE = """
import pandas as pd
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.ticker as mticker
import seaborn as sns
import yfinance as yf
from scipy import stats
import io, base64, json, os, sys, warnings
warnings.filterwarnings("ignore")

# Bloomberg-style theme
BLOOMBERG_BG = "#000000"
BLOOMBERG_PANEL = "#0a0a0a"
BLOOMBERG_ORANGE = "#FF6600"
BLOOMBERG_WHITE = "#FFFFFF"
BLOOMBERG_GRAY = "#888888"
BLOOMBERG_LIGHT_GRAY = "#CCCCCC"
BLOOMBERG_GRID = "#222222"
BLOOMBERG_COLORS = ["#FF6600", "#00AAFF", "#FFD700", "#00CC88", "#FF3366", "#AA88FF", "#FF9933", "#33CCFF"]

matplotlib.rcParams.update({
    "figure.facecolor": BLOOMBERG_BG,
    "axes.facecolor": BLOOMBERG_PANEL,
    "axes.edgecolor": BLOOMBERG_GRAY,
    "axes.labelcolor": BLOOMBERG_LIGHT_GRAY,
    "axes.titlecolor": BLOOMBERG_WHITE,
    "axes.titlesize": 11,
    "axes.titleweight": "bold",
    "axes.labelsize": 9,
    "axes.grid": True,
    "axes.prop_cycle": matplotlib.cycler(color=BLOOMBERG_COLORS),
    "grid.color": BLOOMBERG_GRID,
    "grid.linewidth": 0.8,
    "grid.linestyle": "--",
    "xtick.color": BLOOMBERG_GRAY,
    "ytick.color": BLOOMBERG_GRAY,
    "xtick.labelsize": 8,
    "ytick.labelsize": 8,
    "text.color": BLOOMBERG_WHITE,
    "legend.facecolor": "#111111",
    "legend.edgecolor": BLOOMBERG_GRAY,
    "legend.labelcolor": BLOOMBERG_LIGHT_GRAY,
    "legend.fontsize": 8,
    "figure.titlesize": 13,
    "figure.titleweight": "bold",
    "lines.linewidth": 1.5,
    "patch.edgecolor": BLOOMBERG_GRAY,
    "savefig.facecolor": BLOOMBERG_BG,
    "savefig.edgecolor": BLOOMBERG_BG,
})

CSV_DATA = """


def run_code(code: str, csv_data: str | None = None, timeout: int = 30) -> dict:
    csv_repr = repr(csv_data) if csv_data is not None else "None"
    preamble = PREAMBLE + csv_repr + "\n"
    full_code = preamble + "\n" + code

    with tempfile.TemporaryDirectory() as tmp_dir:
        script_path = os.path.join(tmp_dir, "script.py")
        plot_path = os.path.join(tmp_dir, "plot.png")

        with open(script_path, "w") as f:
            f.write(full_code)

        try:
            result = subprocess.run(
                ["python3", script_path],
                capture_output=True,
                text=True,
                timeout=timeout,
                cwd=tmp_dir,
            )
            stdout = result.stdout
            stderr = result.stderr

        except subprocess.TimeoutExpired:
            return {
                "stdout": "",
                "stderr": f"Execution timed out after {timeout} seconds.",
                "image_b64": None,
            }
        except Exception as e:
            return {
                "stdout": "",
                "stderr": str(e),
                "image_b64": None,
            }

        image_b64 = None
        if os.path.exists(plot_path):
            with open(plot_path, "rb") as f:
                image_b64 = base64.b64encode(f.read()).decode("utf-8")

        return {
            "stdout": stdout,
            "stderr": stderr,
            "image_b64": image_b64,
        }
