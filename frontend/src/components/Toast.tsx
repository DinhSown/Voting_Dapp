import type { Toast as ToastType } from '../types'

interface Props {
  toast: ToastType | null
}

const colorMap = {
  success: 'bg-green-500/20 border-green-500/40 text-green-300',
  error: 'bg-red-500/20 border-red-500/40 text-red-300',
  info: 'bg-blue-500/20 border-blue-500/40 text-blue-300',
}

export function Toast({ toast }: Props) {
  if (!toast) return null
  return (
    <div
      className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl border backdrop-blur-md text-sm font-medium shadow-lg transition-all ${colorMap[toast.type]}`}
    >
      {toast.message}
    </div>
  )
}
