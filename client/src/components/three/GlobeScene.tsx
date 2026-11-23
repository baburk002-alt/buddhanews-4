import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

const SAFFRON = 0xe9a23b;
const TEAL = 0x4fb3aa;
const INK = 0x0b1015;

function latLngToVector(lat: number, lng: number, radius: number) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

/**
 * A deliberately light Three.js scene: wireframe globe, particle field,
 * orbital rings and six city arcs. No post-processing, no external models.
 * Falls back to a CSS orb when WebGL is unavailable and renders a still frame
 * when the visitor prefers reduced motion.
 */
export function GlobeScene({ className }: { className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: "low-power",
      });
    } catch {
      setFailed(true);
      return;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.set(0, 0.15, 6.2);

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";
    container.appendChild(renderer.domElement);

    const group = new THREE.Group();
    group.rotation.x = 0.16;
    scene.add(group);

    const disposables: Array<{ dispose: () => void }> = [];

    const wireGeometry = new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(1.78, 4));
    const wireMaterial = new THREE.LineBasicMaterial({
      color: SAFFRON,
      transparent: true,
      opacity: 0.3,
    });
    const wire = new THREE.LineSegments(wireGeometry, wireMaterial);
    group.add(wire);
    disposables.push(wireGeometry, wireMaterial);

    const innerGeometry = new THREE.SphereGeometry(1.74, 48, 32);
    const innerMaterial = new THREE.MeshBasicMaterial({
      color: TEAL,
      transparent: true,
      opacity: 0.09,
    });
    const inner = new THREE.Mesh(innerGeometry, innerMaterial);
    group.add(inner);
    disposables.push(innerGeometry, innerMaterial);

    const particleCount = 620;
    const positions = new Float32Array(particleCount * 3);
    for (let index = 0; index < particleCount; index += 1) {
      const radius = 1.8 + Math.random() * 0.34;
      const phi = Math.acos(2 * Math.random() - 1);
      const theta = Math.random() * Math.PI * 2;
      positions[index * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[index * 3 + 1] = radius * Math.cos(phi);
      positions[index * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
    }
    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const particleMaterial = new THREE.PointsMaterial({
      color: TEAL,
      size: 0.018,
      transparent: true,
      opacity: 0.8,
      sizeAttenuation: true,
    });
    const particles = new THREE.Points(particleGeometry, particleMaterial);
    group.add(particles);
    disposables.push(particleGeometry, particleMaterial);

    const rings: Array<{ mesh: THREE.Mesh; speed: number }> = [];
    [
      { radius: 2.32, opacity: 0.5, tilt: 1.15, spin: 0.0009 },
      { radius: 2.62, opacity: 0.24, tilt: 1.42, spin: -0.0006 },
      { radius: 2.92, opacity: 0.14, tilt: 0.86, spin: 0.0004 },
    ].forEach(config => {
      const geometry = new THREE.TorusGeometry(config.radius, 0.0045, 8, 220);
      const material = new THREE.MeshBasicMaterial({
        color: SAFFRON,
        transparent: true,
        opacity: config.opacity,
      });
      const ring = new THREE.Mesh(geometry, material);
      ring.rotation.x = config.tilt;
      ring.rotation.z = 0.22;
      group.add(ring);
      rings.push({ mesh: ring, speed: config.spin });
      disposables.push(geometry, material);
    });

    const cities: Array<[number, number]> = [
      [34.53, 69.17],
      [35.69, 51.39],
      [38.56, 68.79],
      [41.3, 69.24],
      [28.61, 77.21],
      [24.86, 67.0],
      [31.55, 35.23],
      [25.2, 55.27],
    ];
    const hotspotGeometry = new THREE.SphereGeometry(0.028, 10, 10);
    const hotspotMaterial = new THREE.MeshBasicMaterial({ color: SAFFRON });
    const hotspotPositions = cities.map(([lat, lng]) => {
      const point = latLngToVector(lat, lng, 1.82);
      const dot = new THREE.Mesh(hotspotGeometry, hotspotMaterial);
      dot.position.copy(point);
      group.add(dot);
      return point;
    });
    disposables.push(hotspotGeometry, hotspotMaterial);

    for (let index = 0; index < hotspotPositions.length - 1; index += 1) {
      const start = hotspotPositions[index]!;
      const end = hotspotPositions[index + 1]!;
      const mid = start
        .clone()
        .add(end)
        .multiplyScalar(0.5)
        .normalize()
        .multiplyScalar(2.45);
      const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
      const arcGeometry = new THREE.BufferGeometry().setFromPoints(curve.getPoints(36));
      const arcMaterial = new THREE.LineBasicMaterial({
        color: SAFFRON,
        transparent: true,
        opacity: 0.28,
      });
      const arc = new THREE.Line(arcGeometry, arcMaterial);
      group.add(arc);
      disposables.push(arcGeometry, arcMaterial);
    }

    const ambient = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambient);

    let pointerX = 0;
    let pointerY = 0;
    const onPointerMove = (event: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      pointerX = (event.clientX - rect.left) / rect.width - 0.5;
      pointerY = (event.clientY - rect.top) / rect.height - 0.5;
    };
    container.addEventListener("pointermove", onPointerMove);

    const resize = () => {
      const width = container.clientWidth;
      const height = container.clientHeight;
      if (width === 0 || height === 0) return;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    let disposed = false;
    const clock = new THREE.Clock();

    const renderFrame = () => {
      group.rotation.y += 0.0016;
      group.rotation.x += (0.16 + pointerY * 0.22 - group.rotation.x) * 0.035;
      group.position.x += (pointerX * 0.18 - group.position.x) * 0.04;
      rings.forEach(ring => {
        ring.mesh.rotation.z += ring.speed;
      });
      renderer.render(scene, camera);
    };

    if (reduceMotion) {
      renderer.render(scene, camera);
    } else {
      const animate = () => {
        if (disposed) return;
        frame = requestAnimationFrame(animate);
        if (document.hidden) return;
        clock.getDelta();
        renderFrame();
      };
      animate();
    }

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      container.removeEventListener("pointermove", onPointerMove);
      disposables.forEach(item => item.dispose());
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  if (failed) {
    return (
      <div className={className} aria-hidden="true">
        <div className="relative flex h-full min-h-[320px] items-center justify-center">
          <div className="absolute h-[70%] w-[70%] rounded-full border border-brand/30" />
          <div className="absolute h-[86%] w-[86%] rounded-full border border-teal/30" />
          <div className="h-[55%] w-[55%] rounded-full bg-[radial-gradient(circle_at_35%_30%,rgba(79,179,170,0.55),rgba(233,162,59,0.18)_55%,transparent_70%)]" />
        </div>
      </div>
    );
  }

  return <div ref={containerRef} className={className} aria-hidden="true" />;
}
