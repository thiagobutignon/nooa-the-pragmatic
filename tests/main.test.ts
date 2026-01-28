import { describe, it, expect, vi, beforeEach } from 'vitest';
import { main } from '../index';

// Mock dependencies
vi.mock('../src/converter', () => ({
    convertPdfToMarkdown: vi.fn().mockResolvedValue('# Mocked Markdown'),
}));

vi.mock('../src/pdf-generator', () => ({
    generatePdfFromMarkdown: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('fs/promises', () => ({
    writeFile: vi.fn().mockResolvedValue(undefined),
}));

// Mock Bun global
if (typeof (global as any).Bun === 'undefined') {
    (global as any).Bun = {
        file: (path: string) => ({
            exists: async () => path !== 'non-existent-at-all.pdf',
            text: async () => 'mock-content',
            arrayBuffer: async () => new ArrayBuffer(0),
        }),
        argv: ['bun', 'index.ts'],
        main: 'index.ts',
    };
}

describe('main function', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.exitCode = 0;
    });

    it('should show help with --help', async () => {
        const logSpy = vi.spyOn(console, 'log').mockImplementation(() => { });
        await main(['bun', 'index.ts', '--help']);
        expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Usage:'));
    });

    it('should show version with --version', async () => {
        const logSpy = vi.spyOn(console, 'log').mockImplementation(() => { });
        await main(['bun', 'index.ts', '--version']);
        expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('v1.1.0'));
    });

    it('should fail if no input is provided', async () => {
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
        await main(['bun', 'index.ts']);
        expect(process.exitCode).toBe(1);
        expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Input file is required'));
    });

    it('should fail if file does not exist', async () => {
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
        await main(['bun', 'index.ts', 'non-existent-at-all.pdf']);
        expect(process.exitCode).toBe(1);
        expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('File not found'));
    });

    it('should successfully convert PDF to Markdown and print to stdout', async () => {
        const logSpy = vi.spyOn(console, 'log').mockImplementation(() => { });
        await main(['bun', 'index.ts', 'input.pdf']);
        expect(logSpy).toHaveBeenCalledWith('# Mocked Markdown');
        expect(process.exitCode).toBe(0);
    });

    it('should successfully convert PDF to Markdown and write to file', async () => {
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
        await main(['bun', 'index.ts', 'input.pdf', '-o', 'out.md']);
        expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Successfully converted'));
        expect(process.exitCode).toBe(0);
    });

    it('should successfully convert Markdown to PDF', async () => {
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
        await main(['bun', 'index.ts', 'input.md', '--to-pdf']);
        expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Successfully generated PDF'));
        expect(process.exitCode).toBe(0);
    });

    it('should successfully output JSON structure', async () => {
        const logSpy = vi.spyOn(console, 'log').mockImplementation(() => { });
        await main(['bun', 'index.ts', 'input.pdf', '--json']);
        const outputJSON = logSpy.mock.calls[0]?.[0];
        expect(outputJSON).toBeDefined();
        expect(JSON.parse(outputJSON!)).toHaveProperty('content', '# Mocked Markdown');
    });

    it('should handle errors during processing gracefully', async () => {
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
        const { convertPdfToMarkdown } = await import('../src/converter');
        vi.mocked(convertPdfToMarkdown).mockRejectedValueOnce(new Error('Boom!'));

        await main(['bun', 'index.ts', 'input.pdf']);
        expect(process.exitCode).toBe(1);
        expect(errorSpy).toHaveBeenCalledWith('Error:', 'Boom!');
    });
});
