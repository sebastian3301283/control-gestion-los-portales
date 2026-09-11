import type { CollaborationLocation } from './matrix-realtime-presence.js'

export type RealtimeChangePayload = {
  eventType?: 'INSERT' | 'UPDATE' | 'DELETE' | string
  new?: Record<string, unknown>
  old?: Record<string, unknown>
}

export function matrixIdFromChange(payload: RealtimeChangePayload): string
export function parentRowIdFromChange(payload: RealtimeChangePayload): string
export function shouldRefreshMatrix(payload: RealtimeChangePayload, activeMatrixId: string): boolean
export function sameCollaborationLocation(left: CollaborationLocation | null, right: CollaborationLocation | null): boolean
