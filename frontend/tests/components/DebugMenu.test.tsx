// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { DebugMenu } from '../../src/components/DebugMenu';

// jsdom has the dialog element but does not implement its native open/close methods.
const prototype = HTMLDialogElement.prototype;
const originalShow = Object.getOwnPropertyDescriptor(prototype, 'showModal');
const originalClose = Object.getOwnPropertyDescriptor(prototype, 'close');
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  if (originalShow) Object.defineProperty(prototype, 'showModal', originalShow);
  else Reflect.deleteProperty(prototype, 'showModal');
  if (originalClose) Object.defineProperty(prototype, 'close', originalClose);
  else Reflect.deleteProperty(prototype, 'close');
});

it('opens with Ctrl+[ and reloads real reference data whenever reopened', async () => {
  Object.defineProperty(prototype, 'showModal', {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.open = true;
    },
  });
  Object.defineProperty(prototype, 'close', {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.open = false;
    },
  });
  const fetch = vi.fn().mockImplementation(() =>
    Promise.resolve(
      new Response(
        JSON.stringify({
          password: 'demo-password',
          accounts: [
            {
              name: 'Jordan',
              email: 'attorney2@example.com',
              role: 'attorney',
              firm: 'South Legal',
              active: true,
            },
          ],
          mappings: [
            { region: 'NY', category: 'personal_injury', firm: 'North Legal', active: true },
          ],
        }),
      ),
    ),
  );
  vi.stubGlobal('fetch', fetch);
  render(<DebugMenu />);
  const dialog = document.querySelector('dialog')!;
  expect(dialog.open).toBe(false);
  fireEvent.keyDown(window, { ctrlKey: true, key: '[', code: 'BracketLeft' });
  expect(dialog.open).toBe(true);
  expect(await screen.findByText('attorney2@example.com')).toBeTruthy();
  expect(await screen.findByText('Personal Injury')).toBeTruthy();
  fireEvent.keyDown(window, { ctrlKey: true, key: '[', code: 'BracketLeft' });
  expect(dialog.open).toBe(false);
  fireEvent.keyDown(window, { ctrlKey: true, key: '[', code: 'BracketLeft' });
  expect(await screen.findByText('attorney2@example.com')).toBeTruthy();
  expect(fetch).toHaveBeenCalledTimes(2);
});
