import React, { forwardRef, useMemo } from 'react'
import { Effect, EffectAttribute } from 'postprocessing'
import { Uniform, Vector2 } from 'three'
import { wrapEffect } from '@react-three/postprocessing'
import { useThree } from '@react-three/fiber'

// -----------------------------------------------------------------------------
// 1. GLSL Fragment Shader
// -----------------------------------------------------------------------------
const fragmentShader = `
uniform float time;
uniform vec2 resolution;

// User Configuration
uniform float curvature;
uniform float scanlineIntensity;
uniform float noiseIntensity;
uniform float vignetteIntensity;

// Minitel Green Tint (0.8, 1.2, 0.9)
const vec3 MINITEL_TINT = vec3(0.8, 1.2, 0.9);

// Distort UV coordinates to mimic curved CRT screen
vec2 curve(vec2 uv) {
    uv = (uv - 0.5) * 2.0;
    uv *= 1.1;
    uv.x *= 1.0 + pow((abs(uv.y) / 5.0), curvature);
    uv.y *= 1.0 + pow((abs(uv.x) / 4.0), curvature);
    uv  = (uv / 2.0) + 0.5;
    uv =  uv * 0.92 + 0.04;
    return uv;
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    vec2 q = uv;
    vec2 curvedUV = curve(q);

    // Black out pixels outside the curved screen
    if (curvedUV.x < 0.0 || curvedUV.x > 1.0 || curvedUV.y < 0.0 || curvedUV.y > 1.0) {
        outputColor = vec4(0.0, 0.0, 0.0, 1.0);
        return;
    }

    // Input Texture Sampling with simple Chromatic Aberration
    // We can't access tDiffuse directly in Effect class mainImage easily without
    // relying on inputColor, but inputColor is the current pixel.
    // To do chromatic aberration, we need to sample neighbor pixels.
    // The Effect class provides 'resolution' and we can use the 'inputBuffer' texture
    // if we declare we need it, but mainImage signature simplifies things.
    // However, for distortion we MUST sample from a texture at 'curvedUV'.
    // In 'postprocessing' Effect, we can use the 'inputBuffer' uniform.

    // Chromatic Aberration (Ghosting)
    float r = texture2D(inputBuffer, vec2(curvedUV.x + 0.002, curvedUV.y)).r;
    float g = texture2D(inputBuffer, vec2(curvedUV.x + 0.000, curvedUV.y)).g;
    float b = texture2D(inputBuffer, vec2(curvedUV.x - 0.002, curvedUV.y)).b;
    vec3 color = vec3(r, g, b);

    // Scanlines (Sine wave based on screen Y coordinate)
    // using resolution to match screen pixels
    float scanline = sin(curvedUV.y * resolution.y * 2.0) * 0.5 + 0.5;
    color -= scanline * scanlineIntensity;

    // Static Noise
    float noise = fract(sin(dot(curvedUV * time, vec2(12.9898, 78.233))) * 43758.5453);
    color += noise * noiseIntensity;

    // Vignette
    float vig = (0.0 + 1.0 * 16.0 * curvedUV.x * curvedUV.y * (1.0 - curvedUV.x) * (1.0 - curvedUV.y));
    color *= vec3(pow(vig, vignetteIntensity * 0.2)); // scaled down power for control

    // Green Tint / Phosphor Glow
    color *= MINITEL_TINT;

    outputColor = vec4(color, 1.0);
}
`

// -----------------------------------------------------------------------------
// 2. MinitelEffect Class
// -----------------------------------------------------------------------------

export interface MinitelProps {
  curvature?: number
  screenResolution?: Vector2
  scanlineIntensity?: number
  noiseIntensity?: number
  vignette?: number
}

export class MinitelEffectImpl extends Effect {
  constructor({
    curvature = 3.0,
    screenResolution = new Vector2(800, 600), // Default placeholder
    scanlineIntensity = 0.15,
    noiseIntensity = 0.08,
    vignette = 1.5,
  }: MinitelProps = {}) {
    super('MinitelEffect', fragmentShader, {
      // attributes: EffectAttribute.CONVOLUTION, // Removed to prevent context loss on some drivers
      uniforms: new Map<string, Uniform>([
        ['curvature', new Uniform(curvature)],
        ['resolution', new Uniform(screenResolution)],
        ['scanlineIntensity', new Uniform(scanlineIntensity)],
        ['noiseIntensity', new Uniform(noiseIntensity)],
        ['vignetteIntensity', new Uniform(vignette)],
        ['time', new Uniform(0.0)],
      ]),
    })
  }

  // Define getters/setters for implicit prop updates via wrapEffect
  get curvature() { return this.uniforms.get('curvature')!.value }
  set curvature(v: number) { this.uniforms.get('curvature')!.value = v }

  get screenResolution() { return this.uniforms.get('resolution')!.value }
  set screenResolution(v: Vector2) { this.uniforms.get('resolution')!.value = v }

  get scanlineIntensity() { return this.uniforms.get('scanlineIntensity')!.value }
  set scanlineIntensity(v: number) { this.uniforms.get('scanlineIntensity')!.value = v }

  get noiseIntensity() { return this.uniforms.get('noiseIntensity')!.value }
  set noiseIntensity(v: number) { this.uniforms.get('noiseIntensity')!.value = v }

  // NOTE: Prop is 'vignette', uniform is 'vignetteIntensity'
  get vignette() { return this.uniforms.get('vignetteIntensity')!.value }
  set vignette(v: number) { this.uniforms.get('vignetteIntensity')!.value = v }

  update(renderer: any, inputBuffer: any, deltaTime: number) {
    const time = this.uniforms.get('time');
    if (time) {
        time.value += deltaTime;
    }
  }
}

// -----------------------------------------------------------------------------
// 3. React Component
// -----------------------------------------------------------------------------

// Wrap the effect
const MinitelEffect = wrapEffect(MinitelEffectImpl)

export const Minitel = forwardRef<any, MinitelProps>((props, ref) => {
  const { size } = useThree() // Get canvas size from R3F

  const {
    curvature = 3.0,
    screenResolution,
    scanlineIntensity = 0.15,
    noiseIntensity = 0.08,
    vignette = 1.5
  } = props

  // Safe Resolution Calculation:
  // Ensure we never pass 0x0 to the shader or framebuffers
  const resolution = useMemo(() => {
    if (screenResolution) return screenResolution;

    // Guard against 0 dimensions which can cause WebGL Context Loss
    const w = Math.max(1, size.width);
    const h = Math.max(1, size.height);
    return new Vector2(w, h);
  }, [screenResolution, size.width, size.height]);

  return (
    <MinitelEffect
      ref={ref}
      curvature={curvature}
      screenResolution={resolution}
      scanlineIntensity={scanlineIntensity}
      noiseIntensity={noiseIntensity}
      vignette={vignette}
    />
  )
})

Minitel.displayName = 'Minitel'
