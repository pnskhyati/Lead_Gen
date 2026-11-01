import React, { useState, useRef, useEffect } from 'react';
import { 
  FileText, 
  Palette, 
  Film, 
  ChevronDown, 
  Check 
} from 'lucide-react';
import { CategoryType } from '../../../types';
import { useTheme } from '../../../context/ThemeContext';

export type { CategoryType };
export type MainCategory = 'text' | 'images' | 'videos';

export interface SubCategoryItem {
  id: CategoryType;
  label: string;
  badge: string;
}

export interface MainCategoryConfig {
  id: MainCategory;
  label: string;
  icon: React.ReactNode;
  subCategories: SubCategoryItem[];
}

export const MAIN_CATEGORIES: MainCategoryConfig[] = [
  {
    id: 'text',
    label: 'Text',
    icon: <FileText className="w-3.5 h-3.5" />,
    subCategories: [
      { id: 'Email Copy', label: 'Email Copy', badge: 'Outreach' },
      { id: 'Social Post', label: 'Social Post', badge: 'Social' },
      { id: 'Headline Set', label: 'Headline Set', badge: 'Headlines' },
      { id: 'Thought Leadership', label: 'Thought Leadership', badge: 'Essay' }
    ]
  },
  {
    id: 'images',
    label: 'Images',
    icon: <Palette className="w-3.5 h-3.5" />,
    subCategories: [
      { id: 'Hero Brief', label: '3D Spatial Visual', badge: 'Key Visual' },
      { id: 'Product Render', label: 'Product Studio Render', badge: 'Studio' },
      { id: 'Brand Specimen', label: 'Brand & Editorial Specimen', badge: 'Graphic' }
    ]
  },
  {
    id: 'videos',
    label: 'Videos',
    icon: <Film className="w-3.5 h-3.5" />,
    subCategories: [
      { id: 'Ad Script', label: 'Ad Script (15–60s)', badge: 'Social Ad' },
      { id: 'Product Demo', label: 'Product Demo Walkthrough', badge: 'Screenflow' },
      { id: 'Brand Film', label: 'Brand Manifesto Film', badge: 'Cinematic' }
    ]
  }
];

export function getMainCategoryForSub(sub: CategoryType): MainCategory {
  if (['Hero Brief', 'Product Render', 'Brand Specimen'].includes(sub)) {
    return 'images';
  }
  if (['Ad Script', 'Product Demo', 'Brand Film'].includes(sub)) {
    return 'videos';
  }
  return 'text';
}

interface CategoryNavProps {
  selectedCategory: CategoryType;
  onSelectCategory: (cat: CategoryType) => void;
}

export default function CategoryNav({
  selectedCategory,
  onSelectCategory
}: CategoryNavProps) {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  const activeMain = getMainCategoryForSub(selectedCategory);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentMainConfig = MAIN_CATEGORIES.find((m) => m.id === activeMain) || MAIN_CATEGORIES[0];
  const currentSubItem =
    currentMainConfig.subCategories.find((s) => s.id === selectedCategory) ||
    currentMainConfig.subCategories[0];

  const handleSelectMain = (mainId: MainCategory) => {
    if (mainId === activeMain) return;
    const targetConfig = MAIN_CATEGORIES.find((m) => m.id === mainId);
    if (targetConfig && targetConfig.subCategories.length > 0) {
      onSelectCategory(targetConfig.subCategories[0].id);
      setDropdownOpen(false);
    }
  };

  const handleSelectSub = (subId: CategoryType) => {
    onSelectCategory(subId);
    setDropdownOpen(false);
  };

  return (
    <div
      className={`border rounded-[2px] p-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition-colors ${
        isLight
          ? 'bg-white border-[#E2ECE0]'
          : 'bg-[#071C1A] border-[rgba(169,191,165,0.2)]'
      }`}
    >
      {/* 3 Core Category Tabs: Text, Images, Videos */}
      <div className="flex items-center space-x-1">
        <span
          className={`text-[10px] uppercase font-mono tracking-widest px-2 hidden md:inline-block ${
            isLight ? 'text-[#3E6A5E]' : 'text-[#A9BFA5]/60'
          }`}
        >
          Format
        </span>

        <div
          className={`inline-flex rounded-[2px] p-0.5 border ${
            isLight
              ? 'bg-[#F8F9F5] border-[#E2ECE0]'
              : 'bg-[#061816] border-[rgba(169,191,165,0.2)]'
          }`}
        >
          {MAIN_CATEGORIES.map((main) => {
            const isSelected = activeMain === main.id;
            return (
              <button
                key={main.id}
                type="button"
                onClick={() => handleSelectMain(main.id)}
                className={`px-3 py-1.5 text-xs font-mono tracking-wider transition-colors cursor-pointer flex items-center space-x-1.5 rounded-[1px] ${
                  isSelected
                    ? isLight
                      ? 'bg-[#143630] text-white font-medium shadow-sm'
                      : 'bg-[#E8E9D8] text-[#071C1A] font-semibold shadow-sm'
                    : isLight
                      ? 'text-[#3E6A5E] hover:text-[#122420]'
                      : 'text-[#A9BFA5]/70 hover:text-white'
                }`}
              >
                {main.icon}
                <span>{main.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Sub-Category Dropdown */}
      <div ref={dropdownRef} className="relative flex items-center space-x-2">
        <span
          className={`text-[10px] uppercase font-mono tracking-wider shrink-0 ${
            isLight ? 'text-[#3E6A5E]' : 'text-[#A9BFA5]/60'
          }`}
        >
          Sub-format:
        </span>

        <button
          type="button"
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className={`px-3 py-1.5 rounded-[2px] border text-xs font-mono flex items-center justify-between space-x-2 min-w-[210px] transition-colors cursor-pointer ${
            isLight
              ? 'bg-[#F8F9F5] border-[#D0DDD0] text-[#122420] hover:border-[#143630]'
              : 'bg-[#061816] border-[rgba(169,191,165,0.25)] text-[#E8E9D8] hover:border-[#A9BFA5]'
          }`}
        >
          <span className="truncate font-medium">{currentSubItem.label}</span>
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform shrink-0 ${
              dropdownOpen ? 'rotate-180' : ''
            } ${isLight ? 'text-[#3E6A5E]' : 'text-[#A9BFA5]/70'}`}
          />
        </button>

        {/* Dropdown Menu Popup */}
        {dropdownOpen && (
          <div
            className={`absolute right-0 top-full mt-1.5 w-64 rounded-[2px] border shadow-lg py-1 z-30 animate-fadeIn ${
              isLight
                ? 'bg-white border-[#D0DDD0] text-[#122420]'
                : 'bg-[#071C1A] border-[rgba(169,191,165,0.3)] text-[#E8E9D8]'
            }`}
          >
            <div
              className={`px-3 py-1 text-[9px] uppercase font-mono tracking-widest border-b ${
                isLight
                  ? 'text-[#668877] border-[#E2ECE0]'
                  : 'text-[#A9BFA5]/60 border-[rgba(169,191,165,0.15)]'
              }`}
            >
              {currentMainConfig.label} Formats
            </div>

            <div className="py-1">
              {currentMainConfig.subCategories.map((sub) => {
                const isSelected = selectedCategory === sub.id;
                return (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={() => handleSelectSub(sub.id)}
                    className={`w-full px-3 py-2 text-left text-xs font-mono flex items-center justify-between transition-colors cursor-pointer ${
                      isSelected
                        ? isLight
                          ? 'bg-[#EDF3EA] text-[#143630] font-semibold'
                          : 'bg-[#0D2D2A] text-[#E8E9D8] font-semibold'
                        : isLight
                          ? 'hover:bg-[#F8F9F5] text-[#244B40]'
                          : 'hover:bg-[#061816] text-[#A9BFA5] hover:text-white'
                    }`}
                  >
                    <span>{sub.label}</span>
                    {isSelected && (
                      <Check
                        className={`w-3.5 h-3.5 shrink-0 ${
                          isLight ? 'text-[#143630]' : 'text-[#A9BFA5]'
                        }`}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
