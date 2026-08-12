export function createSceneSetup({ THREE, canvas }) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false
  });

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x87ceeb, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb);
  scene.fog = new THREE.Fog(0x87ceeb, 2200, 5600);

  const camera = new THREE.PerspectiveCamera(
    48,
    window.innerWidth / window.innerHeight,
    0.1,
    9000
  );

  const state = {
    target: new THREE.Vector3(0, 28, 0),
    yaw: Math.PI / 4,
    pitch: THREE.MathUtils.degToRad(54),
    distance: 360,
    minDistance: 18,
    maxDistance: 1200,
    moveSpeed: 120,
    rotateSpeed: 0.007,
    keyRotateSpeed: 1.8,
    zoomSpeed: 0.0018,
    dragging: false,
    lastPointerX: 0,
    lastPointerY: 0
  };

  const keys = new Set();

  const hemisphereLight = new THREE.HemisphereLight(0xd9f5ff, 0x4f3928, 1.55);
  scene.add(hemisphereLight);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.92);
  scene.add(ambientLight);

  const sunLight = new THREE.DirectionalLight(0xffffff, 2.25);
  sunLight.position.set(120, 220, 90);
  scene.add(sunLight);

  const fillLight = new THREE.DirectionalLight(0xc7eaff, 0.78);
  fillLight.position.set(-120, 80, -160);
  scene.add(fillLight);

  /*
    Sky-colored LOD fog curtain.
    This gently covers the far compressed terrain near the edge of render distance,
    because distant LOD without haze looks like the world forgot to finish loading itself.
  */
  const lodFogCurtain = new THREE.Mesh(
    new THREE.CylinderGeometry(1, 1, 1, 128, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0x87ceeb,
      transparent: true,
      opacity: 0.58,
      depthWrite: false,
      side: THREE.DoubleSide
    })
  );
  lodFogCurtain.name = "sky-colored-lod-fog-curtain";
  lodFogCurtain.renderOrder = 2;
  lodFogCurtain.visible = true;
  scene.add(lodFogCurtain);

  const horizonHazeDisk = new THREE.Mesh(
    new THREE.RingGeometry(1, 1.38, 128),
    new THREE.MeshBasicMaterial({
      color: 0x87ceeb,
      transparent: true,
      opacity: 0.36,
      depthWrite: false,
      side: THREE.DoubleSide
    })
  );
  horizonHazeDisk.name = "sky-colored-horizon-haze-disk";
  horizonHazeDisk.rotation.x = -Math.PI / 2;
  horizonHazeDisk.renderOrder = 3;
  scene.add(horizonHazeDisk);

  return { renderer, scene, camera, state, keys, lodFogCurtain, horizonHazeDisk };
}

export function createCloudLayer({ THREE, scene, state, seedNumber, smoothstep }) {
  /*
    Procedural sky cloud layer:
    White fluffy cloud sprites are generated from seeded cells and drift across the sky.
    They follow the player's general area so the sky feels alive instead of emotionally vacant.
  */
  const cloudLayer = new THREE.Group();
  scene.add(cloudLayer);

  function createCloudTexture(variant = 0) {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 128;

    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const puffCount = 7 + variant * 2;
    for (let i = 0; i < puffCount; i += 1) {
      const x = 34 + ((i * 29 + variant * 17) % 170) + Math.sin(i * 1.37 + variant) * 12;
      const y = 50 + Math.cos(i * 1.11 + variant * 0.8) * 14;
      const radius = 24 + ((i * 11 + variant * 7) % 24);

      const gradient = ctx.createRadialGradient(
        x, y, radius * 0.18,
        x, y, radius
      );

      gradient.addColorStop(0, "rgba(255,255,255,0.96)");
      gradient.addColorStop(0.45, "rgba(255,255,255,0.90)");
      gradient.addColorStop(0.8, "rgba(255,255,255,0.48)");
      gradient.addColorStop(1, "rgba(255,255,255,0.0)");

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    return texture;
  }

  const cloudTextures = [
    createCloudTexture(0),
    createCloudTexture(1),
    createCloudTexture(2)
  ];

  const cloudState = {
    cellSize: 540,
    radius: 7,
    innerRadius: 1100,
    outerRadius: 3900,
    domeBaseHeight: 220,
    domeHeight: 260,
    windX: 0,
    windZ: 0,
    windSpeedX: 7.5,
    windSpeedZ: 2.6,
    cells: new Map()
  };

  function cloudHash(x, z, salt = 0) {
    let h = seedNumber ^ Math.imul(x + salt * 131, 374761393) ^ Math.imul(z - salt * 17, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967295;
  }

  function disposeCloudGroup(group) {
    if (!group) return;
    cloudLayer.remove(group);
  }

  function buildCloudCell(cellX, cellZ) {
    const key = `${cellX},${cellZ}`;
    if (cloudState.cells.has(key)) return;

    const spawnChance = cloudHash(cellX, cellZ);
    if (spawnChance < 0.38) {
      cloudState.cells.set(key, null);
      return;
    }

    const group = new THREE.Group();
    group.userData = {
      cellX,
      cellZ,
      domeHeightOffset: cloudHash(cellX, cellZ, 5) * 80,
      bobPhase: cloudHash(cellX, cellZ, 8) * Math.PI * 2,
      bobAmount: 4 + cloudHash(cellX, cellZ, 9) * 8
    };

    const puffCount = 3 + Math.floor(cloudHash(cellX, cellZ, 2) * 3);
    for (let i = 0; i < puffCount; i += 1) {
      const textureIndex = Math.floor(cloudHash(cellX, cellZ, 20 + i) * cloudTextures.length);
      const material = new THREE.SpriteMaterial({
        map: cloudTextures[textureIndex],
        color: 0xffffff,
        transparent: true,
        opacity: 0.62 + cloudHash(cellX, cellZ, 40 + i) * 0.22,
        depthWrite: false,
        fog: false
      });

      const sprite = new THREE.Sprite(material);
      sprite.position.set(
        (cloudHash(cellX, cellZ, 60 + i) - 0.5) * 160,
        (cloudHash(cellX, cellZ, 80 + i) - 0.5) * 26,
        (cloudHash(cellX, cellZ, 100 + i) - 0.5) * 130
      );

      const scale = 190 + cloudHash(cellX, cellZ, 120 + i) * 240;
      sprite.scale.set(scale, scale * 0.48, 1);
      group.add(sprite);
    }

    cloudLayer.add(group);
    cloudState.cells.set(key, group);
  }

  function updateCloudLayer(deltaSeconds) {
    cloudState.windX += deltaSeconds * cloudState.windSpeedX;
    cloudState.windZ += deltaSeconds * cloudState.windSpeedZ;

    const centerCellX = Math.floor((state.target.x - cloudState.windX) / cloudState.cellSize);
    const centerCellZ = Math.floor((state.target.z - cloudState.windZ) / cloudState.cellSize);

    const needed = new Set();

    for (let z = centerCellZ - cloudState.radius; z <= centerCellZ + cloudState.radius; z += 1) {
      for (let x = centerCellX - cloudState.radius; x <= centerCellX + cloudState.radius; x += 1) {
        const key = `${x},${z}`;
        needed.add(key);
        buildCloudCell(x, z);
      }
    }

    for (const [key, group] of cloudState.cells.entries()) {
      if (!needed.has(key)) {
        disposeCloudGroup(group);
        cloudState.cells.delete(key);
        continue;
      }

      if (!group) continue;

      const { cellX, cellZ, domeHeightOffset, bobPhase, bobAmount } = group.userData;
      const worldX = cellX * cloudState.cellSize + cloudState.windX;
      const worldZ = cellZ * cloudState.cellSize + cloudState.windZ;
      const offsetX = worldX - state.target.x;
      const offsetZ = worldZ - state.target.z;
      const radialDistance = Math.hypot(offsetX, offsetZ);

      /*
        Clouds form a dome-like horizon ring around the player:
        - no clouds very close to the ground/player
        - cloud height follows a dome curve
        - clouds stay visible toward the horizon as the world moves
      */
      if (radialDistance < cloudState.innerRadius || radialDistance > cloudState.outerRadius) {
        group.visible = false;
        continue;
      }

      group.visible = true;
      group.position.x = worldX;
      group.position.z = worldZ;

      const normalizedRadius = THREE.MathUtils.clamp(
        (radialDistance - cloudState.innerRadius) / (cloudState.outerRadius - cloudState.innerRadius),
        0,
        1
      );

      /*
        Horizon-biased dome:
        Clouds stay above the world, but the far clouds sit lower in screen space
        so Ball Mode can actually see them along the horizon instead of one sad puff overhead.
      */
      const domeCurve = Math.sqrt(Math.max(0, 1 - normalizedRadius * normalizedRadius));
      const horizonBias = smoothstep(0.35, 1.0, normalizedRadius);
      const y =
        cloudState.domeBaseHeight +
        domeCurve * cloudState.domeHeight * 0.55 +
        horizonBias * 115 +
        domeHeightOffset +
        Math.sin(performance.now() * 0.00015 + bobPhase) * bobAmount;

      group.position.y = Math.max(180, y);
    }
  }

  return { updateCloudLayer };
}

export function createMaterialPipeline({
  THREE,
  renderer,
  pendingSphereTexturePath,
  sphereTextureSelect,
  sphereTextureStatus,
  onAssetsLoaded,
  onAssetError
}) {
  const loadingManager = new THREE.LoadingManager();
  loadingManager.onLoad = () => {
    if (typeof onAssetsLoaded === "function") onAssetsLoaded();
  };
  loadingManager.onError = (url) => {
    console.warn(`Asset failed to load: ${url}`);
    // Keep loading resilient even if a decorative asset has a melodramatic little failure.
    window.setTimeout(() => {
      if (typeof onAssetError === "function") onAssetError(url);
    }, 250);
  };

  const textureLoader = new THREE.TextureLoader(loadingManager);

  const sphereTextureBasePath = "assets/png/";
  const defaultSphereTexturePath = `${sphereTextureBasePath}default_sphere.png`;
  const startupSphereTexturePath = pendingSphereTexturePath || defaultSphereTexturePath;
  let playerMaterial = null;

  function setupRepeatingTexture(texture) {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1, 1);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  }

  function createContrastBoostedTexture(sourceTexture, contrast = 1.55, brightnessOffset = 4) {
    const image = sourceTexture.image;
    if (!image || !image.width || !image.height) {
      return sourceTexture;
    }

    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(image, 0, 0);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.max(0, Math.min(255, (data[i] - 128) * contrast + 128 + brightnessOffset));
      data[i + 1] = Math.max(0, Math.min(255, (data[i + 1] - 128) * contrast + 128 + brightnessOffset));
      data[i + 2] = Math.max(0, Math.min(255, (data[i + 2] - 128) * contrast + 128 + brightnessOffset));
    }

    ctx.putImageData(imageData, 0, 0);

    const boosted = new THREE.CanvasTexture(canvas);
    boosted.wrapS = THREE.RepeatWrapping;
    boosted.wrapT = THREE.RepeatWrapping;
    boosted.repeat.copy(sourceTexture.repeat);
    boosted.colorSpace = THREE.SRGBColorSpace;
    boosted.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    boosted.needsUpdate = true;
    return boosted;
  }

  function setupSphereTexture(texture) {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1, 1);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  }

  function fileNameFromPath(path) {
    return path.split("/").pop() || path;
  }

  function applySphereTexture(texturePath) {
    sphereTextureStatus.textContent = `Sphere texture: ${fileNameFromPath(texturePath)}`;

    textureLoader.load(
      texturePath,
      (texture) => {
        setupSphereTexture(texture);

        if (playerMaterial) {
          playerMaterial.map = texture;
          playerMaterial.needsUpdate = true;
        }

        sphereTextureStatus.textContent = `Sphere texture: ${fileNameFromPath(texturePath)}`;
      },
      undefined,
      () => {
        sphereTextureStatus.textContent = `Sphere texture missing: ${fileNameFromPath(texturePath)}`;
      }
    );
  }

  function addSphereTextureOption(texturePath) {
    const existing = Array.from(sphereTextureSelect.options).some((option) => option.value === texturePath);
    if (existing) return;

    const option = document.createElement("option");
    option.value = texturePath;
    option.textContent = fileNameFromPath(texturePath);
    sphereTextureSelect.appendChild(option);
  }

  async function discoverSphereTextures() {
    /*
      Browsers cannot reliably list static folders on GitHub Pages.
      This tries local directory listing first, which works with many dev servers
      such as python -m http.server. If the server refuses, default_sphere.png
      still works. Humanity survives one more filesystem disappointment.
    */
    addSphereTextureOption(defaultSphereTexturePath);
    addSphereTextureOption(startupSphereTexturePath);

    try {
      const response = await fetch(sphereTextureBasePath, { cache: "no-store" });
      if (!response.ok) throw new Error("Directory listing unavailable");

      const htmlText = await response.text();
      const matches = [...htmlText.matchAll(/href=["']([^"']*_sphere\.png)["']/gi)]
        .map((match) => match[1])
        .map((href) => href.startsWith("http") || href.startsWith("/") ? href : `${sphereTextureBasePath}${href.split("/").pop()}`);

      const uniqueMatches = [...new Set(matches)].sort((a, b) => fileNameFromPath(a).localeCompare(fileNameFromPath(b)));

      for (const texturePath of uniqueMatches) {
        addSphereTextureOption(texturePath);
      }

      sphereTextureStatus.textContent = uniqueMatches.length
        ? `Sphere textures found: ${uniqueMatches.length}`
        : `Sphere texture: ${fileNameFromPath(startupSphereTexturePath)}`;
    } catch (error) {
      sphereTextureStatus.textContent = `Sphere texture: ${fileNameFromPath(startupSphereTexturePath)}`;
    }
  }

  const dirtTexture = textureLoader.load(
    "assets/png/dirt.png",
    setupRepeatingTexture,
    undefined,
    () => console.warn("Could not load assets/png/dirt.png. Falling back to brown material.")
  );

  const grassTexture = textureLoader.load(
    "assets/png/grass.png",
    setupRepeatingTexture,
    undefined,
    () => console.warn("Could not load assets/png/grass.png. Falling back to green material.")
  );

  const waterTexture = textureLoader.load(
    "assets/png/water.png",
    setupRepeatingTexture,
    undefined,
    () => console.warn("Could not load assets/png/water.png. Falling back to blue material.")
  );

  const waterSurfaceTexture = textureLoader.load(
    "assets/png/water.png",
    setupRepeatingTexture,
    undefined,
    () => console.warn("Could not load assets/png/water.png for the animated water surface layer.")
  );

  const sandTexture = textureLoader.load(
    "assets/png/sand.png",
    (texture) => {
      setupRepeatingTexture(texture);
      const boosted = createContrastBoostedTexture(texture, 1.7, 6);
      sandMaterial.map = boosted;
      sandMaterial.needsUpdate = true;
    },
    undefined,
    () => console.warn("Could not load assets/png/sand.png. Falling back to sandy material.")
  );

  const cobblestoneTexture = textureLoader.load(
    "assets/png/cobblestone.png",
    (texture) => {
      setupRepeatingTexture(texture);
      texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    },
    undefined,
    () => console.warn("Could not load assets/png/cobblestone.png. Rubble piles will use plain gray, because files continue to be society's weakest link.")
  );

  function setupCrackOverlayTexture(texture) {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1, 1);
    texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  }

  const crackOverlay01Texture = textureLoader.load(
    "assets/png/crack-overlay-01-state.png",
    setupCrackOverlayTexture,
    undefined,
    () => console.warn("Could not load assets/png/crack-overlay-01-state.png. Rubble cracking state 1 will be spiritually present but visually absent.")
  );

  const crackOverlay02Texture = textureLoader.load(
    "assets/png/crack-overlay-02-state.png",
    setupCrackOverlayTexture,
    undefined,
    () => console.warn("Could not load assets/png/crack-overlay-02-state.png. Rubble cracking state 2 has chosen invisibility.")
  );


  const grassMaterial = new THREE.MeshStandardMaterial({
    color: 0x78c94b,
    map: grassTexture,
    roughness: 0.9,
    metalness: 0.0,
    side: THREE.DoubleSide
  });

  const dirtMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: dirtTexture,
    roughness: 0.94,
    metalness: 0.0,
    side: THREE.DoubleSide
  });

  const waterMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: waterTexture,
    roughness: 0.14,
    metalness: 0.05,
    transparent: true,
    opacity: 0.58,
    side: THREE.DoubleSide
  });

  const waterSurfaceMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: waterSurfaceTexture,
    roughness: 0.06,
    metalness: 0.02,
    transparent: true,
    opacity: 0.20,
    side: THREE.DoubleSide,
    depthWrite: false
  });

  const sandMaterial = new THREE.MeshStandardMaterial({
    color: 0xf5ecd2,
    map: sandTexture,
    roughness: 0.9,
    metalness: 0.0,
    side: THREE.DoubleSide
  });


  const rubbleMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: cobblestoneTexture,
    roughness: 0.96,
    metalness: 0.02,
    side: THREE.DoubleSide
  });

  const rubbleCrackOverlay01Material = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    map: crackOverlay01Texture,
    transparent: true,
    alphaTest: 0.035,
    depthTest: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2
  });

  const rubbleCrackOverlay02Material = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    map: crackOverlay02Texture,
    transparent: true,
    alphaTest: 0.035,
    depthTest: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -3,
    polygonOffsetUnits: -3
  });


  const gridMaterial = new THREE.LineBasicMaterial({
    color: 0x101810,
    transparent: true,
    opacity: 0.18
  });

  const pineTreeTexture = textureLoader.load(
    "assets/png/pine-tree01.png",
    (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    },
    undefined,
    () => console.warn("Could not load assets/png/pine-tree01.png. Trees will be invisible, because even forests need file paths.")
  );

  const topdownPineTreeTexture = textureLoader.load(
    "assets/png/topdown-pine-tree01.png",
    (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    },
    undefined,
    () => console.warn("Could not load assets/png/topdown-pine-tree01.png. Flattened trees will be invisible, which is one way to model deforestation.")
  );

  const pineTreeMaterial = new THREE.MeshBasicMaterial({
    map: pineTreeTexture,
    color: 0xffffff,
    transparent: true,
    alphaTest: 0.08,
    depthWrite: false,
    depthTest: false,
    fog: true,
    side: THREE.DoubleSide
  });

  const flatPineTreeMaterial = new THREE.MeshStandardMaterial({
    map: topdownPineTreeTexture,
    color: 0xffffff,
    transparent: true,
    alphaTest: 0.08,
    depthTest: true,
    depthWrite: false,
    fog: true,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    roughness: 0.94,
    metalness: 0.0
  });

  // Tree billboards use a real vertical plane instead of THREE.Sprite.
  // Sprites auto-copy the full camera tilt, which made the pines lean over like dramatic theater kids.
  const pineTreePlaneGeometry = new THREE.PlaneGeometry(1, 1);
  pineTreePlaneGeometry.translate(0, 0.5, 0);

  const flatPineTreePlaneGeometry = new THREE.PlaneGeometry(1, 1, 88, 88);
  const flatPineTreePositions = flatPineTreePlaneGeometry.attributes.position;
  for (let i = 0; i < flatPineTreePositions.count; i += 1) {
    const x = flatPineTreePositions.getX(i);
    const y = flatPineTreePositions.getY(i);
    const radial = Math.min(1, Math.sqrt(x * x + y * y) / 0.70710678118);
    const edgeClamp = Math.max(0, 1 - radial);
    const edgeFalloff = Math.pow(edgeClamp, 0.86);
    const centerMass = Math.pow(Math.max(0, 1 - radial * radial), 1.12);
    const dome = 0.42 * centerMass;
    const shoulderLift = 0.06 * Math.pow(Math.max(0, 1 - Math.abs(radial - 0.46) / 0.46), 1.7);
    const primaryRipple = (
      Math.sin((x * 4.3 + y * 1.9) * Math.PI) * 0.032 +
      Math.cos((x * 2.6 - y * 3.6) * Math.PI) * 0.024
    ) * Math.pow(edgeFalloff, 1.25);
    const secondaryRipple = (
      Math.sin((x - y) * Math.PI * 6.4) * 0.014 +
      Math.cos((x + y) * Math.PI * 5.6) * 0.012
    ) * Math.pow(edgeFalloff, 1.65);
    flatPineTreePositions.setZ(i, Math.max(0, dome + shoulderLift + primaryRipple + secondaryRipple));
  }
  flatPineTreePositions.needsUpdate = true;
  flatPineTreePlaneGeometry.computeVertexNormals();
  flatPineTreePlaneGeometry.computeBoundingBox();
  flatPineTreePlaneGeometry.computeBoundingSphere();

  // The PNG contains a little transparent padding below the visible tree base.
  // Nudge the crossed planes down so the visible pixels, not the invisible rectangle, kiss the grass.
  const treeVisibleBottomTrimRatio = 0.065;


  function updateAnimatedMaterials(deltaSeconds, elapsedSeconds) {
    if (waterTexture) {
      waterTexture.offset.x = (waterTexture.offset.x + deltaSeconds * 0.012) % 1;
      waterTexture.offset.y = (waterTexture.offset.y + deltaSeconds * 0.006) % 1;
    }

    if (waterSurfaceTexture) {
      /*
        Faster diagonal water motion for the animated top layer.
        No side-to-side sway nonsense now — just a steady diagonal drift.
      */
      waterSurfaceTexture.offset.x = (waterSurfaceTexture.offset.x + deltaSeconds * 0.32) % 1;
      waterSurfaceTexture.offset.y = (waterSurfaceTexture.offset.y + deltaSeconds * 0.24) % 1;
    }

    waterSurfaceMaterial.opacity = 0.18 + (Math.sin(elapsedSeconds * 2.4) * 0.055 + 0.055);
  }

  function createPlayerMaterial() {
    playerMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.42,
      metalness: 0.05
    });
    return playerMaterial;
  }

  return {
    loadingManager,
    textureLoader,
    sphereTextureBasePath,
    defaultSphereTexturePath,
    startupSphereTexturePath,
    applySphereTexture,
    addSphereTextureOption,
    discoverSphereTextures,
    updateAnimatedMaterials,
    createPlayerMaterial,
    grassMaterial,
    dirtMaterial,
    waterMaterial,
    waterSurfaceMaterial,
    sandMaterial,
    rubbleMaterial,
    rubbleCrackOverlay01Material,
    rubbleCrackOverlay02Material,
    gridMaterial,
    waterTexture,
    waterSurfaceTexture,
    pineTreeMaterial,
    flatPineTreeMaterial,
    pineTreePlaneGeometry,
    flatPineTreePlaneGeometry,
    treeVisibleBottomTrimRatio
  };
}

export function createGraphicsPipeline({
  THREE,
  camera,
  state,
  player,
  tileSize,
  heightStep,
  seaLevel,
  maxHeightLevels,
  chunkWorldSize,
  distantLodRadius,
  lodFogCurtain,
  horizonHazeDisk,
  underwaterOverlay,
  minimap,
  minimapCanvas,
  minimapZoomSlider,
  minimapZoomStatus,
  sphereCoordsReadout,
  cameraDirectionReadout,
  spawnCoordsReadout,
  deletedTreeKeys,
  getTreeColliderKey,
  getTerrainSampleAtTile,
  getTreeSampleAtTile,
  getActiveSpawnPoint,
  getIsThirdPersonMode,
  getHideMinimap,
  getHideTrees,
  getShowGridLines,
  formatXYZ,
  formatYaw,
  updateBushesCollectedReadout
}) {
  let underwaterOverlayTime = 0;
  let minimapFrameCounter = 0;
  let minimapZoom = 1;
  const minimapBaseTilesAcross = 66;
  const minimapContext = minimapCanvas ? minimapCanvas.getContext("2d") : null;
  const minimapTreeIcon = new Image();
  let minimapTreeIconReady = false;

  minimapTreeIcon.onload = () => {
    minimapTreeIconReady = true;
    drawMinimap();
  };

  minimapTreeIcon.onerror = () => {
    console.warn("Could not load assets/png/topdown-pine-tree01.png for minimap tree icons. The forest remains emotionally unavailable.");
  };

  minimapTreeIcon.src = "assets/png/topdown-pine-tree01.png";

  function sliderValueToMinimapZoom(value) {
    const numericValue = Number(value);

    if (numericValue > 0) return numericValue;
    if (numericValue < 0) return 1 / Math.abs(numericValue);
    return 1;
  }

  function normalizeMinimapSliderValue(value) {
    const numericValue = Number(value);
    return numericValue === 0 ? 1 : numericValue;
  }

  function updateMinimapZoomFromSlider() {
    if (!minimapZoomSlider || !minimapZoomStatus) return;

    const sliderValue = normalizeMinimapSliderValue(minimapZoomSlider.value);

    if (Number(minimapZoomSlider.value) === 0) {
      minimapZoomSlider.value = "1";
    }

    minimapZoom = sliderValueToMinimapZoom(sliderValue);
    minimapZoomStatus.textContent = `Minimap zoom: ${sliderValue}x`;
    drawMinimap();
  }

  function attachMinimapControls() {
    if (minimapZoomSlider) {
      minimapZoomSlider.addEventListener("input", updateMinimapZoomFromSlider);
    }

    window.__updateMinimapZoomFromSlider = updateMinimapZoomFromSlider;
    window.__drawMinimapNow = drawMinimap;
    updateMinimapZoomFromSlider();
  }

  function updateLodFogCurtain() {
    /*
      Radius is placed slightly inside the distant LOD limit so it overlaps the seam
      between detailed terrain, remembered terrain, and sky fog.
    */
    const curtainRadius = chunkWorldSize * (distantLodRadius - 0.75);
    const curtainHeight = 1250;
    const curtainY = 260;

    lodFogCurtain.position.set(state.target.x, curtainY, state.target.z);
    lodFogCurtain.scale.set(curtainRadius, curtainHeight, curtainRadius);

    horizonHazeDisk.position.set(state.target.x, seaLevel * heightStep + 34, state.target.z);
    horizonHazeDisk.scale.set(curtainRadius * 0.92, curtainRadius * 0.92, 1);

    // The farther the camera is zoomed out, the more useful the horizon haze becomes.
    const zoomFade = THREE.MathUtils.clamp((state.distance - 120) / 900, 0.34, 0.66);
    lodFogCurtain.material.opacity = zoomFade;
    horizonHazeDisk.material.opacity = THREE.MathUtils.clamp(zoomFade * 0.68, 0.26, 0.46);
  }

  function updateUnderwaterOverlay(deltaSeconds) {
    underwaterOverlayTime += deltaSeconds;

    /*
      Trigger the underwater tint from the CAMERA being below sea_level,
      not from the player's underwater state. The camera is the eyeball.
      Shocking, I know. Optics: invented before JavaScript, still somehow forgotten.
    */
    const seaSurfaceY = seaLevel * heightStep + 0.18;
    const underwaterView =
      getIsThirdPersonMode() &&
      player.mesh &&
      camera.position.y < seaSurfaceY - 0.04;

    if (!underwaterView) {
      underwaterOverlay.style.opacity = "0";
      return;
    }

    const depth = seaSurfaceY - camera.position.y;
    const overlayOpacity = THREE.MathUtils.clamp(0.46 + depth * 0.018, 0.46, 0.86);

    underwaterOverlay.style.opacity = overlayOpacity.toFixed(3);
    underwaterOverlay.style.backgroundPosition =
      `center center, ${underwaterOverlayTime * 32}px ${underwaterOverlayTime * 21}px`;
  }

  function updateNerdStats() {
    const activeSpawnPoint = getActiveSpawnPoint();

    if (getIsThirdPersonMode() && player.mesh) {
      const relative = {
        x: player.mesh.position.x - activeSpawnPoint.x,
        y: player.mesh.position.y - activeSpawnPoint.y,
        z: player.mesh.position.z - activeSpawnPoint.z
      };

      sphereCoordsReadout.textContent = `Sphere XYZ from spawn: ${formatXYZ(relative)}`;
      cameraDirectionReadout.textContent = `Camera facing: ${formatYaw(state.yaw)}`;
    } else {
      const relative = {
        x: state.target.x - activeSpawnPoint.x,
        y: state.target.y - activeSpawnPoint.y,
        z: state.target.z - activeSpawnPoint.z
      };

      sphereCoordsReadout.textContent = `Camera XYZ from spawn: ${formatXYZ(relative)}`;
      cameraDirectionReadout.textContent = `Camera facing: ${formatYaw(state.yaw)}`;
    }

    spawnCoordsReadout.textContent = `Spawn XYZ: ${formatXYZ(activeSpawnPoint)} facing ${formatYaw(activeSpawnPoint.yaw)}`;
    updateBushesCollectedReadout();
  }

  function getMinimapCenterWorld() {
    if (getIsThirdPersonMode() && player.mesh) {
      return {
        x: player.mesh.position.x,
        z: player.mesh.position.z
      };
    }

    return {
      x: state.target.x,
      z: state.target.z
    };
  }

  function drawMinimapTreeIcons(ctx, centerTileX, centerTileZ, halfTiles, tilePixels) {
    if (getHideTrees() || !minimapTreeIconReady) return;

    /*
      Tree icons are generated from the same deterministic terrain/tree sampling
      as the actual spawned forest, not from currently loaded chunks. This keeps
      the minimap honest even when chunks pop in/out, a rare outbreak of integrity.
    */
    for (let dz = -halfTiles - 1; dz < halfTiles + 1; dz += 1) {
      for (let dx = -halfTiles - 1; dx < halfTiles + 1; dx += 1) {
        const gx = centerTileX + dx;
        const gz = centerTileZ + dz;
        const sample = getTerrainSampleAtTile(gx, gz);
        const tree = getTreeSampleAtTile(gx, gz, sample);
        if (!tree || deletedTreeKeys.has(getTreeColliderKey(tree.globalX, tree.globalZ))) continue;

        // Match the actual world spawn anchor: single trees center on one tile, 2x2 trees center on the full footprint.
        const treeCenterOffset = tree.footprintSize * 0.5;
        const treeDx = tree.globalX + treeCenterOffset - centerTileX;
        const treeDz = tree.globalZ + treeCenterOffset - centerTileZ;
        const px = (treeDx + halfTiles) * tilePixels;
        const py = (treeDz + halfTiles) * tilePixels;
        const iconSize = Math.max(5, tilePixels * tree.footprintSize * 1.55);
        const alpha = Math.max(0.62, Math.min(0.95, tree.opacity));

        if (px < -iconSize || px > minimapCanvas.width + iconSize || py < -iconSize || py > minimapCanvas.height + iconSize) {
          continue;
        }

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.drawImage(
          minimapTreeIcon,
          px - iconSize * 0.5,
          py - iconSize * 0.5,
          iconSize,
          iconSize
        );
        ctx.restore();
      }
    }
  }

  function drawMinimap() {
    if (getHideMinimap() || !minimapContext) return;

    /*
      Top-down minimap that mirrors the generated tiles around the sphere.
      The grid is intentionally coarse: one minimap grid square = 3x3 world tiles.
      A tiny lie? No. A tiny abstraction. Society continues to limp onward.
    */
    const ctx = minimapContext;
    const width = minimapCanvas.width;
    const height = minimapCanvas.height;
    const center = getMinimapCenterWorld();

    const centerTileX = Math.floor(center.x / tileSize);
    const centerTileZ = Math.floor(center.z / tileSize);

    // One drawn pixel block is one real generated tile.
    // Zooming in reduces the number of world tiles shown, which increases per-tile detail.
    const rawTilesAcross = minimapBaseTilesAcross / minimapZoom;
    const tilesAcross = Math.max(12, Math.round(rawTilesAcross / 6) * 6); // keep symmetric and compatible with 3x3 grid squares
    const tilePixels = width / tilesAcross;
    const halfTiles = Math.floor(tilesAcross / 2);
    const minimapGridWorldTiles = 3;
    const startTileX = centerTileX - halfTiles;
    const startTileZ = centerTileZ - halfTiles;

    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, width, height);

    for (let dz = -halfTiles; dz < halfTiles; dz += 1) {
      for (let dx = -halfTiles; dx < halfTiles; dx += 1) {
        const gx = centerTileX + dx;
        const gz = centerTileZ + dz;
        const sample = getTerrainSampleAtTile(gx, gz);

        const north = getTerrainSampleAtTile(gx, gz - 1);
        const south = getTerrainSampleAtTile(gx, gz + 1);
        const west = getTerrainSampleAtTile(gx - 1, gz);
        const east = getTerrainSampleAtTile(gx + 1, gz);

        const isWaterSample = (candidate) =>
          candidate.waterLevel === seaLevel && candidate.landLevel < seaLevel;

        const hasWater = isWaterSample(sample);
        const northHasWater = isWaterSample(north);
        const southHasWater = isWaterSample(south);
        const westHasWater = isWaterSample(west);
        const eastHasWater = isWaterSample(east);

        const isInteriorWater = hasWater && northHasWater && southHasWater && westHasWater && eastHasWater;
        const isShorelineWater = hasWater && !isInteriorWater;
        const adjacentWater = northHasWater || southHasWater || westHasWater || eastHasWater;

        const nearSeaLevel =
          sample.landLevel <= seaLevel + 2 ||
          north.landLevel <= seaLevel + 1 ||
          south.landLevel <= seaLevel + 1 ||
          west.landLevel <= seaLevel + 1 ||
          east.landLevel <= seaLevel + 1;

        const touchesBeachWall =
          !hasWater &&
          (
            adjacentWater ||
            (sample.landLevel <= seaLevel + 3 && (
              Math.abs(sample.landLevel - north.landLevel) > 0 ||
              Math.abs(sample.landLevel - south.landLevel) > 0 ||
              Math.abs(sample.landLevel - west.landLevel) > 0 ||
              Math.abs(sample.landLevel - east.landLevel) > 0
            ))
          );

        const isBeachLand = !hasWater && nearSeaLevel && touchesBeachWall;

        const px = Math.floor((dx + halfTiles) * tilePixels);
        const py = Math.floor((dz + halfTiles) * tilePixels);
        const size = Math.ceil(tilePixels) + 1;

        if (isInteriorWater) {
          ctx.fillStyle = "#36c5ee";
        } else if (isShorelineWater || isBeachLand) {
          ctx.fillStyle = "#eee0a1";
        } else {
          const level = Math.max(0, Math.min(maxHeightLevels, sample.landLevel));
          const heightShade = level / maxHeightLevels;

          const r = Math.round(28 + heightShade * 42);
          const g = Math.round(118 + heightShade * 78);
          const b = Math.round(38 + heightShade * 22);
          ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        }

        ctx.fillRect(px, py, size, size);
      }
    }

    /*
      Topological height outlines:
      Draw subtle dark contour edges where neighboring tile heights differ.
      This reveals hills/valleys inside grass regions without turning the minimap
      into unreadable spreadsheet confetti. Barely restrained cartography.
    */
    ctx.strokeStyle = "rgba(0, 0, 0, 0.46)";
    ctx.lineWidth = 1;

    for (let dz = -halfTiles; dz < halfTiles; dz += 1) {
      for (let dx = -halfTiles; dx < halfTiles; dx += 1) {
        const gx = centerTileX + dx;
        const gz = centerTileZ + dz;
        const sample = getTerrainSampleAtTile(gx, gz);
        const east = getTerrainSampleAtTile(gx + 1, gz);
        const south = getTerrainSampleAtTile(gx, gz + 1);

        const px = Math.floor((dx + halfTiles) * tilePixels);
        const py = Math.floor((dz + halfTiles) * tilePixels);

        if (sample.landLevel !== east.landLevel) {
          const strength = Math.min(0.78, 0.28 + Math.abs(sample.landLevel - east.landLevel) * 0.08);
          ctx.strokeStyle = `rgba(0, 0, 0, ${strength})`;
          ctx.beginPath();
          ctx.moveTo(px + tilePixels, py);
          ctx.lineTo(px + tilePixels, py + tilePixels);
          ctx.stroke();
        }

        if (sample.landLevel !== south.landLevel) {
          const strength = Math.min(0.78, 0.28 + Math.abs(sample.landLevel - south.landLevel) * 0.08);
          ctx.strokeStyle = `rgba(0, 0, 0, ${strength})`;
          ctx.beginPath();
          ctx.moveTo(px, py + tilePixels);
          ctx.lineTo(px + tilePixels, py + tilePixels);
          ctx.stroke();
        }
      }
    }

    drawMinimapTreeIcons(ctx, centerTileX, centerTileZ, halfTiles, tilePixels);

    if (getShowGridLines()) {
      /*
        Minimap grid aligned to actual world-tile boundaries.
        Each grid cell represents 3x3 world tiles, and the lines are positioned from
        the current visible start tile instead of just being stamped at arbitrary intervals.
      */
      ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
      ctx.lineWidth = 1;

      const mod3 = (value) => ((value % minimapGridWorldTiles) + minimapGridWorldTiles) % minimapGridWorldTiles;

      for (let i = 0; i <= tilesAcross; i += 1) {
        const worldBoundaryTileX = startTileX + i;
        if (mod3(worldBoundaryTileX) !== 0) continue;

        const px = Math.round(i * tilePixels) + 0.5;
        ctx.beginPath();
        ctx.moveTo(px, 0);
        ctx.lineTo(px, height);
        ctx.stroke();
      }

      for (let i = 0; i <= tilesAcross; i += 1) {
        const worldBoundaryTileZ = startTileZ + i;
        if (mod3(worldBoundaryTileZ) !== 0) continue;

        const py = Math.round(i * tilePixels) + 0.5;
        ctx.beginPath();
        ctx.moveTo(0, py);
        ctx.lineTo(width, py);
        ctx.stroke();
      }
    }

    // Slightly stronger crosshair through the player tile.
    ctx.strokeStyle = "rgba(255, 255, 255, 0.18)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(width / 2, 0);
    ctx.lineTo(width / 2, height);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();

    // Player red dot, centered exactly on the tile the sphere occupies.
    ctx.fillStyle = "#ff1e1e";
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(width / 2, height / 2, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Facing direction tick.
    const dirX = -Math.sin(state.yaw);
    const dirY = -Math.cos(state.yaw);
    ctx.strokeStyle = "#ff1e1e";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(width / 2, height / 2);
    ctx.lineTo(width / 2 + dirX * 16, height / 2 + dirY * 16);
    ctx.stroke();
  }

  function updateMinimapFrame() {
    minimapFrameCounter += 1;
    if (minimapFrameCounter % 4 === 0) {
      drawMinimap();
    }
  }

  return {
    attachMinimapControls,
    updateMinimapZoomFromSlider,
    updateLodFogCurtain,
    updateUnderwaterOverlay,
    updateNerdStats,
    drawMinimap,
    updateMinimapFrame
  };
}
