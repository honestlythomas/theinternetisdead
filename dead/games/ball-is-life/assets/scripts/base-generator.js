export function createBaseGenerator({
  THREE = null,
  scene = null,
  camera = null,
  state = null,
  seedNumber,
  seaLevel,
  maxHeightLevels,
  tileSize,
  heightStep,
  chunkTiles = 40,
  chunkRadius = 2,
  keepDetailedRadius = 3,
  distantLodRadius = 5,
  lodStep = 8,
  maxDistantLodChunks = 48,
  maxLodBuildsPerFrame = 1,
  lodBuildQueue = [],
  queuedLodChunkKeys = new Set(),
  loadedChunks = new Map(),
  distantLodChunks = new Map(),
  gridLineObjects = new Set(),
  treeSprites = new Set(),
  treeColliders = new Map(),
  treeHitboxGridObjects = new Set(),
  rubbleHitboxGridObjects = new Set(),
  rubbleObjects = new Map(),
  rubbleCrackStates = new Map(),
  rubbleCrackLandingCounts = new Map(),
  flattenedTreeClickTargets = new Set(),
  deletedTreeKeys = new Set(),
  deletedRubbleKeys = new Set(),
  saveDeletedRubbleKeys = () => {},
  grassMaterial = null,
  sandMaterial = null,
  dirtMaterial = null,
  waterMaterial = null,
  waterSurfaceMaterial = null,
  rubbleMaterial = null,
  rubbleCrackOverlay01Material = null,
  rubbleCrackOverlay02Material = null,
  gridMaterial = null,
  pineTreePlaneGeometry = null,
  flatPineTreePlaneGeometry = null,
  pineTreeMaterial = null,
  flatPineTreeMaterial = null,
  treeVisibleBottomTrimRatio = 0.065,
  getTreeColliderKey = (globalX, globalZ) => `${globalX},${globalZ}`,
  buildTreeHitboxGrid = () => null,
  getHideTrees = () => false,
  getShowGridLines = () => false,
  markWorldCacheDirty = () => {},
  chunkReadout = null,
  distantChunkReadout = null
}) {
  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function smoothstep(edge0, edge1, x) {
    const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
  }

  function hash2D(x, z) {
    let h = seedNumber ^ Math.imul(x, 374761393) ^ Math.imul(z, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967295;
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function smoothNoise(x, z, frequency) {
    const fx = x * frequency;
    const fz = z * frequency;

    const x0 = Math.floor(fx);
    const z0 = Math.floor(fz);
    const x1 = x0 + 1;
    const z1 = z0 + 1;

    const tx = fx - x0;
    const tz = fz - z0;
    const sx = tx * tx * (3 - 2 * tx);
    const sz = tz * tz * (3 - 2 * tz);

    const a = hash2D(x0, z0);
    const b = hash2D(x1, z0);
    const c = hash2D(x0, z1);
    const d = hash2D(x1, z1);

    const top = lerp(a, b, sx);
    const bottom = lerp(c, d, sx);

    return lerp(top, bottom, sz) * 2 - 1;
  }

  function fbm(x, z) {
    let value = 0;
    let amplitude = 1;
    let frequency = 0.0068;
    let totalAmplitude = 0;

    for (let octave = 0; octave < 7; octave += 1) {
      value += smoothNoise(x, z, frequency) * amplitude;
      totalAmplitude += amplitude;
      amplitude *= 0.58;
      frequency *= 2.04;
    }

    return value / totalAmplitude;
  }

  function ridgedNoise(x, z) {
    const n = fbm(x * 0.78 + 1400.5, z * 0.78 - 982.25);
    return 1 - Math.abs(n);
  }

  function plateauNoise(x, z) {
    const n = smoothNoise(x + 991.2, z - 307.4, 0.0065);
    return smoothstep(0.16, 0.62, n);
  }

  const terrainSampleCache = new Map();

  function getTerrainSampleAtTile(globalX, globalZ) {
    const key = `${globalX},${globalZ}`;
    if (terrainSampleCache.has(key)) {
      return terrainSampleCache.get(key);
    }

    /*
      More natural regional shaping:
      - continent/base relief
      - mountain region masks with random stronger peak chains
      - valley/basin masks with random broader sink areas
      - terraces still quantized so the game keeps its chunky buildable read
    */
    const broad = fbm(globalX * 0.42, globalZ * 0.42);
    const medium = fbm(globalX * 0.95 + 550, globalZ * 0.95 - 240);
    const detail = fbm(globalX * 1.9 - 1200, globalZ * 1.9 + 700);
    const ridge = ridgedNoise(globalX, globalZ);
    const plateau = plateauNoise(globalX, globalZ);

    const continent = smoothNoise(globalX + 10000, globalZ - 4000, 0.00135);
    const mountainRegionNoise = smoothNoise(globalX - 7800, globalZ + 5300, 0.0019);
    const valleyRegionNoise = smoothNoise(globalX + 6200, globalZ - 3600, 0.0018);
    const mountainChance = smoothstep(0.08, 0.78, mountainRegionNoise);
    const valleyChance = smoothstep(0.14, 0.88, valleyRegionNoise);
    const megaRidge = 1 - Math.abs(smoothNoise(globalX - 6400, globalZ + 8700, 0.0034));
    const basinNoise = 1 - Math.abs(smoothNoise(globalX * 0.9 + 1800, globalZ * 0.9 - 2400, 0.0048));

    let height = 10.0;
    height += broad * 14.5;
    height += medium * 8.0;
    height += detail * 2.9;
    height += smoothstep(-0.52, 0.78, continent) * 7.0;

    // Mountains happen regionally, not everywhere all at once.
    height += ridge * (7.5 + mountainChance * 20.0);
    height += megaRidge * (3.5 + mountainChance * 17.0);

    // Valleys carve into the landscape and sometimes widen into basins.
    height -= valleyChance * (6.5 + basinNoise * 12.5);
    height -= smoothstep(0.08, 0.78, smoothNoise(globalX - 2200, globalZ + 940, 0.0031)) * 7.5;

    // Keep some broad flatter shelves for buildable-feeling land.
    height += plateau * 2.25;

    let level = Math.round(height);

    if (level >= 12 && plateau > 0.6) {
      level = Math.round(level / 2) * 2;
    }

    level = clamp(level, 0, maxHeightLevels);

    // Sea-level water appears in oceans, inland lakes, and occasional river corridors.
    // All water still renders at one fixed elevation: seaLevel.
    let waterLevel = -1;

    const lakeChance = basinNoise * valleyChance;
    const lowlandMask = smoothstep(0.02, 0.72, 1 - Math.max(0, continent));
    const enclosedBasinChance = lakeChance * lowlandMask;

    /*
      Inland lakes:
      Use multiple regional noise layers so water can appear in scattered pockets
      throughout the world instead of only behaving like one huge coastline.
    */
    const lakeRegionA = smoothNoise(globalX + 4200, globalZ - 8800, 0.0022);
    const lakeRegionB = smoothNoise(globalX - 7300, globalZ + 1900, 0.0046);
    const lakeRegionC = fbm(globalX * 0.72 + 1600, globalZ * 0.72 - 5100);

    const inlandLakeMask =
      smoothstep(0.16, 0.78, lakeRegionA) *
      smoothstep(-0.28, 0.54, lakeRegionB) *
      smoothstep(-0.44, 0.58, lakeRegionC);

    /*
      River corridors:
      A river is the thin band around a zero-crossing of a noisy line field.
      The extra masks keep them occasional instead of turning the entire planet into blue spaghetti.
    */
    const riverFieldA = smoothNoise(globalX + 9100, globalZ - 3500, 0.0032);
    const riverFieldB = smoothNoise(globalX * 0.7 - 2500, globalZ * 0.7 + 7400, 0.0054);
    const riverLine = 1 - smoothstep(0.028, 0.155, Math.abs(riverFieldA + riverFieldB * 0.42));
    const riverRegion = smoothstep(0.02, 0.68, smoothNoise(globalX - 13000, globalZ + 2900, 0.0017));
    const riverCarve = riverLine * riverRegion * smoothstep(-0.4, 0.58, valleyRegionNoise);

    const oceanOrOldBasin = enclosedBasinChance > 0.46;
    const inlandLake = inlandLakeMask > 0.38 && level <= seaLevel + 2;
    const river = riverCarve > 0.43 && level <= seaLevel + 2;

    if ((oceanOrOldBasin || inlandLake || river) && level < seaLevel) {
      waterLevel = seaLevel;
    }

    /*
      Encourage rivers/lakes to cut through just-above-sea-level land by nudging the
      rendered land height down where the water mask is strong. This keeps rivers from
      becoming broken blue Morse code. Yes, the terrain is negotiating with itself now.
    */
    if ((inlandLake || river) && level >= seaLevel && level <= seaLevel + 2) {
      level = seaLevel - 1;
      waterLevel = seaLevel;
    }

    const sample = {
      landLevel: level,
      waterLevel,
      mountainChance,
      valleyChance
    };

    terrainSampleCache.set(key, sample);
    return sample;
  }

  function getHeightLevelAtTile(globalX, globalZ) {
    return getTerrainSampleAtTile(globalX, globalZ).landLevel;
  }

  function getWaterLevelAtTile(globalX, globalZ) {
    return getTerrainSampleAtTile(globalX, globalZ).waterLevel;
  }


  function getTerrainHeightAtWorld(x, z) {
    const tileX = Math.floor(x / tileSize);
    const tileZ = Math.floor(z / tileSize);
    return getHeightLevelAtTile(tileX, tileZ) * heightStep;
  }

  function getVisibleSurfaceHeightAtWorld(x, z) {
    const tileX = Math.floor(x / tileSize);
    const tileZ = Math.floor(z / tileSize);
    const sample = getTerrainSampleAtTile(tileX, tileZ);
    const landY = sample.landLevel * heightStep;
    const waterY = sample.waterLevel === seaLevel && sample.landLevel < seaLevel
      ? seaLevel * heightStep + 0.18
      : -Infinity;

    return Math.max(landY, waterY);
  }

  function getRubbleSurfaceHeightAtWorld(x, z) {
    const rubbleGroup = findRubblePileAtWorld(x, z);
    if (!rubbleGroup || !rubbleGroup.userData) return -Infinity;

    const topY = Number(rubbleGroup.userData.rubbleTopY);
    return Number.isFinite(topY) ? topY : -Infinity;
  }

  function getSolidSurfaceHeightAtWorld(x, z) {
    return Math.max(getTerrainHeightAtWorld(x, z), getRubbleSurfaceHeightAtWorld(x, z));
  }

  function getWaterSurfaceHeightAtWorld(x, z) {
    const tileX = Math.floor(x / tileSize);
    const tileZ = Math.floor(z / tileSize);
    const sample = getTerrainSampleAtTile(tileX, tileZ);

    return sample.waterLevel === seaLevel && sample.landLevel < seaLevel
      ? seaLevel * heightStep + 0.18
      : -Infinity;
  }

  function isWaterAtWorld(x, z) {
    return Number.isFinite(getWaterSurfaceHeightAtWorld(x, z));
  }


  function tileToWorldX(globalX) {
    return globalX * tileSize;
  }

  function tileToWorldZ(globalZ) {
    return globalZ * tileSize;
  }

  function addQuad(positions, uvs, indices, normalUp, corners) {
    const start = positions.length / 3;

    for (const corner of corners) {
      positions.push(corner.x, corner.y, corner.z);
      uvs.push(corner.u, corner.v);
    }

    if (normalUp) {
      indices.push(start, start + 2, start + 1, start, start + 3, start + 2);
    } else {
      indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
    }
  }

  function getChunkKey(chunkX, chunkZ) {
    return `${chunkX},${chunkZ}`;
  }

  function getChunkDistance(chunkX, chunkZ, centerChunkX, centerChunkZ) {
    return Math.max(Math.abs(chunkX - centerChunkX), Math.abs(chunkZ - centerChunkZ));
  }

  function buildDistantLodChunk(chunkX, chunkZ) {
    const chunkKey = getChunkKey(chunkX, chunkZ);
    queuedLodChunkKeys.delete(chunkKey);
    if (distantLodChunks.has(chunkKey) || loadedChunks.has(chunkKey)) return;

    /*
      Distant LOD chunks are compressed terrain memories:
      one coarse tile represents lodStep x lodStep real tiles. This keeps explored
      land visible without asking the GPU to render every tiny tile forever like a lunatic.
    */
    const group = new THREE.Group();
    group.name = `terrain-lod-chunk-${chunkKey}`;
    group.userData.chunkX = chunkX;
    group.userData.chunkZ = chunkZ;
    group.userData.isDistantLod = true;

    const grassPositions = [];
    const grassUvs = [];
    const grassIndices = [];

    const sandPositions = [];
    const sandUvs = [];
    const sandIndices = [];

    const waterPositions = [];
    const waterUvs = [];
    const waterIndices = [];

    const startTileX = chunkX * chunkTiles;
    const startTileZ = chunkZ * chunkTiles;
    const seaSurfaceY = seaLevel * heightStep + 0.12;

    function isWaterSample(candidate) {
      return candidate.waterLevel === seaLevel && candidate.landLevel < seaLevel;
    }

    function pushTop(targetPositions, targetUvs, targetIndices, x0, x1, z0, z1, y, uvScale = 1) {
      addQuad(targetPositions, targetUvs, targetIndices, true, [
        { x: x0, y, z: z0, u: 0, v: 0 },
        { x: x1, y, z: z0, u: uvScale, v: 0 },
        { x: x1, y, z: z1, u: uvScale, v: uvScale },
        { x: x0, y, z: z1, u: 0, v: uvScale }
      ]);
    }

    for (let localZ = 0; localZ < chunkTiles; localZ += lodStep) {
      for (let localX = 0; localX < chunkTiles; localX += lodStep) {
        const gx = startTileX + localX;
        const gz = startTileZ + localZ;

        let heightSum = 0;
        let heightCount = 0;
        let waterCount = 0;
        let beachCount = 0;

        for (let dz = 0; dz < lodStep; dz += 1) {
          for (let dx = 0; dx < lodStep; dx += 1) {
            const sample = getTerrainSampleAtTile(gx + dx, gz + dz);
            const north = getTerrainSampleAtTile(gx + dx, gz + dz - 1);
            const south = getTerrainSampleAtTile(gx + dx, gz + dz + 1);
            const west = getTerrainSampleAtTile(gx + dx - 1, gz + dz);
            const east = getTerrainSampleAtTile(gx + dx + 1, gz + dz);

            const water = isWaterSample(sample);
            const adjacentWater = isWaterSample(north) || isWaterSample(south) || isWaterSample(west) || isWaterSample(east);
            const nearSea =
              sample.landLevel <= seaLevel + 2 ||
              north.landLevel <= seaLevel + 1 ||
              south.landLevel <= seaLevel + 1 ||
              west.landLevel <= seaLevel + 1 ||
              east.landLevel <= seaLevel + 1;

            heightSum += sample.landLevel;
            heightCount += 1;
            if (water) waterCount += 1;
            if (!water && adjacentWater && nearSea) beachCount += 1;
          }
        }

        const avgLevel = Math.round(heightSum / Math.max(1, heightCount));
        const y = avgLevel * heightStep;
        const x0 = tileToWorldX(gx);
        const x1 = tileToWorldX(gx + lodStep);
        const z0 = tileToWorldZ(gz);
        const z1 = tileToWorldZ(gz + lodStep);

        if (waterCount >= heightCount * 0.34) {
          pushTop(waterPositions, waterUvs, waterIndices, x0, x1, z0, z1, seaSurfaceY, lodStep);
        } else if (beachCount >= heightCount * 0.18 || avgLevel <= seaLevel + 1) {
          pushTop(sandPositions, sandUvs, sandIndices, x0, x1, z0, z1, y, lodStep);
        } else {
          pushTop(grassPositions, grassUvs, grassIndices, x0, x1, z0, z1, y, lodStep);
        }
      }
    }

    function addMeshIfNeeded(positions, uvs, indices, material) {
      if (positions.length === 0) return;

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
      geometry.setIndex(indices);
      geometry.computeVertexNormals();

      const mesh = new THREE.Mesh(geometry, material);
      mesh.userData.isDistantLodMesh = true;
      group.add(mesh);
    }

    addMeshIfNeeded(grassPositions, grassUvs, grassIndices, grassMaterial);
    addMeshIfNeeded(sandPositions, sandUvs, sandIndices, sandMaterial);
    addMeshIfNeeded(waterPositions, waterUvs, waterIndices, waterMaterial);

    scene.add(group);
    distantLodChunks.set(chunkKey, group);
    markWorldCacheDirty();
  }

  function disposeDistantLodChunk(chunkKey) {
    const group = distantLodChunks.get(chunkKey);
    if (!group) return;

    group.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
    });

    scene.remove(group);
    distantLodChunks.delete(chunkKey);
    markWorldCacheDirty();
  }

  function promoteDistantLodToDetailed(chunkKey) {
    if (!distantLodChunks.has(chunkKey)) return;
    disposeDistantLodChunk(chunkKey);
  }

  function demoteDetailedChunkToLod(chunkKey, group) {
    if (!group) return;

    const chunkX = group.userData.chunkX;
    const chunkZ = group.userData.chunkZ;

    disposeChunk(group);
    loadedChunks.delete(chunkKey);
    queueDistantLodChunk(chunkX, chunkZ);
  }

  function enforceDistantLodBudget(centerChunkX, centerChunkZ) {
    if (distantLodChunks.size <= maxDistantLodChunks) return;

    const entries = [...distantLodChunks.entries()]
      .map(([key, group]) => ({
        key,
        distance: getChunkDistance(group.userData.chunkX, group.userData.chunkZ, centerChunkX, centerChunkZ)
      }))
      .sort((a, b) => b.distance - a.distance);

    while (distantLodChunks.size > maxDistantLodChunks && entries.length > 0) {
      const entry = entries.shift();
      disposeDistantLodChunk(entry.key);
    }
  }

  function isTreeBaseTileEligible(globalX, globalZ, sample = getTerrainSampleAtTile(globalX, globalZ)) {
    if (!sample || sample.waterLevel === seaLevel || sample.landLevel <= seaLevel + 1) {
      return false;
    }

    const north = getTerrainSampleAtTile(globalX, globalZ - 1);
    const south = getTerrainSampleAtTile(globalX, globalZ + 1);
    const west = getTerrainSampleAtTile(globalX - 1, globalZ);
    const east = getTerrainSampleAtTile(globalX + 1, globalZ);

    const nearWater =
      (north.waterLevel === seaLevel && north.landLevel < seaLevel) ||
      (south.waterLevel === seaLevel && south.landLevel < seaLevel) ||
      (west.waterLevel === seaLevel && west.landLevel < seaLevel) ||
      (east.waterLevel === seaLevel && east.landLevel < seaLevel);

    if (nearWater) return false;

    const heightSlope = Math.max(
      Math.abs(sample.landLevel - north.landLevel),
      Math.abs(sample.landLevel - south.landLevel),
      Math.abs(sample.landLevel - west.landLevel),
      Math.abs(sample.landLevel - east.landLevel)
    );

    // Trees are billboards/flat crossed cards, not real geometry. If they spawn on the edge
    // of a height change, their straight bottom edge can hang over a lower neighbor and look
    // like it is floating. Only allow tree anchors on fully level grass patches.
    return heightSlope === 0;
  }

  function isTreeClearanceTileEligible(globalX, globalZ, anchorLandLevel) {
    const sample = getTerrainSampleAtTile(globalX, globalZ);
    if (!sample || sample.waterLevel === seaLevel || sample.landLevel <= seaLevel + 1) {
      return false;
    }

    return sample.landLevel === anchorLandLevel;
  }

  function hasTreeVisualClearance(globalX, globalZ, footprintSize, visualWidth, anchorLandLevel) {
    const centerTileX = globalX + footprintSize * 0.5;
    const centerTileZ = globalZ + footprintSize * 0.5;
    const halfVisualWidthTiles = (visualWidth * 0.54 * 0.5) / tileSize;

    const minTileX = Math.floor(centerTileX - halfVisualWidthTiles + 0.0001);
    const maxTileX = Math.ceil(centerTileX + halfVisualWidthTiles - 0.0001) - 1;
    const minTileZ = Math.floor(centerTileZ - halfVisualWidthTiles + 0.0001);
    const maxTileZ = Math.ceil(centerTileZ + halfVisualWidthTiles - 0.0001) - 1;

    for (let tileZ = minTileZ; tileZ <= maxTileZ; tileZ += 1) {
      for (let tileX = minTileX; tileX <= maxTileX; tileX += 1) {
        if (!isTreeClearanceTileEligible(tileX, tileZ, anchorLandLevel)) {
          return false;
        }
      }
    }

    return true;
  }

  function getTreeNeighborhoodSupport(globalX, globalZ, anchorLandLevel, radius = 2) {
    let total = 0;
    let eligible = 0;

    for (let dz = -radius; dz <= radius; dz += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        total += 1;
        if (isTreeClearanceTileEligible(globalX + dx, globalZ + dz, anchorLandLevel)) {
          eligible += 1;
        }
      }
    }

    return total > 0 ? eligible / total : 0;
  }

  function getTreeDensityAtTile(globalX, globalZ, sample = getTerrainSampleAtTile(globalX, globalZ)) {
    /*
      Natural tree placement wants to feel like patches, groves, and occasional openings,
      not a uniform sprinkle of identical cardboard crimes.
    */
    if (!sample) return 0;

    const macroForest =
      smoothNoise(globalX + 12000, globalZ - 7000, 0.012) * 0.48 +
      smoothNoise(globalX - 2400, globalZ + 4100, 0.026) * 0.32 +
      smoothNoise(globalX + 9100, globalZ + 1800, 0.061) * 0.20;

    const clearingNoise =
      smoothNoise(globalX - 5300, globalZ + 14600, 0.017) * 0.72 +
      smoothNoise(globalX + 8200, globalZ - 3500, 0.043) * 0.28;

    const patchMask = smoothstep(0.40, 0.72, macroForest);
    const clearingMask = 1 - smoothstep(0.57, 0.84, clearingNoise);
    const neighborhoodSupport = getTreeNeighborhoodSupport(globalX, globalZ, sample.landLevel, 2);
    const supportMask = smoothstep(0.24, 0.88, neighborhoodSupport);

    const heightAboveSea = sample.landLevel - seaLevel;
    const lowlandBias = smoothstep(1.5, 4.5, heightAboveSea) * (1 - smoothstep(11, 18, heightAboveSea));

    const density = clamp(
      patchMask * 0.38 +
      clearingMask * 0.16 +
      supportMask * 0.18 +
      lowlandBias * 0.08,
      0,
      1
    );

    const organicJitter = hash2D(globalX * 59 - 21, globalZ * 59 + 17) * 0.12 - 0.06;
    // Lightly thin the forest overall so generated rubble has more room to read.
    return clamp(density * 0.76 + organicJitter, 0, 1);
  }

  function getNaturalTreeVariant(globalX, globalZ) {
    /*
      Variant mix is still 25/25/25/25 overall, but it is driven by low-frequency
      noise plus a small hashed nudge so tree types form natural-looking pockets.
      Because apparently even PNG forests demand demographics now.
    */
    const variantWarpX = Math.floor(globalX / 7 + smoothNoise(globalX + 6100, globalZ - 9300, 0.022) * 3.5);
    const variantWarpZ = Math.floor(globalZ / 7 + smoothNoise(globalX - 17000, globalZ + 2600, 0.022) * 3.5);
    const variantRoll = hash2D(variantWarpX * 101 + 7, variantWarpZ * 101 - 11);

    if (variantRoll < 0.25) {
      return {
        name: "tall-single",
        footprintSize: 1,
        widthMultiplier: 1,
        heightMultiplier: 1.33
      };
    }

    if (variantRoll < 0.5) {
      return {
        name: "normal-single",
        footprintSize: 1,
        widthMultiplier: 1,
        heightMultiplier: 1
      };
    }

    if (variantRoll < 0.75) {
      return {
        name: "large-two-by-two",
        footprintSize: 2,
        widthMultiplier: 2,
        heightMultiplier: 2
      };
    }

    return {
      name: "wide-short-two-by-two",
      footprintSize: 2,
      widthMultiplier: 2,
      heightMultiplier: 2 * 0.67
    };
  }

  function isLargeTreeAnchorAt(globalX, globalZ) {
    const anchorSample = getTerrainSampleAtTile(globalX, globalZ);
    if (!isTreeBaseTileEligible(globalX, globalZ, anchorSample)) return false;

    const variant = getNaturalTreeVariant(globalX, globalZ);
    if (variant.footprintSize !== 2) return false;

    for (let dz = 0; dz < 2; dz += 1) {
      for (let dx = 0; dx < 2; dx += 1) {
        const cellSample = getTerrainSampleAtTile(globalX + dx, globalZ + dz);
        if (!isTreeBaseTileEligible(globalX + dx, globalZ + dz, cellSample)) return false;
        if (cellSample.landLevel !== anchorSample.landLevel) return false;
      }
    }

    const baseScale = tileSize * (2.65 + hash2D(globalX * 47 + 23, globalZ * 47 - 29) * 2.15);
    const visualWidth = baseScale * variant.widthMultiplier;
    if (!hasTreeVisualClearance(globalX, globalZ, variant.footprintSize, visualWidth, anchorSample.landLevel)) {
      return false;
    }

    const treeDensity = getTreeDensityAtTile(globalX, globalZ, anchorSample);
    const treeRoll = hash2D(globalX * 31 + 101, globalZ * 31 - 53);
    const rareGroveAnchor = hash2D(globalX * 17 + 13, globalZ * 17 - 19);

    return (treeDensity > 0.34 && treeRoll < treeDensity * 0.12) || (treeDensity > 0.29 && rareGroveAnchor > 0.9985);
  }

  function isCoveredByNeighborLargeTree(globalX, globalZ) {
    // Prevent a normal tree from spawning inside a 2x2 big-tree footprint.
    // Only check earlier/top-left anchors so generation stays deterministic and does not recurse.
    return (
      isLargeTreeAnchorAt(globalX - 1, globalZ) ||
      isLargeTreeAnchorAt(globalX, globalZ - 1) ||
      isLargeTreeAnchorAt(globalX - 1, globalZ - 1)
    );
  }

  function getTreeSampleAtTile(globalX, globalZ, sample) {
    /*
      Procedural trees:
      - only eligible on dry grass tiles
      - macro forest noise creates broad wooded regions
      - clearing noise punches natural open spaces into those regions
      - local terrain support encourages groves on wide flat ground instead of a random confetti forest
      - variants are chosen at generation time so tall, normal, large, and squat-large trees blend naturally
    */
    if (!isTreeBaseTileEligible(globalX, globalZ, sample)) {
      return null;
    }

    if (isCoveredByNeighborLargeTree(globalX, globalZ)) return null;

    const treeDensity = getTreeDensityAtTile(globalX, globalZ, sample);
    const treeRoll = hash2D(globalX * 31 + 101, globalZ * 31 - 53);
    const fringeRoll = hash2D(globalX * 17 + 13, globalZ * 17 - 19);

    const inForestPatch = treeDensity > 0.26 && treeRoll < treeDensity * 0.20;
    const loneTree = treeDensity > 0.20 && fringeRoll < treeDensity * 0.012;

    if (!inForestPatch && !loneTree) return null;

    const variant = getNaturalTreeVariant(globalX, globalZ);

    if (variant.footprintSize === 2) {
      for (let dz = 0; dz < 2; dz += 1) {
        for (let dx = 0; dx < 2; dx += 1) {
          const cellSample = getTerrainSampleAtTile(globalX + dx, globalZ + dz);
          if (!isTreeBaseTileEligible(globalX + dx, globalZ + dz, cellSample)) return null;
          if (cellSample.landLevel !== sample.landLevel) return null;
        }
      }
    }

    const baseScale = tileSize * (2.65 + hash2D(globalX * 47 + 23, globalZ * 47 - 29) * 2.15);
    const visualWidth = baseScale * variant.widthMultiplier;
    const visualHeight = baseScale * variant.heightMultiplier;
    // Anchor the translated tree plane's bottom edge directly to the grass tile surface.
    // Re-read the exact tile-center sample here instead of trusting a caller's loop variable,
    // because one stale height is enough to make a pine levitate like it found religion.
    const anchorSample = getTerrainSampleAtTile(globalX, globalZ);
    if (!hasTreeVisualClearance(globalX, globalZ, variant.footprintSize, visualWidth, anchorSample.landLevel)) {
      return null;
    }
    const baseY = anchorSample.landLevel * heightStep;
    const footprintSize = variant.footprintSize;

    const anchorCenterOffset = footprintSize * 0.5;

    return {
      globalX,
      globalZ,
      variantName: variant.name,
      footprintSize,
      // Single-tile trees sit at tile center. 2x2 trees sit at the exact center of their 2x2 footprint.
      // Basic geometry, somehow still a recurring boss fight.
      x: tileToWorldX(globalX + anchorCenterOffset),
      y: baseY,
      z: tileToWorldZ(globalZ + anchorCenterOffset),
      scale: visualHeight,
      visualWidth,
      visualHeight,
      baseY,
      topY: baseY + visualHeight,
      opacity: 0.84 + hash2D(globalX * 53 - 31, globalZ * 53 + 37) * 0.16
    };
  }

  function isRubbleFootprintFlat(globalX, globalZ, footprintSize, allowUnderwater = true) {
    const anchorSample = getTerrainSampleAtTile(globalX, globalZ);
    if (!anchorSample) return false;

    for (let dz = 0; dz < footprintSize; dz += 1) {
      for (let dx = 0; dx < footprintSize; dx += 1) {
        const sample = getTerrainSampleAtTile(globalX + dx, globalZ + dz);
        if (!sample || sample.landLevel !== anchorSample.landLevel) return false;
        if (!allowUnderwater && sample.waterLevel === seaLevel && sample.landLevel < seaLevel) return false;
      }
    }

    // Keep the actual footprint perfectly flat, but do not reject it just because
    // neighboring tiles are dramatic little cliffs. The old neighbor check made
    // rubble so rare it qualified as cryptozoology.
    return true;
  }

  function getRubblePatchRoll(globalX, globalZ) {
    const macro =
      smoothNoise(globalX + 32000, globalZ - 18000, 0.025) * 0.54 +
      smoothNoise(globalX - 12000, globalZ + 24000, 0.071) * 0.30 +
      smoothNoise(globalX + 4700, globalZ + 9300, 0.13) * 0.16;
    const speckle = hash2D(globalX * 137 + 71, globalZ * 137 - 53);
    const patchMask = smoothstep(0.56, 0.84, macro);
    return speckle * 0.76 + patchMask * 0.24;
  }

  function getRubbleScarcityMask(globalX, globalZ) {
    // Broad low-frequency dead zones: big areas where rubble still can spawn,
    // just much less often. Keeps the current useful frequency without turning
    // every horizon into the same gravel wallpaper. Because apparently rocks
    // also need negative space, like pretentious sculpture.
    const broad =
      smoothNoise(globalX - 54000, globalZ + 41000, 0.009) * 0.64 +
      smoothNoise(globalX + 18000, globalZ - 37000, 0.017) * 0.36;
    return smoothstep(0.56, 0.80, broad);
  }

  function isRubbleCellAnchor(globalX, globalZ, cellSize = 4) {
    const cellX = Math.floor(globalX / cellSize);
    const cellZ = Math.floor(globalZ / cellSize);
    const anchorX = cellX * cellSize + Math.floor(hash2D(cellX * 251 + 23, cellZ * 251 - 47) * cellSize);
    const anchorZ = cellZ * cellSize + Math.floor(hash2D(cellX * 271 - 61, cellZ * 271 + 89) * cellSize);
    return globalX === anchorX && globalZ === anchorZ;
  }

  function isLargeRubbleAnchorAt(globalX, globalZ) {
    if (!isRubbleCellAnchor(globalX, globalZ, 5)) return false;
    if (!isRubbleFootprintFlat(globalX, globalZ, 2, true)) return false;

    // Back to the original distribution style: same patch roll, just less stingy.
    const largeRoll = hash2D(globalX * 193 + 41, globalZ * 193 - 97);

    const rarityRoll = getRubblePatchRoll(globalX, globalZ);
    const sparseGate = hash2D(globalX * 109 + 17, globalZ * 109 - 31);
    const scarcityMask = getRubbleScarcityMask(globalX, globalZ);
    return (
      largeRoll < lerp(0.14, 0.08, scarcityMask) &&
      rarityRoll > lerp(0.54, 0.62, scarcityMask) &&
      sparseGate > lerp(0.68, 0.82, scarcityMask)
    );
  }

  function isCoveredByNeighborLargeRubble(globalX, globalZ) {
    return (
      isLargeRubbleAnchorAt(globalX - 1, globalZ) ||
      isLargeRubbleAnchorAt(globalX, globalZ - 1) ||
      isLargeRubbleAnchorAt(globalX - 1, globalZ - 1)
    );
  }

  function getRubbleSampleAtTile(globalX, globalZ, sample = getTerrainSampleAtTile(globalX, globalZ)) {
    if (!sample || isCoveredByNeighborLargeRubble(globalX, globalZ)) return null;

    const canBeLarge = isLargeRubbleAnchorAt(globalX, globalZ);
    const footprintSize = canBeLarge ? 2 : 1;
    if (!isRubbleFootprintFlat(globalX, globalZ, footprintSize, true)) return null;

    if (!canBeLarge && !isRubbleCellAnchor(globalX, globalZ, 3)) return null;

    const patchRoll = getRubblePatchRoll(globalX, globalZ);
    const sparseRoll = hash2D(globalX * 109 + 17, globalZ * 109 - 31);
    const scarcityMask = getRubbleScarcityMask(globalX, globalZ);
    // Keep the back-to-scratch distribution, but carve broad quiet regions into it.
    // Outside those zones, rubble keeps the useful current frequency; inside them,
    // it drops off enough to feel patchy instead of wallpapered.
    const patchThreshold = lerp(0.54, 0.64, scarcityMask);
    const sparseThreshold = lerp(0.62, 0.80, scarcityMask);
    if (!canBeLarge && !(patchRoll > patchThreshold && sparseRoll > sparseThreshold)) return null;

    const underwater = sample.waterLevel === seaLevel && sample.landLevel < seaLevel;
    const pieceCount = canBeLarge
      ? 9 + Math.floor(hash2D(globalX * 83 - 7, globalZ * 83 + 13) * 7)
      : 4 + Math.floor(hash2D(globalX * 83 - 7, globalZ * 83 + 13) * 5);
    const footprintWorld = tileSize * footprintSize;
    const heightVariantRoll = hash2D(globalX * 307 - 101, globalZ * 307 + 137);
    const heightVariantAmount = hash2D(globalX * 331 + 149, globalZ * 331 - 163);
    const heightStretch = heightVariantRoll < 0.25
      ? (canBeLarge ? lerp(0.75, 1.25, heightVariantAmount) : lerp(1.05, 1.33, heightVariantAmount))
      : 1;

    return {
      globalX,
      globalZ,
      footprintSize,
      x: tileToWorldX(globalX + footprintSize * 0.5),
      y: sample.landLevel * heightStep,
      z: tileToWorldZ(globalZ + footprintSize * 0.5),
      footprintWorld,
      spread: footprintWorld * (canBeLarge ? 0.32 : 0.28),
      baseScale: tileSize * (canBeLarge ? 0.95 : 0.62),
      pieceCount,
      underwater,
      heightStretch,
      rotationX: (hash2D(globalX * 353 + 173, globalZ * 353 - 181) - 0.5) * 0.12,
      rotationY: hash2D(globalX * 379 - 191, globalZ * 379 + 197) * Math.PI * 2
    };
  }

  function getRubbleKey(globalX, globalZ) {
    return `${globalX},${globalZ}`;
  }

  const rubbleCrackResetTimers = new Map();
  const rubbleClickHoldCounts = new Map();
  const RUBBLE_LIGHT_DAMAGE_RESET_MS = 15000;
  const RUBBLE_HOLD_TICKS_TO_YELLOW = 7;
  const RUBBLE_HOLD_TICKS_TO_RED = 10;
  const RUBBLE_HOLD_TICKS_TO_RAGDOLL = 11;

  function clearRubbleCrackResetTimer(key) {
    if (!key || !rubbleCrackResetTimers.has(key)) return;
    window.clearTimeout(rubbleCrackResetTimers.get(key));
    rubbleCrackResetTimers.delete(key);
  }

  function resetRubblePileCrackState(key) {
    if (!key) return;

    rubbleCrackResetTimers.delete(key);
    if (Math.max(0, Math.round(Number(rubbleCrackLandingCounts.get(key)) || 0)) > 2) return;
    if (clamp(Math.round(Number(rubbleCrackStates.get(key)) || 0), 0, 3) >= 3) return;

    rubbleCrackLandingCounts.set(key, 0);
    rubbleClickHoldCounts.set(key, 0);
    rubbleCrackStates.set(key, 0);

    const rubbleGroup = rubbleObjects.get(key);
    if (rubbleGroup && rubbleGroup.userData) {
      rubbleGroup.userData.rubbleLandingCount = 0;
      rubbleGroup.userData.rubbleClickHoldCount = 0;
      applyRubbleCrackVisualState(rubbleGroup, 0);
    }

    markWorldCacheDirty();
  }

  function scheduleRubbleLightDamageReset(key) {
    if (!key) return;
    clearRubbleCrackResetTimer(key);
    rubbleCrackResetTimers.set(
      key,
      window.setTimeout(() => resetRubblePileCrackState(key), RUBBLE_LIGHT_DAMAGE_RESET_MS)
    );
  }

  function getRubbleHitboxGridColor(crackState = 0) {
    const state = clamp(Math.round(Number(crackState) || 0), 0, 2);
    if (state >= 2) return 0xff3030;
    if (state >= 1) return 0xffe66d;
    return 0x39ff14;
  }

  function applyRubbleHitboxGridColor(hitboxGrid, crackState = 0) {
    if (!hitboxGrid || !hitboxGrid.material || !hitboxGrid.material.color) return;
    hitboxGrid.material.color.setHex(getRubbleHitboxGridColor(crackState));
  }

  function getRubbleCrackStateForLandingCount(landingCount = 0) {
    const count = Math.max(0, Math.round(Number(landingCount) || 0));
    if (count >= 4) return 2;
    if (count >= 1) return 1;
    return 0;
  }

  function getRubbleCrackStateForHoldTickCount(tickCount = 0) {
    const count = Math.max(0, Math.round(Number(tickCount) || 0));
    if (count >= RUBBLE_HOLD_TICKS_TO_RED) return 2;
    if (count >= RUBBLE_HOLD_TICKS_TO_YELLOW) return 1;
    return 0;
  }

  function getRubbleHoldTickCount(rubbleGroup) {
    if (!rubbleGroup || !rubbleGroup.userData) return 0;

    const key = rubbleGroup.userData.rubbleKey;
    const storedCount = key ? rubbleClickHoldCounts.get(key) : null;
    const rawCount = Number.isFinite(Number(rubbleGroup.userData.rubbleClickHoldCount))
      ? rubbleGroup.userData.rubbleClickHoldCount
      : storedCount;

    if (Number.isFinite(Number(rawCount))) {
      return Math.max(0, Math.round(Number(rawCount) || 0));
    }

    const state = clamp(Math.round(Number(rubbleGroup.userData.rubbleCrackState) || 0), 0, 2);
    if (state >= 2) return RUBBLE_HOLD_TICKS_TO_RED;
    if (state >= 1) return RUBBLE_HOLD_TICKS_TO_YELLOW;
    return 0;
  }

  function applyRubbleCrackVisualState(rubbleGroup, nextState) {
    if (!rubbleGroup) return;

    const state = clamp(Math.round(Number(nextState) || 0), 0, 2);
    rubbleGroup.userData.rubbleCrackState = state;

    const overlay01Meshes = rubbleGroup.userData.crackOverlay01Meshes || [];
    const overlay02Meshes = rubbleGroup.userData.crackOverlay02Meshes || [];

    for (const mesh of overlay01Meshes) {
      mesh.visible = state >= 1;
    }

    for (const mesh of overlay02Meshes) {
      mesh.visible = state >= 2;
    }

    applyRubbleHitboxGridColor(rubbleGroup.userData.rubbleHitboxGrid, state);
  }

  function findRubblePileAtWorld(x, z) {
    for (const rubbleGroup of rubbleObjects.values()) {
      if (!rubbleGroup || !rubbleGroup.userData) continue;

      const minX = rubbleGroup.userData.rubbleMinX;
      const maxX = rubbleGroup.userData.rubbleMaxX;
      const minZ = rubbleGroup.userData.rubbleMinZ;
      const maxZ = rubbleGroup.userData.rubbleMaxZ;

      if (
        Number.isFinite(minX) &&
        Number.isFinite(maxX) &&
        Number.isFinite(minZ) &&
        Number.isFinite(maxZ) &&
        x >= minX &&
        x < maxX &&
        z >= minZ &&
        z < maxZ
      ) {
        return rubbleGroup;
      }
    }

    return null;
  }

  function advanceRubbleCrackStateAtWorld(x, z) {
    const rubbleGroup = findRubblePileAtWorld(x, z);
    if (!rubbleGroup || !rubbleGroup.userData) {
      return { hit: false, changed: false, state: 0, landingCount: 0, rubbleGroup: null };
    }

    const key = rubbleGroup.userData.rubbleKey;
    const currentLandingCount = Math.max(
      0,
      Math.round(Number(rubbleGroup.userData.rubbleLandingCount ?? (key ? rubbleCrackLandingCounts.get(key) : 0)) || 0)
    );
    const nextLandingCount = currentLandingCount + 1;
    const currentState = clamp(Math.round(Number(rubbleGroup.userData.rubbleCrackState) || 0), 0, 2);
    const nextState = getRubbleCrackStateForLandingCount(nextLandingCount);

    rubbleGroup.userData.rubbleLandingCount = nextLandingCount;
    if (key) {
      rubbleCrackLandingCounts.set(key, nextLandingCount);
      rubbleCrackStates.set(key, nextState);
      if (nextLandingCount <= 2) {
        scheduleRubbleLightDamageReset(key);
      } else {
        clearRubbleCrackResetTimer(key);
      }
    }

    const changed = nextState !== currentState;
    if (changed) {
      applyRubbleCrackVisualState(rubbleGroup, nextState);
      markWorldCacheDirty();
    }

    return {
      hit: true,
      changed,
      state: nextState,
      landingCount: nextLandingCount,
      rubbleGroup,
      key
    };
  }

  function advanceRubbleHoldCrackAtWorld(x, z) {
    const rubbleGroup = findRubblePileAtWorld(x, z);
    if (!rubbleGroup || !rubbleGroup.userData) {
      return { hit: false, changed: false, state: 0, holdTickCount: 0, shouldRagdoll: false, rubbleGroup: null };
    }

    const key = rubbleGroup.userData.rubbleKey;
    const currentTickCount = getRubbleHoldTickCount(rubbleGroup);
    const nextTickCount = currentTickCount + 1;
    const currentState = clamp(Math.round(Number(rubbleGroup.userData.rubbleCrackState) || 0), 0, 2);
    const nextState = getRubbleCrackStateForHoldTickCount(nextTickCount);
    const shouldRagdoll = nextTickCount >= RUBBLE_HOLD_TICKS_TO_RAGDOLL;

    rubbleGroup.userData.rubbleClickHoldCount = nextTickCount;
    if (key) {
      rubbleClickHoldCounts.set(key, nextTickCount);
      rubbleCrackStates.set(key, shouldRagdoll ? 3 : nextState);
      clearRubbleCrackResetTimer(key);
    }

    const changed = nextState !== currentState && !shouldRagdoll;
    if (changed) {
      applyRubbleCrackVisualState(rubbleGroup, nextState);
      markWorldCacheDirty();
    }

    return {
      hit: true,
      changed,
      state: nextState,
      holdTickCount: nextTickCount,
      shouldRagdoll,
      rubbleGroup,
      key
    };
  }

  function convertRubblePileAtWorldToLooseRagdoll(x, z) {
    const rubbleGroup = findRubblePileAtWorld(x, z);
    if (!rubbleGroup || !rubbleGroup.userData) return null;

    const key = rubbleGroup.userData.rubbleKey;
    if (key) {
      clearRubbleCrackResetTimer(key);
      rubbleCrackStates.set(key, 3);
      rubbleClickHoldCounts.set(key, RUBBLE_HOLD_TICKS_TO_RAGDOLL);
      rubbleCrackLandingCounts.set(key, Math.max(4, Number(rubbleGroup.userData.rubbleLandingCount) || 4));
      rubbleObjects.delete(key);
      deletedRubbleKeys.add(key);
      saveDeletedRubbleKeys();
    }

    const hitboxGrid = rubbleGroup.userData.rubbleHitboxGrid;
    if (hitboxGrid) {
      rubbleHitboxGridObjects.delete(hitboxGrid);
      if (hitboxGrid.parent) hitboxGrid.parent.remove(hitboxGrid);
      if (hitboxGrid.geometry) hitboxGrid.geometry.dispose();
      if (hitboxGrid.material) hitboxGrid.material.dispose();
      rubbleGroup.userData.rubbleHitboxGrid = null;
    }

    const worldPosition = new THREE.Vector3();
    const worldQuaternion = new THREE.Quaternion();
    const worldScale = new THREE.Vector3();
    rubbleGroup.updateMatrixWorld(true);
    rubbleGroup.matrixWorld.decompose(worldPosition, worldQuaternion, worldScale);

    if (rubbleGroup.parent) rubbleGroup.parent.remove(rubbleGroup);
    rubbleGroup.position.copy(worldPosition);
    rubbleGroup.quaternion.copy(worldQuaternion);
    rubbleGroup.scale.copy(worldScale);
    scene.add(rubbleGroup);

    rubbleGroup.userData.isRubblePile = false;
    rubbleGroup.userData.isLooseRubbleRagdoll = true;
    rubbleGroup.userData.rubbleRagdollVelocity = new THREE.Vector3();
    rubbleGroup.userData.rubbleRagdollAngularVelocity = new THREE.Vector3(
      (hash2D(worldPosition.x * 17 + 3, worldPosition.z * 17 - 5) - 0.5) * 2.4,
      (hash2D(worldPosition.x * 19 - 7, worldPosition.z * 19 + 11) - 0.5) * 3.2,
      (hash2D(worldPosition.x * 23 + 13, worldPosition.z * 23 - 17) - 0.5) * 2.4
    );
    rubbleGroup.userData.rubbleRagdollRadius = Math.max(
      tileSize * 0.72,
      (Number(rubbleGroup.userData.rubbleFootprintSize) || 1) * tileSize * 0.42
    );
    rubbleGroup.userData.rubbleRagdollBaseY = Number(rubbleGroup.userData.rubbleBaseY) || worldPosition.y;
    rubbleGroup.userData.rubbleRagdollTopY = Number(rubbleGroup.userData.rubbleTopY) || (worldPosition.y + tileSize);
    rubbleGroup.userData.rubbleRagdollHeight = Math.max(
      tileSize * 0.35,
      rubbleGroup.userData.rubbleRagdollTopY - rubbleGroup.userData.rubbleRagdollBaseY
    );
    rubbleGroup.userData.rubbleRagdollScale = 1;
    rubbleGroup.userData.rubbleRagdollTargetScale = 1;

    markWorldCacheDirty();
    return rubbleGroup;
  }

  function buildRubbleHitboxGrid(rubble, renderedTopY, crackState = 0) {
    const yMin = rubble.y + 0.045;
    const yMax = Math.max(yMin + 0.08, renderedTopY);
    const xMin = tileToWorldX(rubble.globalX);
    const xMax = tileToWorldX(rubble.globalX + rubble.footprintSize);
    const zMin = tileToWorldZ(rubble.globalZ);
    const zMax = tileToWorldZ(rubble.globalZ + rubble.footprintSize);

    const positions = [
      // Bottom footprint rising from the occupied tile/2x2 surface
      xMin, yMin, zMin,  xMax, yMin, zMin,
      xMax, yMin, zMin,  xMax, yMin, zMax,
      xMax, yMin, zMax,  xMin, yMin, zMax,
      xMin, yMin, zMax,  xMin, yMin, zMin,

      // Top footprint at the actual rubble pile height
      xMin, yMax, zMin,  xMax, yMax, zMin,
      xMax, yMax, zMin,  xMax, yMax, zMax,
      xMax, yMax, zMax,  xMin, yMax, zMax,
      xMin, yMax, zMax,  xMin, yMax, zMin,

      // Vertical hitbox corners
      xMin, yMin, zMin,  xMin, yMax, zMin,
      xMax, yMin, zMin,  xMax, yMax, zMin,
      xMax, yMin, zMax,  xMax, yMax, zMax,
      xMin, yMin, zMax,  xMin, yMax, zMax
    ];

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));

    const material = new THREE.LineBasicMaterial({
      color: getRubbleHitboxGridColor(crackState),
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
      linewidth: 3
    });

    const hitboxGrid = new THREE.LineSegments(geometry, material);
    hitboxGrid.visible = Boolean(getShowGridLines());
    hitboxGrid.renderOrder = 6;
    hitboxGrid.userData.isRubbleHitboxGrid = true;
    hitboxGrid.userData.rubbleKey = `${rubble.globalX},${rubble.globalZ}`;

    rubbleHitboxGridObjects.add(hitboxGrid);
    return hitboxGrid;
  }

  function addRubblePile(group, rubble) {
    const rubbleGroup = new THREE.Group();
    const rubbleKey = getRubbleKey(rubble.globalX, rubble.globalZ);
    if (deletedRubbleKeys.has(rubbleKey)) return;
    const storedLandingCount = Math.max(0, Math.round(Number(rubbleCrackLandingCounts.get(rubbleKey)) || 0));
    const storedHoldTickCount = Math.max(0, Math.round(Number(rubbleClickHoldCounts.get(rubbleKey)) || 0));
    const storedLegacyState = clamp(Math.round(Number(rubbleCrackStates.get(rubbleKey)) || 0), 0, 3);
    if (storedLegacyState >= 3) return;
    const startingCrackState = Math.max(
      getRubbleCrackStateForLandingCount(storedLandingCount),
      getRubbleCrackStateForHoldTickCount(storedHoldTickCount),
      storedLegacyState
    );

    rubbleGroup.position.set(rubble.x, rubble.y, rubble.z);
    rubbleGroup.rotation.set(rubble.rotationX || 0, rubble.rotationY || 0, 0);
    rubbleGroup.userData.isRubblePile = true;
    rubbleGroup.userData.rubbleKey = rubbleKey;
    rubbleGroup.userData.rubbleGlobalX = rubble.globalX;
    rubbleGroup.userData.rubbleGlobalZ = rubble.globalZ;
    rubbleGroup.userData.rubbleFootprintSize = rubble.footprintSize;
    rubbleGroup.userData.rubbleMinX = tileToWorldX(rubble.globalX);
    rubbleGroup.userData.rubbleMaxX = tileToWorldX(rubble.globalX + rubble.footprintSize);
    rubbleGroup.userData.rubbleMinZ = tileToWorldZ(rubble.globalZ);
    rubbleGroup.userData.rubbleMaxZ = tileToWorldZ(rubble.globalZ + rubble.footprintSize);
    rubbleGroup.userData.rubbleBaseY = rubble.y;
    rubbleGroup.userData.rubbleCrackState = startingCrackState;
    rubbleGroup.userData.rubbleLandingCount = storedLandingCount;
    rubbleGroup.userData.rubbleClickHoldCount = storedHoldTickCount || getRubbleHoldTickCount(rubbleGroup);
    rubbleGroup.userData.crackOverlay01Meshes = [];
    rubbleGroup.userData.crackOverlay02Meshes = [];

    const maxHalfFootprint = rubble.footprintWorld * 0.46;
    let maxRenderedTopY = rubble.y + 0.08;
    for (let i = 0; i < rubble.pieceCount; i += 1) {
      const pieceWidth = rubble.baseScale * lerp(0.34, 0.76, hash2D(rubble.globalX * 149 + i * 31 + 3, rubble.globalZ * 149 - i * 29 - 5));
      const pieceDepth = rubble.baseScale * lerp(0.32, 0.74, hash2D(rubble.globalX * 163 + i * 17 + 7, rubble.globalZ * 163 - i * 19 - 11));
      const pieceHeight = rubble.baseScale * (rubble.heightStretch || 1) * lerp(0.16, 0.45, hash2D(rubble.globalX * 181 + i * 23 + 13, rubble.globalZ * 181 - i * 13 - 17));

      const angle = hash2D(rubble.globalX * 211 + i * 37 + 19, rubble.globalZ * 211 - i * 41 - 23) * Math.PI * 2;
      const radius = Math.sqrt(hash2D(rubble.globalX * 227 + i * 43 + 29, rubble.globalZ * 227 - i * 47 - 31)) * rubble.spread;
      const offsetX = clamp(Math.cos(angle) * radius, -maxHalfFootprint + pieceWidth * 0.5, maxHalfFootprint - pieceWidth * 0.5);
      const offsetZ = clamp(Math.sin(angle) * radius, -maxHalfFootprint + pieceDepth * 0.5, maxHalfFootprint - pieceDepth * 0.5);
      const sink = rubble.underwater ? pieceHeight * 0.18 : pieceHeight * 0.08;

      const pieceGeometry = new THREE.BoxGeometry(pieceWidth, pieceHeight, pieceDepth);
      const piece = new THREE.Mesh(pieceGeometry, rubbleMaterial);
      piece.position.set(offsetX, Math.max(0.025, pieceHeight * 0.5 - sink), offsetZ);
      piece.rotation.set(
        (hash2D(rubble.globalX * 239 + i * 53 + 41, rubble.globalZ * 239 - i * 59 - 43) - 0.5) * 0.24,
        hash2D(rubble.globalX * 251 + i * 61 + 47, rubble.globalZ * 251 - i * 67 - 53) * Math.PI * 2,
        (hash2D(rubble.globalX * 263 + i * 71 + 59, rubble.globalZ * 263 - i * 73 - 61) - 0.5) * 0.24
      );
      piece.castShadow = false;
      piece.receiveShadow = true;

      if (rubbleCrackOverlay01Material) {
        const crackOverlay01 = new THREE.Mesh(pieceGeometry.clone(), rubbleCrackOverlay01Material);
        crackOverlay01.position.copy(piece.position);
        crackOverlay01.rotation.copy(piece.rotation);
        crackOverlay01.scale.setScalar(1.012);
        crackOverlay01.renderOrder = 7;
        crackOverlay01.visible = startingCrackState >= 1;
        crackOverlay01.userData.isRubbleCrackOverlay = true;
        rubbleGroup.userData.crackOverlay01Meshes.push(crackOverlay01);
        rubbleGroup.add(crackOverlay01);
      }

      if (rubbleCrackOverlay02Material) {
        const crackOverlay02 = new THREE.Mesh(pieceGeometry.clone(), rubbleCrackOverlay02Material);
        crackOverlay02.position.copy(piece.position);
        crackOverlay02.rotation.copy(piece.rotation);
        crackOverlay02.scale.setScalar(1.018);
        crackOverlay02.renderOrder = 8;
        crackOverlay02.visible = startingCrackState >= 2;
        crackOverlay02.userData.isRubbleCrackOverlay = true;
        rubbleGroup.userData.crackOverlay02Meshes.push(crackOverlay02);
        rubbleGroup.add(crackOverlay02);
      }

      const tiltedTopAllowance = pieceHeight * 0.18 + Math.max(pieceWidth, pieceDepth) * 0.13;
      maxRenderedTopY = Math.max(maxRenderedTopY, rubble.y + piece.position.y + pieceHeight * 0.5 + tiltedTopAllowance);
      rubbleGroup.add(piece);
    }

    rubbleGroup.userData.rubbleTopY = maxRenderedTopY;
    applyRubbleCrackVisualState(rubbleGroup, startingCrackState);
    rubbleObjects.set(rubbleKey, rubbleGroup);

    group.add(rubbleGroup);

    const rubbleHitboxGrid = buildRubbleHitboxGrid(rubble, maxRenderedTopY, startingCrackState);
    rubbleGroup.userData.rubbleHitboxGrid = rubbleHitboxGrid;
    group.add(rubbleHitboxGrid);
  }

  function addTreeSprite(group, tree) {
    const colliderKey = getTreeColliderKey(tree.globalX, tree.globalZ);
    if (getHideTrees() || deletedTreeKeys.has(colliderKey)) return;

    const spriteGroup = new THREE.Group();
    const uprightTreeGroup = new THREE.Group();
    const northSouthTree = new THREE.Mesh(pineTreePlaneGeometry, pineTreeMaterial.clone());
    const eastWestTree = new THREE.Mesh(pineTreePlaneGeometry, pineTreeMaterial.clone());
    const flatTree = new THREE.Mesh(flatPineTreePlaneGeometry, flatPineTreeMaterial.clone());
    const flatVisualGroup = new THREE.Group();
    const flatDirtWallGroup = new THREE.Group();
    const flatHoverUnderlay = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({
        color: 0x9cff00,
        transparent: true,
        opacity: 0.33,
        depthWrite: false,
        depthTest: true,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -3,
        polygonOffsetUnits: -3
      })
    );
    const flatHitTarget = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        depthTest: false
      })
    );

    // Build the normal tree as a static crossed pair of planes instead of a camera-facing billboard.
    // When the player sphere overlaps the footprint, the crossed planes hide and a top-down tree lies flat.
    for (const plane of [northSouthTree, eastWestTree]) {
      plane.scale.set(tree.visualWidth * 0.54, tree.visualHeight, 1);
      plane.material.opacity = tree.opacity;
      plane.material.transparent = true;
      plane.material.alphaTest = 0.28;
      plane.material.depthTest = true;
      plane.material.depthWrite = true;
    }

    northSouthTree.rotation.set(0, 0, 0);
    northSouthTree.position.z = 0.01;
    northSouthTree.renderOrder = 4;

    eastWestTree.rotation.set(0, Math.PI * 0.5, 0);
    eastWestTree.position.x = 0.01;
    eastWestTree.renderOrder = 4;

    uprightTreeGroup.add(northSouthTree);
    uprightTreeGroup.add(eastWestTree);
    uprightTreeGroup.position.y = -tree.visualHeight * treeVisibleBottomTrimRatio;

    flatHoverUnderlay.rotation.set(-Math.PI * 0.5, 0, 0);
    flatHoverUnderlay.position.y = 0.008;
    flatHoverUnderlay.scale.set(tileSize * tree.footprintSize, tileSize * tree.footprintSize, 1);
    flatHoverUnderlay.visible = false;
    flatHoverUnderlay.renderOrder = 4;

    const flatTreeFootprintScale = tileSize * tree.footprintSize * 0.94;
    const flatTreeHeightScale = Math.max(2.35, tileSize * tree.footprintSize * 0.94) * 0.72;
    const flatTreePositionY = -0.09;
    const flatTreeWorldRadius = flatTreeFootprintScale * 0.5;
    const flatTreeCylinderRadius = flatTreeWorldRadius * 0.75;
    const flatTreeLocalCylinderRadius = flatTreeFootprintScale > 0 ? flatTreeCylinderRadius / flatTreeFootprintScale : 0.375;

    const flatTreePositionAttribute = flatPineTreePlaneGeometry && flatPineTreePlaneGeometry.attributes
      ? flatPineTreePlaneGeometry.attributes.position
      : null;
    let flatTreeNearestSurfaceZ = 0;
    let flatTreeNearestSurfaceDelta = Number.POSITIVE_INFINITY;
    let flatTreeSurfaceZSum = 0;
    let flatTreeSurfaceZSamples = 0;

    if (flatTreePositionAttribute) {
      for (let i = 0; i < flatTreePositionAttribute.count; i += 1) {
        const vx = flatTreePositionAttribute.getX(i);
        const vy = flatTreePositionAttribute.getY(i);
        const vz = Math.max(0, flatTreePositionAttribute.getZ(i));
        const vertexRadius = Math.sqrt(vx * vx + vy * vy);
        const radiusDelta = Math.abs(vertexRadius - flatTreeLocalCylinderRadius);

        if (radiusDelta < flatTreeNearestSurfaceDelta) {
          flatTreeNearestSurfaceDelta = radiusDelta;
          flatTreeNearestSurfaceZ = vz;
        }

        if (radiusDelta <= 0.015) {
          flatTreeSurfaceZSum += vz;
          flatTreeSurfaceZSamples += 1;
        }
      }
    }

    const flatTreeInnerSurfaceLocalZ = flatTreeSurfaceZSamples > 0
      ? flatTreeSurfaceZSum / flatTreeSurfaceZSamples
      : flatTreeNearestSurfaceZ;
    const flatTreeInnerSurfaceY = Math.max(0.02, flatTreePositionY + flatTreeInnerSurfaceLocalZ * flatTreeHeightScale + 0.02);
    const flatTreeWallHeight = Math.max(0.08, flatTreeInnerSurfaceY);
    const flatTreeWallY = flatTreeWallHeight * 0.5;

    const flatDirtCylinder = new THREE.Mesh(
      new THREE.CylinderGeometry(flatTreeCylinderRadius, flatTreeCylinderRadius, flatTreeWallHeight, 36, 1, true),
      dirtMaterial.clone()
    );
    flatDirtCylinder.position.y = flatTreeWallY;
    flatDirtCylinder.renderOrder = 4;
    flatDirtCylinder.material.side = THREE.DoubleSide;
    flatDirtCylinder.material.transparent = false;
    flatDirtCylinder.material.depthWrite = true;
    flatDirtCylinder.material.needsUpdate = true;

    const flatDirtCylinderCapGeometry = new THREE.CircleGeometry(flatTreeCylinderRadius, 48);
    const flatDirtCylinderCapPositions = flatDirtCylinderCapGeometry.attributes.position;
    const flatDirtCylinderCapUvs = flatDirtCylinderCapGeometry.attributes.uv;
    for (let i = 0; i < flatDirtCylinderCapPositions.count; i += 1) {
      const capX = flatDirtCylinderCapPositions.getX(i);
      const capY = flatDirtCylinderCapPositions.getY(i);
      flatDirtCylinderCapUvs.setXY(
        i,
        0.5 + capX / flatTreeFootprintScale,
        0.5 + capY / flatTreeFootprintScale
      );
    }
    flatDirtCylinderCapUvs.needsUpdate = true;

    const flatDirtCylinderCapBase = new THREE.Mesh(
      flatDirtCylinderCapGeometry.clone(),
      dirtMaterial.clone()
    );
    flatDirtCylinderCapBase.rotation.set(-Math.PI * 0.5, 0, 0);
    flatDirtCylinderCapBase.position.y = flatTreeWallHeight + 0.001;
    flatDirtCylinderCapBase.renderOrder = 5;
    flatDirtCylinderCapBase.material.side = THREE.DoubleSide;
    flatDirtCylinderCapBase.material.depthWrite = true;
    flatDirtCylinderCapBase.material.needsUpdate = true;

    const flatDirtCylinderTop = new THREE.Mesh(
      flatDirtCylinderCapGeometry,
      flatPineTreeMaterial.clone()
    );
    flatDirtCylinderTop.rotation.set(-Math.PI * 0.5, 0, 0);
    flatDirtCylinderTop.position.y = flatTreeWallHeight + 0.004;
    flatDirtCylinderTop.renderOrder = 6;
    flatDirtCylinderTop.material.opacity = Math.min(1, tree.opacity + 0.06);
    flatDirtCylinderTop.material.transparent = true;
    flatDirtCylinderTop.material.alphaTest = 0.08;
    flatDirtCylinderTop.material.depthWrite = false;
    flatDirtCylinderTop.material.needsUpdate = true;

    flatDirtWallGroup.add(flatDirtCylinder);
    flatDirtWallGroup.add(flatDirtCylinderCapBase);
    flatDirtWallGroup.add(flatDirtCylinderTop);
    flatDirtWallGroup.visible = false;

    flatVisualGroup.visible = false;
    flatVisualGroup.renderOrder = 5;

    flatTree.rotation.set(-Math.PI * 0.5, 0, 0);
    flatTree.position.y = flatTreePositionY;
    flatTree.scale.set(flatTreeFootprintScale, flatTreeFootprintScale, flatTreeHeightScale);
    flatTree.material.opacity = Math.min(1, tree.opacity + 0.06);
    flatTree.visible = false;
    flatTree.renderOrder = 5;

    flatVisualGroup.add(flatDirtWallGroup);
    flatVisualGroup.add(flatTree);

    flatHitTarget.position.y = 0.34;
    flatHitTarget.scale.set(tileSize * tree.footprintSize, 0.68, tileSize * tree.footprintSize);
    flatHitTarget.visible = false;
    flatHitTarget.userData.isFlattenedTreeClickTarget = true;
    flatHitTarget.userData.treeColliderKey = colliderKey;
    flattenedTreeClickTargets.add(flatHitTarget);

    spriteGroup.position.set(tree.x, tree.y, tree.z);
    spriteGroup.userData.isPineTreeSprite = true;
    spriteGroup.userData.treeColliderKey = colliderKey;
    spriteGroup.add(uprightTreeGroup);
    spriteGroup.add(flatHoverUnderlay);
    spriteGroup.add(flatVisualGroup);
    spriteGroup.add(flatHitTarget);

    group.add(spriteGroup);
    treeSprites.add(spriteGroup);

    const collider = {
      key: colliderKey,
      globalX: tree.globalX,
      globalZ: tree.globalZ,
      xMin: tileToWorldX(tree.globalX),
      xMax: tileToWorldX(tree.globalX + tree.footprintSize),
      zMin: tileToWorldZ(tree.globalZ),
      zMax: tileToWorldZ(tree.globalZ + tree.footprintSize),
      baseY: tree.baseY,
      topY: tree.topY,
      sprite: spriteGroup,
      uprightGroup: uprightTreeGroup,
      flatSprite: flatTree,
      flatVisualGroup,
      flatDirtWallGroup,
      flatHoverUnderlay,
      flatHitTarget,
      flatVisualScale: 1,
      flatVisualTargetScale: 1,
      flatHoverScale: 1.07,
      isFlattened: false,
      isHovered: false,
      isCollapsing: false,
      collapseElapsed: 0,
      collapseDuration: 0.22,
      collapseStartScale: 1,
      restoreTimer: 0,
      hitboxGrid: null
    };

    const hitboxGrid = buildTreeHitboxGrid(collider);
    collider.hitboxGrid = hitboxGrid;
    group.add(hitboxGrid);

    treeColliders.set(colliderKey, collider);
  }

  function updateTreeSpritesFacingCamera() {
    // Trees are intentionally static crossed planes now.
    // Keep the function in place so the main update loop stays simple.
    for (const sprite of treeSprites) {
      if (!sprite.parent) {
        treeSprites.delete(sprite);
      }
    }
  }

  function buildChunk(chunkX, chunkZ) {
    const chunkKey = `${chunkX},${chunkZ}`;
    if (loadedChunks.has(chunkKey)) return;

    promoteDistantLodToDetailed(chunkKey);

    const group = new THREE.Group();
    group.name = `terrain-chunk-${chunkKey}`;
    group.userData.chunkX = chunkX;
    group.userData.chunkZ = chunkZ;
    group.userData.isDetailedChunk = true;

    const grassPositions = [];
    const grassUvs = [];
    const grassIndices = [];

    const sandPositions = [];
    const sandUvs = [];
    const sandIndices = [];

    const dirtPositions = [];
    const dirtUvs = [];
    const dirtIndices = [];

    const waterPositions = [];
    const waterUvs = [];
    const waterIndices = [];

    const gridPositions = [];

    const startTileX = chunkX * chunkTiles;
    const startTileZ = chunkZ * chunkTiles;
    const seaSurfaceY = seaLevel * heightStep + 0.18;

    function getSample(gx, gz) {
      return getTerrainSampleAtTile(gx, gz);
    }

    function isWaterSample(sample) {
      return sample.waterLevel === seaLevel && sample.landLevel < seaLevel;
    }

    function addQuadTo(positions, uvs, indices, corners) {
      addQuad(positions, uvs, indices, true, corners);
    }

    function addWallTo(positions, uvs, indices, x0, z0, x1, z1, yLow, yHigh) {
      if (yHigh <= yLow + 0.001) return;

      const start = positions.length / 3;
      positions.push(
        x0, yHigh, z0,
        x1, yHigh, z1,
        x1, yLow, z1,
        x0, yLow, z0
      );

      const vHeight = Math.max(1, (yHigh - yLow) / heightStep);
      uvs.push(
        0, 0,
        1, 0,
        1, vHeight,
        0, vHeight
      );

      indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
    }

    for (let localZ = 0; localZ < chunkTiles; localZ += 1) {
      for (let localX = 0; localX < chunkTiles; localX += 1) {
        const globalX = startTileX + localX;
        const globalZ = startTileZ + localZ;

        const sample = getSample(globalX, globalZ);
        const northSample = getSample(globalX, globalZ - 1);
        const southSample = getSample(globalX, globalZ + 1);
        const westSample = getSample(globalX - 1, globalZ);
        const eastSample = getSample(globalX + 1, globalZ);

        const hasWater = isWaterSample(sample);
        const northHasWater = isWaterSample(northSample);
        const southHasWater = isWaterSample(southSample);
        const westHasWater = isWaterSample(westSample);
        const eastHasWater = isWaterSample(eastSample);

        const level = sample.landLevel;
        const y = level * heightStep;

        const northY = northSample.landLevel * heightStep;
        const southY = southSample.landLevel * heightStep;
        const westY = westSample.landLevel * heightStep;
        const eastY = eastSample.landLevel * heightStep;

        /*
          Shoreline rule:
          - any water tile touching non-water becomes a sand "shore block" at sea level
          - actual water renders only on interior water tiles
          This guarantees the edge around water is always surrounded by blocks.
        */
        const isInteriorWater = hasWater && northHasWater && southHasWater && westHasWater && eastHasWater;
        const isShorelineWater = hasWater && !isInteriorWater;
        const adjacentWater = northHasWater || southHasWater || westHasWater || eastHasWater;

        /*
          Beach layer:
          If a grass tile is part of the sea-level transition band, render it as sand.png.
          This prevents green top faces from sitting on top of the sand shoreline layer like
          someone put turf carpet on a beach, because apparently nature needed a CSS override.
        */
        const nearSeaLevel =
          level <= seaLevel + 2 ||
          northSample.landLevel <= seaLevel + 1 ||
          southSample.landLevel <= seaLevel + 1 ||
          westSample.landLevel <= seaLevel + 1 ||
          eastSample.landLevel <= seaLevel + 1;

        const touchesBeachWall =
          !hasWater &&
          (
            adjacentWater ||
            (level <= seaLevel + 3 && (
              Math.abs(level - northSample.landLevel) > 0 ||
              Math.abs(level - southSample.landLevel) > 0 ||
              Math.abs(level - westSample.landLevel) > 0 ||
              Math.abs(level - eastSample.landLevel) > 0
            ))
          );

        const isBeachLand = !hasWater && nearSeaLevel && touchesBeachWall;

        let tree = null;
        if (!getHideTrees() && !hasWater && !isBeachLand) {
          tree = getTreeSampleAtTile(globalX, globalZ, sample);
          if (tree) {
            addTreeSprite(group, tree);
          }
        }

        if (!tree) {
          const rubble = getRubbleSampleAtTile(globalX, globalZ, sample);
          if (rubble) {
            addRubblePile(group, rubble);
          }
        }

        const x0 = tileToWorldX(globalX);
        const x1 = x0 + tileSize;
        const z0 = tileToWorldZ(globalZ);
        const z1 = z0 + tileSize;

        // Top surfaces
        if (isShorelineWater) {
          addQuadTo(sandPositions, sandUvs, sandIndices, [
            { x: x0, y: seaSurfaceY, z: z0, u: 0, v: 0 },
            { x: x1, y: seaSurfaceY, z: z0, u: 1, v: 0 },
            { x: x1, y: seaSurfaceY, z: z1, u: 1, v: 1 },
            { x: x0, y: seaSurfaceY, z: z1, u: 0, v: 1 }
          ]);
        } else if (isInteriorWater) {
          // seabed visible through water
          addQuadTo(sandPositions, sandUvs, sandIndices, [
            { x: x0, y, z: z0, u: 0, v: 0 },
            { x: x1, y, z: z0, u: 1, v: 0 },
            { x: x1, y, z: z1, u: 1, v: 1 },
            { x: x0, y, z: z1, u: 0, v: 1 }
          ]);

          addQuadTo(waterPositions, waterUvs, waterIndices, [
            { x: x0, y: seaSurfaceY, z: z0, u: 0, v: 0 },
            { x: x1, y: seaSurfaceY, z: z0, u: 1, v: 0 },
            { x: x1, y: seaSurfaceY, z: z1, u: 1, v: 1 },
            { x: x0, y: seaSurfaceY, z: z1, u: 0, v: 1 }
          ]);
        } else if (isBeachLand) {
          addQuadTo(sandPositions, sandUvs, sandIndices, [
            { x: x0, y, z: z0, u: 0, v: 0 },
            { x: x1, y, z: z0, u: 1, v: 0 },
            { x: x1, y, z: z1, u: 1, v: 1 },
            { x: x0, y, z: z1, u: 0, v: 1 }
          ]);
        } else {
          addQuadTo(grassPositions, grassUvs, grassIndices, [
            { x: x0, y, z: z0, u: 0, v: 0 },
            { x: x1, y, z: z0, u: 1, v: 0 },
            { x: x1, y, z: z1, u: 1, v: 1 },
            { x: x0, y, z: z1, u: 0, v: 1 }
          ]);
        }

        /*
          Side walls:
          - shoreline water behaves like a sand block up to sea level
          - interior water keeps seabed walls, preserving terrain visible through the water
        */
        const northInteriorWater = northHasWater && isWaterSample(northSample) && isWaterSample(getSample(globalX, globalZ - 2)) && isWaterSample(getSample(globalX - 1, globalZ - 1)) && isWaterSample(getSample(globalX + 1, globalZ - 1));
        const southInteriorWater = southHasWater && isWaterSample(southSample) && isWaterSample(getSample(globalX, globalZ + 2)) && isWaterSample(getSample(globalX - 1, globalZ + 1)) && isWaterSample(getSample(globalX + 1, globalZ + 1));
        const westInteriorWater = westHasWater && isWaterSample(westSample) && isWaterSample(getSample(globalX - 2, globalZ)) && isWaterSample(getSample(globalX - 1, globalZ - 1)) && isWaterSample(getSample(globalX - 1, globalZ + 1));
        const eastInteriorWater = eastHasWater && isWaterSample(eastSample) && isWaterSample(getSample(globalX + 2, globalZ)) && isWaterSample(getSample(globalX + 1, globalZ - 1)) && isWaterSample(getSample(globalX + 1, globalZ + 1));

        const northVisibleTop = northHasWater && !northInteriorWater ? seaSurfaceY : northY;
        const southVisibleTop = southHasWater && !southInteriorWater ? seaSurfaceY : southY;
        const westVisibleTop = westHasWater && !westInteriorWater ? seaSurfaceY : westY;
        const eastVisibleTop = eastHasWater && !eastInteriorWater ? seaSurfaceY : eastY;

        function addTileWall(sideX0, sideZ0, sideX1, sideZ1, wallBottom, wallTop, useSand) {
          if (wallTop <= wallBottom + 0.001) return;
          if (useSand) {
            addWallTo(sandPositions, sandUvs, sandIndices, sideX0, sideZ0, sideX1, sideZ1, wallBottom, wallTop);
          } else {
            addWallTo(dirtPositions, dirtUvs, dirtIndices, sideX0, sideZ0, sideX1, sideZ1, wallBottom, wallTop);
          }
        }

        if (isShorelineWater) {
          // shoreline block walls from surrounding visible top up to sea level
          addTileWall(x1, z0, x0, z0, northVisibleTop, seaSurfaceY, true);
          addTileWall(x0, z1, x1, z1, southVisibleTop, seaSurfaceY, true);
          addTileWall(x0, z0, x0, z1, westVisibleTop, seaSurfaceY, true);
          addTileWall(x1, z1, x1, z0, eastVisibleTop, seaSurfaceY, true);

          // if seabed inside shoreline block rises above neighboring ground, keep that cliff hidden by sand too
          addTileWall(x1, z0, x0, z0, northY, y, true);
          addTileWall(x0, z1, x1, z1, southY, y, true);
          addTileWall(x0, z0, x0, z1, westY, y, true);
          addTileWall(x1, z1, x1, z0, eastY, y, true);
        } else {
          function addCoastAwareWall(sideX0, sideZ0, sideX1, sideZ1, neighborY, neighborHasWater, neighborLevel) {
            if (y <= neighborY + 0.001) return;

            const coastal =
              isInteriorWater ||
              neighborHasWater ||
              isBeachLand ||
              level <= seaLevel + 2 ||
              neighborLevel <= seaLevel + 2;

            if (coastal) {
              addWallTo(sandPositions, sandUvs, sandIndices, sideX0, sideZ0, sideX1, sideZ1, neighborY, y);
            } else {
              addWallTo(dirtPositions, dirtUvs, dirtIndices, sideX0, sideZ0, sideX1, sideZ1, neighborY, y);
            }
          }

          addCoastAwareWall(x1, z0, x0, z0, northY, northHasWater, northSample.landLevel);
          addCoastAwareWall(x0, z1, x1, z1, southY, southHasWater, southSample.landLevel);
          addCoastAwareWall(x0, z0, x0, z1, westY, westHasWater, westSample.landLevel);
          addCoastAwareWall(x1, z1, x1, z0, eastY, eastHasWater, eastSample.landLevel);
        }

        const topVisualY = isInteriorWater ? seaSurfaceY : (isShorelineWater ? seaSurfaceY : y);
        const gy = topVisualY + 0.035;
        gridPositions.push(
          x0, gy, z0, x1, gy, z0,
          x1, gy, z0, x1, gy, z1,
          x1, gy, z1, x0, gy, z1,
          x0, gy, z1, x0, gy, z0
        );
      }
    }

    const grassGeometry = new THREE.BufferGeometry();
    grassGeometry.setAttribute("position", new THREE.Float32BufferAttribute(grassPositions, 3));
    grassGeometry.setAttribute("uv", new THREE.Float32BufferAttribute(grassUvs, 2));
    grassGeometry.setIndex(grassIndices);
    grassGeometry.computeVertexNormals();
    const grassMesh = new THREE.Mesh(grassGeometry, grassMaterial);
    group.add(grassMesh);

    if (sandPositions.length > 0) {
      const sandGeometry = new THREE.BufferGeometry();
      sandGeometry.setAttribute("position", new THREE.Float32BufferAttribute(sandPositions, 3));
      sandGeometry.setAttribute("uv", new THREE.Float32BufferAttribute(sandUvs, 2));
      sandGeometry.setIndex(sandIndices);
      sandGeometry.computeVertexNormals();
      const sandMesh = new THREE.Mesh(sandGeometry, sandMaterial);
      group.add(sandMesh);
    }

    if (dirtPositions.length > 0) {
      const dirtGeometry = new THREE.BufferGeometry();
      dirtGeometry.setAttribute("position", new THREE.Float32BufferAttribute(dirtPositions, 3));
      dirtGeometry.setAttribute("uv", new THREE.Float32BufferAttribute(dirtUvs, 2));
      dirtGeometry.setIndex(dirtIndices);
      dirtGeometry.computeVertexNormals();
      const dirtMesh = new THREE.Mesh(dirtGeometry, dirtMaterial);
      group.add(dirtMesh);
    }

    if (waterPositions.length > 0) {
      const waterGeometry = new THREE.BufferGeometry();
      waterGeometry.setAttribute("position", new THREE.Float32BufferAttribute(waterPositions, 3));
      waterGeometry.setAttribute("uv", new THREE.Float32BufferAttribute(waterUvs, 2));
      waterGeometry.setIndex(waterIndices);
      waterGeometry.computeVertexNormals();
      const waterMesh = new THREE.Mesh(waterGeometry, waterMaterial);
      group.add(waterMesh);

      /*
        Animated top water layer:
        duplicate the sea-level surface slightly above the base water plane so the top layer
        can shimmer and slide independently instead of sitting there like printed wrapping paper.
      */
      const waterSurfacePositions = waterPositions.slice();
      for (let i = 1; i < waterSurfacePositions.length; i += 3) {
        waterSurfacePositions[i] += 0.08;
      }

      const waterSurfaceGeometry = new THREE.BufferGeometry();
      waterSurfaceGeometry.setAttribute("position", new THREE.Float32BufferAttribute(waterSurfacePositions, 3));
      waterSurfaceGeometry.setAttribute("uv", new THREE.Float32BufferAttribute(waterUvs, 2));
      waterSurfaceGeometry.setIndex(waterIndices);
      waterSurfaceGeometry.computeVertexNormals();

      const waterSurfaceMesh = new THREE.Mesh(waterSurfaceGeometry, waterSurfaceMaterial);
      waterSurfaceMesh.renderOrder = 1;
      group.add(waterSurfaceMesh);
    }

    const gridGeometry = new THREE.BufferGeometry();
    gridGeometry.setAttribute("position", new THREE.Float32BufferAttribute(gridPositions, 3));
    const gridLines = new THREE.LineSegments(gridGeometry, gridMaterial);
    gridLines.visible = getShowGridLines();
    gridLineObjects.add(gridLines);
    group.add(gridLines);

    scene.add(group);
    loadedChunks.set(chunkKey, group);
  }

  function disposeChunk(group) {
    group.traverse((child) => {
      if (child.type === "LineSegments") {
        gridLineObjects.delete(child);
      }

      if (child.userData && child.userData.isTreeHitboxGrid) {
        treeHitboxGridObjects.delete(child);
        if (child.material) child.material.dispose();
      }

      if (child.userData && child.userData.isRubbleHitboxGrid) {
        rubbleHitboxGridObjects.delete(child);
        if (child.material) child.material.dispose();
      }

      if (child.userData && child.userData.isRubblePile && child.userData.rubbleKey) {
        rubbleObjects.delete(child.userData.rubbleKey);
      }

      if (child.userData && child.userData.isFlattenedTreeClickTarget) {
        flattenedTreeClickTargets.delete(child);
      }

      if (child.userData && child.userData.isPineTreeSprite) {
        treeSprites.delete(child);
        if (child.userData.treeColliderKey) {
          treeColliders.delete(child.userData.treeColliderKey);
        }
        if (child.material) child.material.dispose();
      }

      if (child.geometry) child.geometry.dispose();
    });

    scene.remove(group);
  }

  function queueDistantLodChunk(chunkX, chunkZ) {
    const key = getChunkKey(chunkX, chunkZ);
    if (loadedChunks.has(key) || distantLodChunks.has(key) || queuedLodChunkKeys.has(key)) return;

    queuedLodChunkKeys.add(key);
    lodBuildQueue.push({ x: chunkX, z: chunkZ, key });
  }

  function processDistantLodQueue() {
    let builds = 0;

    while (lodBuildQueue.length > 0 && builds < maxLodBuildsPerFrame) {
      const item = lodBuildQueue.shift();
      queuedLodChunkKeys.delete(item.key);

      if (!loadedChunks.has(item.key) && !distantLodChunks.has(item.key)) {
        buildDistantLodChunk(item.x, item.z);
        builds += 1;
      }
    }
  }

  function updateChunks() {
    const currentTileX = Math.floor(state.target.x / tileSize);
    const currentTileZ = Math.floor(state.target.z / tileSize);
    const centerChunkX = Math.floor(currentTileX / chunkTiles);
    const centerChunkZ = Math.floor(currentTileZ / chunkTiles);

    const neededDetailed = new Set();
    const neededExploredLod = new Set();

    for (let z = centerChunkZ - chunkRadius; z <= centerChunkZ + chunkRadius; z += 1) {
      for (let x = centerChunkX - chunkRadius; x <= centerChunkX + chunkRadius; x += 1) {
        const key = getChunkKey(x, z);
        neededDetailed.add(key);
        buildChunk(x, z);
      }
    }

    /*
      As the player explores, remember a wider ring as compressed distant terrain.
      This makes the world feel larger because old horizons do not instantly vanish
      the moment they leave the detailed render radius. Finally, terrain with object permanence.
    */
    for (let z = centerChunkZ - distantLodRadius; z <= centerChunkZ + distantLodRadius; z += 1) {
      for (let x = centerChunkX - distantLodRadius; x <= centerChunkX + distantLodRadius; x += 1) {
        const distance = getChunkDistance(x, z, centerChunkX, centerChunkZ);
        if (distance <= chunkRadius || distance > distantLodRadius) continue;

        const key = getChunkKey(x, z);
        neededExploredLod.add(key);

        if (!loadedChunks.has(key)) {
          queueDistantLodChunk(x, z);
        }
      }
    }

    for (const [key, group] of [...loadedChunks.entries()]) {
      if (!neededDetailed.has(key)) {
        const distance = getChunkDistance(group.userData.chunkX, group.userData.chunkZ, centerChunkX, centerChunkZ);

        if (distance <= distantLodRadius) {
          demoteDetailedChunkToLod(key, group);
        } else {
          disposeChunk(group);
          loadedChunks.delete(key);
        }
      }
    }

    /*
      Hide LOD chunks that are currently covered by detailed chunks, but keep old explored
      LOD chunks visible unless the budget is exceeded.
    */
    for (const [key, group] of distantLodChunks.entries()) {
      group.visible = !loadedChunks.has(key);
    }

    enforceDistantLodBudget(centerChunkX, centerChunkZ);

    chunkReadout.textContent = `Detailed chunks: ${loadedChunks.size}`;
    distantChunkReadout.textContent = `Distant LOD chunks: ${distantLodChunks.size} queued: ${lodBuildQueue.length}`;
  }

  return {
    hash2D,
    lerp,
    smoothNoise,
    fbm,
    ridgedNoise,
    plateauNoise,
    getTerrainSampleAtTile,
    getHeightLevelAtTile,
    getWaterLevelAtTile,
    getTerrainHeightAtWorld,
    getVisibleSurfaceHeightAtWorld,
    getRubbleSurfaceHeightAtWorld,
    getSolidSurfaceHeightAtWorld,
    getWaterSurfaceHeightAtWorld,
    isWaterAtWorld,
    tileToWorldX,
    tileToWorldZ,
    getChunkKey,
    getChunkDistance,
    buildDistantLodChunk,
    disposeDistantLodChunk,
    promoteDistantLodToDetailed,
    demoteDetailedChunkToLod,
    enforceDistantLodBudget,
    isTreeBaseTileEligible,
    isTreeClearanceTileEligible,
    hasTreeVisualClearance,
    getTreeNeighborhoodSupport,
    getTreeDensityAtTile,
    getNaturalTreeVariant,
    isLargeTreeAnchorAt,
    isCoveredByNeighborLargeTree,
    getTreeSampleAtTile,
    isRubbleFootprintFlat,
    getRubblePatchRoll,
    getRubbleScarcityMask,
    isRubbleCellAnchor,
    isLargeRubbleAnchorAt,
    isCoveredByNeighborLargeRubble,
    getRubbleSampleAtTile,
    findRubblePileAtWorld,
    advanceRubbleCrackStateAtWorld,
    advanceRubbleHoldCrackAtWorld,
    convertRubblePileAtWorldToLooseRagdoll,
    addRubblePile,
    addTreeSprite,
    updateTreeSpritesFacingCamera,
    buildChunk,
    disposeChunk,
    queueDistantLodChunk,
    processDistantLodQueue,
    updateChunks
  };
}
