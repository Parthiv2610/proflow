"""Generate the ProFlow app icon (PNG + ICO) using Pillow."""
from PIL import Image, ImageDraw, ImageFont
import os

SIZE = 512
OUT_DIR = os.path.dirname(os.path.abspath(__file__))

# ProFlow brand colors (dark theme purple palette)
BG_DARK = (26, 22, 38)       # --sidebar background
PRIMARY = (120, 60, 210)     # purple accent
PRIMARY_LIGHT = (160, 110, 240)
WHITE = (245, 245, 250)


def create_icon():
    img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # --- Background rounded square ---
    margin = 32
    radius = 80
    rect = [margin, margin, SIZE - margin, SIZE - margin]

    # Draw rounded rectangle manually
    draw.rounded_rectangle(rect, radius=radius, fill=BG_DARK)

    # --- Inner glow / gradient effect (concentric circles) ---
    cx, cy = SIZE // 2, SIZE // 2
    for r in range(180, 60, -6):
        alpha = max(0, int(30 * (1 - (180 - r) / 120)))
        draw.ellipse(
            [cx - r, cy - r, cx + r, cy + r],
            fill=(PRIMARY[0], PRIMARY[1], PRIMARY[2], alpha),
        )

    # --- Central "P" letterform made of overlapping circles (flow motif) ---
    # Three interconnected nodes representing flow
    dot_r = 36

    # Node positions (triangle layout)
    nodes = [
        (cx - 70, cy - 40),  # top-left
        (cx + 70, cy - 40),  # top-right
        (cx, cy + 60),       # bottom-center
    ]

    # Draw connecting lines first (behind dots)
    for i in range(3):
        for j in range(i + 1, 3):
            draw.line([nodes[i], nodes[j]], fill=PRIMARY_LIGHT, width=12)

    # Draw glow behind dots
    for nx, ny in nodes:
        draw.ellipse(
            [nx - dot_r - 8, ny - dot_r - 8, nx + dot_r + 8, ny + dot_r + 8],
            fill=(PRIMARY[0], PRIMARY[1], PRIMARY[2], 60),
        )

    # Draw dots
    for nx, ny in nodes:
        draw.ellipse(
            [nx - dot_r, ny - dot_r, nx + dot_r, ny + dot_r],
            fill=PRIMARY,
        )
        draw.ellipse(
            [nx - dot_r + 8, ny - dot_r + 8, nx + dot_r - 8, ny + dot_r - 8],
            fill=PRIMARY_LIGHT,
        )

    # --- Small flowing arcs between nodes (energy lines) ---
    arc_colors = [
        (PRIMARY_LIGHT[0], PRIMARY_LIGHT[1], PRIMARY_LIGHT[2], 100),
        (PRIMARY_LIGHT[0], PRIMARY_LIGHT[1], PRIMARY_LIGHT[2], 70),
        (PRIMARY_LIGHT[0], PRIMARY_LIGHT[1], PRIMARY_LIGHT[2], 50),
    ]
    for i, (x1, y1) in enumerate(nodes):
        x2, y2 = nodes[(i + 1) % 3]
        mx, my = (x1 + x2) // 2, (y1 + y2) // 2
        # Small arc
        draw.arc(
            [mx - 20, my - 20, mx + 20, my + 20],
            start=0, end=180,
            fill=arc_colors[i],
            width=3,
        )

    # --- Save PNG ---
    png_path = os.path.join(OUT_DIR, "icon.png")
    img.save(png_path, "PNG")
    print(f"Created {png_path}  ({SIZE}x{SIZE})")

    # --- Generate ICO from the PNG ---
    ico_sizes = [256, 128, 64, 48, 32, 16]
    ico_images = []
    for s in ico_sizes:
        resized = img.resize((s, s), Image.LANCZOS)
        ico_images.append(resized)

    ico_path = os.path.join(OUT_DIR, "icon.ico")
    ico_images[0].save(
        ico_path,
        format="ICO",
        sizes=[(s, s) for s in ico_sizes],
        append_images=ico_images[1:],
    )
    print(f"Created {ico_path}  (sizes: {ico_sizes})")


if __name__ == "__main__":
    create_icon()
