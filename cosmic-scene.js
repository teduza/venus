import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.185.1/build/three.module.js';

export function initCosmicScene(container) {
  if (!container) return null;
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReduced) return null;

  let width = container.clientWidth || window.innerWidth;
  let height = container.clientHeight || window.innerHeight;
  const isMobile = window.innerWidth < 768;
  const density = isMobile ? 0.4 : 1;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0a0a0f, 0.0008);

  const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 2000);
  camera.position.set(0, 0, 100);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  container.appendChild(renderer.domElement);

  // --- Venus Planet (Creamy Pearl-White & Mother-of-Pearl) ---
  const venusGroup = new THREE.Group();
  scene.add(venusGroup);

  const venusDetail = isMobile ? 4 : 6;
  const venusGeo = new THREE.IcosahedronGeometry(18, venusDetail);
  const venusMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.72,
    metalness: 0.14,
    flatShading: false,
    vertexColors: true,
  });

  // Procedural swirling cloud-veil displacement + creamy pearl coloring
  const posAttr = venusGeo.attributes.position;
  const colorArr = new Float32Array(posAttr.count * 3);
  const deepPearl = new THREE.Color(0x9b9081);
  const midPearl = new THREE.Color(0xe3d8c6);
  const creamHigh = new THREE.Color(0xf7efe0);

  for (let i = 0; i < posAttr.count; i++) {
    const x = posAttr.getX(i);
    const y = posAttr.getY(i);
    const z = posAttr.getZ(i);
    const swirl = noise3D(x * 0.06, y * 0.14, z * 0.06) * 1.15 + noise3D(x * 0.18, y * 0.24, z * 0.18) * 0.45;
    const fine = noise3D(x * 0.55, y * 0.55, z * 0.55);
    const len = Math.sqrt(x * x + y * y + z * z);
    posAttr.setXYZ(i, x + (x / len) * swirl, y + (y / len) * swirl, z + (z / len) * swirl);

    const t = Math.min(1, Math.max(0, (swirl + 1.4) / 2.8));
    const col = t < 0.5
      ? deepPearl.clone().lerp(midPearl, t * 2)
      : midPearl.clone().lerp(creamHigh, (t - 0.5) * 2);
    const shade = 1 + fine * 0.1;
    colorArr[i * 3] = Math.min(1, col.r * shade);
    colorArr[i * 3 + 1] = Math.min(1, col.g * shade);
    colorArr[i * 3 + 2] = Math.min(1, col.b * shade);
  }
  venusGeo.setAttribute('color', new THREE.BufferAttribute(colorArr, 3));
  venusGeo.computeVertexNormals();
  const venus = new THREE.Mesh(venusGeo, venusMat);
  venusGroup.add(venus);

  // Atmospheric creamy pearl glow
  const glowGeo = new THREE.SphereGeometry(21.4, 64, 64);
  const glowMat = new THREE.ShaderMaterial({
    uniforms: { glowColor: { value: new THREE.Color(0xf2e7d5) } },
    vertexShader: `
      varying vec3 vNormal;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 glowColor;
      varying vec3 vNormal;
      void main() {
        float intensity = pow(0.72 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.0);
        gl_FragColor = vec4(glowColor, intensity * 0.55);
      }
    `,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    transparent: true,
  });
  const glow = new THREE.Mesh(glowGeo, glowMat);
  venusGroup.add(glow);

  // Lighting
  const ambient = new THREE.AmbientLight(0x26211c, 0.55);
  scene.add(ambient);
  const sun = new THREE.DirectionalLight(0xfff5e6, 1.85);
  sun.position.set(50, 20, 40);
  scene.add(sun);
  const rim = new THREE.DirectionalLight(0xd9cfc0, 0.42);
  rim.position.set(-50, -10, -30);
  scene.add(rim);

  // --- Starfield (multiple layers for parallax) ---
  const starLayers = [];
  for (let layer = 0; layer < 3; layer++) {
    const count = Math.round((layer === 0 ? 4000 : layer === 1 ? 2000 : 800) * density);
    const starGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const layerDepth = layer === 0 ? 500 : layer === 1 ? 300 : 150;
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 1200;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 1200;
      positions[i * 3 + 2] = (Math.random() - 0.5) * layerDepth - 200;
      sizes[i] = Math.random() * 2 + 0.5;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    starGeo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const starMat = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 } },
      vertexShader: `
        attribute float size;
        varying float vSize;
        void main() {
          vSize = size;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * (300.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform float time;
        varying float vSize;
        void main() {
          float d = length(gl_PointCoord - vec2(0.5));
          if (d > 0.5) discard;
          float twinkle = sin(time * 2.0 + gl_FragCoord.x * 0.1) * 0.3 + 0.7;
          float alpha = (1.0 - d * 2.0) * twinkle;
          vec3 color = mix(vec3(1.0, 0.97, 0.92), vec3(0.88, 0.83, 0.76), vSize / 2.5);
          gl_FragColor = vec4(color, alpha);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const stars = new THREE.Points(starGeo, starMat);
    scene.add(stars);
    starLayers.push({ mesh: stars, material: starMat, depth: layerDepth });
  }

  // --- Pearl stardust particles around Venus ---
  const dustCount = Math.round(300 * density);
  const dustGeo = new THREE.BufferGeometry();
  const dustPos = new Float32Array(dustCount * 3);
  const dustVel = [];
  for (let i = 0; i < dustCount; i++) {
    const r = 25 + Math.random() * 40;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI;
    dustPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    dustPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    dustPos[i * 3 + 2] = r * Math.cos(phi);
    dustVel.push({ speed: 0.001 + Math.random() * 0.003, radius: r });
  }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dustMat = new THREE.PointsMaterial({
    color: 0xf0e6d5,
    size: 0.6,
    transparent: true,
    opacity: 0.6,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const dust = new THREE.Points(dustGeo, dustMat);
  venusGroup.add(dust);

  // Mouse parallax
  const mouse = { x: 0, y: 0 };
  window.addEventListener('mousemove', (e) => {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
  });

  // --- Warp speed effect ---
  let warpFactor = 0;
  let warpActive = false;
  function triggerWarp() {
    warpActive = true;
    warpFactor = 1;
  }

  // --- Scroll-driven camera ---
  let scrollProgress = 0;
  let targetScrollProgress = 0;
  window.addEventListener('scroll', () => {
    const maxScroll = document.body.scrollHeight - window.innerHeight;
    targetScrollProgress = maxScroll > 0 ? window.scrollY / maxScroll : 0;
  }, { passive: true });

  // --- Resize ---
  function onResize() {
    width = container.clientWidth || window.innerWidth;
    height = container.clientHeight || window.innerHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  }
  window.addEventListener('resize', onResize);

  // --- Animation loop ---
  const clock = new THREE.Clock();
  let frameId;
  function animate() {
    frameId = requestAnimationFrame(animate);
    const dt = clock.getDelta();
    const t = clock.getElapsedTime();

    scrollProgress += (targetScrollProgress - scrollProgress) * 0.05;

    venus.rotation.y += dt * 0.08;
    venus.rotation.x = Math.sin(t * 0.1) * 0.05;

    const dPos = dustGeo.attributes.position.array;
    for (let i = 0; i < dustCount; i++) {
      const angle = t * dustVel[i].speed;
      const r = dustVel[i].radius;
      dPos[i * 3] = r * Math.sin(angle + i) * Math.cos(i * 0.5);
      dPos[i * 3 + 1] = r * Math.sin(angle + i) * Math.sin(i * 0.5);
      dPos[i * 3 + 2] = r * Math.cos(angle + i);
    }
    dustGeo.attributes.position.needsUpdate = true;

    starLayers.forEach((layer) => {
      layer.material.uniforms.time.value = t;
      layer.mesh.rotation.y = t * 0.005 * (layer === starLayers[0] ? 1 : 0.5);
    });

    const journeyZ = 100 - scrollProgress * 250;
    const journeyY = scrollProgress * 30;
    camera.position.z += (journeyZ - camera.position.z) * 0.05;
    camera.position.y += (journeyY - camera.position.y) * 0.05;
    camera.position.x += (mouse.x * 15 - camera.position.x) * 0.03;
    camera.lookAt(venusGroup.position.x, venusGroup.position.y + scrollProgress * 10, venusGroup.position.z);

    venusGroup.position.z = scrollProgress * -150;
    venusGroup.position.y = scrollProgress * -20;

    if (warpActive) {
      warpFactor -= dt * 0.5;
      if (warpFactor <= 0) {
        warpFactor = 0;
        warpActive = false;
      }
      starLayers.forEach((layer) => {
        const positions = layer.mesh.geometry.attributes.position.array;
        for (let i = 0; i < positions.length; i += 3) {
          positions[i + 2] -= warpFactor * 15;
        }
        layer.mesh.geometry.attributes.position.needsUpdate = true;
      });
    }

    renderer.render(scene, camera);
  }
  animate();

  return {
    triggerWarp,
    destroy: () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    }
  };
}

function noise3D(x, y, z) {
  const n = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453;
  return (n - Math.floor(n)) * 2 - 1;
}
