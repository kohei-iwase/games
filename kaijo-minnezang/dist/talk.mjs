// 物語パートの会話画面（立ち絵のADV）。story.mjs の命令列を、#talk の DOM に再生する。
// 背景の3Dは app.mjs が描く。ここは .stage に talk-sea／talk-chart／talk-black を付けて、ぼかし・暗さだけを CSS に任せる。
import {EMOTIONS,MOTIONS} from './story.mjs';
const TYPE_MS=34,FX_MS={flash:620,fadeout:1400,fadein:1200,shake:560};
const SLIDE={left:'-34vw',center:'0',right:'34vw'};

// opts: {root:#talk, stage:.stage, audio, shake(), onTap()}
export function createTalk(opts){
 const {root,stage,audio}=opts,$=s=>root.querySelector(s);
 const el={fade:$('#talkFade'),flash:$('#talkFlash'),stageBox:$('#talkFigures'),box:$('#talkBox'),name:$('#talkName'),text:$('#talkText'),next:$('#talkNext'),log:$('#talkLogView'),logList:$('#talkLogList')};
 const slots={};for(const pos of ['left','center','right'])slots[pos]=el.stageBox.querySelector(`[data-pos="${pos}"]`);
 const s={active:false,bg:'black',cmds:[],i:0,done:null,wait:null,typing:null,full:'',shown:0,blocked:null,busyUntil:0,log:[]};

 const setBg=v=>{s.bg=v;stage.classList.toggle('talk-sea',v==='sea');stage.classList.toggle('talk-chart',v==='chart');stage.classList.toggle('talk-black',v==='black')};
 const restart=(node,cls)=>{node.classList.remove(cls);void node.offsetWidth;node.classList.add(cls)};
 const slotOf=key=>Object.values(slots).find(x=>x.dataset.who===key);

 function enter(who,pos){
  const old=slotOf(who.key);if(old&&old!==slots[pos])leave(old);
  const sl=slots[pos],fig=sl.firstElementChild,img=fig.firstElementChild;
  if(sl.dataset.who===who.key&&!sl.classList.contains('out'))return;
  sl.dataset.who=who.key;img.src=who.art;img.alt='';sl.style.setProperty('--slide',SLIDE[pos]);
  sl.classList.remove('shown','out','speaking');sl.classList.add('pre');void sl.offsetWidth;sl.classList.remove('pre');sl.classList.add('shown')}
 function leave(sl){
  if(!sl.dataset.who)return;sl.dataset.who='';sl.classList.remove('speaking');sl.classList.add('out');
  setTimeout(()=>{if(!sl.dataset.who)sl.classList.remove('shown','out')},560)}
 const clearStage=()=>{for(const sl of Object.values(slots)){sl.dataset.who='';sl.className='talk-slot';sl.removeAttribute('data-emo')}};

 // 話者を前に出す。感情の色味は data-emo、動きは img の animation。
 function speak(c){
  for(const sl of Object.values(slots)){sl.classList.remove('speaking');sl.removeAttribute('data-emo')}
  const sl=c.who.key&&slotOf(c.who.key);if(!sl)return;
  sl.classList.add('speaking');if(c.emotion)sl.dataset.emo=EMOTIONS[c.emotion];
  const img=sl.firstElementChild.firstElementChild;for(const m of Object.values(MOTIONS))img.classList.remove('m-'+m);
  if(c.motion){void img.offsetWidth;img.classList.add('m-'+MOTIONS[c.motion])}}

 function type(text){
  clearInterval(s.typing);s.full=text;s.shown=0;el.text.textContent='';el.next.hidden=true;
  s.typing=setInterval(()=>{s.shown++;el.text.textContent=s.full.slice(0,s.shown);if(s.shown>=s.full.length)endTyping()},TYPE_MS)}
 function endTyping(){clearInterval(s.typing);s.typing=null;s.shown=s.full.length;el.text.textContent=s.full;el.next.hidden=false}

 function line(c){
  const narr=c.type==='narr';
  el.box.classList.toggle('mind',!!c.mind);el.box.classList.toggle('narr',narr||!c.who.name);
  el.name.hidden=narr;if(!narr){el.name.textContent=c.who.name;el.name.style.setProperty('--c',c.who.color||'#6d6a78')}
  if(narr)speak({who:{key:null}});else speak(c);
  s.log.push({name:narr?'':c.who.name,text:c.text,mind:!!c.mind,narr});
  s.blocked='line';type(c.text)}

 function fx(name){
  s.busyUntil=Math.max(s.busyUntil,performance.now()+FX_MS[name]);
  if(name==='flash')restart(el.flash,'on');
  else if(name==='fadeout'){el.fade.style.transitionDuration='1.4s';el.fade.classList.add('on')}
  else if(name==='fadein'){el.fade.style.transitionDuration='1.2s';el.fade.classList.remove('on')}
  else if(name==='shake'){restart(el.stageBox,'shake');restart(el.box,'shake');opts.shake?.()}}

 // 次の命令へ。台詞と @間 で止まり、それ以外は続けて実行する。
 function run(){
  s.blocked=null;
  while(s.i<s.cmds.length){
   const c=s.cmds[s.i++];
   switch(c.type){
    case 'say':case 'narr':line(c);return;
    case 'wait':s.blocked='wait';s.wait=setTimeout(()=>{s.wait=null;run()},c.sec*1000);return;
    case 'bg':setBg(c.value);break;
    case 'enter':enter(c.who,c.pos);break;
    case 'exit':{const sl=slotOf(c.who.key);if(sl)leave(sl);break}
    case 'fx':fx(c.name);break;
    case 'sfx':audio.sfx(c.name);break;
    case 'warn':console.warn(`台本 ${c.line}行目：${c.text}`);break}}
  s.blocked='end';const left=s.busyUntil-performance.now();s.wait=setTimeout(()=>{s.wait=null;finish()},Math.max(0,left)+150)}

 function advance(){
  if(!s.active||!el.log.hidden)return;
  if(s.blocked==='line'){if(s.typing)endTyping();else run()}
  else if(s.blocked==='wait'){clearTimeout(s.wait);s.wait=null;run()}}

 function finish(){
  if(!s.active)return;clearInterval(s.typing);clearTimeout(s.wait);s.typing=s.wait=null;s.active=false;
  root.hidden=true;el.log.hidden=true;stage.classList.remove('talk-on','talk-sea','talk-chart','talk-black');clearStage();
  const d=s.done;s.done=null;d?.()}

 // 台本を読み込む間も黒い画面を出しておく。
 function begin(){
  clearTimeout(s.wait);clearInterval(s.typing);clearStage();s.log=[];s.cmds=[];s.i=0;s.busyUntil=0;s.blocked='load';s.active=true;
  el.fade.style.transition='none';el.fade.classList.add('on');el.flash.classList.remove('on');el.box.classList.add('narr');el.name.hidden=true;el.text.textContent='';el.next.hidden=true;el.log.hidden=true;
  root.hidden=false;stage.classList.add('talk-on');setBg('black')}
 function play(cmds,done){
  if(!s.active)begin();s.cmds=cmds;s.i=0;s.done=done;
  el.fade.style.transition='';el.fade.style.transitionDuration='.9s';void el.fade.offsetWidth;el.fade.classList.remove('on');run()}
 // 台本が読めなかったとき。
 const abort=()=>finish();

 function openLog(){
  el.logList.innerHTML=s.log.map(l=>`<p class="${l.narr?'narr':''}${l.mind?' mind':''}">${l.name?`<b>${esc(l.name)}</b>`:''}<span>${esc(l.text)}</span></p>`).join('')||'<p class="narr"><span>まだ台詞はありません。</span></p>';
  el.log.hidden=false;el.logList.scrollTop=el.logList.scrollHeight;$('#talkLogClose').focus()}
 const esc=t=>String(t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
 $('#talkLog').onclick=openLog;$('#talkLogClose').onclick=()=>{el.log.hidden=true};
 $('#talkSkip').onclick=()=>{if(s.active&&s.blocked!=='load')finish()};
 root.addEventListener('click',ev=>{if(ev.target.closest('button,.talk-logview'))return;opts.onTap?.();advance()});
 // Space／Enter は会話が受け取る（戦略マップの進行などに渡さない）。ログの表示中は Esc で閉じる。
 document.addEventListener('keydown',ev=>{
  if(!s.active)return;
  if(ev.key==='Escape'&&!el.log.hidden){ev.preventDefault();ev.stopImmediatePropagation();el.log.hidden=true;return}
  if(ev.code==='Space'||ev.key==='Enter'){if(ev.target.tagName==='BUTTON'&&ev.key==='Enter')return;ev.preventDefault();ev.stopImmediatePropagation();if(!ev.repeat)advance()}},true);

 return {begin,play,abort,advance,get active(){return s.active},get bg(){return s.bg}}}
