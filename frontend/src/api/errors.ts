import { isAxiosError } from 'axios'

/** The backend's error shape: `{ statusCode, message, error }`. */
interface ErrorBody {
  message?: string | string[]
}

/** The HTTP status of a failed request, or undefined if no response arrived. */
export function getErrorStatus(error: unknown): number | undefined {
  return isAxiosError(error) ? error.response?.status : undefined
}

/**
 * The messages to show for a failed request: the server's own when it sent
 * any, otherwise a description of what went wrong.
 */
export function getErrorMessages(error: unknown): string[] {
  if (isAxiosError<ErrorBody>(error)) {
    if (!error.response) {
      return ['Cannot reach the server. Check your connection and try again.']
    }
    const message = error.response.data?.message
    if (Array.isArray(message) && message.length > 0) {
      return message
    }
    if (typeof message === 'string' && message !== '') {
      return [message]
    }
  }
  return ['Something went wrong. Please try again.']
}
