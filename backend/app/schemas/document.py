from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, ConfigDict

class FolderCreate(BaseModel):
    name: str
    parent_id: UUID | None = None

class FolderOut(BaseModel):
    id: UUID
    project_id: UUID
    name: str
    parent_id: UUID | None = None
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

class DocumentCreate(BaseModel):
    project_id: UUID
    folder_id: UUID | None = None
    title: str
    description: str | None = None
    doc_type: str = "text"   # text | link | file
    file_url: str | None = None
    external_url: str | None = None

class DocumentOut(BaseModel):
    id: UUID
    project_id: UUID
    folder_id: UUID | None
    author_id: UUID | None
    title: str
    description: str | None
    doc_type: str
    file_url: str | None
    external_url: str | None
    created_at: datetime
    updated_at: datetime
    author_name: str | None = None

    model_config = ConfigDict(from_attributes=True)

class ProjectStructureOut(BaseModel):
    folders: list[FolderOut]
    documents: list[DocumentOut]
