from pydantic import BaseModel
from typing import Any


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatResponse(BaseModel):
    reply: str
    code_blocks: list[str]
    images: list[str]
    tables: list[list[dict[str, Any]]]
