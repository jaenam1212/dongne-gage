'use client'

import * as React from 'react'
import { Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

type TimePickerFieldProps = {
  name: string
  defaultValue?: string
  placeholder?: string
  className?: string
  inputClassName?: string
}

function normalizeTimeValue(raw: string | undefined): string {
  if (!raw) return ''
  const [h, m] = raw.split(':')
  if (h == null || m == null) return ''
  const hour = Number(h)
  const minute = Number(m)
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return ''
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return ''
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

export function TimePickerField({
  name,
  defaultValue = '',
  placeholder = '시간 선택 (선택)',
  className,
  inputClassName,
}: TimePickerFieldProps) {
  const [value, setValue] = React.useState<string>(normalizeTimeValue(defaultValue))

  React.useEffect(() => {
    setValue(normalizeTimeValue(defaultValue))
  }, [defaultValue])

  return (
    <div className={cn('relative', className)}>
      <div
        className={cn(
          'flex h-9 w-full items-center gap-2 rounded-md border border-stone-200 bg-stone-50 px-3 py-1 shadow-xs transition-[color,box-shadow] focus-within:border-stone-400 focus-within:ring-[3px] focus-within:ring-stone-400/30',
          inputClassName
        )}
      >
        <Clock className="h-4 w-4 shrink-0 text-stone-400" />
        <input
          type="time"
          name={name}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          step={60}
          aria-label={placeholder}
          className="h-full w-full border-0 bg-transparent text-sm text-stone-900 outline-none"
        />
        {value ? (
          <button
            type="button"
            onClick={() => setValue('')}
            className="shrink-0 rounded px-1 py-0.5 text-xs text-stone-500 hover:bg-stone-200 hover:text-stone-700"
          >
            초기화
          </button>
        ) : null}
      </div>
    </div>
  )
}
