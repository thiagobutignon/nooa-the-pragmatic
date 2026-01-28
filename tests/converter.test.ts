import { describe, it, expect, vi } from 'vitest';
import { convertPdfToMarkdown } from '../src/converter';

// Mock pdf-parse
vi.mock('pdf-parse', () => {
    return {
        PDFParse: class {
            data: any;
            constructor(options: any) {
                this.data = options.data;
            }
            async getText() {
                // Mock behavior based on buffer content
                const content = this.data.toString();
                if (content === 'empty') return { text: '' };
                return { text: '  Hello  \r\nWorld\n\n\nParagraph  ' };
            }
            async destroy() { }
        }
    };
});

describe('convertPdfToMarkdown', () => {
    it('should clean up text correctly', async () => {
        const mockBuffer = Buffer.from('some-pdf-content');
        const result = await convertPdfToMarkdown(mockBuffer);

        expect(result).toBe('Hello  \nWorld\n\nParagraph');
    });

    it('should handle empty text', async () => {
        const mockBuffer = Buffer.from('empty');
        const result = await convertPdfToMarkdown(mockBuffer);
        expect(result).toBe('');
    });
});
