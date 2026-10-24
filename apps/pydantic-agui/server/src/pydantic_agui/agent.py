import os
from datetime import UTC, datetime

from pydantic_ai import Agent
from pydantic_ai.models import Model
from pydantic_ai.models.anthropic import AnthropicModel
from pydantic_ai.providers.anthropic import AnthropicProvider

DEFAULT_MODEL = "claude-haiku-5-5"

INSTRUCTIONS = """\
You are a concise assistant in a demo of TanStack AI clients talking to a
Pydantic AI backend over AG-UI. Use your tools when they help, and say which
tool you used.
"""


def anthropic_model() -> Model:
    """Claude through the Anthropic API."""
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY is not set. Run the server through `varlock run`.")
    name = os.environ.get("ANTHROPIC_MODEL", DEFAULT_MODEL)
    return AnthropicModel(name, provider=AnthropicProvider(api_key=api_key))


# No model is set here so importing this module needs no API key. The server
# passes a model per request; tests pass a stub.
agent = Agent(instructions=INSTRUCTIONS)


@agent.tool_plain
def current_time() -> str:
    """Return the current UTC time as an ISO 8601 string."""
    return datetime.now(UTC).isoformat(timespec="seconds")


@agent.tool_plain
def roll_dice(sides: int = 6, count: int = 1) -> list[int]:
    """Roll `count` dice with `sides` sides each and return the results."""
    import random

    sides = max(2, min(sides, 1000))
    count = max(1, min(count, 20))
    return [random.randint(1, sides) for _ in range(count)]
