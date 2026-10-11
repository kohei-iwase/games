// Executes actual UI handlers against a minimal DOM adapter and the native Canvas API.
// This is not a browser/layout test.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {createCanvas}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/@napi-rs/canvas');
const nodes=new Map(),orders=[],shipCards=[],skillButtons=[];
class Node {
 constructor(id='',tag='BUTTON',classes=''){this.id=id;this.tagName=tag;this.textContent='';this.hidden=false;this.disabled=false;this.style={setProperty(){}};this.dataset={};this.listeners={};this.attributes={};const cls=new Set(classes.split(' ').filter(Boolean));this.classList={add:(...xs)=>xs.forEach(x=>cls.add(x)),remove:(...xs)=>xs.forEach(x=>cls.delete(x)),contains:x=>cls.has(x),toggle:(x,v)=>{const add=v??!cls.has(x);add?cls.add(x):cls.delete(x);return add}};if(id)nodes.set(id,this);}
 setAttribute(k,v){this.attributes[k]=v} focus(){} addEventListener(k,v){this.listeners[k]=v}
 set innerHTML(s){this._html=s;if(this.id==='shipList'){shipCards.length=0;skillButtons.length=0;for(const m of s.matchAll(/data-skill="(.*?)"/g)){const n=new Node();n.dataset.skill=m[1];skillButtons.push(n)}for(const m of s.matchAll(/data-ship="(.*?)"/g)){const n=new Node();n.dataset.ship=m[1];shipCards.push(n)}}for(const m of s.matchAll(/id="(.*?)"/g)){if(!nodes.has(m[1]))new Node(m[1])}}get innerHTML(){return this._html||''}
}
const html=readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');
for(const m of html.matchAll(/<([\w-]+)[^>]*\bid="([^"]+)"[^>]*>/g)){const n=new Node(m[2],m[1].toUpperCase(),m[0].match(/class="([^"]*)"/)?.[1]||'');n.hidden=/\shidden/.test(m[0]);n.disabled=/\sdisabled/.test(m[0]);}
for(const name of ['charge','rally','hold']){const n=new Node('','BUTTON','order-option');n.dataset.order=name;orders.push(n)}
// A WebGL call adapter validates UI integration; shader pixels are checked in native3d.py.
let drawCalls=0,lastVP=[];
const gl=new Proxy({
 createShader:()=>({}),createProgram:()=>({}),createBuffer:()=>({}),createTexture:()=>({}),getShaderParameter:()=>true,getProgramParameter:()=>true,getUniformLocation:(_,n)=>n,getAttribLocation:(_,n)=>n==='aPosition'?0:1,
 uniformMatrix4fv:(loc,transpose,m)=>{assert(m.length===16&&Array.from(m).every(Number.isFinite));if(loc==='uVP')lastVP=Array.from(m)},uniformMatrix3fv:(_,__,m)=>assert(m.length===9&&Array.from(m).every(Number.isFinite)),drawArrays:()=>drawCalls++,
},{get:(o,k)=>k in o?o[k]:k===k.toUpperCase()?k:()=>{}});
const canvas=nodes.get('sea');canvas.width=0;canvas.height=0;canvas.clientWidth=1000;canvas.clientHeight=720;canvas.getContext=type=>type==='webgl'?gl:null;canvas.getBoundingClientRect=()=>({left:0,top:0,width:1000,height:720});
const cv=createCanvas(1000,720),overlay=nodes.get('seaLabels');Object.defineProperties(overlay,{width:{get:()=>cv.width,set:v=>cv.width=v},height:{get:()=>cv.height,set:v=>cv.height=v}});overlay.getContext=()=>cv.getContext('2d');
globalThis.document={hidden:false,querySelector:s=>s.startsWith('#')?nodes.get(s.slice(1)):s.startsWith('[data-skill=')?skillButtons.find(n=>n.dataset.skill===s.match(/"(.*?)"/)[1]):s.startsWith('[data-ship=')?shipCards.find(n=>n.dataset.ship===s.match(/"(.*?)"/)[1]):null,querySelectorAll:s=>s==='.order-option'?orders:s==='[data-ship]'?shipCards:s==='[data-skill]'?skillButtons:[],addEventListener(){}};
globalThis.window={matchMedia:()=>({matches:true})};
let callback;globalThis.requestAnimationFrame=f=>{callback=f};
await import('../dist/app.mjs');
let now=performance.now();const frame=()=>{now+=50;callback(now)};
assert.equal(nodes.get('statusText').textContent,'出撃準備');
frame();assert(nodes.get('renderError').hidden,'renderer initializes');const vp=lastVP.slice();nodes.get('zoomIn').onclick();frame();assert.notDeepEqual(lastVP,vp);nodes.get('cameraReset').onclick();frame();assert.deepEqual(lastVP,vp);

assert(!nodes.get('story').hidden,'prologue shown first');nodes.get('playBtn').onclick();assert(nodes.get('story').hidden,'first play closes the prologue');assert.equal(nodes.get('statusText').textContent,'出撃準備');
nodes.get('playBtn').onclick();
for(let i=0;i<150;i++)frame();assert.equal(nodes.get('statusText').textContent,'戦術ポーズ');
for(const btn of skillButtons){assert(!btn.disabled);btn.onclick();}
assert(nodes.get('comboText').textContent.includes('連携予約'));
nodes.get('playBtn').onclick();frame();assert.equal(nodes.get('cutin').hidden,false);
for(let i=0;i<45;i++)frame();assert.equal(nodes.get('cutin').hidden,true);
let timing=false;for(let i=0;i<500;i++){frame();if(!nodes.get('timingPanel').hidden){timing=true;nodes.get('timingBtn').onclick();break;}if(nodes.get('statusText').textContent==='戦術ポーズ')nodes.get('playBtn').onclick();}
assert(timing,'timing UI appears');
for(let i=0;i<40;i++)frame();if(nodes.get('statusText').textContent==='交戦中')nodes.get('playBtn').onclick();
orders[1].onclick();canvas.listeners.click({clientX:350,clientY:450});nodes.get('playBtn').onclick();frame();assert(nodes.get('mapState').textContent.includes('集合'));
nodes.get('resetBtn').onclick();frame();assert.equal(nodes.get('clock').textContent,'00:00');assert.equal(nodes.get('statusText').textContent,'出撃準備');
assert(drawCalls>1000);
console.log('3D UI handlers passed: start, event pause, three reservations, chained cutins, timing input, rally, reset.');
