// @vitest-environment jsdom
// Exercise user actions with mocked HTTP responses; Postgres authorization is tested in backend/.
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { App } from '../../src/App';
import { AuthProvider } from '../../src/auth/AuthProvider';
import type { Lead, Case, PrivateNote } from '../../src/api/work';
const staff = {
  id: 'staff',
  name: 'Taylor Attorney',
  email: 'attorney@example.com',
  role: 'attorney',
  firm_id: 'f1',
};
const original: Lead = {
  id: 'l1',
  name: 'Pat',
  email: 'pat@example.com',
  region: 'NY',
  category: 'employment',
  description: 'Unpaid overtime',
  status: 'assigned',
  firm_id: 'f1',
  firm: { id: 'f1', name: 'North Legal' },
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
beforeEach(() => sessionStorage.setItem('lead-portal-token', 'staff'));
afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.unstubAllGlobals();
});

it('filters the inbox and accepts a lead, updates progress, and saves private notes', async () => {
  let lead = { ...original };
  let work: Case = {
    id: 'c1',
    lead_id: lead.id,
    lead,
    status: 'open',
    progress: '',
    created_at: lead.created_at,
  };
  const notes: PrivateNote[] = [];
  const fetchMock = vi.fn((url: string, options?: RequestInit) => {
    if (url.endsWith('/auth/me')) {
      return Promise.resolve(json(staff));
    }
    if (url.startsWith('/api/leads?')) {
      return Promise.resolve(json([lead]));
    }
    if (url.endsWith('/accept')) {
      lead = { ...lead, status: 'accepted', case_id: 'c1' };
      work.lead = lead;
      return Promise.resolve(json(lead));
    }
    if (url.includes('/progress')) return Promise.resolve(json([]));
    if (url.includes('/documents')) {
      return Promise.resolve(json([]));
    }
    if (url.includes('/notes')) {
      if (options?.method === 'POST') {
        notes.push({
          id: 'n1',
          author_id: staff.id,
          authoring_firm_id: 'f1',
          body: JSON.parse(options.body as string).body,
          created_at: lead.created_at,
        });
      }
      return Promise.resolve(json(options?.method === 'POST' ? notes[0] : [...notes]));
    }
    if (url.includes('/cases/')) {
      if (options?.method === 'PATCH') {
        work = { ...work, ...JSON.parse(options.body as string) };
      }
      return Promise.resolve(json(work));
    }
    return Promise.resolve(json(lead));
  });
  vi.stubGlobal('fetch', fetchMock);
  mount('/firm/leads');
  await userEvent.type(await screen.findByLabelText('Search inquiries'), 'overtime');

  await waitFor(() =>
    expect(fetchMock.mock.calls.some(([url]) => url.includes('q=overtime'))).toBe(true),
  );
  await userEvent.selectOptions(screen.getByLabelText('Status'), 'assigned');
  await waitFor(() =>
    expect(
      fetchMock.mock.calls.some(
        ([url]) => url.includes('q=overtime') && url.includes('status=assigned'),
      ),
    ).toBe(true),
  );
  await userEvent.click(await screen.findByRole('link', { name: /Unpaid overtime/ }));
  await userEvent.click(await screen.findByRole('button', { name: 'Accept lead' }));
  expect(fetchMock.mock.calls.filter(([url]) => url.endsWith('/accept'))).toHaveLength(0);
  await userEvent.click(screen.getByRole('button', { name: 'Confirm acceptance' }));
  await userEvent.click(await screen.findByRole('button', { name: 'Post update' }));
  await userEvent.selectOptions(screen.getByLabelText('Case status'), 'in_progress');
  await userEvent.type(screen.getByLabelText('Progress update'), 'Reviewing evidence');
  await userEvent.click(screen.getByRole('button', { name: 'Save progress' }));
  expect(await screen.findByText('Case progress saved.')).toBeTruthy();
  await userEvent.type(await screen.findByLabelText('New private note'), 'Internal strategy');
  await userEvent.click(screen.getByRole('button', { name: 'Save private note' }));
  expect(await screen.findByText('Private note saved.')).toBeTruthy();
  expect(await screen.findByText('Internal strategy')).toBeTruthy();
  expect(work.progress).toBe('Reviewing evidence');
});

it('declines only after confirmation and leaves resolution to admins', async () => {
  let declined = false;
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      if (url.endsWith('/auth/me')) {
        return Promise.resolve(json({ ...staff, role: 'paralegal' }));
      }
      if (url.includes('/progress')) return Promise.resolve(json([]));
      if (url.includes('/documents')) {
        return Promise.resolve(json([]));
      }
      if (url.endsWith('/decline')) {
        declined = true;
      }
      return Promise.resolve(json({ ...original, status: declined ? 'declined' : 'assigned' }));
    }),
  );
  mount('/firm/leads/l1');
  await userEvent.click(await screen.findByRole('button', { name: 'Decline lead' }));
  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(declined).toBe(false);
  await userEvent.click(screen.getByRole('button', { name: 'Decline lead' }));
  await userEvent.click(screen.getByRole('button', { name: 'Confirm decline' }));
  expect(
    await screen.findByText('Lead declined. It remains available for an admin to resolve.'),
  ).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Accept lead' })).toBeNull();
});

it('handles a lost assignment without presenting a successful save', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      if (url.endsWith('/auth/me')) {
        return Promise.resolve(json(staff));
      }
      if (url.endsWith('/accept')) {
        return Promise.resolve(json({ detail: 'Lead not found' }, 404));
      }
      if (url.includes('/progress')) return Promise.resolve(json([]));
      if (url.includes('/documents')) {
        return Promise.resolve(json([]));
      }
      return Promise.resolve(json(original));
    }),
  );
  mount('/firm/leads/l1');
  await userEvent.click(await screen.findByRole('button', { name: 'Accept lead' }));
  await userEvent.click(screen.getByRole('button', { name: 'Confirm acceptance' }));
  expect((await screen.findByRole('alert')).textContent).toContain('reassigned');
  expect(screen.queryByRole('heading', { name: 'Case workspace' })).toBeNull();
});
