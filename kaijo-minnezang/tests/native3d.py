"""Offscreen EGL validation of the actual WebGL shader and generated scene; not a browser test."""
import ctypes as c, json
from pathlib import Path
from PIL import Image
D=json.loads(Path('/tmp/minnezang-3d-scene.json').read_text())
E=c.CDLL('libEGL.so.1');G=c.CDLL('libGL.so.1')
def fn(lib,n,restype,args):
 f=getattr(lib,n);f.restype=restype;f.argtypes=args;return f
I=c.c_int;U=c.c_uint;F=c.c_float;P=c.c_void_p;IP=c.POINTER(I)
fn(E,'eglGetProcAddress',P,[c.c_char_p])
getDisplay=c.CFUNCTYPE(P,U,P,IP)(E.eglGetProcAddress(b'eglGetPlatformDisplayEXT'))
display=getDisplay(0x31DD,None,None)
fn(E,'eglInitialize',U,[P,IP,IP]);a=I();z=I();assert E.eglInitialize(display,c.byref(a),c.byref(z))
fn(E,'eglBindAPI',U,[U]);assert E.eglBindAPI(0x30A0)
attrs=(I*15)(0x3033,1,0x3040,4,0x3024,8,0x3023,8,0x3022,8,0x3025,24,0x3021,8,0x3038)
config=P();count=I();fn(E,'eglChooseConfig',U,[P,IP,c.POINTER(P),I,IP]);assert E.eglChooseConfig(display,attrs,c.byref(config),1,c.byref(count)) and count.value
fn(E,'eglCreatePbufferSurface',P,[P,P,IP]);w,h=D['width'],D['height'];surface=E.eglCreatePbufferSurface(display,config,(I*5)(0x3057,w,0x3056,h,0x3038))
fn(E,'eglCreateContext',P,[P,P,P,IP]);context=E.eglCreateContext(display,config,None,(I*3)(0x3098,2,0x3038));assert context
fn(E,'eglMakeCurrent',U,[P,P,P,P]);assert E.eglMakeCurrent(display,surface,surface,context)
fn(G,'glGetString',c.c_char_p,[U]);print('Native renderer:',G.glGetString(0x1F01).decode())
for n,r,args in [('glCreateShader',U,[U]),('glShaderSource',None,[U,I,c.POINTER(c.c_char_p),IP]),('glCompileShader',None,[U]),('glGetShaderiv',None,[U,U,IP]),('glGetShaderInfoLog',None,[U,I,IP,c.c_char_p]),('glCreateProgram',U,[]),('glAttachShader',None,[U,U]),('glLinkProgram',None,[U]),('glGetProgramiv',None,[U,U,IP]),('glUseProgram',None,[U]),('glGetUniformLocation',I,[U,c.c_char_p]),('glGetAttribLocation',I,[U,c.c_char_p]),('glGenBuffers',None,[I,c.POINTER(U)]),('glBindBuffer',None,[U,U]),('glBufferData',None,[U,c.c_ssize_t,P,U]),('glEnableVertexAttribArray',None,[U]),('glVertexAttribPointer',None,[U,I,U,U,I,P]),('glUniformMatrix4fv',None,[I,I,U,c.POINTER(F)]),('glUniformMatrix3fv',None,[I,I,U,c.POINTER(F)]),('glUniform4fv',None,[I,I,c.POINTER(F)]),('glUniform3fv',None,[I,I,c.POINTER(F)]),('glUniform1f',None,[I,F]),('glUniform1i',None,[I,I]),('glGenTextures',None,[I,c.POINTER(U)]),('glActiveTexture',None,[U]),('glBindTexture',None,[U,U]),('glTexParameteri',None,[U,U,I]),('glTexImage2D',None,[U,I,I,I,I,I,U,U,P]),('glEnable',None,[U]),('glDisable',None,[U]),('glDepthFunc',None,[U]),('glDepthMask',None,[U]),('glBlendFunc',None,[U,U]),('glViewport',None,[I,I,I,I]),('glClearColor',None,[F,F,F,F]),('glClear',None,[U]),('glDrawArrays',None,[U,I,I]),('glReadPixels',None,[I,I,I,I,U,U,P]),('glGetError',U,[])]:fn(G,n,r,args)
def floats(x):return (F*len(x))(*x)
def compile(t,src):
 s=G.glCreateShader(t);p=c.c_char_p(src.encode());G.glShaderSource(s,1,c.byref(p),None);G.glCompileShader(s);ok=I();G.glGetShaderiv(s,0x8B81,c.byref(ok));log=c.create_string_buffer(4096);G.glGetShaderInfoLog(s,4096,None,log);assert ok.value,log.value;return s
program=G.glCreateProgram();G.glAttachShader(program,compile(0x8B31,D['vertexShader']));G.glAttachShader(program,compile(0x8B30,D['fragmentShader']));G.glLinkProgram(program);ok=I();G.glGetProgramiv(program,0x8B82,c.byref(ok));fn(G,'glGetProgramInfoLog',None,[U,I,IP,c.c_char_p]);log=c.create_string_buffer(4096);G.glGetProgramInfoLog(program,4096,None,log);assert ok.value,log.value;G.glUseProgram(program)
locations={n:G.glGetUniformLocation(program,n.encode()) for n in ['uModel','uVP','uNormal','uColor','uEye','uTime','uWater','uGlow','uBlood']}
ap=G.glGetAttribLocation(program,b'aPosition');an=G.glGetAttribLocation(program,b'aNormal')
buffers={}
for name,mesh in D['meshes'].items():
 v=[]
 for key in ['vertices','normals']:
  b=U();G.glGenBuffers(1,c.byref(b));G.glBindBuffer(0x8892,b);data=floats(mesh[key]);G.glBufferData(0x8892,c.sizeof(data),data,0x88E4);v.append(b.value)
 buffers[name]=(*v,len(mesh['vertices'])//3)
tex=U();G.glGenTextures(1,c.byref(tex));G.glActiveTexture(0x84C0);G.glBindTexture(0x0DE1,tex)
for param,value in [(0x2801,0x2601),(0x2800,0x2601),(0x2802,0x812F),(0x2803,0x812F)]:G.glTexParameteri(0x0DE1,param,value)
G.glTexImage2D(0x0DE1,0,0x1908,96,96,0,0x1908,0x1401,(c.c_ubyte*len(D['blood']))(*D['blood']));G.glUniform1i(locations['uBlood'],0)
G.glUniformMatrix4fv(locations['uVP'],1,0,floats(D['camera']['vp']));G.glUniform3fv(locations['uEye'],1,floats(D['camera']['eye']));G.glUniform1f(locations['uTime'],1.)
G.glEnable(0x0B71);G.glDepthFunc(0x0203);G.glDisable(0x0B44);G.glViewport(0,0,w,h);G.glClearColor(.035,.09,.13,1.);G.glClear(0x4000|0x0100)
objects=D['scene']['solid']+D['scene']['transparent']
for obj,normal in zip(objects,D['normals']):obj['normal']=normal
transparent=D['scene']['transparent'];eye=D['camera']['eye'];transparent.sort(key=lambda o:-sum((o['model'][12+i]-eye[i])**2 for i in range(3)))
for i,obj in enumerate(D['scene']['solid']+transparent):
 if i==len(D['scene']['solid']):G.glEnable(0x0BE2);G.glBlendFunc(0x0302,0x0303);G.glDepthMask(0)
 bp,bn,count=buffers[obj['mesh']]
 for attr,b in [(ap,bp),(an,bn)]:G.glBindBuffer(0x8892,b);G.glEnableVertexAttribArray(attr);G.glVertexAttribPointer(attr,3,0x1406,0,0,None)
 G.glUniformMatrix4fv(locations['uModel'],1,0,floats(obj['model']));G.glUniformMatrix3fv(locations['uNormal'],1,0,floats(obj['normal']));G.glUniform4fv(locations['uColor'],1,floats(obj['color']));G.glUniform1f(locations['uGlow'],obj['glow']);G.glUniform1f(locations['uWater'],obj['water']);G.glDrawArrays(4,0,count)
assert G.glGetError()==0,'OpenGL rendering error'
pixels=(c.c_ubyte*(w*h*4))();G.glReadPixels(0,0,w,h,0x1908,0x1401,pixels)
im=Image.frombytes('RGBA',(w,h),bytes(pixels)).transpose(Image.Transpose.FLIP_TOP_BOTTOM);assert len(im.resize((100,72)).getcolors(7201) or [])>100,'Blank or near-blank 3D output';im.save('/tmp/minnezang-3d-native.png');print('Shaders compiled and scene rendered without GL errors. /tmp/minnezang-3d-native.png')
