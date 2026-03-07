'use client'

import type { SyncStatus } from '@/hooks/use-sync'
import { Wifi, WifiOff, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface SyncStatusProps {
  status: SyncStatus
  /** Extra CSS classes on the outer element */
  className?: string
}

const statusConfig: Record<
  SyncStatus,
  { icon: React.ElementType; label: string; color: string; animate?: boolean }
> = {
  idle: {
    icon: Wifi,
    label: 'Not connected',
    color: 'text-muted-foreground',
  },
  connecting: {
    icon: RefreshCw,
    label: 'Connecting…',
    color: 'text-yellow-500',
    animate: true,
  },
  connected: {
    icon: CheckCircle2,
    label: 'Live – changes sync in real time',
    color: 'text-green-500',
  },
  offline: {
    icon: WifiOff,
    label: 'Offline – changes will sync when reconnected',
    color: 'text-orange-500',
  },
  error: {
    icon: AlertCircle,
    label: 'Sync error – reconnecting…',
    color: 'text-red-500',
    animate: true,
  },
}

/**
 * SyncStatus – small icon that shows the current real-time sync state.
 * Renders a Tooltip with a human-readable description on hover.
 */
export default function SyncStatus({ status, className = '' }: SyncStatusProps) {
  const cfg = statusConfig[status]
  const Icon = cfg.icon

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={`inline-flex items-center gap-1 text-xs ${cfg.color} ${className}`}
            aria-label={cfg.label}
          >
            <Icon
              size={14}
              className={cfg.animate ? 'animate-spin' : undefined}
            />
            <span className="sr-only">{cfg.label}</span>
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p className="text-xs">{cfg.label}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
