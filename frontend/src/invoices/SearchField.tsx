import SearchIcon from '@mui/icons-material/Search'
import InputAdornment from '@mui/material/InputAdornment'
import TextField from '@mui/material/TextField'
import { useEffect, useRef, useState } from 'react'

export const SEARCH_DEBOUNCE_MS = 300

interface SearchFieldProps {
  /** The search currently applied. */
  value: string
  /** Called with the trimmed text once typing pauses. Must be a stable function. */
  onSearch(keyword: string): void
}

/**
 * A search box that reports what was typed only after a short pause, so the
 * list is not re-fetched on every keystroke.
 */
export function SearchField({ value, onSearch }: SearchFieldProps) {
  const [text, setText] = useState(value)
  // What this field last reported, to tell its own updates from outside ones.
  const lastSent = useRef(value)

  // The applied search changed elsewhere (e.g. "Clear filters"): show it.
  useEffect(() => {
    if (value !== lastSent.current) {
      lastSent.current = value
      setText(value)
    }
  }, [value])

  useEffect(() => {
    const keyword = text.trim()
    if (keyword === lastSent.current) {
      return
    }
    const timer = setTimeout(() => {
      lastSent.current = keyword
      onSearch(keyword)
    }, SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [text, onSearch])

  return (
    <TextField
      label="Search"
      placeholder="Invoice number or customer name"
      type="search"
      size="small"
      fullWidth
      value={text}
      onChange={(event) => setText(event.target.value)}
      slotProps={{
        input: {
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" />
            </InputAdornment>
          ),
        },
      }}
    />
  )
}
