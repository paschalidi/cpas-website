import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

/**
 * Aurora gradient mesh — Stripe / Linear style flowing color washes.
 *
 * A full-screen fragment shader paints multiple soft "blobs" of color
 * (pink, violet, electric blue, mint) over a near-white background. The blobs
 * drift via low-frequency noise and gently react to the cursor. Designed to
 * look elegant rather than dramatic — ideal pairing for dark hero text.
 */

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;
  varying vec2 vUv;

  uniform vec2  uResolution;
  uniform float uTime;
  uniform vec2  uMouse;

  // Value noise + fbm
  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.55;
    for (int i = 0; i < 5; i++) {
      v += a * vnoise(p);
      p *= 2.0;
      a *= 0.55;
    }
    return v;
  }

  // Soft radial blob falloff
  float blob(vec2 uv, vec2 c, float r, float soft) {
    return smoothstep(r, r * (1.0 - soft), length(uv - c));
  }

  void main() {
    vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution.xy) / uResolution.y;
    float t = uTime * 0.07;

    // Slowly drifting centers
    vec2 c1 = vec2(sin(t * 1.3) * 0.7,        cos(t * 1.7) * 0.4);
    vec2 c2 = vec2(cos(t * 1.1 + 1.7) * 0.8,  sin(t * 0.9 + 2.1) * 0.5);
    vec2 c3 = vec2(sin(t * 0.7 - 1.2) * 0.6,  cos(t * 1.4 - 0.5) * 0.7);
    vec2 c4 = vec2(cos(t * 1.9 + 3.0) * 0.5,  sin(t * 1.2 + 4.0) * 0.6);

    // Cursor influence — pulls c1
    c1 = mix(c1, uMouse * vec2(uResolution.x / uResolution.y, 1.0) * 0.9, 0.35);

    // Distort uv with low-freq noise for that "warped gradient" feel
    vec2 warp = uv + vec2(
      fbm(uv * 1.5 + vec2(t * 2.0, 0.0)),
      fbm(uv * 1.5 + vec2(0.0, t * 2.0))
    ) * 0.35 - 0.175;

    // Palette — vivid but on a near-white base
    vec3 cPink   = vec3(1.00, 0.36, 0.62);
    vec3 cViolet = vec3(0.58, 0.36, 1.00);
    vec3 cBlue   = vec3(0.30, 0.70, 1.00);
    vec3 cMint   = vec3(0.35, 0.95, 0.80);
    vec3 cBase   = vec3(0.98, 0.97, 1.00);

    vec3 col = cBase;
    col = mix(col, cPink,   blob(warp, c1, 0.95, 0.85) * 0.85);
    col = mix(col, cViolet, blob(warp, c2, 0.90, 0.85) * 0.75);
    col = mix(col, cBlue,   blob(warp, c3, 1.00, 0.85) * 0.70);
    col = mix(col, cMint,   blob(warp, c4, 0.85, 0.85) * 0.55);

    // Soft grain — keeps gradients from banding & adds texture
    float grain = (hash21(gl_FragCoord.xy + uTime) - 0.5) * 0.02;
    col += grain;

    // Subtle vignette darken at edges
    float vg = smoothstep(1.3, 0.3, length(uv));
    col *= 0.92 + 0.08 * vg;

    gl_FragColor = vec4(col, 1.0);
  }
`;

export function AuroraBackground() {
  const mountRef = useRef<HTMLDivElement>(null);
  const mouseRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!mountRef.current) return;
    const mountEl = mountRef.current;

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const renderer = new THREE.WebGLRenderer({
      alpha: false,
      antialias: false,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(window.innerWidth, window.innerHeight);
    mountEl.appendChild(renderer.domElement);

    const geometry = new THREE.PlaneGeometry(2, 2);
    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uResolution: {
          value: new THREE.Vector2(window.innerWidth, window.innerHeight),
        },
        uTime: { value: 0 },
        uMouse: { value: new THREE.Vector2() },
      },
    });
    const quad = new THREE.Mesh(geometry, material);
    scene.add(quad);

    const onMouse = (e: MouseEvent) => {
      mouseRef.current = {
        x: (e.clientX / window.innerWidth) * 2 - 1,
        y: -(e.clientY / window.innerHeight) * 2 + 1,
      };
    };
    window.addEventListener('mousemove', onMouse);

    let rafId = 0;
    const animate = () => {
      rafId = requestAnimationFrame(animate);
      material.uniforms.uTime.value += 0.012;
      material.uniforms.uMouse.value.lerp(
        new THREE.Vector2(mouseRef.current.x, mouseRef.current.y),
        0.04
      );
      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      renderer.setSize(window.innerWidth, window.innerHeight);
      material.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('mousemove', onMouse);
      window.removeEventListener('resize', onResize);
      mountEl.removeChild(renderer.domElement);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, []);

  return <div ref={mountRef} className="absolute inset-0 z-10" />;
}
