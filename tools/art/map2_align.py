import json, os, sys, numpy as np
K=46.0
P=json.load(open('/tmp/newmap/fsolid.json'))
sol=np.unpackbits(np.load('/tmp/newmap/fsolid.npy'),axis=2)[:,:,:P['shape'][2]].astype(bool)
bc=P['bc']; x0=P['x0']; z0=P['z0']; kb=P['kmin_b']
hmin=float(open('/tmp/newmap/hmin.txt').read())
free=~sol; adj=np.zeros_like(sol)
for ax in range(3):
    for sg in (-1,1): adj|=np.roll(free,sg,axis=ax)
surf=sol&adj
# só perto do chão jogável e abaixo de 12 m
surf[:,:,kb+int(14/bc):]=False
surf[:,:,:kb]=False
print('superfície', int(surf.sum()))
src='/tmp/newmap/objz'; obj=[f for f in os.listdir(src) if f.endswith('.obj')][0]
V=[];F=[]
for line in open(os.path.join(src,obj)):
    if line.startswith('v '): V.append(list(map(float,line.split()[1:4])))
    elif line.startswith('f '):
        vi=[int(t.split('/')[0])-1 for t in line.split()[1:]]
        for k in range(1,len(vi)-1): F.append((vi[0],vi[k],vi[k+1]))
V=np.array(V);F=np.array(F)
G=np.stack([V[:,1]*K,-V[:,0]*K,V[:,2]*K],axis=-1); G[:,1]-=hmin
A=G[F[:,0]];B=G[F[:,1]];C=G[F[:,2]]
edge=np.maximum(np.maximum(np.linalg.norm(B-A,axis=1),np.linalg.norm(C-B,axis=1)),np.linalg.norm(A-C,axis=1))
pts=[]
for m in range(1,60):
    sel=(np.ceil(edge/0.1)==m) if m<59 else (np.ceil(edge/0.1)>=m)
    if not sel.any(): continue
    mm=min(m,80)
    for i in range(mm+1):
        for j in range(mm+1-i):
            u=i/mm;v=j/mm
            pts.append(A[sel]*(1-u-v)+B[sel]*u+C[sel]*v)
Q=np.concatenate(pts).astype(np.float32)
# só os que caem na região de interesse (altura < 14 m)
Q=Q[(Q[:,1]>=-0.5)&(Q[:,1]<14)]
print('pontos', len(Q))
sh=sol.shape
def score(dx,dy,dz):
    ii=np.floor((Q[:,2]+dz-z0)/bc).astype(np.int32); jj=np.floor((Q[:,0]+dx-x0)/bc).astype(np.int32); kk=np.floor((Q[:,1]+dy)/bc).astype(np.int32)+kb
    ok=(ii>=0)&(ii<sh[0])&(jj>=0)&(jj<sh[1])&(kk>=0)&(kk<sh[2])
    vis=np.zeros(sh,bool); vis[ii[ok],jj[ok],kk[ok]]=True
    d=vis.copy()
    return int((surf&vis).sum())
best=None
for dz in np.arange(0.44,0.58,0.02):
    for dx in np.arange(-0.16,-0.03,0.02):
        for dy in np.arange(-0.24,0.02,0.04):
            sc=score(dx,dy,dz)
            if best is None or sc>best[0]: best=(sc,dx,dy,dz)
print('melhor', best)
