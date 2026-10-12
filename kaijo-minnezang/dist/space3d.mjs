// Column-major WebGL matrices. Tactical x/y map to world x/z; world y is height.
export const TAU=Math.PI*2;
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const add=(a,b)=>a.map((v,i)=>v+b[i]);
export const sub=(a,b)=>a.map((v,i)=>v-b[i]);
export const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
export const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export const unit=a=>{const l=Math.hypot(...a)||1;return a.map(x=>x/l)};
export function multiply(a,b){const o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)o[c*4+r]+=a[k*4+r]*b[c*4+k];return o}
export function transform(m,p){return [0,1,2,3].map(r=>m[r]*p[0]+m[4+r]*p[1]+m[8+r]*p[2]+m[12+r]*(p[3]??1))}
export function model(p=[0,0,0],s=[1,1,1],angle=0){const c=Math.cos(angle),n=Math.sin(angle);return new Float32Array([c*s[0],0,n*s[0],0,0,s[1],0,0,-n*s[2],0,c*s[2],0,...p,1])}
export function perspective(fov,aspect,near=5,far=4500){const f=1/Math.tan(fov/2),n=1/(near-far);return new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)*n,-1,0,0,2*far*near*n,0])}
export function lookAt(eye,target){const z=unit(sub(eye,target)),x=unit(cross([0,1,0],z)),y=cross(z,x);return new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1])}
export function inverse(m){const a=Array.from({length:4},(_,r)=>[...Array.from({length:4},(_,c)=>m[c*4+r]),...Array.from({length:4},(_,c)=>r===c?1:0)]);for(let c=0;c<4;c++){let k=c;for(let r=c+1;r<4;r++)if(Math.abs(a[r][c])>Math.abs(a[k][c]))k=r;if(Math.abs(a[k][c])<1e-10)return null;[a[c],a[k]]=[a[k],a[c]];const v=a[c][c];a[c]=a[c].map(x=>x/v);for(let r=0;r<4;r++)if(r!==c){const f=a[r][c];a[r]=a[r].map((x,i)=>x-f*a[c][i])}}return new Float32Array(Array.from({length:16},(_,i)=>a[i%4][4+Math.floor(i/4)]))}
export function cameraState(aspect,yaw=.12,elevation=.82,zoom=1){const d=1320*zoom/Math.min(1,aspect/1.3);return cameraFrom(aspect,[Math.sin(yaw)*Math.cos(elevation)*d,Math.sin(elevation)*d,Math.cos(yaw)*Math.cos(elevation)*d],[0,0,0])}
export function cameraFrom(aspect,eye,target,fov=.75,near=5){const view=lookAt(eye,target),projection=perspective(fov,aspect,near),vp=multiply(projection,view);return {eye,view,projection,vp,inv:inverse(vp),target,fov,near}}
// Flagship cameras. heading is the battle-plane angle the camera faces; pitch tilts it (rear: orbit height, first: look up/down).
export function shipCamera(aspect,view,ship,heading,pitch,zoom=1){const dx=Math.cos(heading),dz=Math.sin(heading),p=world(ship.x,ship.y);
 if(view==='first'){const c=Math.cos(ship.angle),n=Math.sin(ship.angle),eye=[p[0]+c*10,58,p[2]+n*10];return cameraFrom(aspect,eye,[eye[0]+dx*Math.cos(pitch)*100,eye[1]+Math.sin(pitch)*100,eye[2]+dz*Math.cos(pitch)*100],clamp(.95*zoom,.55,1.5),2)}
 const d=320*zoom/Math.sqrt(Math.min(1,aspect/1.3)),eye=[p[0]-dx*Math.cos(pitch)*d,40+Math.sin(pitch)*d,p[2]-dz*Math.cos(pitch)*d];return cameraFrom(aspect,eye,[p[0]+dx*180,30,p[2]+dz*180],.85)}
export const world=(x,y,h=0)=>[x-500,h,y-325];
export function project(vp,p,w,h){const q=transform(vp,p);if(q[3]<=0)return null;return {x:(q[0]/q[3]+1)*w/2,y:(1-q[1]/q[3])*h/2,depth:q[2]/q[3]}}
export function groundPoint(inv,x,y,w,h){const nx=x/w*2-1,ny=1-y/h*2,a=transform(inv,[nx,ny,-1,1]),b=transform(inv,[nx,ny,1,1]);for(let i=0;i<3;i++){a[i]/=a[3];b[i]/=b[3]}const dy=b[1]-a[1];if(Math.abs(dy)<1e-8)return null;const t=-a[1]/dy;if(t<0)return null;return {x:a[0]+(b[0]-a[0])*t+500,y:a[2]+(b[2]-a[2])*t+325}}
function geometry(){const vertices=[],normals=[];return {vertices,normals,tri(a,b,c){const n=unit(cross(sub(b,a),sub(c,a)));vertices.push(...a,...b,...c);normals.push(...n,...n,...n)},quad(a,b,c,d){this.tri(a,b,c);this.tri(a,c,d)}}}
export function box(){const g=geometry(),p=[[-.5,-.5,-.5],[.5,-.5,-.5],[.5,.5,-.5],[-.5,.5,-.5],[-.5,-.5,.5],[.5,-.5,.5],[.5,.5,.5],[-.5,.5,.5]];for(const f of [[0,3,2,1],[4,5,6,7],[0,4,7,3],[1,2,6,5],[3,7,6,2],[0,1,5,4]])g.quad(...f.map(i=>p[i]));return g}
export function cylinder(sides=12,top=1){const g=geometry();for(let i=0;i<sides;i++){const a=i*TAU/sides,b=(i+1)*TAU/sides,p=[Math.cos(a),-.5,Math.sin(a)],q=[Math.cos(b),-.5,Math.sin(b)],r=[Math.cos(b)*top,.5,Math.sin(b)*top],s=[Math.cos(a)*top,.5,Math.sin(a)*top];g.quad(p,s,r,q);g.tri([0,.5,0],r,s);g.tri([0,-.5,0],p,q)}return g}
export function sphere(rows=8,cols=12){const g=geometry(),p=(i,j)=>{const a=i*Math.PI/rows,b=j*TAU/cols;return [Math.sin(a)*Math.cos(b),Math.cos(a),Math.sin(a)*Math.sin(b)]};for(let i=0;i<rows;i++)for(let j=0;j<cols;j++)g.quad(p(i,j),p(i+1,j),p(i+1,j+1),p(i,j+1));return g}
export function hull(){const g=geometry(),outline=[[-.5,-.38],[.2,-.48],[.62,0],[.2,.48],[-.5,.38],[-.58,0]],top=outline.map(p=>[p[0],.5,p[1]]),bottom=outline.map(p=>[p[0]*.82,-.5,p[1]*.6]);for(let i=0;i<6;i++){const j=(i+1)%6;g.tri([0,.5,0],top[j],top[i]);g.quad(top[i],top[j],bottom[j],bottom[i]);g.tri([0,-.5,0],bottom[i],bottom[j])}return g}
export function plane(size=1,segments=1){const g=geometry();for(let i=0;i<segments;i++)for(let j=0;j<segments;j++){const x=(i/segments-.5)*size,z=(j/segments-.5)*size,n=size/segments;g.quad([x,0,z],[x,0,z+n],[x+n,0,z+n],[x+n,0,z])}return g}
export function sector(arc=1.12,segments=48){const g=geometry();for(let i=0;i<segments;i++){const a=-arc+i*2*arc/segments,b=-arc+(i+1)*2*arc/segments;g.tri([0,0,0],[Math.cos(b),0,Math.sin(b)],[Math.cos(a),0,Math.sin(a)])}return g}
export function ring(inner=.96,segments=64){const g=geometry();for(let i=0;i<segments;i++){const a=i*TAU/segments,b=(i+1)*TAU/segments;g.quad([Math.cos(a)*inner,0,Math.sin(a)*inner],[Math.cos(b)*inner,0,Math.sin(b)*inner],[Math.cos(b),0,Math.sin(b)],[Math.cos(a),0,Math.sin(a)])}return g}
export function normalMatrix(m){const o=inverse(m);return new Float32Array([o[0],o[4],o[8],o[1],o[5],o[9],o[2],o[6],o[10]])}
export function segmentMatrix(a,b,radius){const y=unit(sub(b,a)),x=unit(cross(Math.abs(y[1])>.98?[1,0,0]:[0,1,0],y)),z=cross(x,y),h=Math.hypot(...sub(b,a)),p=a.map((v,i)=>(v+b[i])/2);return new Float32Array([...x.map(n=>n*radius),0,...y.map(n=>n*h),0,...z.map(n=>n*radius),0,...p,1])}
export const meshes={box:box(),cylinder:cylinder(),cone:cylinder(8,0),sphere:sphere(),hull:hull(),water:plane(3000,50),sector:sector(),ring:ring(),disc:sector(Math.PI,64)};
