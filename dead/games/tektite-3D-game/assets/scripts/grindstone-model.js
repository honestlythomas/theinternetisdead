// Dimensions are in game world units: one terrain tile is four units.
let modelTextures = null;

export function createGrindstoneModel(THREE, tileSize = 4, { ghost = false } = {}) {
  const unit = tileSize / 4;
  const group = new THREE.Group();
  group.name = ghost ? "grindstone-preview" : "placed-grindstone";

  if (!modelTextures) {
    const loader = new THREE.TextureLoader();
    const wood = loader.load("assets/png/tv-wood.png");
    const stone = loader.load("assets/png/cobblestone.png");
    for (const texture of [wood, stone]) {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    }
    wood.repeat.set(1.2, 1.2);
    stone.repeat.set(1.5, 1.5);
    modelTextures = { wood, stone };
  }
  const { wood, stone } = modelTextures;

  const material = (map, color = 0xffffff) => new THREE.MeshStandardMaterial({
    map,
    color,
    roughness: 0.9,
    transparent: ghost,
    opacity: ghost ? 0.55 : 1,
    depthWrite: !ghost,
    side: THREE.DoubleSide
  });
  const woodMaterial = material(wood, 0xe6c69c);
  const stoneMaterial = material(stone, 0xd1d1cc);
  const ironMaterial = material(null, 0x50545a);

  function box(width, height, depth, x, y, z, mat = woodMaterial) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width * unit, height * unit, depth * unit), mat);
    mesh.position.set(x * unit, y * unit, z * unit);
    mesh.castShadow = !ghost;
    mesh.receiveShadow = !ghost;
    group.add(mesh);
    return mesh;
  }

  // The base is 7.6 × 7.6 world units: just inside two 4-unit tiles.
  for (const x of [-3.15, 3.15]) box(1.25, 0.55, 7.6, x, 0.275, 0);
  for (const z of [-2.9, 2.9]) box(7.6, 0.5, 0.9, 0, 0.55, z);
  for (const x of [-1.65, 1.65]) {
    box(0.85, 2.9, 1, x, 1.75, 0);
    box(2.1, 0.5, 1.3, x, 0.78, 0);
  }

  // Thick upright stone wheel, with its rotation axis running left to right.
  const wheel = new THREE.Mesh(new THREE.CylinderGeometry(2.45 * unit, 2.45 * unit, 1.35 * unit, 16), stoneMaterial);
  wheel.rotation.z = Math.PI / 2;
  wheel.position.y = 3.05 * unit;
  wheel.castShadow = !ghost;
  wheel.receiveShadow = !ghost;
  group.add(wheel);

  const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.19 * unit, 0.19 * unit, 4.8 * unit, 10), ironMaterial);
  axle.rotation.z = Math.PI / 2;
  axle.position.y = 3.05 * unit;
  group.add(axle);
  box(0.3, 0.26, 0.26, 2.55, 3.05, 0, ironMaterial);
  box(0.26, 0.95, 0.26, 2.68, 2.65, 0, ironMaterial);
  box(0.28, 0.3, 0.9, 2.68, 2.23, 0.37, woodMaterial);

  group.userData.footprintTiles = 2;
  group.userData.heightWorld = 5.5 * unit;
  return group;
}
