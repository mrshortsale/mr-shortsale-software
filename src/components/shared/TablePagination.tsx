import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const DEFAULT_PAGE_SIZES = [10, 25, 50, 100] as const;

export interface TablePaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: readonly number[];
  disabled?: boolean;
  className?: string;
}

export default function TablePagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = DEFAULT_PAGE_SIZES,
  disabled = false,
  className = '',
}: TablePaginationProps) {
  const { t, i18n } = useTranslation();
  const loc = i18n.language === 'es' ? 'es-MX' : 'en-US';
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, total);
  const [pageInput, setPageInput] = useState(String(page));

  useEffect(() => {
    setPageInput(String(page));
  }, [page]);

  useEffect(() => {
    if (page > totalPages) onPageChange(totalPages);
  }, [page, totalPages, onPageChange]);

  const goToPage = (next: number) => {
    const clamped = Math.min(totalPages, Math.max(1, next));
    if (clamped !== page) onPageChange(clamped);
    else setPageInput(String(clamped));
  };

  const applyPageInput = () => {
    const n = parseInt(pageInput.trim(), 10);
    if (!Number.isFinite(n)) {
      setPageInput(String(page));
      return;
    }
    goToPage(n);
  };

  if (total <= 0) return null;

  return (
    <div
      className={`px-3 py-2.5 text-[11px] text-muted-foreground bg-muted border-t flex flex-wrap items-center justify-between gap-3 ${className}`}
    >
      <span>
        {t('inventory.pagination.showing')} {rangeStart.toLocaleString(loc)}–{rangeEnd.toLocaleString(loc)}{' '}
        {t('inventory.pagination.of')} {total.toLocaleString(loc)}
      </span>

      <div className="flex items-center gap-1.5">
        {onPageSizeChange && (
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            disabled={disabled}
            title={t('inventory.buttons.rowsPerPage')}
            aria-label={t('inventory.buttons.rowsPerPage')}
            className="px-2 py-1 rounded border bg-card text-xs font-bold text-foreground outline-none focus:ring-1 focus:ring-primary disabled:opacity-40"
          >
            {pageSizeOptions.map((n) => (
              <option key={n} value={n}>
                {n}/page
              </option>
            ))}
          </select>
        )}

        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <span className="font-medium">{t('inventory.pagination.page')}</span>
          <input
            type="number"
            min={1}
            max={totalPages}
            value={pageInput}
            onChange={(e) => setPageInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                applyPageInput();
              }
            }}
            onBlur={applyPageInput}
            disabled={disabled || totalPages <= 1}
            aria-label={t('inventory.buttons.goToPage')}
            className="w-10 px-1 py-0.5 text-xs text-center font-bold text-foreground border rounded bg-card outline-none focus:ring-1 focus:ring-primary disabled:opacity-40"
          />
        </span>

        <button
          type="button"
          onClick={() => goToPage(page - 1)}
          disabled={page <= 1 || disabled}
          aria-label={t('inventory.pagination.previousPage')}
          className="px-2 py-1 rounded border bg-card hover:bg-background disabled:opacity-40 flex items-center gap-0.5 font-bold text-foreground"
        >
          <ChevronLeft size={14} /> {t('inventory.buttons.prev')}
        </button>

        <span className="px-2 py-1 font-medium text-foreground tabular-nums whitespace-nowrap">
          {t('inventory.pagination.page')} {page.toLocaleString(loc)} {t('inventory.pagination.of')}{' '}
          {totalPages.toLocaleString(loc)}
        </span>

        <button
          type="button"
          onClick={() => goToPage(page + 1)}
          disabled={page >= totalPages || disabled}
          aria-label={t('inventory.pagination.nextPage')}
          className="px-2 py-1 rounded border bg-card hover:bg-background disabled:opacity-40 flex items-center gap-0.5 font-bold text-foreground"
        >
          {t('inventory.buttons.next')} <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}
