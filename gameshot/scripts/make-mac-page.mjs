// Wraps the single-file share build in a MacBook Pro presentation frame.
import { readFileSync, writeFileSync } from 'node:fs';

const share = readFileSync('dist-share/gameshot.html', 'utf8');
const appDoc = `<!doctype html><html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><!--START--></head><body style="margin:0">${share}</body></html>`;
const b64 = Buffer.from(appDoc, 'utf8').toString('base64');
const page = readFileSync('scripts/mac-frame.html', 'utf8').replace('__APP_B64__', b64);
writeFileSync('dist-share/gameshot-mac.html', page);
console.log(`dist-share/gameshot-mac.html  ${(page.length / 1024).toFixed(0)} KB`);
