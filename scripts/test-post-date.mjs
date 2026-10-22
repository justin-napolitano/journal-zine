import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import ts from 'typescript';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
const filename=fileURLToPath(import.meta.url);
if(process.argv.includes('--format')){
 const code=ts.transpileModule(fs.readFileSync('src/lib/posts.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
 const compiled={exports:{}};vm.runInNewContext(code,{module:compiled,exports:compiled.exports});
 console.log(JSON.stringify(['2026-02-14T09:04:00.000Z','2026-07-14T23:59:00.000Z'].map(x=>[compiled.exports.formatPostDate(x),compiled.exports.formatPostDate(new Date(x))])));
}else{
 test('SSR and browser host timezone/locale cannot alter public timestamps',()=>{
 const render=(TZ,LANG)=>execFileSync(process.execPath,[filename,'--format'],{env:{...process.env,TZ,LANG,LC_ALL:LANG},encoding:'utf8'}).trim();
 const expected=render('UTC','en_US.UTF-8');
 assert.deepEqual(JSON.parse(expected),[['Feb 14, 2026, 09:04 AM UTC','Feb 14, 2026, 09:04 AM UTC'],['Jul 14, 2026, 11:59 PM UTC','Jul 14, 2026, 11:59 PM UTC']]);
 for(const [zone,locale] of [['America/New_York','en_US.UTF-8'],['Asia/Tokyo','ja_JP.UTF-8'],['Europe/Berlin','de_DE.UTF-8']])assert.equal(render(zone,locale),expected);
 });
 test('PostCard uses the shared formatter without hiding hydration errors',()=>{
 const source=fs.readFileSync('src/components/PostCard.tsx','utf8');
 assert.match(source,/formatPostDate\(post.created_at\)/);assert.doesNotMatch(source,/toLocaleString|suppressHydrationWarning/);
 });
}
