from typing import *
from pydantic import BaseModel, Field


class Chapter(BaseModel):
    title: str = Field(description="Title of the chapter.")
    time_period: List[str] = Field(
        description="Time period of the chapter (start date, end date)."
    )
    themes: List[str] = Field(description="Themes related within chapter.")
    entity: List[str] = Field(description="Entity mentioned within chapter.")
    content: str = Field(description="Content of the chapter.")


class Story(BaseModel):
    chapters: List[Chapter] = Field(description="List of chapters.")
