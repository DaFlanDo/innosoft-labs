from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, ConfigDict

class ActivityOut(BaseModel):
    id: UUID
    project_id: UUID | None = None
    task_id: UUID | None = None
    user_id: UUID
    type: str # task_created, status_changed, comment_added, attachment_added
    content: str
    created_at: datetime
    
    user_name: str | None = None
    project_name: str | None = None
    task_title: str | None = None

    model_config = ConfigDict(from_attributes=True)
