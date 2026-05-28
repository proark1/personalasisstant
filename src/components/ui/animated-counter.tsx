import { useEffect, useState } from 'react';
import { motion, useSpring, useTransform } from 'framer-motion';
import { cn } from '@/lib/utils';

interface AnimatedCounterProps {
  value: number;
  className?: string;
  duration?: number;
  formatValue?: (value: number) => string;
}

export function AnimatedCounter({ 
  value, 
  className,
  duration = 1,
  formatValue = (v) => Math.round(v).toString()
}: AnimatedCounterProps) {
  const springValue = useSpring(0, { 
    duration: duration * 1000,
    bounce: 0.2
  });
  
  const displayValue = useTransform(springValue, (latest) => formatValue(latest));
  const [display, setDisplay] = useState(formatValue(0));

  useEffect(() => {
    springValue.set(value);
    
    const unsubscribe = displayValue.on("change", (v) => {
      setDisplay(v);
    });
    
    return unsubscribe;
  }, [value, springValue, displayValue]);

  return (
    <motion.span 
      className={cn("tabular-nums", className)}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {display}
    </motion.span>
  );
}
