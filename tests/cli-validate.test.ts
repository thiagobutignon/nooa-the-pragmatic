import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { main } from '../index';

// Mock dependencies
vi.mock('../src/converter', () => ({
    convertPdfToMarkdown: vi.fn(),
}));

vi.mock('../src/pdf-generator', () => ({
    generatePdfFromMarkdown: vi.fn(),
}));

// Mock Bun global
if (typeof (global as any).Bun === 'undefined') {
    (global as any).Bun = {
        file: (path: string) => ({
            exists: async () => true,
            text: async () => '# Resume\n\n[Valid](https://ok.com) and [Broken](https://error.com)',
            arrayBuffer: async () => new ArrayBuffer(0),
        }),
        argv: ['bun', 'index.ts'],
        main: 'index.ts',
    };
}

describe('CLI --validate integration', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn());
        process.exitCode = 0;
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.clearAllMocks();
    });

    it('should pass and return exit code 0 when all links are valid', async () => {
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
        vi.mocked(fetch).mockResolvedValue({ ok: true, status: 200 } as Response);

        await main(['bun', 'index.ts', 'resume.md', '--validate']);

        expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('All links are valid!'));
        expect(process.exitCode).toBe(0);
    });

    it('should fail and return exit code 1 when a link is broken', async () => {
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

        // Mock success for first link, failure for second
        vi.mocked(fetch)
            .mockResolvedValueOnce({ ok: true, status: 200 } as Response)
            .mockResolvedValueOnce({ ok: false, status: 404 } as Response);

        await main(['bun', 'index.ts', 'resume.md', '--validate']);

        expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Validation failed: 1 link(s) are unreachable.'));
        expect(process.exitCode).toBe(1);
    });

    it('should report specific error for timeouts', async () => {
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

        vi.mocked(fetch).mockRejectedValue({ name: 'AbortError' });

        await main(['bun', 'index.ts', 'resume.md', '--validate']);

        expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Timeout'));
        expect(process.exitCode).toBe(1);
    });
});
