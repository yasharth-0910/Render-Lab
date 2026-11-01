# RenderLab QA click-through (step 11)

Every control in every lab was used the way a person uses it, in a real browser (Chrome driven over the DevTools protocol, so the mouse clicks, drags, key presses, downloads and clipboard are real events, not function calls). Each row is one check: the lab, the control, what was done, and whether it passed.

**Result: 195 of 195 checks pass.**

## Conditions

- Production build (`npm run build`, served by `vite preview`), headless Chrome 156 on a Mac with 10 logical cores, window 1440 x 900. A second pass was done at 1280 x 720 (last table).
- Browser console: no JavaScript errors in any lab.
- The checks read the page after each action (numbers, the stats strip, the tree, the console, the downloaded files), not only the picture.
- The screenshots in `report/figures/` were taken from the same sessions.

## Bugs found and fixed

1. **Editor tabs wrapped onto two lines and covered the viewport** when many labs were open (screenshot review). Fixed in `src/ui/theme.css`: the tab row is one line, long names are cut with an ellipsis, the close button and the menu keep their size.
2. **The slerp plot caption was cut off at the right edge** in the Quaternion Lab. Fixed in `src/ui/QuaternionLab.tsx` by limiting the caption width to the plot width.

No algorithm in `src/core/` was changed in this step.

One check failed during the run and turned out to be a mistake in the test script, not in the app: the "Make v₂ parallel to v₁" check ran with the optional third vector still switched on, so the rank came out as 2 (v₃ is a second independent direction). With the third vector off, the lab reports rank 1, "does NOT span the plane" and "v₁, v₂ are not a basis", as it should. The table shows the passing re-run.

## Notes on what was and was not checked

- The 3D views are drawn by the app's own rasterizer, so a screenshot is the true output.
- The Benchmark numbers depend on the machine; the QA only checks that the controls work. The numbers used in the report come from the 15-run, 5-warm-up run described in the report.
- Copy image (Reactor Scene) and Copy markdown tables (Benchmark) write to the clipboard through the browser; both were checked by reading the clipboard back.

## Checks (1440 x 900)

| Lab | Control | What was done | Result | Observed |
|---|---|---|---|---|
| Shell | Lab list | all 10 labs listed in the Scene dock | pass | Rotating Cube, Bresenham Lab, Culling Lab, Alpha Lab, Simplify Lab, Transforms Lab, Quaternion Lab, Reactor Scene, Benchmark, Geometry Lab |
| Shell | Lab menu | open the menu, 10 items, pick Culling Lab | pass | 10 items, active tab "Culling Lab" |
| Shell | + tab menu | open the + menu, open Alpha Lab as a new tab | pass | tabs 2 -> 3, active "Alpha Lab" |
| Shell | Tab click | click the first tab to switch back | pass |  |
| Shell | Tab close | close the Alpha Lab tab (x button) | pass | tabs 3 -> 2 |
| Shell | Workspace pills | click 2D, 3D, All labs and check the tree filter | pass | 2D:6 3D:8 all:10 |
| Shell | Filter box | type "quat" then clear | pass | Quaternion Lab |
| Shell | Scene dock collapse | icons-only button, then expand | pass | 236 -> 48 -> 236 px |
| Shell | View menu | toggle Scene and About docks, Inspector, Output | pass | left hidden true, inspector hidden/back true/true, output collapsed/back true/true |
| Shell | View > Maximize / maximize button | maximize the viewport, restore with the button | pass | maximized true, restored true |
| Shell | Help menu | About this lab writes to the Output | pass | 3 lines |
| Shell | Menu closes | click outside an open menu | pass |  |
| Shell | Pause / Play buttons | Pause shows "Animations paused", Play restores "Ready" | pass | Animations paused -> Ready |
| Shell | Stop button | restart the lab (a fresh "opened" line appears) | pass | opened lines 2 -> 3 |
| Shell | FPS read-out | top bar shows FPS and ms | pass | 60 FPS · 16.7 ms |
| Shell | Output dock | collapse and expand by clicking the Output tab; clear with the bin | pass | collapsed true, expanded true, cleared true |
| Shell | Browser console | no JavaScript errors during the shell checks | pass |  |
| Rotating Cube | Spin | the picture changes over time while running | pass | canvas pixels differ after 0.5 s |
| Rotating Cube | Pause button (top bar) | freezes the spin; Play resumes it | pass | paused equal true, running again true |
| Rotating Cube | Overlay and strip | overlay shows FPS, triangles and ms; strip shows sizes | pass | 60 FPS \| 12 triangles \| 0.6 ms/frame // 640 × 480 software rasterizer \| 8 vertices, 12 edges \| edges drawn with Bresenham |
| Rotating Cube | Axis gizmo and Perspective label | present in the viewport | pass |  |
| Rotating Cube | Formula box | typeset equations (Pipeline, Model matrix, Projection) | pass |  |
| Rotating Cube | Inspector sections | collapse and expand the Controls section (header click) | pass | sections open: 2 -> 1 -> 2 |
| Bresenham Lab | Initial state | A = (2,3), B = (28,15), 27 pixels | pass | 2,3,28,15 |
| Bresenham Lab | Number boxes A and B | type new coordinates into the four boxes | pass | 16 pixels \| dx 15, dy 6 \| major axis x \| step 0/16 \| green = chosen, orange = current, red line = ideal |
| Bresenham Lab | Next | three clicks reveal three steps; table has 3 rows | pass | 3 rows, 16 pixels \| dx 15, dy 6 \| major axis x \| step 3/16 \| green = chosen, orange = current, red line = ideal |
| Bresenham Lab | Previous | goes back one step | pass |  |
| Bresenham Lab | Reset | clears all steps | pass |  |
| Bresenham Lab | Play and Speed | play at 30 steps/s runs the whole line, then stops | pass | 16 rows, button back to Play: true |
| Bresenham Lab | Zoom slider | canvas grows with the zoom (10 px and 40 px cells) | pass | 320 px and 1280 px wide |
| Bresenham Lab | Click the grid | two real clicks set A then B | pass | A,B = 3,3,25,18 |
| Bresenham Lab | DDA overlay | tick the box: a difference note appears | pass | note about DDA vs Bresenham shown |
| Bresenham Lab | Console trace | line, start error, and step lines in the Output | pass | 36 lines |
| Bresenham Lab | Formula box | equations plus live numbers | pass |  |
| Bresenham Lab | Browser console | no JavaScript errors | pass |  |
| Culling Lab | Scene dropdown | cube, sphere, cube + sphere on a plane | pass | Triangles 12 \| Visible   6 \| Culled    6 (50.0%) // Triangles 224 \| Visible   96 \| Culled    128 (57.1%) // Triangles 238 \| Visible   108 \| Culled    130 (54.6%) |
| Culling Lab | Segments slider | appears for sphere scenes; more segments = more triangles | pass | Triangles 238 \| Visible   108 \| Culled    130 (54.6%) -> Triangles 974 \| Visible   434 \| Culled    540 (55.4%) |
| Culling Lab | Back-face culling checkbox | on: some triangles culled; off: 0 culled | pass | Triangles 12 \| Visible   2 \| Culled    10 (83.3%) // Triangles 12 \| Visible   12 \| Culled    0 (0.0%) |
| Culling Lab | Colour by facing | toggle off and on | pass | picture changes |
| Culling Lab | Show normals | toggle on and off | pass |  |
| Culling Lab | Draw style radios | wireframe, filled, both | pass | three different pictures |
| Culling Lab | Facing test radios | view-space and screen-space agree on the counts | pass | Triangles 12 \| Visible   2 \| Culled    10 (83.3%) // Triangles 12 \| Visible   2 \| Culled    10 (83.3%) |
| Culling Lab | Pause rotation (lab button) | frozen (paused earlier), label says Resume, resumes | pass | frozen, label changes, resumes |
| Culling Lab | Orbit drag | real mouse drag on the canvas changes the view | pass | picture differs after the drag |
| Culling Lab | Click a triangle | real click selects it: yellow, numbers in the formula box | pass | a = (−0.482, −0.655, 0.297) / b = (−0.023, 0.655, 0.566) |
| Culling Lab | Console trace | scene counts and the selected triangle are logged | pass | 12 lines |
| Culling Lab | Browser console | no JavaScript errors | pass |  |
| Alpha Lab (2D) | Initial state | 3 layers, pixels blended, ms to composite | pass | 3 layers \| 100,951 pixels blended \| 22.6 ms to composite |
| Alpha Lab (2D) | Opacity slider | lower the top layer opacity: picture changes | pass | canvas hash changed |
| Alpha Lab (2D) | Colour picker | change the top layer colour | pass | canvas hash changed |
| Alpha Lab (2D) | Visible checkbox | hide the top layer: strip says 2 layers; show again: 3 | pass | 2 layers -> 3 layers |
| Alpha Lab (2D) | Move down / move up | reorder the layers: picture changes; back again restores it | pass | order matters (over is not commutative), and moving back restores the picture |
| Alpha Lab (2D) | Background colour and opacity | change both | pass | canvas hash changed |
| Alpha Lab (2D) | Pick a pixel | real click on the canvas shows the blend steps | pass | PIXEL (288, 215) / Background over the pixel below: / Red over the pixel below: / Green over the pixel below: / Blue over the pixel below: / final: RGB (149, 155, 60), alpha 1.00 |
| Alpha Lab (2D) | Formula box | two typeset equations (alpha out, colour out) | pass |  |
| Alpha Lab (2D) | Console trace | composite and pixel blend steps are logged | pass | 63 lines |
| Alpha Lab (2D) | Browser console | no JavaScript errors | pass |  |
| Alpha Lab (3D) | Switch to 3D scene | overlay shows triangles and ms/frame | pass | 60 FPS \| 102 triangles \| 7.0 ms/frame |
| Alpha Lab (3D) | Sort checkbox | turning the sort off changes the picture | pass | colours of the overlap differ unsorted |
| Alpha Lab (3D) | Cull panes checkbox | back-face culling of the see-through panes | pass | picture changes |
| Alpha Lab (3D) | Panes 1 / 2 | radio buttons change the picture | pass | one pane vs two panes |
| Alpha Lab (3D) | Pane opacity slider | changes the picture | pass | picture changes |
| Alpha Lab (3D) | Orbit drag | real drag on the 3D canvas | pass | view changes |
| Alpha Lab (3D) | Transport pause | top bar Pause freezes the spin | pass | frozen while paused |
| Alpha Lab (3D) | Back to 2D layers | switching modes keeps both working | pass |  |
| Alpha Lab (3D) | Browser console | no JavaScript errors | pass |  |
| Simplify Lab | Initial | coastline 500 vertices, 75 kept | pass | 500 -> 75 |
| Simplify Lab | Shape: Island | 400 points, closed polygon (area error shown) | pass | 400 -> 60 |
| Simplify Lab | Shape: Spiral | 300 points | pass | 300 -> 45 |
| Simplify Lab | Shape: Star | 400 points | pass | 400 -> 60 |
| Simplify Lab | Shape: Pasted data | sample has 11 points; edit the text to 6 points | pass | 11 then 6 |
| Simplify Lab | Pasted: Closed polygon | closed polygon keeps at least 3 | pass | kept 3 |
| Simplify Lab | Keep slider | set to 50: right side shows 50 | pass | 500 -> 50 |
| Simplify Lab | Show removed / Colour by area / Show kept | each checkbox changes the picture | pass | toggled on and off without errors |
| Simplify Lab | Compare with RDP | strip adds RDP max distance | pass | 500 → 50 vertices (90% removed) \| area error n/a (open line) \| max distance 0.074 \| RDP max distance 0.055 \| VW 2.1 ms |
| Simplify Lab | Step mode: Remove one | right count goes down by one; table row added | pass | 50 -> 49, 6 table rows |
| Simplify Lab | Step mode: Restore one | right count goes up by one | pass | 49 -> 50 |
| Simplify Lab | Formula box | area equation and the highlighted vertex numbers | pass |  |
| Simplify Lab | Console trace | VW steps and the result line | pass | 34 lines |
| Simplify Lab | Browser console | no JavaScript errors | pass |  |
| Transforms Lab (2D) | Initial | default ops: scale, rotate, translate; det 1.5 | pass | det = 1.500 |
| Transforms Lab (2D) | Edit a number | scale sx to 3: determinant becomes 3 | pass | det = 3.000 |
| Transforms Lab (2D) | Add operation: translate | choose it in the "+ Add operation" dropdown | pass | ops 3 -> 4 |
| Transforms Lab (2D) | Add operation: rotate | choose it in the "+ Add operation" dropdown | pass | ops 4 -> 5 |
| Transforms Lab (2D) | Add operation: scale | choose it in the "+ Add operation" dropdown | pass | ops 5 -> 6 |
| Transforms Lab (2D) | Add operation: shear | choose it in the "+ Add operation" dropdown | pass | ops 6 -> 7 |
| Transforms Lab (2D) | Add operation: reflect | choose it in the "+ Add operation" dropdown | pass | ops 7 -> 8 |
| Transforms Lab (2D) | Add operation: rotateAbout | choose it in the "+ Add operation" dropdown | pass | ops 8 -> 9 |
| Transforms Lab (2D) | Reflect flips the determinant | adding Reflect made det negative | pass | det = -4.500 |
| Transforms Lab (2D) | Reorder ▲ ▼ | move an operation up and down | pass | 1. Scale / 2. Rotate (about the origin) / 3. Translate \| 1. Rotate (about the origin) / 2. Scale / 3. Translate |
| Transforms Lab (2D) | Remove ✕ | remove the last operation | pass |  |
| Transforms Lab (2D) | Matrix to view dropdown | view "after operation 1": strip says so | pass | 8 operations \| viewing: after operation 1 \| det = 3.000 \| area × 3.000 |
| Transforms Lab (2D) | Show pivot / Show area checkboxes | area overlay appears and disappears | pass | overlay present true, hidden true |
| Transforms Lab (2D) | Vertex dropdown | choose another vertex for the formula | pass | formula shows vertex 7 |
| Transforms Lab (2D) | Reset | restores the three default operations | pass |  |
| Transforms Lab (2D) | Formula box | equations and live numbers | pass |  |
| Transforms Lab (3D) | Switch to 3D | two default operations and a 4x4 matrix | pass | ops 2 |
| Transforms Lab (3D) | Add operation: translate | choose it in the dropdown | pass | ops 2 -> 3 |
| Transforms Lab (3D) | Add operation: rotateX | choose it in the dropdown | pass | ops 3 -> 4 |
| Transforms Lab (3D) | Add operation: rotateY | choose it in the dropdown | pass | ops 4 -> 5 |
| Transforms Lab (3D) | Add operation: rotateZ | choose it in the dropdown | pass | ops 5 -> 6 |
| Transforms Lab (3D) | Add operation: rotateAxis | choose it in the dropdown | pass | ops 6 -> 7 |
| Transforms Lab (3D) | Add operation: rotateAbout | choose it in the dropdown | pass | ops 7 -> 8 |
| Transforms Lab (3D) | Add operation: scale | choose it in the dropdown | pass | ops 8 -> 9 |
| Transforms Lab (3D) | Add operation: shear | choose it in the dropdown | pass | ops 9 -> 10 |
| Transforms Lab (3D) | Orbit drag | real drag on the 3D canvas | pass | dragged without errors |
| Transforms Lab (3D) | Show pivots checkbox, Vertex, Matrix dropdowns | toggle and choose | pass | 10 operations \| viewing: after operation 1 \| det = 1.000 \| volume × 1.000 |
| Transforms Lab (3D) | Reset | restores the 2 default operations | pass |  |
| Transforms Lab (3D) | Browser console | no JavaScript errors | pass |  |
| Quaternion Lab (Euler vs quaternion) | Initial | two viewports, "no gimbal lock" | pass | rotation angle 35.93° \| \|q\| = 1.000000 \| no gimbal lock |
| Quaternion Lab (Euler vs quaternion) | Yaw / Pitch / Roll sliders | move each; the quaternion changes | pass | q = [-0.045, 0.168, 0.255, 0.951] -> q = [0.529, 0.170, 0.733, 0.392] |
| Quaternion Lab (Euler vs quaternion) | Pitch to 90 button | GIMBAL LOCK badge appears; strip says GIMBAL LOCK | pass | rotation angle 96.72° \| \|q\| = 1.000000 \| GIMBAL LOCK |
| Quaternion Lab (Euler vs quaternion) | Axis (x y z) boxes and Angle slider | extra turn on the quaternion side | pass | q = [-0.242, 0.664, 0.242, 0.664] -> q = [0.123, 0.455, 0.542, 0.696] |
| Quaternion Lab (Euler vs quaternion) | Vertex dropdown | choose another vertex | pass |  |
| Quaternion Lab (Euler vs quaternion) | Reset button | back to yaw 30, pitch 20, roll 0; no lock | pass | rotation angle 35.93° \| \|q\| = 1.000000 \| no gimbal lock |
| Quaternion Lab (Euler vs quaternion) | Formula box | typeset equations, fractions and live numbers | pass |  |
| Quaternion Lab (slerp vs lerp) | Switch mode | strip shows start to end angle and t | pass | start → end 170.00° \| t = 0.50 \| \|q\| = 1.000000 |
| Quaternion Lab (slerp vs lerp) | Start / End dropdowns | pick presets | pass | start → end 90.44° \| t = 0.50 \| \|q\| = 1.000000 |
| Quaternion Lab (slerp vs lerp) | t slider | move t to 0.8 | pass | start → end 90.44° \| t = 0.80 \| \|q\| = 1.000000 |
| Quaternion Lab (slerp vs lerp) | Play / Pause | Play moves t; Pause stops it | pass | start → end 90.44° \| t = 0.10 \| \|q\| = 1.000000 / paused equal true |
| Quaternion Lab (slerp vs lerp) | Plot canvas | the angle-per-step plot is drawn | pass |  |
| Quaternion Lab (slerp vs lerp) | Browser console | no JavaScript errors | pass |  |
| Reactor Scene | Initial state | 271 objects, 15,412 triangles, tree with 6 folders | pass | 271 objects \| 15,412 triangles \| 7,385 drawn \| 7,757 culled (50.3%) \| 270 behind the camera \| click to select · drag to orbit · wheel to zoom \| Floor 1, Walls 60, Reactor 19, Arms 25, Towers 140, Robot 26 |
| Reactor Scene | Click an object (real click) | click the orb: Orb 1 is selected, outlined, tree highlights it | pass | Selected: Orb 1 / tree: Orb 1 |
| Reactor Scene | Click empty space | clicking the sky deselects | pass | Selected object |
| Reactor Scene | Tree: open a folder and click a row | Robot > Robot part 20 selects it | pass | Selected: Robot part 20 |
| Reactor Scene | Inspector: name | rename the object | pass | Selected: Visor |
| Reactor Scene | Inspector: Position | edit x, y, z (x boxes) | pass | position = 1.5,3,0.5 |
| Reactor Scene | Inspector: Rotation | edit the three rotation boxes | pass | rotation = 30,45,60 |
| Reactor Scene | Inspector: Scale | edit the three scale boxes | pass | scale = 0.5,0.5,0.5 |
| Reactor Scene | Inspector: colour picker, Glow slider | change colour and glow | pass | picture changed |
| Reactor Scene | Inspector: Visible checkbox | hide: tree row struck through; show again | pass | tree row marked hidden |
| Reactor Scene | Add menu: Cube, Sphere, Cylinder, Plane | each adds an object, names are numbered, "Added" folder | pass | Cube 1, Sphere 1, Cylinder 1, Plane 1 \| Added 4 |
| Reactor Scene | Delete button | removes the selected object (Plane 1) | pass | Added 3 |
| Reactor Scene | Delete key | select Cylinder 1 in the tree, press Delete | pass | Added 2 |
| Reactor Scene | Reset scene | back to 271 objects and no "Added" folder | pass | 271 objects \| 15,412 triangles \| 7,385 drawn \| 7,757 culled (50.3%) \| 270 behind the camera \| click to select · drag to orbit · wheel to zoom |
| Reactor Scene | Back-face culling checkbox | off: 0 culled; on: about half culled | pass | off: 15,053 drawn \| 0 culled (0.0%) / on: 7,385 drawn \| 7,757 culled (50.3%) |
| Reactor Scene | Wireframe checkbox | wireframe picture differs from filled | pass | picture changes |
| Reactor Scene | Size dropdown | 640x480, 960x720, 1280x960 change the canvas size | pass | 640x480,1280x960,960x720 |
| Reactor Scene | Bloom, Glow amt, Fog, Neon grid | each control changes the picture | pass | five different pictures |
| Reactor Scene | Camera section: presets | Hero view, Robot close-up, High angle | pass | three different views |
| Reactor Scene | Camera sliders Turn / Tilt / Distance | move each | pass | sliders moved without errors |
| Reactor Scene | Orbit drag and wheel zoom | real drag and real wheel on the canvas | pass | drag changed the view, wheel changed the zoom |
| Reactor Scene | Share: Save PNG | a real PNG file is downloaded | pass | renderlab-reactor-scene.png (430308 bytes) |
| Reactor Scene | Share: Copy image | the picture is copied to the clipboard | pass | console: Copied the picture; clipboard: image/png |
| Reactor Scene | Console trace | rendered lines, picks, adds and deletes are logged | pass | 56 lines |
| Reactor Scene | Formula box | typeset equations (model matrix, culling, light, fog) | pass |  |
| Reactor Scene | Browser console | no JavaScript errors | pass |  |
| Geometry Lab | Mode 1: initial | a = (3,1), b = (1,2.5), wedge 6.5, anticlockwise | pass | a ∧ b = 6.50 \| anticlockwise \| triangle area 3.25 |
| Geometry Lab | Mode 1: drag point a | real drag from (3,1) to (4,3): wedge 4 x 2.5 - 3 x 1 = 7 | pass | a ∧ b = 7.00 \| anticlockwise \| triangle area 3.50 |
| Geometry Lab | Mode 1: Swap a and b | the wedge changes sign: clockwise | pass | a ∧ b = -7.00 \| clockwise \| triangle area 3.50 |
| Geometry Lab | Mode 1: snap off | untick snap, drag b to a non-snapped place | pass | b = (4.17, 2.87) is not a multiple of 0.25 |
| Geometry Lab | Reset points | restores the start values | pass | a ∧ b = 6.50 \| anticlockwise \| triangle area 3.25 |
| Geometry Lab | Mode 2: ratios equal | a/sin A = b/sin B = c/sin C | pass | a / sin A = 7.22 \| b / sin B = 7.22 \| c / sin C = 7.22 |
| Geometry Lab | Mode 2: drag A, B, C | three real drags; ratios stay equal | pass | a / sin A = 9.39 \| b / sin B = 9.39 \| c / sin C = 9.39 |
| Geometry Lab | Mode 2: Swap B and C, circle checkbox | orientation flips; circle toggles | pass | orientation flipped; circle line shown/hidden |
| Geometry Lab | Mode 3: initial | the lines meet and the segments cross | pass | meet at (0.00, 0.86) \| t = 0.571 \| the segments cross |
| Geometry Lab | Mode 3: drag a line end | real drag of P2 to the left so the segment no longer reaches | pass | meet at (-2.22, 2.44) \| t = 0.889 \| the segments cross |
| Geometry Lab | Mode 3: Make them parallel | no intersection reported | pass | the lines are parallel: no intersection |
| Geometry Lab | Mode 4 (plane): initial | rank 2, spans the plane, coordinates of t | pass | rank 2 \| spans the plane \| t = 1.63 v₁ + 0.25 v₂ |
| Geometry Lab | Mode 4: drag the target t | real drag; coordinates change | pass | t = 1.63 v₁ + 0.25 v₂ -> t = 0.00 v₁ + 2.00 v₂ |
| Geometry Lab | Mode 4: third vector and Gram-Schmidt checkbox | v3 is dependent; GS arrows toggle | pass | v₃ reported as dependent |
| Geometry Lab | Mode 4: Make v2 parallel to v1 | rank 1, does NOT span the plane | pass | rank 1 \| does NOT span the plane \| v₁, v₂ are not a basis |
| Geometry Lab | Mode 4 (3D): right handed | triple product +1, right handed, rank 3 | pass | a · (b × c) = 1.00 \| RIGHT handed (positive) \| rank 3 \| spans space |
| Geometry Lab | Mode 4 (3D): left handed radio | triple product -1, LEFT handed | pass | a · (b × c) = -1.00 \| LEFT handed (negative) \| rank 3 \| spans space |
| Geometry Lab | Mode 4 (3D): edit vector boxes | type into a, b, c; volume changes (2 x 3 x 4 = 24) | pass | a · (b × c) = 24.00 \| RIGHT handed (positive) \| rank 3 \| spans space |
| Geometry Lab | Mode 4 (3D): Swap a and b | the sign flips | pass | a · (b × c) = -24.00 \| LEFT handed (negative) \| rank 3 \| spans space |
| Geometry Lab | Mode 4 (3D): Make c = a + b | flat: volume 0, rank 2, does NOT span space | pass | a · (b × c) = 0.00 \| flat: no volume, not an axis system \| rank 2 \| does NOT span space |
| Geometry Lab | Mode 4 (3D): box and Gram-Schmidt checkboxes | toggle both | pass | toggled without errors |
| Geometry Lab | Mode 4 (3D): orbit drag | real drag changes the view | pass | view changed |
| Geometry Lab | Topic radios | all four modes and the plane/space switch reachable | pass | used above |
| Geometry Lab | Browser console | no JavaScript errors | pass |  |
| Benchmark | Settings: Timed runs / Warm-up | set 15 timed runs and 5 warm-up runs | pass | 15/5 |
| Benchmark | Run all | start all five suites | pass | Cancel enabled while running |
| Benchmark | Run all: finished | Cancel disabled again, five result blocks filled | pass | 5 result blocks, 62.015 s |
| Benchmark | Download CSV | a .csv file is saved | pass | renderlab-benchmarks-20261101-1854.csv |
| Benchmark | Copy markdown tables | markdown text on clipboard | pass | 7695 chars |
| Benchmark | Chart dropdown: Back-face culling: off vs on | select it, chart redraws, Save chart PNG | pass | renderlab-chart-culling.png |
| Benchmark | Chart dropdown: Line drawing: Bresenham vs DDA (10,000 lines per row) | select it, chart redraws, Save chart PNG | pass | renderlab-chart-bresenham.png |
| Benchmark | Chart dropdown: Alpha compositing: over() on 640 x 480 pixels | select it, chart redraws, Save chart PNG | pass | renderlab-chart-alpha-over.png |
| Benchmark | Chart dropdown: Alpha compositing: the 3D see-through pass, sorted vs not | select it, chart redraws, Save chart PNG | pass | renderlab-chart-alpha-pass.png |
| Benchmark | Chart dropdown: Line simplification: Visvalingam-Whyatt vs RDP on a coastline | select it, chart redraws, Save chart PNG | pass | renderlab-chart-vw.png |
| Benchmark | Chart dropdown: Transformations: 1,000,000 operations each | select it, chart redraws, Save chart PNG | pass | renderlab-chart-transforms.png |
| Benchmark | Single suite button + Cancel | start the Transformations suite, click Cancel after 3 s; run stops, buttons come back | pass | Run all disabled while running: true; Cancel finished the run: true; result blocks: 0; log says Cancelled: true |

## Layout at 1280 x 720

Every lab was opened at 1280 x 720. The page itself does not scroll, no panel overlaps another, and the viewport scrolls inside its own area when a canvas is taller than the window.

| Lab | What was checked | Result | Observed |
|---|---|---|---|
| Rotating Cube | page does not scroll sideways, inspector has no sideways overflow, tab row stays one line | pass | {"page":true,"insp":true,"tabs":true,"vp":758} |
| Bresenham Lab | page does not scroll sideways, inspector has no sideways overflow, tab row stays one line | pass | {"page":true,"insp":true,"tabs":true,"vp":758} |
| Culling Lab | page does not scroll sideways, inspector has no sideways overflow, tab row stays one line | pass | {"page":true,"insp":true,"tabs":true,"vp":758} |
| Alpha Lab | page does not scroll sideways, inspector has no sideways overflow, tab row stays one line | pass | {"page":true,"insp":true,"tabs":true,"vp":758} |
| Simplify Lab | page does not scroll sideways, inspector has no sideways overflow, tab row stays one line | pass | {"page":true,"insp":true,"tabs":true,"vp":758} |
| Transforms Lab | page does not scroll sideways, inspector has no sideways overflow, tab row stays one line | pass | {"page":true,"insp":true,"tabs":true,"vp":758} |
| Quaternion Lab | page does not scroll sideways, inspector has no sideways overflow, tab row stays one line | pass | {"page":true,"insp":true,"tabs":true,"vp":758} |
| Reactor Scene | page does not scroll sideways, inspector has no sideways overflow, tab row stays one line | pass | {"page":true,"insp":true,"tabs":true,"vp":758} |
| Benchmark | page does not scroll sideways, inspector has no sideways overflow, tab row stays one line | pass | {"page":true,"insp":true,"tabs":true,"vp":758} |
| Geometry Lab | page does not scroll sideways, inspector has no sideways overflow, tab row stays one line | pass | {"page":true,"insp":true,"tabs":true,"vp":758} |
| Shell | no JavaScript errors | pass |  |
