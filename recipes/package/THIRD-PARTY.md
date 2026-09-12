# Workshop dependencies

- Manifold 3.5.3: Apache-2.0. Geometry kernel distributed as JavaScript/WASM. https://github.com/elalish/manifold
- glTF Transform 4.5.0: MIT. GLB serialization and independent reload. https://github.com/donmccurdy/glTF-Transform
- Zod 4.3.6: MIT. Typed input validation. https://github.com/colinhacks/zod
- CadQuery 2.6.1: Apache-2.0; optional locally installed adapter. OpenCascade bindings and their dependencies have separate license notices retained in the runtime distribution. https://github.com/CadQuery/cadquery
- Blender/bpy 5.2.1: GPL. Optional separately installed local program; Holo exchanges files with it through a subprocess. Holo does not bundle the bpy wheel in its app or project export. https://www.blender.org/about/license/

Dependency packages retain their upstream license notices. The npm and Python locks enumerate transitive dependencies. This inventory is not a legal conclusion about a future public distribution; review the licenses of bundled components before changing the distribution model.
