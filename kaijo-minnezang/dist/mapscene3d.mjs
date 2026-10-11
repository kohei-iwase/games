// 戦略マップの3Dモデル一覧。scene3d.mjs と同じ {solid, transparent} を返す純粋関数（艦隊の向きだけ前回値を WeakMap に覚える）。
import {model,multiply,segmentMatrix,TAU,clamp} from './space3d.mjs';
import {MAP,LAMP,SHOALS,ISLETS,CONTACT} from './strategy.mjs';
import {KNIGHTS,ESCORT} from './battle.mjs';
// 戦略マップの座標（3000×2000）は 0.4 倍して中心を原点に置く。論理座標の y は 3D の z に対応する。
export const MAP_SCALE=.4;
export const mapWorld=(x,y,h=0)=>[(x-MAP.w/2)*MAP_SCALE,h,(y-MAP.h/2)*MAP_SCALE];
// 3D空間の海面上の点（groundPoint の戻り値は戦闘用に +500,+325 されている）を、戦略マップの座標へ戻す。
export const mapFromGround=p=>({x:(p.x-500)/MAP_SCALE+MAP.w/2,y:(p.y-325)/MAP_SCALE+MAP.h/2});
export const FLEET_COLOR={main:'#d23a54',detached:'#5f8fe0'};
export const shipMaxHp=type=>(type==='escort'?ESCORT:KNIGHTS[type]).maxHp;
const hex=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255);
const C={stone:[.40,.47,.51,1],dark:[.07,.12,.17,1],gold:[.70,.52,.25,1],bone:[.70,.72,.62,1],blue:[.30,.48,.76,1]};
const headings=new WeakMap();
export function buildMapScene(st,{selected=null,now=0}={}){
 const solid=[],transparent=[],S=MAP_SCALE;
 const draw=(mesh,m,color,glow=0,water=0)=>(color[3]<1?transparent:solid).push({mesh,model:Array.from(m),color,glow,water});
 const item=(mesh,p,scale,color,angle=0,glow=0)=>draw(mesh,model(p,scale,angle),color,glow);
 const line=(a,z,r,color,glow=0)=>draw('cylinder',segmentMatrix(a,z,r),color,glow);
 const local=(g,mesh,p,scale,col,angle=0,glow=0)=>draw(mesh,multiply(g,model(p,scale,angle)),col,glow);
 const limb=(g,a,z,r,col)=>draw('cylinder',multiply(g,segmentMatrix(a,z,r)),col);
 const ring=(x,y,r,col,h=3,glow=.4)=>item('ring',mapWorld(x,y,h),[r*S,1,r*S],col,0,glow);
 draw('water',model(),[1,1,1,1],0,1);
 // 海域の縁：細い線と四隅の灯。
 const cs=[[0,0],[MAP.w,0],[MAP.w,MAP.h],[0,MAP.h]];
 cs.forEach((c,i)=>{const n=cs[(i+1)%4];line(mapWorld(c[0],c[1],3),mapWorld(n[0],n[1],3),.9,[.35,.57,.59,.38]);item('cylinder',mapWorld(c[0],c[1],6),[4,10,4],C.dark);item('sphere',mapWorld(c[0],c[1],14),[2.5,2.5,2.5],[.67,.75,.56,1],0,.8)});
 // 浅瀬：海面すれすれの半透明の円盤と点在する岩。
 SHOALS.forEach((o,k)=>{const r=o.r*S;item('sphere',mapWorld(o.x,o.y,-.6),[r,1.6,r],[.52,.82,.70,.2],0,.15);item('sphere',mapWorld(o.x,o.y,-.3),[r*.62,1.2,r*.62],[.84,.86,.70,.18],0,.15);for(let i=0;i<4;i++){const a=k*1.7+i*1.9,d=r*(.35+.18*((i*5+k)%4)),q=2.5+(i+k)%3;item('sphere',mapWorld(o.x,o.y,-1).map((v,j)=>v+(j===0?Math.cos(a)*d:j===2?Math.sin(a)*d:0)),[q,q*.7,q*.85],[.17,.24,.25,1])}});
 // 小島：通れない岩。
 ISLETS.forEach((o,k)=>{const r=o.r*S;item('sphere',mapWorld(o.x,o.y,-r*.2),[r*1.1,r*.8,r*.95],[.26,.33,.34,1],k);item('cone',mapWorld(o.x+8,o.y,r*.35),[r*.6,r*.95,r*.55],[.36,.43,.42,1],k);item('cone',mapWorld(o.x-r*.9,o.y+r*.5,0),[r*.3,r*.5,r*.3],[.22,.29,.29,1])});
 // 峰の灯：岩の山頂に灯台と灯（島の耐久で弱まる）。包囲されている間は灯が赤く瞬く。補給の範囲を淡い輪で示す。
 {const lit=.3+.7*clamp(st.lamp.hp/100,0,1),f=LAMP.r*S*1.3/54.6,siege=st.enemies.some(e=>e.active&&e.siege)&&Math.sin(now*9)>0,[x,,z]=mapWorld(LAMP.x,LAMP.y),at=(h,dx=0)=>[x+dx*f,h*f,z];
  item('sphere',at(-8),[54.6*f,41*f,43.7*f],[.17,.24,.26,1]);item('cone',at(24,3),[22*f,33*f,22*f],[.27,.34,.33,1]);item('cylinder',at(52,3),[8*f,30*f,8*f],[.78,.76,.66,1]);item('cylinder',at(68,3),[10*f,3.5*f,10*f],C.gold);
  item('sphere',at(74,3),[7*f,7*f,7*f],siege?[1,.45,.3,1]:[lit,.78*lit,.4*lit,1],0,.4+1.4*lit);
  ring(LAMP.x,LAMP.y,LAMP.r+8,siege?[.95,.2,.25,.9]:[.91,.77,.40,.45*lit+.15],4);ring(LAMP.x,LAMP.y,LAMP.r+60,[.91,.77,.40,.16],2.5,.2)}
 // 自軍の艦隊：艦を小さな海城にして一列に並べる。向きは移動先へ（止まっているときは前回の向き）。
 const ss=.45;
 for(const f of st.fleets){
  const col=hex(FLEET_COLOR[f.id]||'#d23a54'),ships=f.ships.filter(s=>s.hp>0);
  if(f.target){const a=Math.atan2(f.target.y-f.y,f.target.x-f.x);if(Number.isFinite(a))headings.set(f,a)}
  const ang=headings.get(f)??0,c=Math.cos(ang),n=Math.sin(ang),sel=f.id===selected;
  ships.forEach((s,i)=>{
   const off=(i-(ships.length-1)/2)*-52,side=(i%2?1:-1)*(ships.length>1?9:0),px=off*c-side*n,pz=off*n+side*c,[wx,,wz]=mapWorld(f.x,f.y);
   const esc=s.type==='escort',k=esc?.75:1,g=model([wx+px,3.2+Math.sin(now*1.7+i+f.x)*.5,wz+pz],[ss*k,ss*k,ss*k],ang);
   const body=esc?[.28,.27,.25,1]:s.type==='guard'?[.18,.23,.34,1]:s.type==='lance'?[.40,.04,.11,1]:[.29,.14,.08,1],trim=esc?[.72,.70,.65,1]:s.type==='lance'?[.80,.82,.88,1]:s.type==='stake'?[.80,.47,.26,1]:C.gold,guard=s.type==='guard';
   item('disc',[wx+px,1.4,wz+pz],[62*ss*k,1,37*ss*k],[.005,.018,.025,.24],ang);
   local(g,'hull',[0,6,0],[guard?103:118,19,guard?76:58],body);local(g,'hull',[0,16,0],[guard?100:114,3,guard?72:54],trim);
   local(g,'box',[-13,27,0],[48,20,35],C.stone);local(g,'box',[-18,45,0],[25,20,25],C.stone);local(g,'cone',[-18,61,0],[19,23,19],C.dark,Math.PI/4);
   for(const [x,z] of [[-36,-22],[-36,22],[12,-22],[12,22]]){local(g,'cylinder',[x,33,z],[8,29,8],C.stone);local(g,'cylinder',[x,49,z],[10,4,10],trim)}
   local(g,'cylinder',[-21,73,0],[1.4,54,1.4],trim);local(g,'box',[-12,93,0],[18,12,1.6],[...col,1],0,.15);local(g,'box',[-12,93,1],[2,10,1.2],C.bone);
   if(s.type==='lance'){local(g,'box',[30,24,0],[44,9,17],[.12,.08,.08,1]);local(g,'box',[30,29,0],[46,1.4,19],trim);local(g,'box',[58,26,0],[50,3.4,3.4],[.86,.84,.80,1]);draw('cone',multiply(g,segmentMatrix([83,26,0],[102,26,0],3.6)),[.86,.84,.80,1])}
   else if(s.type==='stake'){for(const z of [-10,10]){local(g,'box',[27,22,z],[35,7,7],C.dark);local(g,'box',[39,25,z],[44,2,2],C.bone)}}
   else if(guard){local(g,'box',[44,31,0],[8,42,66],C.blue);local(g,'box',[49,32,0],[2,34,5],C.bone)}
  });
  const [wx,,wz]=mapWorld(f.x,f.y);
  ring(f.x,f.y,sel?72:60,sel?[.91,.77,.40,.92]:[...col,.4],3,sel?.6:.3);if(sel)ring(f.x,f.y,66,[.91,.77,.40,.5],3,.4);
  if(f.target){
   const [tx,,tz]=mapWorld(f.target.x,f.target.y),len=Math.hypot(tx-wx,tz-wz),num=clamp(Math.round(len/9),2,90);
   for(let i=0;i<num;i+=2){const a=i/num,z2=(i+1)/num;line([wx+(tx-wx)*a,4,wz+(tz-wz)*a],[wx+(tx-wx)*z2,4,wz+(tz-wz)*z2],1.2,[...col,.85],.5)}
   ring(f.target.x,f.target.y,30,[...col,.9],4,.5);ring(f.target.x,f.target.y,14,[...col,.9],4,.5)}
 }
 // 敵：ネフェリムは巨人、眷属の群れは小さく暗い巨人の三つ組。向きは目的地へ。
 for(const e of st.enemies){
  if(!e.active)continue;
  const nep=e.kind==='nephilim',goal=st.goal(e),ang=Math.atan2(goal.y-e.y,goal.x-e.x),[wx,,wz]=mapWorld(e.x,e.y);
  const hide=nep?[.18,.27,.34,1]:[.12,.19,.24,1],spots=nep?[[0,0,.45]]:[[0,0,.27],[-24,-32,.2],[-22,34,.2]];
  item('disc',[wx,1.6,wz],[(nep?46:56),1,(nep?40:50)],[.005,.015,.03,.32]);
  for(const [dx,dz,k] of spots){
   const c=Math.cos(ang),n=Math.sin(ang),g=model([wx+dx*c-dz*n,0,wz+dx*n+dz*c],[k,k,k],ang);
   local(g,'sphere',[-10,38,0],[65,68,57],hide);local(g,'sphere',[0,98,0],[45,61,64],hide);local(g,'sphere',[20,139,0],[32,39,36],hide);local(g,'sphere',[40,127,0],[27,16,26],[.12,.15,.21,1]);
   for(const z of [-26,26]){local(g,'sphere',[43,145,z],[5,3,5],[1,.40,.32,1],0,1.2);draw('cone',multiply(g,segmentMatrix([-3,154,z],[-30,210,z*1.7],12)),C.bone)}
   for(const side of [-1,1]){const shoulder=[-3,100,side*60],elbow=[47,65,side*112],hand=[115,27,side*100];local(g,'sphere',shoulder,[32,36,32],hide);limb(g,shoulder,elbow,22,hide);local(g,'sphere',elbow,[23,23,23],hide);limb(g,elbow,hand,16,hide);local(g,'sphere',hand,[22,13,22],hide)}
  }
  if(nep)ring(e.x,e.y,CONTACT,[.95,.25,.35,.35],3,.3);
 }
 return {solid,transparent};
}
