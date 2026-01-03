import { useEffect, useRef, useState } from 'react';

interface AudioVisualizerProps {
  isActive: boolean;
  isSpeaking: boolean;
  isListening: boolean;
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

export function AudioVisualizer({ isActive, isSpeaking, isListening }: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const orbsRef = useRef<Orb[]>([]);
  const [isDarkMode, setIsDarkMode] = useState(() => 
    document.documentElement.classList.contains('dark')
  );

  // Watch for theme changes
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

    // Initialize floating orbs
    const orbCount = 5;
    orbsRef.current = Array.from({ length: orbCount }, (_, i) => ({
      x: 0.5,
      y: 0.5,
      vx: (Math.random() - 0.5) * 0.002,
      vy: (Math.random() - 0.5) * 0.002,
      radius: 0.15 + Math.random() * 0.1,
      baseRadius: 0.15 + Math.random() * 0.1,
      hue: isSpeaking ? 270 + i * 15 : 180 + i * 20,
      phase: (i / orbCount) * Math.PI * 2,
    }));

    let time = 0;

    const animate = () => {
      const rect = canvas.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;
      const centerX = width / 2;
      const centerY = height / 2;
      const minDim = Math.min(width, height);

      ctx.clearRect(0, 0, width, height);
      time += 0.004;

      // Theme colors
      const baseHue = isSpeaking ? 270 : isListening ? 187 : 220;
      const saturation = isDarkMode ? 70 : 80;
      const baseLightness = isDarkMode ? 50 : 40;
      const glowOpacity = isDarkMode ? 0.6 : 0.8;

      // Update and draw orbs with metaball-like blending
      orbsRef.current.forEach((orb, i) => {
        // Organic movement
        orb.x += orb.vx + Math.sin(time + orb.phase) * 0.003;
        orb.y += orb.vy + Math.cos(time * 0.8 + orb.phase) * 0.003;

        // Soft boundary attraction to center
        orb.x += (0.5 - orb.x) * 0.01;
        orb.y += (0.5 - orb.y) * 0.01;

        // Breathing effect
        const breathe = Math.sin(time * 2 + orb.phase) * 0.03;
        const activityPulse = isActive ? Math.sin(time * 4 + i) * 0.05 : 0;
        orb.radius = orb.baseRadius + breathe + activityPulse;

        // Smooth color transition
        const targetHue = isSpeaking ? 270 + i * 15 : 180 + i * 20;
        orb.hue += (targetHue - orb.hue) * 0.02;

        const orbX = orb.x * width;
        const orbY = orb.y * height;
        const orbRadius = orb.radius * minDim;

        // Multi-layer gradient for soft, glowing effect
        for (let layer = 3; layer >= 0; layer--) {
          const layerRadius = orbRadius * (1 + layer * 0.5);
          const layerOpacity = glowOpacity * (0.4 - layer * 0.1);

          const gradient = ctx.createRadialGradient(
            orbX, orbY, 0,
            orbX, orbY, layerRadius
          );

          const lightness = baseLightness + layer * 5;
          gradient.addColorStop(0, `hsla(${orb.hue}, ${saturation}%, ${lightness + 20}%, ${layerOpacity})`);
          gradient.addColorStop(0.3, `hsla(${orb.hue}, ${saturation}%, ${lightness + 10}%, ${layerOpacity * 0.7})`);
          gradient.addColorStop(0.6, `hsla(${orb.hue}, ${saturation - 10}%, ${lightness}%, ${layerOpacity * 0.3})`);
          gradient.addColorStop(1, 'transparent');

          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(orbX, orbY, layerRadius, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      // Central energy core
      const coreBreath = 1 + Math.sin(time * 1.5) * 0.2;
      const coreRadius = minDim * 0.08 * coreBreath;

      for (let layer = 4; layer >= 0; layer--) {
        const layerRadius = coreRadius * (1 + layer * 0.8);
        const layerOpacity = (isActive ? 0.5 : 0.3) * (0.5 - layer * 0.1);

        const coreGradient = ctx.createRadialGradient(
          centerX, centerY, 0,
          centerX, centerY, layerRadius
        );

        const coreLightness = baseLightness + 20 - layer * 3;
        coreGradient.addColorStop(0, `hsla(${baseHue}, ${saturation + 10}%, ${coreLightness + 15}%, ${layerOpacity * glowOpacity})`);
        coreGradient.addColorStop(0.4, `hsla(${baseHue}, ${saturation}%, ${coreLightness + 5}%, ${layerOpacity * 0.6 * glowOpacity})`);
        coreGradient.addColorStop(0.7, `hsla(${baseHue}, ${saturation - 10}%, ${coreLightness}%, ${layerOpacity * 0.3 * glowOpacity})`);
        coreGradient.addColorStop(1, 'transparent');

        ctx.fillStyle = coreGradient;
        ctx.beginPath();
        ctx.arc(centerX, centerY, layerRadius, 0, Math.PI * 2);
        ctx.fill();
      }

      // Floating particles
      const particleCount = isActive ? 30 : 15;
      for (let i = 0; i < particleCount; i++) {
        const angle = (i / particleCount) * Math.PI * 2 + time * 0.3;
        const dist = minDim * (0.15 + Math.sin(time * 2 + i * 0.5) * 0.08);
        const px = centerX + Math.cos(angle) * dist;
        const py = centerY + Math.sin(angle) * dist;
        const size = 2 + Math.sin(time * 3 + i) * 1.5;

        const particleGradient = ctx.createRadialGradient(px, py, 0, px, py, size * 3);
        const particleOpacity = (0.4 + Math.sin(time * 4 + i * 0.3) * 0.2) * glowOpacity;
        
        particleGradient.addColorStop(0, `hsla(${baseHue + i * 3}, ${saturation}%, ${baseLightness + 20}%, ${particleOpacity})`);
        particleGradient.addColorStop(0.5, `hsla(${baseHue + i * 3}, ${saturation}%, ${baseLightness + 10}%, ${particleOpacity * 0.4})`);
        particleGradient.addColorStop(1, 'transparent');

        ctx.fillStyle = particleGradient;
        ctx.beginPath();
        ctx.arc(px, py, size * 3, 0, Math.PI * 2);
        ctx.fill();
      }

      // Ambient outer glow
      const ambientGradient = ctx.createRadialGradient(
        centerX, centerY, minDim * 0.1,
        centerX, centerY, minDim * 0.5
      );
      
      const ambientOpacity = (isActive ? 0.15 : 0.08) * glowOpacity;
      ambientGradient.addColorStop(0, `hsla(${baseHue}, ${saturation - 20}%, ${baseLightness + 10}%, ${ambientOpacity})`);
      ambientGradient.addColorStop(0.5, `hsla(${baseHue}, ${saturation - 30}%, ${baseLightness}%, ${ambientOpacity * 0.4})`);
      ambientGradient.addColorStop(1, 'transparent');

      ctx.fillStyle = ambientGradient;
      ctx.fillRect(0, 0, width, height);

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isActive, isSpeaking, isListening, isDarkMode]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
      style={{ width: '100%', height: '100%' }}
    />
  );
}