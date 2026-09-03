export type CollaborationLocation = {
  field?: string
  subpoint?: string
  row?: string
}

export type MatrixPresenceUser = {
  user_id: string
  name: string
  email: string
  location: CollaborationLocation | null
}

export function flattenPresenceState(state?: Record<string, unknown[]>): MatrixPresenceUser[]
export function collaborationLocationLabel(location?: CollaborationLocation | null): string
