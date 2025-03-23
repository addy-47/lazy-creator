
import React from "react";

const Logo = ({ size = "default", showText = false }: { size?: "small" | "default" | "large"; showText?: boolean }) => {
  const dimensions = {
    small: { width: 24, height: 24 },
    default: { width: 32, height: 32 },
    large: { width: 48, height: 48 },
  };

  const { width, height } = dimensions[size];

  return (
    <div className="flex items-center gap-2">
      <svg 
        width={width} 
        height={height} 
        viewBox="0 0 48 48" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
        className="stroke-primary fill-primary"
      >
        {/* Background circle */}
        <path 
          d="M24 4C12.9543 4 4 12.9543 4 24C4 35.0457 12.9543 44 24 44C35.0457 44 44 35.0457 44 24C44 12.9543 35.0457 4 24 4Z" 
          fill="currentColor" 
          fillOpacity="0.2" 
          stroke="currentColor" 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round"
        />
        
        {/* Ground line */}
        <line 
          x1="14" 
          y1="28" 
          x2="34" 
          y2="28" 
          stroke="currentColor" 
          strokeWidth="2" 
          strokeLinecap="round"
        />
        
        {/* Sleeping stick figure - head */}
        <circle 
          cx="18" 
          cy="24" 
          r="4" 
          fill="currentColor" 
          stroke="currentColor" 
          strokeWidth="1"
        />
        
        {/* Sleeping glasses */}
        <line 
          x1="16" 
          y1="23" 
          x2="17" 
          y2="23" 
          stroke="currentColor" 
          strokeWidth="1" 
          strokeLinecap="round"
        />
        <line 
          x1="19" 
          y1="23" 
          x2="20" 
          y2="23" 
          stroke="currentColor" 
          strokeWidth="1" 
          strokeLinecap="round"
        />
        
        {/* Body */}
        <path 
          d="M22 24L28 24" 
          stroke="currentColor" 
          strokeWidth="2" 
          strokeLinecap="round"
        />
        
        {/* Arm raised (Z position) */}
        <path 
          d="M26 24L26 20" 
          stroke="currentColor" 
          strokeWidth="2" 
          strokeLinecap="round"
        />
        
        {/* Leg bent */}
        <path 
          d="M28 24L30 22" 
          stroke="currentColor" 
          strokeWidth="2" 
          strokeLinecap="round"
        />
        
        {/* Zzz sleeping - in blue */}
        <path 
          d="M32 16L34 14L30 14L32 12" 
          stroke="#3B82F6" 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round"
          className="text-blue-500"
        />
        <path 
          d="M36 20L38 18L34 18L36 16" 
          stroke="#3B82F6" 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round"
          className="text-blue-500"
        />
        <path 
          d="M30 24L32 22L28 22L30 20" 
          stroke="#3B82F6" 
          strokeWidth="1.5" 
          strokeLinecap="round" 
          strokeLinejoin="round"
          className="text-blue-500"
        />
      </svg>
      
      {showText && (
        <span className="text-xl font-semibold tracking-tight">LazyCreator</span>
      )}
    </div>
  );
};

export default Logo;
