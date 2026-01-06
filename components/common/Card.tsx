import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

const Card: React.FC<CardProps> = ({ children, className = '' }) => {
  return (
    <div className={`
      bg-white/40 dark:bg-slate-900/50 
      backdrop-blur-lg 
      p-4 rounded-xl 
      border border-slate-200/80 dark:border-slate-700/60 
      shadow-lg shadow-black/5 dark:shadow-black/30 
      transition-all duration-300 
      hover:border-brand-blue/30 dark:hover:border-brand-blue/60 
      hover:shadow-brand-blue/10 dark:hover:shadow-brand-blue/20 
      ${className}
    `}>
      {children}
    </div>
  );
};

export default Card;