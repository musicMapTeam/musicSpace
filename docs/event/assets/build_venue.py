"""MusicSpace original venue. Blender built-in bpy only; no application changes.

Run after approval/review: blender --background --factory-startup --python
build_venue.py -- --contract inputs/contract/anchors.json --out output
Add --export only after host integration contract review. Preview lamps/cameras
are retained in blend but excluded from GLB. No people or photos are generated.
"""
import argparse
import json
import math
import pathlib
import sys
import bpy
from mathutils import Vector

args = argparse.ArgumentParser()
args.add_argument('--contract', required=True)
args.add_argument('--out', default='output')
args.add_argument('--export', action='store_true')
args.add_argument('--render', action='store_true')
opt = args.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
contract = json.loads(pathlib.Path(opt.contract).read_text(encoding='utf-8'))
out = pathlib.Path(opt.out).resolve()
out.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for initial_material in list(bpy.data.materials):
    bpy.data.materials.remove(initial_material, do_unlink=True)

def xyz(v):
    return Vector((v[0], -v[2], v[1]))

def empty(name, p=(0, 0, 0), parent=None):
    ob = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(ob)
    ob.location = xyz(p)
    ob.parent = parent
    return ob

root = empty('MS_VENUE_ROOT')
root['contract_schema'] = contract['schema']
root['source_commit'] = contract['sourceCommit']
root['integration_status'] = 'proposed; host loader not implemented'
cutaway = empty('MS_FOREGROUND_CUTAWAY', parent=root)
cutaway_members = []
gallery = empty('MS_GALLERY_ANCHOR', contract['gallery']['position'], root)
gallery.rotation_euler.z = contract['gallery']['rotationY']
gallery['photos_owned_by'] = 'web runtime'

def mat(name, hexcolor, emission=0):
    rgb = [int(hexcolor[i:i+2], 16)/255 for i in (0, 2, 4)]
    linear = [v/12.92 if v <= .04045 else ((v+.055)/1.055)**2.4 for v in rgb]
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*linear, 1)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*linear, 1)
    bsdf.inputs['Roughness'].default_value = .86
    if emission:
        bsdf.inputs['Emission Color'].default_value = (*linear, 1)
        bsdf.inputs['Emission Strength'].default_value = emission
    return m

ink = mat('CEL_INK', '1a1a22')
cream = mat('CEL_PAPER', 'f1eee4')
violet = mat('CEL_SHADOW', '393244')
cloth = mat('CEL_CURTAIN', '24232b')
metal = mat('CEL_METAL', '68676a')
floor_mat = mat('CEL_FLOOR', 'd5d0c2')
accent = mat('CEL_LIME', 'dced60')
lamp = mat('EMISSIVE_LIME', 'dced60', .65)

def finish(ob, name, material, parent=root):
    ob.name = name
    ob.parent = parent
    ob.data.materials.append(material)
    if parent == cutaway:
        cutaway_members.append(ob.name)
    return ob

def box(name, p, s, material, bevel=.025, parent=root):
    bpy.ops.mesh.primitive_cube_add(size=1, location=xyz(p))
    ob = finish(bpy.context.object, name, material, parent)
    ob.scale = (s[0], s[2], s[1])
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        mod = ob.modifiers.new('Small authored edge bevel', 'BEVEL')
        mod.width = bevel
        mod.segments = 2
    return ob

def rod(name, a, b, radius, material, parent=root, sides=10):
    va, vb = xyz(a), xyz(b)
    bpy.ops.mesh.primitive_cylinder_add(vertices=sides, radius=radius,
                                      depth=(vb-va).length, location=(va+vb)/2)
    ob = finish(bpy.context.object, name, material, parent)
    ob.rotation_euler = (vb-va).to_track_quat('Z', 'Y').to_euler()
    return ob

def mesh(name, vertices, faces, material, parent=root):
    data = bpy.data.meshes.new(name)
    data.from_pydata([xyz(v) for v in vertices], [], faces)
    data.update()
    ob = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(ob)
    return finish(ob, name, material, parent)

box('MS_FLOOR', contract['floor']['center'], contract['floor']['size'], floor_mat)
box('MS_STAGE', contract['stage']['center'], contract['stage']['size'], ink, .055)
box('Stage top', (-.1, .621, -3.29), (9.85, .043, 4.28), violet, .014)
box('Rear masonry', contract['walls']['backCenter'], contract['walls']['backSize'], cream)
box('Gallery wall', contract['walls']['rightCenter'], contract['walls']['rightSize'], cream)
box('Stage apron piping', (-.1, .53, -1.135), (9.7, .055, .04), metal, .009)
for i in range(3):
    box('Stage access step', (-5.42, .1*(i+1), -1.34-.24*i),
        (.83, .2*(i+1), .76-.24*i), violet, .02)
    box('Step light strip', (-5.42, .2*(i+1)+.008, -.965-.24*i), (.62, .015, .03), accent, .003)

# Curtains use sinusoidal depth and deliberately scalloped hems, not flat panels.
for side in (-1, 1):
    verts, faces = [], []
    nx, ny = 64, 10
    for j in range(ny+1):
        t = j/ny
        for i in range(nx+1):
            u = i/nx
            x = side*(.008+5.15*u)
            y = .69 + t*(4.9 + .065*math.cos(u*math.pi*12))
            z = -5.02 + (.13+.035*(1-t))*math.cos(u*math.pi*20)
            verts.append((x, y, z))
    for j in range(ny):
        for i in range(nx):
            a = j*(nx+1)+i
            faces.append((a, a+1, a+nx+2, a+nx+1))
    curtain = mesh('Pleated curtain left' if side < 0 else 'Pleated curtain right', verts, faces, cloth)
    curtain.modifiers.new('Fabric thickness', 'SOLIDIFY').thickness = .022
    for x in (side*4.93, side*5.18):
        rod('Curtain side fold', (x,.7,-5.05), (x,5.62,-5.05), .075, violet)

# Real triangulated suspended truss silhouette; lighting is web-owned on export.
for y,z in ((5.50,-2.28),(5.85,-2.28),(5.50,-2.64)):
    rod('Main truss chord', (-5.6,y,z), (5.6,y,z), .045, metal)
for i in range(16):
    x = -5.6 + .7*i
    rod('Truss diagonal', (x,5.50,-2.28), (x+.7,5.85,-2.28), .022, metal)
    rod('Truss depth web', (x,5.50,-2.28), (x+.7,5.50,-2.64), .022, metal)
for x in (-5.4,5.4):
    rod('Truss suspension', (x,5.85,-2.28), (x,6.06,-2.28), .026, ink)
for x in (-4.5,-2.8,-.9,1.1,3.0,4.7):
    rod('Lamp bracket', (x,5.48,-2.35),(x,5.11,-2.35), .036, ink)
    rod('Lamp housing', (x,5.15,-2.42),(x,4.86,-2.22), .17, ink, sides=16)
    rod('Lamp lens', (x,4.857,-2.218),(x,4.835,-2.20), .143, lamp, sides=16)

# Speaker cabinets with real recessed cones, protective bars and handles.
for x in (-4.36,4.36):
    pa_parent = cutaway if x > 0 else root
    for y in (1.20,2.32):
        box('PA cabinet', (x,y,-2.23), (.8,1.03,.69), ink, .055, parent=pa_parent)
        box('PA grille recess', (x,y,-1.875), (.69,.92,.025), violet, .012, parent=pa_parent)
        for dy,r in ((-.22,.245),(.29,.11)):
            rod('PA driver surround', (x,y+dy,-1.85),(x,y+dy,-1.81),r,metal,parent=pa_parent,sides=24)
            rod('PA driver cone', (x,y+dy,-1.802),(x,y+dy,-1.77),r*.83,ink,parent=pa_parent,sides=24)
        for dx in (-.24,0,.24):
            rod('PA protective grille', (x+dx,y-.43,-1.754),(x+dx,y+.43,-1.754),.009,ink,parent=pa_parent)
        box('PA recessed side handle',(x+.405,y,-2.23),(.018,.22,.30),violet,.025,parent=pa_parent)

# Drum kit with rims, angled cymbals and tripod stands.
rod('Kick drum shell',(-1.6,1.27,-3.65),(-1.6,1.27,-2.85),.61,ink,sides=32)
rod('Kick front rim',(-1.6,1.27,-2.85),(-1.6,1.27,-2.81),.64,metal,sides=32)
rod('Kick skin',(-1.6,1.27,-2.807),(-1.6,1.27,-2.79),.594,cream,sides=32)
rod('Kick port',(-1.38,1.1,-2.787),(-1.38,1.1,-2.77),.105,ink,sides=20)
for x,y,z,r in ((-2.3,1.69,-3.2,.36),(-1.5,2.10,-3.6,.31),(-.81,1.78,-3.4,.40)):
    rod('Tom drum shell',(x,y-.3,z),(x,y,z),r,violet,sides=24)
    rod('Tom cream skin',(x,y,z),(x,y+.025,z),r*.95,cream,sides=24)
    rod('Tom rim',(x,y-.015,z),(x,y+.01,z),r,metal,sides=24)
for x,z,y in ((-2.7,-3.85,2.7),(-.25,-3.75,2.54),(-2.45,-2.65,2.15)):
    rod('Cymbal mast',(x,.68,z),(x,y,z),.021,metal)
    rod('Cymbal disc',(x,y,z),(x,y+.024,z),.45,accent,sides=32)
    for a in (0,2.094,4.188):
        rod('Cymbal tripod',(x,.90,z),(x+.32*math.cos(a),.66,z+.32*math.sin(a)),.018,metal)
for x,z in ((.6,-2.35),(2.45,-3.18)):
    rod('Microphone upright',(x,.65,z),(x,2.95,z),.024,metal)
    rod('Microphone boom',(x,2.75,z),(x-.60,3.13,z+.10),.020,ink)
    rod('Microphone head',(x-.60,3.13,z+.10),(x-.78,3.17,z+.13),.045,ink)
    for a in (0,2.094,4.188):
        rod('Mic tripod',(x,.78,z),(x+.33*math.cos(a),.66,z+.33*math.sin(a)),.019,ink)

# Occupied audience points stay unobstructed. Detail lives at the perimeter.
box('Backline amp cabinet',(2.75,1.28,-4.52),(1.34,1.20,.63),ink,.065)
box('Backline amp woven face',(2.75,1.25,-4.195),(1.18,.90,.024),metal,.01)
for i in range(12):
    box('Amp grille horizontal',(2.75,.85+i*.071,-4.178),(1.15,.012,.012),violet,0)
box('Amplifier head',(2.75,1.96,-4.52),(1.30,.22,.58),violet,.03)
for x in (2.30,2.45,2.60,2.75,2.90):
    rod('Amplifier knob',(x,1.96,-4.219),(x,1.96,-4.197),.025,cream,sides=10)
# Original asymmetric electric guitar silhouette with actual thickness.
outline=[(-.06,0),(-.28,.09),(-.34,.30),(-.30,.47),(-.18,.54),
         (-.22,.72),(-.14,.84),(-.04,.61),(.08,.61),(.19,.83),
         (.26,.70),(.19,.54),(.33,.43),(.34,.25),(.25,.08),(.07,0)]
gx,gy,gz=3.85,1.02,-3.78
verts=[(gx+x,gy+y,gz+d) for d in (-.065,.065) for x,y in outline]
n=len(outline)
faces=[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]
faces += [(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
mesh('Original guitar carved body',verts,faces,cream)
box('Guitar fretboard',(gx+.025,gy+1.10,gz+.084),(.105,1.10,.06),ink,.012)
box('Guitar headstock',(gx+.035,gy+1.73,gz+.075),(.15,.25,.085),cream,.022)
for i in range(11):
    box('Guitar fret',(gx+.025,gy+.68+i*.083,gz+.118),(.099,.009,.007),metal,0)
for y in (.22,.40,.49):
    box('Guitar bridge pickup',(gx+.02,gy+y,gz+.075),(.15,.065,.015),ink,.005)
rod('Guitar stand',(gx,.66,gz-.1),(gx,1.34,gz-.1),.025,metal)
for x in (-.25,.25):
    rod('Guitar stand foot',(gx,.72,gz-.1),(gx+x,.65,gz+.20),.022,metal)
# Cable sweeps are real low-radius curves converted for the web export.
for number,points in enumerate([
    [( .6,.663,-2.35),(.95,.663,-2.85),(1.5,.663,-3.1),(2.2,.663,-3.85),(2.75,.663,-4.18)],
    [(3.85,.663,-3.75),(3.4,.663,-3.4),(3.0,.663,-3.6),(3.25,.663,-4.12)]]):
    data=bpy.data.curves.new('Cable sweep','CURVE')
    data.dimensions='3D'
    data.bevel_depth=.014
    data.bevel_resolution=1
    spline=data.splines.new('BEZIER')
    spline.bezier_points.add(len(points)-1)
    for point,position in zip(spline.bezier_points,points):
        point.co=xyz(position)
        point.handle_left_type=point.handle_right_type='AUTO'
    ob=bpy.data.objects.new('Stage cable '+str(number),data)
    bpy.context.collection.objects.link(ob)
    finish(ob,ob.name,ink)
for x in (-6.05,-5.61):
    box('Side acoustic slat',(x,3.4,-5.39),(.15,4.30,.06),violet,.014)
box('Stage cream fascia inlay',(-.1,.22,-1.123),(8.65,.045,.022),cream,.004)
for x in (-6.45,6.47):
    box('Wall dado',(x, .39,-1.6),(.15,.70,7.2),violet,.014)
    box('Wall base trim',(x,.07,-1.6),(.19,.11,7.2),ink,.008)
for i in range(9):
    z = -.9 + i*.75
    box('Floor score seam',(0,-.002,z),(12.9,.008,.013),metal,0)
for z in (1.5,3.0,4.5):
    box('Side bench seat',(-5.88,.73,z),(1.35,.16,1.14),ink,.055)
    for dz in (-.42,.42):
        rod('Bench legs',(-6.30,.01,z+dz),(-6.30,.65,z+dz),.038,metal)
        rod('Bench legs',(-5.48,.01,z+dz),(-5.48,.65,z+dz),.038,metal)
box('Gallery thin top rail',(6.72,5.14,-.65),(.08,.07,3.8),ink,.012)
box('Gallery thin bottom rail',(6.72,.31,-.65),(.08,.07,3.8),ink,.012)
for z in (-2.48,1.18):
    rod('Gallery perimeter trim',(6.73,.35,z),(6.73,5.10,z),.018,metal,parent=cutaway)
for z in (-2.10,.8):
    rod('Gallery sconce',(6.75,5.02,z),(6.38,5.02,z),.036,ink)
    rod('Gallery reading light',(6.38,5.03,z),(6.38,4.96,z),.095,lamp,sides=16)
# Actual web GPU identified the right PA and both gallery trims as blockers.
cutaway['visibility_rule'] = 'Host hides as one group for gallery/person views'
cutaway['revision'] = 'r2 semantic regroup only; original geometry/transforms/materials'
cutaway['source_members'] = json.dumps(cutaway_members)
(out/'occlusion-groups.json').write_text(json.dumps({
    'revision':'r2','group':'MS_FOREGROUND_CUTAWAY','members':cutaway_members,
    'memberCount':len(cutaway_members),'reason':'right PA and both gallery perimeter trims obstruct runtime photo view',
    'geometryChanges':False,'transformChanges':False,'materialChanges':False},indent=2),encoding='utf-8')

scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 32
scene.world.color = (.18,.18,.18)
scene.view_settings.view_transform = 'Standard'
scene.render.image_settings.file_format = 'PNG'

def light(name,p,energy,size,color):
    data = bpy.data.lights.new(name,'AREA')
    data.energy,data.shape,data.size,data.color = energy,'DISK',size,color
    ob = bpy.data.objects.new(name,data)
    bpy.context.collection.objects.link(ob)
    ob.location = xyz(p)
    ob.rotation_euler = (xyz((0,1.5,-2))-ob.location).to_track_quat('-Z','Y').to_euler()
    return ob

light('PREVIEW_Key',(-3,7,3),500,7,(1,.94,.83))
light('PREVIEW_Stage',(2,6,-2),330,5,(.86,.92,.57))
light('PREVIEW_Gallery',(-2,4,0),210,5,(.84,.83,1))

def camera(name,p,target,aspect):
    data = bpy.data.cameras.new(name)
    data.type = 'PERSP'
    data.sensor_fit = 'VERTICAL'
    data.sensor_height = 24
    data.lens = 12/math.tan(math.radians(contract['camera']['verticalFov'])/2)
    ob = bpy.data.objects.new(name,data)
    bpy.context.collection.objects.link(ob)
    ob.location = xyz(p)
    ob.rotation_euler = (xyz(target)-ob.location).to_track_quat('-Z','Y').to_euler()
    return ob,aspect

cameras = []
for key,aspect in (('mobileOverview',390/844),('desktopOverview',16/9)):
    c = contract['camera'][key]
    cameras.append(camera('PREVIEW_'+key,c['position'],c['target'],aspect))
photos = contract['camera']['photos']
aspect = 390/844
fov = math.radians(contract['camera']['verticalFov'])
distance = max(5,2*1.12/(2*math.tan(fov/2)*aspect*.82),(3*1.46+.65)/(2*math.tan(fov/2)*.51))
cameras.append(camera('PREVIEW_Gallery',(6.79-distance,2.73,.05),photos['target'],aspect))
p=contract['people'][0]['feet']
person=contract['camera']['person']
cameras.append(camera('PREVIEW_Person',tuple(a+b for a,b in zip(p,person['relativePosition'])),
                      tuple(a+b for a,b in zip(p,person['relativeTarget'])),aspect))
bpy.ops.wm.save_as_mainfile(filepath=str(out/'musicspace-venue.blend'))

if opt.export:
    # Evaluate authored bevel/fabric modifiers in a copy, then merge by material
    # and semantic group. Editable source remains intact in the saved blend.
    bpy.ops.object.select_all(action='DESELECT')
    for ob in list(bpy.data.objects):
        if ob.type in ('MESH','CURVE'):
            ob.select_set(True)
    bpy.ops.object.convert(target='MESH')
    buckets = {}
    for ob in list(bpy.data.objects):
        if ob.type != 'MESH' or ob.name in ('MS_STAGE','MS_FLOOR'):
            continue
        key = (ob.parent.name if ob.parent else '',ob.data.materials[0].name)
        buckets.setdefault(key,[]).append(ob)
    for key,objects in buckets.items():
        bpy.ops.object.select_all(action='DESELECT')
        for ob in objects:
            ob.select_set(True)
        bpy.context.view_layer.objects.active = objects[0]
        bpy.ops.object.join()
        objects[0].name = ('MS_CUTAWAY_' if key[0] == cutaway.name else 'MS_STATIC_')+key[1]
    bpy.ops.object.select_all(action='DESELECT')
    for ob in bpy.data.objects:
        if ob.type in ('MESH','EMPTY'):
            ob.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(out/'musicspace-venue.glb'),export_format='GLB',
        use_selection=True,export_yup=True,export_extras=True,export_cameras=False,export_lights=False)
    triangles = sum(len(p.vertices)-2 for ob in bpy.data.objects if ob.type=='MESH' for p in ob.data.polygons)
    manifest = {'schema':'musicspace-venue-asset-v1','sourceContract':contract['sourceCommit'],
        'triangleCount':triangles,'meshCount':sum(ob.type=='MESH' for ob in bpy.data.objects),
        'materials':[m.name for m in bpy.data.materials if m.users], 'textures':[],
        'glbBytes':(out/'musicspace-venue.glb').stat().st_size,
        'anchors':contract['gallery'],'license':'Original authored geometry; no third-party assets',
        'hostIntegration':'not implemented','validation':'Generated counts only; visual and browser QA pending'}
    (out/'asset-manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
if opt.render:
    for cam,aspect in cameras:
        scene.camera = cam
        scene.render.resolution_y = 1080
        scene.render.resolution_x = round(1080*aspect)
        scene.render.resolution_percentage = 100
        scene.render.filepath = str(out/(cam.name+'.png'))
        bpy.ops.render.render(write_still=True)
