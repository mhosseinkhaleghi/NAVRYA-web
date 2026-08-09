/**
 * The orb — section 7's backdrop.
 *
 * The shader is the React Bits `Orb`, carried over with one change — its three
 * base colours, for the reason beside them. What is not carried over at all is
 * the delivery: upstream it is a React client component that
 * imports `ogl`, and this site has no client React and no client bundle. It
 * runs as an inline script over raw WebGL instead, for three reasons that all
 * point the same way.
 *
 *   · `ogl`'s part in it is thin — a renderer, a program, a full-screen
 *     triangle and a vec3. That is the eighty lines below, against a
 *     dependency and a hydration boundary.
 *   · The preview build inlines the site into one file and drops every
 *     `<script src>`, so a client component would never run in the artifact —
 *     which is where this gets looked at.
 *   · Nothing else on the site needs React on the client, and one decorative
 *     backdrop is a poor reason to start.
 *
 * It compiles nothing until the controller marks the host live, a beat ahead of
 * the section, exactly as the plates are fetched a beat ahead. Under reduced
 * motion it never runs at all, and if WebGL is missing the section simply reads
 * without it — the words are never inside the canvas.
 */

/**
 * Hue rotation, in degrees, on top of the palette below.
 *
 * Zero, because the palette is already the site's gold. It was not always: the
 * first attempt kept the shader's violet and cyan and rotated them here, and no
 * angle worked — the two sit about 90 degrees apart and the rotation carries
 * both, so the ring came out green at one end and pink at the other whatever
 * the average measured. Moving the palette was the fix; this stays as the knob.
 *
 * Measured rather than reasoned about, either way: `adjustHue` rotates in YIQ,
 * not HSL, so there is no arithmetic that predicts the result. The ring is
 * sampled at 120 points around its circumference and read back. As it stands it
 * runs hue 29-39 with a median of 34, against 40 for the site's `--c-gold` —
 * one colour with warmth in it rather than a gradient between two.
 */
export const ORB_HUE = 0;

/** How hard the orb deforms under the pointer. Restrained: it is a backdrop. */
export const ORB_HOVER = 0.35;

const VERT = `
precision highp float;
attribute vec2 position;
attribute vec2 uv;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

/** The React Bits fragment shader. Only `baseColor1..3` differ from upstream. */
const FRAG = `
precision highp float;

uniform float iTime;
uniform vec3 iResolution;
uniform float hue;
uniform float hover;
uniform float rot;
uniform float hoverIntensity;
uniform vec3 backgroundColor;
varying vec2 vUv;

vec3 rgb2yiq(vec3 c) {
  float y = dot(c, vec3(0.299, 0.587, 0.114));
  float i = dot(c, vec3(0.596, -0.274, -0.322));
  float q = dot(c, vec3(0.211, -0.523, 0.312));
  return vec3(y, i, q);
}

vec3 yiq2rgb(vec3 c) {
  float r = c.x + 0.956 * c.y + 0.621 * c.z;
  float g = c.x - 0.272 * c.y - 0.647 * c.z;
  float b = c.x - 1.106 * c.y + 1.703 * c.z;
  return vec3(r, g, b);
}

vec3 adjustHue(vec3 color, float hueDeg) {
  float hueRad = hueDeg * 3.14159265 / 180.0;
  vec3 yiq = rgb2yiq(color);
  float cosA = cos(hueRad);
  float sinA = sin(hueRad);
  float i = yiq.y * cosA - yiq.z * sinA;
  float q = yiq.y * sinA + yiq.z * cosA;
  yiq.y = i;
  yiq.z = q;
  return yiq2rgb(yiq);
}

vec3 hash33(vec3 p3) {
  p3 = fract(p3 * vec3(0.1031, 0.11369, 0.13787));
  p3 += dot(p3, p3.yxz + 19.19);
  return -1.0 + 2.0 * fract(vec3(
    p3.x + p3.y,
    p3.x + p3.z,
    p3.y + p3.z
  ) * p3.zyx);
}

float snoise3(vec3 p) {
  const float K1 = 0.333333333;
  const float K2 = 0.166666667;
  vec3 i = floor(p + (p.x + p.y + p.z) * K1);
  vec3 d0 = p - (i - (i.x + i.y + i.z) * K2);
  vec3 e = step(vec3(0.0), d0 - d0.yzx);
  vec3 i1 = e * (1.0 - e.zxy);
  vec3 i2 = 1.0 - e.zxy * (1.0 - e);
  vec3 d1 = d0 - (i1 - K2);
  vec3 d2 = d0 - (i2 - K1);
  vec3 d3 = d0 - 0.5;
  vec4 h = max(0.6 - vec4(
    dot(d0, d0),
    dot(d1, d1),
    dot(d2, d2),
    dot(d3, d3)
  ), 0.0);
  vec4 n = h * h * h * h * vec4(
    dot(d0, hash33(i)),
    dot(d1, hash33(i + i1)),
    dot(d2, hash33(i + i2)),
    dot(d3, hash33(i + 1.0))
  );
  return dot(vec4(31.316), n);
}

vec4 extractAlpha(vec3 colorIn) {
  float a = max(max(colorIn.r, colorIn.g), colorIn.b);
  return vec4(colorIn.rgb / (a + 1e-5), a);
}

// The one change to the shader, and the reason for it is in the note above
// ORB_HUE: these three ship as violet, cyan and deep blue, roughly 90 degrees
// apart, and a hue rotation moves all three together — so the ring came out
// green at one end and pink at the other however far it was turned. Replaced
// with three points along the site's own gold, close enough together that the
// ring reads as one colour with warmth in it.
const vec3 baseColor1 = vec3(0.937255, 0.729412, 0.376471);
const vec3 baseColor2 = vec3(0.784314, 0.470588, 0.180392);
const vec3 baseColor3 = vec3(0.156863, 0.105882, 0.035294);
const float innerRadius = 0.6;
const float noiseScale = 0.65;

float light1(float intensity, float attenuation, float dist) {
  return intensity / (1.0 + dist * attenuation);
}
float light2(float intensity, float attenuation, float dist) {
  return intensity / (1.0 + dist * dist * attenuation);
}

vec4 draw(vec2 uv) {
  vec3 color1 = adjustHue(baseColor1, hue);
  vec3 color2 = adjustHue(baseColor2, hue);
  vec3 color3 = adjustHue(baseColor3, hue);

  float ang = atan(uv.y, uv.x);
  float len = length(uv);
  float invLen = len > 0.0 ? 1.0 / len : 0.0;

  float bgLuminance = dot(backgroundColor, vec3(0.299, 0.587, 0.114));

  float n0 = snoise3(vec3(uv * noiseScale, iTime * 0.5)) * 0.5 + 0.5;
  float r0 = mix(mix(innerRadius, 1.0, 0.4), mix(innerRadius, 1.0, 0.6), n0);
  float d0 = distance(uv, (r0 * invLen) * uv);
  float v0 = light1(1.0, 10.0, d0);

  v0 *= smoothstep(r0 * 1.05, r0, len);
  float innerFade = smoothstep(r0 * 0.8, r0 * 0.95, len);
  v0 *= mix(innerFade, 1.0, bgLuminance * 0.7);
  float cl = cos(ang + iTime * 2.0) * 0.5 + 0.5;

  float a = iTime * -1.0;
  vec2 pos = vec2(cos(a), sin(a)) * r0;
  float d = distance(uv, pos);
  float v1 = light2(1.5, 5.0, d);
  v1 *= light1(1.0, 50.0, d0);

  float v2 = smoothstep(1.0, mix(innerRadius, 1.0, n0 * 0.5), len);
  float v3 = smoothstep(innerRadius, mix(innerRadius, 1.0, 0.5), len);

  vec3 colBase = mix(color1, color2, cl);
  float fadeAmount = mix(1.0, 0.1, bgLuminance);

  vec3 darkCol = mix(color3, colBase, v0);
  darkCol = (darkCol + v1) * v2 * v3;
  darkCol = clamp(darkCol, 0.0, 1.0);

  vec3 lightCol = (colBase + v1) * mix(1.0, v2 * v3, fadeAmount);
  lightCol = mix(backgroundColor, lightCol, v0);
  lightCol = clamp(lightCol, 0.0, 1.0);

  vec3 finalCol = mix(darkCol, lightCol, bgLuminance);

  return extractAlpha(finalCol);
}

vec4 mainImage(vec2 fragCoord) {
  vec2 center = iResolution.xy * 0.5;
  float size = min(iResolution.x, iResolution.y);
  vec2 uv = (fragCoord - center) / size * 2.0;

  float angle = rot;
  float s = sin(angle);
  float c = cos(angle);
  uv = vec2(c * uv.x - s * uv.y, s * uv.x + c * uv.y);

  uv.x += hover * hoverIntensity * 0.1 * sin(uv.y * 10.0 + iTime);
  uv.y += hover * hoverIntensity * 0.1 * sin(uv.x * 10.0 + iTime);

  return draw(uv);
}

void main() {
  vec2 fragCoord = vUv * iResolution.xy;
  vec4 col = mainImage(fragCoord);
  gl_FragColor = vec4(col.rgb * col.a, col.a);
}
`;

export const orbScript = `
(function () {
  // No canvas at all under reduced motion. The orb is atmosphere; the section
  // is its words, and they do not need it.
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  // This runs alongside the stage controller, which is to say before the body
  // has been parsed — the host does not exist yet.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setup);
  } else {
    setup();
  }

  function setup() {
  var host = document.querySelector('[data-orb]');
  if (!host) return;

  var HUE = ${ORB_HUE}, HOVER_INTENSITY = ${ORB_HOVER}, ROT_SPEED = 0.3;
  var VERT = ${JSON.stringify(VERT)};
  var FRAG = ${JSON.stringify(FRAG)};

  var booted = false, frame = null, gl = null;

  function compile(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
  }

  function boot() {
    if (booted) return;
    booted = true;

    var canvas = document.createElement('canvas');
    gl = canvas.getContext('webgl', {
      // Premultiplied, and it has to be. The shader's last line is
      // gl_FragColor = vec4(col.rgb * col.a, col.a) and the blend below is the
      // premultiplied one, so declaring the context straight makes the
      // compositor multiply by alpha a *second* time — which is what turned the
      // ring into a soft, dim smear instead of a line of light. Upstream
      // carries this mismatch; it is less visible over ogl's own clear colour.
      alpha: true, premultipliedAlpha: true, antialias: true, depth: false
    }) || canvas.getContext('experimental-webgl', { alpha: true });
    // No WebGL, no orb. The section still reads — the words were never inside
    // the canvas, they are markup over it.
    if (!gl) return;

    var vs = compile(gl.VERTEX_SHADER, VERT), fs = compile(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return;
    var prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);

    host.appendChild(canvas);

    // One triangle that covers the clip volume — cheaper than two, and the
    // fragment shader is the whole of the work here anyway.
    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1, 0, 0,
       3, -1, 2, 0,
      -1,  3, 0, 2
    ]), gl.STATIC_DRAW);
    var aPos = gl.getAttribLocation(prog, 'position');
    var aUv = gl.getAttribLocation(prog, 'uv');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(aUv);
    gl.vertexAttribPointer(aUv, 2, gl.FLOAT, false, 16, 8);

    var u = {};
    ['iTime','iResolution','hue','hover','rot','hoverIntensity','backgroundColor'].forEach(function (n) {
      u[n] = gl.getUniformLocation(prog, n);
    });
    gl.uniform1f(u.hue, HUE);
    gl.uniform1f(u.hoverIntensity, HOVER_INTENSITY);
    // The page's own near-black, so the orb sits on the ground it is drawn over.
    gl.uniform3f(u.backgroundColor, 3 / 255, 3 / 255, 3 / 255);

    gl.clearColor(0, 0, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    function resize() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var w = host.clientWidth, h = host.clientHeight;
      if (!w || !h) return;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform3f(u.iResolution, canvas.width, canvas.height, canvas.width / canvas.height);
    }
    if (window.ResizeObserver) new ResizeObserver(resize).observe(host);
    window.addEventListener('resize', resize);
    resize();

    // The orb is behind the words and takes no pointer events, so the pointer
    // is tracked on the window and tested against the host's own box.
    var target = 0, hover = 0, rot = 0, last = 0;
    window.addEventListener('pointermove', function (e) {
      if (!host.isConnected) return;
      var r = host.getBoundingClientRect();
      if (!r.width || !r.height) return;
      var size = Math.min(r.width, r.height);
      var x = (e.clientX - r.left - r.width / 2) / size * 2;
      var y = (e.clientY - r.top - r.height / 2) / size * 2;
      target = Math.sqrt(x * x + y * y) < 0.8 ? 1 : 0;
    }, { passive: true });

    function draw(t) {
      frame = requestAnimationFrame(draw);
      var dt = last ? (t - last) * 0.001 : 0;
      last = t;
      gl.uniform1f(u.iTime, t * 0.001);
      hover += (target - hover) * 0.1;
      gl.uniform1f(u.hover, hover);
      if (hover > 0.5) rot += dt * ROT_SPEED;
      gl.uniform1f(u.rot, rot);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    function run() {
      if (frame === null) { last = 0; frame = requestAnimationFrame(draw); }
    }
    function halt() {
      if (frame !== null) { cancelAnimationFrame(frame); frame = null; }
    }

    // Thirty-odd screens of this sequence have no orb on them. It renders only
    // while the controller says the section is in reach, and gives the frame
    // back the moment it is not — including when the tab goes away.
    host._orbRun = run;
    host._orbHalt = halt;
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) halt();
      else if (host.hasAttribute('data-orb-live')) run();
    });
    run();
  }

  function sync() {
    if (host.hasAttribute('data-orb-live')) {
      boot();
      if (host._orbRun) host._orbRun();
    } else if (host._orbHalt) {
      host._orbHalt();
    }
  }

  // The controller raises the flag a beat ahead of the section, exactly as it
  // fetches each plate a beat ahead of the viewer, so nothing is compiled until
  // it is nearly needed.
  sync();
  new MutationObserver(sync).observe(host, {
    attributes: true,
    attributeFilter: ['data-orb-live']
  });
  }
})();
`.trim();
