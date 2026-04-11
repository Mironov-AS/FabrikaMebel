import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAddModal, useEditModal, useDeleteModal } from './useModalState';

// ── useAddModal ──────────────────────────────────────────────────────────────
describe('useAddModal', () => {
  const emptyForm = { name: '', amount: 0 };

  it('starts closed with empty form', () => {
    const { result } = renderHook(() => useAddModal(emptyForm));
    expect(result.current.isOpen).toBe(false);
    expect(result.current.form).toEqual(emptyForm);
    expect(result.current.errors).toEqual({});
    expect(result.current.loading).toBe(false);
    expect(result.current.serverError).toBe('');
  });

  it('open() sets isOpen to true and resets form/errors/serverError', () => {
    const { result } = renderHook(() => useAddModal(emptyForm));

    act(() => {
      result.current.setField('name', 'Test');
      result.current.setErrors({ name: 'required' });
      result.current.setServerError('Server down');
    });
    act(() => result.current.open());

    expect(result.current.isOpen).toBe(true);
    expect(result.current.form).toEqual(emptyForm);
    expect(result.current.errors).toEqual({});
    expect(result.current.serverError).toBe('');
  });

  it('close() sets isOpen to false', () => {
    const { result } = renderHook(() => useAddModal(emptyForm));
    act(() => result.current.open());
    act(() => result.current.close());
    expect(result.current.isOpen).toBe(false);
  });

  it('setField updates form value and clears its error', () => {
    const { result } = renderHook(() => useAddModal(emptyForm));
    act(() => result.current.setErrors({ name: 'required', amount: 'invalid' }));
    act(() => result.current.setField('name', 'Alice'));

    expect(result.current.form.name).toBe('Alice');
    expect(result.current.errors.name).toBeUndefined();
    // other errors remain intact
    expect(result.current.errors.amount).toBe('invalid');
  });

  it('setLoading toggles loading state', () => {
    const { result } = renderHook(() => useAddModal(emptyForm));
    act(() => result.current.setLoading(true));
    expect(result.current.loading).toBe(true);
    act(() => result.current.setLoading(false));
    expect(result.current.loading).toBe(false);
  });

  it('setServerError sets server error message', () => {
    const { result } = renderHook(() => useAddModal(emptyForm));
    act(() => result.current.setServerError('API failed'));
    expect(result.current.serverError).toBe('API failed');
  });
});

// ── useEditModal ─────────────────────────────────────────────────────────────
describe('useEditModal', () => {
  const emptyForm = { name: '', status: 'draft' };

  it('starts closed with null target', () => {
    const { result } = renderHook(() => useEditModal(emptyForm));
    expect(result.current.isOpen).toBe(false);
    expect(result.current.target).toBeNull();
  });

  it('open(item) sets target and maps form from item keys', () => {
    const { result } = renderHook(() => useEditModal(emptyForm));
    const item = { id: 1, name: 'Contract A', status: 'active', extra: 'ignored' };
    act(() => result.current.open(item));

    expect(result.current.isOpen).toBe(true);
    expect(result.current.target).toBe(item);
    expect(result.current.form).toEqual({ name: 'Contract A', status: 'active' });
    // extra keys not in emptyForm are excluded
    expect(result.current.form.extra).toBeUndefined();
  });

  it('open(item) falls back to emptyForm value for missing/null fields', () => {
    const { result } = renderHook(() => useEditModal(emptyForm));
    const item = { id: 2, name: null, status: undefined };
    act(() => result.current.open(item));

    expect(result.current.form.name).toBe('');    // null → fallback to emptyForm['name']
    expect(result.current.form.status).toBe('draft'); // undefined → fallback
  });

  it('open(item, mapToForm) uses custom mapper', () => {
    const { result } = renderHook(() => useEditModal(emptyForm));
    const item = { id: 3, title: 'My Contract' };
    act(() => result.current.open(item, (i) => ({ name: i.title, status: 'active' })));

    expect(result.current.form).toEqual({ name: 'My Contract', status: 'active' });
  });

  it('open() resets errors and serverError', () => {
    const { result } = renderHook(() => useEditModal(emptyForm));
    act(() => {
      result.current.setErrors({ name: 'required' });
      result.current.setServerError('Oops');
    });
    act(() => result.current.open({ name: 'X', status: 'draft' }));

    expect(result.current.errors).toEqual({});
    expect(result.current.serverError).toBe('');
  });

  it('close() resets target to null (isOpen becomes false)', () => {
    const { result } = renderHook(() => useEditModal(emptyForm));
    act(() => result.current.open({ name: 'X', status: 'draft' }));
    act(() => result.current.close());
    expect(result.current.isOpen).toBe(false);
    expect(result.current.target).toBeNull();
  });

  it('setField updates form and clears that field error', () => {
    const { result } = renderHook(() => useEditModal(emptyForm));
    act(() => result.current.open({ name: 'Old', status: 'draft' }));
    act(() => result.current.setErrors({ name: 'too short' }));
    act(() => result.current.setField('name', 'New Name'));

    expect(result.current.form.name).toBe('New Name');
    expect(result.current.errors.name).toBeUndefined();
  });
});

// ── useDeleteModal ───────────────────────────────────────────────────────────
describe('useDeleteModal', () => {
  it('starts closed with null target', () => {
    const { result } = renderHook(() => useDeleteModal());
    expect(result.current.isOpen).toBe(false);
    expect(result.current.target).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.serverError).toBe('');
  });

  it('open(item) sets target and clears serverError', () => {
    const { result } = renderHook(() => useDeleteModal());
    act(() => result.current.setServerError('previous error'));
    const item = { id: 5, name: 'Delete me' };
    act(() => result.current.open(item));

    expect(result.current.isOpen).toBe(true);
    expect(result.current.target).toBe(item);
    expect(result.current.serverError).toBe('');
  });

  it('close() resets target to null', () => {
    const { result } = renderHook(() => useDeleteModal());
    act(() => result.current.open({ id: 1 }));
    act(() => result.current.close());
    expect(result.current.isOpen).toBe(false);
    expect(result.current.target).toBeNull();
  });

  it('setLoading and setServerError work correctly', () => {
    const { result } = renderHook(() => useDeleteModal());
    act(() => result.current.setLoading(true));
    expect(result.current.loading).toBe(true);
    act(() => result.current.setServerError('Delete failed'));
    expect(result.current.serverError).toBe('Delete failed');
  });
});
