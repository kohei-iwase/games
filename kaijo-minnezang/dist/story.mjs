// 物語パートの台本の読み込み。DOM非依存。書式は docs/story-format.md。
// 台本の1行を再生用の命令に変えるだけで、再生そのもの（talk.mjs）は知らない。

// 名前の短縮形・表示名 → 登場人物。key は battle.mjs の騎士ID。立ち絵のない名前は札だけ。
export const CHARACTERS={
 lance:{key:'lance',name:'ミラルカ辺境伯',art:'./art/talk-miralka.png',color:'#b0213f',aliases:['ミラルカ','ミラルカ辺境伯']},
 stake:{key:'stake',name:'カナン卿',art:'./art/talk-kanaan.png',color:'#c8773f',aliases:['カナン','カナン卿']},
 guard:{key:'guard',name:'堅牢なるオリーヴェ',art:'./art/talk-olive.png',color:'#4a78c8',aliases:['オリーヴェ','堅牢なるオリーヴェ']}};
export const EMOTIONS={喜び:'joy',怒り:'anger',驚き:'surprise',哀しみ:'sad',静か:'calm',凛:'brave',照れ:'shy',不敵:'bold'};
export const MOTIONS={跳ねる:'hop',揺れる:'sway',身を引く:'recoil',前に出る:'lunge',震える:'tremble',頷く:'nod'};
// 動きを書かなかったときの、感情ごとの既定の動き。
export const DEFAULT_MOTION={喜び:'跳ねる',驚き:'身を引く',怒り:'揺れる'};
const POSITIONS={左:'left',中:'center',右:'right'},BACKGROUNDS={海:'sea',海図:'chart',暗転:'black'};
const EFFECTS={閃光:'flash',暗転:'fadeout',明転:'fadein',揺れ:'shake'},SOUNDS={鐘:'bell',鼓動:'heart',杭:'stake',十字架:'cross',打撃:'hit'};

const BY_ALIAS=new Map(Object.values(CHARACTERS).flatMap(c=>c.aliases.map(a=>[a,c])));
// 名前 → {key,name,art,color}。未知の名前は書いたとおりの札だけ（key=null）。
export function resolveName(text){const c=BY_ALIAS.get(text);return c?{key:c.key,name:c.name,art:c.art,color:c.color}:{key:null,name:text,art:null,color:null}}

const BRACKET=/^([^\s　［\[]+)[\s　]*[［\[]([^］\]]*)[］\]][\s　]*(.*)$/,PLAIN=/^([^\s　［\[]+)[\s　]+(.*)$/;
const lines=text=>String(text).replace(/／/g,'\n');
// 台詞の本文。（〜）で全体が囲まれていれば心の声。
function speech(raw){const t=raw.trim(),mind=/^（[\s\S]*）$/.test(t);return {text:lines(mind?t.slice(1,-1):t),mind}}

// 台本のテキスト → 命令の配列。書式の誤りは例外にせず {type:'warn',line,text} として、その位置に残す。
// say{who,text,mind,emotion,motion} / narr{text} / bg{value} / enter{who,pos} / exit{who} / fx{name} / sfx{name} / wait{sec} / warn
export function parseScript(text){
 const out=[],warn=(line,msg)=>out.push({type:'warn',line,text:msg});
 String(text).split(/\r?\n/).forEach((raw,i)=>{
  const line=i+1,s=raw.trim();if(!s||s.startsWith('#'))return;
  if(s.startsWith('＊')){out.push({type:'narr',line,text:lines(s.slice(1).trim())});return}
  if(s.startsWith('@')){
   const [cmd,...a]=s.slice(1).split(/[\s　]+/);
   switch(cmd){
    case '背景':if(BACKGROUNDS[a[0]])out.push({type:'bg',line,value:BACKGROUNDS[a[0]]});else warn(line,`未知の背景「${a[0]??''}」（海・海図・暗転）`);break;
    case '登場':case '退場':{const who=resolveName(a[0]??'');
     if(!a[0])warn(line,`@${cmd} に名前がありません`);
     else if(!who.art)warn(line,`「${a[0]}」には立ち絵がありません`);
     else if(cmd==='退場')out.push({type:'exit',line,who});
     else if(POSITIONS[a[1]])out.push({type:'enter',line,who,pos:POSITIONS[a[1]]});
     else warn(line,`未知の位置「${a[1]??''}」（左・中・右）`);break}
    case '演出':if(EFFECTS[a[0]])out.push({type:'fx',line,name:EFFECTS[a[0]]});else warn(line,`未知の演出「${a[0]??''}」（閃光・暗転・明転・揺れ）`);break;
    case '音':if(SOUNDS[a[0]])out.push({type:'sfx',line,name:SOUNDS[a[0]]});else warn(line,`未知の効果音「${a[0]??''}」（鐘・鼓動・杭・十字架・打撃）`);break;
    case '間':{const sec=Number(a[0]);if(a[0]!==undefined&&Number.isFinite(sec)&&sec>=0)out.push({type:'wait',line,sec});else warn(line,`@間 の秒数が数ではありません「${a[0]??''}」`);break}
    default:warn(line,`未知の命令「@${cmd}」`)}
   return}
  const m=BRACKET.exec(s),p=m?null:PLAIN.exec(s);
  if(!m&&!p){warn(line,'台詞の形式が読めません（名前［感情・動き］台詞）');return}
  const who=resolveName((m||p)[1]),tags=m?m[2].split('・').map(t=>t.trim()).filter(Boolean):[],body=speech(m?m[3]:p[2]);
  let emotion=null,motion=null;
  for(const t of tags){if(EMOTIONS[t]&&!emotion)emotion=t;else if(MOTIONS[t]&&!motion)motion=t;else warn(line,`未知の感情・動き「${t}」`)}
  out.push({type:'say',line,who,...body,emotion,motion:motion||DEFAULT_MOTION[emotion]||null})});
 return out}

// ブラウザ用。./story/名前.txt を読んで parseScript に渡す。
export async function loadScript(name){const res=await fetch(`./story/${name}.txt`);if(!res.ok)throw new Error(`台本 ${name} を読めません（${res.status}）`);return parseScript(await res.text())}
