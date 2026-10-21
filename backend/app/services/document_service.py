from uuid import UUID
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.db.models import ProjectDocument, ProjectFolder, User

async def list_project_structure(db: AsyncSession, project_id: UUID):
    # Load folders
    f_res = await db.execute(select(ProjectFolder).where(ProjectFolder.project_id == str(project_id)))
    folders = f_res.scalars().all()
    
    # Load documents
    d_res = await db.execute(
        select(ProjectDocument)
        .options(selectinload(ProjectDocument.author))
        .where(ProjectDocument.project_id == str(project_id))
        .order_by(desc(ProjectDocument.created_at))
    )
    docs = d_res.scalars().all()
    
    return {
        "folders": [{
            "id": f.id,
            "project_id": f.project_id,
            "name": f.name,
            "parent_id": f.parent_id,
            "created_at": f.created_at
        } for f in folders],
        "documents": [{
            "id": d.id,
            "project_id": d.project_id,
            "folder_id": d.folder_id,
            "author_id": d.author_id,
            "title": d.title,
            "description": d.description,
            "doc_type": d.doc_type,
            "file_url": d.file_url,
            "external_url": d.external_url,
            "created_at": d.created_at,
            "updated_at": d.updated_at,
            "author_name": d.author.name if d.author else "System"
        } for d in docs]
    }

async def create_folder(db: AsyncSession, project_id: UUID, name: str, parent_id: UUID | None = None):
    folder = ProjectFolder(
        project_id=str(project_id),
        name=name,
        parent_id=str(parent_id) if parent_id else None
    )
    db.add(folder)
    await db.commit()
    return folder

async def create_document(db: AsyncSession, project_id: UUID, author_id: UUID, body: object):
    doc = ProjectDocument(
        project_id=str(project_id),
        folder_id=str(body.folder_id) if hasattr(body, 'folder_id') and body.folder_id else None,
        author_id=str(author_id),
        title=body.title,
        description=body.description,
        doc_type=body.doc_type,
        file_url=body.file_url,
        external_url=body.external_url
    )
    db.add(doc)
    await db.commit()
    return doc

async def delete_document(db: AsyncSession, doc_id: UUID):
    doc = await db.get(ProjectDocument, str(doc_id))
    if doc:
        await db.delete(doc)
        await db.commit()
        return True
    return False

async def delete_folder(db: AsyncSession, folder_id: UUID):
    folder = await db.get(ProjectFolder, str(folder_id))
    if folder:
        await db.delete(folder)
        await db.commit()
        return True
    return False

async def get_document(db: AsyncSession, doc_id: UUID):
    return await db.get(ProjectDocument, str(doc_id))

async def get_folder(db: AsyncSession, folder_id: UUID):
    return await db.get(ProjectFolder, str(folder_id))
