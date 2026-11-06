"""Spinning metal icon: build, fit, render. Copy this file next to where the art should live, rename it
(the name becomes the .blend's), and replace the SUBJECT section. The example subject is a broken chain.

Check:   Blender -b --factory-startup -P <this file> -P contact_sheet.py
Render:  Blender -b --factory-startup -P <this file> -- render      (writes frames/ and <name>.blend here)
Encode:  img2webp -loop 0 -lossy -q 70 -d 63 frames/frame_*.png -o <name>.webp
"""
import bpy, math, sys, os
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
NAME = os.path.splitext(os.path.basename(__file__))[0]
FRAMES, STEP = 48, 7.5        # frame i is at i*STEP degrees; FRAMES*STEP = 360, so the loop is seamless
TILT     = 0      # subject's long axis above horizontal, degrees; held through the spin
CAM_DOWN = 12     # camera looks down by this much, degrees
METAL = dict(base=0.85, rough=0.2)

# ---- SUBJECT: replace from here to END SUBJECT. subject(mat) returns the top-level objects; build() parents
# them to the tilt, so model with the long axis along X, centred on the origin, a few metres across.

# Star logomark, parsed from the SVG path next to this file (M/C/Z only)
SIZE    = 3.0     # metres across
EXTRUDE = 0.12    # half-thickness of the slab
BEVEL   = 0.05    # rounded edge radius


def clear():
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    for coll in (bpy.data.meshes, bpy.data.curves, bpy.data.materials, bpy.data.lights, bpy.data.cameras, bpy.data.worlds):
        for b in list(coll):
            coll.remove(b)


def svg_path():
    import re
    svg = open(os.path.join(HERE, "jm_logomark.svg")).read()
    d = re.search(r' d="([^"]+)"', svg).group(1)
    w = float(re.search(r'viewBox="0 0 ([\d.]+)', svg).group(1))
    nums = [float(n) for n in re.findall(r"-?[\d.]+", d)]
    s = SIZE / w
    pts = [((nums[i] - w / 2) * s, (w / 2 - nums[i + 1]) * s) for i in range(0, len(nums), 2)]   # flip y
    return pts[0], [pts[i:i + 3] for i in range(1, len(pts), 3)]          # start, [(c1, c2, end)]


def subject(mat):
    start, segs = svg_path()
    cu = bpy.data.curves.new("Star", "CURVE")
    cu.dimensions, cu.fill_mode = "2D", "BOTH"
    cu.extrude, cu.bevel_depth, cu.bevel_resolution = EXTRUDE, BEVEL, 6
    cu.resolution_u = 16
    sp = cu.splines.new("BEZIER")
    sp.bezier_points.add(len(segs) - 1)                # last segment ends back on the start point
    sp.use_cyclic_u = True
    anchors = [start] + [e for _, _, e in segs[:-1]]
    for k, bp in enumerate(sp.bezier_points):
        bp.co = (*anchors[k], 0)
        bp.handle_right_type = bp.handle_left_type = "FREE"
        bp.handle_right = (*segs[k][0], 0)
        bp.handle_left = (*segs[k - 1][1], 0)
    ob = bpy.data.objects.new("Star", cu)
    bpy.context.scene.collection.objects.link(ob)
    cu.materials.append(mat)
    ob.rotation_euler = (math.radians(90), 0, 0)       # face the camera (local Y -> world Z)
    return [ob]

# ---- END SUBJECT


def material():
    m = bpy.data.materials.new("Silver")
    m.use_nodes = True
    b = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    b.inputs["Base Color"].default_value = (METAL["base"],) * 3 + (1,)
    b.inputs["Metallic"].default_value = 1.0
    b.inputs["Roughness"].default_value = METAL["rough"]
    return m


def world():
    w = bpy.data.worlds.new("Studio")
    bpy.context.scene.world = w
    w.use_nodes = True
    nt = w.node_tree
    bg = next(n for n in nt.nodes if n.type == "BACKGROUND")
    tc = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    mr = nt.nodes.new("ShaderNodeMapRange")       # z of the view direction, -1..1 -> 0..1
    mr.inputs["From Min"].default_value = -1
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    e = ramp.color_ramp.elements
    e[0].position, e[0].color = 0.40, (0.05, 0.05, 0.055, 1)   # dark floor
    e[1].position, e[1].color = 0.85, (0.55, 0.57, 0.6, 1)       # light ceiling
    nt.links.new(tc.outputs["Generated"], sep.inputs[0])
    nt.links.new(sep.outputs["Z"], mr.inputs["Value"])
    nt.links.new(mr.outputs["Result"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], bg.inputs["Color"])
    bg.inputs["Strength"].default_value = 1.0


def area(name, loc, size, energy):
    l = bpy.data.lights.new(name, "AREA")
    l.shape, l.size, l.size_y, l.energy = "RECTANGLE", size[0], size[1], energy
    ob = bpy.data.objects.new(name, l)
    ob.location = loc
    bpy.context.scene.collection.objects.link(ob)
    # aim at the origin
    ob.rotation_euler = (-Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    return ob


def build():
    clear()
    sc = bpy.context.scene
    mat = material()

    spin = bpy.data.objects.new("Spin", None)          # turns about world Z
    tilt = bpy.data.objects.new("Tilt", None)          # holds the diagonal
    for o in (spin, tilt):
        sc.collection.objects.link(o)
    tilt.parent = spin
    tilt.rotation_euler = (0, -math.radians(TILT), 0)

    for o in subject(mat):
        o.parent = tilt

    # angle is computed from the frame number, no easing
    d = spin.driver_add("rotation_euler", 2).driver
    d.type, d.expression = "SCRIPTED", f"frame*{math.radians(STEP)!r}"

    world()
    area("Key",    (-4, -5, 5),  (7, 2.5), 750)      # big soft key, upper left front
    area("Strip",  (6, -2, 0.5), (0.6, 7), 450)       # tall strip, right: a bright band down the side
    area("Top",    (1, 4, 7),    (5, 5), 700)         # top/back: rim on upper edges
    area("Under",  (-2, -4, -4), (6, 1.5), 120)       # keeps the underside out of pure black

    cam_data = bpy.data.cameras.new("Cam")
    cam_data.type = "ORTHO"
    cam = bpy.data.objects.new("Cam", cam_data)
    sc.collection.objects.link(cam)
    sc.camera = cam
    dn = math.radians(CAM_DOWN)
    cam.location = (0, -20 * math.cos(dn), 20 * math.sin(dn))
    cam.rotation_euler = (math.pi / 2 - dn, 0, 0)

    r = sc.render
    try:
        r.engine = "CYCLES"
    except TypeError as e:
        print(e)
    sc.cycles.samples = 64
    sc.cycles.use_denoising = True
    r.film_transparent = True
    r.resolution_x = r.resolution_y = 192
    r.resolution_percentage = 100
    r.image_settings.file_format = "PNG"
    r.image_settings.color_mode = "RGBA"
    r.fps = 16                                       # one turn every 3 s
    sc.frame_start, sc.frame_end = 0, FRAMES - 1
    try:
        prefs = bpy.context.preferences.addons["cycles"].preferences
        prefs.compute_device_type = "METAL"
        prefs.get_devices()
        for dev in prefs.devices:
            dev.use = True
        sc.cycles.device = "GPU"
    except Exception as e:
        print("GPU unavailable, using CPU:", e)
        sc.cycles.device = "CPU"

    fit_camera()


def fit_camera(margin=1.06):
    """Ortho scale that holds the object at every frame of the spin."""
    sc = bpy.context.scene
    cam = sc.camera
    meshes = [o for o in sc.objects if o.type in ("CURVE", "MESH")]
    ext = 0
    for f in range(FRAMES):
        sc.frame_set(f)
        inv = cam.matrix_world.inverted()
        dg = bpy.context.evaluated_depsgraph_get()
        for o in meshes:
            ev = o.evaluated_get(dg)
            me = ev.to_mesh()
            mw = ev.matrix_world
            for v in me.vertices:
                p = inv @ (mw @ v.co)
                ext = max(ext, abs(p.x), abs(p.y))
            ev.to_mesh_clear()
    cam.data.ortho_scale = 2 * ext * margin
    sc.frame_set(0)
    print("ortho_scale", cam.data.ortho_scale)


def render(out=os.path.join(HERE, "frames"), frames=range(FRAMES)):
    sc = bpy.context.scene
    os.makedirs(out, exist_ok=True)
    for f in frames:
        sc.frame_set(f)
        sc.render.filepath = os.path.join(out, f"frame_{f:03d}.png")
        bpy.ops.render.render(write_still=True)


build()
if "render" in (sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []):
    render()
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, NAME + ".blend"))
