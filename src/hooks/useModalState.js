import { useState } from 'react';

/**
 * Manages state for an "Add" modal: open flag, form, validation errors, loading, server error.
 * @param {object} emptyForm - initial/reset form state
 */
export function useAddModal(emptyForm) {
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState('');

  const open = () => {
    setForm(emptyForm);
    setErrors({});
    setServerError('');
    setIsOpen(true);
  };
  const close = () => setIsOpen(false);

  // Updates a single field and clears its validation error
  const setField = (key, val) => {
    setForm(f => ({ ...f, [key]: val }));
    setErrors(e => ({ ...e, [key]: undefined }));
  };

  return { isOpen, form, errors, loading, serverError, open, close, setField, setErrors, setLoading, setServerError };
}

/**
 * Manages state for an "Edit" modal: target item, form, validation errors, loading, server error.
 * @param {object} emptyForm - shape used to pick keys when mapping an item to form state
 */
export function useEditModal(emptyForm) {
  const [target, setTarget] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState('');

  /**
   * @param {object} item - the item to edit
   * @param {function} [mapToForm] - optional mapper from item → form state;
   *   defaults to picking keys present in emptyForm, falling back to emptyForm values
   */
  const open = (item, mapToForm) => {
    setTarget(item);
    if (mapToForm) {
      setForm(mapToForm(item));
    } else {
      setForm(
        Object.fromEntries(
          Object.keys(emptyForm).map(k => [k, item[k] !== undefined && item[k] !== null ? item[k] : emptyForm[k]])
        )
      );
    }
    setErrors({});
    setServerError('');
  };
  const close = () => setTarget(null);

  const setField = (key, val) => {
    setForm(f => ({ ...f, [key]: val }));
    setErrors(e => ({ ...e, [key]: undefined }));
  };

  return { target, isOpen: !!target, form, errors, loading, serverError, open, close, setField, setErrors, setLoading, setServerError };
}

/**
 * Manages state for a "Delete" (or any destructive action) confirmation modal.
 */
export function useDeleteModal() {
  const [target, setTarget] = useState(null);
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState('');

  const open = (item) => { setTarget(item); setServerError(''); };
  const close = () => setTarget(null);

  return { target, isOpen: !!target, loading, serverError, open, close, setLoading, setServerError };
}
