import type { ComponentType } from 'react'
import AlphaLab from './AlphaLab'
import BenchmarkLab from './BenchmarkLab'
import BresenhamLab from './BresenhamLab'
import CullingLab from './CullingLab'
import QuaternionLab from './QuaternionLab'
import RasterCanvas from './RasterCanvas'
import ReactorScene from './ReactorScene'
import SceneTree from './shell/SceneTree'
import Shell from './shell/Shell'
import type { LabEntry } from './shell/Sidebar'
import SimplifyLab from './SimplifyLab'
import TransformLab from './TransformLab'

// One entry per lab: what the tree shows, what the About dock says, and the component to run.
// Later labs are added here.
const LABS: (LabEntry & { component: ComponentType })[] = [
  {
    id: 'cube', name: 'Rotating Cube', icon: 'cube', dim: '3D', component: RasterCanvas,
    topic: 'Software rasterizer, perspective',
    blurb: 'The whole renderer in one picture: a cube is moved by the model, view and projection matrices, divided by w, and its edges are drawn pixel by pixel into our own pixel array.',
  },
  {
    id: 'bresenham', name: 'Bresenham Lab', icon: 'line', dim: '2D', component: BresenhamLab,
    topic: 'Bresenham line (required algorithm)',
    blurb: 'Draws a line with whole numbers only. An error term decides at every step whether the next pixel is straight ahead or diagonal, so the pixel closest to the true line is always chosen.',
  },
  {
    id: 'culling', name: 'Culling Lab', icon: 'cull', dim: '3D', component: CullingLab,
    topic: 'Back-face culling (required algorithm)',
    blurb: 'Skips triangles that face away from the camera. The normal comes from a cross product (the outer product); if it points away from the eye, the triangle is back facing and is not drawn.',
  },
  {
    id: 'alpha', name: 'Alpha Lab', icon: 'layers', dim: 'both', component: AlphaLab,
    topic: 'Alpha compositing (required algorithm)',
    blurb: 'Blends see-through colours with the Porter-Duff "over" operator, one pixel at a time. In 3D the see-through triangles are sorted back to front, because the order of the blend matters.',
  },
  {
    id: 'simplify', name: 'Simplify Lab', icon: 'polyline', dim: '2D', component: SimplifyLab,
    topic: 'Visvalingam-Whyatt (required algorithm)',
    blurb: 'Repeatedly removes the vertex whose triangle with its two neighbours has the smallest area, until few enough vertices remain. The area comes from the 2D cross (outer) product.',
  },
  {
    id: 'transforms', name: 'Transforms Lab', icon: 'transform', dim: 'both', component: TransformLab,
    topic: 'Transforms, determinants, pivots',
    blurb: 'Build a transform from an ordered list of operations and watch the matrix and its determinant change: rotation and shear keep area, a reflection flips it, scaling multiplies it.',
  },
  {
    id: 'quaternion', name: 'Quaternion Lab', icon: 'rotate', dim: '3D', component: QuaternionLab,
    topic: 'Quaternions vs Euler angles',
    blurb: 'The same rotation by Euler angles and by a quaternion. A pitch of 90 degrees locks the Euler angles (gimbal lock); slerp turns at constant speed where normalized lerp does not.',
  },
  {
    id: 'reactor', name: 'Reactor Scene', icon: 'scene', dim: '3D', component: ReactorScene,
    topic: 'Scene editor: picking, culling, depth buffer, bloom',
    blurb: 'The demo scene, and a small scene editor around it. Click an object (in the picture or in the tree) to select it, move, turn, resize and recolour it, add or delete objects, and switch back-face culling and wireframe to see what they do to the triangle counts.',
  },
  {
    id: 'benchmark', name: 'Benchmark', icon: 'bench', dim: 'both', component: BenchmarkLab,
    topic: 'Experimental results',
    blurb: 'Times the project\'s own algorithms with real code: culling off vs on, Bresenham vs DDA, alpha blending, Visvalingam-Whyatt growth, and matrix vs quaternion maths. Export the numbers as CSV or markdown for the report.',
  },
]

export default function App() {
  return (
    <Shell
      labs={LABS}
      renderLab={(lab) => { const Lab = LABS.find((l) => l.id === lab.id)!.component; return <Lab /> }}
      trees={{ reactor: <SceneTree /> }}
    />
  )
}
