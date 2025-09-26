export type ClaudeChat = ChatNode[]

// export interface ChatNode {
//   uuid: string
//   name: string
//   summary: string
//   model: any
//   created_at: string
//   updated_at: string
//   settings: Settings
//   is_starred: boolean
//   is_temporary: boolean
//   project_uuid: any
//   current_leaf_message_uuid?: string
//   project: any
// }

// export interface Settings {
//   enabled_bananagrams: any
//   enabled_web_search?: boolean
//   enabled_compass: any
//   enabled_sourdough: any
//   enabled_foccacia: any
//   enabled_mcp_tools: any
//   compass_mode: any
//   paprika_mode: any
//   enabled_monkeys_in_a_barrel?: boolean
//   enabled_saffron: any
//   create_mode: any
//   preview_feature_uses_artifacts: boolean
//   preview_feature_uses_latex: any
//   preview_feature_uses_citations: any
//   enabled_drive_search: any
//   enabled_artifacts_attachments: any
//   enabled_turmeric: any
// }

export interface ChatNode {
  chat_messages: ChatMessage[]
  created_at: string
  current_leaf_message_uuid: string
  is_starred: boolean
  is_temporary: boolean
  name: string
  settings: Settings
  summary: string
  updated_at: string
  uuid: string
}

export interface ChatMessage {
  attachments: Attachment[]
  created_at: string
  files: any[]
  files_v2: any[]
  index: number
  parent_message_uuid: string
  sender: string
  sync_sources: any[]
  text: string
  truncated: boolean
  updated_at: string
  uuid: string
  input_mode?: string
  stop_reason?: string
}

export interface Attachment {
  created_at: string
  extracted_content: string
  file_name: string
  file_size: number
  file_type: string
  id: string
}

export interface Settings {
  enabled_monkeys_in_a_barrel: boolean
  enabled_web_search: boolean
  preview_feature_uses_artifacts: boolean
}
