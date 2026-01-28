import { createRequire } from 'module';
const require = createRequire(import.meta.url);
try {
    const pdf = require('pdf-parse');
    console.log('Type:', typeof pdf);
    console.log('Value:', pdf);
} catch (e) {
    console.error(e);
}
