import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useTheme } from '../../../context/ThemeContext';

const HOURS = ['2 PM', '3 PM', '4 PM', '5 PM', '6 PM', '7 PM'];
const DAYS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];

// 6 rows x 13 columns activity matrix (intensity 0 to 4)
// Accurately inspired by the pattern visible in the screenshot
const ACTIVITY_MATRIX: number[][] = [
  // 2 PM
  [2, 3, 1, 0, 4, 2, 0, 3, 2, 0, 4, 3, 1],
  // 3 PM
  [3, 1, 0, 4, 3, 0, 2, 4, 0, 3, 2, 4, 3],
  // 4 PM (dense active row)
  [4, 3, 4, 2, 4, 3, 4, 2, 4, 3, 4, 3, 4],
  // 5 PM
  [0, 3, 2, 0, 3, 1, 4, 0, 2, 3, 0, 4, 0],
  // 6 PM
  [4, 2, 3, 4, 0, 2, 3, 4, 2, 3, 0, 2, 0],
  // 7 PM
  [2, 3, 0, 4, 2, 3, 0, 3, 2, 0, 4, 3, 2],
];

interface ActivityHeatmapProps {
  onClose?: () => void;
}

export default function ActivityHeatmap({ onClose }: ActivityHeatmapProps = {}) {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  const [hoveredCell, setHoveredCell] = useState<{
    hour: string;
    day: number;
    intensity: number;
  } | null>(null);

  // Return color style for activity block in accessible cyan token palette
  const getCellColor = (val: number) => {
    if (isLight) {
      switch (val) {
        case 1:
          return 'bg-cyan-100 border border-cyan-200';
        case 2:
          return 'bg-cyan-300 border border-cyan-400 text-slate-900';
        case 3:
          return 'bg-cyan-600 border border-cyan-700 text-white';
        case 4:
          return 'bg-cyan-800 border border-cyan-900 text-white';
        default:
          return 'bg-slate-100 border border-slate-200';
      }
    }
    switch (val) {
      case 1:
        return 'bg-cyan-950/70 border border-cyan-800/50';
      case 2:
        return 'bg-cyan-800/70 border border-cyan-600/60 text-white';
      case 3:
        return 'bg-cyan-500 border border-cyan-400 text-[#070B14]';
      case 4:
        return 'bg-cyan-400 border border-cyan-300 text-[#070B14] font-bold';
      default:
        return 'bg-[#0F172A] border border-slate-800';
    }
  };

  return (
    <div className="border border-[rgba(169,191,165,0.2)] bg-[#071C1A] p-5 flex flex-col justify-between h-full relative">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          <h3 className="serif text-xl sm:text-2xl font-light text-[#E8E9D8] tracking-tight">
            Activity
          </h3>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              title="Hide activity graph"
              className="text-[#A9BFA5]/60 hover:text-[#E8E9D8] hover:bg-[rgba(169,191,165,0.1)] p-1 rounded transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="flex items-center space-x-2 text-[10px] font-mono text-[var(--text-secondary)]">
          <span>Less</span>
          <span className={`w-2.5 h-2.5 rounded-[1px] ${getCellColor(0)}`} />
          <span className={`w-2.5 h-2.5 rounded-[1px] ${getCellColor(1)}`} />
          <span className={`w-2.5 h-2.5 rounded-[1px] ${getCellColor(2)}`} />
          <span className={`w-2.5 h-2.5 rounded-[1px] ${getCellColor(3)}`} />
          <span className={`w-2.5 h-2.5 rounded-[1px] ${getCellColor(4)}`} />
          <span>More</span>
        </div>
      </div>

      {/* Heatmap Grid */}
      <div className="relative overflow-x-auto pb-1">
        <div className="min-w-[340px]">
          {/* Rows */}
          <div className="space-y-1.5">
            {HOURS.map((hour, rIdx) => (
              <div key={hour} className="flex items-center space-x-2">
                {/* Y-axis hour label */}
                <span className="w-10 text-[10px] font-mono text-[#A9BFA5]/70 text-right shrink-0 select-none">
                  {hour}
                </span>

                {/* Day cells (13 columns) */}
                <div className="grid grid-cols-13 gap-1.5 flex-1">
                  {DAYS.map((day, cIdx) => {
                    const intensity = ACTIVITY_MATRIX[rIdx]?.[cIdx] ?? 0;
                    return (
                      <div
                        key={day}
                        onMouseEnter={() => setHoveredCell({ hour, day, intensity })}
                        onMouseLeave={() => setHoveredCell(null)}
                        className={`h-5 sm:h-6 rounded-[2px] cursor-pointer transition-all hover:scale-110 hover:z-10 ${getCellColor(
                          intensity
                        )}`}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* X-axis days footer */}
          <div className="flex items-center space-x-2 mt-2 pt-1 border-t border-[rgba(169,191,165,0.1)]">
            <span className="w-10 text-[10px] font-mono text-[#A9BFA5] font-medium text-right shrink-0">
              June
            </span>
            <div className="grid grid-cols-13 gap-1.5 flex-1 text-center">
              {DAYS.map(day => (
                <span
                  key={day}
                  className="text-[10px] font-mono text-[#A9BFA5]/70"
                >
                  {day}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Hover Tooltip */}
        {hoveredCell && (
          <div className="absolute top-0 right-0 bg-[#051513] border border-[rgba(169,191,165,0.3)] px-3 py-1.5 rounded-[2px] text-[10px] font-mono text-[#E8E9D8] shadow-lg pointer-events-none z-30">
            <span className="text-[#A9BFA5]">June {hoveredCell.day} at {hoveredCell.hour}: </span>
            <span className="font-semibold text-white">
              {hoveredCell.intensity === 0 
                ? 'No client events' 
                : `${hoveredCell.intensity * 4 + 3} prospect interactions`}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
