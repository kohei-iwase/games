import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseScript,resolveName,CHARACTERS} from '../dist/story.mjs';
const load=n=>parseScript(readFileSync(new URL(`../dist/story/${n}.txt`,import.meta.url),'utf8'));
const count=c=>c.reduce((m,x)=>(m[x.type]=(m[x.type]||0)+1,m),{});
const tests=[];function test(n,f){f();tests.push(n)}

test('3つの台本に警告がなく、命令の種類と件数が決まっている',()=>{
 const p=load('prologue'),c=load('contact-nephilim'),i=load('interlude-lamp');
 for(const s of [p,c,i])assert.equal(s.filter(x=>x.type==='warn').length,0,JSON.stringify(s.filter(x=>x.type==='warn')));
 assert.deepEqual(count(p),{bg:1,narr:2,sfx:2,enter:3,say:19,fx:2,exit:2});
 assert.deepEqual(count(c),{bg:1,sfx:2,fx:2,narr:1,enter:2,say:5});
 assert.deepEqual(count(i),{bg:1,narr:3,enter:2,say:18,sfx:2});
 assert.equal(p[0].type,'bg');assert.equal(p[0].value,'sea');assert.equal(i[0].value,'chart')});
test('名前の解決：短縮形も表示名も同じ人物、未知の名前は札だけ',()=>{
 for(const [a,key,name] of [['ミラルカ','lance','ミラルカ辺境伯'],['ミラルカ辺境伯','lance','ミラルカ辺境伯'],['カナン','stake','カナン卿'],['カナン卿','stake','カナン卿'],['オリーヴェ','guard','堅牢なるオリーヴェ'],['堅牢なるオリーヴェ','guard','堅牢なるオリーヴェ']]){const w=resolveName(a);assert.equal(w.key,key);assert.equal(w.name,name);assert.equal(w.art,CHARACTERS[key].art)}
 const w=resolveName('見張り');assert.deepEqual(w,{key:null,name:'見張り',art:null,color:null});
 const [s]=parseScript('見張り［驚き］敵だ！');assert.equal(s.who.name,'見張り');assert.equal(s.who.art,null)});
test('プロローグの台詞：話者・感情・動き',()=>{
 const say=load('prologue').filter(x=>x.type==='say');
 assert.equal(say[0].who.key,'guard');assert.equal(say[0].emotion,'静か');assert.equal(say[0].motion,null);
 const m=say.find(x=>x.text.startsWith('ちょうど退屈'));assert.equal(m.who.name,'ミラルカ辺境伯');assert.equal(m.emotion,'喜び');assert.equal(m.motion,'跳ねる')});
test('感情だけなら既定の動きが付く',()=>{
 const m=(t)=>parseScript(`ミラルカ［${t}］あ`)[0];
 assert.equal(m('喜び').motion,'跳ねる');assert.equal(m('驚き').motion,'身を引く');assert.equal(m('怒り').motion,'揺れる');
 for(const e of ['哀しみ','静か','凛','照れ','不敵'])assert.equal(m(e).motion,null,e);
 assert.equal(m('喜び・震える').motion,'震える','書いた動きが優先');
 const only=m('頷く');assert.equal(only.emotion,null);assert.equal(only.motion,'頷く');
 const none=parseScript('ミラルカ あ')[0];assert.equal(none.emotion,null);assert.equal(none.motion,null);assert.equal(none.text,'あ')});
test('／は改行、地の文は＊',()=>{
 const [n]=parseScript('＊一行目／二行目');assert.deepEqual([n.type,n.text],['narr','一行目\n二行目']);
 const [s]=parseScript('カナン［静か］ふむ／よろしい');assert.equal(s.text,'ふむ\nよろしい')});
test('（〜）は心の声',()=>{
 const [a,b]=parseScript('ミラルカ［静か］（……ローラ）\nミラルカ［静か］……ローラ');
 assert.equal(a.mind,true);assert.equal(a.text,'……ローラ');assert.equal(b.mind,false);
 const pr=load('prologue').find(x=>x.mind);assert.ok(pr&&pr.text.startsWith('……ローラ'))});
test('半角の[]も使える',()=>{
 const [s]=parseScript('オリーヴェ[哀しみ・震える]お祖父さま');assert.equal(s.who.key,'guard');assert.equal(s.emotion,'哀しみ');assert.equal(s.motion,'震える');assert.equal(s.text,'お祖父さま')});
test('コメント・空行は無視、@命令の変換',()=>{
 const c=parseScript('# 注\n\n@背景 海図\n@登場 カナン 左\n@退場 カナン\n@演出 閃光\n@音 十字架\n@間 0.8\n');
 assert.deepEqual(c.map(x=>x.type),['bg','enter','exit','fx','sfx','wait']);
 assert.equal(c[0].value,'chart');assert.equal(c[1].pos,'left');assert.equal(c[1].who.key,'stake');assert.equal(c[3].name,'flash');assert.equal(c[4].name,'cross');assert.equal(c[5].sec,.8);assert.equal(c[2].line,5);
 assert.deepEqual(parseScript('@登場 ミラルカ 中\n@登場 オリーヴェ 右').map(x=>x.pos),['center','right']);
 assert.deepEqual(parseScript('@背景 暗転\n@演出 暗転\n@演出 明転\n@演出 揺れ\n@音 鐘\n@音 鼓動\n@音 杭\n@音 打撃').map(x=>x.value||x.name),['black','fadeout','fadein','shake','bell','heart','stake','hit'])});
test('書式の誤りは例外にせず warn として残す',()=>{
 const c=parseScript('@未知 x\nミラルカ［静か］ふむ\n@背景 空\n@演出 爆発\n@音 ラッパ\n@間 ながい\n@登場 見張り 左\n@登場 ミラルカ 上\nミラルカ［ほげ］ふむ\n名前だけ');
 assert.equal(c.filter(x=>x.type==='warn').map(x=>x.line).join(),'1,3,4,5,6,7,8,9,10');
 assert.equal(c[0].type,'warn');assert.ok(c[0].text.includes('@未知'));assert.equal(c[1].type,'say');
 assert.equal(c.find(x=>x.type==='say'&&x.line===9).emotion,null)});
console.log(`story: ${tests.length} tests passed`);
