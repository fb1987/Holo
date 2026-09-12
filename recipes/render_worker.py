"""Render the accepted GLB through the installed, app-owned Blender runtime."""
import sys
import pathlib
import json
import math
import resource

resource.setrlimit(resource.RLIMIT_FSIZE,(32*1024*1024,32*1024*1024))
resource.setrlimit(resource.RLIMIT_CPU,(90,90))
import bpy
from mathutils import Vector

root=pathlib.Path(sys.argv[1])
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(root / "assembly.glb"))
meshes=[obj for obj in bpy.context.scene.objects if obj.type=="MESH"]
if not meshes:
    raise ValueError("Imported GLB contains no meshes")
points=[obj.matrix_world @ Vector(corner) for obj in meshes for corner in obj.bound_box]
low=Vector(tuple(min(p[i] for p in points) for i in range(3)))
high=Vector(tuple(max(p[i] for p in points) for i in range(3)))
center=(low+high)/2
extent=max(high-low)
scene=bpy.context.scene
scene.render.engine="CYCLES"
scene.cycles.device="CPU"
scene.cycles.samples=12
scene.render.threads_mode="FIXED"
scene.render.threads=2
scene.render.resolution_x=640
scene.render.resolution_y=640
scene.render.resolution_percentage=100
scene.render.image_settings.file_format="PNG"
scene.render.film_transparent=False
scene.world=bpy.data.worlds.new("Studio")
scene.world.use_nodes=True
scene.world.node_tree.nodes["Background"].inputs[0].default_value=(0.3,0.3,0.3,1)
scene.world.node_tree.nodes["Background"].inputs[1].default_value=0.7
scene.view_settings.view_transform="Standard"
scene.view_settings.look="None"
for name, direction, energy in [("Key",(2,-3,4),8),("Fill",(-3,-2,1),4),("Rim",(1,3,2),2)]:
    data=bpy.data.lights.new(name,"AREA");data.energy=energy*(extent/0.22)**2;data.shape="DISK";data.size=extent*2
    obj=bpy.data.objects.new(name,data);scene.collection.objects.link(obj);obj.location=center+Vector(direction)*extent
    obj.rotation_euler=(center-obj.location).to_track_quat("-Z","Y").to_euler()
camera=bpy.data.objects.new("Camera",bpy.data.cameras.new("Camera"));scene.collection.objects.link(camera);scene.camera=camera
camera.data.type="ORTHO";camera.data.ortho_scale=extent*1.6
for name,direction in [("front",(0,-3,0.1)),("rear",(0,3,0.1)),("oblique",(2,-3,1.3))]:
    camera.location=center+Vector(direction)*extent
    camera.rotation_euler=(center-camera.location).to_track_quat("-Z","Y").to_euler()
    scene.render.filepath=str(root / (name+".png"))
    bpy.ops.render.render(write_still=True)
(root / "render-evidence.json").write_text(json.dumps({"kind":"model-render","source":"assembly.glb","blender":bpy.app.version_string,"views":["front.png","rear.png","oblique.png"],"fabrication":"unassessed"},indent=2))
