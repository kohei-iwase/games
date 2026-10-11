// Campaign layer: owns drama text and persistent records. It only reads Battle.report(); it never touches battle state.
import {DIFFICULTY,FLAGSHIP,NAMES} from './battle.mjs';

export const PROLOGUE={
 title:'第一歌　血海の誓い',
 place:'沈みし峰々 · ヴァルトブルク峰沖 · 明けぬ夜',
 lines:[
  {speaker:NAMES.guard,text:'見張りより報せでございます。沈んだ谷の底から、ネフェリムが浮上いたしました。峰の灯を目指しております。'},
  {speaker:NAMES.stake,text:'ならば、まずは血を流させましょうぞ、辺境伯。海に血が満ちれば、城の渇きも癒えまする。……オリーヴェ、前に出すぎるでないぞ。'},
  {speaker:'ミラルカ辺境伯',text:'全艦、ボクに続け！ あのデカブツを、島には一歩も近づけさせない。十字架でぶち抜いてやる。……ローラ、すぐ帰るからね。'},
  {speaker:NAMES.guard,text:'旗を掲げます。辺境伯さまが沈めば艦隊は退くほかございません――杭の前に出られても、辺境伯さまの盾はわたくしが務めます。'}
 ]
};

const RANK_NOTE={S:'吟遊詩人が百年歌い継ぐ戦い',A:'宮廷で称えられる勝利',B:'誓いを果たした勝利',C:'辛くも掴んだ勝利','—':'撤退'};

export function epilogue(r){
 const sunk=r.ships.filter(s=>s.sunk).map(s=>s.name),lines=[];
 if(r.result==='victory'){
  lines.push({speaker:'ミラルカ辺境伯',text:r.rank==='S'||r.rank==='A'?'勝鬨だ！ ねえローラ、聞こえた？ 今夜の勝ちは、ぜんぶキミにあげる。':'勝ちは勝ち！ ……でも次は、一発で仕留めてみせるからな。'});
  if(sunk.includes(NAMES.stake))lines.push({speaker:NAMES.guard,text:'お祖父さまの城が傾いております。曳航いたしましょう、あの杭はまだ要ります。'});
  else if(r.combos>=3)lines.push({speaker:NAMES.stake,text:`わしの杭を、辺境伯の十字架が${r.combos}度打ち砕きましたな。……先代にもお見せしたかった。`});
  else lines.push({speaker:NAMES.stake,text:'血は充分、城壁が歌っておりますぞ。杭が縫い留めた一瞬、次も逃されませぬよう。'});
  if(sunk.includes(NAMES.guard))lines.push({speaker:'ミラルカ辺境伯',text:'……盾は砕けても、キミの誓いは砕けてないよ。絶対に連れて帰る。'});
  else lines.push({speaker:NAMES.guard,text:r.taken>600?'被害は軽くございません。ですが、旗は一度も下ろしておりません。':'損害軽微。旗を畳み、帰港いたします。'});
 }else{
  lines.push({speaker:NAMES.guard,text:'旗艦が沈みます！ 辺境伯さまをお曳きして――全艦、旗を降ろせ、撤退です！'});
  lines.push({speaker:NAMES.stake,text:r.form===2?'あと一息でしたな。第二形態の墜落に、血を吸われすぎ申した。':'血が足りませなんだ。杭で縫い、十字架を合わせる機を、もう一度探りましょうぞ。'});
  lines.push({speaker:'ミラルカ辺境伯',text:'退くのは今夜だけだ！ ローラの鼓動が続く限り、ボクは何度だってこの海に戻ってくる！'});
 }
 return {title:r.result==='victory'?'凱歌':'撤退の歌',note:RANK_NOTE[r.rank],lines};
}

export function hints(r){
 const h=[];
 if(r.result!=='victory'&&r.ships.find(s=>s.id===FLAGSHIP).sunk)h.push(`旗艦・ミラルカ辺境伯が沈むと敗北。ジョストの後は敵の間合いに残りやすいので、危機のポーズでは「集合」で下げるか、${NAMES.guard}の〈不退の誓い〉の範囲に入れましょう。`);
 if(r.combos===0)h.push('縫い留め（Q）とジョスト（W）を同じポーズで予約すると連携になり、杭を砕いて大きく失血させます。');
 if(r.perfect===0&&r.joustHits>0)h.push('射出集中で金色の範囲にFを合わせると、ジョストの威力が1.5倍になります。');
 if(r.form===2)h.push('第二形態の〈血潮の墜落〉は、足元の血が最も濃い艦を狙います。円内の血域は吸われて敵が回復します。');
 if(r.taken>700)h.push('薙ぎ払いの予兆には「死守」と〈不退の誓い〉を重ねると被害を大きく抑えられます。');
 return h.slice(0,2);
}

const KEY='kaijo-minnezang/records';
const ORDER=['S','A','B','C','—'];
export function loadRecords(){try{return JSON.parse(localStorage.getItem(KEY))||{}}catch{return {}}}
// Returns whether this result beats the stored best for its difficulty.
export function saveRecord(r){
 const records=loadRecords(),old=records[r.difficulty];
 const better=!old||ORDER.indexOf(r.rank)<ORDER.indexOf(old.rank)||(r.rank===old.rank&&r.result==='victory'&&r.time<old.time);
 if(better){records[r.difficulty]={rank:r.rank,time:r.time,score:r.score};try{localStorage.setItem(KEY,JSON.stringify(records))}catch{}}
 return better;
}
export const difficultyName=id=>DIFFICULTY[id]?.name||id;
