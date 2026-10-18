import {meshes,normalMatrix,cameraState,cameraFrom,shipCamera,project,groundPoint,world,clamp} from './space3d.mjs';
import {vertexShader,fragmentShader} from './shaders3d.mjs';
import {buildScene,bloodTexture,shipPose} from './scene3d.mjs';
import {FLAGSHIP,swarmAlive,SWARM,fullName} from './battle.mjs';
import {buildMapScene,mapWorld,mapFromGround,shipMaxHp,FLEET_COLOR} from './mapscene3d.mjs';
import {MAP,LAMP} from './strategy.mjs';
// 戦略マップで、艦隊の目印に出す二頭身の立ち絵（騎士ごと。艦隊にいる騎士のうち、この並びで先の者を出す）。
const CHIBIS=typeof Image==='undefined'?[]:[['lance','./art/chibi-miralka.png'],['stake','./art/chibi-kanaan.png']].map(([type,src])=>({type,img:Object.assign(new Image(),{src})}));
const VIEW_PITCH={rear:.32,first:-.08,overview:0};
export class SeaRenderer {
 constructor(canvas,{reducedMotion=false}={}){
  this.canvas=canvas;this.reducedMotion=reducedMotion;this.view='rear';this.flagship=FLAGSHIP;this.heading=null;this.lookYaw=0;this.pitch=VIEW_PITCH.rear;this.lastFrame=0;this.yaw=.12;this.elevation=.82;this.zoom=1;this.drag=null;this.dragged=false;this.bloodTime=-1;this.lastBattle=null;this.dirFor=null;this.openT=0;this.push=0;this.dir=null;this.lost=false;this.map=false;this.mapZoom=1;this.mapAt=[0,0];
  this.overlay=document.querySelector('#seaLabels');this.ctx=this.overlay.getContext('2d');
  const gl=canvas.getContext('webgl',{antialias:true,alpha:false,powerPreference:'high-performance'});if(!gl)throw new Error('3D表示にはWebGLが必要です。ブラウザのグラフィックアクセラレーションを有効にして再読み込みしてください。');this.gl=gl;
  const shader=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s};
  this.program=gl.createProgram();gl.attachShader(this.program,shader(gl.VERTEX_SHADER,vertexShader));gl.attachShader(this.program,shader(gl.FRAGMENT_SHADER,fragmentShader));gl.linkProgram(this.program);if(!gl.getProgramParameter(this.program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(this.program));gl.useProgram(this.program);
  this.locations={};for(const n of ['uModel','uVP','uNormal','uColor','uEye','uTime','uWater','uGlow','uBlood'])this.locations[n]=gl.getUniformLocation(this.program,n);for(const n of ['aPosition','aNormal'])this.locations[n]=gl.getAttribLocation(this.program,n);
  this.buffers={};for(const [name,g] of Object.entries(meshes)){const make=data=>{const buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data),gl.STATIC_DRAW);return buf};this.buffers[name]={position:make(g.vertices),normal:make(g.normals),count:g.vertices.length/3};}
  this.texture=gl.createTexture();gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.texture);for(const p of [gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER])gl.texParameteri(gl.TEXTURE_2D,p,gl.LINEAR);for(const p of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T])gl.texParameteri(gl.TEXTURE_2D,p,gl.CLAMP_TO_EDGE);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([0,0,0,255]));gl.uniform1i(this.locations.uBlood,0);
  gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.disable(gl.CULL_FACE);gl.clearColor(.035,.09,.13,1);
  this.pointers=new Map();
  canvas.addEventListener('contextmenu',e=>e.preventDefault());
  canvas.addEventListener('pointerdown',e=>{this.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});this.drag={x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY};this.dragged=false;canvas.setPointerCapture?.(e.pointerId);this.pinch=this.pinchDistance();});
  canvas.addEventListener('pointermove',e=>{if(!this.pointers.has(e.pointerId)||!this.drag)return;this.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(this.pointers.size>1){const d=this.pinchDistance();if(this.pinch>0&&d>0)this.zoomBy(this.pinch/d);this.pinch=d;this.dragged=true;return}const dx=e.clientX-this.drag.x,dy=e.clientY-this.drag.y;if(Math.hypot(e.clientX-this.drag.startX,e.clientY-this.drag.startY)>5)this.dragged=true;if(this.dragged){if(this.map)this.panMap(this.drag.x,this.drag.y,e.clientX,e.clientY);else if(this.view==='overview'){this.yaw-=dx*.006;this.elevation=clamp(this.elevation+dy*.004,.48,1.38);}else{this.lookYaw=clamp(this.lookYaw+dx*.005,-Math.PI,Math.PI);this.pitch=this.view==='first'?clamp(this.pitch-dy*.004,-.7,.45):clamp(this.pitch+dy*.004,.08,1.2);}}this.drag.x=e.clientX;this.drag.y=e.clientY;});
  const end=e=>{this.pointers.delete(e.pointerId);this.drag=null;this.pinch=0;};canvas.addEventListener('pointerup',end);canvas.addEventListener('pointercancel',end);
  canvas.addEventListener('wheel',e=>{e.preventDefault();this.zoomBy(Math.exp(e.deltaY*.001))},{passive:false});
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();this.lost=true;canvas.dispatchEvent(new Event('renderlost'));});
 }
 pinchDistance(){const p=[...this.pointers.values()];return p.length>1?Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y):0}
 resetCamera(){if(this.map){this.mapZoom=1;this.mapAt=[0,0];return}this.yaw=.12;this.elevation=.82;this.zoom=1;this.lookYaw=0;this.pitch=VIEW_PITCH[this.view]??0}
 setView(view){this.view=VIEW_PITCH[view]===undefined?'rear':view;this.resetCamera();this.heading=null}
 followed(b){const f=b.ship(this.flagship);return f&&f.hp>0?f:b.ships.find(s=>s.hp>0)||f}
 // The camera turns with the flagship, eased so sharp course changes do not snap the view.
 follow(b){const s=this.followed(b),now=performance.now(),dt=this.lastFrame?Math.min(.1,(now-this.lastFrame)/1000):0;this.lastFrame=now;this.direct(b,dt);if(!s)return;if(this.heading===null||this.reducedMotion)this.heading=s.angle;else{const d=Math.atan2(Math.sin(s.angle-this.heading),Math.cos(s.angle-this.heading));this.heading+=d*Math.min(1,dt*2.5)}}
 // 観戦のカメラワーク。開戦の約1.5秒は戦場全体の引き→旗艦の後方へ戻る。連携・ジョストの射出・撃破では寄る（動きを減らす設定では寄らない）。俯瞰の視点では控えめ。戦略マップと準備画面（mode=ready）には影響しない。
 direct(b,dt){if(this.dirFor!==b){this.dirFor=b;this.openT=0;this.push=0}this.dir=null;if(b.mode==='ready')return;if(b.mode==='running'&&b.time<20)this.openT+=dt;const over=this.view==='overview',lance=b.ship('lance'),lunge=lance?.lunge,big=b.effects.find(f=>f.type==='impact'&&f.size>=75&&f.age>=0);
  const open=over||b.time>3?0:this.reducedMotion?(this.openT<2?1:0):this.openT<1.5?1:Math.max(0,1-(this.openT-1.5)/.9);
  let tp=0;if(!this.reducedMotion){if(b.timing)tp=.45;if(lunge)tp=Math.max(tp,lunge.age<.15?lunge.age/.15:lunge.age<.7?1:Math.max(0,(.95-lunge.age)/.25));if(big)tp=Math.max(tp,.8*(1-big.age/big.life));if(b.mode==='ended'&&b.decided==='kill')tp=.8*Math.min(1,b.after/.6)}
  this.push+=(tp*(over?.35:1)-this.push)*Math.min(1,dt*(tp>this.push?9:3));const e=b.enemy,f=lance&&lance.hp>0?lance:b.flag();this.dir={open,push:this.push,focus:world((f.x+e.x)/2,(f.y+e.y)/2,40)}}

 zoomBy(f){if(this.map)this.mapZoom=clamp(this.mapZoom*f,.35,1.25);else this.zoom=clamp(this.zoom*f,.65,1.7)}
 point(event){if(this.dragged){this.dragged=false;return null}const r=this.canvas.getBoundingClientRect();this.updateCamera();const p=groundPoint(this.camera.inv,event.clientX-r.left,event.clientY-r.top,r.width,r.height);return p&&p.x>=0&&p.x<=1000&&p.y>=0&&p.y<=650?p:null}
 pickShip(event,b){if(!this.camera)return null;const r=this.canvas.getBoundingClientRect(),x=event.clientX-r.left,y=event.clientY-r.top;let closest=null,d=52;for(const s of b.ships){const p=project(this.camera.vp,world(s.x,s.y,30),r.width,r.height);if(!p)continue;const n=Math.hypot(p.x-x,p.y-y);if(n<d){closest=s;d=n}}return closest}
 updateCamera(b=this.lastBattle){const aspect=this.canvas.clientWidth/this.canvas.clientHeight,s=b&&this.view!=='overview'?this.followed(b):null;let c=s?shipCamera(aspect,this.view,s,(this.heading??s.angle)+this.lookYaw,this.pitch,this.zoom):cameraState(aspect,this.yaw,this.elevation,this.zoom);const d=b&&this.dirFor===b?this.dir:null;
  if(d&&(d.open>.001||d.push>.001)){const mix=(a,z,k)=>a.map((v,i)=>v+(z[i]-v)*k);let eye=c.eye,tg=c.target,fov=c.fov;if(d.open>.001){const w=cameraState(aspect,.5,.62,1);eye=mix(eye,w.eye,d.open);tg=mix(tg,w.target,d.open);fov+=(w.fov-fov)*d.open}if(d.push>.001){tg=mix(tg,d.focus,d.push*.6);eye=mix(eye,tg,d.push*.2)}c=cameraFrom(aspect,eye,tg,fov,c.near)}
  this.camera=c}
 render(b,selected,showRange){
  this.map=false;if(this.lost)return;const gl=this.gl,w=this.canvas.clientWidth,h=this.canvas.clientHeight;if(!w||!h)return;const dpr=Math.min(globalThis.devicePixelRatio||1,1.7);
  if(this.canvas.width!==Math.round(w*dpr)||this.canvas.height!==Math.round(h*dpr)){this.canvas.width=Math.round(w*dpr);this.canvas.height=Math.round(h*dpr);this.overlay.width=this.canvas.width;this.overlay.height=this.canvas.height;}
  this.follow(b);this.updateCamera(b);gl.viewport(0,0,this.canvas.width,this.canvas.height);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(this.program);const u=this.locations;gl.uniformMatrix4fv(u.uVP,false,this.camera.vp);gl.uniform3fv(u.uEye,this.camera.eye);gl.uniform1f(u.uTime,b.time);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.texture);
  if(this.lastBattle!==b||Math.abs(b.time-this.bloodTime)>.25){gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,96,96,0,gl.RGBA,gl.UNSIGNED_BYTE,bloodTexture(b));this.bloodTime=b.time;this.lastBattle=b;}
  const scene=buildScene(b,selected,showRange);gl.disable(gl.BLEND);gl.depthMask(true);for(const obj of scene.solid)this.draw(obj);
  gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);
  const eye=this.camera.eye;scene.transparent.sort((a,z)=>{const dist=o=>Math.hypot(o.model[12]-eye[0],o.model[13]-eye[1],o.model[14]-eye[2]);return dist(z)-dist(a)});for(const obj of scene.transparent)this.draw(obj);gl.depthMask(true);
  this.labels(b,selected,w,h,dpr);
 }
 draw(obj){const gl=this.gl,u=this.locations,buf=this.buffers[obj.mesh];gl.bindBuffer(gl.ARRAY_BUFFER,buf.position);gl.enableVertexAttribArray(u.aPosition);gl.vertexAttribPointer(u.aPosition,3,gl.FLOAT,false,0,0);gl.bindBuffer(gl.ARRAY_BUFFER,buf.normal);gl.enableVertexAttribArray(u.aNormal);gl.vertexAttribPointer(u.aNormal,3,gl.FLOAT,false,0,0);gl.uniformMatrix4fv(u.uModel,false,obj.model);gl.uniformMatrix3fv(u.uNormal,false,normalMatrix(obj.model));gl.uniform4fv(u.uColor,obj.color);gl.uniform1f(u.uGlow,obj.glow);gl.uniform1f(u.uWater,obj.water);gl.drawArrays(gl.TRIANGLES,0,buf.count);}
 labels(b,selected,w,h,dpr){const c=this.ctx;c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,w,h);c.textAlign='center';c.textBaseline='middle';const at=(x,y,z)=>project(this.camera.vp,world(x,y,z),w,h);
  // 頭上の体力バー（金の細縁・残り3割で赤）。
  const bar=(x,y,bw,r,col)=>{r=clamp(r,0,1);c.fillStyle='#0a0612e8';c.fillRect(x-bw/2-1,y-2,bw+2,7);c.fillStyle=r<.3?'#f77d99':col;c.fillRect(x-bw/2,y-1,bw*r,5);c.strokeStyle='#e2c07a99';c.lineWidth=1;c.strokeRect(x-bw/2-.5,y-2.5,bw+1,6)};
  const pill=(text,p,color,size=12)=>{if(!p||p.depth>1||p.x<-100||p.x>w+100||p.y<0||p.y>h)return;c.font=`500 ${size}px system-ui,sans-serif`;const bw=c.measureText(text).width+18;c.fillStyle='#06121dea';c.fillRect(p.x-bw/2,p.y-12,bw,24);c.fillStyle=color;c.fillText(text,p.x,p.y);};
  for(const s of b.ships){if(this.view==='first'&&s===this.followed(b))continue;const po=shipPose(b,s),p=at(po.x,po.y,113);if(!p||p.depth>1)continue;p.x=clamp(p.x,65,w-65);p.y=clamp(p.y,45,h-40);pill(`${fullName(s)} · 血${Math.floor(s.blood)}`,p,s.hp>0?s.color:'#9ba2a7',selected===s.id?13:11);bar(p.x,p.y+15,84,s.hp/s.maxHp,s.color);if(s.bash||s.barrage)pill(s.bash?'バッシュ！':'バラージ！',{x:p.x,y:p.y+35,depth:0},s.bash?'#aed6ff':'#f0b27c',10);}
  const e=b.enemy,kin=b.enemyKind==='kin',ep=at(e.x,e.y,kin?96:240);pill(e.hp<=0?`${b.enemyName}撃破`:kin?`${b.enemyName} ×${swarmAlive(e)}/${SWARM}`:e.form===2?`${b.enemyName} · 第二形態`:b.enemyName,ep,'#f2b0bf',13);if(ep&&ep.depth<=1&&e.hp>0)bar(ep.x,ep.y+15,kin?96:130,e.hp/e.maxHp,'#e8708f');
  if(e.rootUntil>b.time)pill(`血海拘束 ${(e.rootUntil-b.time).toFixed(1)}s`,at(e.x,e.y,212),'#f3a4cd',11);
  if(e.attack)pill(`${e.attack.type==='slam'?'血潮の墜落':'薙ぎ払い'} ${(e.attack.duration-e.attack.age).toFixed(1)}s`,e.attack.type==='slam'?at(e.attack.x,e.attack.y+e.attack.range,10):at(e.x-100,e.y,10),'#ffb2bd',12);
  if(b.joust){const s=b.ship('lance');pill(`ジョスト · 速度${Math.round(b.joust.speed)}`,at(s.x,s.y,142),'#ffe0a0',12);}
  for(const f of b.effects.filter(f=>f.type==='label')){c.globalAlpha=Math.min(1,(1-f.age/f.life)*2);pill(f.text,at(f.x,f.y,70+f.age*24),f.color,13);}c.globalAlpha=1;
  const rally=b.pending==='rally'?b.pendingRally:b.order==='rally'?b.rally:null;if(rally)pill('集合地点',at(rally.x,rally.y,15),'#f4dc9b',11);
  const entry=b.joust?.entry||b.entry;if(entry&&(b.joust||b.pendingSkills.includes('lance')))pill('助走点',at(entry.x,entry.y,15),'#f4dc9b',11);
 }

 // ---- 戦略マップ ----
 // 俯瞰カメラ。海域全体が収まる距離が zoom=1。パンは mapAt（3D空間の注視点）で持つ。
 updateMapCamera(){const aspect=this.canvas.clientWidth/this.canvas.clientHeight,el=1.05,d=1150*this.mapZoom*Math.max(1,1.4/aspect),[x,z]=this.mapAt;this.camera=cameraFrom(aspect,[x,Math.sin(el)*d,z+Math.cos(el)*d],[x,0,z])}
 // ドラッグの前後の画面座標が指す海面の差だけ注視点を動かす（つかんだ海面が指に付いてくる）。
 panMap(x0,y0,x1,y1){if(!this.camera)return;const r=this.canvas.getBoundingClientRect(),a=groundPoint(this.camera.inv,x0-r.left,y0-r.top,r.width,r.height),b=groundPoint(this.camera.inv,x1-r.left,y1-r.top,r.width,r.height);if(!a||!b)return;const lim=[MAP.w*.16,MAP.h*.16];this.mapAt=[clamp(this.mapAt[0]+a.x-b.x,-lim[0],lim[0]),clamp(this.mapAt[1]+a.y-b.y,-lim[1],lim[1])];this.updateMapCamera()}
 // クリック位置を戦略マップの座標と、近くの艦隊・敵（画面上の距離）にする。ドラッグ直後のクリックは無視。
 mapClick(event,st){if(this.dragged){this.dragged=false;return null}if(!this.camera||!this.map)return null;const r=this.canvas.getBoundingClientRect(),x=event.clientX-r.left,y=event.clientY-r.top,out={fleet:null,enemy:null,point:null};
  // 当たり判定：モデルの海面・中ほど・上端の3点を投影して近い方を取り、半径は海面での半径（艦隊72・ネフェリム60・眷属40）を画面に映した大きさ（下限つき）。艦隊 > 敵 > 海面の順に優先。
  const px=(o,len)=>{const a=project(this.camera.vp,mapWorld(o.x,o.y,0),r.width,r.height),b=project(this.camera.vp,mapWorld(o.x+len,o.y,0),r.width,r.height);return a&&b?Math.hypot(a.x-b.x,a.y-b.y):0};
  const hit=(list,top,len,min,key)=>{let best=null,bd=1e9;for(const o of list){const rad=Math.max(min,px(o,len(o))),hh=top(o);let d=1e9;for(const h of [0,hh/2,hh]){const p=project(this.camera.vp,mapWorld(o.x,o.y,h),r.width,r.height);if(p)d=Math.min(d,Math.hypot(p.x-x,p.y-y)/rad)}if(d<=1&&d<bd){bd=d;best=o}}if(best)out[key]=best;return best};
  const ch=(this.chibiHit||[]).find(c=>x>=c.x&&x<=c.x+c.w&&y>=c.y&&y<=c.y+c.h);if(ch){out.fleet=st.fleets.find(f=>f.id===ch.id)||null;if(out.fleet)return out}
  if(!hit(st.fleets,()=>45,()=>72,26,'fleet'))hit(st.enemies.filter(e=>e.active),e=>e.kind==='nephilim'?90:25,e=>e.kind==='nephilim'?60:40,24,'enemy');
  if(!out.fleet&&!out.enemy){const g=groundPoint(this.camera.inv,x,y,r.width,r.height);if(g){const p=mapFromGround(g);if(p.x>=0&&p.x<=MAP.w&&p.y>=0&&p.y<=MAP.h)out.point=p}}return out}
 renderMap(st,{selected=null}={}){
  this.map=true;if(this.lost)return;const gl=this.gl,w=this.canvas.clientWidth,h=this.canvas.clientHeight;if(!w||!h)return;const dpr=Math.min(globalThis.devicePixelRatio||1,1.7),now=performance.now()/1000;
  if(this.canvas.width!==Math.round(w*dpr)||this.canvas.height!==Math.round(h*dpr)){this.canvas.width=Math.round(w*dpr);this.canvas.height=Math.round(h*dpr);this.overlay.width=this.canvas.width;this.overlay.height=this.canvas.height}
  this.updateMapCamera();gl.viewport(0,0,this.canvas.width,this.canvas.height);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(this.program);const u=this.locations;gl.uniformMatrix4fv(u.uVP,false,this.camera.vp);gl.uniform3fv(u.uEye,this.camera.eye);gl.uniform1f(u.uTime,now);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.texture);
  if(this.lastBattle!==null){gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([0,0,0,255]));this.lastBattle=null}
  const scene=buildMapScene(st,{selected,now});gl.disable(gl.BLEND);gl.depthMask(true);for(const obj of scene.solid)this.draw(obj);
  gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);
  const eye=this.camera.eye;scene.transparent.sort((a,z)=>{const dist=o=>Math.hypot(o.model[12]-eye[0],o.model[13]-eye[1],o.model[14]-eye[2]);return dist(z)-dist(a)});for(const obj of scene.transparent)this.draw(obj);gl.depthMask(true);
  this.mapLabels(st,selected,w,h,dpr);
 }
 mapLabels(st,selected,w,h,dpr){const c=this.ctx;c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,w,h);c.textAlign='center';c.textBaseline='middle';
  const at=(o,z)=>project(this.camera.vp,mapWorld(o.x,o.y,z),w,h);
  const tag=(text,p,color,hp,size=12)=>{if(!p||p.x<-100||p.x>w+100||p.y<0||p.y>h)return;c.font=`500 ${size}px system-ui,sans-serif`;const bw=Math.max(c.measureText(text).width+16,70);c.fillStyle='#0c0814e8';c.fillRect(p.x-bw/2,p.y-11,bw,22+(hp===null?0:6));c.strokeStyle=color+'66';c.lineWidth=1;c.strokeRect(p.x-bw/2+.5,p.y-11+.5,bw-1,21+(hp===null?0:6));c.fillStyle=color;c.fillText(text,p.x,p.y);if(hp!==null){c.fillStyle='#000a';c.fillRect(p.x-bw/2+4,p.y+9,bw-8,3);c.fillStyle=hp<.3?'#f77d99':color;c.fillRect(p.x-bw/2+4,p.y+9,(bw-8)*hp,3)}};
  tag(LAMP.name,at(LAMP,95),'#f2d58f',null,12);
  // 騎士のいる艦隊の上に二頭身の立ち絵を出す（選択中は少し大きく、ゆっくり上下に揺れる。艦隊ごとに揺れをずらす）。クリック判定用に位置を覚えておく。
  this.chibiHit=[];st.fleets.forEach((f,i)=>{const ch0=CHIBIS.find(k=>f.ships.some(s=>s.type===k.type)),img=ch0?.img,p=at(f,70);if(!img?.complete||!img.naturalWidth||!p||p.x<-100||p.x>w+100||p.y<0||p.y>h)return;const ch=f.id===selected?76:64,cw=ch*img.naturalWidth/img.naturalHeight,y=p.y-14-ch+Math.sin(performance.now()/420+i*1.7)*2.5;c.drawImage(img,p.x-cw/2,y,cw,ch);this.chibiHit.push({x:p.x-cw/2,y,w:cw,h:ch,id:f.id})});
  for(const f of st.fleets){const hp=f.ships.reduce((n,s)=>n+Math.max(0,s.hp),0)/f.ships.reduce((n,s)=>n+shipMaxHp(s.type),0);tag(f.name,at(f,70),FLEET_COLOR[f.id]||'#d23a54',hp,f.id===selected?13:11)}
  for(const e of st.enemies){if(!e.active)continue;tag(`${e.name} ${Math.ceil(e.hp)}`,at(e,e.kind==='nephilim'?100:50),e.kind==='nephilim'?'#f2b0bf':'#c8a9b4',e.hp/e.maxHp,11)}
 }
}
