import React from 'react';

interface LogoProps {
  className?: string;
  showText?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const Logo: React.FC<LogoProps> = ({ className, size = 'md' }) => {
  const sizes = {
    sm: 'text-xl',
    md: 'text-3xl',
    lg: 'text-5xl',
    xl: 'text-7xl',
  };

  const currentSize = sizes[size];

  return (
    <div className={`flex items-center font-black tracking-tighter italic ${currentSize} ${className || ''}`}>
      <span className="text-[#6D28D9]">J</span>
      <span className="text-slate-900">.</span>
      <span className="text-[#F97316]">C</span>
    </div>
  );
};
