// Campaign layer: owns drama text and persistent records. It only reads Battle.report(); it never touches battle state.
import {DIFFICULTY,FLAGSHIP,NAMES,CLASSES,shipSpec} from './battle.mjs';

const RANK_NOTE={S:'吟遊詩人が百年歌い継ぐ戦い',A:'宮廷で称えられる勝利',B:'誓いを果たした勝利',C:'辛くも掴んだ勝利','—':'撤退'};

export function epilogue(r){
 const sunk=r.ships.filter(s=>s.sunk).map(s=>s.name),lines=[];
 if(r.result==='victory'){
  lines.push({speaker:NAMES.lance,text:r.rank==='S'||r.rank==='A'?'勝鬨だ！ ねえ、聞こえた？ 今夜の勝ちは、ぜんぶキミにくれてやろう。':'勝ちは勝ち、よかろう！ ……でも次は、一発で仕留めてみせるからな。'});
  if(sunk.includes(NAMES.stake))lines.push({speaker:NAMES.guard,text:'カナンさまの城が傾いております。曳航いたしましょう、あの杭はまだ要ります。'});
  else if(r.combos>=3)lines.push({speaker:NAMES.stake,text:`わしの杭を、ミラルカ殿の十字架が${r.combos}度打ち砕きましたな。……五十年前と、何ひとつ変わりませぬな。`});
  else lines.push({speaker:NAMES.stake,text:'血は充分、城壁が歌っておりますぞ。弾幕が縫い留めた一瞬、次も逃されませぬよう。'});
  if(sunk.includes(NAMES.guard))lines.push({speaker:NAMES.lance,text:'……盾は砕けても、キミの誓いは砕けてないよ。連れて帰るのは任せたまえ。'});
  else if(r.island>=100)lines.push({speaker:NAMES.guard,text:'峰の灯は無傷でございます。島の皆さまも、安らかにお休みになれましょう。'});
  else lines.push({speaker:NAMES.guard,text:r.taken>600?'被害は軽くございません。ですが、旗は一度も下ろしておりません。':'損害軽微。旗を畳み、帰港いたします。'});
  if(r.battles>1)lines.push({speaker:NAMES.stake,text:r.battles<=3?`${r.battles}度の押し引きで仕留めましたな。血の流れを読み切った、見事な手並みでした。`:`${r.battles}度も押し戻されながら、よくぞ削り切りました。粘り勝ちですぞ、ミラルカ殿。`});
 }else{
  lines.push({speaker:NAMES.guard,text:r.lost==='island'?'峰の灯が……消えてしまいました。全艦、退きます。':'旗艦が沈みます！ ミラルカさまをお曳きして――全艦、旗を降ろせ、撤退です！'});
  lines.push({speaker:NAMES.stake,text:r.form===2?'あと一息でしたな。第二形態の墜落に、血を吸われすぎ申した。':'血が足りませなんだ。弾幕で縫い留め、十字架を合わせる機を、もう一度探りましょうぞ。'});
  if(r.battles>1)lines.push({speaker:NAMES.guard,text:`${r.battles}戦を重ね、ネフェリムの傷は深うございます。次は必ずや。`});
  lines.push({speaker:NAMES.lance,text:'退くのは今夜だけだ！ キミの鼓動が続く限り、ボクは何度だってこの海に戻ってくる！'});
 }
 return {title:r.result==='victory'?'凱歌':'撤退の歌',note:RANK_NOTE[r.rank],lines};
}

// 1戦ごとの結果（Battle.report() か simulate() の戻り値）を、勝敗の見出しと説明にする。敵の名前と旗艦の名前は報告から読む。
export function battleVerdict(r){
 const foe=r.enemyKind==='kin'?'眷属の群れ':'ネフェリム';
 if(r.decided==='kill')return {kind:'kill',title:'撃破',stamp:'討',note:`${foe}は血海に沈んだ。`};
 if(r.decided==='judge')return r.result==='victory'?{kind:'win',title:'判定勝ち',stamp:'勝',note:`与えた損害が上回った。${foe}を押し返した。`}:{kind:'push',title:'判定負け',stamp:'負',note:`艦隊は押し戻された。${foe}の傷はそのまま、海図へ戻る。`};
 return {kind:'retreat',title:'撤退',stamp:'退',note:r.decided==='wiped'?'艦隊は壊滅した。':`旗艦${r.ships?.[0]?.name||'ミラルカ'}が戦闘不能。艦隊は撤退する。`};
}
// 連戦全体の戦果。epilogue/hints/saveRecord がそのまま読める形にまとめる。ランクはネフェリム撃破までの戦闘回数で決める。
export function campaignReport(list,won){
 const last=list[list.length-1],sum=k=>list.reduce((n,r)=>n+(r[k]||0),0),n=list.length;
 return {result:won?'victory':'defeat',decided:last.decided,difficulty:last.difficulty,battles:n,rank:won?n<=3?'S':n===4?'A':n===5?'B':'C':'—',score:won?Math.max(0,100-n*10+Math.min(15,sum('perfect')*3)):0,time:sum('time'),form:last.form,ships:last.ships,combos:sum('combos'),perfect:sum('perfect'),joustHits:sum('joustHits'),taken:sum('taken'),dealtTotal:sum('dealtTotal'),totalBlood:sum('totalBlood'),dealt:{bleed:list.reduce((m,r)=>m+(r.dealt?.bleed||0),0)},island:100,lost:won?null:'flagship'};
}

// 戦略マップ全体の戦果。epilogue/hints/saveRecord がそのまま読める形にする。history はこれまでの戦闘の報告。
// 評価は勝利時のみ：100点から、沈めた艦（−10）、峰の灯の損傷（−0.3/点）、5分を超えた分（−1/10秒）、7戦目以降（−2/戦）を引く。S85・A72・B58。
const START_SHIPS=['lance','guard','stake','escort:retinue','escort:hunter'];
export function strategyReport(st,history){
 const won=st.result==='victory',left=st.fleets.flatMap(f=>f.ships.map(x=>x.type)),sum=k=>history.reduce((n,r)=>n+(r[k]||0),0);
 const ships=START_SHIPS.map(id=>{const i=left.indexOf(id);if(i>=0)left.splice(i,1);return {id,name:NAMES[id]||CLASSES[shipSpec(id).cls].name,sunk:i<0}}),sunk=ships.filter(x=>x.sunk).length,lamp=Math.ceil(st.lamp.hp),time=Math.round(st.time);
 const score=won?Math.max(0,Math.round(100-sunk*10-(100-lamp)*.3-Math.max(0,time-300)/10-Math.max(0,st.battles-6)*2)):0;
 const nep=history.filter(r=>r.enemyKind!=='kin').pop();
 return {result:won?'victory':'defeat',decided:st.lamp.hp<=0?'island':'flagship',difficulty:'normal',battles:st.battles,rank:won?score>=85?'S':score>=72?'A':score>=58?'B':'C':'—',score,time,form:nep?.form||1,ships,combos:sum('combos'),perfect:sum('perfect'),joustHits:sum('joustHits'),taken:sum('taken'),dealtTotal:sum('dealtTotal'),totalBlood:sum('totalBlood'),dealt:{bleed:history.reduce((m,r)=>m+(r.dealt?.bleed||0),0)},island:lamp,lost:won?null:st.lamp.hp<=0?'island':'flagship'};
}
// 戦略マップ用の助言（最大2件）。
export function strategyHints(r){
 const h=[];
 if(r.lost==='island')h.push('ネフェリムが島のそばに着くと、峰の灯が毎秒3削られます。浅瀬で足が鈍る間に、ミラルカの艦隊をぶつけて押し戻しましょう。');
 if(r.lost==='flagship')h.push('ミラルカが沈むと敗北です。傷ついたら峰の灯のそばで補給（毎秒2%回復）してから挑みましょう。');
 if(r.result!=='victory'&&r.battles<=1)h.push('艦隊は海図上でいつでも動かせます。ポーズ中に移動先を決め、ネフェリムには主力艦隊、眷属には別働隊を当てましょう。');
 if(r.result==='victory'&&r.ships.some(x=>x.sunk))h.push('沈んだ艦は戻りません。同格の眷属は別働隊に任せ、無理な追撃は避けましょう。');
 if(r.result!=='victory')h.push('海城は三種類。随行艦は耐久と装甲で敵を引きつけ、狩猟艦は遠くから連射し、執行艦は敵の耐久が3割以下のとき与ダメージ+30%。編成の組み合わせで戦いましょう。');
 if(r.result==='victory'&&r.rank!=='S')h.push('評価は、沈めた艦の少なさ、峰の灯の無傷、所要時間で決まります。');
 return h.slice(0,2);
}

export function hints(r){
 const h=[];
 if(r.lost==='island')h.push('ネフェリムは峰の灯を目指します。行く手に艦を置くと向きを変え、浅瀬では足が鈍ります。バラージで縫い留め、バッシュで大技を止め、ジョストで押し戻しましょう。');
 if(r.result!=='victory'&&r.ships.find(s=>s.id===FLAGSHIP).sunk)h.push(`旗艦・ミラルカが沈むと敗北。ジョストの後は敵の間合いに残りやすいので、危機のポーズでは「集合」で下げるか、${NAMES.guard}の〈バッシュ〉で敵の大技を中断しましょう。`);
 if(r.combos===0)h.push('バラージ（カナン）とジョストを同じポーズで予約すると連携になり、拘束杭を砕いて大きく失血させます。');
 if(r.perfect===0&&r.joustHits>0)h.push('射出集中で金色の範囲にFを合わせると、ジョストの威力が1.5倍になります。');
 if(r.form===2)h.push('第二形態の〈血潮の墜落〉は、足元の血が最も濃い艦を狙います。円内の血域は吸われて敵が回復します。');
 if(r.taken>700)h.push('薙ぎ払いの予兆には、〈バッシュ〉の体当たりで溜めを中断できます。「死守」で被害を抑える手もあります。');
 return h.slice(0,2);
}

const KEY='kaijo-minnezang/records';
const ORDER=['S','A','B','C','—'];
export function loadRecords(){try{return JSON.parse(localStorage.getItem(KEY))||{}}catch{return {}}}
// Returns whether this result beats the stored best for its difficulty.
export function saveRecord(r){
 const records=loadRecords(),old=records[r.difficulty];
 const faster=r.battles&&old?.battles&&r.battles!==old.battles?r.battles<old.battles:r.time<old?.time;
 const better=!old||ORDER.indexOf(r.rank)<ORDER.indexOf(old.rank)||(r.rank===old.rank&&r.result==='victory'&&faster);
 if(better){records[r.difficulty]={rank:r.rank,time:r.time,score:r.score,battles:r.battles};try{localStorage.setItem(KEY,JSON.stringify(records))}catch{}}
 return better;
}
export const difficultyName=id=>DIFFICULTY[id]?.name||id;
