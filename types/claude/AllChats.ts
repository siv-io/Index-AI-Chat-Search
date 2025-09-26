export type AllChats = Root2[]

export interface Root2 {
  thread_number: number
  last_query_datetime: string
  mode: string
  context_uuid: string
  uuid: string
  frontend_uuid: string
  slug: string
  title: string
  first_answer: string
  thread_access: number
  has_next_page: boolean
  status: string
  first_entry_model_preference: string
  display_model: string
  expiry_time: any
  source: string
  source_metadata: any
  thread_status: string
  is_mission_control: any
  stream_created_at: any
  unread: boolean
  query_count: number
  search_focus: string
  search_recency_filter: any
  sources: string[]
  featured_images: any[]
  read_write_token: string
  total_threads: number
  social_info: SocialInfo
}

export interface SocialInfo {
  view_count: number
  fork_count: number
  like_count: number
  user_likes: boolean
}
