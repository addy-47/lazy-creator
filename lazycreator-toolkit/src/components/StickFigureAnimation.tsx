
import React, { useEffect, useState } from 'react';
import { useInView } from 'react-intersection-observer';

interface StickFigureAnimationProps {
  type?: 'wave' | 'jump' | 'peek' | 'spin' | 'sleep' | 'dance' | 'stretch';
  delay?: number;
  className?: string;
  height?: number;
}

const StickFigureAnimation: React.FC<StickFigureAnimationProps> = ({ 
  type = 'peek',
  delay = 0,
  className = '',
  height = 60 // Increased default height
}) => {
  const [animated, setAnimated] = useState(false);
  const { ref, inView } = useInView({
    triggerOnce: true,
    threshold: 0.1,
  });

  useEffect(() => {
    if (inView) {
      const timer = setTimeout(() => {
        setAnimated(true);
      }, delay);
      return () => clearTimeout(timer);
    }
  }, [inView, delay]);

  return (
    <div 
      ref={ref} 
      className={`relative ${className}`}
    >
      <div 
        className={`
          transition-all duration-700 ease-in-out
          ${type === 'peek' && !animated ? 'translate-y-full opacity-0' : ''}
          ${type === 'peek' && animated ? 'translate-y-0 opacity-1' : ''}
          ${type === 'jump' && !animated ? 'translate-y-4 opacity-0' : ''}
          ${type === 'jump' && animated ? 'translate-y-0 opacity-1 animate-bounce' : ''}
          ${type === 'wave' && !animated ? 'translate-x-full opacity-0' : ''}
          ${type === 'wave' && animated ? 'translate-x-0 opacity-1' : ''}
          ${type === 'spin' && !animated ? 'opacity-0 scale-0' : ''}
          ${type === 'spin' && animated ? 'opacity-1 scale-100 animate-spin-slow' : ''}
          ${type === 'sleep' && !animated ? 'opacity-0 scale-0' : ''}
          ${type === 'sleep' && animated ? 'opacity-1 scale-100' : ''}
          ${type === 'dance' && !animated ? 'opacity-0' : ''}
          ${type === 'dance' && animated ? 'opacity-1 animate-[dance_1s_ease-in-out_infinite]' : ''}
          ${type === 'stretch' && !animated ? 'opacity-0 scale-y-75' : ''}
          ${type === 'stretch' && animated ? 'opacity-1 scale-100 animate-[stretch_3s_ease-in-out_infinite]' : ''}
        `}
      >
        <svg 
          width={height} 
          height={height} 
          viewBox="0 0 48 48" 
          fill="none" 
          xmlns="http://www.w3.org/2000/svg"
          className="text-primary"
        >
          {type === 'sleep' ? (
            // Sleeping stick figure (horizontal)
            <>
              {/* Ground line */}
              <line 
                x1="10" 
                y1="34" 
                x2="38" 
                y2="34" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round"
              />
              
              {/* Head */}
              <circle 
                cx="16" 
                cy="28" 
                r="6" 
                fill="currentColor" 
                fillOpacity="0.2"
                stroke="currentColor" 
                strokeWidth="2"
              />
              
              {/* Sleeping glasses */}
              <line 
                x1="14" 
                y1="27" 
                x2="15" 
                y2="27" 
                stroke="currentColor" 
                strokeWidth="1.5" 
                strokeLinecap="round"
              />
              <line 
                x1="17" 
                y1="27" 
                x2="18" 
                y2="27" 
                stroke="currentColor" 
                strokeWidth="1.5" 
                strokeLinecap="round"
              />
              
              {/* Body - horizontal */}
              <path 
                d="M22 28H32" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round"
              />
              
              {/* Arm up */}
              <path 
                d="M28 28V24" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round"
              />
              
              {/* Leg bent */}
              <path 
                d="M32 28L34 26" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round"
              />
              
              {/* Zzz sleeping - in blue */}
              <path 
                d="M36 20L38 18L34 18L36 16" 
                stroke="#3B82F6" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
                className={animated ? "animate-pulse text-blue-500" : "opacity-0 text-blue-500"}
              />
              <path 
                d="M32 24L34 22L30 22L32 20" 
                stroke="#3B82F6" 
                strokeWidth="1.5" 
                strokeLinecap="round" 
                strokeLinejoin="round"
                className={animated ? "animate-pulse text-blue-500" : "opacity-0 text-blue-500"}
              />
            </>
          ) : (
            // Regular stick figure (vertical)
            <>
              {/* Head */}
              <circle 
                cx="24" 
                cy="16" 
                r="6" 
                fill="currentColor" 
                fillOpacity="0.2"
                stroke="currentColor" 
                strokeWidth="2"
              />
              
              {/* Body */}
              <path 
                d="M24 22V32" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round"
              />
              
              {/* Arms */}
              {type === 'wave' ? (
                <>
                  <path 
                    d="M24 27L18 24" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    strokeLinecap="round"
                    className={animated ? "animate-[wave_1s_ease-in-out_infinite]" : ""}
                  />
                  <path 
                    d="M24 27L30 24" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    strokeLinecap="round"
                  />
                </>
              ) : type === 'dance' ? (
                <>
                  <path 
                    d="M24 27L18 24" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    strokeLinecap="round"
                    className={animated ? "animate-[wave_0.7s_ease-in-out_infinite]" : ""}
                  />
                  <path 
                    d="M24 27L30 24" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    strokeLinecap="round"
                    className={animated ? "animate-[wave_0.7s_ease-in-out_infinite_0.35s]" : ""}
                  />
                </>
              ) : type === 'stretch' ? (
                <>
                  <path 
                    d="M24 27L18 21" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    strokeLinecap="round"
                    className={animated ? "animate-[stretch-arm_3s_ease-in-out_infinite]" : ""}
                  />
                  <path 
                    d="M24 27L30 21" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    strokeLinecap="round"
                    className={animated ? "animate-[stretch-arm_3s_ease-in-out_infinite]" : ""}
                  />
                </>
              ) : (
                <>
                  <path 
                    d="M24 27L18 24" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    strokeLinecap="round"
                  />
                  <path 
                    d="M24 27L30 24" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    strokeLinecap="round"
                  />
                </>
              )}
              
              {/* Legs */}
              <path 
                d="M24 32L20 38" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round"
                className={type === 'jump' && animated ? "animate-[kick_1s_ease-in-out_infinite]" : type === 'dance' && animated ? "animate-[kick_0.7s_ease-in-out_infinite_0.175s]" : ""}
              />
              <path 
                d="M24 32L28 38" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round"
                className={type === 'jump' && animated ? "animate-[kick_1s_ease-in-out_infinite_0.5s]" : type === 'dance' && animated ? "animate-[kick_0.7s_ease-in-out_infinite_0.525s]" : ""}
              />
              
              {/* Zzz for peek type */}
              {type === 'peek' && (
                <path 
                  d="M34 14L36 12L32 12L34 10" 
                  stroke="#3B82F6" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                  className={animated ? "animate-pulse text-blue-500" : "opacity-0 text-blue-500"}
                />
              )}
            </>
          )}
        </svg>
      </div>
    </div>
  );
};

export default StickFigureAnimation;
