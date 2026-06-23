'use client'

import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: React.ReactNode
  className?: string
}

export function Modal({ open, onOpenChange, title, description, children, className }: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 animate-fade-in" />
        <Dialog.Content
          className={cn(
            'fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50',
            'w-full max-w-lg bg-cosmos-900 border border-white/10 rounded-2xl shadow-2xl',
            'animate-fade-in max-h-[90vh] overflow-y-auto',
            className,
          )}
        >
          <div className="flex items-start justify-between p-5 border-b border-white/5">
            <div>
              <Dialog.Title className="text-base font-semibold text-white">{title}</Dialog.Title>
              {description && (
                <Dialog.Description className="text-xs text-white/55 mt-0.5">{description}</Dialog.Description>
              )}
            </div>
            <Dialog.Close asChild>
              <button className="btn-ghost p-1 rounded-lg -mr-1 -mt-1">
                <X className="w-4 h-4" />
              </button>
            </Dialog.Close>
          </div>
          <div className="p-5">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
