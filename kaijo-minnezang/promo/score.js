// 海城のミンネザング イメージビデオの音（Web Audio で合成）。image.html と、JIZURA に渡す WAV の書き出しで共有する。
// 映像と音は同じ拍の時刻表（BEATS・GIANT）を使う。
var DUR=17.6;
// GIANT は巨人（ネフェリム）の鼓動。歌を失ってもなお打ち続ける、低く重い拍
var BEATS=[[1.5,.6],[2.9,.5],[4.3,.6],[5.5,1],[7.0,.5],[8.5,.45],[8.85,.25],[13.2,1],[14.6,.6],[16.7,.8]],GIANT=[[10.5,.9],[11.35,1]];
var ac=null,master=null;
function noiseBuf(){const b=ac.createBuffer(1,ac.sampleRate*2,ac.sampleRate),d=b.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;return b}
function env(g,at,peak,a,d){g.gain.setValueAtTime(0,at);g.gain.linearRampToValueAtTime(peak,at+a);g.gain.exponentialRampToValueAtTime(.0001,at+a+d)}
function thump(at,k,f0=70){[[0,1],[.22,.6]].forEach(([o,m])=>{const os=ac.createOscillator(),g=ac.createGain();os.frequency.setValueAtTime(f0,at+o);os.frequency.exponentialRampToValueAtTime(f0*.46,at+o+.2);env(g,at+o,.9*k*m,.008,.28);os.connect(g).connect(master);os.start(at+o);os.stop(at+o+.4)})}
function pluck(at,f,v=.12){const os=ac.createOscillator(),g=ac.createGain(),hp=ac.createBiquadFilter();os.type='sawtooth';os.frequency.value=f;hp.type='highpass';hp.frequency.value=900;env(g,at,v,.003,.6);os.connect(hp).connect(g).connect(master);os.start(at);os.stop(at+.8)}
function pad(at,dur,fs,v=.05){fs.forEach(f=>{[0,4].forEach(dt=>{const os=ac.createOscillator(),g=ac.createGain();os.type='triangle';os.frequency.value=f;os.detune.value=dt*2-4;g.gain.setValueAtTime(0,at);g.gain.linearRampToValueAtTime(v,at+dur*.35);g.gain.linearRampToValueAtTime(0,at+dur);os.connect(g).connect(master);os.start(at);os.stop(at+dur+.1)})})}
function whoosh(at,dur,v=.3,f0=400,f1=4000){const s=ac.createBufferSource(),bp=ac.createBiquadFilter(),g=ac.createGain();s.buffer=noiseBuf();bp.type='bandpass';bp.Q.value=1.2;bp.frequency.setValueAtTime(f0,at);bp.frequency.exponentialRampToValueAtTime(f1,at+dur);g.gain.setValueAtTime(0,at);g.gain.linearRampToValueAtTime(v,at+dur*.8);g.gain.exponentialRampToValueAtTime(.0001,at+dur+.15);s.connect(bp).connect(g).connect(master);s.start(at);s.stop(at+dur+.3)}
function boom(at){const os=ac.createOscillator(),g=ac.createGain();os.frequency.setValueAtTime(90,at);os.frequency.exponentialRampToValueAtTime(25,at+1.2);env(g,at,1,.005,1.6);os.connect(g).connect(master);os.start(at);os.stop(at+1.8);whoosh(at,.05,.5,3000,800)}
function bell(at,f){[[1,.25],[2.76,.12],[5.4,.06],[8.9,.03]].forEach(([r,v])=>{const os=ac.createOscillator(),g=ac.createGain();os.frequency.value=f*r;env(g,at,v,.004,3.5/r**.3);os.connect(g).connect(master);os.start(at);os.stop(at+4)})}
function snapSound(at){const os=ac.createOscillator(),g=ac.createGain();os.type='sawtooth';os.frequency.setValueAtTime(880,at);os.frequency.exponentialRampToValueAtTime(110,at+.35);env(g,at,.14,.002,.5);os.connect(g).connect(master);os.start(at);os.stop(at+.6);whoosh(at,.03,.35,5000,2000)}
function drone(at){const lp=ac.createBiquadFilter(),g=ac.createGain();lp.type='lowpass';lp.frequency.setValueAtTime(260,at);lp.frequency.setValueAtTime(220,at+10);lp.frequency.linearRampToValueAtTime(1400,at+12);lp.frequency.setValueAtTime(300,at+12.22);
  g.gain.setValueAtTime(0,at);g.gain.linearRampToValueAtTime(.09,at+2.5);g.gain.setValueAtTime(.09,at+8.98);g.gain.linearRampToValueAtTime(.0,at+9.1);g.gain.setValueAtTime(0,at+9.9);g.gain.linearRampToValueAtTime(.1,at+11.6);g.gain.linearRampToValueAtTime(.14,at+12.2);g.gain.linearRampToValueAtTime(.06,at+13.2);g.gain.linearRampToValueAtTime(0,at+DUR);
  [36.7,36.9,73.4].forEach(f=>{const os=ac.createOscillator();os.type='sawtooth';os.frequency.value=f;os.connect(lp);os.start(at);os.stop(at+DUR+.2)});lp.connect(g).connect(master)}
function score(at){
  drone(at);BEATS.forEach(([b,k])=>thump(at+b,k));GIANT.forEach(([b,k])=>thump(at+b,k,42));
  const Dm=[293.7,349.2,440,587.3,523.3,440,349.2,293.7];Dm.forEach((f,i)=>pluck(at+.2+i*.28,f,.09));
  [587.3,523.3,466.2,440].forEach((f,i)=>pluck(at+2.9+i*.45,f,.06));
  pad(at+4.4,2.4,[146.8,220,293.7,349.2],.035);pad(at+6.5,2.0,[116.5,233.1,293.7,349.2],.035);
  [587.3,698.5,880,1174.7,880,698.5].forEach((f,i)=>pluck(at+6.8+i*.22,f,.05));
  [293.7,349.2,440].forEach((f,i)=>pluck(at+8.45+i*.18,f,.08));snapSound(at+9);
  whoosh(at+10,1.8,.12,150,1000);whoosh(at+11.6,.22,.45,600,6000);boom(at+12.02);
  bell(at+13.35,293.7);pad(at+13.3,4.3,[146.8,220,293.7,370],.03);
  [293.7,349.2,440,587.3].forEach((f,i)=>pluck(at+15.6+i*.4,f,.035));bell(at+16.7,440);
}

// オフラインで合成して WAV（16bit ステレオ）の Blob を返す
async function renderWav(rate=44100){
  const keep=[ac,master],off=new OfflineAudioContext(2,Math.ceil(rate*DUR),rate);
  ac=off;master=off.createGain();master.gain.value=.8;const comp=off.createDynamicsCompressor();master.connect(comp);comp.connect(off.destination);
  try{score(0);var buf=await off.startRendering()}finally{[ac,master]=keep}
  const n=buf.length,data=new DataView(new ArrayBuffer(44+n*4)),str=(o,x)=>[...x].forEach((c,i)=>data.setUint8(o+i,c.charCodeAt(0)));
  str(0,'RIFF');data.setUint32(4,36+n*4,true);str(8,'WAVEfmt ');data.setUint32(16,16,true);data.setUint16(20,1,true);data.setUint16(22,2,true);
  data.setUint32(24,rate,true);data.setUint32(28,rate*4,true);data.setUint16(32,4,true);data.setUint16(34,16,true);str(36,'data');data.setUint32(40,n*4,true);
  const L=buf.getChannelData(0),R=buf.getChannelData(1);for(let i=0;i<n;i++){data.setInt16(44+i*4,Math.max(-1,Math.min(1,L[i]))*32767,true);data.setInt16(46+i*4,Math.max(-1,Math.min(1,R[i]))*32767,true)}
  return new Blob([data],{type:'audio/wav'});
}
