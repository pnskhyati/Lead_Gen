import React from 'react';
import type { LeadTemperature } from '../types';

const STYLES: Record<LeadTemperature, string> = {
  hot: 'bg-[#FFE8E3] text-soft-coral',
  warm: 'bg-[#E8F6F2] text-soft-deep',
  cold: 'bg-soft-sky text-soft-azure',
};

const DOTS: Record<LeadTemperature, string> = {
  hot: 'bg-soft-coral',
  warm: 'bg-soft-lilac',
  cold: 'bg-soft-azure',
};

const LABELS: Record<LeadTemperature, string> = {
  hot: 'Hot',
  warm: 'Warm',
  cold: 'Cold',
};

const LeadBadge: React.FC<{ temperature: LeadTemperature; score?: number; className?: string }> = ({
  temperature,
  score,
  className = '',
}) => (
  <span
    className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full capitalize ${STYLES[temperature]} ${className}`}
  >
    <span className={`w-1.5 h-1.5 rounded-full ${DOTS[temperature]}`} />
    {LABELS[temperature]}
    {typeof score === 'number' ? <span className="opacity-70 font-semibold">· {score}</span> : null}
  </span>
);

export default LeadBadge;
