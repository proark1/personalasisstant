import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

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
      radius: 120,
      baseRadius: 120,
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

      // Draw outer glow
      const gradient = ctx.createRadialGradient(
        centerX, centerY, 80,
        centerX, centerY, 200
      );
      
      if (isSpeaking) {
        gradient.addColorStop(0, 'hsla(270, 80%, 60%, 0.1)');
        gradient.addColorStop(0.5, 'hsla(270, 80%, 50%, 0.05)');
        gradient.addColorStop(1, 'transparent');
      } else if (isListening) {
        gradient.addColorStop(0, 'hsla(187, 94%, 43%, 0.15)');
        gradient.addColorStop(0.5, 'hsla(187, 94%, 43%, 0.05)');
        gradient.addColorStop(1, 'transparent');
      } else {
        gradient.addColorStop(0, 'hsla(222, 47%, 20%, 0.1)');
        gradient.addColorStop(1, 'transparent');
      }

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(centerX, centerY, 200, 0, Math.PI * 2);
      ctx.fill();

      // Draw core circle
      ctx.beginPath();
      ctx.arc(centerX, centerY, 40, 0, Math.PI * 2);
      ctx.fillStyle = isSpeaking 
        ? 'hsla(270, 80%, 60%, 0.3)' 
        : isListening 
          ? 'hsla(187, 94%, 43%, 0.3)'
          : 'hsla(222, 47%, 30%, 0.2)';
      ctx.fill();

      // Animate and draw particles
      particlesRef.current.forEach((particle, i) => {
        particle.angle += particle.speed * (isActive ? 1.5 : 0.5);

        // Add wave effect based on activity
        const waveIntensity = isActive ? 30 : 10;
        const wave = Math.sin(time * 3 + i * 0.1) * waveIntensity;
        const activityPulse = isActive 
          ? Math.sin(time * 5 + i * 0.05) * 15
          : 0;
        
        particle.radius = particle.baseRadius + wave + activityPulse;

        const x = centerX + Math.cos(particle.angle) * particle.radius;
        const y = centerY + Math.sin(particle.angle) * particle.radius;

        // Update hue based on state
        const targetHue = isSpeaking ? 270 : 187;
        particle.hue += (targetHue - particle.hue) * 0.05;

        ctx.beginPath();
        ctx.arc(x, y, particle.size, 0, Math.PI * 2);
        
        const alpha = isActive 
          ? particle.opacity * (0.7 + Math.sin(time * 4 + i) * 0.3)
          : particle.opacity * 0.4;
        
        ctx.fillStyle = `hsla(${particle.hue}, 80%, 60%, ${alpha})`;
        ctx.fill();

        // Draw connecting lines to nearby particles
        if (isActive && i % 3 === 0) {
          const nextParticle = particlesRef.current[(i + 1) % particlesRef.current.length];
          const nextX = centerX + Math.cos(nextParticle.angle) * nextParticle.radius;
          const nextY = centerY + Math.sin(nextParticle.angle) * nextParticle.radius;

          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(nextX, nextY);
          ctx.strokeStyle = `hsla(${particle.hue}, 80%, 60%, ${alpha * 0.3})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      });

      // Draw inner ring
      ctx.beginPath();
      ctx.arc(centerX, centerY, 60, 0, Math.PI * 2);
      ctx.strokeStyle = isSpeaking 
        ? 'hsla(270, 80%, 60%, 0.4)' 
        : isListening 
          ? 'hsla(187, 94%, 43%, 0.4)'
          : 'hsla(222, 47%, 40%, 0.2)';
      ctx.lineWidth = 2;
      ctx.stroke();

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
