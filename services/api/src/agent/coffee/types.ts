export interface ReadRecentPersonasInput {
  limit?: number
}

export interface ProposePeerMatchInput {
  userAId: string
  userBId: string
  rationale: string
  initialMessage: string
}

export interface RelayMessageInput {
  threadId: string
  content: string
}
