import json
from code_runner import run_code

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "run_python_code",
            "description": (
                "Execute Python code in a sandboxed environment. "
                "Returns stdout, stderr, and any matplotlib plot saved as 'plot.png' encoded as base64. "
                "Use this for ALL data analysis, computation, visualization, and file analysis tasks. "
                "The environment has pandas, numpy, matplotlib (Agg), seaborn, yfinance, scipy pre-imported. "
                "For CSV uploads, access the data via the CSV_DATA variable."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "code": {
                        "type": "string",
                        "description": (
                            "Valid Python source code to execute. "
                            "Save all plots with: plt.savefig('plot.png', dpi=150, bbox_inches='tight'); plt.close(). "
                            "For CSV data, use: df = pd.read_csv(io.StringIO(CSV_DATA))."
                        )
                    }
                },
                "required": ["code"]
            }
        }
    }
]


def execute_tool(tool_name: str, tool_input: dict, csv_data: str | None) -> str:
    if tool_name == "run_python_code":
        result = run_code(tool_input["code"], csv_data=csv_data)
        return json.dumps(result)
    return json.dumps({"stdout": "", "stderr": f"Unknown tool: {tool_name}", "image_b64": None})
