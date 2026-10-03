// Bundles the built app into one self-contained HTML page for sharing as a link.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';

const dir = 'dist-share/assets';
const files = readdirSync(dir);
const css = files.filter((f) => f.endsWith('.css')).map((f) => readFileSync(`${dir}/${f}`, 'utf8')).join('\n');
const js = files.filter((f) => f.endsWith('.js')).map((f) => readFileSync(`${dir}/${f}`, 'utf8')).join('\n');
if (js.includes('</script')) throw new Error('Bundle contains </script; cannot inline safely');

const page = `<title>GameShot Prototype</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,400;0,500;0,600;0,700;1,500&display=swap" rel="stylesheet" />
<style>:root{color-scheme:light}
${css}</style>
<div id="root"></div>
<script type="module">
${js}
</script>
`;
writeFileSync('dist-share/gameshot.html', page);
console.log(`dist-share/gameshot.html  ${(page.length / 1024).toFixed(0)} KB`);
