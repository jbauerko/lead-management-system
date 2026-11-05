// @vitest-environment jsdom
// Exercise user actions with mocked HTTP responses; Postgres authorization is tested in backend/.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../src/auth/AuthProvider';
import { App } from '../src/App';

const plaintiff = {
  id: 'p1',
  name: 'Pat Plaintiff',
  email: 'plaintiff@example.com',
  role: 'plaintiff',
  firm_id: null,
};
function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
function mockResponse(url: string) {
  return response(url.includes('/auth/me') ? plaintiff : []);
}
function mount(path = '/') {
  render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  );
}
beforeEach(() => sessionStorage.clear());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('portal authentication and navigation', () => {
  it('returns to the requested page after sign-in and clears login on sign-out', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation((url: string) =>
        Promise.resolve(
          url.endsWith('/login')
            ? response({ access_token: 'demo-token', expires_in: 3600, token_type: 'bearer' })
            : mockResponse(url),
        ),
      );
    vi.stubGlobal('fetch', fetchMock);
    mount('/plaintiff/cases');
    await userEvent.type(await screen.findByLabelText('Password'), 'demo-password');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('region', { name: 'Your cases' })).toBeTruthy();
    expect(sessionStorage.getItem('lead-portal-token')).toBe('demo-token');
    const calls = fetchMock.mock.calls.filter(([url]) => url.endsWith('/me'));
    expect(calls.length).toBeGreaterThan(0);
    expect(new Headers(calls[0][1].headers).get('Authorization')).toBe('Bearer demo-token');
    await userEvent.click(screen.getByRole('link', { name: 'Leads' }));
    await userEvent.click(await screen.findByRole('link', { name: 'Submit a lead' }));
    expect(screen.getByRole('heading', { name: 'Submit a lead' })).toBeTruthy();
    await userEvent.click(screen.getByLabelText('Account: Pat Plaintiff'));
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeTruthy();
    expect(sessionStorage.getItem('lead-portal-token')).toBeNull();
  });

  it('restores the current user on refresh', async () => {
    sessionStorage.setItem('lead-portal-token', 'saved');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => Promise.resolve(mockResponse(url))),
    );
    mount('/plaintiff/leads');
    expect(await screen.findByRole('region', { name: 'Your leads' })).toBeTruthy();
    expect(screen.getByText('Pat Plaintiff')).toBeTruthy();
  });

  it('clears an expired token and asks for sign-in', async () => {
    sessionStorage.setItem('lead-portal-token', 'expired');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(response({ detail: 'Invalid or expired token' }, 401)),
    );
    mount('/plaintiff/leads');
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeTruthy();
    expect(sessionStorage.getItem('lead-portal-token')).toBeNull();
  });

  it('preserves a saved login when the server is temporarily unavailable', async () => {
    sessionStorage.setItem('lead-portal-token', 'saved');
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Offline'))
      .mockImplementation((url: string) => Promise.resolve(mockResponse(url)));
    vi.stubGlobal('fetch', fetchMock);
    mount('/plaintiff/leads');
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(sessionStorage.getItem('lead-portal-token')).toBe('saved');
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('region', { name: 'Your leads' })).toBeTruthy();
  });

  it('shows invalid credentials without saving a token', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockImplementation(() =>
          Promise.resolve(response({ detail: 'Invalid credentials' }, 401)),
        ),
    );
    mount('/login');
    await userEvent.type(screen.getByLabelText('Password'), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Invalid credentials');
    expect(sessionStorage.getItem('lead-portal-token')).toBeNull();
  });

  it('keeps staff outside the plaintiff portal', async () => {
    sessionStorage.setItem('lead-portal-token', 'staff');
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockImplementation((url: string) =>
          Promise.resolve(
            url.endsWith('/auth/me') ? response({ ...plaintiff, role: 'attorney' }) : response([]),
          ),
        ),
    );
    mount('/plaintiff/leads');
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Inbox' })).toBeTruthy());
    expect(screen.queryByRole('heading', { name: 'My leads & cases' })).toBeNull();
  });
});

it('opens account actions from the username and dismisses them with Escape or an outside click', async () => {
  sessionStorage.setItem('lead-portal-token', 'saved');
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation((url: string) => Promise.resolve(mockResponse(url))),
  );
  mount('/plaintiff/leads');
  const account = await screen.findByLabelText('Account: Pat Plaintiff');
  expect((account.closest('details') as HTMLDetailsElement).open).toBe(false);
  await userEvent.click(account);
  expect((account.closest('details') as HTMLDetailsElement).open).toBe(true);
  await userEvent.keyboard('{Escape}');
  expect((account.closest('details') as HTMLDetailsElement).open).toBe(false);
  await userEvent.click(account);
  await userEvent.click(screen.getByRole('heading', { name: 'Leads' }));
  expect((account.closest('details') as HTMLDetailsElement).open).toBe(false);
});
