import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

export interface PaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
  itemName?: string;
  className?: string;
  showPageSize?: boolean;
}

export default function Pagination({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [5, 10, 20],
  itemName = 'items',
  className = '',
  showPageSize = true
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);

  const startItem = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const endItem = Math.min(totalItems, safePage * pageSize);

  // Generate pagination window
  const getPageNumbers = (): (number | string)[] => {
    if (totalPages <= 6) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const pages: (number | string)[] = [];
    pages.push(1);

    if (safePage > 3) {
      pages.push('...');
    }

    const start = Math.max(2, safePage - 1);
    const end = Math.min(totalPages - 1, safePage + 1);

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (safePage < totalPages - 2) {
      pages.push('...');
    }

    pages.push(totalPages);
    return pages;
  };

  const pages = getPageNumbers();

  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 py-3.5 border-t border-[rgba(169,191,165,0.15)] bg-[#061816]/70 text-xs font-mono select-none ${className}`}
    >
      {/* Left side: Results Count and Page Size Selector */}
      <div className="flex flex-wrap items-center gap-3 text-[#A9BFA5]">
        <div>
          Showing{' '}
          <strong className="text-[#E8E9D8] font-medium">{startItem}</strong>–
          <strong className="text-[#E8E9D8] font-medium">{endItem}</strong> of{' '}
          <strong className="text-[#E8E9D8] font-medium">{totalItems}</strong>{' '}
          {itemName}
        </div>

        {showPageSize && onPageSizeChange && totalItems > 0 && (
          <div className="flex items-center space-x-1.5 pl-2 border-l border-[rgba(169,191,165,0.18)]">
            <span className="text-[10px] uppercase text-[#A9BFA5]/60 tracking-wider">
              Per page:
            </span>
            <select
              value={pageSize}
              onChange={(e) => {
                const newSize = Number(e.target.value);
                onPageSizeChange(newSize);
                onPageChange(1);
              }}
              className="bg-[#071C1A] border border-[rgba(169,191,165,0.25)] text-[#E8E9D8] text-[11px] px-2 py-0.5 rounded-[2px] focus:outline-none focus:border-[#A9BFA5] cursor-pointer"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt} className="bg-[#071C1A] text-[#E8E9D8]">
                  {opt}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Right side: Page Navigation Buttons */}
      {totalPages > 1 && (
        <div className="flex items-center space-x-1">
          {/* First Page Button */}
          <button
            type="button"
            onClick={() => onPageChange(1)}
            disabled={safePage === 1}
            title="First page"
            className="p-1 rounded-[2px] border border-[rgba(169,191,165,0.2)] bg-[#071C1A] text-[#A9BFA5] hover:text-[#E8E9D8] hover:border-[#A9BFA5] transition-colors disabled:opacity-25 disabled:cursor-not-allowed cursor-pointer"
          >
            <ChevronsLeft className="w-3.5 h-3.5" />
          </button>

          {/* Previous Page Button */}
          <button
            type="button"
            onClick={() => onPageChange(Math.max(1, safePage - 1))}
            disabled={safePage === 1}
            title="Previous page"
            className="p-1 px-1.5 rounded-[2px] border border-[rgba(169,191,165,0.2)] bg-[#071C1A] text-[#A9BFA5] hover:text-[#E8E9D8] hover:border-[#A9BFA5] transition-colors disabled:opacity-25 disabled:cursor-not-allowed cursor-pointer flex items-center space-x-0.5"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span className="hidden md:inline text-[11px] pr-0.5">Prev</span>
          </button>

          {/* Numbered Page Buttons */}
          <div className="flex items-center space-x-1 px-1">
            {pages.map((p, idx) => {
              if (p === '...') {
                return (
                  <span
                    key={`ellipsis-${idx}`}
                    className="px-1 text-[11px] text-[#A9BFA5]/40 select-none"
                  >
                    …
                  </span>
                );
              }

              const pageNum = p as number;
              const isActive = pageNum === safePage;

              return (
                <button
                  key={pageNum}
                  type="button"
                  onClick={() => onPageChange(pageNum)}
                  className={`min-w-6 h-6 px-1.5 rounded-[2px] text-[11px] font-mono transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-[#E8E9D8] text-[#071C1A] font-semibold shadow-sm'
                      : 'bg-[#071C1A] text-[#A9BFA5] border border-[rgba(169,191,165,0.2)] hover:border-[#A9BFA5] hover:text-[#E8E9D8]'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>

          {/* Next Page Button */}
          <button
            type="button"
            onClick={() => onPageChange(Math.min(totalPages, safePage + 1))}
            disabled={safePage === totalPages}
            title="Next page"
            className="p-1 px-1.5 rounded-[2px] border border-[rgba(169,191,165,0.2)] bg-[#071C1A] text-[#A9BFA5] hover:text-[#E8E9D8] hover:border-[#A9BFA5] transition-colors disabled:opacity-25 disabled:cursor-not-allowed cursor-pointer flex items-center space-x-0.5"
          >
            <span className="hidden md:inline text-[11px] pl-0.5">Next</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>

          {/* Last Page Button */}
          <button
            type="button"
            onClick={() => onPageChange(totalPages)}
            disabled={safePage === totalPages}
            title="Last page"
            className="p-1 rounded-[2px] border border-[rgba(169,191,165,0.2)] bg-[#071C1A] text-[#A9BFA5] hover:text-[#E8E9D8] hover:border-[#A9BFA5] transition-colors disabled:opacity-25 disabled:cursor-not-allowed cursor-pointer"
          >
            <ChevronsRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
