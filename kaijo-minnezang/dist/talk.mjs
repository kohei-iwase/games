// 物語パートの会話画面（立ち絵のADV）。story.mjs の命令列を、#talk の DOM に再生する。
// 背景は .stage に talk-sea／chart／black／inlet／valley を付け、CSS が海の絵（art/bg-sea.jpg）・暗い海の絵・真っ黒・入り江の夜（bg-inlet-night.jpg）・谷（bg-valley.jpg）を敷く。入り江と谷の絵が無ければ暗い海の絵になる。
import {EMOTIONS,MOTIONS,HERO_FACES,DEFAULT_FACE} from './story.mjs';
import {DEFAULT_HERO_NAME} from './config.mjs';
const TYPE_MS=34,FX_MS={flash:620,fadeout:1400,fadein:1200,shake:560};
const SYMBOL_MS=1800,HEADING_MS=2400,WIPE_MS=450,BGS=['sea','chart','black','inlet','valley'],TAG_COLORS={夜:'#3b4aa0',翌朝:'#d08a2c',接敵:'#b01a38',幕間:'#2f7d6e'},FORM_NAMES=['乙女','若人（わこうど）'],FORMS=['female','male'];
// 立ち絵の中心（画面幅の%）。1人のときは中央やや右寄り、2人のときは左右（前列）、3人目は中央の奥（後列）。説明モードの集合絵は最大4人を横に並べて少し重ねる。
const X_ONE=58,X_LEFT=30,X_RIGHT=72,X_BACK=51,X_GAP=22,AIR_N={sea:30,harbor:26,rumble:34},SYM_SFX={sad:'dots',weary:'dots'};

// opts: {root:#talk, stage:.stage, audio, shake(), onTap(), hero:{name(), form(), setName(v), setForm(v)}}（姫の名前・姿は config.mjs に保存される）
export function createTalk(opts){
 const {root,stage,audio,hero}=opts,$=s=>root.querySelector(s);
 const el={heading:$('#talkHeading'),hTag:$('#talkHTag'),hTitle:$('#talkHTitle'),wipe:$('#talkWipe'),sub:$('#talkSubText'),subNext:$('#talkSubNext'),hSub:$('#talkHSub'),face:$('#talkFace'),faceImg:$('#talkFace img'),fade:$('#talkFade'),flash:$('#talkFlash'),stageBox:$('#talkFigures'),box:$('#talkBox'),name:$('#talkName'),text:$('#talkText'),next:$('#talkNext'),log:$('#talkLogView'),logList:$('#talkLogList'),choice:$('#talkChoice'),choiceTitle:$('#talkChoiceTitle'),choiceList:$('#talkChoiceList'),nameModal:$('#talkNameModal'),nameForm:$('#talkNameForm'),nameInput:$('#talkNameInput')};
 const airLayer=document.createElement('div');airLayer.className='talk-air';el.stageBox.after(airLayer); // @空気 の粒子は立ち絵より前、台詞枠より後ろ
 const fxLayer=document.createElement('div');fxLayer.className='talk-fxlayer';root.appendChild(fxLayer); // 感情の記号は立ち絵・台詞枠より前のこの層に出す
 const slots=[...el.stageBox.querySelectorAll('.talk-slot')];
 const s={tick:0,active:false,bg:'black',cmds:[],i:0,done:null,wait:null,typing:null,full:'',shown:0,blocked:null,busyUntil:0,log:[],ghost:false,pick:null,brief:null};

 const setBg=v=>{s.bg=v;for(const k of BGS)stage.classList.toggle('talk-'+k,v===k)};
 const restart=(node,cls)=>{node.classList.remove(cls);void node.offsetWidth;node.classList.add(cls)};
 // 姫の名前・立ち絵。{姫} は再生時にここで置き換える。
 const heroName=()=>hero.name()||'姫',heroArt=()=>`./art/talk-hero-${hero.form()==='male'?'male':'female'}.png`,sub=t=>String(t).replaceAll('{姫}',heroName());
 const artOf=who=>who.key==='hero'?heroArt():who.art;
 // 幻影の姿のあいだ、姫の立ち絵に .ghost を付ける（半透明・淡い青白・ゆっくり上下に揺れる）。
 const applyGhost=()=>{for(const sl of slots)sl.classList.toggle('ghost',sl.dataset.who==='hero'&&s.ghost)};
 const slotOf=key=>slots.find(x=>x.dataset.who===key),stand=()=>slots.filter(x=>x.dataset.who),place=(sl,x,row='front')=>{sl.style.setProperty('--x',x+'%');sl.dataset.row=row};

 // 立つのは最大3人。1人は中央やや右、2人は左右（新しく登場した人の希望の側。中は空いている側）、3人目は中央の奥（data-row=back）。奥の人が話すと、前の最も長く話していない人と溶けて入れ替わる。
 // 4人目が来たら、最も長く話していない人を退場させ、その場所に入れ替わる。説明モード中は集合絵（最大4人、横に並べる）になる。
 const xOf=sl=>parseFloat(sl.style.getPropertyValue('--x')),oldest=l=>l.reduce((a,b)=>+a.dataset.spoke<=+b.dataset.spoke?a:b);
 function seat(who,pos,x,row,spoke){
  const sl=slots.find(z=>!z.dataset.who&&!z.classList.contains('out'))||slots.find(z=>!z.dataset.who),img=sl.firstElementChild.firstElementChild;
  sl.dataset.who=who.key;sl._who=who;sl.dataset.pref=pos;sl.dataset.spoke=spoke??++s.tick;sl.dataset.ord=++s.tick;img.src=artOf(who);img.alt='';
  sl.classList.remove('shown','out','speaking','melt','jump');sl.classList.add('pre');place(sl,x,row||'front');void sl.offsetWidth;sl.classList.remove('pre');sl.classList.add('shown');applyGhost();return sl}
 function enter(who,pos){
  const cur=slotOf(who.key);
  if(cur){cur.dataset.pref=pos;cur.dataset.spoke=++s.tick;return}
  if(s.brief){if(stand().length>=4)leave(oldest(stand()));seat(who,pos,50+stand().length/2*X_GAP);groupLayout();return}
  let st=stand();
  if(st.length>=3){const old=oldest(st),x=xOf(old),row=old.dataset.row;leave(old);seat(who,pos,x,row);return}
  if(!st.length)seat(who,pos,X_ONE);
  else if(st.length===1){const o=st[0],left=pos==='left'||(pos==='center'&&o.dataset.pref==='right');place(o,left?X_RIGHT:X_LEFT);seat(who,pos,left?X_LEFT:X_RIGHT)}
  else seat(who,pos,X_BACK,'back')}
 // 集合絵：登場順に左から並べ、中央に寄せる。
 function groupLayout(){const st=stand().sort((a,b)=>a.dataset.ord-b.dataset.ord);st.forEach((sl,i)=>place(sl,50+(i-(st.length-1)/2)*X_GAP))}
 function leave(sl){
  if(!sl.dataset.who)return;sl.dataset.who='';sl.classList.remove('speaking','melt');sl.classList.add('out');
  setTimeout(()=>{if(!sl.dataset.who)sl.classList.remove('shown','out')},600)}
 function exit(sl){
  const x=xOf(sl),row=sl.dataset.row;leave(sl);const st=stand();
  if(s.brief)groupLayout();else if(st.length===1)place(st[0],X_ONE);else if(row==='front'){const b=st.find(z=>z.dataset.row==='back');if(b)place(b,x)}}
 // 奥の人と前の人が、その場で溶けるように位置を入れ替える（両方が一度透明になり、見えない間に動く）。
 function swap(a,b){
  const xa=xOf(a),xb=xOf(b);a.classList.add('melt');b.classList.add('melt');
  setTimeout(()=>{
   if(a.dataset.who&&b.dataset.who){a.classList.add('jump');b.classList.add('jump');place(a,xb);place(b,xa,'back');void a.offsetWidth}
   a.classList.remove('melt','jump');b.classList.remove('melt','jump')},240)}
 function clearStage(){for(const sl of slots){sl.dataset.who='';sl.className='talk-slot';sl.removeAttribute('data-emo');sl.removeAttribute('data-pref')}fxLayer.textContent='';air(null);endHeading();endWipe();s.brief=null;root.classList.remove('brief');el.face.hidden=true;el.box.classList.remove('face')}

 // 話者を前に出す。感情の色味は data-emo、動きは img の animation。
 function speak(c){fxLayer.textContent='';
  for(const sl of slots){sl.classList.remove('speaking');sl.removeAttribute('data-emo')}
  const sl=c.who.key&&slotOf(c.who.key);if(!sl)return;
  const fr=stand().filter(z=>z.dataset.row==='front'),melt=sl.dataset.row==='back'&&!s.brief&&fr.length>0;
  if(melt)swap(sl,oldest(fr));
  sl.classList.add('speaking');sl.dataset.spoke=++s.tick;if(c.emotion)sl.dataset.emo=EMOTIONS[c.emotion];
  const img=sl.firstElementChild.firstElementChild,go=()=>{if(sl.dataset.who!==c.who.key)return;for(const m of Object.values(MOTIONS))img.classList.remove('m-'+m);
   if(c.motion){void img.offsetWidth;img.classList.add('m-'+MOTIONS[c.motion]);audio.sfx('m-'+MOTIONS[c.motion])}
   if(c.symbol)symbol(sl,c.symbol)};
  if(melt)setTimeout(go,300);else go()}
 // 話者の頭の横に、白い吹き出し（しっぽ付き）で記号を出す（前面の層に置く。ポンと弾んで、1.8秒ほどで消える）。
 // 哀しみ・呆れは3つの点が順に光り、焦りは汗のしずく、怒りは怒りマーク。画面の右に寄りすぎるときは頭の左に出す。
 function symbol(sl,sym){
  audio.sfx('sym-'+(SYM_SFX[sym.kind]||sym.kind));
  const img=sl.firstElementChild.firstElementChild;if(img.complete&&img.naturalWidth)bubble(sl,img,sym);else img.addEventListener('load',()=>{if(sl.dataset.who)bubble(sl,img,sym)},{once:true})}
 // 位置は、移動中・拡大中の立ち絵の見かけではなく、置き先（--x）と絵の縦横比から決める。
 function bubble(sl,img,sym){
  const e=document.createElement('span'),r=root.getBoundingClientRect(),f=img.getBoundingClientRect(),w=f.height*img.naturalWidth/img.naturalHeight,cx=r.width*parseFloat(sl.style.getPropertyValue('--x'))/100,left=cx-w/2;
  e.className='talk-sym sym-'+sym.kind;e.setAttribute('aria-hidden','true');
  if(sym.kind==='sad'||sym.kind==='weary')e.innerHTML='<i></i><i></i><i></i>';else if(sym.kind==='sweat')e.innerHTML='<i class="drop"></i><i class="drop sm"></i>';else if(sym.kind==='anger')e.innerHTML='<i class="vein"></i>';else e.textContent=sym.text;
  const flip=left+w*.78>r.width-190;
  e.classList.toggle('flip',flip);e.style.left=((flip?left+w*.22:left+w*.78))+'px';e.style.top=(f.top+f.height*.1-r.top)+'px';fxLayer.textContent='';fxLayer.appendChild(e);setTimeout(()=>e.remove(),SYMBOL_MS)}
 // 顔アイコン：話者が画面にいないとき、立ち絵の顔を切り出して台詞枠の左に出す。face=[顔の中心のx%,y%,拡大]。
 function faceFit(){const f=el.faceImg._f,im=el.faceImg;if(!f)return;const a=im.naturalWidth?im.naturalHeight/im.naturalWidth:1.5;im.style.cssText=`width:${f[2]*100}%;left:${50-f[0]*f[2]}%;top:${50-f[1]*f[2]*a}%`}
 el.faceImg.onload=faceFit;
 function showFace(who){
  const on=!s.brief&&!!(who.key&&who.art&&!slotOf(who.key));el.box.classList.toggle('face',on);el.face.hidden=!on;if(!on)return;
  const isHero=who.key==='hero';el.face.style.setProperty('--c',who.color||'#6d6a78');el.face.classList.toggle('ghost',isHero&&s.ghost);
  el.faceImg._f=isHero?HERO_FACES[hero.form()==='male'?'male':'female']:who.face||DEFAULT_FACE;const src=artOf(who);
  if(!el.faceImg.src.endsWith(src.slice(1)))el.faceImg.src=src;faceFit()}
 // 場面の空気：@空気 で、会話中ずっと続く粒子と環境音（音は audio.air）。sea=飛沫が横切る、harbor=灯の粒が昇る、rumble=滴が落ちて時々揺れる。減らす動きの設定では粒を少なく、揺れなし。
 function air(name){
  clearTimeout(s.quake);airLayer.textContent='';airLayer.className='talk-air';audio.air?.(name);if(!name)return;
  const calm=matchMedia('(prefers-reduced-motion:reduce)').matches,n=Math.ceil(AIR_N[name]/(calm?3:1)),R=(a,b)=>a+Math.random()*(b-a);airLayer.classList.add('air-'+name);
  for(let i=0;i<n;i++){const e=document.createElement('i'),d=name==='rumble'?R(1.3,2.8):name==='harbor'?R(5,9):R(8,16),big=name==='sea'?R(2,5):name==='harbor'?R(3,7):R(1.5,2.6);
   e.style.cssText=`--x:${R(0,100)}%;--y:${name==='sea'?R(8,90):name==='harbor'?R(55,100):0}%;--s:${big}px;--w:${name==='sea'?big*R(1,4):name==='rumble'?big:big}px;--h:${name==='rumble'?R(10,24):big}px;--d:${d}s;--dl:-${R(0,d)}s;--o:${R(.4,.9)};--dx:${R(-4,4)}vw;--dy:${R(-4,4)}vh`;
   if(name==='rumble'&&Math.random()<.22)e.className='blood';airLayer.appendChild(e)}
  if(name==='rumble'&&!calm){const q=()=>{restart(el.stageBox,'quake');audio.sfx('rumble');s.quake=setTimeout(q,R(5000,9000))};s.quake=setTimeout(q,R(2500,5000))}}
 // 場面の見出しカード：背景の上に、左から斜めに切った暗いパネル（金の縁）が滑り込み、札・見出し・副題を出して、約2.4秒で引っ込む。
 function heading(c){
  el.hTitle.textContent=sub(c.title);el.hSub.textContent=c.sub?sub(c.sub):'';el.hSub.hidden=!c.sub;el.hTag.textContent=c.tag||'';el.hTag.hidden=!c.tag;el.hTag.style.setProperty('--tc',TAG_COLORS[c.tag]||'#9e1530');
  root.classList.add('heading');el.heading.hidden=false;restart(el.heading,'on');
  s.blocked='wait';s.wait=setTimeout(()=>{s.wait=null;run()},HEADING_MS)}
 // 場面転換 @転換：立ち絵を下げ、斜めの縞（深紅と象牙）が0.45秒で画面を覆う→背景を替える→0.45秒で抜ける。見出しがあれば続けて見出しカード。
 function trans(c){
  s.blocked='trans';el.box.classList.add('idle');el.face.hidden=true;el.box.classList.remove('face');for(const sl of stand())leave(sl);
  audio.sfx('wipe');el.wipe.hidden=false;el.wipe.dataset.p='';void el.wipe.offsetWidth;el.wipe.dataset.p='cover';
  s.wait=setTimeout(()=>{setBg(c.bg);el.wipe.dataset.p='uncover';s.wait=setTimeout(()=>{s.wait=null;endWipe();if(c.title)heading(c);else run()},WIPE_MS+60)},WIPE_MS)}
 const endWipe=()=>{el.wipe.hidden=true;el.wipe.dataset.p=''};
 // 説明モード：上下に黒帯が入り、台詞は下の帯に字幕で出る。モード前の立ち絵と背景は、終了時に戻す。モード中の @登場 は集合絵。
 function briefOn(){
  if(s.brief)return false;const sv=stand().map(sl=>({who:sl._who,pos:sl.dataset.pref,x:xOf(sl),row:sl.dataset.row,spoke:+sl.dataset.spoke}));
  s.brief={bg:s.bg,sv};fxLayer.textContent='';for(const sl of stand())leave(sl);root.classList.add('brief');el.sub.textContent='';el.subNext.hidden=true;el.face.hidden=true;el.box.classList.remove('face');
  s.blocked='trans';s.wait=setTimeout(()=>{s.wait=null;run()},550);return true}
 function briefOff(){
  if(!s.brief)return false;const {bg,sv}=s.brief;fxLayer.textContent='';for(const sl of stand())leave(sl);root.classList.remove('brief');el.box.classList.add('idle');
  s.blocked='trans';s.wait=setTimeout(()=>{s.wait=null;s.brief=null;setBg(bg);for(const o of sv)seat(o.who,o.pos,o.x,o.row,o.spoke);run()},650);return true}
 function endHeading(){if(el.heading.hidden)return;el.heading.hidden=true;el.heading.classList.remove('on');root.classList.remove('heading')}

 function type(text){
  const tx=s.brief?el.sub:el.text,nx=s.brief?el.subNext:el.next;
  clearInterval(s.typing);s.full=text;s.shown=0;tx.textContent='';nx.hidden=true;
  s.typing=setInterval(()=>{s.shown++;tx.textContent=s.full.slice(0,s.shown);if(s.shown>=s.full.length)endTyping()},TYPE_MS)}
 function endTyping(){clearInterval(s.typing);s.typing=null;s.shown=s.full.length;(s.brief?el.sub:el.text).textContent=s.full;(s.brief?el.subNext:el.next).hidden=false}

 function line(c){
  const narr=c.type==='narr';
  el.box.classList.remove('idle');el.box.classList.toggle('mind',!!c.mind);el.box.classList.toggle('narr',narr||!c.who.name);
  el.name.hidden=narr;if(!narr){el.name.textContent=c.who.key==='hero'?heroName():c.who.name;el.name.style.setProperty('--c',c.who.color||'#6d6a78')}
  if(narr)speak({who:{key:null}});else speak(c);showFace(narr?{}:c.who);
  const text=sub(c.text);
  s.log.push({name:narr?'':c.who.key==='hero'?heroName():c.who.name,text,mind:!!c.mind,narr});
  s.blocked='line';type(s.brief&&!narr&&c.who.name&&!c.mind?`${c.who.key==='hero'?heroName():c.who.name}：${text}`:text)}

 function fx(name){
  s.busyUntil=Math.max(s.busyUntil,performance.now()+FX_MS[name]);
  if(name==='flash')restart(el.flash,'on');
  else if(name==='fadeout'){el.fade.style.transitionDuration='1.4s';el.fade.classList.add('on')}
  else if(name==='fadein'){el.fade.style.transitionDuration='1.2s';el.fade.classList.remove('on')}
  else if(name==='shake'){restart(el.stageBox,'shake');restart(el.box,'shake');opts.shake?.()}}

 // 次の命令へ。台詞と @間 で止まり、それ以外は続けて実行する。
 function run(){
  s.blocked=null;endHeading();
  while(s.i<s.cmds.length){
   const c=s.cmds[s.i++];
   switch(c.type){
    case 'say':case 'narr':line(c);return;
    case 'wait':s.blocked='wait';s.wait=setTimeout(()=>{s.wait=null;run()},c.sec*1000);return;
    case 'bg':setBg(c.value);break;
    case 'enter':enter(c.who,c.pos);break;
    case 'exit':{const sl=slotOf(c.who.key);if(sl)exit(sl);break}
    case 'heading':heading(c);return;
    case 'trans':trans(c);return;
    case 'brief':if(c.on?briefOn():briefOff())return;break;
    case 'fx':fx(c.name);break;
    case 'sfx':audio.sfx(c.name);break;
    case 'form':s.ghost=c.value==='ghost';applyGhost();break;
    case 'air':air(c.name);break;
    case 'nameinput':askName();return;
    case 'choice':choose(c.options.map(sub),{},i=>{s.log.push({name:'選択',text:'▶ '+sub(c.options[i]),pick:true});s.cmds=[...s.cmds.slice(0,s.i),...c.branches[i],...s.cmds.slice(s.i)];run()});return;
    case 'warn':console.warn(`台本 ${c.line}行目：${c.text}`);break}}
  s.blocked='end';const left=s.busyUntil-performance.now();s.wait=setTimeout(()=>{s.wait=null;finish()},Math.max(0,left)+150)}

 function advance(){
  if(!s.active||!el.log.hidden)return;
  if(s.blocked==='line'){if(s.typing)endTyping();else run()}
  else if(s.blocked==='wait'){clearTimeout(s.wait);s.wait=null;run()}}

 function finish(){
  if(!s.active)return;clearInterval(s.typing);clearTimeout(s.wait);s.typing=s.wait=null;s.active=false;
  root.hidden=true;el.log.hidden=true;closePrompts();root.classList.remove('forming');stage.classList.remove('talk-on',...BGS.map(k=>'talk-'+k));clearStage();
  const d=s.done;s.done=null;d?.()}

 // 台本を読み込む間も黒い画面を出しておく。
 function begin(){
  clearTimeout(s.wait);clearInterval(s.typing);clearStage();closePrompts();s.ghost=false;s.log=[];s.cmds=[];s.i=0;s.busyUntil=0;s.blocked='load';s.active=true;
  el.fade.style.transition='none';el.fade.classList.add('on');el.flash.classList.remove('on');el.box.classList.add('narr','idle');el.name.hidden=true;el.text.textContent='';el.next.hidden=true;el.log.hidden=true;
  root.hidden=false;stage.classList.add('talk-on');setBg('black')}
 function play(cmds,done){
  if(!s.active)begin();s.cmds=cmds;s.i=0;s.done=done;
  el.fade.style.transition='';el.fade.style.transitionDuration='.9s';void el.fade.offsetWidth;el.fade.classList.remove('on');run()}
 // 選択肢と名前入力の画面を閉じる。
 const closePrompts=()=>{s.pick=null;el.choice.hidden=true;el.nameModal.hidden=true;el.nameInput.blur()};
 // 選択肢を画面中央に縦に並べる。クリック・数字キー・上下キー＋Enter で選ぶ。opts: {title,initial,imgs}
 function choose(options,o,cb){
  s.blocked='choice';s.pick={n:options.length,sel:o.initial||0,cb};
  el.choiceTitle.hidden=!o.title;el.choiceTitle.textContent=o.title||'';
  el.choiceList.innerHTML=options.map((t,i)=>`<button type="button" data-i="${i}"><i>${i+1}</i>${o.imgs?`<img src="${o.imgs[i]}" alt="">`:''}<span>${esc(t)}</span></button>`).join('');
  el.choiceList.classList.toggle('with-imgs',!!o.imgs);markPick();el.choice.hidden=false}
 function markPick(){[...el.choiceList.children].forEach((b,i)=>b.classList.toggle('sel',i===s.pick.sel))}
 function pickAt(i){const p=s.pick;if(!p||i<0||i>=p.n)return;s.pick=null;el.choice.hidden=true;audio.sfx('ui');p.cb(i)}
 el.choiceList.onclick=ev=>{const b=ev.target.closest('button');if(b)pickAt(+b.dataset.i)};
 el.choiceList.onmouseover=ev=>{const b=ev.target.closest('button');if(b&&s.pick){s.pick.sel=+b.dataset.i;markPick()}};
 // 姫の名前の入力（最大8文字、空なら既定名）。
 function askName(){s.blocked='name';el.nameInput.value='';el.nameModal.hidden=false;el.nameInput.focus()}
 el.nameInput.addEventListener('keydown',ev=>ev.stopPropagation());
 el.nameForm.onsubmit=ev=>{ev.preventDefault();if(s.blocked!=='name')return;const v=[...el.nameInput.value.trim()].slice(0,8).join('')||DEFAULT_HERO_NAME;hero.setName(v);el.nameModal.hidden=true;el.nameInput.blur();s.log.push({name:'',text:`姫の名前：${v}`,narr:true});run()};
 // ゲームの最初に、姫の姿を選ぶ画面。前回の選択を初期値に出す。
 function pickForm(cb){
  begin();el.fade.classList.remove('on');root.classList.add('forming');
  choose(FORM_NAMES,{title:'姫の姿を選んでください',initial:Math.max(0,FORMS.indexOf(hero.form())),imgs:FORMS.map(f=>`./art/talk-hero-${f}.png`)},i=>{hero.setForm(FORMS[i]);root.classList.remove('forming');cb?.(FORMS[i])})}
 // 台本が読めなかったとき。
 const abort=()=>finish();

 function openLog(){
  el.logList.innerHTML=s.log.map(l=>`<p class="${l.narr?'narr':''}${l.mind?' mind':''}${l.pick?' pick':''}">${l.name?`<b>${esc(l.name)}</b>`:''}<span>${esc(l.text)}</span></p>`).join('')||'<p class="narr"><span>まだ台詞はありません。</span></p>';
  el.log.hidden=false;el.logList.scrollTop=el.logList.scrollHeight;$('#talkLogClose').focus()}
 const esc=t=>String(t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
 $('#talkLog').onclick=openLog;$('#talkLogClose').onclick=()=>{el.log.hidden=true};
 $('#talkSkip').onclick=()=>{if(!s.active||s.blocked==='load'||root.classList.contains('forming'))return;if(!hero.name())hero.setName(DEFAULT_HERO_NAME);finish()};
 root.addEventListener('click',ev=>{if(ev.target.closest('button,.talk-logview'))return;opts.onTap?.();advance()});
 // Space／Enter は会話が受け取る（戦略マップの進行などに渡さない）。ログの表示中は Esc で閉じる。
 document.addEventListener('keydown',ev=>{
  if(!s.active)return;
  if(s.blocked==='name'){if(ev.target!==el.nameInput){ev.preventDefault();ev.stopImmediatePropagation();el.nameInput.focus()}return}
  if(s.blocked==='choice'&&s.pick){
   const k=ev.key,sw=ev.code==='Space'||k==='Enter'||k==='ArrowUp'||k==='ArrowDown'||/^[1-9]$/.test(k);if(!sw)return;
   ev.preventDefault();ev.stopImmediatePropagation();if(ev.repeat)return;
   if(/^[1-9]$/.test(k))pickAt(+k-1);else if(k==='Enter')pickAt(s.pick.sel);else if(k==='ArrowUp'||k==='ArrowDown'){s.pick.sel=(s.pick.sel+(k==='ArrowDown'?1:s.pick.n-1))%s.pick.n;markPick()}
   return}
  if(ev.key==='Escape'&&!el.log.hidden){ev.preventDefault();ev.stopImmediatePropagation();el.log.hidden=true;return}
  if(ev.code==='Space'||ev.key==='Enter'){if(ev.target.tagName==='BUTTON'&&ev.key==='Enter')return;ev.preventDefault();ev.stopImmediatePropagation();if(!ev.repeat)advance()}},true);

 return {begin,play,abort,advance,pickForm,get active(){return s.active},get bg(){return s.bg}}}
