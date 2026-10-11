import {model,multiply,segmentMatrix,world,TAU,clamp} from './space3d.mjs';
const C={stone:[.40,.47,.51,1],dark:[.07,.12,.17,1],gold:[.70,.52,.25,1],bone:[.70,.72,.62,1],teal:[.28,.68,.64,1],blue:[.30,.48,.76,1],blood:[.64,.075,.23,1]};
export function buildScene(b,selected='lance',showRange=false){
 const solid=[],transparent=[];
 function draw(mesh,m,color,glow=0,water=0){(color[3]<1?transparent:solid).push({mesh,model:Array.from(m),color,glow,water})}
 const item=(mesh,p,scale,color,angle=0,glow=0)=>draw(mesh,model(p,scale,angle),color,glow);
 const line=(a,z,r,color,glow=0)=>draw('cylinder',segmentMatrix(a,z,r),color,glow);
 const local=(group,mesh,p,scale,col,angle=0,glow=0)=>draw(mesh,multiply(group,model(p,scale,angle)),col,glow);
 const limb=(group,a,z,r,col)=>draw('cylinder',multiply(group,segmentMatrix(a,z,r)),col);
 const ring=(x,y,r,col,h=4)=>item('ring',world(x,y,h),[r,1,r],col,0,.4);
 draw('water',model(),[1,1,1,1],0,1);
 // A thin boundary and corner beacons distinguish the playable water from the horizon.
 for(const [a,z] of [[[45,45],[955,45]],[[955,45],[955,605]],[[955,605],[45,605]],[[45,605],[45,45]]])line(world(...a,3),world(...z,3),.7,[.35,.57,.59,.38]);
 for(const [x,y] of [[45,45],[955,45],[955,605],[45,605]]){item('cylinder',world(x,y,6),[4,10,4],C.dark);item('sphere',world(x,y,14),[2,2,2],[.67,.75,.56,1],0,.8);}
 // Offshore rocks frame, but never obstruct, the navigable chart.
 for(const [x,y,s] of [[-30,80,70],[1015,555,75],[-80,590,56],[1070,10,42],[220,-105,35]]){item('sphere',world(x,y,-8),[s,s*.75,s*.8],[.12,.19,.22,1]);item('cone',world(x+5,y,24),[s*.4,s*.6,s*.4],[.22,.29,.29,1]);}
 const rally=b.pending==='rally'?(b.pendingRally||b.rally):b.order==='rally'?b.rally:null;
 if(rally){ring(rally.x,rally.y,30,[.91,.77,.40,.95]);line(world(rally.x-40,rally.y,6),world(rally.x+40,rally.y,6),1.5,[.91,.77,.40,1]);line(world(rally.x,rally.y-40,6),world(rally.x,rally.y+40,6),1.5,[.91,.77,.40,1]);}
 const entry=b.joust?.entry||b.entry;
 if(entry&&(b.joust||b.pendingSkills.includes('lance'))){ring(entry.x,entry.y,20,[.98,.8,.4,1]);const a=world(entry.x,entry.y,5),z=world(b.enemy.x,b.enemy.y,5);for(let i=0;i<24;i+=2)line(a.map((v,k)=>v+(z[k]-v)*i/24),a.map((v,k)=>v+(z[k]-v)*(i+1)/24),1.3,[.98,.8,.4,.8]);}
 for(const s of b.ships){
  const color=s.id==='stake'?[.78,.47,.25,1]:s.id==='lance'?[.85,.87,.90,1]:C.blue,trim=s.id==='lance'?[.80,.82,.88,1]:s.id==='stake'?[.80,.47,.26,1]:C.gold;
  const dead=s.hp<=0,flash=s.hitUntil>b.time;
  const g=model(world(s.x,s.y,dead?-26:7+Math.sin(b.time*1.7+s.x)*1.1),[1,1,1],s.angle);
  const stone=flash?[.93,.73,.74,1]:C.stone,body=s.id==='guard'?[.18,.23,.34,1]:s.id==='lance'?[.40,.04,.11,1]:[.29,.14,.08,1];
  item('disc',world(s.x,s.y,2.2),[62,1,37],[.005,.018,.025,.24],s.angle);
  local(g,'hull',[0,6,0],[s.id==='guard'?103:118,19,s.id==='guard'?76:58],body);
  local(g,'hull',[0,16,0],[s.id==='guard'?100:114,3,s.id==='guard'?72:54],trim);
  local(g,'box',[-13,27,0],[48,20,35],stone);
  local(g,'box',[-18,45,0],[25,20,25],stone);
  local(g,'cone',[-18,61,0],[19,23,19],C.dark,Math.PI/4);
  for(const [x,z] of [[-36,-22],[-36,22],[12,-22],[12,22]]){
   local(g,'cylinder',[x,33,z],[8,29,8],stone);
   local(g,'cylinder',[x,49,z],[10,4,10],trim);
   for(let i=0;i<4;i++)local(g,'box',[x+Math.cos(i*Math.PI/2)*8,53,z+Math.sin(i*Math.PI/2)*8],[5,7,5],stone);
   local(g,'box',[x+8,34,z],[.7,8,3],[.95,.65,.24,1],0,.35);
  }
  for(const z of [-27,27]){local(g,'box',[-6,22,z],[60,7,3],stone);for(let x=-30;x<22;x+=13)local(g,'box',[x,28,z],[7,6,4],stone);}
  local(g,'cylinder',[-21,73,0],[1.1,54,1.1],trim);
  const flag=b.pending||b.order,flagColor=flag==='charge'?[.65,.12,.24,1]:flag==='hold'?[.26,.42,.63,1]:s.id==='lance'?[.70,.07,.20,1]:color;
  local(g,'box',[-12,93,0],[18,12,1.2],flagColor);
  local(g,'box',[-12,93,.9],[2,10,1.2],C.bone);local(g,'box',[-12,95,.9],[12,2,1.2],C.bone);
  if(s.id==='stake'){
   for(const z of [-10,10]){local(g,'box',[27,22,z],[35,7,7],C.dark);local(g,'box',[39,25,z],[44,2,2],C.bone);local(g,'box',[23,26,z],[5,10,14],trim);}
  }else if(s.id==='lance'){
   const coffin=[.12,.08,.08,1],ivory=[.86,.84,.80,1];
   local(g,'box',[30,24,0],[44,9,17],coffin);local(g,'box',[30,29,0],[46,1.2,19],trim);local(g,'box',[30,30,0],[40,1,3],trim);local(g,'box',[24,30,0],[3,1,12],trim);
   local(g,'box',[53,24,0],[2,10,20],trim);local(g,'box',[7,24,0],[2,10,20],trim);
   const t=s.lunge?.age||0,extend=s.lunge?(t<.22?t/.22:t<.45?1:Math.max(0,(.95-t)/.5)):0,r=8+extend*62;
   local(g,'box',[r+25,26,0],[50,3.4,3.4],ivory);local(g,'box',[r+39,26,0],[3.4,3.4,26],ivory);
   draw('cone',multiply(g,segmentMatrix([r+50,26,0],[r+68,26,0],3.4)),ivory);
   if(b.joust){for(const z of [-20,20])local(g,'cone',[-73,13,z],[10,32,10],[.98,.66,.20,.55],0,.7);}
  }else{
   local(g,'box',[44,31,0],[8,42,66],C.blue);local(g,'box',[49,32,0],[2,34,5],C.bone);local(g,'box',[49,35,0],[2,5,31],C.bone);
   for(const z of [-36,36])local(g,'box',[-5,20,z],[80,14,7],C.blue);
  }
  if(!dead){
   if(s.id===selected)ring(s.x,s.y,62,[...color.slice(0,3),.85],3.7);
   if(s.blood>=25)ring(s.x,s.y,67,[.90,.20,.40,.5],4.1);
   if(showRange&&s.id===selected)ring(s.x,s.y,s.id==='guard'?235:s.range,[...color.slice(0,3),.42],3.1);
   if(s.speedNow>5)for(let i=0;i<3;i++)local(g,'ring',[-60-i*18,0,0],[20+i*6,1,15+i*3],[.59,.80,.81,.15]);
   if(s.windup)ring(s.x,s.y,54,[1,.78,.3,.7]);
  }
 }
 const e=b.enemy,flash=e.hitUntil>b.time,dead=e.hp<=0;
 const root=e.rootUntil>b.time;
 const group=model(world(e.x,e.y,dead?-95:0),[1,1,1],e.angle);
 const hide=flash?[.73,.40,.46,1]:e.form===2?[.32,.13,.25,1]:[.18,.27,.34,1];
 item('disc',world(e.x,e.y,2.4),[104,1,88],[.005,.015,.03,.32]);
 // Massive plated shoulders and horned head rise out of the water.
 local(group,'sphere',[-10,38,0],[65,68,57],hide);
 local(group,'sphere',[0,98,0],[45,61,64],hide);
 local(group,'sphere',[20,139,0],[32,39,36],hide);
 local(group,'sphere',[40,127,0],[27,16,26],[.12,.15,.21,1]);
 for(const z of [-26,26]){
  local(group,'sphere',[43,145,z],[5,3,5],[1,.40,.32,1],0,1.2);
  draw('cone',multiply(group,segmentMatrix([-3,154,z],[-30,210,z*1.7],12)),C.bone);
 }
 for(let i=0;i<5;i++){const x=-46+i*9;local(group,'cone',[x,82+(4-i)*13,0],[13,48,13],C.bone);}
 for(const side of [-1,1]){
  let shoulder=[-3,100,side*60],elbow=[47,65,side*112],hand=[115,27,side*100];
  const sweep=b.effects.find(f=>f.type==='sweep');
  if(e.attack&&side===-1){const p=e.attack.age/e.attack.duration;elbow=[50,120+p*20,-103];hand=[138,135+p*25,-83];}
  if(sweep&&side===-1){const a=-1.12+2.24*(sweep.age/sweep.life);elbow=[Math.cos(a)*145,35,Math.sin(a)*145];hand=[Math.cos(a)*255,18,Math.sin(a)*255];}
  local(group,'sphere',shoulder,[32,36,32],hide);limb(group,shoulder,elbow,22,hide);local(group,'sphere',elbow,[23,23,23],hide);limb(group,elbow,hand,16,hide);local(group,'sphere',hand,[22,13,22],hide);
  for(let i=-1;i<=1;i++){const start=[hand[0]+9,hand[1]+3,hand[2]+i*11],end=[hand[0]+38,Math.max(4,hand[1]-14),hand[2]+i*16];draw('cone',multiply(group,segmentMatrix(start,end,5)),C.bone);}
 }
 if(root){for(let i=0;i<8;i++){const a=i*TAU/8,x=e.x+Math.cos(a)*92,y=e.y+Math.sin(a)*78;const rise=Math.min(1,(10-(e.rootUntil-b.time))*3+.1);item('cone',world(x,y,56*rise),[9,118*rise,9],[.31,.035,.15,1],0,.1);item('cone',world(x,y,58*rise),[4,128*rise,4],[.92,.28,.52,1],0,.5);line(world(x,y,45*rise),world(e.x,e.y,32),1.1,[.84,.26,.49,.6]);}}
 // Telegraphs: dashed outline, a fill that grows toward the strike moment, and fixed cracks seeded by the attack.
 const dashed=(x0,y0,x1,y1,n,col)=>{for(let k=0;k<n;k+=2){const t0=k/n,t1=(k+1)/n;line(world(x0+(x1-x0)*t0,y0+(y1-y0)*t0,5.2),world(x0+(x1-x0)*t1,y0+(y1-y0)*t1,5.2),2.1,col,.6)}};
 const cracks=(a,from,to,count,p)=>{let seed=Math.abs(Math.floor(a.x*13+a.y*7+a.angle*1000))%2147483646+1;const rnd=()=>(seed=seed*16807%2147483647)/2147483647;for(let c=0;c<count;c++){let t=from+(to-from)*(c+.3+rnd()*.4)/count,r=a.range*(.12+rnd()*.12),x=a.x+Math.cos(t)*r,y=a.y+Math.sin(t)*r;for(let k=0;k<6;k++){const r2=r+a.range*(.1+rnd()*.07),t2=t+(rnd()-.5)*.22,x2=a.x+Math.cos(t2)*Math.min(r2,a.range*.95),y2=a.y+Math.sin(t2)*Math.min(r2,a.range*.95);if(k/6<=p*1.4+.15)line(world(x,y,4.9),world(x2,y2,4.9),1.5-k*.12,[.09,.01,.03,.9],0);x=x2;y=y2;r=r2;t=t2;if(r>=a.range*.95)break}}};
 if(e.attack?.type==='slam'){const a=e.attack,p=a.age/a.duration,edge=[1,.36,.42,1];item('disc',world(a.x,a.y,4.3),[a.range,1,a.range],[.82,.03,.1,.34+p*.15],0,.5);item('disc',world(a.x,a.y,4.6),[Math.max(4,a.range*p),1,Math.max(4,a.range*p)],[1,.12,.18,.4],0,.7);for(let k=0;k<48;k+=2){const t0=k/48*TAU,t1=(k+1)/48*TAU;line(world(a.x+Math.cos(t0)*a.range,a.y+Math.sin(t0)*a.range,5.2),world(a.x+Math.cos(t1)*a.range,a.y+Math.sin(t1)*a.range,5.2),2.1,edge,.6)}cracks({...a,angle:0},0,TAU,7,p);item('sphere',world(a.x,a.y,40+(1-p)*160),[20,30,20],[.85,.2,.4,1],0,.6);line(world(e.x,e.y,90),world(a.x,a.y,40+(1-p)*160),2.4,[.84,.26,.49,.7],.5);}
 else if(e.attack){const a=e.attack,p=a.age/a.duration,edge=[1,.36,.42,1];item('sector',world(a.x,a.y,4.3),[a.range,1,a.range],[.82,.03,.1,.42+p*.15],a.angle,.5);item('sector',world(a.x,a.y,4.6),[Math.max(4,a.range*p),1,Math.max(4,a.range*p)],[1,.12,.18,.42],a.angle,.7);for(const angle of [a.angle-a.arc,a.angle+a.arc])dashed(a.x,a.y,a.x+Math.cos(angle)*a.range,a.y+Math.sin(angle)*a.range,13,edge);for(let i=0;i<40;i+=2){const t=a.angle-a.arc+i*a.arc*2/40,t2=t+a.arc*2/40;line(world(a.x+Math.cos(t)*a.range,a.y+Math.sin(t)*a.range,5.2),world(a.x+Math.cos(t2)*a.range,a.y+Math.sin(t2)*a.range,5.2),2.1,edge,.6);}cracks(a,a.angle-a.arc,a.angle+a.arc,5,p);}
 const guard=b.ship('guard');if(guard.hp>0&&b.time<b.guardUntil){ring(guard.x,guard.y,235,[.42,.70,1,.8],5);item('disc',world(guard.x,guard.y,3.3),[235,1,235],[.25,.50,.9,.09],0,.3);for(const s of b.ships.filter(s=>b.protected(s)))ring(s.x,s.y,56,[.59,.83,1,.85],7);}
 for(const p of b.shots){const t=clamp(p.age/p.duration,0,1),x=p.from.x+(p.to.x-p.from.x)*t,y=p.from.y+(p.to.y-p.from.y)*t,a=Math.atan2(p.to.y-p.from.y,p.to.x-p.from.x);line(world(x-Math.cos(a)*34,y-Math.sin(a)*34,27),world(x,y,27),2,[.73,.96,.88,1],.5);line(world(x-Math.cos(a)*70,y-Math.sin(a)*70,27),world(x,y,27),1,[.35,.94,.8,.35],.7);}
 for(const f of b.effects){const p=f.age/f.life;if(f.type==='impact'){for(let i=0;i<8;i++){const a=i*TAU/8,r=(f.size||50)*p;line(world(f.x+Math.cos(a)*r*.5,f.y+Math.sin(a)*r*.5,15+20*p),world(f.x+Math.cos(a)*r,f.y+Math.sin(a)*r,20+35*p),1.8,[1,.65,.35,1-p],1);}ring(f.x,f.y,8+p*(f.size||50),[1,.67,.45,1-p],9);}else if(f.type==='shield')ring(f.x,f.y,48+p*30,[.5,.8,1,1-p],20);else if(f.type==='sweep'){const a=f.angle-f.arc+2*f.arc*p;line(world(f.x,f.y,16),world(f.x+Math.cos(a)*f.range,f.y+Math.sin(a)*f.range,16),4,[1,.60,.60,1-p],1);}else if(f.type==='slam'){ring(f.x,f.y,f.radius*(.6+p*.7),[1,.45,.55,1-p],8);item('disc',world(f.x,f.y,4.6),[f.radius*(1+p*.3),1,f.radius*(1+p*.3)],[.9,.15,.3,(1-p)*.45],0,.8);}else if(f.type==='tentacle'){line(world(e.x,e.y,65),world(f.x,f.y,16),2,[.8,.25,.50,1-p],.6);}}
 return {solid,transparent};
}
export function bloodTexture(b,size=96){const pixels=new Uint8Array(size*size*4);for(let j=0;j<size;j++)for(let i=0;i<size;i++){const v=Math.round(b.concentration({x:(i+.5)/size*1000,y:(j+.5)/size*650})*255),k=(j*size+i)*4;pixels[k]=v;pixels[k+1]=0;pixels[k+2]=0;pixels[k+3]=255;}return pixels}
