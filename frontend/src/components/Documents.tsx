import { ApiError, requestResponse } from '../api/client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { useApi } from '../api/useApi';
import { useResource } from '../hooks/useResource';
import { type Document as WorkDocument, PAGE_SIZE, date } from '../api/work';
import { Feedback, Pagination } from './Feedback';

function PdfPreview({ url, name, close }: { url: string; name: string; close: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  // The preview owns its temporary URL and releases it when closed.
  useEffect(() => {
    dialog.current?.showModal();
    return () => URL.revokeObjectURL(url);
  }, [url]);
  return (
    <dialog
      ref={dialog}
      onCancel={close}
      aria-label={`PDF preview: ${name}`}
      className="pdf-dialog"
    >
      <div className="preview-heading">
        <h2>{name}</h2>
        <button className="button" onClick={close}>
          Close preview
        </button>
      </div>
      <iframe title={name} src={url} />
      <p className="muted hint">
        If your browser cannot display this PDF, close the preview and use Download.
      </p>
    </dialog>
  );
}

export function Documents({ leadId }: { leadId: string }) {
  const { token, signOut, user } = useAuth();
  const api = useApi();
  const [showUpload, setShowUpload] = useState(false);
  const [page, setPage] = useState(0);
  const path = `/leads/${leadId}/documents`;
  const { data, error, reload } = useResource<WorkDocument[]>(
    `${path}?limit=${PAGE_SIZE + 1}&offset=${page * PAGE_SIZE}`,
  );
  const input = useRef<HTMLInputElement>(null);
  const uploading = useRef(false);
  const [busy, setBusy] = useState(false);
  const [downloadBusy, setDownloadBusy] = useState<string | null>(null);
  const [failure, setFailure] = useState('');
  const [success, setSuccess] = useState('');
  const [preview, setPreview] = useState<{ url: string; name: string } | null>(null);
  async function upload(event: FormEvent) {
    event.preventDefault();
    if (uploading.current) {
      return;
    }
    setFailure('');
    setSuccess('');
    const file = input.current?.files?.[0];
    if (!file) {
      setFailure('Choose a PDF to upload.');
      return;
    }
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setFailure('Please choose a PDF file.');
      return;
    }
    // The ref prevents two quick clicks before React updates the disabled button.
    uploading.current = true;
    setBusy(true);
    const body = new FormData();
    body.append('file', file);
    try {
      await api<WorkDocument>(path, { method: 'POST', body });
      setSuccess(`${file.name} uploaded.`);
      setShowUpload(false);
      if (input.current) {
        input.current.value = '';
      }
      setPage(0);
      reload();
    } catch (error) {
      setFailure(error instanceof Error ? error.message : 'Upload failed. Please try again.');
    } finally {
      uploading.current = false;
      setBusy(false);
    }
  }
  async function open(file: WorkDocument, view: boolean) {
    setFailure('');
    setDownloadBusy(file.id);
    try {
      const response = await requestResponse(
        `/documents/${file.id}/download`,
        {},
        token ?? undefined,
      );
      // Fetch with auth first, then let the browser display or save those bytes.
      const url = URL.createObjectURL(await response.blob());
      if (view) {
        setPreview({ url, name: file.filename });
      } else {
        const link = document.createElement('a');
        link.href = url;
        link.download = file.filename;
        link.click();
        /* Give the browser time to start saving before releasing the URL. */ setTimeout(
          () => URL.revokeObjectURL(url),
          1000,
        );
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        signOut();
        return;
      }
      setFailure(error instanceof Error ? error.message : 'Unable to retrieve the PDF.');
    } finally {
      setDownloadBusy(null);
    }
  }
  return (
    <section className="card documents" aria-labelledby="documents-heading">
      <div className="section-heading">
        <h2 id="documents-heading">Documents</h2>
        <button className="button" onClick={() => setShowUpload((value) => !value)}>
          {showUpload ? 'Cancel upload' : 'Upload PDF'}
        </button>
      </div>

      {showUpload && (
        <form className="upload-form" onSubmit={upload}>
          <div>
            <label htmlFor="pdf">Attach a PDF</label>
            <input id="pdf" ref={input} type="file" accept=".pdf,application/pdf" disabled={busy} />
          </div>
          <button className="button" disabled={busy}>
            {busy ? 'Uploading…' : 'Upload PDF'}
          </button>
        </form>
      )}
      {failure && (
        <p role="alert" className="error">
          {failure}
        </p>
      )}
      {success && (
        <p role="status" className="success">
          {success}
        </p>
      )}
      {!data ? (
        <Feedback error={error} retry={reload} />
      ) : data.length === 0 ? (
        <p className="muted">No documents on this page.</p>
      ) : (
        <ul className="document-list">
          {data.slice(0, PAGE_SIZE).map((file) => (
            <li key={file.id}>
              <div>
                <button
                  className="document-name"
                  disabled={Boolean(downloadBusy)}
                  onClick={() => open(file, true)}
                >
                  {file.filename}
                </button>
                <span className="document-meta muted">
                  <span>{file.uploader_id === user?.id ? 'You' : ''}</span>
                  <time dateTime={file.created_at}>{date(file.created_at)}</time>
                </span>
              </div>
              <div className="actions">
                <button
                  className="text-button"
                  disabled={Boolean(downloadBusy)}
                  aria-label={`Download ${file.filename}`}
                  onClick={() => open(file, false)}
                >
                  Download
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {downloadBusy && <p role="status">Loading PDF…</p>}
      {data && (page > 0 || data.length > PAGE_SIZE) && (
        <Pagination page={page} hasNext={data.length > PAGE_SIZE} onChange={setPage} />
      )}
      {preview && (
        <PdfPreview url={preview.url} name={preview.name} close={() => setPreview(null)} />
      )}
    </section>
  );
}
