// @vitest-environment jsdom
// Exercise user actions with mocked HTTP responses; Postgres authorization is tested in backend/.
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { App } from '../../src/App';
import { AuthProvider } from '../../src/auth/AuthProvider';
import type { Lead } from '../../src/api/work';
const admin = {
  id: 'a1',
  name: 'Sam Admin',
  email: 'admin@example.com',
  role: 'admin',
  firm_id: null,
};
const original: Lead = {
  id: 'l1',
  name: 'Pat',
  email: 'pat@example.com',
  region: 'ZZ',
  category: 'housing',
  description: 'Deposit dispute',
  status: 'pending',
  firm: null,
  firm_id: null,
  case_id: null,
  created_at: '2026-11-03T12:00:00Z',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
function mount(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  );
}
beforeEach(() => sessionStorage.setItem('lead-portal-token', 'admin'));
afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.unstubAllGlobals();
});

it('finds unmatched work, confirms assignment, and shows the actor and changes in history', async () => {
  let lead = { ...original };
  let assigned = false;
  const mock = vi.fn((url: string, options?: RequestInit) => {
    if (url.endsWith('/auth/me')) {
      return Promise.resolve(json(admin));
    }
    if (url.startsWith('/api/firms?')) {
      return Promise.resolve(json([{ id: 'f1', name: 'North Legal' }]));
    }
    if (url.startsWith('/api/leads?')) {
      return Promise.resolve(json([lead]));
    }
    if (url.endsWith('/assignment')) {
      assigned = true;
      lead = {
        ...lead,
        status: 'assigned',
        firm_id: 'f1',
        firm: { id: 'f1', name: 'North Legal' },
      };
      return Promise.resolve(json(lead));
    }
    if (url.includes('/history')) {
      return Promise.resolve(
        json(
          assigned
            ? [
                {
                  id: 'e1',
                  actor: admin,
                  actor_id: 'a1',
                  action: 'assignment_changed',
                  changes: {
                    firm_id: { from: null, to: 'f1' },
                    status: { from: 'pending', to: 'assigned' },
                  },
                  created_at: lead.created_at,
                },
              ]
            : [],
        ),
      );
    }
    if (url.includes('/documents')) {
      return Promise.resolve(json([]));
    }
    return Promise.resolve(json(lead));
  });
  vi.stubGlobal('fetch', mock);
  mount('/admin/leads');
  await userEvent.selectOptions(await screen.findByLabelText('Status'), 'pending');
  await waitFor(() =>
    expect(mock.mock.calls.some(([url]) => url.includes('status=pending'))).toBe(true),
  );
  await userEvent.click(await screen.findByRole('link', { name: /Deposit dispute/ }));
  await userEvent.selectOptions(await screen.findByLabelText('Assign to firm'), 'f1');
  await userEvent.click(screen.getByRole('button', { name: 'Review assignment' }));
  expect(assigned).toBe(false);
  await userEvent.click(screen.getByRole('button', { name: 'Confirm assignment' }));
  expect(await screen.findByText(/Assignment saved/)).toBeTruthy();
  expect(await screen.findByRole('heading', { name: 'Assignment changed' })).toBeTruthy();
  expect(screen.getAllByText('Sam Admin').length).toBeGreaterThan(0);
  expect(screen.getByText('assigned')).toBeTruthy();
});

it('inspects all note owners without exposing a note-writing form and can reassign cases', async () => {
  let moved = false;
  const lead = {
    ...original,
    status: 'accepted',
    case_id: 'c1',
    firm: { id: 'f1', name: 'North Legal' },
    firm_id: 'f1',
  };
  const mock = vi.fn((url: string) => {
    if (url.endsWith('/auth/me')) {
      return Promise.resolve(json(admin));
    }
    if (url.startsWith('/api/firms?')) {
      return Promise.resolve(
        json([
          { id: 'f1', name: 'North Legal' },
          { id: 'f2', name: 'South Legal' },
        ]),
      );
    }
    if (url.endsWith('/assignment')) {
      moved = true;
    }
    if (url.includes('/notes')) {
      return Promise.resolve(
        json([
          {
            id: 'n1',
            body: 'Original strategy',
            author_id: 's1',
            authoring_firm_id: 'f1',
            author: { id: 's1', name: 'Taylor Attorney', email: 'attorney@example.com' },
            authoring_firm: { id: 'f1', name: 'North Legal' },
            created_at: lead.created_at,
          },
        ]),
      );
    }
    if (url.includes('/history') || url.includes('/documents')) {
      return Promise.resolve(json([]));
    }
    return Promise.resolve(
      json({
        id: 'c1',
        lead_id: 'l1',
        status: 'in_progress',
        progress: 'Reviewing',
        lead: moved ? { ...lead, firm: { id: 'f2', name: 'South Legal' }, firm_id: 'f2' } : lead,
        created_at: lead.created_at,
      }),
    );
  });
  vi.stubGlobal('fetch', mock);
  mount('/admin/cases/c1');
  expect(await screen.findByText('Original strategy')).toBeTruthy();
  expect(screen.queryByLabelText('New private note')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Save progress' })).toBeNull();
  expect(screen.getByText('Taylor Attorney')).toBeTruthy();
  await userEvent.selectOptions(await screen.findByLabelText('Assign to firm'), 'f2');
  await userEvent.click(screen.getByRole('button', { name: 'Review assignment' }));
  await userEvent.click(screen.getByRole('button', { name: 'Confirm assignment' }));
  expect(await screen.findByText(/Assignment saved/)).toBeTruthy();
  expect(mock.mock.calls.some(([url]) => url === '/api/cases/c1/assignment')).toBe(true);
});

it('offers a useful empty state when no active firms exist', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) =>
      Promise.resolve(
        json(
          url.endsWith('/auth/me')
            ? admin
            : url.startsWith('/api/leads/l1') &&
                !url.includes('/history') &&
                !url.includes('/documents')
              ? original
              : [],
        ),
      ),
    ),
  );
  mount('/admin/leads/l1');
  expect(await screen.findByText(/No active firms are available/)).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Review assignment' })).toBeNull();
});

it('keeps plaintiffs outside admin screens', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) =>
      Promise.resolve(json(url.endsWith('/auth/me') ? { ...admin, role: 'plaintiff' } : [])),
    ),
  );
  mount('/admin/leads');
  expect(await screen.findByRole('heading', { name: 'Leads' })).toBeTruthy();
  expect(screen.queryByRole('heading', { name: 'Leads & cases' })).toBeNull();
});

it('loads firms beyond the first page and preserves the selection after assignment fails', async () => {
  const mock = vi.fn((url: string) => {
    if (url.endsWith('/auth/me')) {
      return Promise.resolve(json(admin));
    }
    if (url.startsWith('/api/firms?')) {
      return Promise.resolve(
        json(
          url.includes('offset=100')
            ? [{ id: 'last', name: 'Last Legal' }]
            : Array.from({ length: 100 }, (_, i) => ({ id: `f${i}`, name: `Firm ${i}` })),
        ),
      );
    }
    if (url.endsWith('/assignment')) {
      return Promise.resolve(json({ detail: 'Target firm must exist and be active' }, 409));
    }
    if (url.includes('/history') || url.includes('/documents')) {
      return Promise.resolve(json([]));
    }
    return Promise.resolve(json(original));
  });
  vi.stubGlobal('fetch', mock);
  mount('/admin/leads/l1');
  await userEvent.selectOptions(await screen.findByLabelText('Assign to firm'), 'last');
  await userEvent.click(screen.getByRole('button', { name: 'Review assignment' }));
  await userEvent.click(screen.getByRole('button', { name: 'Confirm assignment' }));
  expect((await screen.findByRole('alert')).textContent).toBe(
    'Target firm must exist and be active',
  );
  expect((screen.getByLabelText('Assign to firm') as HTMLSelectElement).value).toBe('last');
  expect(screen.queryByText(/Assignment saved/)).toBeNull();
  expect(
    mock.mock.calls.some(([url]) => url.includes('/firms?') && url.includes('offset=100')),
  ).toBe(true);
});
