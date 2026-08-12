export function createNpcEnemiesController({
  THREE,
  scene,
  renderer = null,
  camera = null,
  player,
  seedNumber = 0,
  tileSize = 4,
  seaLevel = 8,
  getTerrainSampleAtTile,
  getVisibleSurfaceHeightAtWorld,
  getTreeSampleAtTile = null,
  hasRedSlotRubble = () => false,
  consumeRedSlotRubble = () => false,
  onSpringCollected = () => {},
  renderRadiusTiles = 100,
  cullRadiusTiles = 112,
  cellTiles = 16,
  maxActiveEnemies = 72
} = {}) {
  const enemies = new Map();
  const cloudPlatforms = new Map();
  const springProjectiles = new Set();
  const springPickups = new Set();
  const nearbyCellKeys = new Set();
  const nearbyCloudCellKeys = new Set();
  const reusableVector = new THREE.Vector3();

  const spawnScanInterval = 0.28;
  const cloudScanInterval = 0.42;
  const enemyBaseScale = 3.45;
  const enemyContactRadius = 2.65;
  const enemyLaunchVelocity = 132;
  const megaSpringScaleMultiplier = 2;
  const megaSpringLaunchMultiplier = 2;
  const enemyLaunchCooldownSeconds = 0.72;
  const corruptedSpringChaseSpeed = 18;
  const rareHueSpringChance = 0.0333;
  const rareHueSpringDefeatHits = 5;
  const cloudCellTiles = 12;
  const maxActiveClouds = 420;
  let spawnScanTimer = 0;
  let cloudScanTimer = 0;
  let previousPlayerBottomY = -Infinity;

  const safeRenderRadiusTiles = Math.max(12, Math.floor(renderRadiusTiles));
  const safeCullRadiusTiles = Math.max(safeRenderRadiusTiles + 4, Math.floor(cullRadiusTiles));
  const renderRadiusWorldSq = Math.pow(safeRenderRadiusTiles * tileSize, 2);
  const cullRadiusWorldSq = Math.pow(safeCullRadiusTiles * tileSize, 2);

  const enemyMaterial = new THREE.MeshStandardMaterial({
    color: 0xff00d6,
    emissive: 0x7a004f,
    emissiveIntensity: 0.58,
    roughness: 0.34,
    metalness: 0.08
  });

  const coreMaterial = new THREE.MeshStandardMaterial({
    color: 0x5a003f,
    emissive: 0xff00bb,
    emissiveIntensity: 0.42,
    roughness: 0.42,
    metalness: 0.05
  });

  const eyeMaterial = new THREE.MeshStandardMaterial({
    color: 0x190017,
    emissive: 0xff8cf0,
    emissiveIntensity: 0.9,
    roughness: 0.28
  });

  const cloudMaterial = new THREE.MeshStandardMaterial({
    color: 0xf8fbff,
    emissive: 0x8ebcff,
    emissiveIntensity: 0.18,
    roughness: 0.82,
    metalness: 0,
    transparent: true,
    opacity: 0.92,
    depthWrite: false
  });

  const cloudShadowMaterial = new THREE.MeshBasicMaterial({
    color: 0xb8d7ff,
    transparent: true,
    opacity: 0.3,
    depthWrite: false
  });

  const springGeometry = createHourglassSpringGeometry();
  const waistGeometry = new THREE.SphereGeometry(0.28, 16, 10);
  const ringGeometry = new THREE.TorusGeometry(0.72, 0.055, 8, 28);
  const eyeGeometry = new THREE.SphereGeometry(0.075, 8, 6);
  const auraRingGeometry = new THREE.TorusGeometry(1.25, 0.035, 8, 42);
  const auraFlameGeometry = new THREE.ConeGeometry(0.18, 1.2, 8);
  const cloudPuffGeometry = new THREE.SphereGeometry(1, 18, 12);
  const springStoneGeometry = new THREE.SphereGeometry(0.42, 14, 10);
  const springPickupGeometry = new THREE.PlaneGeometry(3.2, 3.2);
  const springPickupTexture = new THREE.TextureLoader().load("assets/png/magenta-spring-item.png");
  springPickupTexture.colorSpace = THREE.SRGBColorSpace;
  const springStoneMaterial = new THREE.MeshStandardMaterial({
    color: 0x8f8a82,
    roughness: 0.9,
    metalness: 0.02
  });
  const springClickPointer = new THREE.Vector2();
  const springClickRaycaster = new THREE.Raycaster();
  let springPickupVacuumActive = false;

  function hash2D(x, z, salt = 0) {
    let h = seedNumber ^ Math.imul(x, 374761393) ^ Math.imul(z, 668265263) ^ Math.imul(salt, 2246822519);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967295;
  }

  function cellKey(cellX, cellZ) {
    return `${cellX},${cellZ}`;
  }

  function tileKey(tileX, tileZ) {
    return `${tileX},${tileZ}`;
  }

  function tileCenterWorld(tileX, tileZ) {
    return {
      x: (tileX + 0.5) * tileSize,
      z: (tileZ + 0.5) * tileSize
    };
  }

  function distanceSqToPlayerWorld(x, z) {
    if (!player?.mesh) return Infinity;
    const dx = x - player.mesh.position.x;
    const dz = z - player.mesh.position.z;
    return dx * dx + dz * dz;
  }

  function isTileWalkable(tileX, tileZ) {
    if (typeof getTerrainSampleAtTile !== "function") return true;

    const sample = getTerrainSampleAtTile(tileX, tileZ);
    if (!sample || sample.waterLevel === seaLevel || sample.landLevel <= seaLevel + 1) return false;

    const north = getTerrainSampleAtTile(tileX, tileZ - 1);
    const south = getTerrainSampleAtTile(tileX, tileZ + 1);
    const west = getTerrainSampleAtTile(tileX - 1, tileZ);
    const east = getTerrainSampleAtTile(tileX + 1, tileZ);
    const maxStep = Math.max(
      Math.abs(sample.landLevel - north.landLevel),
      Math.abs(sample.landLevel - south.landLevel),
      Math.abs(sample.landLevel - west.landLevel),
      Math.abs(sample.landLevel - east.landLevel)
    );

    if (maxStep > 2) return false;
    if (typeof getTreeSampleAtTile === "function" && getTreeSampleAtTile(tileX, tileZ, sample)) return false;

    return true;
  }

  function getSurfaceYAtTile(tileX, tileZ) {
    const { x, z } = tileCenterWorld(tileX, tileZ);
    if (typeof getVisibleSurfaceHeightAtWorld === "function") {
      return getVisibleSurfaceHeightAtWorld(x, z);
    }

    const sample = getTerrainSampleAtTile?.(tileX, tileZ);
    return sample ? sample.landLevel * 3 : 0;
  }

  function createHourglassSpringGeometry() {
    class HourglassSpringCurve extends THREE.Curve {
      getPoint(t, target = new THREE.Vector3()) {
        const centered = t - 0.5;
        const angle = t * Math.PI * 2 * 5.5;
        const radius = 0.18 + Math.abs(centered) * 1.15;
        const y = (t - 0.5) * 2.55;
        target.set(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
        return target;
      }
    }

    return new THREE.TubeGeometry(new HourglassSpringCurve(), 130, 0.085, 8, false);
  }

  function createEnemyVisual(enemyScale = enemyBaseScale, { rareHueSpring = false } = {}) {
    const group = new THREE.Group();
    group.name = rareHueSpring ? "npc-hueshifting-hourglass-spring" : "npc-magenta-hourglass-spring";
    group.userData.isNpcEnemy = true;
    group.userData.isRareHueSpring = rareHueSpring;
    group.userData.springMaterials = {
      shell: enemyMaterial.clone(),
      core: coreMaterial.clone(),
      eye: eyeMaterial.clone()
    };
    group.userData.springMeshes = [];
    group.userData.auraMaterials = [];
    group.userData.auraFlames = [];

    const spring = new THREE.Mesh(springGeometry, group.userData.springMaterials.shell);
    spring.castShadow = true;
    spring.receiveShadow = true;
    spring.userData.isNpcSpringHitTarget = true;
    group.add(spring);
    group.userData.springMeshes.push(spring);

    const waist = new THREE.Mesh(waistGeometry, group.userData.springMaterials.core);
    waist.scale.set(1, 0.64, 1);
    waist.userData.isNpcSpringHitTarget = true;
    group.add(waist);
    group.userData.springMeshes.push(waist);

    const topRing = new THREE.Mesh(ringGeometry, group.userData.springMaterials.shell);
    topRing.position.y = 1.31;
    topRing.rotation.x = Math.PI / 2;
    topRing.userData.isNpcSpringHitTarget = true;
    group.add(topRing);
    group.userData.springMeshes.push(topRing);

    const bottomRing = new THREE.Mesh(ringGeometry, group.userData.springMaterials.shell);
    bottomRing.position.y = -1.31;
    bottomRing.rotation.x = Math.PI / 2;
    bottomRing.userData.isNpcSpringHitTarget = true;
    group.add(bottomRing);
    group.userData.springMeshes.push(bottomRing);

    const leftEye = new THREE.Mesh(eyeGeometry, group.userData.springMaterials.eye);
    leftEye.position.set(-0.18, 0.22, -0.32);
    leftEye.userData.isNpcSpringHitTarget = true;
    group.add(leftEye);
    group.userData.springMeshes.push(leftEye);

    const rightEye = new THREE.Mesh(eyeGeometry, group.userData.springMaterials.eye);
    rightEye.position.set(0.18, 0.22, -0.32);
    rightEye.userData.isNpcSpringHitTarget = true;
    group.add(rightEye);
    group.userData.springMeshes.push(rightEye);

    if (rareHueSpring) {
      const auraMaterial = new THREE.MeshBasicMaterial({
        color: 0xfff36a,
        transparent: true,
        opacity: 0.48,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending
      });
      group.userData.auraMaterials.push(auraMaterial);

      for (let i = 0; i < 3; i += 1) {
        const ring = new THREE.Mesh(auraRingGeometry, auraMaterial.clone());
        ring.rotation.x = Math.PI * 0.5;
        ring.position.y = -1.12 + i * 1.05;
        ring.scale.setScalar(1 + i * 0.18);
        ring.renderOrder = 10;
        group.add(ring);
        group.userData.auraMaterials.push(ring.material);
      }

      const flameCount = 10;
      for (let i = 0; i < flameCount; i += 1) {
        const angle = (i / flameCount) * Math.PI * 2;
        const flameMaterial = auraMaterial.clone();
        const flame = new THREE.Mesh(auraFlameGeometry, flameMaterial);
        flame.position.set(Math.cos(angle) * 1.08, 0.2 + (i % 3) * 0.26, Math.sin(angle) * 1.08);
        flame.rotation.z = -0.24 + (i % 3) * 0.24;
        flame.userData.baseAngle = angle;
        flame.userData.phase = i * 0.61;
        flame.renderOrder = 11;
        group.add(flame);
        group.userData.auraFlames.push(flame);
        group.userData.auraMaterials.push(flameMaterial);
      }
    }

    group.scale.setScalar(enemyScale);
    return group;
  }

  function createCloudVisual(cloud) {
    const group = new THREE.Group();
    group.name = "npc-puffy-cloud-platform";
    group.userData.isNpcCloudPlatform = true;
    group.userData.opacityMaterials = [];

    const puffMaterial = cloudMaterial.clone();
    const padMaterial = cloudShadowMaterial.clone();
    group.userData.opacityMaterials.push(puffMaterial, padMaterial);

    const puffCount = 12;
    for (let i = 0; i < puffCount; i += 1) {
      const angle = (i / puffCount) * Math.PI * 2;
      const ring = i === 0 ? 0 : 1;
      const radius = ring ? 0.42 + hash2D(cloud.cellX, cloud.cellZ, 700 + i) * 0.48 : 0;
      const puff = new THREE.Mesh(cloudPuffGeometry, puffMaterial);
      puff.position.set(
        Math.cos(angle) * cloud.radiusX * radius,
        -0.54 + hash2D(cloud.cellX, cloud.cellZ, 800 + i) * 1.02,
        Math.sin(angle) * cloud.radiusZ * radius
      );
      puff.scale.set(
        2.75 + hash2D(cloud.cellX, cloud.cellZ, 900 + i) * 2.75,
        0.96 + hash2D(cloud.cellX, cloud.cellZ, 1000 + i) * 0.82,
        2.35 + hash2D(cloud.cellX, cloud.cellZ, 1100 + i) * 2.45
      );
      group.add(puff);
    }

    const topPad = new THREE.Mesh(
      new THREE.CylinderGeometry(1, 1, 0.16, 36),
      padMaterial
    );
    topPad.name = "npc-cloud-soft-landing-pad";
    topPad.position.y = 0.1;
    topPad.scale.set(cloud.radiusX, 1, cloud.radiusZ);
    topPad.renderOrder = 2;
    group.add(topPad);

    return group;
  }

  function findSpawnTileForCell(cellX, cellZ) {
    const baseX = cellX * cellTiles;
    const baseZ = cellZ * cellTiles;
    const tries = 8;

    for (let i = 0; i < tries; i += 1) {
      const offsetX = Math.floor(hash2D(cellX, cellZ, 100 + i) * cellTiles);
      const offsetZ = Math.floor(hash2D(cellX, cellZ, 200 + i) * cellTiles);
      const tileX = baseX + offsetX;
      const tileZ = baseZ + offsetZ;
      const { x, z } = tileCenterWorld(tileX, tileZ);

      if (distanceSqToPlayerWorld(x, z) > renderRadiusWorldSq) continue;
      if (isTileWalkable(tileX, tileZ)) return { tileX, tileZ };
    }

    return null;
  }

  function shouldCellHaveEnemy(cellX, cellZ) {
    const spawnRoll = hash2D(cellX, cellZ, 17);
    if (spawnRoll > 0.48) return false;

    const playerTileX = Math.floor((player?.mesh?.position.x || 0) / tileSize);
    const playerTileZ = Math.floor((player?.mesh?.position.z || 0) / tileSize);
    const cellCenterTileX = cellX * cellTiles + cellTiles * 0.5;
    const cellCenterTileZ = cellZ * cellTiles + cellTiles * 0.5;
    const dx = cellCenterTileX - playerTileX;
    const dz = cellCenterTileZ - playerTileZ;
    return dx * dx + dz * dz <= safeRenderRadiusTiles * safeRenderRadiusTiles;
  }

  function shouldCellHaveCloud(cellX, cellZ) {
    const spawnRoll = hash2D(cellX, cellZ, 53);
    if (spawnRoll > 0.86) return false;

    const playerTileX = Math.floor((player?.mesh?.position.x || 0) / tileSize);
    const playerTileZ = Math.floor((player?.mesh?.position.z || 0) / tileSize);
    const cellCenterTileX = cellX * cloudCellTiles + cloudCellTiles * 0.5;
    const cellCenterTileZ = cellZ * cloudCellTiles + cloudCellTiles * 0.5;
    const dx = cellCenterTileX - playerTileX;
    const dz = cellCenterTileZ - playerTileZ;
    return dx * dx + dz * dz <= safeRenderRadiusTiles * safeRenderRadiusTiles;
  }

  function createEnemy(cellX, cellZ) {
    const spawnTile = findSpawnTileForCell(cellX, cellZ);
    if (!spawnTile) return null;

    const isMegaSpring = hash2D(cellX, cellZ, 305) >= 0.5;
    const isRareHueSpring = hash2D(cellX, cellZ, 777) < rareHueSpringChance;
    const scaleMultiplier = isMegaSpring ? megaSpringScaleMultiplier : 1;
    const visualScale = enemyBaseScale * scaleMultiplier;
    const enemy = {
      key: cellKey(cellX, cellZ),
      cellX,
      cellZ,
      isMegaSpring,
      isRareHueSpring,
      rareRockHits: 0,
      defeated: false,
      scaleMultiplier,
      visualScale,
      tileX: spawnTile.tileX,
      tileZ: spawnTile.tileZ,
      fromTileX: spawnTile.tileX,
      fromTileZ: spawnTile.tileZ,
      toTileX: spawnTile.tileX,
      toTileZ: spawnTile.tileZ,
      hopElapsed: 0,
      hopDuration: 0.72 + hash2D(cellX, cellZ, 300) * 0.42,
      idleElapsed: hash2D(cellX, cellZ, 301) * 0.4,
      idleDuration: 0.08 + hash2D(cellX, cellZ, 302) * 0.34,
      brainTimer: hash2D(cellX, cellZ, 303) * 0.4,
      launchCooldown: 0,
      wanderAngle: hash2D(cellX, cellZ, 304) * Math.PI * 2,
      visual: createEnemyVisual(visualScale, { rareHueSpring: isRareHueSpring })
    };
    enemy.visual.userData.enemyKey = enemy.key;
    enemy.visual.traverse((child) => {
      if (child.userData?.isNpcSpringHitTarget) {
        child.userData.enemyKey = enemy.key;
      }
    });

    snapEnemyToTile(enemy, enemy.tileX, enemy.tileZ);
    scene.add(enemy.visual);
    enemies.set(enemy.key, enemy);
    chooseNextHop(enemy);
    return enemy;
  }

  function createPlacedEnemyAtTile(tileX, tileZ) {
    if (!Number.isFinite(tileX) || !Number.isFinite(tileZ)) return null;
    const key = `placed:${Math.floor(tileX)},${Math.floor(tileZ)}`;
    if (enemies.has(key)) return null;
    if (!isTileWalkable(tileX, tileZ)) return null;

    const isRareHueSpring = hash2D(Math.floor(tileX), Math.floor(tileZ), 779) < rareHueSpringChance;
    const enemy = {
      key,
      cellX: Math.floor(tileX / cellTiles),
      cellZ: Math.floor(tileZ / cellTiles),
      isPlaced: true,
      isMegaSpring: false,
      isRareHueSpring,
      rareRockHits: 0,
      defeated: false,
      scaleMultiplier: 1,
      visualScale: enemyBaseScale,
      tileX,
      tileZ,
      fromTileX: tileX,
      fromTileZ: tileZ,
      toTileX: tileX,
      toTileZ: tileZ,
      hopElapsed: 0,
      hopDuration: 0.64,
      idleElapsed: 0,
      idleDuration: 0.18,
      brainTimer: 0,
      launchCooldown: 0,
      visual: createEnemyVisual(enemyBaseScale, { rareHueSpring: isRareHueSpring })
    };
    enemy.visual.userData.enemyKey = enemy.key;
    enemy.visual.traverse((child) => {
      if (child.userData?.isNpcSpringHitTarget) {
        child.userData.enemyKey = enemy.key;
      }
    });

    snapEnemyToTile(enemy, tileX, tileZ);
    scene.add(enemy.visual);
    enemies.set(enemy.key, enemy);
    chooseNextHop(enemy);
    return enemy;
  }

  function snapEnemyToTile(enemy, tileX, tileZ) {
    const { x, z } = tileCenterWorld(tileX, tileZ);
    const y = getSurfaceYAtTile(tileX, tileZ) + 1.45;
    enemy.visual.position.set(x, y, z);
  }

  function createCloudPlatform(cellX, cellZ) {
    const baseTileX = cellX * cloudCellTiles;
    const baseTileZ = cellZ * cloudCellTiles;
    const tileX = baseTileX + Math.floor(hash2D(cellX, cellZ, 1200) * cloudCellTiles);
    const tileZ = baseTileZ + Math.floor(hash2D(cellX, cellZ, 1300) * cloudCellTiles);
    const { x, z } = tileCenterWorld(tileX, tileZ);

    if (distanceSqToPlayerWorld(x, z) > renderRadiusWorldSq) return null;

    const terrainY = getSurfaceYAtTile(tileX, tileZ);
    const layer = Math.floor(hash2D(cellX, cellZ, 1400) * 6);
    const radiusX = 9.5 + hash2D(cellX, cellZ, 1500) * 8.5;
    const radiusZ = 8.2 + hash2D(cellX, cellZ, 1600) * 7.4;
    const breathSpeed = 0.38 + hash2D(cellX, cellZ, 1650) * 0.56;
    const breathDepth = 0.18 + hash2D(cellX, cellZ, 1660) * 0.24;
    const fadeSpeed = 0.16 + hash2D(cellX, cellZ, 1670) * 0.24;
    const fadeOffset = hash2D(cellX, cellZ, 1680) * Math.PI * 2;
    const cloud = {
      key: cellKey(cellX, cellZ),
      cellX,
      cellZ,
      x,
      z,
      baseY: terrainY + 18 + layer * 13 + hash2D(cellX, cellZ, 1700) * 8,
      topY: 0,
      opacity: 0,
      radiusX,
      radiusZ,
      currentRadiusX: radiusX,
      currentRadiusZ: radiusZ,
      breathSpeed,
      breathDepth,
      fadeSpeed,
      fadeOffset,
      bobPhase: hash2D(cellX, cellZ, 1800) * Math.PI * 2,
      driftPhase: hash2D(cellX, cellZ, 1900) * Math.PI * 2,
      visual: null
    };

    cloud.visual = createCloudVisual(cloud);
    updateCloudPlatform(cloud, 0);
    scene.add(cloud.visual);
    cloudPlatforms.set(cloud.key, cloud);
    return cloud;
  }

  function chooseNextHop(enemy) {
    const directions = [
      { x: 1, z: 0 },
      { x: -1, z: 0 },
      { x: 0, z: 1 },
      { x: 0, z: -1 },
      { x: 1, z: 1 },
      { x: 1, z: -1 },
      { x: -1, z: 1 },
      { x: -1, z: -1 }
    ];

    enemy.wanderAngle += (hash2D(enemy.tileX, enemy.tileZ, Math.floor(enemy.brainTimer * 1000)) - 0.5) * 1.1;
    const playerTileX = Math.floor((player?.mesh?.position.x || 0) / tileSize);
    const playerTileZ = Math.floor((player?.mesh?.position.z || 0) / tileSize);
    const preferredX = enemy.corrupted
      ? Math.sign(playerTileX - enemy.tileX)
      : Math.round(Math.cos(enemy.wanderAngle));
    const preferredZ = enemy.corrupted
      ? Math.sign(playerTileZ - enemy.tileZ)
      : Math.round(Math.sin(enemy.wanderAngle));
    directions.sort((a, b) => {
      const aScore = a.x * preferredX + a.z * preferredZ + hash2D(enemy.tileX + a.x, enemy.tileZ + a.z, 401) * 0.35;
      const bScore = b.x * preferredX + b.z * preferredZ + hash2D(enemy.tileX + b.x, enemy.tileZ + b.z, 401) * 0.35;
      return bScore - aScore;
    });

    for (const direction of directions) {
      const nextTileX = enemy.tileX + direction.x;
      const nextTileZ = enemy.tileZ + direction.z;
      const { x, z } = tileCenterWorld(nextTileX, nextTileZ);
      if (distanceSqToPlayerWorld(x, z) > cullRadiusWorldSq) continue;
      if (!isTileWalkable(nextTileX, nextTileZ)) continue;

      enemy.fromTileX = enemy.tileX;
      enemy.fromTileZ = enemy.tileZ;
      enemy.toTileX = nextTileX;
      enemy.toTileZ = nextTileZ;
      enemy.hopElapsed = 0;
      enemy.hopDuration = enemy.corrupted
        ? 0.24 + hash2D(nextTileX, nextTileZ, 500) * 0.16
        : 0.52 + hash2D(nextTileX, nextTileZ, 500) * 0.42;
      enemy.idleElapsed = 0;
      enemy.idleDuration = enemy.corrupted
        ? 0.01 + hash2D(nextTileX, nextTileZ, 501) * 0.06
        : 0.04 + hash2D(nextTileX, nextTileZ, 501) * 0.26;
      return;
    }

    enemy.toTileX = enemy.tileX;
    enemy.toTileZ = enemy.tileZ;
    enemy.hopElapsed = enemy.hopDuration;
    enemy.idleElapsed = 0;
    enemy.idleDuration = 0.28;
  }

  function updateEnemy(enemy, deltaSeconds, elapsedSeconds) {
    enemy.launchCooldown = Math.max(0, enemy.launchCooldown - deltaSeconds);
    enemy.brainTimer += deltaSeconds;
    const from = tileCenterWorld(enemy.fromTileX, enemy.fromTileZ);
    const to = tileCenterWorld(enemy.toTileX, enemy.toTileZ);
    const fromY = getSurfaceYAtTile(enemy.fromTileX, enemy.fromTileZ) + 1.45;
    const toY = getSurfaceYAtTile(enemy.toTileX, enemy.toTileZ) + 1.45;

    if (enemy.hopElapsed < enemy.hopDuration) {
      enemy.hopElapsed = Math.min(enemy.hopDuration, enemy.hopElapsed + deltaSeconds);
      const t = enemy.hopElapsed / Math.max(0.001, enemy.hopDuration);
      const eased = t * t * (3 - 2 * t);
      const hopArc = Math.sin(t * Math.PI) * (1.15 + Math.abs(toY - fromY) * 0.08);

      enemy.visual.position.set(
        THREE.MathUtils.lerp(from.x, to.x, eased),
        THREE.MathUtils.lerp(fromY, toY, eased) + hopArc,
        THREE.MathUtils.lerp(from.z, to.z, eased)
      );

      const yaw = Math.atan2(to.x - from.x, to.z - from.z);
      if (Number.isFinite(yaw)) enemy.visual.rotation.y = yaw;
    } else {
      enemy.tileX = enemy.toTileX;
      enemy.tileZ = enemy.toTileZ;
      snapEnemyToTile(enemy, enemy.tileX, enemy.tileZ);
      enemy.idleElapsed += deltaSeconds;
      if (enemy.idleElapsed >= enemy.idleDuration) {
        chooseNextHop(enemy);
      }
    }

    const bob = Math.sin(elapsedSeconds * 8.5 + enemy.cellX * 1.7 + enemy.cellZ * 0.9) * 0.08;
    const hopT = Math.min(1, enemy.hopElapsed / Math.max(0.001, enemy.hopDuration));
    const squash = Math.sin(hopT * Math.PI);
    const visualScale = enemy.visualScale || enemyBaseScale;
    const scaleMultiplier = enemy.scaleMultiplier || 1;
    enemy.visual.scale.set(
      visualScale + squash * 0.3 * scaleMultiplier,
      visualScale - squash * 0.48 * scaleMultiplier + bob * 3 * scaleMultiplier,
      visualScale + squash * 0.3 * scaleMultiplier
    );
    enemy.visual.rotation.x = Math.sin(elapsedSeconds * 4 + enemy.cellX) * 0.04;
    enemy.visual.rotation.z = Math.cos(elapsedSeconds * 3.7 + enemy.cellZ) * 0.04;

    updateEmbeddedSpringStone(enemy, elapsedSeconds);
    updateRareHueSpringVisual(enemy, elapsedSeconds);
    launchPlayerOnContact(enemy);
  }

  function setEnemyCorrupted(enemy, corrupted = true) {
    if (!enemy || enemy.corrupted === corrupted) return;
    enemy.corrupted = corrupted;
    if (enemy.invincible) {
      applyRareSpringDefeatedVisual(enemy);
      return;
    }

    const materials = enemy.visual.userData.springMaterials || {};
    if (corrupted) {
      materials.shell?.color?.setHex?.(0xff1f24);
      materials.shell?.emissive?.setHex?.(0x8f0000);
      materials.shell && (materials.shell.emissiveIntensity = 0.78);
      materials.core?.color?.setHex?.(0x7d0000);
      materials.core?.emissive?.setHex?.(0xff1818);
      materials.core && (materials.core.emissiveIntensity = 0.68);
      materials.eye?.color?.setHex?.(0x2b0000);
      materials.eye?.emissive?.setHex?.(0xfff0f0);
      materials.eye && (materials.eye.emissiveIntensity = 1.2);
    } else {
      materials.shell?.color?.setHex?.(0xff00d6);
      materials.shell?.emissive?.setHex?.(0x7a004f);
      materials.shell && (materials.shell.emissiveIntensity = 0.58);
      materials.core?.color?.setHex?.(0x5a003f);
      materials.core?.emissive?.setHex?.(0xff00bb);
      materials.core && (materials.core.emissiveIntensity = 0.42);
      materials.eye?.color?.setHex?.(0x190017);
      materials.eye?.emissive?.setHex?.(0xff8cf0);
      materials.eye && (materials.eye.emissiveIntensity = 0.9);
    }
  }

  function updateEmbeddedSpringStone(enemy, elapsedSeconds) {
    const stone = enemy.embeddedStone;
    if (!stone) return;

    const pulse = 1 + Math.sin(elapsedSeconds * 5.8 + enemy.cellX) * 0.18;
    stone.position.set(0, Math.sin(elapsedSeconds * 2.6 + enemy.cellZ) * 0.16, 0);
    stone.rotation.x += 0.035;
    stone.rotation.y += 0.052;
    stone.rotation.z += 0.024;
    stone.scale.setScalar((0.75 + (enemy.scaleMultiplier || 1) * 0.18) * pulse);
  }

  function updateRareHueSpringVisual(enemy, elapsedSeconds) {
    if (!enemy?.isRareHueSpring || !enemy.visual) return;
    if (enemy.defeated) {
      applyRareSpringDefeatedVisual(enemy);
      return;
    }

    const hue = (elapsedSeconds * 0.16 + hash2D(enemy.cellX, enemy.cellZ, 778)) % 1;
    const materials = enemy.visual.userData.springMaterials || {};
    materials.shell?.color?.setHSL?.(hue, 1, 0.58);
    materials.shell?.emissive?.setHSL?.((hue + 0.08) % 1, 1, 0.34);
    materials.shell && (materials.shell.emissiveIntensity = 1.18);
    materials.core?.color?.setHSL?.((hue + 0.16) % 1, 1, 0.5);
    materials.core?.emissive?.setHSL?.((hue + 0.28) % 1, 1, 0.42);
    materials.core && (materials.core.emissiveIntensity = 1.05);
    materials.eye?.color?.setHSL?.((hue + 0.5) % 1, 1, 0.18);
    materials.eye?.emissive?.setHSL?.((hue + 0.5) % 1, 1, 0.62);
    materials.eye && (materials.eye.emissiveIntensity = 1.45);

    const auraMaterials = enemy.visual.userData.auraMaterials || [];
    for (const [index, material] of auraMaterials.entries()) {
      material.color?.setHSL?.((hue + index * 0.055) % 1, 1, 0.58);
      material.opacity = 0.42 + Math.sin(elapsedSeconds * 7.2 + index) * 0.12;
    }

    const flames = enemy.visual.userData.auraFlames || [];
    for (const [index, flame] of flames.entries()) {
      const phase = elapsedSeconds * 5.8 + (flame.userData.phase || 0);
      const radius = 0.92 + Math.sin(phase) * 0.12;
      const angle = (flame.userData.baseAngle || 0) + Math.sin(phase * 0.33) * 0.1;
      flame.position.x = Math.cos(angle) * radius;
      flame.position.z = Math.sin(angle) * radius;
      flame.position.y = -0.9 + Math.abs(Math.sin(phase)) * 2.7;
      flame.scale.set(0.8 + Math.sin(phase) * 0.12, 1.1 + Math.abs(Math.sin(phase)) * 0.9, 0.8);
      flame.rotation.y = -angle;
      flame.rotation.z = Math.sin(phase * 0.7 + index) * 0.35;
    }
  }

  function applyRareSpringDefeatedVisual(enemy) {
    if (!enemy?.visual) return;
    enemy.invincible = true;
    enemy.corrupted = false;

    const materials = enemy.visual.userData.springMaterials || {};
    materials.shell?.color?.setHex?.(0x8f8f8f);
    materials.shell?.emissive?.setHex?.(0x222222);
    materials.shell && (materials.shell.emissiveIntensity = 0.12);
    materials.core?.color?.setHex?.(0x6d6d6d);
    materials.core?.emissive?.setHex?.(0x1b1b1b);
    materials.core && (materials.core.emissiveIntensity = 0.08);
    materials.eye?.color?.setHex?.(0x3a3a3a);
    materials.eye?.emissive?.setHex?.(0x111111);
    materials.eye && (materials.eye.emissiveIntensity = 0.05);

    for (const material of enemy.visual.userData.auraMaterials || []) {
      material.color?.setHex?.(0x777777);
      material.opacity = 0;
      material.visible = false;
    }

    for (const flame of enemy.visual.userData.auraFlames || []) {
      flame.visible = false;
    }
  }

  function getSpringEnemyFromEvent(event) {
    if (!event || !renderer || !camera || enemies.size === 0) return null;

    const rect = renderer.domElement.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;

    springClickPointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    springClickPointer.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
    springClickRaycaster.setFromCamera(springClickPointer, camera);

    const targets = [];
    for (const enemy of enemies.values()) {
      if (!enemy.visual?.parent || enemy.pendingDeletion) continue;
      targets.push(...(enemy.visual.userData.springMeshes || []));
    }

    if (!targets.length) return null;
    const hits = springClickRaycaster.intersectObjects(targets, false);
    for (const hit of hits) {
      const enemy = enemies.get(hit.object?.userData?.enemyKey);
      if (enemy) return enemy;
    }

    return null;
  }

  function updateNpcSpringHover(event) {
    return getSpringEnemyFromEvent(event);
  }

  function handleNpcSpringClick(event) {
    if (!event || event.button !== 0) return false;
    const enemy = getSpringEnemyFromEvent(event);
    if (!enemy) return false;
    if (enemy.invincible) return false;
    if (!hasRedSlotRubble?.()) return false;
    if (!consumeRedSlotRubble?.()) return false;

    throwStoneAtSpring(enemy);
    return true;
  }

  function getEnemyCenterWorld(enemy) {
    return enemy.visual.position.clone();
  }

  function throwStoneAtSpring(enemy) {
    if (!enemy?.visual?.parent || !player?.mesh) return;
    if (enemy.invincible) return;

    const stone = new THREE.Mesh(springStoneGeometry, springStoneMaterial.clone());
    stone.name = "npc-spring-thrown-stone";
    stone.position.copy(player.mesh.position);
    stone.scale.setScalar(1.05);
    scene.add(stone);

    springProjectiles.add({
      enemyKey: enemy.key,
      mesh: stone,
      elapsed: 0,
      duration: 0.34,
      start: stone.position.clone(),
      end: getEnemyCenterWorld(enemy),
      deleteOnImpact: Boolean(enemy.corrupted && !enemy.invincible && !enemy.isRareHueSpring)
    });
  }

  function handleRareSpringRockImpact(enemy) {
    if (!enemy?.isRareHueSpring || enemy.invincible || enemy.defeated) return false;
    enemy.rareRockHits = Math.min(rareHueSpringDefeatHits, Math.max(0, Math.round(Number(enemy.rareRockHits) || 0)) + 1);

    if (enemy.rareRockHits >= rareHueSpringDefeatHits) {
      enemy.defeated = true;
      enemy.invincible = true;
      enemy.embeddedStone = null;
      applyRareSpringDefeatedVisual(enemy);
      return true;
    }

    setEnemyCorrupted(enemy, true);
    return true;
  }

  function updateSpringProjectiles(deltaSeconds) {
    for (const projectile of [...springProjectiles]) {
      const enemy = enemies.get(projectile.enemyKey);
      projectile.elapsed += deltaSeconds;

      if (!enemy || !enemy.visual?.parent) {
        removeSpringProjectile(projectile);
        continue;
      }

      projectile.end.copy(getEnemyCenterWorld(enemy));
      const t = Math.min(1, projectile.elapsed / Math.max(0.001, projectile.duration));
      const eased = t * t * (3 - 2 * t);
      projectile.mesh.position.lerpVectors(projectile.start, projectile.end, eased);
      projectile.mesh.position.y += Math.sin(t * Math.PI) * 2.2;
      projectile.mesh.rotation.x += 0.28;
      projectile.mesh.rotation.y += 0.22;

      if (t < 1) continue;

      if (projectile.deleteOnImpact && !enemy.invincible) {
        spawnSpringPickup(enemy);
        removeSpringProjectile(projectile);
        removeEnemy(enemy.key);
      } else {
        if (enemy.isRareHueSpring) {
          handleRareSpringRockImpact(enemy);
          removeSpringProjectile(projectile);
          continue;
        }
        springProjectiles.delete(projectile);
        if (projectile.mesh.parent) projectile.mesh.parent.remove(projectile.mesh);
        projectile.mesh.material = projectile.mesh.material || springStoneMaterial.clone();
        enemy.visual.add(projectile.mesh);
        enemy.embeddedStone = projectile.mesh;
        setEnemyCorrupted(enemy, true);
      }
    }
  }

  function removeSpringProjectile(projectile) {
    springProjectiles.delete(projectile);
    if (projectile.mesh?.parent) projectile.mesh.parent.remove(projectile.mesh);
    if (projectile.mesh?.material) projectile.mesh.material.dispose();
    if (projectile.mesh?.geometry && projectile.mesh.geometry !== springStoneGeometry) {
      projectile.mesh.geometry.dispose();
    }
  }

  function spawnSpringPickup(enemy) {
    if (!enemy?.visual) return null;

    const material = new THREE.MeshBasicMaterial({
      map: springPickupTexture,
      transparent: true,
      alphaTest: 0.08,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    const mesh = new THREE.Mesh(springPickupGeometry, material);
    mesh.name = "npc-magenta-spring-pickup";
    mesh.position.copy(enemy.visual.position);
    mesh.position.y += 2.4 * (enemy.scaleMultiplier || 1);
    mesh.renderOrder = 8;
    mesh.userData.isSpringPickup = true;
    scene.add(mesh);

    const pickup = {
      mesh,
      bornAt: null,
      baseY: mesh.position.y,
      collected: false,
      isHovered: false,
      visualScale: 1,
      targetScale: 1
    };
    mesh.userData.springPickup = pickup;
    springPickups.add(pickup);
    return pickup;
  }

  function updateSpringPickups(deltaSeconds, elapsedSeconds) {
    if (!player?.mesh) return;

    function isSpringPickupTouchingPlayer(mesh) {
      const playerRadius = Number(player.radius) || 1.9;
      const dx = mesh.position.x - player.mesh.position.x;
      const dz = mesh.position.z - player.mesh.position.z;
      const horizontalPickupRadius = playerRadius + 4.6;
      const verticalPickupRange = playerRadius + 7.5;
      return dx * dx + dz * dz <= horizontalPickupRadius * horizontalPickupRadius &&
        Math.abs(mesh.position.y - player.mesh.position.y) <= verticalPickupRange;
    }

    for (const pickup of [...springPickups]) {
      const mesh = pickup.mesh;
      if (!mesh?.parent) {
        springPickups.delete(pickup);
        continue;
      }

      if (pickup.bornAt === null) pickup.bornAt = elapsedSeconds;
      const age = elapsedSeconds - pickup.bornAt;
      const playerPosition = player.mesh.position;
      const vacuumDx = playerPosition.x - mesh.position.x;
      const vacuumDy = playerPosition.y - mesh.position.y;
      const vacuumDz = playerPosition.z - mesh.position.z;
      const distanceToPlayerSq = vacuumDx * vacuumDx + vacuumDy * vacuumDy + vacuumDz * vacuumDz;

      if (isSpringPickupTouchingPlayer(mesh)) {
        collectSpringPickup(pickup);
        continue;
      }

      if (springPickupVacuumActive) {
        const distanceToPlayer = Math.max(0.001, Math.sqrt(distanceToPlayerSq));
        const pullStep = Math.min(distanceToPlayer, 54 * deltaSeconds + distanceToPlayer * 0.16);
        mesh.position.x += (vacuumDx / distanceToPlayer) * pullStep;
        mesh.position.y += (vacuumDy / distanceToPlayer) * pullStep;
        mesh.position.z += (vacuumDz / distanceToPlayer) * pullStep;
        pickup.baseY = mesh.position.y;
        if (isSpringPickupTouchingPlayer(mesh)) {
          collectSpringPickup(pickup);
          continue;
        }
      } else {
        mesh.position.y = pickup.baseY + Math.sin(elapsedSeconds * 4.2 + pickup.baseY) * 0.34 + Math.min(1, age * 2.8) * 1.2;
      }
      mesh.rotation.z += 0.025;
      pickup.targetScale = springPickupVacuumActive ? 1.28 : 1;

      const pulse = 1 + Math.sin(elapsedSeconds * 5.4 + pickup.baseY) * 0.08;
      pickup.visualScale = THREE.MathUtils.lerp(pickup.visualScale || 1, pickup.targetScale || 1, 0.18);
      mesh.scale.setScalar(pickup.visualScale * pulse);
      if (camera?.quaternion) {
        mesh.quaternion.copy(camera.quaternion);
        mesh.rotateZ(Math.sin(elapsedSeconds * 2.8 + pickup.baseY) * 0.12);
      }
    }
  }

  function setSpringPickupVacuumActive(active) {
    springPickupVacuumActive = Boolean(active);
  }

  function collectSpringPickup(pickup) {
    if (!pickup || pickup.collected) return false;
    pickup.collected = true;
    onSpringCollected();
    removeSpringPickup(pickup);
    return true;
  }

  function removeSpringPickup(pickup) {
    springPickups.delete(pickup);
    if (pickup.mesh?.userData) {
      pickup.mesh.userData.springPickup = null;
      pickup.mesh.userData.isSpringPickup = false;
    }
    if (pickup.mesh?.parent) pickup.mesh.parent.remove(pickup.mesh);
    if (pickup.mesh?.material) pickup.mesh.material.dispose();
  }

  function launchPlayerOnContact(enemy) {
    if (!player?.mesh || enemy.launchCooldown > 0) return;

    const dx = player.mesh.position.x - enemy.visual.position.x;
    const dz = player.mesh.position.z - enemy.visual.position.z;
    const scaleMultiplier = enemy.scaleMultiplier || 1;
    const contactRadius = Math.max(0.1, (Number(player.radius) || 1.9) + enemyContactRadius * scaleMultiplier);
    if (dx * dx + dz * dz > contactRadius * contactRadius) return;

    const playerBottomY = player.mesh.position.y - (Number(player.radius) || 1.9);
    const enemyTopY = enemy.visual.position.y + 4.35 * scaleMultiplier;
    const enemyBottomY = enemy.visual.position.y - 4.35 * scaleMultiplier;
    if (playerBottomY > enemyTopY || player.mesh.position.y < enemyBottomY) return;

    enemy.launchCooldown = enemyLaunchCooldownSeconds;
    const launchMultiplier = enemy.isMegaSpring ? megaSpringLaunchMultiplier : 1;
    player.verticalVelocity = Math.max(Number(player.verticalVelocity) || 0, enemyLaunchVelocity * launchMultiplier);
    player.grounded = false;
    player.jumpLandingArmed = true;
    player.bounceTimer = 0;
    player.launchStretchTimer = player.launchStretchDuration || 0.34;

    const horizontalDistance = Math.max(0.001, Math.hypot(dx, dz));
    const pushStrength = 22;
    if (player.velocity && typeof player.velocity.x === "number") {
      player.velocity.x += (dx / horizontalDistance) * pushStrength;
      player.velocity.z += (dz / horizontalDistance) * pushStrength;
    }
  }

  function updateCloudPlatform(cloud, elapsedSeconds) {
    const breath = (Math.sin(elapsedSeconds * cloud.breathSpeed + cloud.bobPhase) + 1) * 0.5;
    const breathScale = 1 - cloud.breathDepth * 0.5 + breath * cloud.breathDepth;
    const fadeWave = (Math.sin(elapsedSeconds * cloud.fadeSpeed + cloud.fadeOffset) + 1) * 0.5;
    const fadeFloor = 0.24;
    const opacity = fadeFloor + Math.pow(fadeWave, 0.72) * (0.94 - fadeFloor);
    const bob = Math.sin(elapsedSeconds * 0.85 + cloud.bobPhase) * (1.75 + cloud.breathDepth * 3.5);
    const driftX = Math.cos(elapsedSeconds * 0.24 + cloud.driftPhase) * (2.6 + cloud.breathDepth * 4.2);
    const driftZ = Math.sin(elapsedSeconds * 0.21 + cloud.driftPhase) * (2.2 + cloud.breathDepth * 3.8);

    cloud.opacity = opacity;
    cloud.currentRadiusX = cloud.radiusX * breathScale;
    cloud.currentRadiusZ = cloud.radiusZ * (1.06 - (breathScale - 1) * 0.45);
    cloud.topY = cloud.baseY + bob;
    cloud.visual.position.set(cloud.x + driftX, cloud.topY - 1.2, cloud.z + driftZ);
    cloud.visual.rotation.y = Math.sin(elapsedSeconds * 0.12 + cloud.bobPhase) * 0.08;
    cloud.visual.scale.set(cloud.currentRadiusX / cloud.radiusX, 0.92 + breath * 0.18, cloud.currentRadiusZ / cloud.radiusZ);

    const materials = cloud.visual.userData.opacityMaterials || [];
    for (const material of materials) {
      material.opacity = material === materials[1] ? opacity * 0.32 : opacity;
    }
  }

  function removeCloudPlatform(key) {
    const cloud = cloudPlatforms.get(key);
    if (!cloud) return;

    if (cloud.visual.parent) {
      cloud.visual.parent.remove(cloud.visual);
    }
    cloud.visual.traverse((child) => {
      if (child.geometry && child.geometry !== cloudPuffGeometry) {
        child.geometry.dispose();
      }
    });
    for (const material of cloud.visual.userData.opacityMaterials || []) {
      material.dispose();
    }
    cloudPlatforms.delete(key);
  }

  function removeEnemy(key) {
    const enemy = enemies.get(key);
    if (!enemy) return;

    if (enemy.visual.parent) {
      enemy.visual.parent.remove(enemy.visual);
    }
    for (const material of Object.values(enemy.visual.userData.springMaterials || {})) {
      material.dispose?.();
    }
    for (const material of enemy.visual.userData.auraMaterials || []) {
      material.dispose?.();
    }
    if (enemy.embeddedStone?.material) enemy.embeddedStone.material.dispose();
    enemies.delete(key);
  }

  function updateSpawnSet() {
    if (!player?.mesh) return;

    const playerTileX = Math.floor(player.mesh.position.x / tileSize);
    const playerTileZ = Math.floor(player.mesh.position.z / tileSize);
    const centerCellX = Math.floor(playerTileX / cellTiles);
    const centerCellZ = Math.floor(playerTileZ / cellTiles);
    const cellRadius = Math.ceil(safeRenderRadiusTiles / cellTiles);
    nearbyCellKeys.clear();

    for (let cellZ = centerCellZ - cellRadius; cellZ <= centerCellZ + cellRadius; cellZ += 1) {
      for (let cellX = centerCellX - cellRadius; cellX <= centerCellX + cellRadius; cellX += 1) {
        const key = cellKey(cellX, cellZ);
        if (!shouldCellHaveEnemy(cellX, cellZ)) continue;
        nearbyCellKeys.add(key);
        if (!enemies.has(key) && enemies.size < maxActiveEnemies) {
          createEnemy(cellX, cellZ);
        }
      }
    }

    for (const [key, enemy] of enemies.entries()) {
      reusableVector.copy(enemy.visual.position);
      const tooFar = distanceSqToPlayerWorld(reusableVector.x, reusableVector.z) > cullRadiusWorldSq;
      if (tooFar || (!enemy.isPlaced && !nearbyCellKeys.has(key))) {
        removeEnemy(key);
      }
    }
  }

  function updateCloudSpawnSet() {
    if (!player?.mesh) return;

    const playerTileX = Math.floor(player.mesh.position.x / tileSize);
    const playerTileZ = Math.floor(player.mesh.position.z / tileSize);
    const centerCellX = Math.floor(playerTileX / cloudCellTiles);
    const centerCellZ = Math.floor(playerTileZ / cloudCellTiles);
    const cellRadius = Math.ceil(safeRenderRadiusTiles / cloudCellTiles);
    nearbyCloudCellKeys.clear();

    for (let cellZ = centerCellZ - cellRadius; cellZ <= centerCellZ + cellRadius; cellZ += 1) {
      for (let cellX = centerCellX - cellRadius; cellX <= centerCellX + cellRadius; cellX += 1) {
        const key = cellKey(cellX, cellZ);
        if (!shouldCellHaveCloud(cellX, cellZ)) continue;
        nearbyCloudCellKeys.add(key);
        if (!cloudPlatforms.has(key) && cloudPlatforms.size < maxActiveClouds) {
          createCloudPlatform(cellX, cellZ);
        }
      }
    }

    for (const [key, cloud] of cloudPlatforms.entries()) {
      const tooFar = distanceSqToPlayerWorld(cloud.visual.position.x, cloud.visual.position.z) > cullRadiusWorldSq;
      if (tooFar || !nearbyCloudCellKeys.has(key)) {
        removeCloudPlatform(key);
      }
    }
  }

  function getCloudSurfaceHeightAtWorld(x, z) {
    if (!player?.mesh) return -Infinity;

    const playerRadius = Number(player.radius) || 1.9;
    const playerBottomY = player.mesh.position.y - playerRadius;
    const playerVerticalVelocity = Number(player.verticalVelocity) || 0;
    const fallingOrSettled = playerVerticalVelocity <= 4;
    if (!fallingOrSettled) return -Infinity;

    let topY = -Infinity;
    for (const cloud of cloudPlatforms.values()) {
      if (cloud.opacity < 0.42) continue;

      const dx = x - cloud.visual.position.x;
      const dz = z - cloud.visual.position.z;
      const radiusX = Math.max(1, cloud.currentRadiusX || cloud.radiusX);
      const radiusZ = Math.max(1, cloud.currentRadiusZ || cloud.radiusZ);
      const normalizedDistance = (dx * dx) / (radiusX * radiusX) + (dz * dz) / (radiusZ * radiusZ);
      if (normalizedDistance > 1) continue;

      const wasAboveCloudTop = previousPlayerBottomY >= cloud.topY - 0.35;
      if (!wasAboveCloudTop) continue;

      const crossingAllowance = Math.max(1.25, Math.min(8, Math.abs(playerVerticalVelocity) * 0.06 + playerRadius));
      if (playerBottomY < cloud.topY - crossingAllowance) continue;

      topY = Math.max(topY, cloud.topY);
    }

    return topY;
  }

  function update(deltaSeconds = 0, elapsedSeconds = 0) {
    if (!scene || !THREE || !player?.mesh) return;

    spawnScanTimer -= deltaSeconds;
    if (spawnScanTimer <= 0) {
      spawnScanTimer = spawnScanInterval;
      updateSpawnSet();
    }

    cloudScanTimer -= deltaSeconds;
    if (cloudScanTimer <= 0) {
      cloudScanTimer = cloudScanInterval;
      updateCloudSpawnSet();
    }

    for (const enemy of enemies.values()) {
      updateEnemy(enemy, deltaSeconds, elapsedSeconds);
    }
    updateSpringProjectiles(deltaSeconds);
    updateSpringPickups(deltaSeconds, elapsedSeconds);

    for (const cloud of cloudPlatforms.values()) {
      updateCloudPlatform(cloud, elapsedSeconds);
    }

    previousPlayerBottomY = player.mesh.position.y - (Number(player.radius) || 1.9);
  }

  function dispose() {
    for (const key of [...enemies.keys()]) {
      removeEnemy(key);
    }
    for (const key of [...cloudPlatforms.keys()]) {
      removeCloudPlatform(key);
    }
    for (const projectile of [...springProjectiles]) {
      removeSpringProjectile(projectile);
    }
    for (const pickup of [...springPickups]) {
      removeSpringPickup(pickup);
    }

    springGeometry.dispose();
    waistGeometry.dispose();
    ringGeometry.dispose();
    eyeGeometry.dispose();
    auraRingGeometry.dispose();
    auraFlameGeometry.dispose();
    cloudPuffGeometry.dispose();
    springStoneGeometry.dispose();
    springPickupGeometry.dispose();
    springPickupTexture.dispose();
    enemyMaterial.dispose();
    coreMaterial.dispose();
    eyeMaterial.dispose();
    cloudMaterial.dispose();
    cloudShadowMaterial.dispose();
    springStoneMaterial.dispose();
  }

  return {
    update,
    dispose,
    getActiveEnemyCount: () => enemies.size,
    getActiveCloudCount: () => cloudPlatforms.size,
    getCloudSurfaceHeightAtWorld,
    handleNpcSpringClick,
    updateNpcSpringHover,
    setSpringPickupVacuumActive,
    createPlacedEnemyAtTile,
    cloudPlatforms,
    enemies
  };
}
