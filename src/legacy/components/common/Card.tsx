import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

const Card: React.FC<CardProps> = ({ children, className = '' }) => {
  return (
    <div
      className={`
        bg-white/80 backdrop-blur-2xl
        p-5 sm:p-6 rounded-3xl
        border border-soft-sky/45
        shadow-soft
        transition-all duration-300 ease-out
        hover:shadow-soft-lg hover:-translate-y-0.5 hover:border-soft-lilac/40
        ${className}
      `}
    >
      {children}
    </div>
  );
};

export default Card;
