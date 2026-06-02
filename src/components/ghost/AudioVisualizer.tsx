import { useEffect, useRef, useState } from 'react';

type BackgroundStyle = 'orbs' | 'matrix' | 'nebula' | 'aurora' | 'particles' | 'circuit';

interface AudioVisualizerProps {
  isActive: boolean;
  isSpeaking: boolean;
  isListening: boolean;
  style?: BackgroundStyle;
}

interface Orb {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  baseRadius: number;
  hue: number;
  phase: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  hue: number;
}

interface CircuitNode {
  x: number;
  y: number;
  connections: number[];
  pulse: number;
  active: boolean;
}

export function AudioVisualizer({ isActive, isSpeaking, isListening, style = 'orbs' }: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const orbsRef = useRef<Orb[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const circuitNodesRef = useRef<CircuitNode[]>([]);
  const [isDarkMode, setIsDarkMode] = useState(() => 
    document.documentElement.classList.contains('dark')
  );

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Initialize orbs
    orbsRef.current = Array.from({ length: 5 }, (_, i) => ({
      x: 0.5, y: 0.5,
      vx: (Math.random() - 0.5) * 0.002,
      vy: (Math.random() - 0.5) * 0.002,
      radius: 0.15 + Math.random() * 0.1,
      baseRadius: 0.15 + Math.random() * 0.1,
      hue: 180 + i * 20,
      phase: (i / 5) * Math.PI * 2,
    }));

    // Initialize particles for particle system
    particlesRef.current = [];

    // Initialize circuit nodes
    const nodeCount = 25;
    circuitNodesRef.current = Array.from({ length: nodeCount }, (_) => ({
      x: Math.random(),
      y: Math.random(),
      connections: [] as number[],
      pulse: Math.random() * Math.PI * 2,
      active: Math.random() > 0.5,
    }));
    // Create connections
    circuitNodesRef.current.forEach((node, i) => {
      const nearNodes = circuitNodesRef.current
        .map((n, j) => ({ dist: Math.hypot(n.x - node.x, n.y - node.y), idx: j }))
        .filter(n => n.idx !== i && n.dist < 0.3)
        .sort((a, b) => a.dist - b.dist)
        .slice(0, 3);
      node.connections = nearNodes.map(n => n.idx);
    });

    let time = 0;

    const animateOrbs = (width: number, height: number, centerX: number, centerY: number, minDim: number) => {
      const baseHue = isSpeaking ? 270 : isListening ? 187 : 220;
      const saturation = isDarkMode ? 70 : 80;
      const baseLightness = isDarkMode ? 50 : 40;
      const glowOpacity = isDarkMode ? 0.6 : 0.8;

      orbsRef.current.forEach((orb, i) => {
        orb.x += orb.vx + Math.sin(time + orb.phase) * 0.003;
        orb.y += orb.vy + Math.cos(time * 0.8 + orb.phase) * 0.003;
        orb.x += (0.5 - orb.x) * 0.01;
        orb.y += (0.5 - orb.y) * 0.01;

        const breathe = Math.sin(time * 2 + orb.phase) * 0.03;
        const activityPulse = isActive ? Math.sin(time * 4 + i) * 0.05 : 0;
        orb.radius = orb.baseRadius + breathe + activityPulse;

        const targetHue = isSpeaking ? 270 + i * 15 : 180 + i * 20;
        orb.hue += (targetHue - orb.hue) * 0.02;

        const orbX = orb.x * width;
        const orbY = orb.y * height;
        const orbRadius = orb.radius * minDim;

        for (let layer = 3; layer >= 0; layer--) {
          const layerRadius = orbRadius * (1 + layer * 0.5);
          const layerOpacity = glowOpacity * (0.4 - layer * 0.1);
          const gradient = ctx.createRadialGradient(orbX, orbY, 0, orbX, orbY, layerRadius);
          const lightness = baseLightness + layer * 5;
          gradient.addColorStop(0, `hsla(${orb.hue}, ${saturation}%, ${lightness + 20}%, ${layerOpacity})`);
          gradient.addColorStop(0.3, `hsla(${orb.hue}, ${saturation}%, ${lightness + 10}%, ${layerOpacity * 0.7})`);
          gradient.addColorStop(1, 'transparent');
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(orbX, orbY, layerRadius, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      const coreBreath = 1 + Math.sin(time * 1.5) * 0.2;
      const coreRadius = minDim * 0.08 * coreBreath;
      const coreGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, coreRadius * 2);
      coreGradient.addColorStop(0, `hsla(${baseHue}, 80%, 60%, 0.5)`);
      coreGradient.addColorStop(0.5, `hsla(${baseHue}, 70%, 50%, 0.2)`);
      coreGradient.addColorStop(1, 'transparent');
      ctx.fillStyle = coreGradient;
      ctx.beginPath();
      ctx.arc(centerX, centerY, coreRadius * 2, 0, Math.PI * 2);
      ctx.fill();
    };

    const animateMatrix = (width: number, height: number, centerX: number, centerY: number) => {
      const baseHue = isSpeaking ? 280 : isListening ? 160 : 200;
      const intensity = isActive ? 1 : 0.5;

      // Falling digital rain
      for (let i = 0; i < 80; i++) {
        const x = (Math.sin(i * 17.3 + time * 0.1) * 0.5 + 0.5) * width;
        const yOffset = (time * 50 + i * 20) % (height + 100);
        const length = 30 + Math.sin(i) * 20;
        
        const gradient = ctx.createLinearGradient(x, yOffset - length, x, yOffset);
        gradient.addColorStop(0, 'transparent');
        gradient.addColorStop(1, `hsla(${baseHue}, 80%, 60%, ${0.4 * intensity})`);
        
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, yOffset - length);
        ctx.lineTo(x, yOffset);
        ctx.stroke();
      }

      // Central pulse
      const pulseRadius = (Math.sin(time * 2) * 0.3 + 0.7) * Math.min(width, height) * 0.3;
      const pulseGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, pulseRadius);
      pulseGradient.addColorStop(0, `hsla(${baseHue}, 70%, 50%, ${0.3 * intensity})`);
      pulseGradient.addColorStop(0.7, `hsla(${baseHue}, 60%, 40%, ${0.1 * intensity})`);
      pulseGradient.addColorStop(1, 'transparent');
      ctx.fillStyle = pulseGradient;
      ctx.beginPath();
      ctx.arc(centerX, centerY, pulseRadius, 0, Math.PI * 2);
      ctx.fill();
    };

    const animateNebula = (width: number, height: number, centerX: number, centerY: number, minDim: number) => {
      const baseHue = isSpeaking ? 300 : isListening ? 200 : 260;
      const intensity = isActive ? 1.2 : 0.7;

      // Swirling clouds
      for (let i = 0; i < 6; i++) {
        const angle = time * 0.2 + (i * Math.PI * 2 / 6);
        const dist = minDim * 0.2 * (1 + Math.sin(time + i) * 0.3);
        const cx = centerX + Math.cos(angle) * dist;
        const cy = centerY + Math.sin(angle) * dist;
        const radius = minDim * 0.15 * (1 + Math.sin(time * 1.5 + i) * 0.2);

        const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
        gradient.addColorStop(0, `hsla(${baseHue + i * 30}, 70%, 60%, ${0.3 * intensity})`);
        gradient.addColorStop(0.5, `hsla(${baseHue + i * 30}, 60%, 50%, ${0.15 * intensity})`);
        gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fill();
      }

      // Stars
      for (let i = 0; i < 40; i++) {
        const sx = (Math.sin(i * 17.3) * 0.5 + 0.5) * width;
        const sy = (Math.cos(i * 23.7) * 0.5 + 0.5) * height;
        const twinkle = Math.sin(time * 3 + i * 2) * 0.5 + 0.5;
        ctx.fillStyle = `hsla(${baseHue + i * 5}, 50%, 80%, ${twinkle * 0.5 * intensity})`;
        ctx.beginPath();
        ctx.arc(sx, sy, twinkle * 2 + 1, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const animateAurora = (width: number, height: number, _centerX: number, _centerY: number) => {
      const baseHue = isSpeaking ? 280 : isListening ? 120 : 180;
      const intensity = isActive ? 1 : 0.6;

      // Aurora waves
      for (let wave = 0; wave < 5; wave++) {
        ctx.beginPath();
        const waveY = height * 0.3 + wave * 30;
        
        for (let x = 0; x <= width; x += 5) {
          const y = waveY + Math.sin(x * 0.01 + time * 2 + wave) * 50 * intensity
                   + Math.sin(x * 0.02 + time * 3) * 30;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        
        const gradient = ctx.createLinearGradient(0, waveY - 100, 0, waveY + 100);
        gradient.addColorStop(0, 'transparent');
        gradient.addColorStop(0.3, `hsla(${baseHue + wave * 20}, 80%, 60%, ${0.15 * intensity})`);
        gradient.addColorStop(0.5, `hsla(${baseHue + wave * 20 + 30}, 70%, 50%, ${0.25 * intensity})`);
        gradient.addColorStop(0.7, `hsla(${baseHue + wave * 20}, 80%, 60%, ${0.15 * intensity})`);
        gradient.addColorStop(1, 'transparent');
        
        ctx.lineTo(width, height);
        ctx.lineTo(0, height);
        ctx.closePath();
        ctx.fillStyle = gradient;
        ctx.fill();
      }

      // Shimmering particles
      for (let i = 0; i < 30; i++) {
        const px = (Math.sin(i * 7.3 + time * 0.5) * 0.5 + 0.5) * width;
        const py = (Math.cos(i * 11.7 + time * 0.3) * 0.3 + 0.35) * height;
        const shimmer = Math.sin(time * 5 + i) * 0.5 + 0.5;
        ctx.fillStyle = `hsla(${baseHue + i * 10}, 90%, 80%, ${shimmer * 0.6 * intensity})`;
        ctx.beginPath();
        ctx.arc(px, py, shimmer * 3 + 1, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const animateParticles = (width: number, height: number, centerX: number, centerY: number) => {
      const baseHue = isSpeaking ? 30 : isListening ? 200 : 280;
      const intensity = isActive ? 1.5 : 0.8;

      // Spawn new particles
      if (particlesRef.current.length < 150) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1 + Math.random() * 2;
        particlesRef.current.push({
          x: centerX / width,
          y: centerY / height,
          vx: Math.cos(angle) * speed * 0.003,
          vy: Math.sin(angle) * speed * 0.003,
          life: 0,
          maxLife: 100 + Math.random() * 100,
          size: 2 + Math.random() * 4,
          hue: baseHue + Math.random() * 60 - 30,
        });
      }

      // Update and draw particles
      particlesRef.current = particlesRef.current.filter(p => {
        p.x += p.vx * intensity;
        p.y += p.vy * intensity;
        p.life++;

        if (p.life >= p.maxLife) return false;
        if (p.x < -0.1 || p.x > 1.1 || p.y < -0.1 || p.y > 1.1) return false;

        const progress = p.life / p.maxLife;
        const alpha = Math.sin(progress * Math.PI) * 0.8;
        const size = p.size * (1 - progress * 0.5);

        const gradient = ctx.createRadialGradient(
          p.x * width, p.y * height, 0,
          p.x * width, p.y * height, size * 3
        );
        gradient.addColorStop(0, `hsla(${p.hue}, 90%, 70%, ${alpha})`);
        gradient.addColorStop(0.5, `hsla(${p.hue + 20}, 80%, 50%, ${alpha * 0.5})`);
        gradient.addColorStop(1, 'transparent');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(p.x * width, p.y * height, size * 3, 0, Math.PI * 2);
        ctx.fill();

        return true;
      });

      // Central glow
      const coreGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 80);
      coreGradient.addColorStop(0, `hsla(${baseHue}, 90%, 60%, ${0.4 * intensity})`);
      coreGradient.addColorStop(0.5, `hsla(${baseHue + 30}, 80%, 50%, ${0.2 * intensity})`);
      coreGradient.addColorStop(1, 'transparent');
      ctx.fillStyle = coreGradient;
      ctx.beginPath();
      ctx.arc(centerX, centerY, 80, 0, Math.PI * 2);
      ctx.fill();
    };

    const animateCircuit = (width: number, height: number, _centerX: number, _centerY: number) => {
      const baseHue = isSpeaking ? 180 : isListening ? 140 : 200;
      const intensity = isActive ? 1 : 0.5;

      // Update node activity
      circuitNodesRef.current.forEach((node) => {
        node.pulse += 0.05;
        if (Math.random() < 0.01) node.active = !node.active;
      });

      // Draw connections
      circuitNodesRef.current.forEach((node, i) => {
        const x1 = node.x * width;
        const y1 = node.y * height;
        
        node.connections.forEach(connIdx => {
          const other = circuitNodesRef.current[connIdx];
          const x2 = other.x * width;
          const y2 = other.y * height;
          
          const pulse = Math.sin(time * 3 + i * 0.5);
          const alpha = (node.active || other.active) ? 0.4 + pulse * 0.2 : 0.1;
          
          const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
          gradient.addColorStop(0, `hsla(${baseHue}, 70%, 50%, ${alpha * intensity})`);
          gradient.addColorStop(0.5, `hsla(${baseHue + 30}, 80%, 60%, ${(alpha + 0.2) * intensity})`);
          gradient.addColorStop(1, `hsla(${baseHue}, 70%, 50%, ${alpha * intensity})`);
          
          ctx.strokeStyle = gradient;
          ctx.lineWidth = node.active ? 2 : 1;
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();

          // Data packet animation
          if (node.active) {
            const packetPos = (Math.sin(time * 4 + i) * 0.5 + 0.5);
            const px = x1 + (x2 - x1) * packetPos;
            const py = y1 + (y2 - y1) * packetPos;
            
            ctx.fillStyle = `hsla(${baseHue + 60}, 90%, 70%, ${0.8 * intensity})`;
            ctx.beginPath();
            ctx.arc(px, py, 4, 0, Math.PI * 2);
            ctx.fill();
          }
        });
      });

      // Draw nodes
      circuitNodesRef.current.forEach((node) => {
        const x = node.x * width;
        const y = node.y * height;
        const size = node.active ? 8 : 5;
        const pulse = Math.sin(node.pulse) * 0.3 + 0.7;
        
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, size * 2);
        gradient.addColorStop(0, `hsla(${baseHue}, 80%, 70%, ${pulse * intensity})`);
        gradient.addColorStop(0.5, `hsla(${baseHue}, 70%, 50%, ${pulse * 0.5 * intensity})`);
        gradient.addColorStop(1, 'transparent');
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, size * 2, 0, Math.PI * 2);
        ctx.fill();

        // Hexagon shape for active nodes
        if (node.active) {
          ctx.strokeStyle = `hsla(${baseHue + 30}, 90%, 60%, ${0.8 * intensity})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          for (let j = 0; j < 6; j++) {
            const angle = (j * Math.PI / 3) + time * 0.5;
            const hx = x + Math.cos(angle) * size;
            const hy = y + Math.sin(angle) * size;
            if (j === 0) ctx.moveTo(hx, hy);
            else ctx.lineTo(hx, hy);
          }
          ctx.closePath();
          ctx.stroke();
        }
      });
    };

    const animate = () => {
      const rect = canvas.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;
      const centerX = width / 2;
      const centerY = height / 2;
      const minDim = Math.min(width, height);

      ctx.clearRect(0, 0, width, height);
      time += 0.016;

      switch (style) {
        case 'matrix':
          animateMatrix(width, height, centerX, centerY);
          break;
        case 'nebula':
          animateNebula(width, height, centerX, centerY, minDim);
          break;
        case 'aurora':
          animateAurora(width, height, centerX, centerY);
          break;
        case 'particles':
          animateParticles(width, height, centerX, centerY);
          break;
        case 'circuit':
          animateCircuit(width, height, centerX, centerY);
          break;
        case 'orbs':
        default:
          animateOrbs(width, height, centerX, centerY, minDim);
          break;
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isActive, isSpeaking, isListening, isDarkMode, style]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
      style={{ width: '100%', height: '100%' }}
    />
  );
}