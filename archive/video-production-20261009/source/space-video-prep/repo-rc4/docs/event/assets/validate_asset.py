"""Blender-native GLB roundtrip, bounds and contract anchor checks."""
import bpy
import json
import pathlib
import struct
from mathutils import Vector

base=pathlib.Path(__file__).resolve().parent
path=base/'output'/'musicspace-venue.glb'
raw=path.read_bytes()
magic,version,length=struct.unpack_from('<III',raw)
assert magic==0x46546c67 and version==2 and length==len(raw)
chunk_length,chunk_type=struct.unpack_from('<II',raw,12)
assert chunk_type==0x4e4f534a
document=json.loads(raw[20:20+chunk_length])
nodes={n['name']:n for n in document['nodes'] if 'name' in n}
for name in ('MS_VENUE_ROOT','MS_FLOOR','MS_STAGE','MS_GALLERY_ANCHOR','MS_FOREGROUND_CUTAWAY'):
    assert name in nodes,name
root=nodes['MS_VENUE_ROOT']
assert root.get('translation',[0,0,0])==[0,0,0]
assert root.get('rotation',[0,0,0,1])==[0,0,0,1]
assert root.get('scale',[1,1,1])==[1,1,1]
assert all('uri' not in b for b in document['buffers'])
assert all('uri' not in image for image in document.get('images',[]))
expected=[6.795,2.64,-.65]
actual=nodes['MS_GALLERY_ANCHOR'].get('translation',[0,0,0])
assert max(abs(a-b) for a,b in zip(actual,expected))<1e-5,(actual,expected)
cutaway=nodes['MS_FOREGROUND_CUTAWAY']
cutaway_children=[document['nodes'][i]['name'] for i in cutaway.get('children',[])]
assert set(cutaway_children)=={'MS_CUTAWAY_CEL_INK','MS_CUTAWAY_CEL_METAL','MS_CUTAWAY_CEL_SHADOW'}
for name in cutaway_children:
    assert 'mesh' in nodes[name]
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(path))
gallery=bpy.data.objects['MS_GALLERY_ANCHOR']
assert (gallery.matrix_world.translation-Vector((6.795,.65,2.64))).length<1e-4
minimum=[float('inf')]*3
maximum=[-float('inf')]*3
triangles=0
meshes=[]
for ob in bpy.data.objects:
    if ob.type!='MESH': continue
    meshes.append(ob.name)
    triangles+=sum(len(p.vertices)-2 for p in ob.data.polygons)
    for v in ob.data.vertices:
        p=ob.matrix_world@v.co
        p=(p.x,p.z,-p.y)
        for i in range(3):
            minimum[i]=min(minimum[i],p[i])
            maximum[i]=max(maximum[i],p[i])
report={'glbHeaderValid':True,'selfContained':True,'rootIdentity':True,
        'cutawayChildren':cutaway_children,'cutawayBucketCount':len(cutaway_children),
        'galleryAnchorExact':True,'roundtripImported':True,'boundsThree':{'min':minimum,'max':maximum},
        'triangleCount':triangles,'meshNames':meshes,'drawPrimitives':sum(len(m['primitives']) for m in document['meshes']),
        'materialNames':[m['name'] for m in document['materials']],
        'hostBrowserValidation':'pending; offline render is not proof of web material appearance'}
assert triangles<80000
assert report['drawPrimitives']<50
(base/'output'/'validation.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps(report))
