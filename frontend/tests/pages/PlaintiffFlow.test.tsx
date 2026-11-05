// @vitest-environment jsdom
// Exercise user actions with mocked HTTP responses; Postgres authorization is tested in backend/.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { App } from '../../src/App';
import { AuthProvider } from '../../src/auth/AuthProvider';
import { type Lead, type Document } from '../../src/api/work';

const user = {
  id: 'p1',
  name: 'Pat Plaintiff',
  email: 'pat@example.com',
  role: 'plaintiff',
  firm_id: null,
};
const lead: Lead = {
  id: 'l1',
  name: 'Pat Plaintiff',
  email: 'pat@example.com',
  region: 'NY',
  category: 'employment',
  description: 'Unpaid overtime',
  firm_id: 'f1',
  firm: { id: 'f1', name: 'North Legal' },
  case_id: null,
  status: 'assigned',
  created_at: '2026-11-01T12:00:00Z',
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}
function mount(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  );
}
beforeEach(() => sessionStorage.setItem('lead-portal-token', 'saved'));
afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('plaintiff workflow', () => {
  it('validates intake, preserves failed input, retries, and opens a saved unmatched lead', async () => {
    let attempts = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, options?: RequestInit) => {
        if (url.endsWith('/auth/me')) {
          return Promise.resolve(json(user));
        }
        if (url === '/api/leads' && options?.method === 'POST') {
          attempts++;
          return Promise.resolve(
            attempts === 1
              ? json({ detail: 'Please try again' }, 503)
              : json(
                  {
                    ...lead,
                    ...JSON.parse(options.body as string),
                    status: 'pending',
                    firm: null,
                    firm_id: null,
                  },
                  201,
                ),
          );
        }
        if (url.includes('/progress'))
          return Promise.resolve(
            json([
              {
                id: 'u1',
                progress: 'Reviewing your documents',
                status: 'in_progress',
                created_at: lead.created_at,
              },
            ]),
          );
        if (url.includes('/documents')) {
          return Promise.resolve(json([]));
        }
        return Promise.resolve(
          json({
            ...lead,
            description: 'My inquiry',
            status: 'pending',
            firm: null,
            firm_id: null,
          }),
        );
      }),
    );
    mount('/plaintiff/leads/new');
    await userEvent.click(await screen.findByRole('button', { name: 'Submit lead' }));
    expect(screen.getByLabelText('Region').getAttribute('aria-invalid')).toBe('true');
    expect(attempts).toBe(0);
    await userEvent.selectOptions(screen.getByLabelText('Region'), 'other');
    await userEvent.type(screen.getByLabelText('Other region'), 'ZZ');
    await userEvent.selectOptions(screen.getByLabelText('Category'), 'other');
    await userEvent.type(screen.getByLabelText('Other category'), 'housing');
    await userEvent.type(screen.getByLabelText('Describe your situation'), 'My inquiry');
    await userEvent.click(screen.getByRole('button', { name: 'Submit lead' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Please try again');
    expect((screen.getByLabelText('Describe your situation') as HTMLTextAreaElement).value).toBe(
      'My inquiry',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Submit lead' }));
    expect(await screen.findByText('Your inquiry was submitted successfully.')).toBeTruthy();
    expect(await screen.findByText('Pending')).toBeTruthy();
    expect(screen.getByText('Unassigned')).toBeTruthy();
  });

  it('lists leads with firm names, paginates, and links accepted work to its case', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url.endsWith('/auth/me')) {
          return Promise.resolve(json(user));
        }
        if (url.startsWith('/api/leads?')) {
          return Promise.resolve(
            json(
              url.includes('offset=20')
                ? []
                : Array.from({ length: 21 }, (_, i) => ({ ...lead, id: 'l' + i })),
            ),
          );
        }
        if (url.includes('/progress'))
          return Promise.resolve(
            json([
              {
                id: 'u1',
                progress: 'Reviewing your documents',
                status: 'in_progress',
                created_at: lead.created_at,
              },
            ]),
          );
        if (url.includes('/documents')) {
          return Promise.resolve(json([]));
        }
        if (url.startsWith('/api/cases/')) {
          return Promise.resolve(
            json({
              id: 'c1',
              lead_id: lead.id,
              status: 'in_progress',
              progress: 'Reviewing your documents',
              created_at: lead.created_at,
              lead,
            }),
          );
        }
        return Promise.resolve(json({ ...lead, status: 'accepted', case_id: 'c1' }));
      }),
    );
    mount('/plaintiff/leads');
    expect((await screen.findAllByRole('link', { name: /Unpaid overtime/ })).length).toBe(20);
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByText('No more results')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Previous' }));
    await userEvent.click((await screen.findAllByRole('link', { name: /Unpaid overtime/ }))[0]);
    await userEvent.click(await screen.findByRole('link', { name: 'Open case' }));
    expect(await screen.findByText('Reviewing your documents')).toBeTruthy();
    expect(screen.queryByText('Private notes')).toBeNull();
  });

  it('uploads and downloads a PDF with authentication', async () => {
    const docs: Document[] = [];
    const fetchMock = vi.fn((url: string, options?: RequestInit) => {
      if (url.endsWith('/auth/me')) {
        return Promise.resolve(json(user));
      }
      if (url.endsWith('/download')) {
        return Promise.resolve(
          new Response('%PDF-1.7\n%%EOF', { headers: { 'Content-Type': 'application/pdf' } }),
        );
      }
      if (url.includes('/progress'))
        return Promise.resolve(
          json([
            {
              id: 'u1',
              progress: 'Reviewing your documents',
              status: 'in_progress',
              created_at: lead.created_at,
            },
          ]),
        );
      if (url.includes('/documents')) {
        if (options?.method === 'POST') {
          expect(options.body).toBeInstanceOf(FormData);
          docs.push({
            id: 'd1',
            lead_id: lead.id,
            uploader_id: user.id,
            filename: 'evidence.pdf',
            size_bytes: 100,
            created_at: lead.created_at,
          });
          return Promise.resolve(json(docs[0], 201));
        }
        return Promise.resolve(json([...docs]));
      }
      return Promise.resolve(json(lead));
    });
    vi.stubGlobal('fetch', fetchMock);
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(() => 'blob:test'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    mount('/plaintiff/leads/l1');
    const file = new File(['%PDF-1.7\n%%EOF'], 'evidence.pdf', { type: 'application/pdf' });
    await userEvent.click(await screen.findByRole('button', { name: 'Upload PDF' }));
    await userEvent.upload(await screen.findByLabelText('Attach a PDF'), file);
    await userEvent.click(screen.getByRole('button', { name: 'Upload PDF' }));
    expect(await screen.findByText('evidence.pdf uploaded.')).toBeTruthy();
    await userEvent.click(await screen.findByRole('button', { name: 'Download evidence.pdf' }));
    await waitFor(() => expect(click).toHaveBeenCalled());
    const downloadCall = fetchMock.mock.calls.find(([url]) => url.endsWith('/download'));
    expect(new Headers(downloadCall?.[1]?.headers).get('Authorization')).toBe('Bearer saved');
  });

  it('shows inaccessible work and allows retry, and clears expired login during use', async () => {
    let expired = false;
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) =>
        Promise.resolve(
          url.endsWith('/auth/me')
            ? json(user)
            : expired
              ? json({ detail: 'Expired' }, 401)
              : json({ detail: 'Lead not found' }, 404),
        ),
      ),
    );
    mount('/plaintiff/leads/other');
    expect((await screen.findByRole('alert')).textContent).toBe('Lead not found');
    expired = true;
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeTruthy();
    expect(sessionStorage.getItem('lead-portal-token')).toBeNull();
  });
});
