'use client';

import { useEffect, useRef, useState } from 'react';

interface Star {
  id: number;
  x: number;
  y: number;
  size: number;
  speed: number;
  opacity: number;
  twinkleSpeed: number;
  twinkleDelay: number;
}

interface ShootingStar {
  id: number;
  x: number;
  y: number;
  length: number;
  speed: number;
  angle: number;
  opacity: number;
}

interface Nebula {
  id: number;
  x: number;
  y: number;
  size: number;
  color: string;
  opacity: number;
  driftX: number;
  driftY: number;
}

export default function AnimatedBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const starsRef = useRef<Star[]>([]);
  const shootingStarsRef = useRef<ShootingStar[]>([]);
  const nebulaeRef = useRef<Nebula[]>([]);
  const animationRef = useRef<number>(0);
  const timeRef = useRef<number>(0);

  // Initialize dimensions and objects
  useEffect(() => {
    const updateDimensions = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Generate initial objects when dimensions change
  useEffect(() => {
    const { width, height } = dimensions;
    if (width === 0 || height === 0) return;

    // Generate stars
    const stars: Star[] = [];
    const starCount = Math.floor((width * height) / 4000); // Responsive density
    
    for (let i = 0; i < starCount; i++) {
      stars.push({
        id: i,
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() * 2 + 0.5,
        speed: Math.random() * 0.15 + 0.05,
        opacity: Math.random() * 0.6 + 0.4,
        twinkleSpeed: Math.random() * 0.02 + 0.01,
        twinkleDelay: Math.random() * Math.PI * 2,
      });
    }
    starsRef.current = stars;

    // Generate nebulae (soft glowing clouds)
    const nebulae: Nebula[] = [];
    const nebulaColors = [
      'rgba(56, 189, 248, 0.03)',   // Cyan
      'rgba(139, 92, 246, 0.04)',   // Purple
      'rgba(236, 72, 153, 0.02)',   // Pink
      'rgba(59, 130, 246, 0.03)',   // Blue
    ];
    
    for (let i = 0; i < 5; i++) {
      nebulae.push({
        id: i,
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() * 400 + 200,
        color: nebulaColors[Math.floor(Math.random() * nebulaColors.length)],
        opacity: Math.random() * 0.5 + 0.5,
        driftX: (Math.random() - 0.5) * 0.2,
        driftY: (Math.random() - 0.5) * 0.1,
      });
    }
    nebulaeRef.current = nebulae;

    // Initialize shooting stars array
    shootingStarsRef.current = [];
  }, [dimensions]);

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = dimensions;
    if (width === 0 || height === 0) return;

    const animate = () => {
      timeRef.current += 0.016; // ~60fps time step
      
      // Clear canvas with gradient background
      const gradient = ctx.createLinearGradient(0, 0, width, height);
      gradient.addColorStop(0, '#0f172a');
      gradient.addColorStop(0.5, '#1e1b4b');
      gradient.addColorStop(1, '#0f172a');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      // Draw nebulae (background clouds)
      nebulaeRef.current.forEach((nebula) => {
        // Update position with smooth drift
        nebula.x += nebula.driftX;
        nebula.y += nebula.driftY;
        
        // Wrap around edges
        if (nebula.x < -nebula.size) nebula.x = width + nebula.size;
        if (nebula.x > width + nebula.size) nebula.x = -nebula.size;
        if (nebula.y < -nebula.size) nebula.y = height + nebula.size;
        if (nebula.y > height + nebula.size) nebula.y = -nebula.size;
        
        // Draw nebula glow
        const nebulaGradient = ctx.createRadialGradient(
          nebula.x, nebula.y, 0,
          nebula.x, nebula.y, nebula.size
        );
        nebulaGradient.addColorStop(0, nebula.color);
        nebulaGradient.addColorStop(1, 'transparent');
        
        ctx.beginPath();
        ctx.arc(nebula.x, nebula.y, nebula.size, 0, Math.PI * 2);
        ctx.fillStyle = nebulaGradient;
        ctx.fill();
      });

      // Draw and update stars
      starsRef.current.forEach((star) => {
        // Calculate twinkle effect
        const twinkle = Math.sin(timeRef.current * star.twinkleSpeed * 60 + star.twinkleDelay);
        const currentOpacity = star.opacity * (0.7 + twinkle * 0.3);
        
        // Update position (slow downward drift + slight horizontal)
        star.y += star.speed;
        star.x += star.speed * 0.3;
        
        // Wrap around edges smoothly
        if (star.y > height + 10) {
          star.y = -10;
          star.x = Math.random() * width;
        }
        if (star.x > width + 10) {
          star.x = -10;
        }
        
        // Draw star glow
        const glowGradient = ctx.createRadialGradient(
          star.x, star.y, 0,
          star.x, star.y, star.size * 3
        );
        glowGradient.addColorStop(0, `rgba(255, 255, 255, ${currentOpacity})`);
        glowGradient.addColorStop(0.5, `rgba(200, 220, 255, ${currentOpacity * 0.3})`);
        glowGradient.addColorStop(1, 'transparent');
        
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size * 3, 0, Math.PI * 2);
        ctx.fillStyle = glowGradient;
        ctx.fill();
        
        // Draw star core
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${currentOpacity})`;
        ctx.fill();
      });

      // Spawn shooting stars randomly
      if (Math.random() < 0.003 && shootingStarsRef.current.length < 3) {
        shootingStarsRef.current.push({
          id: Date.now(),
          x: Math.random() * width * 0.7,
          y: Math.random() * height * 0.3,
          length: Math.random() * 80 + 50,
          speed: Math.random() * 8 + 6,
          angle: Math.PI / 4 + (Math.random() - 0.5) * 0.3,
          opacity: 1,
        });
      }

      // Draw and update shooting stars
      shootingStarsRef.current = shootingStarsRef.current.filter((ss) => {
        // Update position
        ss.x += Math.cos(ss.angle) * ss.speed;
        ss.y += Math.sin(ss.angle) * ss.speed;
        ss.opacity -= 0.015;
        
        // Draw shooting star trail
        const tailX = ss.x - Math.cos(ss.angle) * ss.length;
        const tailY = ss.y - Math.sin(ss.angle) * ss.length;
        
        const trailGradient = ctx.createLinearGradient(tailX, tailY, ss.x, ss.y);
        trailGradient.addColorStop(0, 'transparent');
        trailGradient.addColorStop(0.8, `rgba(255, 255, 255, ${ss.opacity * 0.5})`);
        trailGradient.addColorStop(1, `rgba(255, 255, 255, ${ss.opacity})`);
        
        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(ss.x, ss.y);
        ctx.strokeStyle = trailGradient;
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.stroke();
        
        // Draw head glow
        const headGlow = ctx.createRadialGradient(ss.x, ss.y, 0, ss.x, ss.y, 8);
        headGlow.addColorStop(0, `rgba(255, 255, 255, ${ss.opacity})`);
        headGlow.addColorStop(1, 'transparent');
        ctx.beginPath();
        ctx.arc(ss.x, ss.y, 8, 0, Math.PI * 2);
        ctx.fillStyle = headGlow;
        ctx.fill();
        
        return ss.opacity > 0 && ss.x < width + 100 && ss.y < height + 100;
      });

      // Add subtle vignette effect
      const vignette = ctx.createRadialGradient(
        width / 2, height / 2, 0,
        width / 2, height / 2, Math.max(width, height) * 0.7
      );
      vignette.addColorStop(0, 'transparent');
      vignette.addColorStop(1, 'rgba(0, 0, 0, 0.4)');
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, width, height);

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationRef.current);
    };
  }, [dimensions]);

  return (
    <canvas
      ref={canvasRef}
      width={dimensions.width}
      height={dimensions.height}
      className="fixed inset-0 w-full h-full"
      style={{ background: 'transparent' }}
    />
  );
}
