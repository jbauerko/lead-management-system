// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../auth/AuthProvider';
import { App } from '../App';
const admin = {
  id: 'a1',
  name: 'Sam Admin',
  email: 'admin@example.com',
  role: 'admin',
  firm_id: null,
};
const json = (data: unknown) => new Response(JSON.stringify(data), { status: 200 });
afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.unstubAllGlobals();
});

it('opens the combined admin overview and links recorded activity to its work', async () => {
  sessionStorage.setItem('lead-portal-token', 'saved');
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      if (url.endsWith('/auth/me')) return Promise.resolve(json(admin));
      if (url.startsWith('/api/firms')) return Promise.resolve(json([]));
      if (url.startsWith('/api/admin/activity'))
        return Promise.resolve(
          json([
            {
              id: 'e1',
              lead_id: 'l1',
              case_id: null,
              actor: admin,
              action: 'assignment_changed',
              changes: { reason: { from: null, to: 'Conflict of interest' } },
              created_at: '2026-11-05T12:00:00Z',
            },
          ]),
        );
      return Promise.resolve(
        json([
          {
            id: 'l1',
            kind: 'leads',
            status: 'pending',
            lead: {
              id: 'l1',
              name: 'Dana',
              category: 'employment',
              region: 'NY',
              description: 'Help',
              firm: null,
            },
          },
        ]),
      );
    }),
  );
  render(
    <MemoryRouter initialEntries={['/admin/overview']}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  );
  expect(await screen.findByRole('heading', { name: 'Leads & cases' })).toBeTruthy();
  expect(await screen.findByRole('link', { name: 'Assign' })).toBeTruthy();
  await userEvent.click(screen.getByRole('link', { name: 'Activity log' }));
  expect(await screen.findByText('Conflict of interest')).toBeTruthy();
  expect(screen.getByRole('link', { name: 'assignment changed' }).getAttribute('href')).toBe(
    '/admin/leads/l1',
  );
});

it('shows plaintiff-safe progress as a timeline with lifecycle and documents', async () => {
  sessionStorage.setItem('lead-portal-token', 'saved');
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      if (url.endsWith('/auth/me')) return Promise.resolve(json({ ...admin, role: 'plaintiff' }));
      if (url.includes('/progress'))
        return Promise.resolve(
          json([
            {
              id: 'e1',
              progress: 'Evidence review underway',
              status: 'in_progress',
              created_at: '2026-11-05T12:00:00Z',
            },
          ]),
        );
      if (url.includes('/documents')) return Promise.resolve(json([]));
      return Promise.resolve(
        json({
          id: 'c1',
          status: 'in_progress',
          lead: {
            id: 'l1',
            name: 'Dana',
            category: 'employment',
            region: 'NY',
            description: 'Help',
            firm: { id: 'f1', name: 'North Legal' },
          },
        }),
      );
    }),
  );
  render(
    <MemoryRouter initialEntries={['/plaintiff/cases/c1']}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  );
  expect(await screen.findByText('Evidence review underway')).toBeTruthy();
  expect(screen.getByRole('list', { name: 'Case lifecycle' })).toBeTruthy();
  expect(screen.queryByRole('heading', { name: 'Private notes' })).toBeNull();
  await userEvent.click(screen.getByRole('button', { name: 'Upload PDF' }));
  expect(screen.getByLabelText('Attach a PDF')).toBeTruthy();
});
