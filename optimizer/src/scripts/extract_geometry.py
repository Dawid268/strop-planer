#!/usr/bin/env python3
"""
Geometry Extraction Script v2.0
Extracts closed polygons from SVG files for formwork calculation.

Features:
- SVG parsing with full transform support
- Segment joining into closed polygons
- Area calculation using Shoelace formula
- Hole detection (clockwise orientation)
- CAD element filtering (dimensions, axes)
"""

import sys
import json
import re
import xml.dom.minidom as md
import math
from collections import defaultdict
from typing import List, Dict, Tuple, Optional, Any

# Type aliases
Point = Dict[str, float]
Segment = List[Point]
Matrix = List[float]

# Configuration
TOLERANCE = 0.5  # Distance tolerance for joining segments
MIN_POLYGON_AREA = 100  # Minimum area in square units to keep polygon
MIN_POLYGON_POINTS = 3  # Minimum points to form a polygon


def parse_transform(transform_str: Optional[str]) -> Matrix:
    """Parse SVG transform attribute into a 2D transformation matrix."""
    if not transform_str:
        return [1, 0, 0, 1, 0, 0]
    
    final_matrix = [1, 0, 0, 1, 0, 0]
    transforms = re.findall(r'(\w+)\s*\(([^)]+)\)', transform_str)
    
    for func, params_str in transforms:
        params = [float(x.strip()) for x in params_str.replace(',', ' ').split()]
        m = [1, 0, 0, 1, 0, 0]
        
        if func == 'matrix' and len(params) == 6:
            m = params
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
            if len(params) == 1:
                m = [cos_a, sin_a, -sin_a, cos_a, 0, 0]
            elif len(params) == 3:
                cx, cy = params[1], params[2]
                m1 = [1, 0, 0, 1, cx, cy]
                m2 = [cos_a, sin_a, -sin_a, cos_a, 0, 0]
                m3 = [1, 0, 0, 1, -cx, -cy]
                m = multiply_matrices(m1, multiply_matrices(m2, m3))
        
        final_matrix = multiply_matrices(final_matrix, m)
    
    return final_matrix


def multiply_matrices(m1: Matrix, m2: Matrix) -> Matrix:
    """Multiply two 2D transformation matrices."""
    a1, b1, c1, d1, e1, f1 = m1
    a2, b2, c2, d2, e2, f2 = m2
    return [
        a1*a2 + c1*b2,
        b1*a2 + d1*b2,
        a1*c2 + c1*d2,
        b1*c2 + d1*d2,
        a1*e2 + c1*f2 + e1,
        b1*e2 + d1*f2 + f1
    ]


def apply_transform(point: Point, matrix: Matrix) -> Point:
    """Apply transformation matrix to a point."""
    a, b, c, d, e, f = matrix
    return {
        "x": a * point['x'] + c * point['y'] + e,
        "y": b * point['x'] + d * point['y'] + f
    }


def distance(p1: Point, p2: Point) -> float:
    """Calculate Euclidean distance between two points."""
    return math.sqrt((p1['x'] - p2['x'])**2 + (p1['y'] - p2['y'])**2)


def points_equal(p1: Point, p2: Point, tolerance: float = TOLERANCE) -> bool:
    """Check if two points are equal within tolerance."""
    return distance(p1, p2) < tolerance


def calculate_polygon_area(points: List[Point]) -> float:
    """
    Calculate polygon area using Shoelace formula.
    Returns positive for CCW (boundary), negative for CW (hole).
    """
    if len(points) < 3:
        return 0
    
    n = len(points)
    area = 0
    for i in range(n):
        j = (i + 1) % n
        area += points[i]['x'] * points[j]['y']
        area -= points[j]['x'] * points[i]['y']
    
    return area / 2


def is_clockwise(points: List[Point]) -> bool:
    """Check if polygon points are in clockwise order (indicates a hole)."""
    return calculate_polygon_area(points) < 0


def parse_svg_path(d: str) -> List[Segment]:
    """Parse SVG path 'd' attribute into line segments."""
    tokens = re.findall(r'[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?', d)
    segments = []
    x, y, sx, sy, px, py, op = 0.0, 0.0, 0.0, 0.0, None, None, None
    i = 0
    
    while i < len(tokens):
        cmd = tokens[i]
        if cmd.isalpha():
            i += 1
            op = cmd
        
        if op in ['M', 'm']:
            if i + 1 >= len(tokens):
                break
            dx, dy = float(tokens[i]), float(tokens[i+1])
            if op == 'M':
                x, y = dx, dy
            else:
                x += dx
                y += dy
            sx, sy, px, py = x, y, x, y
            i += 2
            op = 'L' if op == 'M' else 'l'
            
        elif op in ['L', 'l', 'H', 'h', 'V', 'v']:
            if op in ['L', 'l']:
                if i + 1 >= len(tokens):
                    break
                if op == 'L':
                    nx, ny = float(tokens[i]), float(tokens[i+1])
                else:
                    nx, ny = x + float(tokens[i]), y + float(tokens[i+1])
                i += 2
            elif op in ['H', 'h']:
                if i >= len(tokens):
                    break
                if op == 'H':
                    nx, ny = float(tokens[i]), y
                else:
                    nx, ny = x + float(tokens[i]), y
                i += 1
            else:  # V, v
                if i >= len(tokens):
                    break
                if op == 'V':
                    nx, ny = x, float(tokens[i])
                else:
                    nx, ny = x, y + float(tokens[i])
                i += 1
            
            if px is not None:
                segments.append([{"x": px, "y": py}, {"x": nx, "y": ny}])
            x, y, px, py = nx, ny, nx, ny
            
        elif op in ['Z', 'z']:
            if px is not None and (abs(px - sx) > 0.01 or abs(py - sy) > 0.01):
                segments.append([{"x": px, "y": py}, {"x": sx, "y": sy}])
            x, y, px, py = sx, sy, sx, sy
            op = None
            
        elif op in ['C', 'c']:
            if i + 5 >= len(tokens):
                break
            p1x, p1y, p2x, p2y, ex, ey = [float(tokens[i+j]) for j in range(6)]
            if op == 'c':
                p1x, p1y = p1x + x, p1y + y
                p2x, p2y = p2x + x, p2y + y
                ex, ey = ex + x, ey + y
            
            # Approximate cubic Bezier with line segments
            p0 = (x, y)
            p1 = (p1x, p1y)
            p2 = (p2x, p2y)
            p3 = (ex, ey)
            lx, ly = x, y
            for t in [0.25, 0.5, 0.75, 1.0]:
                mt = 1 - t
                tx = mt**3*p0[0] + 3*mt**2*t*p1[0] + 3*mt*t**2*p2[0] + t**3*p3[0]
                ty = mt**3*p0[1] + 3*mt**2*t*p1[1] + 3*mt*t**2*p2[1] + t**3*p3[1]
                segments.append([{"x": lx, "y": ly}, {"x": tx, "y": ty}])
                lx, ly = tx, ty
            x, y, px, py = ex, ey, ex, ey
            i += 6
            
        elif op in ['S', 's']:
            if i + 3 >= len(tokens):
                break
            p2x, p2y, ex, ey = [float(tokens[i+j]) for j in range(4)]
            if op == 's':
                p2x, p2y = p2x + x, p2y + y
                ex, ey = ex + x, ey + y
            
            p0 = (x, y)
            p1 = (x, y)  # Reflection would go here
            p2 = (p2x, p2y)
            p3 = (ex, ey)
            lx, ly = x, y
            for t in [0.25, 0.5, 0.75, 1.0]:
                mt = 1 - t
                tx = mt**3*p0[0] + 3*mt**2*t*p1[0] + 3*mt*t**2*p2[0] + t**3*p3[0]
                ty = mt**3*p0[1] + 3*mt**2*t*p1[1] + 3*mt*t**2*p2[1] + t**3*p3[1]
                segments.append([{"x": lx, "y": ly}, {"x": tx, "y": ty}])
                lx, ly = tx, ty
            x, y, px, py = ex, ey, ex, ey
            i += 4
            
        elif op in ['Q', 'q']:
            if i + 3 >= len(tokens):
                break
            p1x, p1y, ex, ey = [float(tokens[i+j]) for j in range(4)]
            if op == 'q':
                p1x, p1y = p1x + x, p1y + y
                ex, ey = ex + x, ey + y
            
            p0 = (x, y)
            p1 = (p1x, p1y)
            p2 = (ex, ey)
            lx, ly = x, y
            for t in [0.33, 0.66, 1.0]:
                mt = 1 - t
                tx = mt**2*p0[0] + 2*mt*t*p1[0] + t**2*p2[0]
                ty = mt**2*p0[1] + 2*mt*t*p1[1] + t**2*p2[1]
                segments.append([{"x": lx, "y": ly}, {"x": tx, "y": ty}])
                lx, ly = tx, ty
            x, y, px, py = ex, ey, ex, ey
            i += 4
            
        elif op in ['A', 'a']:
            if i + 6 >= len(tokens):
                break
            ex, ey = float(tokens[i+5]), float(tokens[i+6])
            if op == 'a':
                ex, ey = ex + x, ey + y
            
            # Simplified: just connect start to end
            if px is not None:
                segments.append([{"x": px, "y": py}, {"x": ex, "y": ey}])
            x, y, px, py = ex, ey, ex, ey
            i += 7
        else:
            i += 1
    
    return segments


def should_ignore_element(node) -> bool:
    """
    Determine if an SVG element should be ignored (dimensions, axes, text).
    """
    if not hasattr(node, 'getAttribute'):
        return True
    
    tag = node.tagName.lower() if hasattr(node, 'tagName') else ""
    
    # Skip metadata elements
    if tag in ['defs', 'metadata', 'style', 'script', 'clippath', 'mask', 
               'text', 'tspan', 'title', 'desc', 'symbol', 'use']:
        return True
    
    # Check stroke-dasharray (dashed lines are usually axes/hidden)
    dash = node.getAttribute('stroke-dasharray')
    if dash and dash not in ['none', '']:
        return True
    
    # Check stroke-width (very thin lines are usually dimensions)
    stroke_width = node.getAttribute('stroke-width')
    if stroke_width:
        try:
            sw = float(stroke_width.replace('px', '').replace('pt', ''))
            if sw < 0.2:
                return True
        except ValueError:
            pass
    
    # Check layer/group id for dimension/axis keywords
    elem_id = node.getAttribute('id') or ''
    elem_class = node.getAttribute('class') or ''
    combined = (elem_id + ' ' + elem_class).lower()
    
    ignore_keywords = ['dimension', 'dim', 'axis', 'axes', 'osi', 'wymiar', 
                       'text', 'label', 'annotation', 'grid', 'marker']
    if any(kw in combined for kw in ignore_keywords):
        return True
    
    return False


def process_element(node, current_matrix: Matrix, all_segments: List[Segment]) -> None:
    """Recursively process SVG elements and extract line segments."""
    if not hasattr(node, 'tagName'):
        return
    
    tag = node.tagName.lower()
    
    # Check if this element should be ignored
    if should_ignore_element(node):
        return
    
    # Apply transform
    if node.getAttribute('transform'):
        current_matrix = multiply_matrices(
            current_matrix, 
            parse_transform(node.getAttribute('transform'))
        )
    
    if tag == 'path':
        d = node.getAttribute('d')
        if d:
            for s in parse_svg_path(d):
                all_segments.append([apply_transform(p, current_matrix) for p in s])
                
    elif tag == 'line':
        x1 = float(node.getAttribute('x1') or 0)
        y1 = float(node.getAttribute('y1') or 0)
        x2 = float(node.getAttribute('x2') or 0)
        y2 = float(node.getAttribute('y2') or 0)
        all_segments.append([
            apply_transform({"x": x1, "y": y1}, current_matrix),
            apply_transform({"x": x2, "y": y2}, current_matrix)
        ])
        
    elif tag == 'rect':
        x = float(node.getAttribute('x') or 0)
        y = float(node.getAttribute('y') or 0)
        w = float(node.getAttribute('width') or 0)
        h = float(node.getAttribute('height') or 0)
        if w > 0 and h > 0:
            pts = [
                {"x": x, "y": y},
                {"x": x + w, "y": y},
                {"x": x + w, "y": y + h},
                {"x": x, "y": y + h},
                {"x": x, "y": y}
            ]
            tp = [apply_transform(p, current_matrix) for p in pts]
            for i in range(4):
                all_segments.append([tp[i], tp[i+1]])
                
    elif tag == 'polygon':
        points_str = node.getAttribute('points')
        if points_str:
            coords = re.findall(r'[-+]?(?:\d*\.\d+|\d+)', points_str)
            pts = [{"x": float(coords[i]), "y": float(coords[i+1])} 
                   for i in range(0, len(coords)-1, 2)]
            if len(pts) >= 3:
                tp = [apply_transform(p, current_matrix) for p in pts]
                for i in range(len(tp)):
                    all_segments.append([tp[i], tp[(i+1) % len(tp)]])
                
    elif tag == 'polyline':
        points_str = node.getAttribute('points')
        if points_str:
            coords = re.findall(r'[-+]?(?:\d*\.\d+|\d+)', points_str)
            pts = [{"x": float(coords[i]), "y": float(coords[i+1])} 
                   for i in range(0, len(coords)-1, 2)]
            if len(pts) >= 2:
                tp = [apply_transform(p, current_matrix) for p in pts]
                for i in range(len(tp) - 1):
                    all_segments.append([tp[i], tp[i+1]])
                    
    elif tag == 'circle':
        cx = float(node.getAttribute('cx') or 0)
        cy = float(node.getAttribute('cy') or 0)
        r = float(node.getAttribute('r') or 0)
        if r > 0:
            pts = []
            for i in range(16):
                angle = 2 * math.pi * i / 16
                pts.append({"x": cx + r * math.cos(angle), 
                           "y": cy + r * math.sin(angle)})
            tp = [apply_transform(p, current_matrix) for p in pts]
            for i in range(len(tp)):
                all_segments.append([tp[i], tp[(i+1) % len(tp)]])
                
    elif tag == 'ellipse':
        cx = float(node.getAttribute('cx') or 0)
        cy = float(node.getAttribute('cy') or 0)
        rx = float(node.getAttribute('rx') or 0)
        ry = float(node.getAttribute('ry') or 0)
        if rx > 0 and ry > 0:
            pts = []
            for i in range(16):
                angle = 2 * math.pi * i / 16
                pts.append({"x": cx + rx * math.cos(angle), 
                           "y": cy + ry * math.sin(angle)})
            tp = [apply_transform(p, current_matrix) for p in pts]
            for i in range(len(tp)):
                all_segments.append([tp[i], tp[(i+1) % len(tp)]])
    
    # Recurse into children
    for child in node.childNodes:
        if child.nodeType == md.Node.ELEMENT_NODE:
            process_element(child, current_matrix, all_segments)


def build_adjacency_graph(segments: List[Segment], tolerance: float = TOLERANCE) -> Dict:
    """
    Build an adjacency graph from segments.
    Each endpoint is a node, connected segments share nodes.
    """
    # Create a spatial index for endpoints
    point_to_id = {}
    id_to_point = {}
    graph = defaultdict(list)
    next_id = 0
    
    def get_or_create_point_id(p: Point) -> int:
        nonlocal next_id
        # Find existing point within tolerance
        for pid, existing in id_to_point.items():
            if points_equal(p, existing, tolerance):
                return pid
        # Create new point
        point_to_id[(p['x'], p['y'])] = next_id
        id_to_point[next_id] = p
        next_id += 1
        return next_id - 1
    
    # Build graph
    for seg in segments:
        if len(seg) != 2:
            continue
        p1_id = get_or_create_point_id(seg[0])
        p2_id = get_or_create_point_id(seg[1])
        
        if p1_id != p2_id:  # Avoid self-loops
            graph[p1_id].append(p2_id)
            graph[p2_id].append(p1_id)
    
    return graph, id_to_point


def find_cycles(graph: Dict, id_to_point: Dict) -> List[List[Point]]:
    """
    Find all cycles (closed polygons) in the graph using DFS.
    """
    visited = set()
    cycles = []
    
    def dfs_cycle(start: int, current: int, path: List[int], visited_edges: set) -> None:
        if len(path) > 3 and current == start:
            # Found a cycle
            cycle_points = [id_to_point[pid] for pid in path]
            cycles.append(cycle_points)
            return
        
        if len(path) > 100:  # Prevent infinite loops
            return
        
        for neighbor in graph[current]:
            edge = tuple(sorted([current, neighbor]))
            if edge not in visited_edges:
                if neighbor == start and len(path) >= 3:
                    # Complete the cycle
                    cycle_points = [id_to_point[pid] for pid in path]
                    cycles.append(cycle_points)
                elif neighbor not in path:
                    visited_edges.add(edge)
                    dfs_cycle(start, neighbor, path + [neighbor], visited_edges)
                    visited_edges.discard(edge)
    
    # Start DFS from each node
    for start_node in graph.keys():
        if start_node not in visited:
            visited_edges = set()
            dfs_cycle(start_node, start_node, [start_node], visited_edges)
            visited.add(start_node)
    
    return cycles


def join_segments_to_polygons(segments: List[Segment], tolerance: float = TOLERANCE) -> List[Dict]:
    """
    Join line segments into closed polygons.
    Returns list of polygon objects with points, area, and hole flag.
    """
    if not segments:
        return []
    
    graph, id_to_point = build_adjacency_graph(segments, tolerance)
    
    # Find all cycles
    cycles = find_cycles(graph, id_to_point)
    
    # Convert to polygon objects
    polygons = []
    seen_areas = set()  # Avoid duplicate polygons
    
    for points in cycles:
        if len(points) < MIN_POLYGON_POINTS:
            continue
        
        area = calculate_polygon_area(points)
        abs_area = abs(area)
        
        # Skip small polygons
        if abs_area < MIN_POLYGON_AREA:
            continue
        
        # Skip duplicates (same area within tolerance)
        area_key = round(abs_area, 1)
        if area_key in seen_areas:
            continue
        seen_areas.add(area_key)
        
        # Calculate perimeter
        perimeter = sum(distance(points[i], points[(i+1) % len(points)]) 
                       for i in range(len(points)))
        
        polygons.append({
            "points": points,
            "area": abs_area,
            "perimeter": round(perimeter, 2),
            "is_hole": area < 0,  # CW = hole
            "point_count": len(points)
        })
    
    # Sort by area (largest first)
    polygons.sort(key=lambda p: -p['area'])
    
    return polygons


def extract_geometry(file_path: str) -> None:
    """Main extraction function."""
    try:
        dom = md.parse(file_path)
        svg = dom.getElementsByTagName('svg')[0]
        
        # Get dimensions
        width_str = svg.getAttribute('width') or '1000'
        height_str = svg.getAttribute('height') or '1000'
        vw = float(re.sub(r'[a-zA-Z]+', '', width_str) or 1000)
        vh = float(re.sub(r'[a-zA-Z]+', '', height_str) or 1000)
        
        # Parse viewBox
        vb = svg.getAttribute('viewBox')
        if vb:
            vb_parts = vb.replace(',', ' ').split()
            vbx = float(vb_parts[0]) if len(vb_parts) >= 4 else 0
            vby = float(vb_parts[1]) if len(vb_parts) >= 4 else 0
            vbw = float(vb_parts[2]) if len(vb_parts) >= 4 else vw
            vbh = float(vb_parts[3]) if len(vb_parts) >= 4 else vh
        else:
            vbx, vby, vbw, vbh = 0, 0, vw, vh
        
        # Extract segments
        all_segments: List[Segment] = []
        process_element(svg, [1, 0, 0, 1, -vbx, -vby], all_segments)
        
        # Join segments into polygons
        polygons = join_segments_to_polygons(all_segments)
        
        # Separate boundaries and holes
        boundaries = [p for p in polygons if not p['is_hole']]
        holes = [p for p in polygons if p['is_hole']]
        
        # Output result
        result = {
            "polygons": boundaries,
            "holes": holes,
            "segments": all_segments,  # Keep raw segments for debugging
            "metadata": {
                "width": vw,
                "height": vh,
                "viewBox": f"{vbx} {vby} {vbw} {vbh}",
                "segmentCount": len(all_segments),
                "polygonCount": len(boundaries),
                "holeCount": len(holes),
                "version": "2.0"
            }
        }
        
        print(json.dumps(result))
        
    except Exception as e:
        import traceback
        print(json.dumps({
            "error": str(e), 
            "trace": traceback.format_exc(),
            "version": "2.0"
        }))


if __name__ == "__main__":
    if len(sys.argv) > 1:
        extract_geometry(sys.argv[1])
    else:
        print(json.dumps({"error": "No input file provided", "version": "2.0"}))
