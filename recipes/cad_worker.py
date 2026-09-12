"""Trusted Holo solid adapter. No project Python is imported or evaluated."""
import json
import pathlib
import sys
import resource

resource.setrlimit(resource.RLIMIT_FSIZE, (64 * 1024 * 1024, 64 * 1024 * 1024))
resource.setrlimit(resource.RLIMIT_CPU, (60, 60))
import cadquery as cq


def compile_solid(node, depth=0):
    if depth > 100:
        raise ValueError("Solid tree depth exceeded")
    op = node["op"]
    if op == "box":
        return cq.Workplane("XY").box(*node["size"]).val()
    if op == "cylinder":
        return cq.Solid.makeCylinder(node["radius"], node["height"])
    if op == "roundedExtrude":
        w, d, r = node["width"], node["depth"], node["radius"]
        wire = cq.Wire.makePolygon([(-w/2,-d/2,0),(w/2,-d/2,0),(w/2,d/2,0),(-w/2,d/2,0)], close=True)
        wire = wire.fillet2D(r, wire.Vertices())
        top = wire.scale(node["scaleTop"]).translate((0,0,node["height"]))
        return cq.Solid.makeLoft([wire, top], ruled=True)
    if op == "transform":
        shape = compile_solid(node["child"], depth+1)
        for axis, angle in zip([(1,0,0),(0,1,0),(0,0,1)],node["rotate"]):
            if angle:
                shape = shape.rotate((0,0,0),axis,angle)
        return shape.translate(node["translate"])
    if op in ("union", "difference"):
        shapes = [compile_solid(child,depth+1) for child in node["children"]]
        return (shapes[0].fuse(*shapes[1:]) if op == "union" else shapes[0].cut(*shapes[1:])).clean()
    raise ValueError("Unsupported solid operation")


root = pathlib.Path(sys.argv[1])
parts = json.loads((root / "solids.json").read_text())
assembly = cq.Assembly(name="Holo")
for part in parts:
    shape = compile_solid(part["solid"])
    if not shape.isValid() or shape.Volume() <= 0:
        raise ValueError("Invalid CAD solid: " + part["id"])
    assembly.add(shape,name=part["id"])
assembly.save(str(root / "assembly.step"))
reloaded = cq.importers.importStep(str(root / "assembly.step")).val()
if not reloaded.isValid() or reloaded.Volume() <= 0:
    raise ValueError("STEP reload validation failed")
box = reloaded.BoundingBox()
(root / "cad-validation.json").write_text(json.dumps({"valid":True,"cadquery":cq.__version__,"solidCount":len(reloaded.Solids()),"volumeMM3":reloaded.Volume(),"dimensionsMM":[box.xlen,box.ylen,box.zlen],"fabrication":"unassessed"},indent=2))
print(json.dumps({"ok":True,"solidCount":len(reloaded.Solids())}))
