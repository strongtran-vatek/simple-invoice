import { createContext, useContext } from 'react'

export interface Notification {
  message: string
  /** An optional link shown beside the message, e.g. to the thing just created. */
  action?: { label: string; to: string }
}

export type Notify = (notification: Notification) => void

export const NotificationContext = createContext<Notify | null>(null)

/**
 * Returns a function that shows a brief success message. The message outlives
 * the page that raised it, so it can be shown across a redirect.
 */
export function useNotify(): Notify {
  const notify = useContext(NotificationContext)
  if (!notify) {
    throw new Error('useNotify must be used inside <NotificationProvider>')
  }
  return notify
}
