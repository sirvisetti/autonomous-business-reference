import { cp, copyFile, mkdir, rm } from 'node:fs/promises';

const output = 'dist';
const files = ['index.html', 'http.html', 'playground.html', 'robots.txt', 'sitemap.xml', 'LICENSE.md'];
const directories = ['assets', 'examples', 'openapi'];

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

for (const file of files) {
  await copyFile(file, `${output}/${file}`);
}

for (const directory of directories) {
  await cp(directory, `${output}/${directory}`, { recursive: true });
}

console.log('ABR static site built to dist/.');
