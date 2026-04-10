import json
import logging
from huggingface_hub import InferenceClient
from models import ChatResponse
from system_prompt import SYSTEM_PROMPT
from tools import TOOLS, execute_tool

logger = logging.getLogger(__name__)

MAX_ITERATIONS = 8
MAX_RETRIES = 2
MODEL = "Qwen/Qwen2.5-72B-Instruct"


def run_agent(
    messages: list[dict],
    csv_data: str | None,
    client: InferenceClient,
) -> ChatResponse:
    internal_messages = [{"role": "system", "content": SYSTEM_PROMPT}]

    if csv_data:
        truncated = csv_data[:50000]
        internal_messages.append({"role": "user", "content": f"[CSV UPLOAD]\n{truncated}"})
        internal_messages.append({"role": "assistant", "content": "CSV received. I will access its content via the CSV_DATA variable in my code."})

    for msg in messages:
        internal_messages.append({"role": msg["role"], "content": msg["content"]})

    collected_code_blocks: list[str] = []
    collected_images: list[str] = []
    collected_tables: list[list[dict]] = []
    final_reply = ""
    retry_count = 0

    for _ in range(MAX_ITERATIONS):
        response = client.chat.completions.create(
            model=MODEL,
            messages=internal_messages,
            tools=TOOLS,
            max_tokens=4096,
        )

        choice = response.choices[0]
        finish_reason = choice.finish_reason
        message = choice.message

        if finish_reason == "stop" or not message.tool_calls:
            final_reply = message.content or ""
            break

        if finish_reason == "tool_calls":
            internal_messages.append({
                "role": "assistant",
                "content": message.content,
                "tool_calls": [
                    {
                        "id": tc.id,
                        "type": "function",
                        "function": {"name": tc.function.name, "arguments": tc.function.arguments},
                    }
                    for tc in message.tool_calls
                ],
            })

            has_error = False
            last_error = ""

            for tc in message.tool_calls:
                fn_name = tc.function.name
                fn_args = json.loads(tc.function.arguments)

                if "code" in fn_args:
                    collected_code_blocks.append(fn_args["code"])

                logger.info("tool_call: %s | code_snippet: %.200s", fn_name, fn_args.get("code", ""))
                result_str = execute_tool(fn_name, fn_args, csv_data)
                result = json.loads(result_str)
                logger.info("tool_result: stdout=%.300s | stderr=%.300s", result.get("stdout", "")[:300], result.get("stderr", "")[:300])

                if result.get("image_b64"):
                    collected_images.append(result["image_b64"])

                stdout = result.get("stdout", "").strip()
                if stdout and (stdout.startswith("[") or stdout.startswith("{")):
                    try:
                        parsed = json.loads(stdout)
                        if isinstance(parsed, list):
                            collected_tables.append(parsed)
                        elif isinstance(parsed, dict):
                            collected_tables.append([parsed])
                    except json.JSONDecodeError:
                        pass

                stderr = result.get("stderr", "")
                if stderr and not all(
                    "warning" in line.lower() or not line.strip()
                    for line in stderr.splitlines()
                ):
                    has_error = True
                    last_error = stderr

                internal_messages.append({
                    "role": "tool",
                    "tool_call_id": tc.id,
                    "content": result_str,
                })

            if has_error and retry_count < MAX_RETRIES:
                retry_count += 1
                internal_messages.append({
                    "role": "user",
                    "content": (
                        f"The code produced an error:\n{last_error}\n\n"
                        "Please analyze the error carefully, fix the issue, and call run_python_code again with corrected code."
                    ),
                })

        else:
            final_reply = message.content or ""
            break

    return ChatResponse(
        reply=final_reply,
        code_blocks=collected_code_blocks,
        images=collected_images,
        tables=collected_tables,
    )
