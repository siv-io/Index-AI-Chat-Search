interface ConversationNodeMessage {
  author: {
    role: "system" | "assistant" | "user" | "tool"
    name?: string
    metadata: unknown
  }
  content: {
    content_type: string
    parts?: string[]
    text?: string
    language?: string
    [key: string]: any
  }
  create_time?: number
  update_time?: number
  id: string
  metadata?: {
    model_slug?: string
    [key: string]: any
  }
  recipient: string
  status: string
  end_turn?: boolean
  weight: number
}

interface ConversationNode {
  children: string[]
  id: string
  message?: ConversationNodeMessage
  parent?: string
}

export interface ApiConversation {
  create_time: number
  conversation_id?: string
  current_node: string
  mapping: {
    [key: string]: ConversationNode
  }
  moderation_results: unknown[]
  title: string
  is_archived: boolean
  update_time: number
  safe_urls?: string[]
}

export interface ApiConversationWithId extends ApiConversation {
  id: string
}
