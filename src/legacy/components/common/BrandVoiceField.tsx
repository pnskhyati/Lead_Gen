import React, { useEffect, useState } from 'react';
import { TONES_OF_VOICE } from '../../constants';
import { getCompanyProfile, type CompanyProfile } from '../../services/companyService';

export type VoiceMode = 'company' | 'preset' | 'custom';

export interface BrandVoiceValue {
  voiceMode: VoiceMode;
  tone: string;
  customTone: string;
}

interface BrandVoiceFieldProps {
  value: BrandVoiceValue;
  onChange: (next: BrandVoiceValue) => void;
  /** Compact layout for denser forms */
  compact?: boolean;
  /** Optional preset list (defaults to Creative Lab tones) */
  presets?: string[];
}

const BrandVoiceField: React.FC<BrandVoiceFieldProps> = ({
  value,
  onChange,
  compact = false,
  presets = TONES_OF_VOICE,
}) => {
  const [profile, setProfile] = useState<CompanyProfile | null>(null);

  useEffect(() => {
    void getCompanyProfile()
      .then(setProfile)
      .catch(() => setProfile(null));
  }, []);

  const companyLabel = profile?.companyName
    ? `${profile.companyName} brand voice`
    : 'Company brand voice';

  const setMode = (voiceMode: VoiceMode) => {
    onChange({ ...value, voiceMode });
  };

  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      <div>
        <p className={`font-semibold text-ink-soft ${compact ? 'text-xs' : 'text-sm'} mb-2`}>
          Voice & tone
        </p>
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ['company', companyLabel],
              ['preset', 'Preset tone'],
              ['custom', 'Custom voice'],
            ] as [VoiceMode, string][]
          ).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              onClick={() => setMode(mode)}
              className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition-all ${
                value.voiceMode === mode
                  ? 'bg-gradient-to-r from-soft-deep to-soft-azure text-white shadow-aqua'
                  : 'bg-soft-bg text-ink-muted hover:bg-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {value.voiceMode === 'company' && (
        <div className="rounded-2xl bg-soft-mint/50 border border-soft-sky/40 px-3.5 py-3">
          <p className="text-[11px] font-bold text-soft-deep mb-1">Using saved company voice</p>
          <p className="text-xs text-ink-muted leading-relaxed line-clamp-3">
            {profile?.voiceTone ||
              'Set this in Admin Console → Brand voice. Posts and replies will match your company tone.'}
          </p>
          {profile?.writingStyle && (
            <p className="text-[11px] text-ink-muted mt-1.5 line-clamp-2">Style: {profile.writingStyle}</p>
          )}
        </div>
      )}

      {value.voiceMode === 'preset' && (
        <select
          value={presets.includes(value.tone) ? value.tone : presets[0]}
          onChange={(e) => onChange({ ...value, tone: e.target.value })}
          className="w-full nexora-input py-2.5 px-4 text-sm"
        >
          {presets.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      )}

      {value.voiceMode === 'custom' && (
        <textarea
          value={value.customTone}
          onChange={(e) => onChange({ ...value, customTone: e.target.value })}
          rows={compact ? 3 : 4}
          placeholder="Describe exactly how this brand should sound — e.g. ‘Crisp, technical, friendly. Short sentences. Never hypey. Say fleet efficiency, not synergy.’"
          className="w-full nexora-input py-2.5 px-4 text-sm resize-y"
        />
      )}
    </div>
  );
};

export default BrandVoiceField;
