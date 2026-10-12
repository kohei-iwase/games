import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseScript,resolveName,CHARACTERS} from '../dist/story.mjs';
const load=n=>parseScript(readFileSync(new URL(`../dist/story/${n}.txt`,import.meta.url),'utf8'));
const count=c=>c.reduce((m,x)=>(m[x.type]=(m[x.type]||0)+1,m),{});
const tests=[];function test(n,f){f();tests.push(n)}

const flat=c=>c.flatMap(x=>x.type==='choice'?[x,...x.branches.flatMap(flat)]:[x]);
test('3つの台本に警告がなく、命令の種類と件数が決まっている',()=>{
 const p=load('prologue'),c=load('contact-nephilim'),i=load('interlude-lamp');
 for(const s of [p,c,i])assert.equal(s.filter(x=>x.type==='warn').length,0,JSON.stringify(s.filter(x=>x.type==='warn')));
 assert.deepEqual(count(p),{bg:3,narr:3,form:2,enter:9,say:34,sfx:3,fx:4,exit:5,choice:2,nameinput:1});
 assert.deepEqual(count(flat(p)),{bg:3,narr:3,form:2,enter:9,say:45,sfx:3,fx:4,exit:5,choice:2,nameinput:1});
 assert.deepEqual(count(c),{bg:1,sfx:2,fx:2,narr:1,form:1,enter:3,say:8,choice:1});
 assert.deepEqual(count(i),{bg:1,narr:1,form:1,enter:3,say:18,choice:1});
 assert.equal(p[0].type,'bg');assert.equal(p[0].value,'sea');assert.equal(i[0].value,'chart')});
test('選択肢と分岐の構造',()=>{
 const ch=load('prologue').filter(x=>x.type==='choice');
 assert.equal(ch.length,2);
 assert.deepEqual(ch[0].options,['……は？','心臓って、たとえ話ですよね？','お断りします']);
 assert.deepEqual(ch[0].branches.map(b=>b.length),[2,2,2]);
 assert.equal(ch[0].branches[2][0].who.name,'姫');assert.equal(ch[0].branches[2][1].who.key,'lance');
 assert.deepEqual(ch[1].branches.map(b=>b.length),[2,3]);
 // 分岐の中身は本流に混ざらない
 assert.ok(!load('prologue').some(x=>x.type==='say'&&x.text==='お断りします。'));
 const [one]=parseScript('@選択 はい|いいえ\n@もし 1\nミラルカ あ\n@もし 2\nカナン い\nカナン う\n@ここまで\nオリーヴェ え');
 assert.deepEqual(one.options,['はい','いいえ']);assert.deepEqual(one.branches.map(b=>b.length),[1,2]);
 assert.equal(parseScript('@選択 はい|いいえ\n@もし 1\nミラルカ あ\n@ここまで\nオリーヴェ え').length,2)});
test('{姫}はパーサでは置換しない',()=>{
 const t=flat(load('prologue')).filter(x=>x.type==='say'&&x.text.includes('{姫}'));
 assert.ok(t.length>=2);assert.ok(flat(load('interlude-lamp')).some(x=>x.type==='say'&&x.text.includes('{姫}')))});
test('話者「姫」・@姿・@名前入力',()=>{
 const [h]=parseScript('姫［驚き］えっ');assert.equal(h.who.key,'hero');assert.equal(h.who.name,'姫');assert.equal(h.who.art,'hero');
 const c=parseScript('@姿 幻影\n@姿 人\n@名前入力\n@登場 姫 左');
 assert.deepEqual(c.map(x=>x.type),['form','form','nameinput','enter']);assert.deepEqual(c.slice(0,2).map(x=>x.value),['ghost','human']);assert.equal(c[3].who.key,'hero');
 assert.equal(parseScript('@姿 鳥')[0].type,'warn')});
test('新しい感情と頭上の記号',()=>{
 const m=t=>parseScript(`ミラルカ［${t}］あ`)[0];
 assert.equal(m('焦り').motion,'震える');assert.equal(m('呆れ').motion,null);assert.equal(m('得意').motion,null);
 assert.equal(m('焦り・頷く').motion,'頷く');
 const sym={喜び:'♪',驚き:'！？',哀しみ:'…',照れ:'♡',呆れ:'…',得意:'✦'};
 for(const [e,t] of Object.entries(sym))assert.equal(m(e).symbol.text,t,e);
 assert.equal(m('怒り').symbol.kind,'anger');assert.equal(m('焦り').symbol.kind,'sweat');assert.equal(m('呆れ').symbol.kind,'weary');
 for(const e of ['静か','凛','不敵'])assert.equal(m(e).symbol,null,e);
 assert.equal(parseScript('ミラルカ あ')[0].symbol,null)});
test('分岐の書式の誤りは警告になる',()=>{
 const w=t=>parseScript(t).filter(x=>x.type==='warn');
 assert.equal(w('@選択 はい|いいえ\n@もし 1\nミラルカ あ').length,1,'@ここまで がない');
 assert.equal(w('@選択 はい|いいえ\n@もし 3\nミラルカ あ\n@ここまで')[0].line,2);
 assert.equal(w('@選択 はい|いいえ\n@もし 0\nミラルカ あ\n@ここまで').length,2,'番号の誤りと、捨てられる行');
 assert.equal(w('@もし 1').length,1);assert.equal(w('@ここまで').length,1);
 assert.equal(w('@選択 はい\n@もし 1\nミラルカ あ\n@ここまで').length,1,'選択肢が1つ');
 assert.equal(w('@選択 はい|いいえ\nミラルカ あ\n@もし 1\nミラルカ い\n@ここまで').length,1,'@もし の前の行は再生されない');
 assert.equal(w('@選択 はい|いいえ\n@選択 A|B\n@ここまで').length,1,'入れ子は不可');
 const c=parseScript('@選択 はい|いいえ\n@もし 3\nミラルカ あ\n@ここまで\nカナン い');
 assert.equal(c.filter(x=>x.type==='say').length,1,'誤った番号の中身は捨てる')});
test('名前の解決：短縮形も表示名も同じ人物、未知の名前は札だけ',()=>{
 for(const [a,key,name] of [['ミラルカ','lance','ミラルカ辺境伯'],['ミラルカ辺境伯','lance','ミラルカ辺境伯'],['カナン','stake','カナン卿'],['カナン卿','stake','カナン卿'],['オリーヴェ','guard','堅牢なるオリーヴェ'],['堅牢なるオリーヴェ','guard','堅牢なるオリーヴェ']]){const w=resolveName(a);assert.equal(w.key,key);assert.equal(w.name,name);assert.equal(w.art,CHARACTERS[key].art)}
 const w=resolveName('見張り');assert.deepEqual(w,{key:null,name:'見張り',art:null,color:null});
 const [s]=parseScript('見張り［驚き］敵だ！');assert.equal(s.who.name,'見張り');assert.equal(s.who.art,null)});
test('プロローグの台詞：話者・感情・動き',()=>{
 const say=load('prologue').filter(x=>x.type==='say');
 assert.equal(say[0].who.key,'hero');assert.equal(say[0].emotion,'静か');assert.equal(say[0].motion,null);assert.equal(say[0].symbol,null);
 const m=say.find(x=>x.text.startsWith('到着！'));assert.equal(m.who.name,'ミラルカ辺境伯');assert.equal(m.emotion,'得意');assert.equal(m.motion,'跳ねる');assert.equal(m.symbol.text,'✦')});
test('感情だけなら既定の動きが付く',()=>{
 const m=(t)=>parseScript(`ミラルカ［${t}］あ`)[0];
 assert.equal(m('喜び').motion,'跳ねる');assert.equal(m('驚き').motion,'身を引く');assert.equal(m('怒り').motion,'揺れる');
 for(const e of ['哀しみ','静か','凛','照れ','不敵','呆れ','得意'])assert.equal(m(e).motion,null,e);
 assert.equal(m('喜び・震える').motion,'震える','書いた動きが優先');
 const only=m('頷く');assert.equal(only.emotion,null);assert.equal(only.motion,'頷く');
 const none=parseScript('ミラルカ あ')[0];assert.equal(none.emotion,null);assert.equal(none.motion,null);assert.equal(none.text,'あ')});
test('／は改行、地の文は＊',()=>{
 const [n]=parseScript('＊一行目／二行目');assert.deepEqual([n.type,n.text],['narr','一行目\n二行目']);
 const [s]=parseScript('カナン［静か］ふむ／よろしい');assert.equal(s.text,'ふむ\nよろしい')});
test('（〜）は心の声',()=>{
 const [a,b]=parseScript('ミラルカ［静か］（……ローラ）\nミラルカ［静か］……ローラ');
 assert.equal(a.mind,true);assert.equal(a.text,'……ローラ');assert.equal(b.mind,false);
 assert.ok(flat(load('interlude-lamp')).some(x=>x.mind&&x.text.startsWith('島の人たち')))});
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
