import * as THREE from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

/* Doodle render style for the event-room livehouse (docs/design/doodle.md §6).
 *
 *   scene -> sceneTarget: flat paper colour (linear) + a shading code in alpha
 *                         (cel lit / cel shade / untouched), depth texture
 *         -> composite:   ink outlines from depth + colour edges, two-band shade
 *                         with screen-space hatching, paper grain, dotted page
 *         -> canvas       (directly, or through a small downsample on 1x screens)
 *
 * Shading lives in the composite, so the light "boil" (6-8 fps wobble of the ink)
 * only re-runs this one full-screen pass, never the scene. Photographs, prints,
 * lamps and the illustrated people are drawn by unlit materials: they carry the
 * "untouched" code, so they are never hatched and get no colour-edge lines.
 * Nothing here runs unless the caller asks for it; ?doodle=0 keeps the classic
 * renderer, and so does any browser without renderable half-float targets. */

/** Alpha codes written by doodle cel materials into the scene target. */
export const DOODLE_CODE = Object.freeze({ shade: .25, lit: .5 });

/** Tab-scoped memory of an explicit ?doodle= choice: joining rewrites the address
 * to ?room=CODE, and a reload must keep the classic fallback someone asked for. */
const DOODLE_CHOICE_KEY = 'music-space-event-doodle';
function tabStorage() { try { return globalThis.sessionStorage || null; } catch { return null; } }

export function doodleWanted(search = globalThis.location?.search || '', storage = tabStorage()) {
  let choice = null;
  try { choice = new URLSearchParams(search).get('doodle'); } catch { choice = null; }
  try {
    if (choice !== null) storage?.setItem(DOODLE_CHOICE_KEY, choice);
    else choice = storage?.getItem(DOODLE_CHOICE_KEY) ?? null;
  } catch { /* storage refused: the address alone decides */ }
  return !['0', 'off', 'false', 'classic'].includes(choice);
}

/** A software rasteriser or a two-core machine: the look stays, but the 7 fps line
 * boil and the supersampled scene image are skipped (each would cost tens of
 * milliseconds there; on a real GPU they are about 1-3 ms). */
export function doodleLowEnd(renderer, nav = globalThis.navigator) {
  try {
    const gl = renderer?.getContext?.();
    let name = String(gl?.getParameter?.(gl.RENDERER) || '');
    if (!name || /^WebKit WebGL$/i.test(name)) {
      const info = gl?.getExtension?.('WEBGL_debug_renderer_info');
      if (info) name = String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL) || name);
    }
    if (/SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(name)) return true;
  } catch { /* unknown renderer: judge by the processor count only */ }
  const cores = Number(nav?.hardwareConcurrency);
  return Number.isFinite(cores) && cores > 0 && cores <= 2;
}

/** WebGL2 features the doodle path needs. Without renderable half floats the
 * scene image falls back to 8-bit (the bright palette tolerates it). */
export function doodleSupport(renderer) {
  const capabilities = renderer?.capabilities, extensions = renderer?.extensions;
  if (!capabilities || typeof extensions?.has !== 'function') return { ok: false, reason: 'no-webgl-capabilities' };
  if (capabilities.isWebGL2 === false) return { ok: false, reason: 'webgl1' };
  if (capabilities.precision !== 'highp') return { ok: false, reason: 'no-highp' };
  if ((capabilities.maxTextureSize || 0) < 4096) return { ok: false, reason: 'small-textures' };
  return { ok: true, reason: '', halfFloat: extensions.has('EXT_color_buffer_float') || extensions.has('EXT_color_buffer_half_float') };
}

const TOON_LINE = 'vec3 irradiance = getGradientIrradiance( geometryNormal, directLight.direction ) * directLight.color;';

/** Turn a MeshToonMaterial program into a doodle cel program: it writes the flat
 * paper colour and records whether the key light reaches the fragment (two bands,
 * cast shadows included). Returns false when the three.js chunk changed shape. */
export function patchDoodleCel(shader, uniforms) {
  const chunk = THREE.ShaderChunk.lights_toon_pars_fragment;
  const source = shader.fragmentShader;
  if (!chunk?.includes(TOON_LINE) || !source.includes('#include <lights_toon_pars_fragment>') || !source.includes('#include <opaque_fragment>')) return false;
  shader.uniforms.uDoodleTerminator = uniforms.terminator;
  shader.uniforms.uDoodleKey = uniforms.key;
  const pars = 'uniform float uDoodleTerminator;\nuniform float uDoodleKey;\nfloat doodleKey = 0.0;\n' + chunk.replace(TOON_LINE,
    'doodleKey = max( doodleKey, step( uDoodleTerminator, dot( geometryNormal, directLight.direction ) ) * dot( directLight.color, vec3( 0.3333333 ) ) );\n\tvec3 irradiance = vec3( 0.0 );');
  let fragment = source
    .replace('#include <lights_toon_pars_fragment>', pars)
    .replace('#include <opaque_fragment>', `outgoingLight = diffuseColor.rgb + totalEmissiveRadiance;
#include <opaque_fragment>
gl_FragColor.a = doodleKey >= 0.5 * uDoodleKey ? ${DOODLE_CODE.lit.toFixed(2)} : ${DOODLE_CODE.shade.toFixed(2)};`);
  // Optional recolour box (world space): one part of a merged mesh, such as the
  // foreground benches inside the venue's single ink mesh, takes another paper colour.
  const recolor = uniforms.recolor;
  if (recolor && shader.vertexShader.includes('#include <project_vertex>') && fragment.includes('#include <color_fragment>')) {
    shader.uniforms.uDoodleRecolorMin = recolor.min;
    shader.uniforms.uDoodleRecolorMax = recolor.max;
    shader.uniforms.uDoodleRecolor = recolor.color;
    shader.vertexShader = 'varying vec3 vDoodleWorld;\n' + shader.vertexShader.replace('#include <project_vertex>',
      '#include <project_vertex>\n\tvDoodleWorld = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;');
    fragment = 'uniform vec3 uDoodleRecolorMin;\nuniform vec3 uDoodleRecolorMax;\nuniform vec3 uDoodleRecolor;\nvarying vec3 vDoodleWorld;\n' + fragment.replace('#include <color_fragment>',
      '#include <color_fragment>\n\tif ( all( greaterThanEqual( vDoodleWorld, uDoodleRecolorMin ) ) && all( lessThanEqual( vDoodleWorld, uDoodleRecolorMax ) ) ) diffuseColor.rgb = uDoodleRecolor;');
  }
  shader.fragmentShader = fragment;
  return true;
}

const VERTEX = /* glsl */`
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4( position.xy, 0.0, 1.0 ); }
`;

const COMPOSITE = /* glsl */`
#include <packing>
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform vec2 uTexel;
uniform float uScale;
uniform float uNear;
uniform float uFar;
uniform bool uOrthographic;
uniform vec3 uInk;
uniform vec3 uPaper;
uniform float uSkyAlpha;
uniform float uShade;
uniform float uHatch;
uniform float uHatchSpacing;
uniform float uHatchWidth;
uniform float uLineWidth;
uniform float uLine;
uniform float uGrain;
uniform float uDots;
uniform float uSeed;
uniform float uBoil;
varying vec2 vUv;

float rawDepth( vec2 uv ) { return texture2D( tDepth, uv ).x; }
float viewDepth( vec2 uv ) {
  float d = rawDepth( uv );
  return uOrthographic ? -orthographicDepthToViewZ( d, uNear, uFar ) : -perspectiveDepthToViewZ( d, uNear, uFar );
}
float hash12( vec2 p ) {
  vec3 p3 = fract( vec3( p.xyx ) * 0.1031 );
  p3 += dot( p3, p3.yzx + 33.33 );
  return fract( ( p3.x + p3.y ) * p3.z );
}
float noise( vec2 p ) {
  vec2 i = floor( p ), f = fract( p );
  f = f * f * ( 3.0 - 2.0 * f );
  return mix( mix( hash12( i ), hash12( i + vec2( 1.0, 0.0 ) ), f.x ), mix( hash12( i + vec2( 0.0, 1.0 ) ), hash12( i + vec2( 1.0, 1.0 ) ), f.x ), f.y );
}
vec3 toSRGB( vec3 c ) {
  return mix( c * 12.92, 1.055 * pow( max( c, vec3( 0.0031308 ) ), vec3( 1.0 / 2.4 ) ) - 0.055, step( 0.0031308, c ) );
}
vec3 perceptual( vec3 c ) { return sqrt( max( c, vec3( 0.0 ) ) ); }

void main() {
  vec2 css = gl_FragCoord.xy / uScale;
  vec4 base = texture2D( tColor, vUv );
  bool sky = rawDepth( vUv ) >= 0.999999;
  bool cel = !sky && base.a < 0.75;
  bool shade = cel && base.a < 0.375;
  vec3 col = sky ? uPaper : base.rgb;

  // Two bands: the dark band keeps its colour and gets marker hatching.
  if ( shade ) {
    col *= uShade;
    float along = ( css.x - css.y ) * 0.70710678;
    float across = ( css.x + css.y ) * 0.70710678 + ( noise( vec2( along * 0.035, 3.1 ) ) - 0.5 ) * 1.4;
    float stroke = abs( fract( across / uHatchSpacing ) - 0.5 ) * uHatchSpacing;
    float aa = 0.5 / uScale + 0.3;
    float line = 1.0 - smoothstep( uHatchWidth * 0.5 - aa, uHatchWidth * 0.5 + aa, stroke );
    line *= mix( 0.6, 1.0, noise( vec2( floor( across / uHatchSpacing ) * 5.17, along * 0.05 ) ) );
    col = mix( col, uInk, line * uHatch );
  }

  // Paper: a whisper of grain on drawn surfaces, the page's dot grid outside.
  if ( sky || cel ) col *= 1.0 + ( hash12( floor( css ) ) - 0.5 ) * uGrain;
  if ( sky ) {
    vec2 cell = mod( css, 24.0 ) - 12.0;
    col = mix( col, uInk, ( 1.0 - smoothstep( 1.0, 1.7, length( cell ) ) ) * uDots );
  }

  // Ink: sampled through a gently "boiling" offset so lines wobble, fills stay.
  vec2 wobble = ( vec2( noise( css * 0.03 + uSeed * 17.17 ), noise( css * 0.03 + 41.3 + uSeed * 9.31 ) ) - 0.5 ) * 2.0 * uBoil;
  vec2 c = vUv + wobble * uScale * uTexel;
  vec2 o = uLineWidth * 0.5 * uScale * uTexel;
  float zC = viewDepth( c );
  vec4 sum = vec4(
    viewDepth( c - vec2( o.x, 0.0 ) ) + viewDepth( c + vec2( o.x, 0.0 ) ),
    viewDepth( c - vec2( 0.0, o.y ) ) + viewDepth( c + vec2( 0.0, o.y ) ),
    viewDepth( c - o ) + viewDepth( c + o ),
    viewDepth( c + vec2( -o.x, o.y ) ) + viewDepth( c + vec2( o.x, -o.y ) ) );
  vec4 second = ( sum - 2.0 * zC ) / max( zC, 0.001 );
  float convex = max( max( second.x, second.y ), max( second.z, second.w ) );
  float concave = max( max( -second.x, -second.y ), max( -second.z, -second.w ) );
  float edge = smoothstep( 0.03, 0.075, max( convex, concave ) );
  edge = max( edge, smoothstep( 0.005, 0.014, convex ) * 0.8 );
  edge = max( edge, smoothstep( 0.008, 0.024, concave ) * 0.45 );

  // Colour edges only between drawn (cel) surfaces: photographs, prints and
  // illustrated people keep their own pixels.
  vec4 centre = texture2D( tColor, c );
  if ( centre.a < 0.75 && rawDepth( c ) < 0.999999 ) {
    vec2 q = o * 0.8;
    vec3 pc = perceptual( centre.rgb );
    float diff = 0.0;
    vec4 s;
    s = texture2D( tColor, c + vec2( q.x, 0.0 ) ); if ( s.a < 0.75 ) diff = max( diff, length( perceptual( s.rgb ) - pc ) );
    s = texture2D( tColor, c - vec2( q.x, 0.0 ) ); if ( s.a < 0.75 ) diff = max( diff, length( perceptual( s.rgb ) - pc ) );
    s = texture2D( tColor, c + vec2( 0.0, q.y ) ); if ( s.a < 0.75 ) diff = max( diff, length( perceptual( s.rgb ) - pc ) );
    s = texture2D( tColor, c - vec2( 0.0, q.y ) ); if ( s.a < 0.75 ) diff = max( diff, length( perceptual( s.rgb ) - pc ) );
    edge = max( edge, smoothstep( 0.1, 0.22, diff ) * 0.9 );
  }
  col = mix( col, uInk, clamp( edge, 0.0, 1.0 ) * uLine );

  float alpha = sky ? uSkyAlpha : 1.0;
  gl_FragColor = vec4( toSRGB( col ) * alpha, alpha );
}
`;

const DOWNSAMPLE = /* glsl */`
uniform sampler2D tDiffuse;
uniform vec2 uStep;
varying vec2 vUv;
void main() {
  vec4 c = texture2D( tDiffuse, vUv + vec2( -uStep.x, -uStep.y ) ) + texture2D( tDiffuse, vUv + vec2( uStep.x, -uStep.y ) )
         + texture2D( tDiffuse, vUv + vec2( -uStep.x, uStep.y ) ) + texture2D( tDiffuse, vUv + vec2( uStep.x, uStep.y ) );
  gl_FragColor = c * 0.25;
}
`;

const linear = hex => new THREE.Color(hex);

/**
 * createDoodlePass(renderer, scene, getCamera, options) -> pass | null
 * options: { ink, paper (sRGB hex), pixelBudget, maxPixelRatio }
 * Returns null when the browser lacks a feature (the caller keeps its classic pipeline).
 */
export function createDoodlePass(renderer, scene, getCamera, options = {}) {
  const support = doodleSupport(renderer);
  if (!support.ok) return null;
  const lowEnd = options.lowEnd ?? doodleLowEnd(renderer);
  const maxPixelRatio = Math.min(2, options.maxPixelRatio || 2), pixelBudget = options.pixelBudget || 5.3e6;
  const sceneTarget = new THREE.WebGLRenderTarget(2, 2, {
    type: support.halfFloat ? THREE.HalfFloatType : THREE.UnsignedByteType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
    depthBuffer: true, stencilBuffer: false, colorSpace: THREE.NoColorSpace,
  });
  sceneTarget.depthTexture = new THREE.DepthTexture(2, 2);
  sceneTarget.depthTexture.format = THREE.DepthFormat;
  sceneTarget.depthTexture.type = THREE.UnsignedIntType;
  sceneTarget.depthTexture.minFilter = sceneTarget.depthTexture.magFilter = THREE.NearestFilter;
  const outTarget = new THREE.WebGLRenderTarget(2, 2, { type: THREE.UnsignedByteType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false, stencilBuffer: false });
  const uniforms = {
    tColor: { value: sceneTarget.texture }, tDepth: { value: sceneTarget.depthTexture },
    uTexel: { value: new THREE.Vector2(.5, .5) }, uScale: { value: 1 },
    uNear: { value: .1 }, uFar: { value: 100 }, uOrthographic: { value: false },
    uInk: { value: linear(options.ink || '#1c1b1a') }, uPaper: { value: linear(options.paper || '#f7efdf') }, uSkyAlpha: { value: 1 },
    uShade: { value: .9 }, uHatch: { value: .5 }, uHatchSpacing: { value: 5.5 }, uHatchWidth: { value: 1.15 },
    uLineWidth: { value: 2.5 }, uLine: { value: 1 }, uGrain: { value: .045 }, uDots: { value: .16 },
    uSeed: { value: 0 }, uBoil: { value: .7 },
  };
  const composite = new THREE.ShaderMaterial({ uniforms, vertexShader: VERTEX, fragmentShader: COMPOSITE, depthTest: false, depthWrite: false });
  const down = new THREE.ShaderMaterial({ uniforms: { tDiffuse: { value: outTarget.texture }, uStep: { value: new THREE.Vector2() } }, vertexShader: VERTEX, fragmentShader: DOWNSAMPLE, depthTest: false, depthWrite: false });
  const compositeQuad = new FullScreenQuad(composite), downQuad = new FullScreenQuad(down);
  const size = { width: 0, height: 0, outRatio: 0, rtWidth: 0, rtHeight: 0, direct: true };

  function setSize(width, height, { exact = false } = {}) {
    const dpr = Math.max(1, Number(globalThis.devicePixelRatio) || 1);
    let outRatio = exact || lowEnd ? 1 : Math.min(maxPixelRatio, dpr);
    let rtRatio = lowEnd ? 1 : Math.max(outRatio, 1.5);
    if (width * height * rtRatio * rtRatio > pixelBudget) rtRatio = Math.max(1, Math.sqrt(pixelBudget / (width * height)));
    outRatio = Math.min(outRatio, rtRatio);
    const direct = Math.abs(rtRatio - outRatio) < .01;
    const rtWidth = Math.max(2, Math.floor(width * rtRatio)), rtHeight = Math.max(2, Math.floor(height * rtRatio));
    if (width !== size.width || height !== size.height || outRatio !== size.outRatio) {
      renderer.setPixelRatio(outRatio); renderer.setSize(width, height, true);
      Object.assign(size, { width, height, outRatio });
    }
    if (rtWidth !== size.rtWidth || rtHeight !== size.rtHeight) {
      sceneTarget.setSize(rtWidth, rtHeight);
      if (!direct) outTarget.setSize(rtWidth, rtHeight);
      Object.assign(size, { rtWidth, rtHeight });
    }
    size.direct = direct;
    uniforms.uTexel.value.set(1 / rtWidth, 1 / rtHeight);
    uniforms.uScale.value = rtWidth / width;
    down.uniforms.uStep.value.set(.25 * rtRatio / outRatio / rtWidth, .25 * rtRatio / outRatio / rtHeight);
  }

  function compositeToScreen() {
    const camera = getCamera();
    uniforms.uNear.value = camera.near; uniforms.uFar.value = camera.far;
    uniforms.uOrthographic.value = camera.isOrthographicCamera === true;
    uniforms.uSkyAlpha.value = scene.background ? 1 : 0;
    if (size.direct) { renderer.setRenderTarget(null); compositeQuad.render(renderer); }
    else { renderer.setRenderTarget(outTarget); compositeQuad.render(renderer); renderer.setRenderTarget(null); downQuad.render(renderer); }
    renderer.setRenderTarget(null);
  }

  return {
    uniforms, size, lowEnd,
    setSize,
    render() {
      renderer.setRenderTarget(sceneTarget); renderer.clear(); renderer.render(scene, getCamera());
      compositeToScreen();
    },
    /** Re-ink the last scene image only (line boil); the scene is not drawn again. */
    boil() { uniforms.uSeed.value = (uniforms.uSeed.value + 1) % 64; compositeToScreen(); },
    dispose() {
      sceneTarget.depthTexture?.dispose(); sceneTarget.dispose(); outTarget.dispose();
      composite.dispose(); down.dispose(); compositeQuad.dispose(); downQuad.dispose();
    },
  };
}
