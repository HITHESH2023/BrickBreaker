import * as THREE from 'three';

// Scene setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  75, window.innerWidth / window.innerHeight, 0.1, 1000
);
const renderer = new THREE.WebGLRenderer({
  canvas: document.querySelector('#bg-canvas'),
  antialias: true,
});

renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
camera.position.setZ(50);

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xa5b4fc, 0.8);
directionalLight.position.set(5, 15, 10);
scene.add(directionalLight);

// Cubes
const cubeGroup = new THREE.Group();
const cubeGeometry = new THREE.BoxGeometry(1.5, 1.5, 1.5);

for (let i = 0; i < 200; i++) {
  const materialColor = new THREE.Color(0xffffff);
  materialColor.setHSL(Math.random(), 0.7, 0.6);

  const cubeMaterial = new THREE.MeshStandardMaterial({
    color: materialColor,
    roughness: 0.5,
    metalness: 0.1
  });

  const cube = new THREE.Mesh(cubeGeometry, cubeMaterial);

  // Spread cubes in volume
  const [x, y, z] = Array(3).fill().map(() => THREE.MathUtils.randFloatSpread(150));
  cube.position.set(x, y, z);

  // Random rotation speeds
  cube.userData.rotationSpeed = {
    x: (Math.random() - 0.5) * 0.01,
    y: (Math.random() - 0.5) * 0.01
  };

  cubeGroup.add(cube);
}
scene.add(cubeGroup);

// Resize handler
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Animation loop
function animate() {
  requestAnimationFrame(animate);

  cubeGroup.children.forEach(cube => {
    cube.rotation.x += cube.userData.rotationSpeed.x;
    cube.rotation.y += cube.userData.rotationSpeed.y;

    // Slow drift forward
    cube.position.z += 0.05;

    // Recycle cubes that pass the camera
    if (cube.position.z > 60) {
      cube.position.z = -90;
      cube.position.x = THREE.MathUtils.randFloatSpread(150);
      cube.position.y = THREE.MathUtils.randFloatSpread(150);
    }
  });

  renderer.render(scene, camera);
}

animate();