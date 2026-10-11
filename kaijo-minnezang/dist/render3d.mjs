import {meshes,normalMatrix,cameraState,shipCamera,project,groundPoint,world,clamp} from './space3d.mjs';
import {vertexShader,fragmentShader} from './shaders3d.mjs';
import {buildScene,bloodTexture} from './scene3d.mjs';
import {FLAGSHIP} from './battle.mjs';
const VIEW_PITCH={rear:.32,first:-.08,overview:0};
export class SeaRenderer {
 constructor(canvas,{reducedMotion=false}={}){
  this.canvas=canvas;this.reducedMotion=reducedMotion;this.view='rear';this.flagship=FLAGSHIP;this.heading=null;this.lookYaw=0;this.pitch=VIEW_PITCH.rear;this.lastFrame=0;this.yaw=.12;this.elevation=.82;this.zoom=1;this.drag=null;this.dragged=false;this.bloodTime=-1;this.lastBattle=null;this.lost=false;
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
  canvas.addEventListener('pointermove',e=>{if(!this.pointers.has(e.pointerId)||!this.drag)return;this.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(this.pointers.size>1){const d=this.pinchDistance();if(this.pinch>0&&d>0)this.zoom=clamp(this.zoom*this.pinch/d,.65,1.7);this.pinch=d;this.dragged=true;return}const dx=e.clientX-this.drag.x,dy=e.clientY-this.drag.y;if(Math.hypot(e.clientX-this.drag.startX,e.clientY-this.drag.startY)>5)this.dragged=true;if(this.dragged){if(this.view==='overview'){this.yaw-=dx*.006;this.elevation=clamp(this.elevation+dy*.004,.48,1.38);}else{this.lookYaw=clamp(this.lookYaw+dx*.005,-Math.PI,Math.PI);this.pitch=this.view==='first'?clamp(this.pitch-dy*.004,-.7,.45):clamp(this.pitch+dy*.004,.08,1.2);}}this.drag.x=e.clientX;this.drag.y=e.clientY;});
  const end=e=>{this.pointers.delete(e.pointerId);this.drag=null;this.pinch=0;};canvas.addEventListener('pointerup',end);canvas.addEventListener('pointercancel',end);
  canvas.addEventListener('wheel',e=>{e.preventDefault();this.zoom=clamp(this.zoom*Math.exp(e.deltaY*.001),.65,1.7)},{passive:false});
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();this.lost=true;canvas.dispatchEvent(new Event('renderlost'));});
 }
 pinchDistance(){const p=[...this.pointers.values()];return p.length>1?Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y):0}
 resetCamera(){this.yaw=.12;this.elevation=.82;this.zoom=1;this.lookYaw=0;this.pitch=VIEW_PITCH[this.view]??0}
 setView(view){this.view=VIEW_PITCH[view]===undefined?'rear':view;this.resetCamera();this.heading=null}
 followed(b){const f=b.ship(this.flagship);return f&&f.hp>0?f:b.ships.find(s=>s.hp>0)||f}
 // The camera turns with the flagship, eased so sharp course changes do not snap the view.
 follow(b){const s=this.followed(b),now=performance.now(),dt=this.lastFrame?Math.min(.1,(now-this.lastFrame)/1000):0;this.lastFrame=now;if(!s)return;if(this.heading===null||this.reducedMotion)this.heading=s.angle;else{const d=Math.atan2(Math.sin(s.angle-this.heading),Math.cos(s.angle-this.heading));this.heading+=d*Math.min(1,dt*2.5)}}
 zoomBy(f){this.zoom=clamp(this.zoom*f,.65,1.7)}
 point(event){if(this.dragged){this.dragged=false;return null}const r=this.canvas.getBoundingClientRect();this.updateCamera();const p=groundPoint(this.camera.inv,event.clientX-r.left,event.clientY-r.top,r.width,r.height);return p&&p.x>=0&&p.x<=1000&&p.y>=0&&p.y<=650?p:null}
 pickShip(event,b){if(!this.camera)return null;const r=this.canvas.getBoundingClientRect(),x=event.clientX-r.left,y=event.clientY-r.top;let closest=null,d=52;for(const s of b.ships){const p=project(this.camera.vp,world(s.x,s.y,30),r.width,r.height);if(!p)continue;const n=Math.hypot(p.x-x,p.y-y);if(n<d){closest=s;d=n}}return closest}
 updateCamera(b=this.lastBattle){const aspect=this.canvas.clientWidth/this.canvas.clientHeight,s=b&&this.view!=='overview'?this.followed(b):null;this.camera=s?shipCamera(aspect,this.view,s,(this.heading??s.angle)+this.lookYaw,this.pitch,this.zoom):cameraState(aspect,this.yaw,this.elevation,this.zoom)}
 render(b,selected,showRange){
  if(this.lost)return;const gl=this.gl,w=this.canvas.clientWidth,h=this.canvas.clientHeight;if(!w||!h)return;const dpr=Math.min(globalThis.devicePixelRatio||1,1.7);
  if(this.canvas.width!==Math.round(w*dpr)||this.canvas.height!==Math.round(h*dpr)){this.canvas.width=Math.round(w*dpr);this.canvas.height=Math.round(h*dpr);this.overlay.width=this.canvas.width;this.overlay.height=this.canvas.height;}
  this.follow(b);this.updateCamera(b);gl.viewport(0,0,this.canvas.width,this.canvas.height);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(this.program);const u=this.locations;gl.uniformMatrix4fv(u.uVP,false,this.camera.vp);gl.uniform3fv(u.uEye,this.camera.eye);gl.uniform1f(u.uTime,b.time);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.texture);
  if(this.lastBattle!==b||Math.abs(b.time-this.bloodTime)>.25){gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,96,96,0,gl.RGBA,gl.UNSIGNED_BYTE,bloodTexture(b));this.bloodTime=b.time;this.lastBattle=b;}
  const scene=buildScene(b,selected,showRange,performance.now()/1000);gl.disable(gl.BLEND);gl.depthMask(true);for(const obj of scene.solid)this.draw(obj);
  gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);
  const eye=this.camera.eye;scene.transparent.sort((a,z)=>{const dist=o=>Math.hypot(o.model[12]-eye[0],o.model[13]-eye[1],o.model[14]-eye[2]);return dist(z)-dist(a)});for(const obj of scene.transparent)this.draw(obj);gl.depthMask(true);
  this.labels(b,selected,w,h,dpr);
 }
 draw(obj){const gl=this.gl,u=this.locations,buf=this.buffers[obj.mesh];gl.bindBuffer(gl.ARRAY_BUFFER,buf.position);gl.enableVertexAttribArray(u.aPosition);gl.vertexAttribPointer(u.aPosition,3,gl.FLOAT,false,0,0);gl.bindBuffer(gl.ARRAY_BUFFER,buf.normal);gl.enableVertexAttribArray(u.aNormal);gl.vertexAttribPointer(u.aNormal,3,gl.FLOAT,false,0,0);gl.uniformMatrix4fv(u.uModel,false,obj.model);gl.uniformMatrix3fv(u.uNormal,false,normalMatrix(obj.model));gl.uniform4fv(u.uColor,obj.color);gl.uniform1f(u.uGlow,obj.glow);gl.uniform1f(u.uWater,obj.water);gl.drawArrays(gl.TRIANGLES,0,buf.count);}
 labels(b,selected,w,h,dpr){const c=this.ctx;c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,w,h);c.textAlign='center';c.textBaseline='middle';const at=(x,y,z)=>project(this.camera.vp,world(x,y,z),w,h);
  const pill=(text,p,color,size=12)=>{if(!p||p.depth>1||p.x<-100||p.x>w+100||p.y<0||p.y>h)return;c.font=`500 ${size}px system-ui,sans-serif`;const bw=c.measureText(text).width+18;c.fillStyle='#06121dea';c.fillRect(p.x-bw/2,p.y-12,bw,24);c.fillStyle=color;c.fillText(text,p.x,p.y);};
  for(const s of b.ships){if(this.view==='first'&&s===this.followed(b))continue;const p=at(s.x,s.y,113);if(!p||p.depth>1)continue;p.x=clamp(p.x,65,w-65);p.y=clamp(p.y,45,h-40);pill(`${s.name} · 血${Math.floor(s.blood)}`,p,s.hp>0?s.color:'#9ba2a7',selected===s.id?13:11);c.fillStyle='#112632';c.fillRect(p.x-42,p.y+14,84,4);c.fillStyle=s.hp/s.maxHp<.3?'#f77d99':s.color;c.fillRect(p.x-42,p.y+14,84*s.hp/s.maxHp,4);if(b.protected(s))pill('防護 · 押し戻し無効',{x:p.x,y:p.y+35,depth:0},'#aed6ff',10);}
  const e=b.enemy;const ep=at(e.x,e.y,240);pill(e.hp<=0?'ネフェリム撃破':e.form===2?'ネフェリム · 第二形態':'ネフェリム',ep,'#f2b0bf',13);
  if(e.rootUntil>b.time)pill(`血海拘束 ${(e.rootUntil-b.time).toFixed(1)}s`,at(e.x,e.y,212),'#f3a4cd',11);
  if(e.attack)pill(`${e.attack.type==='slam'?'血潮の墜落':'薙ぎ払い'} ${(e.attack.duration-e.attack.age).toFixed(1)}s`,e.attack.type==='slam'?at(e.attack.x,e.attack.y+e.attack.range,10):at(e.x-100,e.y,10),'#ffb2bd',12);
  if(b.joust){const s=b.ship('lance');pill(`ジョスト · 速度${Math.round(b.joust.speed)}`,at(s.x,s.y,142),'#ffe0a0',12);}
  for(const f of b.effects.filter(f=>f.type==='label')){c.globalAlpha=Math.min(1,(1-f.age/f.life)*2);pill(f.text,at(f.x,f.y,70+f.age*24),f.color,13);}c.globalAlpha=1;
  const rally=b.pending==='rally'?b.pendingRally:b.order==='rally'?b.rally:null;if(rally)pill('集合地点',at(rally.x,rally.y,15),'#f4dc9b',11);
  const entry=b.joust?.entry||b.entry;if(entry&&(b.joust||b.pendingSkills.includes('lance')))pill('助走点',at(entry.x,entry.y,15),'#f4dc9b',11);
 }
}
