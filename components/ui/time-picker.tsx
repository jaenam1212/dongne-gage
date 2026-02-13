'use client'

import * as React from 'react'
import TimePicker from 'react-time-picker'
import { Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import 'react-time-picker/dist/TimePicker.css'
import 'react-clock/dist/Clock.css'

type TimePickerFieldProps = {
  name: string
  defaultValue?: string
  placeholder?: string
  className?: string
  inputClassName?: string
}

function formatDisplay(value: string | null): string {
  if (!value) return ''
  const parts = value.split(':')
  const h = parts[0]
  const m = parts[1] || '00'
  return `${h.padStart(2, '0')}:${m.padStart(2, '0')}`
}

export function TimePickerField({
  name,
  defaultValue = '',
  placeholder = '시간 선택 (선택)',
  className,
  inputClassName,
}: TimePickerFieldProps) {
  const [open, setOpen] = React.useState(false)
  const [value, setValue] = React.useState<string | null>(defaultValue || null)
  const containerRef = React.useRef<HTMLDivElement>(null)

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

  const displayText = value ? formatDisplay(value) : placeholder

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <input type="hidden" name={name} value={value || ''} readOnly />
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex h-9 w-full items-center gap-2 rounded-md border border-stone-200 bg-stone-50 px-3 py-1 text-left text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-stone-400 focus-visible:ring-[3px] focus-visible:ring-stone-400/30 md:text-sm',
          !value && 'text-stone-400',
          inputClassName
        )}
      >
        <Clock className="h-4 w-4 shrink-0 text-stone-400" />
        <span className="truncate">{displayText}</span>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 rounded-xl border border-stone-200 bg-white p-3 shadow-lg [&_.react-time-picker]:!border-0 [&_.react-time-picker__wrapper]:!rounded-lg [&_.react-time-picker__wrapper]:!border-stone-200">
          <TimePicker
            onChange={(v) => {
              setValue(v as string | null)
              setOpen(false)
            }}
            value={value}
            format="HH:mm"
            clockIcon={null}
            clearIcon={null}
            locale="ko-KR"
            isOpen={true}
            closeClock={true}
            className="!border-0"
          />
        </div>
      )}
    </div>
  )
}
