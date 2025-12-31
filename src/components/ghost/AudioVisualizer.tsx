import { useEffect, useRef } from 'react';

interface AudioVisualizerProps {
  isActive: boolean;
  isSpeaking: boolean;
  isListening: boolean;
}

export function AudioVisualizer({ isActive, isSpeaking, isListening }: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const particlesRef = useRef<Particle[]>([]);

  interface Particle {
    angle: number;
    radius: number;
    baseRadius: number;
    speed: number;
    size: number;
    opacity: number;
    hue: number;
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Detect if dark mode
    const isDarkMode = document.documentElement.classList.contains('dark');

    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Initialize particles
    const particleCount = 120;
    particlesRef.current = Array.from({ length: particleCount }, (_, i) => ({
      angle: (i / particleCount) * Math.PI * 2,
      radius: 100,
      baseRadius: 100,
      speed: 0.002 + Math.random() * 0.003,
      size: 2 + Math.random() * 3,
      opacity: 0.5 + Math.random() * 0.5,
      hue: isSpeaking ? 270 : 187,
    }));

    let time = 0;

    const animate = () => {
      const rect = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);

      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      time += 0.01;

      // Light mode uses higher opacity and saturation for vibrancy
      const glowMultiplier = isDarkMode ? 1 : 1.8;
      const saturation = isDarkMode ? 80 : 95;
      const lightness = isDarkMode ? 60 : 50;

      // Soft outer glow with fading edges
      const outerGlow = ctx.createRadialGradient(
        centerX, centerY, 0,
        centerX, centerY, rect.width * 0.5
      );
      
      if (isSpeaking) {
        outerGlow.addColorStop(0, `hsla(270, ${saturation}%, ${lightness}%, ${0.2 * glowMultiplier})`);
        outerGlow.addColorStop(0.3, `hsla(270, ${saturation}%, ${lightness - 5}%, ${0.12 * glowMultiplier})`);
        outerGlow.addColorStop(0.6, `hsla(270, ${saturation}%, ${lightness - 10}%, ${0.05 * glowMultiplier})`);
        outerGlow.addColorStop(1, 'transparent');
      } else if (isListening) {
        outerGlow.addColorStop(0, `hsla(187, ${saturation}%, ${lightness - 10}%, ${0.2 * glowMultiplier})`);
        outerGlow.addColorStop(0.3, `hsla(187, ${saturation}%, ${lightness - 15}%, ${0.12 * glowMultiplier})`);
        outerGlow.addColorStop(0.6, `hsla(187, ${saturation}%, ${lightness - 20}%, ${0.05 * glowMultiplier})`);
        outerGlow.addColorStop(1, 'transparent');
      } else {
        outerGlow.addColorStop(0, `hsla(222, 60%, ${lightness - 10}%, ${0.15 * glowMultiplier})`);
        outerGlow.addColorStop(0.5, `hsla(222, 60%, ${lightness - 20}%, ${0.05 * glowMultiplier})`);
        outerGlow.addColorStop(1, 'transparent');
      }

      ctx.fillStyle = outerGlow;
      ctx.fillRect(0, 0, rect.width, rect.height);

      // Soft core glow - more vibrant
      const coreGlow = ctx.createRadialGradient(
        centerX, centerY, 0,
        centerX, centerY, 60
      );
      
      if (isSpeaking) {
        coreGlow.addColorStop(0, `hsla(270, ${saturation}%, ${lightness + 10}%, ${0.5 * glowMultiplier})`);
        coreGlow.addColorStop(0.5, `hsla(270, ${saturation}%, ${lightness}%, ${0.25 * glowMultiplier})`);
        coreGlow.addColorStop(1, 'transparent');
      } else if (isListening) {
        coreGlow.addColorStop(0, `hsla(187, ${saturation}%, ${lightness}%, ${0.5 * glowMultiplier})`);
        coreGlow.addColorStop(0.5, `hsla(187, ${saturation}%, ${lightness - 10}%, ${0.25 * glowMultiplier})`);
        coreGlow.addColorStop(1, 'transparent');
      } else {
        coreGlow.addColorStop(0, `hsla(222, 60%, ${lightness}%, ${0.3 * glowMultiplier})`);
        coreGlow.addColorStop(0.5, `hsla(222, 60%, ${lightness - 10}%, ${0.15 * glowMultiplier})`);
        coreGlow.addColorStop(1, 'transparent');
      }

      ctx.fillStyle = coreGlow;
      ctx.beginPath();
      ctx.arc(centerX, centerY, 60, 0, Math.PI * 2);
      ctx.fill();

      // Animate and draw particles
      particlesRef.current.forEach((particle, i) => {
        particle.angle += particle.speed * (isActive ? 1.5 : 0.5);

        const waveIntensity = isActive ? 25 : 8;
        const wave = Math.sin(time * 3 + i * 0.1) * waveIntensity;
        const activityPulse = isActive 
          ? Math.sin(time * 5 + i * 0.05) * 12
          : 0;
        
        particle.radius = particle.baseRadius + wave + activityPulse;

        const x = centerX + Math.cos(particle.angle) * particle.radius;
        const y = centerY + Math.sin(particle.angle) * particle.radius;

        const targetHue = isSpeaking ? 270 : 187;
        particle.hue += (targetHue - particle.hue) * 0.05;

        const particleGlow = ctx.createRadialGradient(
          x, y, 0,
          x, y, particle.size * 3
        );
        
        const baseAlpha = isActive 
          ? particle.opacity * (0.7 + Math.sin(time * 4 + i) * 0.3)
          : particle.opacity * 0.4;
        const alpha = baseAlpha * glowMultiplier;
        
        const particleLightness = isDarkMode ? 65 : 45;
        particleGlow.addColorStop(0, `hsla(${particle.hue}, ${saturation}%, ${particleLightness}%, ${Math.min(alpha, 1)})`);
        particleGlow.addColorStop(0.4, `hsla(${particle.hue}, ${saturation}%, ${particleLightness - 5}%, ${Math.min(alpha * 0.5, 1)})`);
        particleGlow.addColorStop(1, 'transparent');
        
        ctx.fillStyle = particleGlow;
        ctx.beginPath();
        ctx.arc(x, y, particle.size * 3, 0, Math.PI * 2);
        ctx.fill();

        // Draw connecting lines
        if (isActive && i % 3 === 0) {
          const nextParticle = particlesRef.current[(i + 1) % particlesRef.current.length];
          const nextX = centerX + Math.cos(nextParticle.angle) * nextParticle.radius;
          const nextY = centerY + Math.sin(nextParticle.angle) * nextParticle.radius;

          const lineAlpha = alpha * (isDarkMode ? 0.25 : 0.4);
          const lineGradient = ctx.createLinearGradient(x, y, nextX, nextY);
          lineGradient.addColorStop(0, `hsla(${particle.hue}, ${saturation}%, ${particleLightness}%, ${lineAlpha})`);
          lineGradient.addColorStop(0.5, `hsla(${particle.hue}, ${saturation}%, ${particleLightness}%, ${lineAlpha * 0.6})`);
          lineGradient.addColorStop(1, `hsla(${particle.hue}, ${saturation}%, ${particleLightness}%, ${lineAlpha * 0.2})`);

          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(nextX, nextY);
          ctx.strokeStyle = lineGradient;
          ctx.lineWidth = isDarkMode ? 1 : 1.5;
          ctx.stroke();
        }
      });

      // Soft pulsing inner ring
      const ringRadius = 50 + Math.sin(time * 2) * 5;
      const ringGlow = ctx.createRadialGradient(
        centerX, centerY, ringRadius - 8,
        centerX, centerY, ringRadius + 8
      );
      
      const ringOpacity = isDarkMode ? 0.3 : 0.5;
      if (isSpeaking) {
        ringGlow.addColorStop(0, 'transparent');
        ringGlow.addColorStop(0.4, `hsla(270, ${saturation}%, ${lightness}%, ${ringOpacity})`);
        ringGlow.addColorStop(0.6, `hsla(270, ${saturation}%, ${lightness}%, ${ringOpacity})`);
        ringGlow.addColorStop(1, 'transparent');
      } else if (isListening) {
        ringGlow.addColorStop(0, 'transparent');
        ringGlow.addColorStop(0.4, `hsla(187, ${saturation}%, ${lightness - 10}%, ${ringOpacity})`);
        ringGlow.addColorStop(0.6, `hsla(187, ${saturation}%, ${lightness - 10}%, ${ringOpacity})`);
        ringGlow.addColorStop(1, 'transparent');
      } else {
        ringGlow.addColorStop(0, 'transparent');
        ringGlow.addColorStop(0.4, `hsla(222, 60%, ${lightness - 5}%, ${ringOpacity * 0.5})`);
        ringGlow.addColorStop(0.6, `hsla(222, 60%, ${lightness - 5}%, ${ringOpacity * 0.5})`);
        ringGlow.addColorStop(1, 'transparent');
      }

      ctx.fillStyle = ringGlow;
      ctx.beginPath();
      ctx.arc(centerX, centerY, ringRadius + 8, 0, Math.PI * 2);
      ctx.arc(centerX, centerY, ringRadius - 8, 0, Math.PI * 2);
      ctx.fill('evenodd');

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isActive, isSpeaking, isListening]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
      style={{ width: '100%', height: '100%' }}
    />
  );
}
