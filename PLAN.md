# RenderLab Plan

One step per session. Do not start the next step on your own.

- [x] 1. Math lib: scaffold Vite app, vec3, mat4, quat in src/core/math with tests (dot, cross, outer product, multiply, determinant, inverse)
- [x] 2. Rasterizer + rotating cube: framebuffer, setPixel, canvas display, perspective projection, rotating wireframe cube
- [x] 3. Bresenham lab: pick two points on a zoomable pixel grid, step through with error value shown, compare with canvas line
- [x] 4. Culling lab: normals via cross/outer product, signed-area test, front faces green, back faces red, toggle culling, triangle count before and after
- [x] 5. Alpha lab: layer sliders for color, opacity, order, show formula and blended RGB, composite over the 3D scene
- [x] 6. Visvalingam-Whyatt lab: polygon or coastline, slider for target vertex count, show triangle areas, original vs simplified side by side
- [x] 7. Transforms lab: translate/rotate/scale/shear/reflect, rotation about arbitrary pivot, live matrix and determinant display
- [x] 8. Quaternion lab: same rotation via Euler and quaternion, show gimbal lock, slerp animation
- [x] 8b. Engine skin: restyle the whole app to look like a game engine editor: top bar, left lab list, centre viewport, right inspector, bottom console
- [ ] 9. Scene editor + demo scene: cube, sphere, plane, select, properties panel, one low-poly city scene
- [ ] 10. Benchmark panel: frame time, triangle counts, culling on/off, simplification before/after, export results as CSV
- [ ] 11. Polish + report notes: UI polish, tab layout, README, notes for report
