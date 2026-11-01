## RenderLab benchmark results

- Browser: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/156.0.0.0 Safari/537.36
- Logical CPU cores: 10
- Device memory (approx.): 16 GB
- Screen: 800 x 600 at pixel ratio 1
- Date: 02/11/2026, 00:22:56
- Settings: 15 timed runs after 5 warm-up runs; the median is reported

### Back-face culling: off vs on

| scenario | style | culling | triangles | drawn | culled | culled % | median ms | min ms | speed-up |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Reactor scene | filled | off | 15412 | 15053 | 0 | 0 | 41.4 | 39 | 1 |
| Reactor scene | filled | on | 15412 | 7385 | 7757 | 50.33 | 28 | 27.5 | 1.479 |
| Reactor scene | wireframe | off | 15412 | 15053 | 0 | 0 | 41.4 | 38.5 | 1 |
| Reactor scene | wireframe | on | 15412 | 7385 | 7757 | 50.33 | 29.1 | 28.6 | 1.423 |
| Sphere 8 segments | filled | off | 48 | 48 | 0 | 0 | 2.1 | 2.05 | 1 |
| Sphere 8 segments | filled | on | 48 | 22 | 26 | 54.17 | 1.662 | 1.625 | 1.263 |
| Sphere 8 segments | wireframe | off | 48 | 48 | 0 | 0 | 1.125 | 1.112 | 1 |
| Sphere 8 segments | wireframe | on | 48 | 22 | 26 | 54.17 | 1.075 | 1.056 | 1.047 |
| Sphere 16 segments | filled | off | 224 | 224 | 0 | 0 | 2.25 | 2.15 | 1 |
| Sphere 16 segments | filled | on | 224 | 94 | 130 | 58.04 | 1.638 | 1.5 | 1.374 |
| Sphere 16 segments | wireframe | off | 224 | 224 | 0 | 0 | 1.387 | 1.362 | 1 |
| Sphere 16 segments | wireframe | on | 224 | 94 | 130 | 58.04 | 1.188 | 1.175 | 1.168 |
| Sphere 32 segments | filled | off | 960 | 960 | 0 | 0 | 2.975 | 2.85 | 1 |
| Sphere 32 segments | filled | on | 960 | 364 | 596 | 62.08 | 2 | 1.925 | 1.488 |
| Sphere 32 segments | wireframe | off | 960 | 960 | 0 | 0 | 2.175 | 2.075 | 1 |
| Sphere 32 segments | wireframe | on | 960 | 364 | 596 | 62.08 | 1.787 | 1.563 | 1.217 |
| Sphere 64 segments | filled | off | 3968 | 3968 | 0 | 0 | 5.25 | 4.95 | 1 |
| Sphere 64 segments | filled | on | 3968 | 1496 | 2472 | 62.3 | 3.425 | 3.2 | 1.533 |
| Sphere 64 segments | wireframe | off | 3968 | 3968 | 0 | 0 | 4.6 | 4.475 | 1 |
| Sphere 64 segments | wireframe | on | 3968 | 1496 | 2472 | 62.3 | 3 | 2.85 | 1.533 |

> Each frame is 640 x 480. "drawn" are the triangles filled or outlined; "culled" were skipped because they face away.
> speed-up = median time with culling off / median time with culling on.

### Line drawing: Bresenham vs DDA (10,000 lines per row)

| line length | algorithm | lines | pixels | median ms | min ms | µs per line | relative | pixel count diff | pixels at other places |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| short (~10 px) | Bresenham drawLine | 10000 | 99949 | 3.2 | 3.15 | 0.32 | 1 | 0 | 0 |
| short (~10 px) | DDA + setPixel | 10000 | 99949 | 1.512 | 1.425 | 0.1512 | 0.4727 | 0 | 0 |
| short (~10 px) | bresenhamSteps only | 10000 | 99949 | 1.525 | 1.463 | 0.1525 | 1 | 0 | 0 |
| short (~10 px) | ddaSteps only | 10000 | 99949 | 0.7438 | 0.6437 | 0.07438 | 0.4877 | 0 | 0 |
| medium (~100 px) | Bresenham drawLine | 10000 | 909857 | 26.5 | 25.6 | 2.65 | 1 | 0 | 0 |
| medium (~100 px) | DDA + setPixel | 10000 | 909857 | 12.8 | 12.5 | 1.28 | 0.483 | 0 | 0 |
| medium (~100 px) | bresenhamSteps only | 10000 | 909857 | 13 | 12.7 | 1.3 | 1 | 0 | 0 |
| medium (~100 px) | ddaSteps only | 10000 | 909857 | 5.9 | 5.75 | 0.59 | 0.4538 | 0 | 0 |
| long (~500 px) | Bresenham drawLine | 10000 | 4509083 | 122.5 | 117.2 | 12.25 | 1 | 0 | 0 |
| long (~500 px) | DDA + setPixel | 10000 | 4509083 | 68 | 65.4 | 6.8 | 0.5551 | 0 | 0 |
| long (~500 px) | bresenhamSteps only | 10000 | 4509083 | 83.4 | 82.7 | 8.34 | 1 | 0 | 0 |
| long (~500 px) | ddaSteps only | 10000 | 4509083 | 29.2 | 28 | 2.92 | 0.3501 | 0 | 0 |

> relative = time / time of the Bresenham row it is paired with (so Bresenham is always 1).
> JavaScript works with floating point numbers everywhere, so Bresenham's whole-number arithmetic is not expected to be faster here. Its advantage is on hardware where integers are much cheaper than divisions.
> pixel count diff = Bresenham pixels - DDA pixels (0: both draw max(|dx|,|dy|)+1 pixels per line). pixels at other places = pixels that are in a different position (they differ only by rounding).

### Alpha compositing: over() on 640 x 480 pixels

| layers | pixels | over calls | median ms | min ms | ns per over call |
| --- | --- | --- | --- | --- | --- |
| 1 | 307200 | 307200 | 4.3 | 4.15 | 14 |
| 2 | 307200 | 614400 | 7.1 | 6.9 | 11.56 |
| 4 | 307200 | 1228800 | 13.1 | 12 | 10.66 |
| 8 | 307200 | 2457600 | 25.1 | 24.7 | 10.21 |

> Every pixel blends the layers one after the other over a background, with over() from alpha.ts.
> The time should grow in step with the number of layers (the "ns per over call" column stays about the same).

### Alpha compositing: the 3D see-through pass, sorted vs not

| sort | triangles | pixels blended | median ms | min ms | relative |
| --- | --- | --- | --- | --- | --- |
| off | 432 | 353276 | 30.4 | 30.1 | 1 |
| on | 432 | 353276 | 30.8 | 30.5 | 1.013 |

> 6 overlapping see-through panes. Sorting costs a little, and it is what makes the blend order (and so the colours) correct.
> relative = time / time with the sort off.

### Line simplification: Visvalingam-Whyatt vs RDP on a coastline

| points | algorithm | kept | median ms | min ms | time ratio | n² ratio | area error % | max distance |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 100 | VW | 10 | 0.04609 | 0.04453 |  |  | 8.128 | 0.5566 |
| 100 | RDP | 10 | 0.009668 | 0.009473 |  |  | 10.56 | 0.4788 |
| 200 | VW | 20 | 0.1508 | 0.1453 | 3.271 | 4 | 1.954 | 0.2648 |
| 200 | RDP | 20 | 0.025 | 0.02461 | 2.586 | 4 | 0.3102 | 0.1689 |
| 500 | VW | 50 | 0.8938 | 0.8563 | 5.927 | 6.25 | 0.2306 | 0.07368 |
| 500 | RDP | 50 | 0.07578 | 0.07344 | 3.031 | 6.25 | 0.7163 | 0.05467 |
| 1000 | VW | 100 | 3.6 | 3.4 | 4.028 | 4 | 0.0261 | 0.03912 |
| 1000 | RDP | 100 | 0.1734 | 0.1703 | 2.289 | 4 | 0.1072 | 0.02086 |
| 2000 | VW | 200 | 14.3 | 14 | 3.972 | 4 | 0.02659 | 0.02434 |
| 2000 | RDP | 200 | 0.4156 | 0.3719 | 2.396 | 4 | 0.02627 | 0.006635 |

> Jobs shorter than 10 ms are repeated until a sample lasts at least 10 ms, and the time of ONE call is reported (the browser clock is too coarse for single microseconds).
> Each run keeps 10% of the points. The coastline has the same seeded shape at every size (a bigger n samples it more finely).
> time ratio = time / time at the previous size. If the algorithm is O(n²), it should be close to n² ratio = (n / previous n)².
> Our VW rescans all points for the smallest triangle at every removal (O(n²)); a heap would make it O(n log n).
> area error % = difference in the area between the line and the straight line joining its two ends (the open line closed up). max distance = farthest an original point is from the simplified line. RDP is timed at the tolerance that gives about the same number of points.

### Transformations: 1,000,000 operations each

| operation | operations | median ms | min ms | ns per op | relative |
| --- | --- | --- | --- | --- | --- |
| mat4 multiply | 1000000 | 156 | 146.9 | 156 | 18.14 |
| mat4 inverse | 1000000 | 1047 | 995 | 1047 | 121.7 |
| quaternion rotateVec3 | 1000000 | 12.8 | 6.5 | 12.8 | 1.488 |
| matrix transformPoint | 1000000 | 8.6 | 3.7 | 8.6 | 1 |

> relative = ns per op / the fastest row (so the fastest is 1).
> The rotation rows rotate one point. Each call also builds its small result array, which is part of the measured time for every row alike.
> A quaternion stores a rotation in 4 numbers and a matrix in 16, which is why rotating with a quaternion needs less memory; building the full matrix costs more.
