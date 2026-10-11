"""Generates frontend/src/types/generated.ts from the backend's pydantic models — PRD §9:
"generate the frontend TypeScript types from the models so the two sides cannot drift."

Legacy: the OpenAPI-generated `frontend/src/api/openapi_schema.pure.lib.ts` (`make
gen-api`) supersedes this for new frontend code; it stays until nothing imports
`types/generated.ts`. A hand-rolled JSON-schema -> TS converter (`model_json_schema()`),
so it's one Python invocation with no Node dependency. Run `make gen-types`
(`python -m scripts.generate_ts_types`); never hand-edit the output.
"""

from collections.abc import Mapping
from pathlib import Path
from types import MappingProxyType
from typing import Final

from pydantic import BaseModel, ConfigDict, Field

from app.badges.badges_schemas_pure import BadgeStatus, ProfileStats
from app.events.events_schemas_pure import Event
from app.pathfinder.pathfinder_schemas_pure import (
    PathfinderCompletionsCreate,
    PathfinderCustomMap,
    PathfinderCustomMapCreate,
    PathfinderCustomMapUpdate,
    PublishedPathfinderMap,
)
from app.pieces.pieces_schemas_pure import (
    Illustration,
    IllustrationCreate,
    IllustrationGenerateRequest,
    Piece,
    PieceCreate,
    PieceUpdate,
    RemixVersion,
    RemixVersionCreate,
    RevisionPass,
    RevisionPassCreate,
    TurnLine,
    TurnLineCreate,
)
from app.play.play_schemas_pure import (
    Attempt,
    AttemptCreate,
    AttemptRead,
    GameMetadata,
    Item,
    Level,
    PlaySession,
    Rating,
    RatingCreate,
    Skill,
    SkillState,
    TelemetryCore,
    Variant,
    Verification,
    VerificationCreate,
)
from app.practice.practice_schemas_pure import PracticeConfig, PracticeConfigUpsert
from app.profiles.profiles_schemas_pure import (
    NewProfilePhoto,
    ProfileCreate,
    ProfilePhotoRead,
    ProfilePhotoRemixRequest,
    ProfilePhotoRemixResponse,
    ProfileRead,
    ProfileUnlockRequest,
    ProfileUpdate,
)

# The exported surface: every model the frontend contract touches, in output order.
MODELS: Final[tuple[type[BaseModel], ...]] = (
    ProfileRead,
    ProfileCreate,
    ProfileUpdate,
    ProfileUnlockRequest,
    ProfilePhotoRead,
    ProfilePhotoRemixRequest,
    ProfilePhotoRemixResponse,
    PracticeConfig,
    PracticeConfigUpsert,
    PathfinderCompletionsCreate,
    PathfinderCustomMap,
    PathfinderCustomMapCreate,
    PathfinderCustomMapUpdate,
    PublishedPathfinderMap,
    SkillState,
    Skill,
    GameMetadata,
    Level,
    Variant,
    Item,
    TelemetryCore,
    AttemptCreate,
    Attempt,
    AttemptRead,
    Event,
    PlaySession,
    Verification,
    VerificationCreate,
    Rating,
    RatingCreate,
    BadgeStatus,
    ProfileStats,
    PieceCreate,
    PieceUpdate,
    Piece,
    IllustrationCreate,
    IllustrationGenerateRequest,
    Illustration,
    RevisionPassCreate,
    RevisionPass,
    RemixVersionCreate,
    RemixVersion,
    TurnLineCreate,
    TurnLine,
)
# `NewProfilePhoto` is emitted as a $def of the profile bodies; imported so a rename fails here.
_NESTED: Final = (NewProfilePhoto,)

# Models exported under a different TS name than their Python class. The API returns
# `ProfileRead` (the row plus `has_password`, minus anything secret) everywhere a profile
# goes out, so the frontend's `Profile` *is* that shape.
TS_NAMES: Final[Mapping[type[BaseModel], str]] = MappingProxyType({ProfileRead: "Profile"})

OUTPUT_PATH: Final = Path(__file__).resolve().parents[2] / "frontend" / "src" / "types" / "generated.ts"

_PRIMITIVES: Final = MappingProxyType(
    {"string": "string", "integer": "number", "number": "number", "boolean": "boolean"}
)


class JsonSchema(BaseModel):
    """The slice of a pydantic JSON schema this converter reads, parsed at the door."""

    model_config = ConfigDict(frozen=True, populate_by_name=True)

    ref: str | None = Field(default=None, alias="$ref")
    any_of: list["JsonSchema"] | None = Field(default=None, alias="anyOf")
    type: str | None = None
    items: "JsonSchema | None" = None
    properties: dict[str, "JsonSchema"] | None = None
    required: list[str] = Field(default_factory=list)
    enum: list[str] | None = None
    defs: dict[str, "JsonSchema"] = Field(default_factory=dict, alias="$defs")


def _ts_type(schema: JsonSchema) -> str:
    if schema.ref is not None:
        return schema.ref.split("/")[-1]
    if schema.any_of is not None:
        return " | ".join(dict.fromkeys(_ts_type(sub) for sub in schema.any_of))  # de-duplicate, keep order
    if schema.type == "array":
        return f"{_ts_type(schema.items or JsonSchema())}[]"
    if schema.type == "object":
        return _render_fields(schema) if schema.properties is not None else "Record<string, any>"
    if schema.type == "null":
        return "null"
    return _PRIMITIVES.get(schema.type or "", "any")


def _render_fields(schema: JsonSchema) -> str:
    required = set(schema.required)
    lines = [
        f"  {name}{'' if name in required else '?'}: {_ts_type(sub)};"
        for name, sub in (schema.properties or {}).items()
    ]
    return "{\n" + "\n".join(lines) + "\n}"


def _render(name: str, schema: JsonSchema) -> str:
    if schema.enum is not None:
        values = " | ".join(f'"{value}"' for value in schema.enum)
        return f"export type {name} = {values};\n"
    return f"export interface {name} {_render_fields(schema)}\n"


def generate() -> str:
    chunks = [
        "// AUTO-GENERATED by backend/scripts/generate_ts_types.py — do not hand-edit.",
        "// Regenerate with `make gen-types` after changing any model in backend/app/models/.",
        "",
    ]
    emitted: set[str] = set()
    for model in MODELS:
        schema = JsonSchema.model_validate(model.model_json_schema())
        for def_name, def_schema in schema.defs.items():
            if def_name not in emitted:
                emitted.add(def_name)
                chunks.append(_render(def_name, def_schema))
        ts_name = TS_NAMES.get(model, model.__name__)
        if ts_name not in emitted:
            emitted.add(ts_name)
            chunks.append(_render(ts_name, schema))
    return "\n".join(chunks) + "\n"


def main() -> None:
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(generate())
    print(f"wrote {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
