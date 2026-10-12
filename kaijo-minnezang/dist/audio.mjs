// 音：Web Audio API だけで効果音・環境音・仮の音楽を合成する（音声ファイルなし）。AudioContext は unlock()（ユーザー操作）で初めて作る。
// 音楽は ctx.currentTime 基準で少し先まで予約する先読み方式。Web Audio が無い環境では全メソッドが何もしない。
const hz=m=>440*2**((m-69)/12);
// 曲定義：beats=ループ長（拍）、bpm、at(拍番号, 開始時刻, 1拍の秒数, 出力) がその拍のノートを予約する。
const CH={ // 和音（ミディ番号）
 Dm:[50,53,57],Bb:[46,50,53],F:[53,57,60],Gm:[43,46,50],A:[45,49,52],Am:[57,60,64],Fw:[57,60,65],Dmw:[57,62,65],E:[56,59,64],C:[48,52,55],G:[55,59,62]};
// マーチ：変ロ長調・16小節。ホルンの旋律（2本のユニゾン＋1オクターブ下）、ホルンの後打ち（2・4拍目の和音）、チューバ風の低音（1・3拍目に根音と5度）、大太鼓・小太鼓・シンバル。
const MCH={B:[58,62,65],E:[58,63,67],G:[58,62,67],C:[60,63,67],F:[57,60,65]},MROOT={B:[46,41],E:[39,46],G:[43,38],C:[48,43],F:[41,36]};
const MARCH={bpm:116,beats:64,ch:'BBEBGCFFBBECBFBB',
 mel:[[[0,65,.75],[.75,65,.25],[1,70,1],[2,74,1],[3,77,1]],[[0,77,1.5],[1.5,74,.5],[2,70,2]],[[0,75,.75],[.75,75,.25],[1,79,1],[2,77,1],[3,75,1]],[[0,74,3],[3,70,1]],
  [[0,74,.75],[.75,72,.25],[1,70,1],[2,67,1],[3,70,1]],[[0,72,.75],[.75,70,.25],[1,67,1],[2,63,1],[3,67,1]],[[0,69,1],[1,72,1],[2,77,1],[3,75,1]],[[0,74,1],[1,72,1],[2,65,1.5],[3.5,65,.5]],
  [[0,65,.75],[.75,65,.25],[1,70,1],[2,74,1],[3,77,1]],[[0,77,1],[1,79,1],[2,82,2]],[[0,79,1.5],[1.5,77,.5],[2,75,1],[3,79,1]],[[0,79,.75],[.75,77,.25],[1,75,1],[2,72,2]],
  [[0,74,1],[1,77,1],[2,82,1.5],[3.5,77,.5]],[[0,81,1.5],[1.5,79,.5],[2,77,1],[3,72,1]],[[0,74,.75],[.75,74,.25],[1,77,.75],[1.75,77,.25],[2,82,2]],[[0,82,1],[1,70,1]]]};
const WALTZ={bpm:144,beats:24,root:[45,41,38,40,45,41,40,45],ch:[CH.Am,CH.Fw,CH.Dmw,CH.E,CH.Am,CH.Fw,CH.E,CH.Am],
 mel:[[[0,76,2],[2,74,1]],[[0,72,2],[2,69,1]],[[0,74,2],[2,77,1]],[[0,76,1.5],[1.5,71,.5],[2,68,1]],[[0,76,2],[2,81,1]],[[0,79,2],[2,77,1]],[[0,76,1],[1,71,1],[2,68,1]],[[0,69,3]]]};
const DRAMA={bpm:66,beats:32,ch:['Am','Fw','C','G','Am','Dmw','E','Am'].map(k=>CH[k]),arp:[0,1,2,1,2,1,0,1]};
const SONGS={
 march:{bpm:MARCH.bpm,beats:MARCH.beats,at(i,t,s,o,A){const bar=i>>2,n=i%4,k=MARCH.ch[bar],last=bar===15;
  for(const [b,m,len] of MARCH.mel[bar])if(b>=n&&b<n+1){const at=t+(b-n)*s,d=s*len*.92;A.brass(hz(m),at,d,.075,{o});A.brass(hz(m-12),at,d,.04,{o,bright:.6})}
  if(n%2===0){A.brass(hz(MROOT[k][n/2]),t,s*.55,.11,{o,bright:.45,attack:.03});A.tone('sine',72,t,.22,.42,{o,sweep:42,decay:true})}
  else if(!(last&&n===3)){for(const m of MCH[k])A.brass(hz(m),t,s*.38,.03,{o,bright:.8,attack:.02});A.noise(t,.13,.12,{o,type:'bandpass',freq:2200,q:.7})}
  // 4・8・16小節の最後の拍は小太鼓のロール、1・9小節の頭はシンバル。
  if(n===3&&(bar===3||bar===7||last))for(let r=0;r<6;r++)A.noise(t+r*s/6,.07,.05+r*.012,{o,type:'bandpass',freq:2400,q:.7});
  if(n===0&&(bar===0||bar===8))A.noise(t,.9,.07,{o,type:'highpass',freq:6000});}},
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
 if(!AC)return {unlock(){},setEnabled(){},setVolume(){},sfx(){},air(){},music(){},duck(){},suspend(){}};
 let ctx=null,master,bus={},noiseBuf,enabled=true,volume=.7,ducked=false,want=null,cur=null,timer=0,last={},airWant=null,airCur=null;
 const out=()=>ctx&&enabled;
 function tone(type,f,t,dur,vol,p={}){const o=ctx.createOscillator(),g=ctx.createGain();let n=o;o.type=type;o.frequency.setValueAtTime(f,t);if(p.sweep)o.frequency.exponentialRampToValueAtTime(p.sweep,t+dur);if(p.detune)o.detune.value=p.detune;
  if(p.lp){const l=ctx.createBiquadFilter();l.type='lowpass';l.frequency.value=p.lp;o.connect(l);n=l}
  n.connect(g);g.connect(p.o||bus.sfx);const a=p.attack||.005;g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(vol,t+a);
  if(p.decay)g.gain.exponentialRampToValueAtTime(.0001,t+dur);else{g.gain.setValueAtTime(vol,Math.max(t+a,t+dur*.7));g.gain.exponentialRampToValueAtTime(.0001,t+dur+.15)}
  o.start(t);o.stop(t+dur+.2)}
 function noise(t,dur,vol,p={}){const s=ctx.createBufferSource(),f=ctx.createBiquadFilter(),g=ctx.createGain();s.buffer=noiseBuf;f.type=p.type||'lowpass';f.frequency.setValueAtTime(p.freq||800,t);if(p.sweep)f.frequency.exponentialRampToValueAtTime(p.sweep,t+dur);f.Q.value=p.q||1;
  s.connect(f);f.connect(g);g.connect(p.o||bus.sfx);g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(vol,t+(p.attack||.005));g.gain.exponentialRampToValueAtTime(.0001,t+dur);s.start(t,Math.random()*1.5);s.stop(t+dur+.05)}
 // ホルン風の金管：わずかにずらした鋸歯状波2本を、吹き始めに開くローパスに通し、長い音にだけ遅れてビブラートを掛ける。
 function brass(f,t,dur,vol,p={}){const g=ctx.createGain(),l=ctx.createBiquadFilter(),v=ctx.createOscillator(),vd=ctx.createGain(),b=p.bright||1,a=p.attack||.045;
  l.type='lowpass';l.Q.value=1.1;l.frequency.setValueAtTime(f*1.1,t);l.frequency.linearRampToValueAtTime(Math.min(4200,f*4.2*b),t+.06);l.frequency.exponentialRampToValueAtTime(Math.min(3000,f*2.6*b),t+.25);
  v.frequency.value=5.2;vd.gain.setValueAtTime(0,t);vd.gain.linearRampToValueAtTime(dur>.5?f*.006:0,t+Math.min(dur,.45));v.connect(vd);
  for(const d of [-6,5]){const o=ctx.createOscillator();o.type='sawtooth';o.frequency.value=f;o.detune.value=d;vd.connect(o.frequency);o.connect(l);o.start(t);o.stop(t+dur+.2)}
  l.connect(g);g.connect(p.o||bus.music);g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(vol,t+a);g.gain.linearRampToValueAtTime(vol*.8,t+a+.1);g.gain.setValueAtTime(vol*.8,t+Math.max(a+.1,dur*.85));g.gain.exponentialRampToValueAtTime(.0001,t+Math.max(a+.12,dur)+.12);v.start(t);v.stop(t+dur+.2)}
 const A={tone,noise,brass};
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
  // 会話の動きに添える、可愛らしい短い音（台詞のじゃまにならない小さな音量）
  'm-hop'(t){tone('sine',520,t,.08,.06,{sweep:780,decay:true});tone('sine',780,t+.09,.1,.06,{sweep:1040,decay:true});tone('sine',2080,t+.09,.18,.014,{decay:true})}, // ぴょこっ
  'm-sway'(t){tone('sine',330,t,.22,.05,{sweep:460,decay:true,attack:.08,lp:1200});tone('sine',460,t+.2,.26,.045,{sweep:340,decay:true,attack:.06,lp:1200})}, // ふわっ
  'm-recoil'(t){tone('sine',1500,t,.12,.06,{sweep:700,decay:true});tone('triangle',2100,t,.08,.022,{sweep:1100,decay:true})}, // ぴゃっ
  'm-lunge'(t){noise(t,.12,.05,{type:'highpass',freq:2500,sweep:7000,q:.8,attack:.06});tone('sine',900,t+.07,.07,.04,{sweep:1500,decay:true})}, // しゅぴっ
  'm-tremble'(t){const o=ctx.createOscillator(),l=ctx.createOscillator(),d=ctx.createGain(),g=ctx.createGain();o.type='sine';o.frequency.value=880;l.frequency.value=18;d.gain.value=.03;l.connect(d);d.connect(g.gain);o.connect(g);g.connect(bus.sfx);g.gain.setValueAtTime(.04,t);g.gain.exponentialRampToValueAtTime(.0001,t+.36);o.start(t);l.start(t);o.stop(t+.38);l.stop(t+.38)}, // ぷるぷる
  'm-nod'(t){tone('sine',330,t,.09,.09,{sweep:220,decay:true});tone('triangle',660,t,.04,.03,{decay:true});noise(t,.03,.04,{type:'bandpass',freq:1200,q:1})}, // ぽこっ（木の実）
  // 吹き出しの記号に添える音
  'sym-note'(t){[2093,2637,3136].forEach((f,i)=>tone('sine',f,t+i*.06,.16,.04,{decay:true}))}, // きらっ
  'sym-surprise'(t){tone('sine',700,t,.07,.06,{sweep:1400,decay:true});tone('sine',1500,t+.08,.08,.05,{decay:true})}, // ぴこっ
  'sym-sweat'(t){tone('sine',900,t,.12,.07,{sweep:380,decay:true})}, // ぽたっ
  'sym-dots'(t){[.15,.4,.65].forEach(d=>tone('sine',520,t+d,.1,.045,{decay:true}))}, // ぽ・ぽ・ぽ
  'sym-anger'(t){tone('triangle',320,t,.12,.06,{sweep:200,decay:true});tone('triangle',260,t+.1,.1,.05,{sweep:170,decay:true})},
  'sym-shy'(t){tone('sine',880,t,.1,.04,{decay:true});tone('sine',1175,t+.09,.16,.04,{decay:true})},
  'sym-proud'(t){tone('sine',1568,t,.3,.04,{decay:true});tone('sine',2093,t+.07,.3,.035,{decay:true})},
  rumble(t){noise(t,1.2,.5,{freq:140,sweep:60,attack:.15,o:airCur?.g});tone('sine',48,t,.9,.3,{sweep:30,decay:true,o:airCur?.g})}}; // 地鳴りの揺れに合わせた低い響き
 // 会話の環境音（@空気）。bus.air に鳴らして、会話が終わるか @空気 なし で止める。音量設定・ミュートは master に従う。
 function loopNoise(g,type,freq,q,gain,rate){const s=ctx.createBufferSource(),f=ctx.createBiquadFilter(),v=ctx.createGain(),l=ctx.createOscillator(),d=ctx.createGain();s.buffer=noiseBuf;s.loop=true;f.type=type;f.frequency.value=freq;f.Q.value=q;v.gain.value=gain*.6;l.frequency.value=rate;d.gain.value=gain*.4;l.connect(d);d.connect(v.gain);s.connect(f);f.connect(v);v.connect(g);s.start(t0(),Math.random());l.start();return [s,l]}
 const t0=()=>ctx.currentTime;
 const AIRS={
  sea:g=>({nodes:[...loopNoise(g,'lowpass',520,.7,.55,.12),...loopNoise(g,'bandpass',1400,.8,.22,.07),...loopNoise(g,'highpass',4000,.5,.05,.21)]}), // 波と風と飛沫
  harbor:g=>{const nodes=loopNoise(g,'lowpass',380,.7,.3,.08),k=()=>{if(!ctx||ctx.state!=='running')return;const t=t0()+.05;for(const d of [0,.46])tone('sine',540-d*60,t+d,.13,.05,{sweep:380,decay:true,lp:1700,o:g});noise(t,.05,.02,{type:'bandpass',freq:900,q:1,o:g})};return {nodes,timer:setInterval(k,3600),first:setTimeout(k,900)}}, // 遠い槌音と小さな波音
  rumble:g=>{const nodes=[...loopNoise(g,'lowpass',90,.8,1.1,.14),...loopNoise(g,'bandpass',260,1.2,.12,.05)],o=ctx.createOscillator(),v=ctx.createGain(),l=ctx.createOscillator(),d=ctx.createGain();o.type='sine';o.frequency.value=41;v.gain.value=.16;l.frequency.value=.2;d.gain.value=.08;l.connect(d);d.connect(v.gain);o.connect(v);v.connect(g);o.start();l.start();nodes.push(o,l);
   const k=()=>{if(!ctx||ctx.state!=='running'||Math.random()<.35)return;tone('sine',1800+Math.random()*900,t0()+.02,.1,.025,{sweep:900,decay:true,o:g})};return {nodes,timer:setInterval(k,900)}} // 低い地鳴りと、時々したたる水滴
 };
 function airStop(){if(!airCur)return;const c=airCur;airCur=null;clearInterval(c.timer);clearTimeout(c.first);const n=t0();c.g.gain.cancelScheduledValues(n);c.g.gain.setValueAtTime(c.g.gain.value,n);c.g.gain.linearRampToValueAtTime(0,n+.8);setTimeout(()=>{for(const x of c.nodes){try{x.stop()}catch{}}c.g.disconnect()},1000)}
 function airStart(){airStop();if(!ctx||!airWant||!AIRS[airWant])return;const g=ctx.createGain(),n=t0();g.gain.setValueAtTime(0,n);g.gain.linearRampToValueAtTime(1,n+1.2);g.connect(bus.air);airCur={g,...AIRS[airWant](g)}}
;
 return {
  unlock(){if(ctx){if(ctx.state==='suspended'&&!document.hidden)ctx.resume();return}try{ctx=new AC();master=ctx.createGain();master.connect(ctx.destination);for(const k of ['music','sfx','env','air']){bus[k]=ctx.createGain();bus[k].connect(master)}bus.env.gain.value=.3;bus.air.gain.value=.6;bus.sfx.gain.value=.8;
   noiseBuf=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate);const d=noiseBuf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
   master.gain.value=0;ambient();apply();if(ctx.state==='suspended')ctx.resume();startMusic();airStart();timer=setInterval(tick,120)}catch{ctx=null}},
  setEnabled(v){enabled=!!v;apply()},
  setVolume(v){volume=Math.min(1,Math.max(0,+v||0));apply()},
  sfx(name){if(!out()||!SFX[name])return;try{SFX[name](ctx.currentTime+.01)}catch{}},
  air(name){name=name&&AIRS[name]?name:null;if(name===airWant)return;airWant=name;if(ctx)airStart()},
  music(name){name=name&&SONGS[name]?name:null;if(name===want)return;want=name;if(ctx)startMusic()},
  duck(v){ducked=!!v;apply()},
  suspend(v){if(!ctx)return;if(v)ctx.suspend();else ctx.resume()}}}
