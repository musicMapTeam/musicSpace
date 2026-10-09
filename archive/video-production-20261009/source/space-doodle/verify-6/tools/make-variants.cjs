// Builds variant dirs next to dist-pages: same files (symlinks) except index.html.
const fs = require('fs'), path = require('path');
const base = '/tmp/space-doodle/verify-6';
const dist = path.join(base, 'dist-pages');
const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(dist, 'fonts/doodle/fonts.css'), 'utf8');
const LINK = '<link rel="stylesheet" href="./fonts/doodle/fonts.css">';
if (html.split(LINK).length !== 2) throw new Error('link not found exactly once');
const variants = {
  inline: html.replace(LINK, () => '<style>' + css.replace(/url\("\.\/([^"]+)"\)/g, 'url("./fonts/doodle/$1")') + '</style>'),
  nolink: html.replace(LINK, ''),
};
for (const [name, text] of Object.entries(variants)) {
  const d = path.join(base, 'v-' + name);
  fs.rmSync(d, {recursive: true, force: true}); fs.mkdirSync(d);
  for (const e of fs.readdirSync(dist)) if (e !== 'index.html') fs.symlinkSync(path.join(dist, e), path.join(d, e));
  fs.writeFileSync(path.join(d, 'index.html'), text);
  console.log(name, text.length, 'bytes; fonts urls rewritten:', (text.match(/url\("\.\/fonts\/doodle\//g) || []).length);
}
