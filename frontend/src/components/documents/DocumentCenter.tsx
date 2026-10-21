import React, { useEffect, useState, useRef } from 'react';
import { api } from '../../api/client';
import { useStore } from '../../store/useStore';
import type { ProjectDocument, ProjectFolder, ProjectStructure } from '../../types';
import { useToast } from '../../hooks/useToast';
import { formatDate } from '../../utils';
import { CustomSelect } from '../ui/CustomSelect';

interface Props {
  projectId?: string;
}

export function DocumentCenter({ projectId: initialProjectId }: Props) {
  const { projects, currentUser } = useStore();
  const showToast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [selectedProjectId, setSelectedProjectId] = useState<string>(initialProjectId || (projects[0]?.id || ''));
  const [structure, setStructure] = useState<ProjectStructure>({ folders: [], documents: [] });
  const [loading, setLoading] = useState(false);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  
  // Modals
  const [showAddDoc, setShowAddDoc] = useState(false);
  const [showAddFolder, setShowAddFolder] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  
  // Form states
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [url, setUrl] = useState('');
  const [docType, setDocType] = useState<'text' | 'link'>('text');
  const [folderName, setFolderName] = useState('');

  const projectOptions = projects.map(p => ({ value: p.id, label: p.name }));

  const loadStructure = async (pid: string) => {
    if (!pid) return;
    setLoading(true);
    try {
      const data = await api.getProjectStructure(pid);
      setStructure(data);
    } catch (e) {
      console.error('Failed to load structure:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedProjectId) {
      loadStructure(selectedProjectId);
      setCurrentFolderId(null);
    }
  }, [selectedProjectId]);

  const handleCreateDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) return;
    try {
      await api.createDocument(selectedProjectId, {
        title,
        description: desc,
        doc_type: docType,
        folder_id: currentFolderId,
        external_url: docType === 'link' ? url : undefined,
      });
      showToast('Документ добавлен');
      setTitle(''); setDesc(''); setUrl(''); setShowAddDoc(false);
      loadStructure(selectedProjectId);
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setLoading(true);
    try {
      await api.uploadDocument(selectedProjectId, file, currentFolderId || undefined);
      showToast('Файл загружен');
      loadStructure(selectedProjectId);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderName) return;
    try {
      await api.createFolder(selectedProjectId, folderName, currentFolderId || undefined);
      showToast('Папка создана');
      setFolderName(''); setShowAddFolder(false);
      loadStructure(selectedProjectId);
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleDeleteDoc = async (id: string) => {
    if (!confirm('Удалить документ?')) return;
    try {
      await api.deleteDocument(id);
      showToast('Документ удален');
      loadStructure(selectedProjectId);
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleDeleteFolder = async (id: string) => {
    if (!confirm('Удалить папку и всё содержимое?')) return;
    try {
      await api.deleteFolder(id);
      showToast('Папка удалена');
      loadStructure(selectedProjectId);
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const canManage = currentUser?.system_role === 'admin' || currentUser?.system_role === 'manager';

  // Navigation
  const parentFolder = currentFolderId ? structure.folders.find(f => f.id === currentFolderId) : null;
  const breadcrumbs: ProjectFolder[] = [];
  let temp = parentFolder;
  while(temp) {
    breadcrumbs.unshift(temp);
    temp = temp.parent_id ? structure.folders.find(f => f.id === temp!.parent_id) : null;
  }

  const currentFolders = structure.folders.filter(f => f.parent_id === (currentFolderId || null));
  const currentDocs = structure.documents.filter(d => d.folder_id === (currentFolderId || null));

  return (
    <div className="doc-center">
      <div className="doc-center-toolbar">
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          {!initialProjectId && (
            <div className="doc-project-selector">
              <CustomSelect 
                value={selectedProjectId} 
                options={projectOptions} 
                onChange={setSelectedProjectId} 
                style={{ minWidth: 200 }}
              />
            </div>
          )}
          <nav className="doc-breadcrumbs">
            <span className={`crumb ${!currentFolderId ? 'active' : ''}`} onClick={() => setCurrentFolderId(null)}>Корневая папка</span>
            {breadcrumbs.map(f => (
              <React.Fragment key={f.id}>
                <span className="crumb-sep">/</span>
                <span className={`crumb ${currentFolderId === f.id ? 'active' : ''}`} onClick={() => setCurrentFolderId(f.id)}>{f.name}</span>
              </React.Fragment>
            ))}
          </nav>
        </div>

        {canManage && (
          <div className="doc-actions">
            <button className="btn btn-secondary btn-sm" onClick={() => setShowAddFolder(true)}>
              📁 Новая папка
            </button>
            <div className="doc-add-dropdown-container">
              <button className="btn btn-primary btn-sm" onClick={() => setShowAddMenu(!showAddMenu)}>
                ➕ Добавить ▾
              </button>
              {showAddMenu && (
                <div className="doc-add-menu">
                  <button onClick={() => { setShowAddDoc(true); setDocType('text'); setShowAddMenu(false); }}>📄 Заметка</button>
                  <button onClick={() => { setShowAddDoc(true); setDocType('link'); setShowAddMenu(false); }}>🔗 Ссылка</button>
                  <button onClick={() => { fileInputRef.current?.click(); setShowAddMenu(false); }}>📤 Файл</button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileUpload} />

      {showAddFolder && (
        <div className="doc-modal-overlay">
          <form className="doc-modal-form" onSubmit={handleCreateFolder}>
            <h3>Новая папка</h3>
            <div className="form-group">
              <label>Название</label>
              <input value={folderName} onChange={e => setFolderName(e.target.value)} placeholder="Напр. Дизайн" autoFocus required />
            </div>
            <div className="form-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setShowAddFolder(false)}>Отмена</button>
              <button type="submit" className="btn btn-primary">Создать</button>
            </div>
          </form>
        </div>
      )}

      {showAddDoc && (
        <div className="doc-modal-overlay">
          <form className="doc-modal-form" onSubmit={handleCreateDoc}>
            <h3>Новый документ</h3>
            <div className="form-group">
              <label>Тип</label>
              <div className="doc-type-switch">
                <button type="button" className={docType === 'text' ? 'active' : ''} onClick={() => setDocType('text')}>Заметка</button>
                <button type="button" className={docType === 'link' ? 'active' : ''} onClick={() => setDocType('link')}>Ссылка</button>
              </div>
            </div>
            <div className="form-group">
              <label>Заголовок</label>
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Напр. ТЗ проекта" required />
            </div>
            {docType === 'link' && (
              <div className="form-group">
                <label>URL</label>
                <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://..." required />
              </div>
            )}
            <div className="form-group">
              <label>Описание</label>
              <textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="Краткое описание..." />
            </div>
            <div className="form-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setShowAddDoc(false)}>Отмена</button>
              <button type="submit" className="btn btn-primary">Сохранить</button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="loading-dots">Загрузка структуры...</div>
      ) : (
        <div className="doc-explorer">
          {currentFolderId && (
            <div className="doc-item folder back" onClick={() => setCurrentFolderId(parentFolder?.parent_id || null)}>
              <div className="doc-item-icon">⬅️</div>
              <div className="doc-item-info">
                <div className="doc-item-title">Назад</div>
              </div>
            </div>
          )}

          {currentFolders.map(f => (
            <div key={f.id} className="doc-item folder">
              <div className="doc-item-main" onClick={() => setCurrentFolderId(f.id)}>
                <div className="doc-item-icon">📂</div>
                <div className="doc-item-info">
                  <div className="doc-item-title">{f.name}</div>
                  <div className="doc-item-meta">{formatDate(f.created_at)}</div>
                </div>
              </div>
              {canManage && (
                <button className="btn-icon delete" onClick={() => handleDeleteFolder(f.id)}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>
              )}
            </div>
          ))}

          {currentDocs.map(d => (
            <div key={d.id} className={`doc-item document ${d.doc_type}`}>
              <div className="doc-item-main">
                <div className="doc-item-icon">
                  {d.doc_type === 'link' ? '🔗' : d.doc_type === 'file' ? '📎' : '📄'}
                </div>
                <div className="doc-item-info">
                  <div className="doc-item-title">{d.title}</div>
                  <div className="doc-item-desc">{d.description}</div>
                  <div className="doc-item-meta">
                    <span>{d.author_name}</span>
                    <span>•</span>
                    <span>{formatDate(d.created_at)}</span>
                  </div>
                </div>
              </div>
              <div className="doc-item-actions">
                {d.doc_type === 'link' && (
                  <a href={d.external_url} target="_blank" rel="noopener noreferrer" className="btn-icon" title="Открыть ссылку">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/></svg>
                  </a>
                )}
                {d.doc_type === 'file' && (
                  <a href={d.file_url} download={d.title} className="btn-icon" title="Скачать файл">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                  </a>
                )}
                {canManage && (
                  <button className="btn-icon delete" onClick={() => handleDeleteDoc(d.id)}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                  </button>
                )}
              </div>
            </div>
          ))}

          {currentFolders.length === 0 && currentDocs.length === 0 && !currentFolderId && (
            <div className="empty-state">
              <p>В этом проекте пока пусто</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
