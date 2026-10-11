import { cp, mkdir } from 'node:fs/promises';

// Next may already trace public files (for example certificate fonts).
// Merge directory contents instead of nesting a second public directory.
await mkdir('.next/standalone/public', { recursive: true });
await cp('public', '.next/standalone/public', { recursive: true });
await mkdir('.next/standalone/.next', { recursive: true });
await cp('.next/static', '.next/standalone/.next/static', { recursive: true });
console.log('Standalone images, audio and static assets packaged');
