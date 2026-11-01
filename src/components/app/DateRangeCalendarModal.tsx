import React, { useState, useEffect, useRef } from 'react';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  ChevronDown,
  X, 
  RotateCcw,
  Check
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

export type SortBasis = 'newest' | 'oldest' | 'priority' | 'value' | 'alphabetical';

export interface DateRangeSelection {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  sortBasis: SortBasis;
}

interface DateRangeCalendarModalProps {
  isOpen: boolean;
  title?: string;
  subtitle?: string;
  initialStartDate?: string;
  initialEndDate?: string;
  initialSortBasis?: SortBasis;
  onClose: () => void;
  onApply: (selection: DateRangeSelection) => void;
}

function formatDateISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseDateISO(str: string): Date {
  const parts = str.split('-').map(Number);
  if (parts.length === 3) {
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }
  return new Date();
}

function formatMMDDYYYY(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return '';
  return `${parts[1]}/${parts[2]}/${parts[0]}`;
}

const FULL_MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// Weekday row in Monday-first order as specified in requirements & reference image
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function DateRangeCalendarModal({
  isOpen,
  title = 'Date Range & Filter',
  subtitle = 'Select date range and sorting basis to filter workspace records.',
  initialStartDate = '2026-09-01',
  initialEndDate = '2026-10-06',
  initialSortBasis = 'newest',
  onClose,
  onApply
}: DateRangeCalendarModalProps) {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  // Range selection states
  const [startDate, setStartDate] = useState<string>(initialStartDate);
  const [endDate, setEndDate] = useState<string>(initialEndDate);
  const [hoverDate, setHoverDate] = useState<string | null>(null);
  const [selectingStep, setSelectingStep] = useState<'start' | 'end'>('start');
  const [sortBasis, setSortBasis] = useState<SortBasis>(initialSortBasis);

  // Popover open state
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  // Month & Year view state for the calendar
  const initialDateObj = parseDateISO(initialEndDate || initialStartDate || '2026-10-06');
  const [viewYear, setViewYear] = useState<number>(initialDateObj.getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(initialDateObj.getMonth());

  // Refs for click outside handling
  const popoverContainerRef = useRef<HTMLDivElement>(null);
  const inputButtonRef = useRef<HTMLButtonElement>(null);

  // Close popover when clicking outside of it (but keep modal open)
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!isPopoverOpen) return;
      const target = event.target as Node;
      if (
        popoverContainerRef.current && 
        !popoverContainerRef.current.contains(target) &&
        inputButtonRef.current &&
        !inputButtonRef.current.contains(target)
      ) {
        setIsPopoverOpen(false);
        setHoverDate(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isPopoverOpen]);

  // Sync on modal open
  useEffect(() => {
    if (isOpen) {
      setStartDate(initialStartDate);
      setEndDate(initialEndDate);
      setSortBasis(initialSortBasis);
      setSelectingStep('start');
      setHoverDate(null);
      setIsPopoverOpen(false);
      const d = parseDateISO(initialEndDate || initialStartDate || '2026-10-06');
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
    }
  }, [isOpen, initialStartDate, initialEndDate, initialSortBasis]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        if (isPopoverOpen) {
          setIsPopoverOpen(false);
        } else {
          onClose();
        }
      } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        handleApply();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isPopoverOpen, startDate, endDate, sortBasis]);

  if (!isOpen) return null;

  // Month navigation
  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(prev => prev - 1);
    } else {
      setViewMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(prev => prev + 1);
    } else {
      setViewMonth(prev => prev + 1);
    }
  };

  // Day click logic
  const handleDayClick = (dayISO: string) => {
    if (selectingStep === 'start') {
      setStartDate(dayISO);
      setEndDate('');
      setSelectingStep('end');
    } else {
      if (dayISO < startDate) {
        setStartDate(dayISO);
        setEndDate(startDate);
      } else {
        setEndDate(dayISO);
      }
      setSelectingStep('start');
      setHoverDate(null);
    }
  };

  // Build complete 35/42-cell calendar matrix with overflow days (Monday-first)
  const calendarCells = (() => {
    const firstDay = new Date(viewYear, viewMonth, 1);
    // Convert getDay() (Sunday=0, Monday=1, ..., Saturday=6) to Monday=0, ..., Sunday=6
    const startDayOfWeek = (firstDay.getDay() + 6) % 7;
    const daysInCurrentMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

    const cells: { dayNumber: number; iso: string; isCurrentMonth: boolean }[] = [];

    // Preceding month trailing days
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i;
      const prevDate = new Date(viewYear, viewMonth - 1, d);
      cells.push({
        dayNumber: d,
        iso: formatDateISO(prevDate),
        isCurrentMonth: false
      });
    }

    // Current month days
    for (let d = 1; d <= daysInCurrentMonth; d++) {
      const currDate = new Date(viewYear, viewMonth, d);
      cells.push({
        dayNumber: d,
        iso: formatDateISO(currDate),
        isCurrentMonth: true
      });
    }

    // Following month leading days to complete full weeks
    const totalCells = cells.length <= 35 ? 35 : 42;
    const remaining = totalCells - cells.length;
    for (let d = 1; d <= remaining; d++) {
      const nextDate = new Date(viewYear, viewMonth + 1, d);
      cells.push({
        dayNumber: d,
        iso: formatDateISO(nextDate),
        isCurrentMonth: false
      });
    }

    return cells;
  })();

  // Range and selection checks
  const isDateSelectedStart = (iso: string) => startDate === iso;
  const isDateSelectedEnd = (iso: string) => endDate === iso;

  const isDateInRange = (iso: string) => {
    if (startDate && endDate) {
      const s = startDate < endDate ? startDate : endDate;
      const e = startDate < endDate ? endDate : startDate;
      return iso >= s && iso <= e;
    }
    if (startDate && !endDate && hoverDate) {
      const min = startDate < hoverDate ? startDate : hoverDate;
      const max = startDate < hoverDate ? hoverDate : startDate;
      return iso >= min && iso <= max;
    }
    return false;
  };

  // Presets
  const applyPreset = (preset: 'today' | '7days' | '30days' | 'thisMonth') => {
    const ref = new Date('2026-10-06');
    let start = new Date(ref);
    let end = new Date(ref);

    switch (preset) {
      case 'today':
        break;
      case '7days':
        start.setDate(ref.getDate() - 6);
        break;
      case '30days':
        start.setDate(ref.getDate() - 29);
        break;
      case 'thisMonth':
        start = new Date(ref.getFullYear(), ref.getMonth(), 1);
        break;
    }

    const sISO = formatDateISO(start);
    const eISO = formatDateISO(end);
    setStartDate(sISO);
    setEndDate(eISO);
    setSelectingStep('start');
    setHoverDate(null);
    setViewYear(end.getFullYear());
    setViewMonth(end.getMonth());
  };

  const isPresetActive = (preset: 'today' | '7days' | '30days' | 'thisMonth') => {
    const ref = new Date('2026-10-06');
    let start = new Date(ref);
    let end = new Date(ref);

    switch (preset) {
      case 'today':
        break;
      case '7days':
        start.setDate(ref.getDate() - 6);
        break;
      case '30days':
        start.setDate(ref.getDate() - 29);
        break;
      case 'thisMonth':
        start = new Date(ref.getFullYear(), ref.getMonth(), 1);
        break;
    }

    return startDate === formatDateISO(start) && endDate === formatDateISO(end);
  };

  // Range days count
  const daysSelectedCount = (() => {
    if (!startDate || !endDate) return null;
    const s = parseDateISO(startDate < endDate ? startDate : endDate);
    const e = parseDateISO(startDate < endDate ? endDate : startDate);
    const diffTime = Math.abs(e.getTime() - s.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  })();

  // Reset to default
  const handleReset = () => {
    setStartDate('2026-09-01');
    setEndDate('2026-10-06');
    setSortBasis('newest');
    setSelectingStep('start');
    setHoverDate(null);
    setIsPopoverOpen(false);
    setViewYear(2026);
    setViewMonth(9); // October
  };

  // Submit / Apply
  const handleApply = () => {
    const finalStart = startDate || '2026-09-01';
    const finalEnd = endDate || startDate || '2026-10-06';
    onApply({
      startDate: finalStart <= finalEnd ? finalStart : finalEnd,
      endDate: finalStart <= finalEnd ? finalEnd : finalStart,
      sortBasis
    });
    onClose();
  };

  // Format the display string for the single date range input
  const dateRangeDisplayValue = (() => {
    if (startDate && endDate) {
      return `${formatMMDDYYYY(startDate)} – ${formatMMDDYYYY(endDate)}`;
    }
    if (startDate && !endDate) {
      return `${formatMMDDYYYY(startDate)} – Select end date`;
    }
    return 'MM/DD/YYYY – MM/DD/YYYY';
  })();

  const isToday = (iso: string) => iso === '2026-10-06';

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm animate-fadeIn"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div 
        className={`relative w-full max-w-lg p-6 sm:p-7 rounded-2xl shadow-2xl transition-colors duration-150 border ${
          isLight 
            ? 'bg-white border-slate-200 text-slate-900' 
            : 'bg-[#071C1A] border-[rgba(169,191,165,0.25)] text-[#E8E9D8]'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Close Button */}
        <button
          type="button"
          onClick={onClose}
          className={`absolute top-5 right-5 p-1.5 rounded-lg transition-colors cursor-pointer ${
            isLight 
              ? 'text-slate-400 hover:text-slate-700 hover:bg-slate-100' 
              : 'text-[#A9BFA5]/60 hover:text-[#E8E9D8] hover:bg-[#0D2D2A]'
          }`}
          aria-label="Close dialog"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="mb-5 pr-8">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-teal-600 dark:text-teal-400 block mb-1">
            Date Window Selection
          </span>
          <h2 className={`text-xl sm:text-2xl font-bold tracking-tight ${
            isLight ? 'text-slate-900' : 'text-white'
          }`}>
            {title}
          </h2>
          <p className={`text-xs mt-1 leading-relaxed ${isLight ? 'text-slate-500' : 'text-[#A9BFA5]'}`}>
            {subtitle}
          </p>
        </div>

        {/* Filter Form Controls */}
        <div className="space-y-4">
          
          {/* ========================================================
              SINGLE DATE RANGE INPUT WITH FLOATING COMPACT POPOVER
             ======================================================== */}
          <div className="relative">
            <label className={`block text-xs font-semibold mb-1.5 ${
              isLight ? 'text-slate-700' : 'text-[#E8E9D8]'
            }`}>
              Select date range
            </label>

            <button
              ref={inputButtonRef}
              type="button"
              id="date-range-single-input"
              onClick={() => setIsPopoverOpen(prev => !prev)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-sm font-sans transition-all cursor-pointer ${
                isPopoverOpen
                  ? isLight
                    ? 'border-teal-500 ring-2 ring-teal-500/20 bg-white text-slate-900 shadow-xs'
                    : 'border-teal-400 ring-2 ring-teal-400/20 bg-[#041210] text-white shadow-xs'
                  : isLight
                    ? 'border-slate-200 hover:border-slate-300 bg-white text-slate-900'
                    : 'border-[rgba(169,191,165,0.25)] hover:border-[rgba(169,191,165,0.4)] bg-[#041210] text-[#E8E9D8]'
              }`}
            >
              <span className={`tabular-nums ${
                startDate ? 'font-medium' : isLight ? 'text-slate-400' : 'text-[#A9BFA5]/50'
              }`}>
                {dateRangeDisplayValue}
              </span>

              <div className={`p-1 rounded-md transition-colors ${
                isPopoverOpen
                  ? isLight ? 'bg-teal-50 text-teal-600' : 'bg-teal-950/60 text-teal-300'
                  : isLight ? 'text-slate-400 hover:text-slate-600' : 'text-[#A9BFA5]/70 hover:text-white'
              }`}>
                <CalendarIcon className="w-4 h-4" />
              </div>
            </button>

            {/* ========================================================
                COMPACT CALENDAR POPOVER (Matched to Reference Image)
               ======================================================== */}
            {isPopoverOpen && (
              <div 
                ref={popoverContainerRef}
                className={`absolute top-full left-0 mt-2 z-50 w-full max-w-[360px] sm:w-[360px] p-4 rounded-xl border shadow-2xl animate-scaleUp transition-colors ${
                  isLight 
                    ? 'bg-white border-slate-200 text-slate-900 shadow-slate-300/40' 
                    : 'bg-[#071C1A] border-[rgba(169,191,165,0.25)] text-[#E8E9D8] shadow-black/80'
                }`}
                style={{
                  boxShadow: isLight 
                    ? '0 10px 25px -5px rgba(15, 23, 42, 0.1), 0 8px 10px -6px rgba(15, 23, 42, 0.1)' 
                    : '0 20px 25px -5px rgba(0, 0, 0, 0.6), 0 8px 10px -6px rgba(0, 0, 0, 0.6)'
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Popover Header: < Month Year > */}
                <div className="flex items-center justify-between pb-3 px-1">
                  <button
                    type="button"
                    onClick={handlePrevMonth}
                    className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                      isLight 
                        ? 'bg-slate-100 hover:bg-slate-200 text-slate-700' 
                        : 'bg-[#0D2D2A] hover:bg-[#133F3B] text-[#A9BFA5] hover:text-white'
                    }`}
                    aria-label="Previous month"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <div className="text-sm sm:text-base font-semibold tracking-tight">
                    {FULL_MONTH_NAMES[viewMonth]} {viewYear}
                  </div>

                  <button
                    type="button"
                    onClick={handleNextMonth}
                    className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                      isLight 
                        ? 'bg-slate-100 hover:bg-slate-200 text-slate-700' 
                        : 'bg-[#0D2D2A] hover:bg-[#133F3B] text-[#A9BFA5] hover:text-white'
                    }`}
                    aria-label="Next month"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                {/* Weekday Row: Mon Tue Wed Thu Fri Sat Sun */}
                <div className="grid grid-cols-7 text-center pb-2 pt-1 border-b" style={{
                  borderColor: isLight ? 'rgba(226, 232, 240, 0.7)' : 'rgba(169, 191, 165, 0.12)'
                }}>
                  {WEEKDAYS.map((w) => (
                    <span
                      key={w}
                      className={`text-xs font-medium ${
                        isLight ? 'text-slate-400' : 'text-[#A9BFA5]/60'
                      }`}
                    >
                      {w}
                    </span>
                  ))}
                </div>

                {/* Calendar Days 7-Column Grid with Continuous Range Highlight */}
                <div className="grid grid-cols-7 gap-y-1 pt-2">
                  {calendarCells.map((cell, idx) => {
                    const isStart = isDateSelectedStart(cell.iso);
                    const isEnd = isDateSelectedEnd(cell.iso);
                    const inRange = isDateInRange(cell.iso);
                    const isSelected = isStart || isEnd;
                    const colIndex = idx % 7; // 0=Mon, 6=Sun

                    // Determine continuous background connector bar
                    const showRightConnector = isStart && (
                      (endDate && endDate > startDate) || 
                      (hoverDate && hoverDate > startDate && selectingStep === 'end')
                    );
                    const showLeftConnector = isEnd && (
                      (startDate && startDate < endDate) || 
                      (hoverDate && hoverDate < startDate && selectingStep === 'end')
                    );

                    return (
                      <div
                        key={cell.iso}
                        className="h-9 flex items-center justify-center relative select-none"
                      >
                        {/* Background continuous range highlights */}
                        {inRange && !isSelected && (
                          <div 
                            className={`absolute inset-0 pointer-events-none ${
                              isLight ? 'bg-teal-100/80' : 'bg-teal-950/60'
                            } ${colIndex === 0 ? 'rounded-l-full' : ''} ${
                              colIndex === 6 ? 'rounded-r-full' : ''
                            }`} 
                          />
                        )}

                        {showRightConnector && (
                          <div 
                            className={`absolute right-0 top-0 bottom-0 w-1/2 pointer-events-none ${
                              isLight ? 'bg-teal-100/80' : 'bg-teal-950/60'
                            }`} 
                          />
                        )}

                        {showLeftConnector && (
                          <div 
                            className={`absolute left-0 top-0 bottom-0 w-1/2 pointer-events-none ${
                              isLight ? 'bg-teal-100/80' : 'bg-teal-950/60'
                            }`} 
                          />
                        )}

                        {/* Day Number Button */}
                        <button
                          type="button"
                          onClick={() => handleDayClick(cell.iso)}
                          onMouseEnter={() => {
                            if (selectingStep === 'end') setHoverDate(cell.iso);
                          }}
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium relative z-10 transition-all cursor-pointer ${
                            isSelected
                              ? isLight
                                ? 'bg-teal-600 text-white font-semibold shadow-sm ring-2 ring-teal-600/30'
                                : 'bg-teal-500 text-slate-950 font-bold shadow-sm ring-2 ring-teal-400/40'
                              : inRange
                              ? isLight 
                                ? 'text-teal-950 font-semibold' 
                                : 'text-teal-200 font-semibold'
                              : cell.isCurrentMonth
                              ? isLight
                                ? 'text-slate-800 hover:bg-slate-100 font-normal'
                                : 'text-[#E8E9D8] hover:bg-[#0D2D2A] font-normal'
                              : isLight
                                ? 'text-slate-300 hover:bg-slate-50'
                                : 'text-[#A9BFA5]/25 hover:bg-[#0D2D2A]/20'
                          }`}
                        >
                          {cell.dayNumber}
                          {isToday(cell.iso) && !isSelected && (
                            <span className="absolute bottom-1 w-1 h-1 rounded-full bg-teal-600 dark:bg-teal-400" />
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Popover Footer helper */}
                <div className="flex items-center justify-between pt-3 mt-2 border-t text-[11px]" style={{
                  borderColor: isLight ? 'rgba(226, 232, 240, 0.7)' : 'rgba(169, 191, 165, 0.12)'
                }}>
                  <span className={isLight ? 'text-slate-500' : 'text-[#A9BFA5]/70'}>
                    {selectingStep === 'end' ? 'Click end date' : 'Range selected'}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setIsPopoverOpen(false);
                      setHoverDate(null);
                    }}
                    className="text-teal-600 dark:text-teal-400 font-semibold hover:underline cursor-pointer px-1 py-0.5"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Range Duration Summary Badge */}
          {daysSelectedCount !== null && (
            <div className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-xs font-medium border ${
              isLight 
                ? 'bg-teal-50/70 border-teal-200/80 text-teal-800' 
                : 'bg-teal-950/30 border-teal-800/40 text-teal-300'
            }`}>
              <Check className="w-3.5 h-3.5 shrink-0 text-teal-600 dark:text-teal-400" />
              <span>
                <strong>{daysSelectedCount} days</strong> selected ({startDate.slice(5)} → {endDate.slice(5)})
              </span>
            </div>
          )}

          {/* Sorting Basis Select */}
          <div className="space-y-1.5">
            <label className={`block text-xs font-semibold ${
              isLight ? 'text-slate-700' : 'text-[#E8E9D8]'
            }`}>
              Sort Basis
            </label>
            <div className="relative">
              <select
                value={sortBasis}
                onChange={(e) => setSortBasis(e.target.value as SortBasis)}
                className={`w-full px-3.5 py-2.5 rounded-xl border text-xs sm:text-sm font-sans focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 cursor-pointer appearance-none transition-colors ${
                  isLight 
                    ? 'bg-white border-slate-200 text-slate-800' 
                    : 'bg-[#041210] border-[rgba(169,191,165,0.2)] text-[#E8E9D8]'
                }`}
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="priority">Priority (High to Low)</option>
                <option value="value">Deal Value (High to Low)</option>
                <option value="alphabetical">Alphabetical (A → Z)</option>
              </select>

              <ChevronDown className={`w-4 h-4 absolute right-3 top-3 pointer-events-none ${
                isLight ? 'text-slate-400' : 'text-[#A9BFA5]'
              }`} />
            </div>
          </div>

          {/* Quick Presets (Chips matching Overview & Inbox) */}
          <div className="pt-1 space-y-2">
            <span className={`block text-[11px] font-semibold uppercase tracking-wider ${
              isLight ? 'text-slate-500' : 'text-[#A9BFA5]/80'
            }`}>
              Quick Presets
            </span>
            <div className="flex flex-wrap gap-2">
              {[
                { id: 'today', label: 'Today' },
                { id: '7days', label: 'Last 7 Days' },
                { id: '30days', label: 'Last 30 Days' },
                { id: 'thisMonth', label: 'This Month' }
              ].map(p => {
                const active = isPresetActive(p.id as any);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => applyPreset(p.id as any)}
                    className={`px-3 py-1.5 text-xs rounded-lg border font-medium transition-all cursor-pointer ${
                      active
                        ? isLight
                          ? 'bg-teal-50 text-teal-700 border-teal-300 font-semibold shadow-2xs'
                          : 'bg-[#0D2D2A] border-teal-500/50 text-teal-200 font-semibold'
                        : isLight
                          ? 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
                          : 'bg-[#041210] border-[rgba(169,191,165,0.2)] text-[#A9BFA5] hover:border-teal-500/50 hover:text-white'
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

        </div>

        {/* Modal Footer Actions: Reset, Cancel & Apply */}
        <div className="flex items-center justify-between pt-6 mt-5 border-t" style={{
          borderColor: isLight ? 'rgba(226, 232, 240, 0.8)' : 'rgba(169, 191, 165, 0.15)'
        }}>
          <button
            type="button"
            onClick={handleReset}
            className={`flex items-center space-x-1.5 text-xs transition-colors cursor-pointer px-2 py-1.5 rounded-lg ${
              isLight 
                ? 'text-slate-500 hover:text-slate-800 hover:bg-slate-100' 
                : 'text-[#A9BFA5]/70 hover:text-white hover:bg-[#0D2D2A]'
            }`}
            title="Reset date range to default"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>

          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={onClose}
              className={`text-xs sm:text-sm font-medium transition-colors cursor-pointer px-3.5 py-2 rounded-lg border ${
                isLight 
                  ? 'border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-white' 
                  : 'border-[rgba(169,191,165,0.2)] text-[#A9BFA5] hover:text-white hover:bg-[#0D2D2A]'
              }`}
            >
              Cancel
            </button>

            <button
              type="button"
              id="calendar-apply-btn"
              onClick={handleApply}
              className={`text-xs sm:text-sm font-semibold transition-all cursor-pointer px-5 py-2 rounded-lg shadow-sm flex items-center space-x-1.5 ${
                isLight
                  ? 'bg-teal-600 hover:bg-teal-700 text-white'
                  : 'bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold'
              }`}
            >
              <Check className="w-4 h-4" />
              <span>Apply Range</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
