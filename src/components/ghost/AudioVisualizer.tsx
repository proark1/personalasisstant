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
      hue: isSpeaking ? 270 : 187, // Purple for speaking, cyan for listening
    }));

    let time = 0;

    const animate = () => {
      const rect = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);

      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      time += 0.01;

      // Soft outer glow with fading edges - much larger and softer
      const outerGlow = ctx.createRadialGradient(
        centerX, centerY, 0,
        centerX, centerY, rect.width * 0.5
      );
      
      if (isSpeaking) {
        outerGlow.addColorStop(0, 'hsla(270, 80%, 60%, 0.15)');
        outerGlow.addColorStop(0.3, 'hsla(270, 80%, 55%, 0.08)');
        outerGlow.addColorStop(0.6, 'hsla(270, 80%, 50%, 0.03)');
        outerGlow.addColorStop(1, 'transparent');
      } else if (isListening) {
        outerGlow.addColorStop(0, 'hsla(187, 94%, 43%, 0.15)');
        outerGlow.addColorStop(0.3, 'hsla(187, 94%, 43%, 0.08)');
        outerGlow.addColorStop(0.6, 'hsla(187, 94%, 43%, 0.03)');
        outerGlow.addColorStop(1, 'transparent');
      } else {
        outerGlow.addColorStop(0, 'hsla(222, 47%, 35%, 0.1)');
        outerGlow.addColorStop(0.5, 'hsla(222, 47%, 30%, 0.03)');
        outerGlow.addColorStop(1, 'transparent');
      }

      ctx.fillStyle = outerGlow;
      ctx.fillRect(0, 0, rect.width, rect.height);

      // Soft core glow
      const coreGlow = ctx.createRadialGradient(
        centerX, centerY, 0,
        centerX, centerY, 60
      );
      
      if (isSpeaking) {
        coreGlow.addColorStop(0, 'hsla(270, 80%, 70%, 0.4)');
        coreGlow.addColorStop(0.5, 'hsla(270, 80%, 60%, 0.2)');
        coreGlow.addColorStop(1, 'transparent');
      } else if (isListening) {
        coreGlow.addColorStop(0, 'hsla(187, 94%, 55%, 0.4)');
        coreGlow.addColorStop(0.5, 'hsla(187, 94%, 45%, 0.2)');
        coreGlow.addColorStop(1, 'transparent');
      } else {
        coreGlow.addColorStop(0, 'hsla(222, 47%, 50%, 0.2)');
        coreGlow.addColorStop(0.5, 'hsla(222, 47%, 40%, 0.1)');
        coreGlow.addColorStop(1, 'transparent');
      }

      ctx.fillStyle = coreGlow;
      ctx.beginPath();
      ctx.arc(centerX, centerY, 60, 0, Math.PI * 2);
      ctx.fill();

      // Animate and draw particles
      particlesRef.current.forEach((particle, i) => {
        particle.angle += particle.speed * (isActive ? 1.5 : 0.5);

        // Add wave effect based on activity
        const waveIntensity = isActive ? 25 : 8;
        const wave = Math.sin(time * 3 + i * 0.1) * waveIntensity;
        const activityPulse = isActive 
          ? Math.sin(time * 5 + i * 0.05) * 12
          : 0;
        
        particle.radius = particle.baseRadius + wave + activityPulse;

        const x = centerX + Math.cos(particle.angle) * particle.radius;
        const y = centerY + Math.sin(particle.angle) * particle.radius;

        // Update hue based on state
        const targetHue = isSpeaking ? 270 : 187;
        particle.hue += (targetHue - particle.hue) * 0.05;

        // Soft particle glow instead of hard circles
        const particleGlow = ctx.createRadialGradient(
          x, y, 0,
          x, y, particle.size * 3
        );
        
        const alpha = isActive 
          ? particle.opacity * (0.7 + Math.sin(time * 4 + i) * 0.3)
          : particle.opacity * 0.4;
        
        particleGlow.addColorStop(0, `hsla(${particle.hue}, 80%, 65%, ${alpha})`);
        particleGlow.addColorStop(0.4, `hsla(${particle.hue}, 80%, 60%, ${alpha * 0.4})`);
        particleGlow.addColorStop(1, 'transparent');
        
        ctx.fillStyle = particleGlow;
        ctx.beginPath();
        ctx.arc(x, y, particle.size * 3, 0, Math.PI * 2);
        ctx.fill();

        // Draw connecting lines to nearby particles with fading
        if (isActive && i % 3 === 0) {
          const nextParticle = particlesRef.current[(i + 1) % particlesRef.current.length];
          const nextX = centerX + Math.cos(nextParticle.angle) * nextParticle.radius;
          const nextY = centerY + Math.sin(nextParticle.angle) * nextParticle.radius;

          const lineGradient = ctx.createLinearGradient(x, y, nextX, nextY);
          lineGradient.addColorStop(0, `hsla(${particle.hue}, 80%, 60%, ${alpha * 0.25})`);
          lineGradient.addColorStop(0.5, `hsla(${particle.hue}, 80%, 60%, ${alpha * 0.15})`);
          lineGradient.addColorStop(1, `hsla(${particle.hue}, 80%, 60%, ${alpha * 0.05})`);

          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(nextX, nextY);
          ctx.strokeStyle = lineGradient;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      });

      // Soft pulsing inner ring instead of hard stroke
      const ringRadius = 50 + Math.sin(time * 2) * 5;
      const ringGlow = ctx.createRadialGradient(
        centerX, centerY, ringRadius - 8,
        centerX, centerY, ringRadius + 8
      );
      
      if (isSpeaking) {
        ringGlow.addColorStop(0, 'transparent');
        ringGlow.addColorStop(0.4, 'hsla(270, 80%, 60%, 0.3)');
        ringGlow.addColorStop(0.6, 'hsla(270, 80%, 60%, 0.3)');
        ringGlow.addColorStop(1, 'transparent');
      } else if (isListening) {
        ringGlow.addColorStop(0, 'transparent');
        ringGlow.addColorStop(0.4, 'hsla(187, 94%, 43%, 0.3)');
        ringGlow.addColorStop(0.6, 'hsla(187, 94%, 43%, 0.3)');
        ringGlow.addColorStop(1, 'transparent');
      } else {
        ringGlow.addColorStop(0, 'transparent');
        ringGlow.addColorStop(0.4, 'hsla(222, 47%, 45%, 0.15)');
        ringGlow.addColorStop(0.6, 'hsla(222, 47%, 45%, 0.15)');
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
