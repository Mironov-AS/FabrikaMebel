import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SearchInput from './SearchInput';

describe('SearchInput', () => {
  it('renders an input element', () => {
    render(<SearchInput value="" onChange={vi.fn()} />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('shows the placeholder text', () => {
    render(<SearchInput value="" onChange={vi.fn()} placeholder="Search contracts..." />);
    expect(screen.getByPlaceholderText('Search contracts...')).toBeInTheDocument();
  });

  it('displays the current value', () => {
    render(<SearchInput value="hello" onChange={vi.fn()} />);
    expect(screen.getByRole('textbox')).toHaveValue('hello');
  });

  it('calls onChange with the new value when typing', () => {
    const onChange = vi.fn();
    render(<SearchInput value="" onChange={onChange} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'test' } });
    expect(onChange).toHaveBeenCalledWith('test');
  });

  it('does not render clear button when value is empty', () => {
    render(<SearchInput value="" onChange={vi.fn()} />);
    expect(screen.queryByLabelText('Очистить')).toBeNull();
  });

  it('renders clear button when value is non-empty', () => {
    render(<SearchInput value="something" onChange={vi.fn()} />);
    expect(screen.getByLabelText('Очистить')).toBeInTheDocument();
  });

  it('calls onChange with empty string when clear button is clicked', () => {
    const onChange = vi.fn();
    render(<SearchInput value="abc" onChange={onChange} />);
    fireEvent.click(screen.getByLabelText('Очистить'));
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('applies custom className to the wrapper', () => {
    const { container } = render(<SearchInput value="" onChange={vi.fn()} className="w-64" />);
    expect(container.firstChild).toHaveClass('w-64');
  });
});
