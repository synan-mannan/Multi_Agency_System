import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useStore, useViewingAs, useCurrentWorkspaceId } from '@/store';
import { downloadFile } from '@/api/files';
import { Badge, Button, Select, Label, Textarea, EmptyState } from '@/components/ui';
import { reviewConfig, formatDateShort, cn } from '@/lib/utils';
import { Upload, FileText, Check, RefreshCw, Paperclip, Download, Trash2 } from 'lucide-react';
import type { ProjectFile, FileReviewStatus, Visibility } from '@/types';

function VisibilityBadge({ v }: { v: Visibility }) {
  return (
    <Badge variant={v === 'internal' ? 'zinc' : 'blue'} className="text-[10px] capitalize">
      {v === 'internal' ? '🔒 Internal' : '👁 Client'}
    </Badge>
  );
}

function ReviewBadge({ status }: { status: FileReviewStatus }) {
  const cfg = reviewConfig[status];
  return <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-md', cfg.color)}>{cfg.label}</span>;
}

// ─── Simulated Upload Progress ─────────────────────────────────────────────────

function UploadProgress({ name, progress }: { name: string; progress: number }) {
  return (
    <div className="flex items-center gap-3 p-3 bg-indigo-50  rounded-lg border border-indigo-200 ">
      <Paperclip size={14} className="text-indigo-500 flex-shrink-0" />
      <div className="flex-1">
        <p className="text-xs font-medium text-zinc-700 ">{name}</p>
        <div className="mt-1 h-1 bg-indigo-100  rounded-full overflow-hidden">
          <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>
      <span className="text-xs text-indigo-600 font-medium">{progress}%</span>
    </div>
  );
}

// ─── Client Review Actions ─────────────────────────────────────────────────────

function ClientReviewRow({ file }: { file: ProjectFile }) {
  const updateFileReview = useStore((s) => s.updateFileReview);
  const pushToast = useStore((s) => s.pushToast);
  const [note, setNote] = useState('');
  const [open, setOpen] = useState(false);

  const approve = async () => {
    try {
      await updateFileReview(file.id, 'approved', null);
      pushToast({ title: `"${file.name}" approved`, variant: 'success' });
    } catch (error) {
      pushToast({ title: 'File review failed', description: error instanceof Error ? error.message : 'Request failed', variant: 'error' });
    }
  };

  const requestChanges = () => {
    if (!note.trim()) { setOpen(true); return; }
    void updateFileReview(file.id, 'changes_requested', note).then(() => {
      pushToast({ title: `Changes requested on "${file.name}"`, variant: 'default' });
      setOpen(false);
      setNote('');
    }).catch((error: unknown) => {
      pushToast({ title: 'File review failed', description: error instanceof Error ? error.message : 'Request failed', variant: 'error' });
    });
  };

  if (file.reviewStatus !== 'pending') return null;

  return (
    <div className="mt-2 space-y-2">
      <div className="flex gap-2">
        <Button variant="primary" size="sm" onClick={approve}>
          <Check size={12} /> Approve
        </Button>
        <Button variant="outline" size="sm" onClick={() => setOpen(!open)}>
          <RefreshCw size={12} /> Request Changes
        </Button>
      </div>
      {open && (
        <div className="space-y-2">
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Describe the changes needed…"
            rows={2}
          />
          <Button variant="danger" size="sm" onClick={requestChanges}>Submit Request</Button>
        </div>
      )}
    </div>
  );
}

// ─── Files Tab ─────────────────────────────────────────────────────────────────

export const FilesTab: React.FC<{ projectId: string }> = ({ projectId }) => {
  const viewingAs = useViewingAs();
  const workspaceId = useCurrentWorkspaceId();
  const pushToast = useStore((s) => s.pushToast);
  const uploadTaskFile = useStore((s) => s.uploadTaskFile);
  const updateFileVisibility = useStore((s) => s.updateFileVisibility);
  const deleteFile = useStore((s) => s.deleteFile);
  const loadProjectFiles = useStore((s) => s.loadProjectFiles);
  const allFiles = useStore((s) => s.files);
  const allTasks = useStore((s) => s.tasks);
  const tasks = useMemo(() => allTasks.filter((task) => task.projectId === projectId), [allTasks, projectId]);
  const users = useStore((s) => s.users);
  const fileState = useStore((s) => s.fileState);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<Record<string, number>>({});
  const [uploadVisibility, setUploadVisibility] = useState<Visibility>('client');
  const [uploadTaskId, setUploadTaskId] = useState('');
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [fileActionId, setFileActionId] = useState<string | null>(null);

  const files = allFiles.filter((file) => file.workspaceId === workspaceId && file.projectId === projectId);

  useEffect(() => {
    void loadProjectFiles(projectId).catch((error: unknown) => {
      pushToast({ title: 'Files could not be loaded', description: error instanceof Error ? error.message : 'Request failed', variant: 'error' });
    });
  }, [projectId, loadProjectFiles, pushToast]);
  useEffect(() => {
    if (!tasks.some((task) => task.id === uploadTaskId) && tasks[0]) setUploadTaskId(tasks[0].id);
  }, [tasks, uploadTaskId]);

  const uploadSelectedFile = async (file: File) => {
    const task = tasks.find((item) => item.id === uploadTaskId);
    if (!task) {
      pushToast({ title: 'Upload unavailable', description: 'Create a task in this project before uploading files.', variant: 'error' });
      return;
    }
    setUploading((current) => ({ ...current, [file.name]: 0 }));
    try {
      await uploadTaskFile(task.id, file, uploadVisibility, (progress) =>
        setUploading((current) => ({ ...current, [file.name]: progress })),
      );
      pushToast({ title: `"${file.name}" uploaded`, variant: 'success' });
    } catch (error) {
      pushToast({ title: 'File upload failed', description: error instanceof Error ? error.message : 'Request failed', variant: 'error' });
    } finally {
      setUploading((current) => {
        const next = { ...current };
        delete next[file.name];
        return next;
      });
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    Array.from(e.target.files ?? []).forEach((file) => void uploadSelectedFile(file));
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    Array.from(e.dataTransfer.files).forEach((file) => void uploadSelectedFile(file));
  };

  const handleVisibilityChange = async (file: ProjectFile, visibility: Visibility) => {
    setFileActionId(file.id);
    try {
      await updateFileVisibility(file.id, visibility);
      pushToast({ title: `"${file.name}" visibility updated`, variant: 'success' });
    } catch (error) {
      pushToast({ title: 'File visibility could not be updated', description: error instanceof Error ? error.message : 'Request failed', variant: 'error' });
    } finally {
      setFileActionId(null);
    }
  };

  const handleDelete = async (file: ProjectFile) => {
    if (!window.confirm(`Delete "${file.name}"? This cannot be undone.`)) return;
    setFileActionId(file.id);
    try {
      await deleteFile(file.id);
      pushToast({ title: `"${file.name}" deleted`, variant: 'success' });
    } catch (error) {
      pushToast({ title: 'File could not be deleted', description: error instanceof Error ? error.message : 'Request failed', variant: 'error' });
    } finally {
      setFileActionId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Upload Zone */}
      {viewingAs !== 'client' && (
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Label>Visibility for new uploads</Label>
            <Select
              value={uploadVisibility}
              onChange={(v) => setUploadVisibility(v as Visibility)}
              options={[
                { value: 'client', label: '👁 Client-visible' },
                { value: 'internal', label: '🔒 Internal' },
              ]}
              className="w-44 h-8 text-xs"
            />
            <Label htmlFor="file-task">Attach to task</Label>
            <Select
              id="file-task"
              value={uploadTaskId}
              onChange={setUploadTaskId}
              options={tasks.map((task) => ({ value: task.id, label: task.title }))}
              className="w-52 h-8 text-xs"
            />
          </div>
          <div
            className={cn(
              'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors',
              isDraggingOver
                ? 'border-indigo-400 bg-indigo-50 '
                : 'border-zinc-200  hover:border-indigo-300 hover:bg-zinc-50 ',
            )}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setIsDraggingOver(true); }}
            onDragLeave={() => setIsDraggingOver(false)}
            onDrop={handleDrop}
          >
            <Upload size={24} className="mx-auto text-zinc-400 mb-2" />
            <p className="text-sm font-medium text-zinc-600 ">Drop files here or click to upload</p>
            <p className="text-xs text-zinc-400 mt-1">Any file type supported</p>
            <input ref={fileInputRef} type="file" multiple hidden onChange={handleFileInput} />
          </div>

          {/* Upload progress */}
          {Object.entries(uploading).map(([name, progress]) => (
            <UploadProgress key={name} name={name} progress={progress} />
          ))}
        </div>
      )}

      {/* Files Table */}
      {fileState.error && <p role="alert" className="text-sm text-red-600">{fileState.error}</p>}
      {fileState.loading && files.length === 0 ? (
        <div className="h-20 animate-pulse rounded-xl bg-zinc-100" />
      ) : files.length === 0 ? (
        <EmptyState icon={<FileText size={40} />} title="No files yet" description="Upload files to share with your client" />
      ) : (
        <div className="space-y-2">
          {files.map((file) => {
            const uploader = users.find((u) => u.id === file.uploadedById);
            return (
              <div
                key={file.id}
                className="bg-white  border border-zinc-200  rounded-xl p-4 space-y-1"
              >
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="h-9 w-9 rounded-lg bg-zinc-100  flex items-center justify-center flex-shrink-0">
                    <span className="text-[10px] font-bold text-zinc-500">{file.type}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-800  truncate">{file.name}</p>
                    <p className="text-xs text-zinc-500">{file.size} · {uploader?.name} · {formatDateShort(file.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {viewingAs !== 'client' ? (
                      <Select
                        aria-label={`Visibility for ${file.name}`}
                        value={file.visibility}
                        onChange={(value) => void handleVisibilityChange(file, value as Visibility)}
                        options={[
                          { value: 'client', label: '👁 Client-visible' },
                          { value: 'internal', label: '🔒 Internal' },
                        ]}
                        disabled={fileActionId === file.id}
                        className="w-36 h-8 text-xs"
                      />
                    ) : <VisibilityBadge v={file.visibility} />}
                    <ReviewBadge status={file.reviewStatus} />
                    <Button variant="ghost" size="sm" aria-label={`Download ${file.name}`} onClick={() => void downloadFile(file.id).catch((error: unknown) => pushToast({ title: 'Download failed', description: error instanceof Error ? error.message : 'Request failed', variant: 'error' }))}>
                      <Download size={13} />
                    </Button>
                    {viewingAs !== 'client' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Delete ${file.name}`}
                        disabled={fileActionId === file.id}
                        onClick={() => void handleDelete(file)}
                      >
                        <Trash2 size={13} className="text-red-600" />
                      </Button>
                    )}
                  </div>
                </div>
                {file.reviewNote && (
                  <p className="text-xs text-red-600  bg-red-50  px-2 py-1 rounded">
                    Note: {file.reviewNote}
                  </p>
                )}
                {viewingAs === 'client' && <ClientReviewRow file={file} />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
