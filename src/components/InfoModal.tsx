import React from 'react';
import { X } from 'lucide-react';

interface InfoModalProps {
  type: 'contact' | 'privacy' | 'terms' | null;
  onClose: () => void;
}

export default function InfoModal({ type, onClose }: InfoModalProps) {
  if (!type) return null;

  const content = {
    contact: {
      title: 'Inquiries & Dialogue',
      subtitle: 'Reach the team behind nexora',
      body: 'For thoughtful partnerships, architecture discussions, or private enterprise deployments, write to us directly at studio@nexora.space. We read every correspondence within one business day.'
    },
    privacy: {
      title: 'Privacy by Subtraction',
      subtitle: 'Your data is yours alone',
      body: 'Nexora is architected around end-to-end user privacy. We do not sell telemetry, monetize user attention, or train public models on your private tasks and schedules. Your thoughts remain entirely confidential.'
    },
    terms: {
      title: 'Terms of Purpose',
      subtitle: 'Mutual respect and calm reliability',
      body: 'By using Nexora, you enter a platform built for peaceful, reliable productivity. We pledge 99.9% uptime, zero dark patterns, and absolute respect for your digital sovereignty.'
    }
  }[type];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-lg bg-[#071C1A] border border-[rgba(169,191,165,0.2)] p-8 sm:p-10 shadow-2xl">
        <div className="flex items-start justify-between mb-6">
          <div>
            <span className="text-[10px] uppercase tracking-widest-plus text-[#A9BFA5] font-normal block mb-1">
              nexora documentation
            </span>
            <h3 className="serif text-3xl font-light text-[#E8E9D8]">
              {content.title}
            </h3>
            <p className="text-xs text-[#A9BFA5] font-light mt-1">
              {content.subtitle}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#A9BFA5]/60 hover:text-[#E8E9D8] transition-colors p-1 cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" strokeWidth={1.5} />
          </button>
        </div>

        <div className="w-full h-px bg-[rgba(169,191,165,0.2)] my-6" />

        <p className="text-xs sm:text-sm text-[#A9BFA5] font-light leading-relaxed mb-8">
          {content.body}
        </p>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="bg-[#E8E9D8] text-[#071C1A] px-6 py-2.5 rounded-[2px] font-semibold uppercase tracking-widest text-xs hover:bg-white transition-colors cursor-pointer"
          >
            Acknowledge
          </button>
        </div>
      </div>
    </div>
  );
}
