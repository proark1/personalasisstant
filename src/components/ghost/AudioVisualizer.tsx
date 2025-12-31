import { useEffect, useRef, useState } from 'react';

interface AudioVisualizerProps {
  isActive: boolean;
  isSpeaking: boolean;
  isListening: boolean;
}

export function AudioVisualizer({ isActive, isSpeaking, isListening }: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const particlesRef = useRef<Particle[]>([]);
  const [isDarkMode, setIsDarkMode] = useState(() => 
    document.documentElement.classList.contains('dark')
  );

  interface Particle {
    angle: number;
    radius: number;
    baseRadius: number;
    speed: number;
    size: number;
    opacity: number;
    hue: number;
  }

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

    // Initialize particles with organic distribution
    const particleCount = 80;
    particlesRef.current = Array.from({ length: particleCount }, (_, i) => ({
      angle: (i / particleCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.3,
      radius: 80 + Math.random() * 40,
      baseRadius: 80 + Math.random() * 40,
      speed: 0.001 + Math.random() * 0.002,
      size: 1.5 + Math.random() * 2.5,
      opacity: 0.3 + Math.random() * 0.5,
      hue: isSpeaking ? 270 : 187,
    }));

    let time = 0;

    const animate = () => {
      const rect = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);

      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      time += 0.008;

      // Theme-aware colors
      const glowIntensity = isDarkMode ? 0.8 : 1.2;
      const saturation = isDarkMode ? 75 : 85;
      const lightness = isDarkMode ? 55 : 45;

      // Soft ambient glow - no hard edges
      const ambientRadius = Math.min(rect.width, rect.height) * 0.4;
      const ambientGlow = ctx.createRadialGradient(
        centerX, centerY, 0,
        centerX, centerY, ambientRadius
      );
      
      const baseHue = isSpeaking ? 270 : isListening ? 187 : 220;
      ambientGlow.addColorStop(0, `hsla(${baseHue}, ${saturation}%, ${lightness}%, ${0.15 * glowIntensity})`);
      ambientGlow.addColorStop(0.4, `hsla(${baseHue}, ${saturation - 10}%, ${lightness + 5}%, ${0.08 * glowIntensity})`);
      ambientGlow.addColorStop(0.7, `hsla(${baseHue}, ${saturation - 20}%, ${lightness + 10}%, ${0.03 * glowIntensity})`);
      ambientGlow.addColorStop(1, 'transparent');

      ctx.fillStyle = ambientGlow;
      ctx.fillRect(0, 0, rect.width, rect.height);

      // Breathing core - organic pulsing
      const breathScale = 1 + Math.sin(time * 1.5) * 0.15;
      const coreRadius = 40 * breathScale;
      
      const coreGlow = ctx.createRadialGradient(
        centerX, centerY, 0,
        centerX, centerY, coreRadius * 2
      );
      
      const coreOpacity = isActive ? 0.4 : 0.2;
      coreGlow.addColorStop(0, `hsla(${baseHue}, ${saturation}%, ${lightness + 15}%, ${coreOpacity * glowIntensity})`);
      coreGlow.addColorStop(0.3, `hsla(${baseHue}, ${saturation}%, ${lightness + 5}%, ${coreOpacity * 0.6 * glowIntensity})`);
      coreGlow.addColorStop(0.6, `hsla(${baseHue}, ${saturation - 10}%, ${lightness}%, ${coreOpacity * 0.3 * glowIntensity})`);
      coreGlow.addColorStop(1, 'transparent');

      ctx.fillStyle = coreGlow;
      ctx.beginPath();
      ctx.arc(centerX, centerY, coreRadius * 2, 0, Math.PI * 2);
      ctx.fill();

      // Floating particles - organic movement
      particlesRef.current.forEach((particle, i) => {
        particle.angle += particle.speed * (isActive ? 2 : 0.8);

        // Organic wave motion
        const wave1 = Math.sin(time * 2 + i * 0.15) * (isActive ? 20 : 8);
        const wave2 = Math.cos(time * 1.5 + i * 0.1) * (isActive ? 15 : 5);
        particle.radius = particle.baseRadius + wave1 + wave2;

        const x = centerX + Math.cos(particle.angle) * particle.radius;
        const y = centerY + Math.sin(particle.angle) * particle.radius;

        // Smooth color transition
        const targetHue = isSpeaking ? 270 : 187;
        particle.hue += (targetHue - particle.hue) * 0.03;

        // Soft particle glow
        const particleGlow = ctx.createRadialGradient(x, y, 0, x, y, particle.size * 4);
        
        const baseAlpha = isActive 
          ? particle.opacity * (0.5 + Math.sin(time * 3 + i * 0.2) * 0.3)
          : particle.opacity * 0.3;
        const alpha = Math.min(baseAlpha * glowIntensity, 0.9);
        
        particleGlow.addColorStop(0, `hsla(${particle.hue}, ${saturation}%, ${lightness + 10}%, ${alpha})`);
        particleGlow.addColorStop(0.3, `hsla(${particle.hue}, ${saturation}%, ${lightness}%, ${alpha * 0.5})`);
        particleGlow.addColorStop(0.7, `hsla(${particle.hue}, ${saturation - 15}%, ${lightness - 5}%, ${alpha * 0.2})`);
        particleGlow.addColorStop(1, 'transparent');
        
        ctx.fillStyle = particleGlow;
        ctx.beginPath();
        ctx.arc(x, y, particle.size * 4, 0, Math.PI * 2);
        ctx.fill();
      });

      // Soft flowing ring - no hard edges
      if (isActive) {
        const ringRadius = 55 + Math.sin(time * 1.8) * 8;
        
        for (let i = 0; i < 3; i++) {
          const offset = i * 0.3;
          const ringGradient = ctx.createRadialGradient(
            centerX, centerY, ringRadius - 15 + i * 5,
            centerX, centerY, ringRadius + 15 - i * 3
          );
          
          const ringAlpha = (0.15 - i * 0.04) * glowIntensity;
          ringGradient.addColorStop(0, 'transparent');
          ringGradient.addColorStop(0.3, `hsla(${baseHue}, ${saturation}%, ${lightness}%, ${ringAlpha})`);
          ringGradient.addColorStop(0.5, `hsla(${baseHue}, ${saturation}%, ${lightness + 5}%, ${ringAlpha * 1.2})`);
          ringGradient.addColorStop(0.7, `hsla(${baseHue}, ${saturation}%, ${lightness}%, ${ringAlpha})`);
          ringGradient.addColorStop(1, 'transparent');

          ctx.fillStyle = ringGradient;
          ctx.beginPath();
          ctx.arc(centerX, centerY, ringRadius + 20, 0, Math.PI * 2);
          ctx.fill();
        }
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
  }, [isActive, isSpeaking, isListening, isDarkMode]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
      style={{ width: '100%', height: '100%' }}
    />
  );
}