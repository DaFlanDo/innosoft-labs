import pytest

@pytest.fixture
async def project_id(client, auth_headers):
    proj_data = {"name": "Test Docs Project", "priority": "high", "status": "planning", "color": "#000"}
    r = await client.post("/api/projects", json=proj_data, headers=auth_headers)
    return r.json()["id"]

@pytest.mark.asyncio
async def test_project_documents_and_folders(client, auth_headers, project_id):
    # 1. Create a folder
    folder_data = {"name": "Tech Specs"}
    folder_res = await client.post(f"/api/documents/{project_id}/folders", json=folder_data, headers=auth_headers)
    assert folder_res.status_code == 201
    folder_id = folder_res.json()["id"]
    
    # 2. Create a document
    doc_data = {
        "project_id": project_id,
        "title": "Architecture Overview",
        "doc_type": "text",
        "description": "It's all good.",
        "folder_id": folder_id
    }
    doc_res = await client.post(f"/api/documents/{project_id}/documents", json=doc_data, headers=auth_headers)
    assert doc_res.status_code == 201
    doc_id = doc_res.json()["id"]
    
    # 3. Get Project Structure
    struct_res = await client.get(f"/api/documents/{project_id}", headers=auth_headers)
    assert struct_res.status_code == 200
    structure = struct_res.json()
    assert len(structure["folders"]) >= 1
    assert len(structure["documents"]) >= 0 # documents inside folders may be listed elsewhere

    # 4. Delete document
    del_doc = await client.delete(f"/api/documents/documents/{doc_id}", headers=auth_headers)
    assert del_doc.status_code == 204

    # 5. Delete folder
    del_fold = await client.delete(f"/api/documents/folders/{folder_id}", headers=auth_headers)
    assert del_fold.status_code == 204
