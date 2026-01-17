import sys
import json
import re
import xml.dom.minidom as md
import math

def parse_transform(transform_str):
    if not transform_str: return [1, 0, 0, 1, 0, 0]
    final_matrix = [1, 0, 0, 1, 0, 0]
    transforms = re.findall(r'(\w+)\s*\(([^)]+)\)', transform_str)
    for func, params_str in transforms:
        params = [float(x.strip()) for x in params_str.replace(',', ' ').split()]
        m = [1, 0, 0, 1, 0, 0]
        if func == 'matrix' and len(params) == 6: m = params
        elif func == 'translate':
            tx = params[0]
            ty = params[1] if len(params) > 1 else 0
            m = [1, 0, 0, 1, tx, ty]
        elif func == 'scale':
            sx = params[0]
            sy = params[1] if len(params) > 1 else sx
            m = [sx, 0, 0, sy, 0, 0]
        elif func == 'rotate':
            angle = math.radians(params[0])
            cos_a, sin_a = math.cos(angle), math.sin(angle)
            if len(params) == 1: m = [cos_a, sin_a, -sin_a, cos_a, 0, 0]
            elif len(params) == 3:
                cx, cy = params[1], params[2]
                m1, m2, m3 = [1, 0, 0, 1, cx, cy], [cos_a, sin_a, -sin_a, cos_a, 0, 0], [1, 0, 0, 1, -cx, -cy]
                m = multiply_matrices(m1, multiply_matrices(m2, m3))
        final_matrix = multiply_matrices(final_matrix, m)
    return final_matrix

def multiply_matrices(m1, m2):
    a1, b1, c1, d1, e1, f1 = m1
    a2, b2, c2, d2, e2, f2 = m2
    return [a1*a2+c1*b2, b1*a2+d1*b2, a1*c2+c1*d2, b1*c2+d1*d2, a1*e2+c1*f2+e1, b1*e2+d1*f2+f1]

def apply_transform(point, matrix):
    a, b, c, d, e, f = matrix
    return {"x": a * point['x'] + c * point['y'] + e, "y": b * point['x'] + d * point['y'] + f}

def parse_svg_path(d):
    tokens = re.findall(r'[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?', d)
    segments = []
    x, y, sx, sy, px, py, op = 0, 0, 0, 0, None, None, None
    i = 0
    while i < len(tokens):
        cmd = tokens[i]
        if cmd.isalpha(): i += 1; op = cmd
        if op in ['M', 'm']:
            if i+1 >= len(tokens): break
            dx, dy = float(tokens[i]), float(tokens[i+1])
            if op == 'M': x, y = dx, dy
            else: x += dx; y += dy
            sx, sy, px, py = x, y, x, y
            i += 2; op = 'L' if op == 'M' else 'l'
        elif op in ['L', 'l', 'H', 'h', 'V', 'v']:
            if op in ['L', 'l']:
                if i+1 >= len(tokens): break
                nx, ny = (float(tokens[i]), float(tokens[i+1])) if op == 'L' else (x+float(tokens[i]), y+float(tokens[i+1]))
                i += 2
            elif op in ['H', 'h']:
                if i >= len(tokens): break
                nx, ny = (float(tokens[i]), y) if op == 'H' else (x+float(tokens[i]), y)
                i += 1
            else: # V, v
                if i >= len(tokens): break
                nx, ny = (x, float(tokens[i])) if op == 'V' else (x, y+float(tokens[i]))
                i += 1
            if px is not None: segments.append([{"x": px, "y": py}, {"x": nx, "y": ny}])
            x, y, px, py = nx, ny, nx, ny
        elif op in ['Z', 'z']:
            if px is not None and (abs(px-sx)>0.1 or abs(py-sy)>0.1): segments.append([{"x": px, "y": py}, {"x": sx, "y": sy}])
            x, y, px, py = sx, sy, sx, sy
            op = None
        elif op in ['C', 'c']:
            if i+5 >= len(tokens): break
            p1x, p1y, p2x, p2y, ex, ey = [float(tokens[i+j]) for j in range(6)]
            if op == 'c': p1x+=x; p1y+=y; p2x+=x; p2y+=y; ex+=x; ey+=y
            p0, p1, p2, p3 = (x, y), (p1x, p1y), (p2x, p2y), (ex, ey)
            lx, ly = x, y
            for t in [0.33, 0.66, 1.0]:
                mt = 1-t
                tx = mt**3*p0[0] + 3*mt**2*t*p1[0] + 3*mt*t**2*p2[0] + t**3*p3[0]
                ty = mt**3*p0[1] + 3*mt**2*t*p1[1] + 3*mt*t**2*p2[1] + t**3*p3[1]
                segments.append([{"x": lx, "y": ly}, {"x": tx, "y": ty}])
                lx, ly = tx, ty
            x, y, px, py = ex, ey, ex, ey
            i += 6
        else: i += 1
    return segments

def process_element(node, current_matrix, all_segments):
    tag = node.tagName.lower() if hasattr(node, 'tagName') else ""
    if tag in ['defs', 'metadata', 'style', 'script', 'clippath', 'mask']: return
    if hasattr(node, 'getAttribute') and node.getAttribute('transform'):
        current_matrix = multiply_matrices(current_matrix, parse_transform(node.getAttribute('transform')))
    if tag == 'path':
        d = node.getAttribute('d')
        if d:
            for s in parse_svg_path(d): all_segments.append([apply_transform(p, current_matrix) for p in s])
    elif tag == 'line':
        x1, y1 = float(node.getAttribute('x1') or 0), float(node.getAttribute('y1') or 0)
        x2, y2 = float(node.getAttribute('x2') or 0), float(node.getAttribute('y2') or 0)
        all_segments.append([apply_transform(p, current_matrix) for p in [{"x": x1, "y": y1}, {"x": x2, "y": y2}]])
    elif tag == 'rect':
        x, y, w, h = float(node.getAttribute('x') or 0), float(node.getAttribute('y') or 0), float(node.getAttribute('width') or 0), float(node.getAttribute('height') or 0)
        if w > 0.1 and h > 0.1:
            pts = [{"x": x, "y": y}, {"x": x+w, "y": y}, {"x": x+w, "y": y+h}, {"x": x, "y": y+h}, {"x": x, "y": y}]
            tp = [apply_transform(p, current_matrix) for p in pts]
            for i in range(4): all_segments.append([tp[i], tp[i+1]])
    for child in node.childNodes:
        if child.nodeType == md.Node.ELEMENT_NODE: process_element(child, current_matrix, all_segments)

def join_segments(segments):
    if not segments: return []
    polylines = []
    if not segments: return []
    current_poly = list(segments[0])
    for i in range(1, len(segments)):
        prev_end = current_poly[-1]
        next_start = segments[i][0]
        if abs(prev_end['x'] - next_start['x']) < 0.1 and abs(prev_end['y'] - next_start['y']) < 0.1:
            current_poly.append(segments[i][1])
        else:
            polylines.append(current_poly)
            current_poly = list(segments[i])
    polylines.append(current_poly)
    return polylines

def extract_geometry(file_path):
    try:
        dom = md.parse(file_path)
        svg = dom.getElementsByTagName('svg')[0]
        vw, vh = float(svg.getAttribute('width') or 1000), float(svg.getAttribute('height') or 1000)
        vb = svg.getAttribute('viewBox').replace(',', ' ').split()
        vbx, vby = float(vb[0]) if len(vb)>=4 else 0, float(vb[1]) if len(vb)>=4 else 0
        vbw, vbh = float(vb[2]) if len(vb)>=4 else vw, float(vb[3]) if len(vb)>=4 else vh
        all_segs = []
        process_element(svg, [1, 0, 0, 1, -vbx, -vby], all_segs)
        # Filter: 1. Length 2. Bounds (clip to viewBox + 10% margin)
        margin_x, margin_y = vbw * 0.1, vbh * 0.1
        final_segs = []
        for s in all_segs:
            l = ((s[1]['x']-s[0]['x'])**2 + (s[1]['y']-s[0]['y'])**2)**0.5
            if 0.5 < l < 1500: # Max length 1500 to catch CAD artifacts
                mid_x, mid_y = (s[0]['x']+s[1]['x'])/2, (s[0]['y']+s[1]['y'])/2
                if -margin_x < mid_x < vbw + margin_x and -margin_y < mid_y < vbh + margin_y:
                    final_segs.append(s)
        # Join into polylines to reduce object count
        polys = join_segments(final_segs)
        print(json.dumps({"polygons": polys, "metadata": {"width": vw, "height": vh, "viewBox": f"0 0 {vbw} {vbh}", "segmentCount": len(final_segs), "polyCount": len(polys)}}))
    except Exception as e: print(json.dumps({"error": str(e)}))

if __name__ == "__main__":
    if len(sys.argv) > 1: extract_geometry(sys.argv[1])
