// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SelectWithOther } from '../../src/components/SelectWithOther';
afterEach(cleanup);
function Example() {
  const [value, setValue] = useState('');
  return (
    <>
      <SelectWithOther
        id="region"
        label="Region"
        value={value}
        onChange={setValue}
        options={[{ value: 'NY', label: 'New York' }]}
      />
      <output aria-label="Submitted region">{value}</output>
    </>
  );
}
it('submits option values or custom text without sending the Other sentinel or stale hidden text', async () => {
  render(<Example />);
  await userEvent.selectOptions(screen.getByLabelText('Region'), 'other');
  expect(screen.getByLabelText('Submitted region').textContent).toBe('');
  await userEvent.type(screen.getByLabelText('Other region'), 'Ontario');
  expect(screen.getByLabelText('Submitted region').textContent).toBe('Ontario');
  await userEvent.selectOptions(screen.getByLabelText('Region'), 'NY');
  expect(screen.queryByLabelText('Other region')).toBeNull();
  expect(screen.getByLabelText('Submitted region').textContent).toBe('NY');
  await userEvent.selectOptions(screen.getByLabelText('Region'), 'other');
  expect((screen.getByLabelText('Other region') as HTMLInputElement).value).toBe('');
});
