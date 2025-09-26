export interface ApiConversationItem {
  id: string
  title: string
  create_time: number
}

export interface ApiConversations {
  has_missing_conversations: boolean
  items: ApiConversationItem[]
  limit: number
  offset: number
  total: number | null
}
