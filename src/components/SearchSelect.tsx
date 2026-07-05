import { useRef, useState } from 'react'

interface Option {
  id: number
  label: string
  sublabel?: string
}

interface Props {
  options: Option[]
  value: number
  onChange: (id: number) => void
  placeholder?: string
  className?: string
}

export default function SearchSelect({ options, value, onChange, placeholder, className }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const blurTimeout = useRef<number | undefined>(undefined)

  const selected = options.find((o) => o.id === value)
  const filtered =
    query.trim() === ''
      ? options
      : options.filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase()))

  function selectOption(id: number) {
    onChange(id)
    setQuery('')
    setOpen(false)
  }

  return (
    <div className="relative">
      <input
        value={open ? query : (selected?.label ?? '')}
        placeholder={placeholder ?? '검색...'}
        onFocus={() => {
          setOpen(true)
          setQuery('')
        }}
        onChange={(e) => setQuery(e.target.value)}
        onBlur={() => {
          blurTimeout.current = window.setTimeout(() => setOpen(false), 150)
        }}
        className={
          className ??
          'w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800'
        }
      />
      {open && (
        <ul
          onMouseDown={(e) => {
            e.preventDefault()
            if (blurTimeout.current) window.clearTimeout(blurTimeout.current)
          }}
          className="absolute z-20 mt-1 max-h-52 w-full overflow-y-auto rounded-lg border border-neutral-200 bg-white shadow-lg dark:border-neutral-700 dark:bg-neutral-800"
        >
          {filtered.length === 0 && (
            <li className="px-3 py-2 text-sm text-neutral-400">검색 결과 없음</li>
          )}
          {filtered.map((o) => (
            <li key={o.id}>
              <button
                type="button"
                onClick={() => selectOption(o.id)}
                className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm ${
                  o.id === value
                    ? 'bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300'
                    : 'text-neutral-700 dark:text-neutral-300'
                }`}
              >
                <span>{o.label}</span>
                {o.sublabel && <span className="text-xs text-neutral-400">{o.sublabel}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
