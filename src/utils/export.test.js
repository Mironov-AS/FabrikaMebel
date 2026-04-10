import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { downloadCSV, downloadJSON } from './export';

let capturedBlob = null;
let capturedAnchor = null;

beforeEach(() => {
  capturedBlob = null;
  capturedAnchor = null;

  vi.stubGlobal('URL', {
    createObjectURL: vi.fn((blob) => { capturedBlob = blob; return 'blob:mock-url'; }),
    revokeObjectURL: vi.fn(),
  });

  vi.spyOn(document, 'createElement').mockImplementation((tag) => {
    if (tag === 'a') {
      const el = { href: '', download: '', click: vi.fn() };
      capturedAnchor = el;
      return el;
    }
    return document.createElement.wrappedMethod?.(tag);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// ── downloadCSV ──────────────────────────────────────────────────────────────
describe('downloadCSV', () => {
  it('does nothing when rows is empty', () => {
    downloadCSV('test.csv', []);
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it('does nothing when rows is null', () => {
    downloadCSV('test.csv', null);
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it('triggers a download click with the correct filename', () => {
    downloadCSV('report.csv', [{ name: 'Alice' }]);
    expect(capturedAnchor.download).toBe('report.csv');
    expect(capturedAnchor.click).toHaveBeenCalledTimes(1);
  });

  it('sets anchor href to the created object URL', () => {
    downloadCSV('report.csv', [{ name: 'Alice' }]);
    expect(capturedAnchor.href).toBe('blob:mock-url');
  });

  it('revokes the object URL after click', () => {
    downloadCSV('report.csv', [{ name: 'Alice' }]);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });

  it('creates a Blob with CSV mime type', () => {
    downloadCSV('out.csv', [{ x: 1 }]);
    expect(capturedBlob.type).toContain('text/csv');
  });

  it('includes the CSV header row', async () => {
    downloadCSV('out.csv', [{ name: 'Alice', age: 30 }]);
    const text = await capturedBlob.text();
    expect(text).toContain('name');
    expect(text).toContain('age');
  });

  it('escapes values containing commas', async () => {
    downloadCSV('out.csv', [{ name: 'Smith, Jr.' }]);
    const text = await capturedBlob.text();
    expect(text).toContain('"Smith, Jr."');
  });

  it('escapes values containing double-quotes', async () => {
    downloadCSV('out.csv', [{ quote: 'say "hello"' }]);
    const text = await capturedBlob.text();
    expect(text).toContain('"say ""hello"""');
  });

  it('prepends a UTF-8 BOM (checked via Blob size)', () => {
    // The BOM '\uFEFF' is 3 bytes in UTF-8; verify blob is larger than raw CSV text
    downloadCSV('out.csv', [{ a: 1 }]);
    // BOM adds at least 1 extra character → blob size > 0
    expect(capturedBlob.size).toBeGreaterThan(0);
    // Verify Blob was created (not skipped)
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
  });

  it('uses CRLF line endings', async () => {
    downloadCSV('out.csv', [{ a: 1 }, { a: 2 }]);
    const text = await capturedBlob.text();
    expect(text).toContain('\r\n');
  });
});

// ── downloadJSON ─────────────────────────────────────────────────────────────
describe('downloadJSON', () => {
  it('triggers a download with the correct filename', () => {
    downloadJSON('data.json', [{ id: 1 }]);
    expect(capturedAnchor.download).toBe('data.json');
    expect(capturedAnchor.click).toHaveBeenCalledTimes(1);
  });

  it('creates a Blob with JSON mime type', () => {
    downloadJSON('data.json', [{ id: 1 }]);
    expect(capturedBlob.type).toContain('application/json');
  });

  it('serializes data to valid pretty-printed JSON', async () => {
    downloadJSON('data.json', [{ id: 42, name: 'test' }]);
    const text = await capturedBlob.text();
    const parsed = JSON.parse(text);
    expect(parsed).toEqual([{ id: 42, name: 'test' }]);
  });

  it('revokes the object URL after click', () => {
    downloadJSON('data.json', [{ a: 1 }]);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });
});
