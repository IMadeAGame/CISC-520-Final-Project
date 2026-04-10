import json
import logging
import time
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
    t_start = time.monotonic()
    user_prompt = messages[-1]["content"] if messages else ""
    logger.info("[agent] start | prompt=%.120s | csv=%s", user_prompt, bool(csv_data))

    internal_messages = [{"role": "system", "content": SYSTEM_PROMPT}]

    if csv_data:
        truncated = csv_data[:50000]
        internal_messages.append({"role": "user", "content": f"[CSV UPLOAD]\n{truncated}"})
        internal_messages.append({"role": "assistant", "content": "CSV received. I will access its content via the CSV_DATA variable in my code."})
        logger.info("[agent] csv injected | chars=%d", len(truncated))

    for msg in messages:
        internal_messages.append({"role": msg["role"], "content": msg["content"]})

    collected_code_blocks: list[str] = []
    collected_images: list[str] = []
    collected_tables: list[list[dict]] = []
    final_reply = ""
    retry_count = 0

    for iteration in range(MAX_ITERATIONS):
        t_llm = time.monotonic()
        logger.info("[agent] iteration=%d | messages=%d | calling LLM", iteration, len(internal_messages))

        response = client.chat.completions.create(
            model=MODEL,
            messages=internal_messages,
            tools=TOOLS,
            max_tokens=4096,
        )

        llm_ms = int((time.monotonic() - t_llm) * 1000)
        choice = response.choices[0]
        finish_reason = choice.finish_reason
        message = choice.message
        logger.info("[agent] iteration=%d | finish_reason=%s | llm_ms=%d", iteration, finish_reason, llm_ms)

        if finish_reason == "stop" or not message.tool_calls:
            final_reply = message.content or ""
            logger.info("[agent] end_turn | reply_chars=%d", len(final_reply))
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
                code = fn_args.get("code", "")

                if code:
                    collected_code_blocks.append(code)

                logger.info("[tool] call | fn=%s | code_lines=%d | code_preview=%.150s",
                            fn_name, code.count("\n") + 1, code.replace("\n", " "))

                t_tool = time.monotonic()
                result_str = execute_tool(fn_name, fn_args, csv_data)
                tool_ms = int((time.monotonic() - t_tool) * 1000)
                result = json.loads(result_str)

                stdout = result.get("stdout", "").strip()
                stderr = result.get("stderr", "").strip()
                has_image = bool(result.get("image_b64"))

                logger.info("[tool] result | fn=%s | tool_ms=%d | stdout_chars=%d | has_image=%s | stderr_chars=%d",
                            fn_name, tool_ms, len(stdout), has_image, len(stderr))

                if stderr:
                    logger.warning("[tool] stderr | fn=%s | stderr=%.400s", fn_name, stderr)

                if has_image:
                    collected_images.append(result["image_b64"])
                    logger.info("[tool] image captured | fn=%s", fn_name)

                if stdout and (stdout.startswith("[") or stdout.startswith("{")):
                    try:
                        parsed = json.loads(stdout)
                        if isinstance(parsed, list):
                            collected_tables.append(parsed)
                        elif isinstance(parsed, dict):
                            collected_tables.append([parsed])
                        logger.info("[tool] table parsed | rows=%d", len(parsed) if isinstance(parsed, list) else 1)
                    except json.JSONDecodeError:
                        pass

                real_error = stderr and not all(
                    "warning" in line.lower() or not line.strip()
                    for line in stderr.splitlines()
                )
                if real_error:
                    has_error = True
                    last_error = stderr

                internal_messages.append({
                    "role": "tool",
                    "tool_call_id": tc.id,
                    "content": result_str,
                })

            if has_error and retry_count < MAX_RETRIES:
                retry_count += 1
                logger.warning("[agent] self-correction | attempt=%d/%d | error=%.200s",
                               retry_count, MAX_RETRIES, last_error)
                internal_messages.append({
                    "role": "user",
                    "content": (
                        f"The code produced an error:\n{last_error}\n\n"
                        "Please analyze the error carefully, fix the issue, and call run_python_code again with corrected code."
                    ),
                })

        else:
            final_reply = message.content or ""
            logger.info("[agent] unexpected finish_reason=%s | reply_chars=%d", finish_reason, len(final_reply))
            break

    total_ms = int((time.monotonic() - t_start) * 1000)
    logger.info("[agent] done | iterations=%d | images=%d | tables=%d | code_blocks=%d | total_ms=%d",
                iteration + 1, len(collected_images), len(collected_tables), len(collected_code_blocks), total_ms)

    return ChatResponse(
        reply=final_reply,
        code_blocks=collected_code_blocks,
        images=collected_images,
        tables=collected_tables,
    )
