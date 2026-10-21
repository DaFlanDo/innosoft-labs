from typing import Annotated
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.dependencies import get_db, get_current_user
from app.db.models import User
from app.schemas.document import DocumentCreate, DocumentOut, FolderCreate, FolderOut, ProjectStructureOut
from app.services import document_service, storage_service
from app.core.permissions import require_project_role, is_admin
import uuid

router = APIRouter(prefix="/api/documents", tags=["Documents"])

@router.get("/{project_id}", response_model=ProjectStructureOut)
async def get_project_structure(
    project_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Get folders and documents for a project."""
    await require_project_role(db, project_id, current_user, min_role="viewer")
    return await document_service.list_project_structure(db, project_id)

@router.post("/{project_id}/folders", response_model=FolderOut, status_code=status.HTTP_201_CREATED)
async def create_folder(
    project_id: UUID,
    body: FolderCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Create a folder in a project."""
    await require_project_role(db, project_id, current_user, min_role="manager")
    return await document_service.create_folder(db, project_id, body.name, body.parent_id)

@router.post("/{project_id}/documents", response_model=DocumentOut, status_code=status.HTTP_201_CREATED)
async def create_document(
    project_id: UUID,
    body: DocumentCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Create a document."""
    await require_project_role(db, project_id, current_user, min_role="manager")
    return await document_service.create_document(db, project_id, current_user.id, body)

@router.post("/{project_id}/upload", response_model=DocumentOut, status_code=status.HTTP_201_CREATED)
async def upload_document_file(
    project_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    folder_id: UUID | None = None,
    file: UploadFile = File(...),
):
    """Upload a physical file and create a document record."""
    await require_project_role(db, project_id, current_user, min_role="manager")
    
    file_content = await file.read()
    ext = file.filename.split(".")[-1] if "." in file.filename else "bin"
    file_key = f"docs/{project_id}/{uuid.uuid4()}.{ext}"
    
    file_url = storage_service.upload_file(file_key, file_content, content_type=file.content_type)
    
    # Create document record
    doc_body = DocumentCreate(
        project_id=project_id,
        folder_id=folder_id,
        title=file.filename,
        description=f"Uploaded file: {file.filename}",
        doc_type="file",
        file_url=file_url
    )
    
    return await document_service.create_document(db, project_id, current_user.id, doc_body)

@router.delete("/folders/{folder_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_folder(
    folder_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    folder = await document_service.get_folder(db, folder_id)
    if not folder:
        raise HTTPException(404, "Folder not found")
    await require_project_role(db, folder.project_id, current_user, min_role="manager")
    await document_service.delete_folder(db, folder_id)
    return None

@router.delete("/documents/{doc_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    doc_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    doc = await document_service.get_document(db, doc_id)
    if not doc:
        raise HTTPException(404, "Document not found")
    if not is_admin(current_user) and str(doc.author_id) != str(current_user.id):
        await require_project_role(db, doc.project_id, current_user, min_role="manager")
    await document_service.delete_document(db, doc_id)
    return None
