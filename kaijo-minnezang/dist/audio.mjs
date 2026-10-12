// 音：Web Audio API だけで効果音・環境音・仮の音楽を合成する（音声ファイルなし）。AudioContext は unlock()（ユーザー操作）で初めて作る。
// 音楽は ctx.currentTime 基準で少し先まで予約する先読み方式。Web Audio が無い環境では全メソッドが何もしない。
const hz=m=>440*2**((m-69)/12);
// 曲定義：beats=ループ長（拍）、bpm、at(拍番号, 開始時刻, 1拍の秒数, 出力) がその拍のノートを予約する。
const CH={ // 和音（ミディ番号）
 Dm:[50,53,57],Bb:[46,50,53],F:[53,57,60],Gm:[43,46,50],A:[45,49,52],Am:[57,60,64],Fw:[57,60,65],Dmw:[57,62,65],E:[56,59,64],C:[48,52,55],G:[55,59,62]};
const MARCH={bpm:104,beats:32,root:[38,38,34,41,43,38,45,38],pad:['Dm','Dm','Bb','F','Gm','Dm','A','Dm'],
 mel:[[69,0,65,69],[74,72,69,0],[70,0,67,70],[72,69,65,0],[67,70,74,70],[69,65,62,65],[64,67,69,73],[74,74,74,0]]};
const WALTZ={bpm:144,beats:24,root:[45,41,38,40,45,41,40,45],ch:[CH.Am,CH.Fw,CH.Dmw,CH.E,CH.Am,CH.Fw,CH.E,CH.Am],
 mel:[[[0,76,2],[2,74,1]],[[0,72,2],[2,69,1]],[[0,74,2],[2,77,1]],[[0,76,1.5],[1.5,71,.5],[2,68,1]],[[0,76,2],[2,81,1]],[[0,79,2],[2,77,1]],[[0,76,1],[1,71,1],[2,68,1]],[[0,69,3]]]};
const DRAMA={bpm:66,beats:32,ch:['Am','Fw','C','G','Am','Dmw','E','Am'].map(k=>CH[k]),arp:[0,1,2,1,2,1,0,1]};
const SONGS={
 march:{bpm:MARCH.bpm,beats:MARCH.beats,at(i,t,s,o,A){const bar=i>>2|0,n=i%4,r=MARCH.root[bar%8];
  if(n===0)for(const m of CH[MARCH.pad[bar%8]])A.tone('sawtooth',hz(m+12),t,s*3.8,.05,{o,attack:.12,lp:900});
  A.tone('triangle',hz(n%2?r+7:r),t,s*.8,.2,{o,attack:.02,lp:500});
  if(n%2===0)A.tone('sine',90,t,.18,.35,{o,sweep:45});else A.noise(t,.12,.08,{o,type:'bandpass',freq:1800,q:.8});
  const m=MARCH.mel[bar%8][n];if(m)A.tone('sawtooth',hz(m),t,s*.9,.11,{o,attack:.07,lp:1500,detune:6});}},
 waltz:{bpm:WALTZ.bpm,beats:WALTZ.beats,at:(i,t,s,o,A)=>waltz(i,t,s,o,A,0)},
 waltz2:{bpm:WALTZ.bpm*1.15,beats:WALTZ.beats,at:(i,t,s,o,A)=>waltz(i,t,s,o,A,2)},
 drama:{bpm:DRAMA.bpm,beats:DRAMA.beats,at(i,t,s,o,A){const bar=i>>2|0,ch=DRAMA.ch[bar%8];
  if(i%4===0)for(const m of ch)A.tone('sawtooth',hz(m),t,s*4,.04,{o,attack:.9,lp:700,detune:7});
  for(let h=0;h<2;h++){const m=ch[DRAMA.arp[(i%4)*2+h]%3]+12*(((i%4)*2+h)>3?1:0)+12;A.tone('square',hz(m),t+h*s/2,s*.9,.07,{o,attack:.004,lp:2600,decay:true});}
  if(i%4===0)A.tone('triangle',hz(ch[0]-12),t,s*1.6,.12,{o,attack:.02,lp:500});}}};
function waltz(i,t,s,o,A,up){const bar=i/3|0,n=i%3,r=WALTZ.root[bar%8]+up;
 if(n===0)A.tone('triangle',hz(r),t,s*2.6,.26,{o,attack:.03,lp:600});
 else for(const m of WALTZ.ch[bar%8])A.tone('sawtooth',hz(m+up),t,s*.95,.06,{o,attack:.1,lp:1100,detune:8});
 for(const [b,m,len] of WALTZ.mel[bar%8])if(b>=n&&b<n+1){for(const d of [-7,7])A.tone('sawtooth',hz(m+up),t+(b-n)*s,s*len,.055,{o,attack:.18,lp:1800,detune:d});}}
export function createAudio(){
 const AC=typeof window!=='undefined'&&(window.AudioContext||window.webkitAudioContext);
 if(!AC)return {unlock(){},setEnabled(){},setVolume(){},sfx(){},music(){},duck(){},suspend(){}};
 let ctx=null,master,bus={},noiseBuf,enabled=true,volume=.7,ducked=false,want=null,cur=null,timer=0,last={};
 const out=()=>ctx&&enabled;
 function tone(type,f,t,dur,vol,p={}){const o=ctx.createOscillator(),g=ctx.createGain();let n=o;o.type=type;o.frequency.setValueAtTime(f,t);if(p.sweep)o.frequency.exponentialRampToValueAtTime(p.sweep,t+dur);if(p.detune)o.detune.value=p.detune;
  if(p.lp){const l=ctx.createBiquadFilter();l.type='lowpass';l.frequency.value=p.lp;o.connect(l);n=l}
  n.connect(g);g.connect(p.o||bus.sfx);const a=p.attack||.005;g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(vol,t+a);
  if(p.decay)g.gain.exponentialRampToValueAtTime(.0001,t+dur);else{g.gain.setValueAtTime(vol,Math.max(t+a,t+dur*.7));g.gain.exponentialRampToValueAtTime(.0001,t+dur+.15)}
  o.start(t);o.stop(t+dur+.2)}
 function noise(t,dur,vol,p={}){const s=ctx.createBufferSource(),f=ctx.createBiquadFilter(),g=ctx.createGain();s.buffer=noiseBuf;f.type=p.type||'lowpass';f.frequency.setValueAtTime(p.freq||800,t);if(p.sweep)f.frequency.exponentialRampToValueAtTime(p.sweep,t+dur);f.Q.value=p.q||1;
  s.connect(f);f.connect(g);g.connect(p.o||bus.sfx);g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(vol,t+(p.attack||.005));g.gain.exponentialRampToValueAtTime(.0001,t+dur);s.start(t,Math.random()*1.5);s.stop(t+dur+.05)}
 const A={tone,noise};
 function ambient(){ // 海のうねりと風：フィルタしたノイズを低周波で揺らす
  for(const [type,freq,q,gain,rate] of [['lowpass',420,.7,.5,.09],['bandpass',900,.9,.18,.05]]){const s=ctx.createBufferSource(),f=ctx.createBiquadFilter(),g=ctx.createGain(),l=ctx.createOscillator(),d=ctx.createGain();s.buffer=noiseBuf;s.loop=true;f.type=type;f.frequency.value=freq;f.Q.value=q;g.gain.value=gain*.6;
   l.frequency.value=rate;d.gain.value=gain*.4;l.connect(d);d.connect(g.gain);s.connect(f);f.connect(g);g.connect(bus.env);s.start();l.start()}}
 function apply(){if(!ctx)return;const t=ctx.currentTime;master.gain.setTargetAtTime(enabled?volume*.8:0,t,.08);bus.music.gain.setTargetAtTime(ducked?.12:.45,t,.25)}
 function startMusic(){ // 現在の曲を止めて、新しい曲を短いクロスフェードで始める
  const t=ctx.currentTime;if(cur){cur.g.gain.cancelScheduledValues(t);cur.g.gain.setValueAtTime(cur.g.gain.value,t);cur.g.gain.linearRampToValueAtTime(0,t+.8);const old=cur.g;setTimeout(()=>old.disconnect(),1200);cur=null}
  if(!want)return;const g=ctx.createGain();g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(1,t+.8);g.connect(bus.music);cur={name:want,song:SONGS[want],g,i:0,next:t+.05}}
 function tick(){if(!ctx||!cur||!enabled||ctx.state!=='running')return;const now=ctx.currentTime,s=60/cur.song.bpm;if(cur.next<now)cur.next=now+.05;
  while(cur.next<now+.6){cur.song.at(cur.i%cur.song.beats,cur.next,s,cur.g,A);cur.next+=s;cur.i++}}
 const gate=(k,gap)=>{const n=ctx.currentTime;if(last[k]&&n-last[k]<gap)return false;last[k]=n;return true};
 const SFX={
  bell(t){[1,2.76,5.4,8.93].forEach((m,i)=>tone('sine',523*m,t,2.8/(i+1),.22/(i+1),{decay:true}))},
  stake(t){tone('sine',110,t,.4,.5,{sweep:38,decay:true});noise(t,.7,.3,{freq:2400,sweep:500,type:'bandpass',q:.6});tone('sawtooth',260,t+.05,.35,.05,{sweep:140,lp:1800,decay:true});noise(t+.05,.3,.08,{type:'highpass',freq:5000})},
  cross(t){noise(t,.4,.22,{type:'bandpass',freq:400,sweep:3200,q:1.2,attack:.2});tone('sine',80,t+.32,.35,.55,{sweep:32,decay:true});noise(t+.32,.25,.25,{freq:500})},
  hit(t){if(!gate('hit',.08))return;tone('sine',130,t,.16,.4,{sweep:50,decay:true});noise(t,.09,.18,{freq:600})},
  heart(t){tone('sine',62,t,.2,.5,{sweep:40,decay:true});tone('sine',55,t+.23,.22,.35,{sweep:36,decay:true})},
  cutin(t){[1800,2700,4200].forEach((f,i)=>tone('triangle',f,t+i*.04,.5,.07,{decay:true}));noise(t,.18,.1,{type:'highpass',freq:3000,sweep:9000})},
  ui(t){tone('sine',900,t,.05,.05,{sweep:600,decay:true})},
  // 会話の動きに添えるコミカルな短い音（台詞のじゃまにならない音量）
  'm-hop'(t){tone('sine',380,t,.16,.07,{sweep:1000,decay:true});tone('sine',620,t+.17,.08,.04,{sweep:420,decay:true})},
  'm-sway'(t){const o=ctx.createOscillator(),l=ctx.createOscillator(),d=ctx.createGain(),g=ctx.createGain();o.type='sine';o.frequency.setValueAtTime(520,t);o.frequency.exponentialRampToValueAtTime(380,t+.35);l.frequency.value=14;d.gain.value=40;l.connect(d);d.connect(o.frequency);o.connect(g);g.connect(bus.sfx);g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(.06,t+.04);g.gain.exponentialRampToValueAtTime(.0001,t+.35);o.start(t);l.start(t);o.stop(t+.4);l.stop(t+.4)},
  'm-recoil'(t){noise(t,.14,.08,{type:'bandpass',freq:2600,sweep:700,q:.8});tone('triangle',420,t,.22,.06,{sweep:150,decay:true})},
  'm-lunge'(t){noise(t,.2,.09,{type:'bandpass',freq:500,sweep:4200,q:1.4,attack:.1})},
  'm-tremble'(t){const o=ctx.createOscillator(),l=ctx.createOscillator(),d=ctx.createGain(),g=ctx.createGain();o.type='triangle';o.frequency.value=680;l.frequency.value=26;d.gain.value=.04;l.connect(d);d.connect(g.gain);o.connect(g);g.connect(bus.sfx);g.gain.setValueAtTime(.05,t);g.gain.exponentialRampToValueAtTime(.0001,t+.34);o.start(t);l.start(t);o.stop(t+.36);l.stop(t+.36)},
  'm-nod'(t){tone('sine',1040,t,.1,.07,{sweep:700,decay:true});tone('sine',2080,t,.05,.025,{decay:true})}};
 return {
  unlock(){if(ctx){if(ctx.state==='suspended'&&!document.hidden)ctx.resume();return}try{ctx=new AC();master=ctx.createGain();master.connect(ctx.destination);for(const k of ['music','sfx','env']){bus[k]=ctx.createGain();bus[k].connect(master)}bus.env.gain.value=.3;bus.sfx.gain.value=.8;
   noiseBuf=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate);const d=noiseBuf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
   master.gain.value=0;ambient();apply();if(ctx.state==='suspended')ctx.resume();startMusic();timer=setInterval(tick,120)}catch{ctx=null}},
  setEnabled(v){enabled=!!v;apply()},
  setVolume(v){volume=Math.min(1,Math.max(0,+v||0));apply()},
  sfx(name){if(!out()||!SFX[name])return;try{SFX[name](ctx.currentTime+.01)}catch{}},
  music(name){name=name&&SONGS[name]?name:null;if(name===want)return;want=name;if(ctx)startMusic()},
  duck(v){ducked=!!v;apply()},
  suspend(v){if(!ctx)return;if(v)ctx.suspend();else ctx.resume()}}}
