# Rebuild this design

This directory contains the accepted specification, recipe version, editable TypeScript and Python source, a bundled mesh builder, and exact dependency locks. It needs no AI account.

With Node.js 22 or later installed, run `npm ci`, then `npm run rebuild`. The output folder contains the GLB and validation report, optional STL, and a constructive-solid plan for mechanical recipes. The source files are supplied for modification; rebuild.mjs is the precompiled implementation shipped with this recipe version. To compile modified sources use esbuild: `npx esbuild source/recipes/rebuild.ts --bundle --platform=node --format=esm --packages=external --outfile=rebuild.mjs`.

Dimensions and STL are millimetres. GLB uses metres, right-handed coordinates, +Y up and +Z front. Assembly transforms are baked. Paneled-ball STL is a visual surface mesh, not an inflatable-ball fabrication design.

For solid STEP, create a Python 3.12 environment, install `cad-requirements.lock` with pip, and run `python -I cad_worker.py output`. For three still images from the actual GLB, use a separate Python 3.13 environment with `render-requirements.lock`, then `python -I render_worker.py output`. The adapters execute only these supplied programs. The container, enclosure and cradle support STEP; the paneled ball is a surface recipe.

Geometry validation checks the exported artifact. It does not certify tolerances, strength, printability, electrical safety, supplier availability or physical fit. Read validation.json and the project's intent and handoff documents before fabrication.
