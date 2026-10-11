"""The admin login body. A wire shape: part of the API contract (`make check-api`)."""

from pydantic import BaseModel, ConfigDict


class AdminLoginRequest(BaseModel):
    model_config = ConfigDict(frozen=True)

    password: str
