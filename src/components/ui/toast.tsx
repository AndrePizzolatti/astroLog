'use client'

import * as Toast from '@radix-ui/react-toast'
import { createContext, useContext, useState, useCallback } from 'react'
import { CheckCircle, XCircle, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ToastItem {
  id: string
  type: 'success' | 'error'
  message: string
}

interface ToastContextValue {
  toast: (message: string, type?: 'success' | 'error') => void
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} })

export function useToast() {
  return useContext(ToastContext)
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const toast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    const id = Math.random().toString(36).slice(2)
    setToasts(prev => [...prev, { id, type, message }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000)
  }, [])

  return (
    <ToastContext.Provider value={{ toast }}>
      <Toast.Provider swipeDirection="right">
        {children}
        {toasts.map(item => (
          <Toast.Root
            key={item.id}
            open
            onOpenChange={() => setToasts(prev => prev.filter(t => t.id !== item.id))}
            className={cn(
              'flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border text-sm',
              'data-[state=open]:animate-fade-in',
              item.type === 'success'
                ? 'bg-aurora-400/10 border-aurora-400/30 text-white'
                : 'bg-red-500/10 border-red-500/30 text-white',
            )}
          >
            {item.type === 'success'
              ? <CheckCircle className="w-4 h-4 text-aurora-400 shrink-0" />
              : <XCircle className="w-4 h-4 text-red-400 shrink-0" />}
            <Toast.Description className="flex-1">{item.message}</Toast.Description>
            <Toast.Close>
              <X className="w-3.5 h-3.5 text-white/55 hover:text-white" />
            </Toast.Close>
          </Toast.Root>
        ))}
        <Toast.Viewport className="fixed bottom-4 right-4 flex flex-col gap-2 w-80 z-50" />
      </Toast.Provider>
    </ToastContext.Provider>
  )
}
