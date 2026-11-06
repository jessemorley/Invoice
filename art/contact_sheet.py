"""Contact sheet for a spin render: 8 frames over black (bottom row) and white (top row), plus a half-size copy.

Run after a build script, in the same Blender:
    Blender -b --factory-startup -P unlink/unlink.py -P contact_sheet.py
Writes $SHEET_DIR (default ./sheet)/sheet.png and sheet96.png, and prints per-frame stats.
"""
import bpy, numpy as np, os

OUTD = os.path.abspath(os.environ.get("SHEET_DIR", "sheet"))
os.makedirs(OUTD, exist_ok=True)
sc = bpy.context.scene
n = sc.frame_end - sc.frame_start + 1
picks = [sc.frame_start + i * n // 8 for i in range(8)]
W, H = sc.render.resolution_x, sc.render.resolution_y


def save(name, rgb):
    h, w = rgb.shape[:2]
    img = bpy.data.images.new(name, w, h, alpha=True)
    img.pixels[:] = np.concatenate([rgb, np.ones((h, w, 1), np.float32)], 2).ravel()
    img.filepath_raw = f"{OUTD}/{name}.png"; img.file_format = "PNG"; img.save()
    bpy.data.images.remove(img)


tiles = []
print("frame, min lum, max lum, share >0.98, share <0.04, touches edge")
for f in picks:
    p = f"{OUTD}/f{f:03d}.png"
    sc.frame_set(f); sc.render.filepath = p
    bpy.ops.render.render(write_still=True)
    im = bpy.data.images.load(p, check_existing=False)
    a = np.array(im.pixels[:], np.float32).reshape(H, W, 4)   # 8-bit PNG: values are display (sRGB) values
    bpy.data.images.remove(im)
    al = a[..., 3]
    lum = a[..., :3][al > 0.5].mean(1)
    edge = max(al[0].max(), al[-1].max(), al[:, 0].max(), al[:, -1].max()) > 0
    print(f, round(float(lum.min()), 3), round(float(lum.max()), 3),
          round(float((lum > 0.98).mean()), 3), round(float((lum < 0.04).mean()), 3), bool(edge))
    tiles.append(a)

# Blender images are stored bottom-up, so the first row here ends up at the bottom of the file
sheet = np.concatenate([np.concatenate([t[..., :3] * t[..., 3:] + bg * (1 - t[..., 3:]) for t in tiles], 1)
                        for bg in (0.0, 1.0)], 0)
save("sheet", sheet)
h, w = sheet.shape[:2]
save("sheet96", sheet.reshape(h // 2, 2, w // 2, 2, 3).mean((1, 3)))
print("wrote", OUTD)
