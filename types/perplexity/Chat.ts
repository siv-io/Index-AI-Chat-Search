export interface PerplexityChat {
  status: string
  entries: Entry[]
  has_next_page: boolean
  next_cursor: any
}

export interface Entry {
  backend_uuid: string
  context_uuid: string
  uuid: string
  frontend_context_uuid: string
  frontend_uuid: string
  status: string
  thread_title: string
  related_queries: string[]
  display_model: string
  user_selected_model: string
  personalized: boolean
  mode: string
  query_str: string
  search_focus: string
  source: string
  attachments: any[]
  updated_datetime: string
  read_write_token: string
  is_pro_reasoning_mode: boolean
  step_type: string
  author_id?: string
  author_username?: string
  author_image?: string
  bookmark_state?: string
  s3_social_preview_url: string
  thread_access: number
  thread_url_slug: string
  query_source: string
  privacy_state: string
  gpt4: boolean
  sources: Sources
  entry_updated_datetime: string
  blocks: Block[]
  related_query_items: RelatedQueryItem[]
  access_level: string
  answer_modes: AnswerMode[]
  reconnectable: boolean
  classifier_results: ClassifierResults
  search_implementation_mode: string
  social_info?: SocialInfo
  featured_images?: any[]
  should_index: boolean
}

export interface Sources {
  sources: string[]
}

export interface Block {
  intended_usage: string
  plan_block?: PlanBlock
  markdown_block?: MarkdownBlock
  web_result_block?: WebResultBlock
  sources_mode_block?: SourcesModeBlock
  media_block?: MediaBlock
}

export interface PlanBlock {
  progress: string
  goals: Goal[]
  final: boolean
  steps?: Step[]
}

export interface Goal {
  id: string
  description: string
  final: boolean
  todo_task_status: string
}

export interface Step {
  uuid: string
  step_type: string
  initial_query_content?: InitialQueryContent
  search_web_content?: SearchWebContent
  web_results_content?: WebResultsContent
}

export interface InitialQueryContent {
  query: string
}

export interface SearchWebContent {
  goal_id: string
  queries: Query[]
}

export interface Query {
  engine: string
  query: string
  limit: number
}

export interface WebResultsContent {
  goal_id: string
  web_results: WebResult[]
}

export interface WebResult {
  name: string
  url: string
  snippet: string
  is_attachment: boolean
  meta_data: MetaData
  is_memory: boolean
  is_conversation_history: boolean
  is_navigational: boolean
  is_focused_web: boolean
}

export interface MetaData {
  client: string
  date?: string
  citation_domain_name: string
  suffix: string
  domain_name?: string
  description?: string
  published_date?: string
}

export interface MarkdownBlock {
  progress: string
  chunks: string[]
  chunk_starting_offset: number
  answer: string
}

export interface WebResultBlock {
  progress: string
  web_results: WebResult2[]
}

export interface WebResult2 {
  name: string
  snippet: string
  timestamp: string
  url: string
  meta_data: MetaData2
  is_attachment: boolean
  is_image: boolean
  is_code_interpreter: boolean
  is_knowledge_card: boolean
  is_navigational: boolean
  is_widget: boolean
  is_focused_web: boolean
  is_client_context: boolean
  is_memory: boolean
  is_conversation_history: boolean
}

export interface MetaData2 {
  date?: string
  citation_domain_name: string
  domain_name?: string
  images: string[]
  client: string
  description?: string
  suffix: string
  published_date?: string
}

export interface SourcesModeBlock {
  answer_mode_type: string
  progress: string
  web_results: WebResult3[]
  result_count: number
  rows: Row[]
}

export interface WebResult3 {
  name: string
  snippet: string
  timestamp: string
  url: string
  meta_data: MetaData3
  is_attachment: boolean
  is_image: boolean
  is_code_interpreter: boolean
  is_knowledge_card: boolean
  is_navigational: boolean
  is_widget: boolean
  is_focused_web: boolean
  is_client_context: boolean
  is_memory: boolean
  is_conversation_history: boolean
}

export interface MetaData3 {
  date?: string
  citation_domain_name: string
  domain_name?: string
  images: string[]
  client: string
  description?: string
  suffix: string
  published_date?: string
}

export interface Row {
  web_result: WebResult4
  status: string
  citation: number
}

export interface WebResult4 {
  name: string
  snippet: string
  timestamp: string
  url: string
  meta_data: MetaData4
  is_attachment: boolean
  is_image: boolean
  is_code_interpreter: boolean
  is_knowledge_card: boolean
  is_navigational: boolean
  is_widget: boolean
  is_focused_web: boolean
  is_client_context: boolean
  is_memory: boolean
  is_conversation_history: boolean
}

export interface MetaData4 {
  date?: string
  citation_domain_name: string
  domain_name?: string
  images: string[]
  client: string
  description?: string
  suffix: string
  published_date?: string
}

export interface MediaBlock {
  media_items: MediaItem[]
  generated_media_items: any[]
}

export interface MediaItem {
  medium: string
  image: string
  image_width: number
  image_height: number
  url: string
  name: string
  source: string
  thumbnail: string
  thumbnail_height: number
  thumbnail_width: number
}

export interface RelatedQueryItem {
  text: string
  type: string
}

export interface AnswerMode {
  answer_mode_type: string
}

export interface ClassifierResults {
  personal_search: boolean
  skip_search: boolean
  widget_type: string
  hide_nav: boolean
  hide_sources: boolean
  image_generation: boolean
  time_widget: boolean
}

export interface SocialInfo {
  view_count: number
  fork_count: number
  like_count: number
  user_likes: boolean
}
