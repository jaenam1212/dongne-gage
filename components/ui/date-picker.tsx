'use client'

import * as React from 'react'
import { DayPicker } from 'react-day-picker'
import { ko } from 'react-day-picker/locale'
import { Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'

type DatePickerProps = {
  name: string
  defaultValue?: string
  min?: string
  placeholder?: string
  className?: string
  inputClassName?: string
}

function toDate(str: string): Date | undefined {
  if (!str) return undefined
  const d = new Date(str + 'T12:00:00')
  return isNaN(d.getTime()) ? undefined : d
}

function toYYYYMMDD(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function DatePicker({
  name,
  defaultValue = '',
  min,
  placeholder = '날짜 선택',
  className,
  inputClassName,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)
  const [value, setValue] = React.useState(defaultValue)
  const containerRef = React.useRef<HTMLDivElement>(null)

  const selected = value ? toDate(value) : undefined
  const minDate = min ? toDate(min) : undefined

  React.useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const displayText = value
    ? toDate(value)?.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
    : placeholder

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <input type="hidden" name={name} value={value} readOnly />
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex h-9 w-full items-center gap-2 rounded-md border border-stone-200 bg-stone-50 px-3 py-1 text-left text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-stone-400 focus-visible:ring-[3px] focus-visible:ring-stone-400/30 md:text-sm',
          !value && 'text-stone-400',
          inputClassName
        )}
      >
        <Calendar className="h-4 w-4 shrink-0 text-stone-400" />
        <span className="truncate">{displayText}</span>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 rounded-xl border border-stone-200 bg-white p-3 shadow-lg">
          <DayPicker
            mode="single"
            locale={ko}
            selected={selected}
            onSelect={(date) => {
              if (date) {
                setValue(toYYYYMMDD(date))
                setOpen(false)
              }
            }}
            disabled={minDate ? { before: minDate } : undefined}
            defaultMonth={selected ?? minDate ?? new Date()}
            classNames={{
              root: 'p-0',
              months: 'flex flex-col',
              month: 'flex flex-col gap-3',
              month_caption: 'flex items-center justify-between h-9 px-1',
              caption_label: 'text-sm font-semibold text-stone-900',
              nav: 'flex items-center gap-1',
              button_previous: 'h-8 w-8 rounded-lg border border-stone-200 bg-white hover:bg-stone-50 inline-flex items-center justify-center text-stone-600',
              button_next: 'h-8 w-8 rounded-lg border border-stone-200 bg-white hover:bg-stone-50 inline-flex items-center justify-center text-stone-600',
              month_grid: 'w-full',
              weekdays: 'flex',
              weekday: 'w-9 flex items-center justify-center text-[11px] font-medium text-stone-500',
              weeks: 'flex flex-col gap-0.5',
              week: 'flex',
              day: 'w-9 h-9 flex items-center justify-center p-0',
              day_button:
                'h-9 w-9 rounded-lg text-sm font-medium text-stone-700 hover:bg-stone-100 focus:bg-stone-100 outline-none disabled:opacity-40 disabled:pointer-events-none',
              selected: '!bg-stone-900 !text-white hover:!bg-stone-800 focus:!bg-stone-800',
              today: 'font-semibold text-stone-900',
              outside: 'text-stone-300',
              disabled: 'opacity-40 cursor-not-allowed',
            }}
          />
        </div>
      )}
    </div>
  )
}
