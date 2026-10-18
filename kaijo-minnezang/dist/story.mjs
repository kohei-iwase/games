// 物語パートの台本の読み込み。DOM非依存。書式は docs/story-format.md。
// 台本の1行を再生用の命令に変えるだけで、再生そのもの（talk.mjs）は知らない。

// 名前の短縮形・表示名 → 登場人物。key は battle.mjs の騎士ID。立ち絵のない名前は札だけ。
// face=[x%,y%,倍率] は、立ち絵の画像のどこを顔アイコン（話者が画面にいないとき）に切り出すか（顔の中心の位置と拡大。省略時は DEFAULT_FACE）。
export const CHARACTERS={
 lance:{key:'lance',name:'ミラルカ',art:'./art/talk-miralka.png',color:'#b0213f',face:[43,25,2.6],aliases:['ミラルカ','ミラルカ辺境伯']},
 stake:{key:'stake',name:'老騎士カナン',art:'./art/talk-kanaan.png',color:'#c8773f',face:[54,21,2.6],aliases:['カナン','老騎士カナン','カナン卿']},
 guard:{key:'guard',name:'盾持ちオリーヴェ',art:'./art/talk-olive.png',color:'#4a78c8',face:[41,24,2.6],aliases:['オリーヴェ','盾持ちオリーヴェ','堅牢なるオリーヴェ']}};
// 姫（プレイヤー）。名前は再生時にプレイヤーが付けた名前へ、立ち絵は選んだ姿（性別）のものへ差し替わる。art は目印だけ。
export const DEFAULT_FACE=[45,24,2.6],HERO_FACES={female:[53,21,2.6],male:[53,19,2.6]};
export const HERO={key:'hero',name:'姫',art:'hero',color:'#a8863a',face:HERO_FACES.female};
export const EMOTIONS={喜び:'joy',怒り:'anger',驚き:'surprise',哀しみ:'sad',静か:'calm',凛:'brave',照れ:'shy',不敵:'bold',焦り:'panic',呆れ:'weary',得意:'proud'};
// 感情ごとに立ち絵の頭上へ出す記号。kind は見た目の種類（怒りと汗は CSS で描く）、text は添える文字。
export const SYMBOLS={喜び:{kind:'note',text:'♪'},怒り:{kind:'anger',text:''},驚き:{kind:'surprise',text:'！？'},哀しみ:{kind:'sad',text:'…'},照れ:{kind:'shy',text:'♡'},焦り:{kind:'sweat',text:''},呆れ:{kind:'weary',text:'…'},得意:{kind:'proud',text:'✦'}};
const FORMS={人:'human',幻影:'ghost'};
export const MOTIONS={跳ねる:'hop',揺れる:'sway',身を引く:'recoil',前に出る:'lunge',震える:'tremble',頷く:'nod'};
// 動きを書かなかったときの、感情ごとの既定の動き。
export const DEFAULT_MOTION={喜び:'跳ねる',驚き:'身を引く',怒り:'揺れる',焦り:'震える'};
const POSITIONS={左:'left',中:'center',右:'right'},BACKGROUNDS={海:'sea',海図:'chart',暗転:'black',入り江:'inlet',谷:'valley'};
const AIRS={潮風:'sea',夜の港:'harbor',地鳴り:'rumble',嵐:'storm',なし:null},EFFECTS={閃光:'flash',暗転:'fadeout',明転:'fadein',揺れ:'shake'},SOUNDS={鐘:'bell',鼓動:'heart',杭:'stake',十字架:'cross',打撃:'hit',雷:'thunder'};

const BY_ALIAS=new Map(Object.values(CHARACTERS).flatMap(c=>c.aliases.map(a=>[a,c])));
// 名前 → {key,name,art,color,face}。未知の名前は書いたとおりの札だけ（key=null）。
export function resolveName(text){if(text==='姫')return {...HERO};const c=BY_ALIAS.get(text);return c?{key:c.key,name:c.name,art:c.art,color:c.color,face:c.face||DEFAULT_FACE}:{key:null,name:text,art:null,color:null}}

const BRACKET=/^([^\s　［\[]+)[\s　]*[［\[]([^］\]]*)[］\]][\s　]*(.*)$/,PLAIN=/^([^\s　［\[]+)[\s　]+(.*)$/;
const lines=text=>String(text).replace(/／/g,'\n');
// 台詞の本文。（〜）で全体が囲まれていれば心の声。
function speech(raw){const t=raw.trim(),mind=/^（[\s\S]*）$/.test(t);return {text:lines(mind?t.slice(1,-1):t),mind}}

// 台本のテキスト → 命令の配列。書式の誤りは例外にせず {type:'warn',line,text} として残す（警告は分岐の中のものも最上位に集める）。
// say{who,text,mind,emotion,motion,symbol} / narr{text} / bg{value} / enter{who,pos} / exit{who} / fx{name} / sfx{name} / wait{sec} / form{value}
// / heading{title,sub,tag} / trans{bg,title,sub,tag}（場面転換：斜め縞のワイプで背景を替え、見出しがあれば続けて見出しカード）/ brief{on}（説明モード：上下の黒帯と字幕の開始・終了）/ air{name}（name は sea・harbor・rumble・storm、止めるときは null）/ nameinput / choice{options,branches}（branches[i] は選択肢 i+1 を選んだときの命令列）/ warn
export function parseScript(text){
 const out=[],warn=(line,msg)=>out.push({type:'warn',line,text:msg});
 let sink=out,choice=null,stray=false;// choice=分岐を書いている最中の選択肢、sink=命令の出力先（null は捨てる）
 const emit=c=>{if(sink)sink.push(c)};
 const closeChoice=()=>{choice=null;sink=out;stray=false};
 // 出力先のない所（@選択 の直後〜最初の @もし の前、番号の誤った @もし の中）にある行は、1か所につき1回だけ警告して捨てる。
 const strayLine=line=>{if(sink||stray)return;stray=true;warn(line,'この行は再生されません（@選択 の直後は有効な @もし から書く）')};
 String(text).split(/\r?\n/).forEach((raw,i)=>{
  const line=i+1,s=raw.trim();if(!s||s.startsWith('#'))return;
  if(s.startsWith('＊')){strayLine(line);emit({type:'narr',line,text:lines(s.slice(1).trim())});return}
  if(s.startsWith('@')){
   const [cmd,...a]=s.slice(1).split(/[\s　]+/);
   switch(cmd){
    case '選択':{
     if(choice){warn(line,'@選択 の中に @選択 は書けません（先に @ここまで）');break}
     const options=s.slice(1+cmd.length).split(/[｜|]/).map(t=>t.trim()).filter(Boolean);
     if(options.length<2)warn(line,'@選択 には選択肢を2つ以上書いてください（A｜B）');
     choice={type:'choice',line,options,branches:options.map(()=>[])};out.push(choice);sink=null;stray=false;break}
    case 'もし':{
     if(!choice){warn(line,'@もし が @選択 の外にあります');break}
     const n=Number(a[0]);
     if(!Number.isInteger(n)||n<1||n>choice.options.length){warn(line,`@もし の番号「${a[0]??''}」が選択肢（1〜${choice.options.length}）にありません`);sink=null;stray=false;break}
     sink=choice.branches[n-1];break}
    case 'ここまで':if(!choice)warn(line,'@ここまで が @選択 の外にあります');else closeChoice();break;
    default:strayLine(line);command(cmd,a,line,s)}
   return}
  strayLine(line);
  const m=BRACKET.exec(s),p=m?null:PLAIN.exec(s);
  if(!m&&!p){warn(line,'台詞の形式が読めません（名前［感情・動き］台詞）');return}
  const who=resolveName((m||p)[1]),tags=m?m[2].split('・').map(t=>t.trim()).filter(Boolean):[],body=speech(m?m[3]:p[2]);
  let emotion=null,motion=null;
  for(const t of tags){if(EMOTIONS[t]&&!emotion)emotion=t;else if(MOTIONS[t]&&!motion)motion=t;else warn(line,`未知の感情・動き「${t}」`)}
  emit({type:'say',line,who,...body,emotion,motion:motion||DEFAULT_MOTION[emotion]||null,symbol:SYMBOLS[emotion]?{...SYMBOLS[emotion]}:null})});
 if(choice){warn(choice.line,'@選択 の分岐に @ここまで がありません');closeChoice()}
 return out;

 function command(cmd,a,line,raw){
  switch(cmd){
    case '背景':if(BACKGROUNDS[a[0]])emit({type:'bg',line,value:BACKGROUNDS[a[0]]});else warn(line,`未知の背景「${a[0]??''}」（海・海図・暗転・入り江・谷）`);break;
    case '登場':case '退場':{const who=resolveName(a[0]??'');
     if(!a[0])warn(line,`@${cmd} に名前がありません`);
     else if(!who.art)warn(line,`「${a[0]}」には立ち絵がありません`);
     else if(cmd==='退場')emit({type:'exit',line,who});
     else if(POSITIONS[a[1]])emit({type:'enter',line,who,pos:POSITIONS[a[1]]});
     else warn(line,`未知の位置「${a[1]??''}」（左・中・右）`);break}
    case '演出':if(EFFECTS[a[0]])emit({type:'fx',line,name:EFFECTS[a[0]]});else warn(line,`未知の演出「${a[0]??''}」（閃光・暗転・明転・揺れ）`);break;
    case '音':if(SOUNDS[a[0]])emit({type:'sfx',line,name:SOUNDS[a[0]]});else warn(line,`未知の効果音「${a[0]??''}」（鐘・鼓動・杭・十字架・打撃・雷）`);break;
    case '間':{const sec=Number(a[0]);if(a[0]!==undefined&&Number.isFinite(sec)&&sec>=0)emit({type:'wait',line,sec});else warn(line,`@間 の秒数が数ではありません「${a[0]??''}」`);break}
    case '見出し':{const [title,sub,tag]=raw.slice(1+cmd.length).split(/[｜|]/).map(t=>t.trim());if(title)emit({type:'heading',line,title,sub:sub||'',tag:tag||''});else warn(line,'@見出し に見出しがありません（見出し｜副題｜札）');break}
    case '転換':{const [bg,title,sub,tag]=raw.slice(1+cmd.length).split(/[｜|]/).map(t=>t.trim());if(BACKGROUNDS[bg])emit({type:'trans',line,bg:BACKGROUNDS[bg],title:title||'',sub:sub||'',tag:tag||''});else warn(line,`@転換 の背景「${bg??''}」が読めません（背景名｜見出し｜副題｜札）`);break}
    case '説明':if(a[0]==='開始'||a[0]==='終了')emit({type:'brief',line,on:a[0]==='開始'});else warn(line,`@説明 は 開始 か 終了 です「${a[0]??''}」`);break;
    case '空気':if(a[0]in AIRS)emit({type:'air',line,name:AIRS[a[0]]});else warn(line,`未知の空気「${a[0]??''}」（潮風・夜の港・地鳴り・嵐・なし）`);break;
    case '名前入力':emit({type:'nameinput',line});break;
    case '姿':if(FORMS[a[0]])emit({type:'form',line,value:FORMS[a[0]]});else warn(line,`未知の姿「${a[0]??''}」（人・幻影）`);break;
    default:warn(line,`未知の命令「@${cmd}」`)}}
}

// ブラウザ用。./story/名前.txt を読んで parseScript に渡す。
export async function loadScript(name){const res=await fetch(`./story/${name}.txt`);if(!res.ok)throw new Error(`台本 ${name} を読めません（${res.status}）`);return parseScript(await res.text())}
