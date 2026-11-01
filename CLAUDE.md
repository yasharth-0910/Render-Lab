# RenderLab
Browser-based computer graphics lab for a Geometric Algebra for Computer Graphics PBL.

## Rules
- Stack: Vite + React + TypeScript + Vitest. No Three.js, no WebGL.
- All rendering is a CPU software rasterizer writing pixels into a Uint8ClampedArray, shown on a canvas via ImageData.
- Never commit. Never run git add or git commit.
- Algorithms live in src/core/ as pure TypeScript, zero React or DOM imports. UI lives in src/ui/.
- Every algorithm gets a Vitest file with real test cases.
- Every algorithm must be able to run step by step (return a list of steps) so the UI can animate it.
- Keep code simple and commented in plain language. I have to explain every line in a viva.
- Update PLAN.md checkboxes when a step is done.

## Required algorithms (hand written, no libraries)
Alpha compositing, back-face culling, Bresenham line, Visvalingam-Whyatt.

## Other course topics to show
2D/3D transforms, rotation about arbitrary point/axis, determinants of rotation and shear, vector spaces, quaternions vs Euler, outer product (triangle area, normals).

## Steps
1 math lib, 2 rasterizer + rotating cube, 3 Bresenham lab, 4 culling lab, 5 alpha lab, 6 Visvalingam-Whyatt lab, 7 transforms lab, 8 quaternion lab, 9 scene editor + demo scene, 10 benchmark panel, 11 polish + report notes

## UI rules
- Every lab uses one shared layout: big canvas on the left, a narrow control panel on the right with only that lab's controls, a one-line stats strip under the canvas, and a small formula box at the bottom of the panel.
- Keep it simple. No nested panels, popups, dockable windows, or trees. Plain labels, few controls, sensible defaults so a lab looks good on first open.
- Side-by-side comparisons (before/after) show a big number above each side, like the vertex count.
- Stats text sits in a corner overlay on the canvas (FPS, triangles, frame time).
- Dark neutral background, one accent colour, readable font sizes.
- Build the shared pieces once in src/ui/components/ (LabLayout, StatsStrip, FormulaBox, NumberRow) and reuse them. Old labs are retrofitted in step 11, don't touch them until then.
