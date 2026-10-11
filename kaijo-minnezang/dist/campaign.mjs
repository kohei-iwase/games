// Campaign layer: owns drama text and persistent records. It only reads Battle.report(); it never touches battle state.
import {DIFFICULTY,FLAGSHIP} from './battle.mjs';

export const PROLOGUE={
 title:'第四歌　血海の誓い',
 place:'黒潮海域 · 夜明け前',
 lines:[
  {speaker:'赤楯卿',text:'見張りより報せ。黒潮の底から、ネフェリムが浮上した。'},
  {speaker:'茨卿',text:'ならば血を流させましょう。海に血が満ちれば、我らの城は渇きを癒やせる。'},
  {speaker:'白鷺卿',text:'その血の上を、旗艦たる私の槍が駆ける。姫君への歌は、勝って戻ってから詠もう。'},
  {speaker:'赤楯卿',text:'旗を掲げよ。白鷺卿が沈めば艦隊は退く――槍の前には出ても、あの方の盾は私が務める。'}
 ]
};

const RANK_NOTE={S:'吟遊詩人が百年歌い継ぐ戦い',A:'宮廷で称えられる勝利',B:'誓いを果たした勝利',C:'辛くも掴んだ勝利','—':'撤退'};

export function epilogue(r){
 const sunk=r.ships.filter(s=>s.sunk).map(s=>s.name),lines=[];
 if(r.result==='victory'){
  lines.push({speaker:'白鷺卿',text:r.rank==='S'||r.rank==='A'?'海が凪いだ。旗も槍も折れず――凱歌を詠もう。':'終わったな。……次は、もっと深く踏み込める。'});
  if(sunk.includes('茨卿'))lines.push({speaker:'赤楯卿',text:'茨卿の城が傾いている。曳航しろ、あの杭はまだ要る。'});
  else if(r.combos>=3)lines.push({speaker:'茨卿',text:`私の杭を、あなたの槍が${r.combos}度砕きました。馬上槍試合というより、もう舞踏ですね。`});
  else lines.push({speaker:'茨卿',text:'血は充分――城壁が歌っています。杭が縫い留めた瞬間を、次も逃さないでくださいね。'});
  if(sunk.includes('赤楯卿'))lines.push({speaker:'白鷺卿',text:'赤楯卿……盾は砕けても、誓いは砕けなかった。'});
  else lines.push({speaker:'赤楯卿',text:r.taken>600?'被害は軽くない。だが、旗は一度も下ろさなかった。':'損害軽微。旗を畳み、帰港する。'});
 }else{
  lines.push({speaker:'赤楯卿',text:'旗艦が沈む！ 白鷺卿を曳け、全艦、旗を降ろせ――撤退だ！'});
  lines.push({speaker:'茨卿',text:r.form===2?'あと一息でした。第二形態の墜落に、血を吸われすぎましたね。':'血が足りませんでした。杭で縫い、槍を合わせる機を探しましょう。'});
  lines.push({speaker:'白鷺卿',text:'……まだ歌は終わっていない。血海の流れを読み直そう。'});
 }
 return {title:r.result==='victory'?'凱歌':'撤退の歌',note:RANK_NOTE[r.rank],lines};
}

export function hints(r){
 const h=[];
 if(r.result!=='victory'&&r.ships.find(s=>s.id===FLAGSHIP).sunk)h.push('旗艦・白鷺卿が沈むと敗北。ジョストの後は敵の間合いに残りやすいので、危機のポーズでは「集合」で下げるか、赤楯卿の誓いの範囲に入れましょう。');
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
