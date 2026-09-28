const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validate, originalSlug } = require('./cms-validation');
const base = {title:'文章',topic:'golang',summary:'摘要',categories:['Go'],tags:['channel'],draft:false,date:'2026-09-01T12:00:00+08:00',lastmod:'2026-09-01T12:00:00+08:00',slug:'test-post',body:'## 标题\n```go\nfmt.Println(1)\n```\n![图](go.png)'};
const fresh = {mode:'new',newRecord:true};
test('valid article',()=>assert.deepEqual(validate(base,fresh),[]));
for(const [name,change,fragment] of [
 ['missing category',{categories:[]},'分类'],['title whitespace',{title:' 文章'},'首尾'],['missing tag',{tags:[]},'标签'],
 ['empty image alt',{body:'## 文\n![](go.png)'},'图片须'],
 ['external image',{body:'## 文\n![图](https://gitee.com/a.png)'},'外链'],
 ['invalid date',{date:'2026-02-30T12:00:00+08:00'},'日期'],
 ['future date',{date:'2099-01-01T12:00:00+08:00'},'当前时间'],
 ['unclosed fence',{body:'## 文\n```go'},'围栏'],
 ['H1',{body:'# 标题'},'一级标题'],
 ['draft',{draft:true},'draft: false']
]) test(name,()=>assert(validate({...base,...change},fresh).some(e=>e.includes(fragment))));
test('old path remains locked',()=>{
 assert.equal(originalSlug('content/posts/go-channel/index.md',''),'go-channel');
 assert.deepEqual(validate({...base,slug:''},{mode:'edit',newRecord:false,path:'content/posts/go-channel/index.md'}),[]);
 assert(validate({...base,slug:'changed'},{mode:'edit',newRecord:false,path:'content/posts/go-channel/index.md'}).some(e=>e.includes('锁定')));
});
test('new entry rejects historical edits',()=>assert(validate(base,{mode:'new',newRecord:false,path:'content/posts/test-post/index.md'}).some(e=>e.includes('历史'))));
