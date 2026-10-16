import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { z } from 'zod';
import { ZodSchemaForm } from '../../src/ui/components/editor/schema-form/ZodSchemaForm';
import { EFFECT_PARAM_SCHEMAS } from '../../src/data/supplemental/effect-params';
import { AbilityCostSchema } from '../../src/data/supplemental/schema';

const tid = (path: string[], extra?: string) => ['f', ...path, ...(extra ? [extra] : [])].join('-');

const Stateful: React.FC<{
  schema: z.ZodType;
  initial?: Record<string, any>;
  onChange?: (next: Record<string, any> | undefined) => void;
  disclosure?: 'progressive' | 'all';
  hiddenKeys?: string[];
  disabledKeys?: string[];
}> = ({ schema, initial, onChange, disclosure, hiddenKeys, disabledKeys }) => {
  const [value, setValue] = React.useState<Record<string, any> | undefined>(initial);
  return (
    <ZodSchemaForm
      schema={schema}
      value={value}
      testId={tid}
      disclosure={disclosure}
      hiddenKeys={hiddenKeys}
      disabledKeys={disabledKeys}
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
    />
  );
};

const lastCall = (fn: ReturnType<typeof vi.fn>) => fn.mock.calls[fn.mock.calls.length - 1][0];

describe('ZodSchemaForm widgets', () => {
  const schema = z
    .object({
      name: z.string().meta({ label: 'Name', primary: true }).optional(),
      count: z.number().meta({ label: 'Count', primary: true }).optional(),
      flag: z.boolean().meta({ label: 'Flag', primary: true }).optional(),
      mode: z.enum(['A', 'B']).meta({ label: 'Mode', primary: true }).optional(),
      zones: z
        .array(z.enum(['x', 'y']))
        .meta({ label: 'Zones', primary: true })
        .optional(),
      names: z
        .array(z.string())
        .meta({ label: 'Names', widget: 'string-list', primary: true })
        .optional(),
      payload: z
        .array(z.object({ id: z.string() }))
        .meta({ label: 'Payload', primary: true })
        .optional(),
      inner: z
        .object({ depth: z.number().meta({ label: 'Depth' }).optional() })
        .meta({ label: 'Inner', primary: true })
        .optional(),
    })
    .strict();

  it('renders a text input for strings and removes the key when cleared', () => {
    const onChange = vi.fn();
    render(<Stateful schema={schema} onChange={onChange} />);
    fireEvent.change(screen.getByTestId('f-name'), { target: { value: 'Rhino' } });
    expect(lastCall(onChange)).toEqual({ name: 'Rhino' });
    fireEvent.change(screen.getByTestId('f-name'), { target: { value: '' } });
    expect(lastCall(onChange)).toBeUndefined();
  });

  it('renders a number input for numbers, accepts negative values, and drops the key when empty', () => {
    const onChange = vi.fn();
    render(<Stateful schema={schema} onChange={onChange} />);
    fireEvent.change(screen.getByTestId('f-count'), { target: { value: '-3' } });
    expect(lastCall(onChange)).toEqual({ count: -3 });
    fireEvent.change(screen.getByTestId('f-count'), { target: { value: '' } });
    expect(lastCall(onChange)).toBeUndefined();
  });

  it('clamps a number to the schema minimum when the schema forbids negatives', () => {
    const onChange = vi.fn();
    const unsigned = z.object({
      n: z.number().min(0).meta({ label: 'N', primary: true }).optional(),
    });
    render(<Stateful schema={unsigned} onChange={onChange} />);
    expect((screen.getByTestId('f-n') as HTMLInputElement).min).toBe('0');
    fireEvent.change(screen.getByTestId('f-n'), { target: { value: '-4' } });
    expect(lastCall(onChange)).toEqual({ n: 0 });
  });

  it('renders a checkbox that sets true and unsets on uncheck (no false keys)', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Stateful schema={schema} onChange={onChange} />);
    await user.click(screen.getByTestId('f-flag'));
    expect(lastCall(onChange)).toEqual({ flag: true });
    await user.click(screen.getByTestId('f-flag'));
    expect(lastCall(onChange)).toBeUndefined();
  });

  it('renders a select for enums with the schema options and a blank option', () => {
    const onChange = vi.fn();
    render(<Stateful schema={schema} onChange={onChange} />);
    const select = screen.getByTestId('f-mode') as HTMLSelectElement;
    expect(Array.from(select.options).map((o) => o.value)).toEqual(['', 'A', 'B']);
    fireEvent.change(select, { target: { value: 'B' } });
    expect(lastCall(onChange)).toEqual({ mode: 'B' });
    fireEvent.change(select, { target: { value: '' } });
    expect(lastCall(onChange)).toBeUndefined();
  });

  it('renders multi-select pills for arrays of enums', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Stateful schema={schema} onChange={onChange} />);
    await user.click(screen.getByTestId('f-zones-x'));
    await user.click(screen.getByTestId('f-zones-y'));
    expect(lastCall(onChange)).toEqual({ zones: ['x', 'y'] });
    await user.click(screen.getByTestId('f-zones-x'));
    await user.click(screen.getByTestId('f-zones-y'));
    expect(lastCall(onChange)).toBeUndefined();
  });

  it('renders a comma separated input for string-list fields', () => {
    const onChange = vi.fn();
    render(<Stateful schema={schema} onChange={onChange} />);
    fireEvent.change(screen.getByTestId('f-names'), { target: { value: 'Avenger, Mystic ,' } });
    expect(lastCall(onChange)).toEqual({ names: ['Avenger', 'Mystic'] });
    fireEvent.change(screen.getByTestId('f-names'), { target: { value: '' } });
    expect(lastCall(onChange)).toBeUndefined();
  });

  it('falls back to a JSON textarea for arrays of objects and only emits valid JSON', () => {
    const onChange = vi.fn();
    render(<Stateful schema={schema} onChange={onChange} />);
    const area = screen.getByTestId('f-payload') as HTMLTextAreaElement;
    fireEvent.change(area, { target: { value: '[{"id": "a"}' } });
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText('Invalid JSON')).toBeDefined();
    fireEvent.change(area, { target: { value: '[{"id": "a"}]' } });
    expect(lastCall(onChange)).toEqual({ payload: [{ id: 'a' }] });
    fireEvent.change(area, { target: { value: '' } });
    expect(lastCall(onChange)).toBeUndefined();
  });

  it('renders nested objects as a nested form and removes empty nested objects', () => {
    const onChange = vi.fn();
    render(<Stateful schema={schema} onChange={onChange} />);
    fireEvent.change(screen.getByTestId('f-inner-depth'), { target: { value: '2' } });
    expect(lastCall(onChange)).toEqual({ inner: { depth: 2 } });
    fireEvent.change(screen.getByTestId('f-inner-depth'), { target: { value: '' } });
    expect(lastCall(onChange)).toBeUndefined();
  });

  it('delegates widget card-filter fields to UniversalCardFilterBuilder', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const filterSchema = AbilityCostSchema.shape.discardCard;
    render(
      <Stateful
        schema={filterSchema.unwrap() as z.ZodType}
        initial={{ from: 'HAND', filter: { codes: ['01001a'] } }}
        onChange={onChange}
      />,
    );
    expect(screen.getByText('Configured')).toBeDefined();
    expect(screen.getByTestId('filter-codes-input')).toBeDefined();
    await user.clear(screen.getByTestId('filter-codes-input'));
    expect(onChange).toHaveBeenCalled();
  });

  it('delegates number-or-formula fields to DynamicValueBuilder', () => {
    const onChange = vi.fn();
    const amount = EFFECT_PARAM_SCHEMAS.DEAL_DAMAGE;
    render(<Stateful schema={amount} initial={{ amount: 3 }} onChange={onChange} />);
    expect(screen.getByTestId('mode-dynamic-formula-btn')).toBeDefined();
    fireEvent.change(screen.getByTestId('dynamic-value-number-input'), { target: { value: '-2' } });
    expect(lastCall(onChange)).toEqual({ amount: -2 });
  });

  it('delegates widget card-location fields to CardLocationSelectorForm', () => {
    const onChange = vi.fn();
    render(
      <Stateful
        schema={EFFECT_PARAM_SCHEMAS.GENERATE_RESOURCE}
        initial={{ fromCard: { zone: 'PLAYER_DISCARD', position: 'TOP' } }}
        onChange={onChange}
      />,
    );
    expect(screen.getByText('Resource Source Card')).toBeDefined();
    expect(screen.getByTestId('f-fromCard-zone-select')).toBeDefined();
  });
});

describe('ZodSchemaForm progressive disclosure', () => {
  const schema = z
    .object({
      shown: z.string().meta({ label: 'Shown', primary: true }).optional(),
      extra: z.string().meta({ label: 'Extra' }).optional(),
      withDefault: z.string().meta({ label: 'With Default', defaultValue: 'seed' }).optional(),
      other: z.boolean().meta({ label: 'Other' }).optional(),
    })
    .strict();

  it('shows primary fields and offers the other optional fields as add chips', () => {
    render(<Stateful schema={schema} />);
    expect(screen.getByTestId('f-shown')).toBeDefined();
    expect(screen.queryByTestId('f-extra')).toBeNull();
    expect(screen.getByTestId('f-extra-add')).toBeDefined();
    expect(screen.getByTestId('f-withDefault-add')).toBeDefined();
    expect(screen.getByTestId('f-other-add')).toBeDefined();
    expect(screen.queryByTestId('f-shown-add')).toBeNull();
  });

  it('shows populated optional fields without a chip', () => {
    render(<Stateful schema={schema} initial={{ extra: 'x' }} />);
    expect((screen.getByTestId('f-extra') as HTMLInputElement).value).toBe('x');
    expect(screen.queryByTestId('f-extra-add')).toBeNull();
  });

  it('a chip reveals its field without writing an empty value, and remove clears it', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Stateful schema={schema} onChange={onChange} />);
    await user.click(screen.getByTestId('f-extra-add'));
    expect(screen.getByTestId('f-extra')).toBeDefined();
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.change(screen.getByTestId('f-extra'), { target: { value: 'hello' } });
    expect(lastCall(onChange)).toEqual({ extra: 'hello' });

    await user.click(screen.getByTestId('f-extra-remove'));
    expect(lastCall(onChange)).toBeUndefined();
    expect(screen.queryByTestId('f-extra')).toBeNull();
    expect(screen.getByTestId('f-extra-add')).toBeDefined();
  });

  it('a chip for a field with a default value writes that default', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Stateful schema={schema} onChange={onChange} />);
    await user.click(screen.getByTestId('f-withDefault-add'));
    expect(lastCall(onChange)).toEqual({ withDefault: 'seed' });
  });

  it('primary fields have no remove control', () => {
    render(<Stateful schema={schema} />);
    expect(screen.queryByTestId('f-shown-remove')).toBeNull();
  });

  it('disclosure "all" shows every field and no chips', () => {
    render(<Stateful schema={schema} disclosure="all" />);
    expect(screen.getByTestId('f-extra')).toBeDefined();
    expect(screen.getByTestId('f-other')).toBeDefined();
    expect(screen.queryByTestId('f-extra-add')).toBeNull();
  });

  it('hides keys a parent renders itself, and disables listed keys', () => {
    render(
      <Stateful schema={schema} disclosure="all" hiddenKeys={['extra']} disabledKeys={['other']} />,
    );
    expect(screen.queryByTestId('f-extra')).toBeNull();
    expect(screen.queryByTestId('f-extra-add')).toBeNull();
    expect((screen.getByTestId('f-other') as HTMLInputElement).disabled).toBe(true);
  });

  it('preserves keys it does not render when another field changes', () => {
    const onChange = vi.fn();
    render(
      <Stateful
        schema={schema}
        initial={{ extra: 'keep' }}
        hiddenKeys={['extra']}
        onChange={onChange}
      />,
    );
    fireEvent.change(screen.getByTestId('f-shown'), { target: { value: 'a' } });
    expect(lastCall(onChange)).toEqual({ extra: 'keep', shown: 'a' });
  });

  it('renders effect params progressively from EFFECT_PARAM_SCHEMAS', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Stateful schema={EFFECT_PARAM_SCHEMAS.DEAL_DAMAGE} onChange={onChange} />);
    // amount and target are primary; targetPlayer is optional and sits behind a chip
    expect(screen.getByText('Damage Amount')).toBeDefined();
    expect(screen.getByTestId('f-target')).toBeDefined();
    expect(screen.queryByTestId('f-targetPlayer')).toBeNull();
    await user.click(screen.getByTestId('f-targetPlayer-add'));
    fireEvent.change(screen.getByTestId('f-targetPlayer'), { target: { value: 'SELF' } });
    expect(lastCall(onChange)).toEqual({ targetPlayer: 'SELF' });
  });
});
