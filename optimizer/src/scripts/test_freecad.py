import sys
sys.path.append('/usr/lib/freecad/lib')

try:
    import FreeCAD
    print(f"FreeCAD loaded successfully. Version: {FreeCAD.Version()}")
except ImportError as e:
    print(f"Failed to import FreeCAD: {e}")
except Exception as e:
    print(f"An error occurred: {e}")
