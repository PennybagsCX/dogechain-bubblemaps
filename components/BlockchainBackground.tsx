import React, { useEffect, useRef } from 'react';

interface BlockchainBackgroundProps {
  className?: string;
}

interface Node {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
}

export const BlockchainBackground: React.FC<BlockchainBackgroundProps> = ({ className = '' }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const mouseRef = useRef({ x: -1000, y: -1000 });
  const nodesRef = useRef<Node[]>([]);
  const sizeRef = useRef({ width: 0, height: 0, dpr: 1 });
  const idleTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const setCanvasSize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      sizeRef.current = { width: rect.width, height: rect.height, dpr };

      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const nodeCount = Math.floor((rect.width * rect.height) / 12000);
      nodesRef.current = Array.from({ length: Math.min(nodeCount, 100) }, () => ({
        x: Math.random() * rect.width,
        y: Math.random() * rect.height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        radius: Math.random() * 2.5 + 1.5,
      }));
    };

    // Set canvas size using ResizeObserver for better responsiveness
    const resizeObserver = new ResizeObserver(() => setCanvasSize());

    const parent = canvas.parentElement;
    if (parent) {
      resizeObserver.observe(parent);
    }

    // Initialize nodes and size
    setCanvasSize();

    const getRelativePosition = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return { x: -1000, y: -1000 };
      return {
        x: ((clientX - rect.left) / rect.width) * sizeRef.current.width,
        y: ((clientY - rect.top) / rect.height) * sizeRef.current.height,
      };
    };

    const clearIdle = () => {
      if (idleTimeoutRef.current) {
        window.clearTimeout(idleTimeoutRef.current);
        idleTimeoutRef.current = null;
      }
    };

    const scheduleIdle = () => {
      clearIdle();
      idleTimeoutRef.current = window.setTimeout(() => {
        // Release nodes back outward from last cursor position
        const nodes = nodesRef.current;
        const mouse = mouseRef.current;
        nodes.forEach((node) => {
          const dx = node.x - mouse.x;
          const dy = node.y - mouse.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const push = 4; // outward impulse
          node.vx += (dx / dist) * push;
          node.vy += (dy / dist) * push;
        });
        mouseRef.current = { x: -1000, y: -1000 };
      }, 3000);
    };

    // Mouse tracking - listen on window since canvas has pointer-events: none
    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = getRelativePosition(e.clientX, e.clientY);
      scheduleIdle();
    };

    const handleMouseLeave = () => {
      mouseRef.current = { x: -1000, y: -1000 };
      clearIdle();
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseout', handleMouseLeave);

    // Touch support for mobile
    const handleTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (touch) {
        mouseRef.current = getRelativePosition(touch.clientX, touch.clientY);
      }
      scheduleIdle();
    };

    const handleTouchEnd = () => {
      mouseRef.current = { x: -1000, y: -1000 };
      clearIdle();
    };

    window.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('touchend', handleTouchEnd);

    // Animation loop
    const animate = () => {
      const { width, height } = sizeRef.current;
      ctx.clearRect(0, 0, width, height);

      const nodes = nodesRef.current;
      const mouse = mouseRef.current;

      // Update and draw nodes
      nodes.forEach((node, i) => {
        // Attract to mouse (magnetic effect)
        const dx = mouse.x - node.x;
        const dy = mouse.y - node.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 250) {
          const force = (250 - dist) / 250;
          node.vx += (dx / dist) * force * 0.8;
          node.vy += (dy / dist) * force * 0.8;
        }

        // Apply velocity with damping
        node.x += node.vx;
        node.y += node.vy;
        node.vx *= 0.96;
        node.vy *= 0.96;

        // Bounce off walls
        if (node.x < 0 || node.x > width) node.vx *= -1;
        if (node.y < 0 || node.y > height) node.vy *= -1;

        // Keep nodes in bounds
        node.x = Math.max(0, Math.min(width, node.x));
        node.y = Math.max(0, Math.min(height, node.y));

        // Draw connections between nearby nodes
        for (let j = i + 1; j < nodes.length; j++) {
          const other = nodes[j];
          if (!other) continue;
          const dxx = other.x - node.x;
          const dyy = other.y - node.y;
          const distance = Math.sqrt(dxx * dxx + dyy * dyy);

          if (distance < 150) {
            const opacity = (1 - distance / 150) * 0.5;
            ctx.beginPath();
            ctx.moveTo(node.x, node.y);
            ctx.lineTo(other.x, other.y);
            ctx.strokeStyle = `rgba(147, 51, 234, ${opacity})`; // Purple color
            ctx.lineWidth = 0.8;
            ctx.stroke();
          }
        }

        // Draw node
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(147, 51, 234, 0.7)';
        ctx.fill();
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    // Cleanup
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseout', handleMouseLeave);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      clearIdle();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 w-full h-full block ${className}`}
      style={{ pointerEvents: 'none', maxWidth: '100%', maxHeight: '100%' }}
    />
  );
};
