export interface ApiSession {
  accessToken: string
  authProvider: string
  expires: string
  user: {
    email: string
    groups: string[]
    iat: number
    id: string
    idp: string
    image: string
    intercom_hash: string
    mfa: boolean
    name: string
    picture: string
  }
}

export interface ApiAccountsCheckAccountDetail {
  account_user_role: string
  account_user_id: string | null
  processor: Record<string, boolean>
  account_id: string | null
  organization_id?: string | null
  is_most_recent_expired_subscription_gratis: boolean
  has_previously_paid_subscription: boolean
  name?: string | null
  profile_picture_id?: string | null
  profile_picture_url?: string | null
  structure: "workspace" | "personal"
  plan_type: "team" | "free"
  is_deactivated: boolean
  promo_data: Record<string, unknown>
}

export interface ApiAccountsCheckEntitlement {
  subscription_id?: string | null
  has_active_subscription?: boolean
  subscription_plan?: "chatgptteamplan" | "chatgptplusplan"
  expires_at?: string | null
  billing_period?: "monthly" | string | null
}

export interface ApiAccountsCheckAccount {
  account: ApiAccountsCheckAccountDetail
  features: string[]
  entitlement: ApiAccountsCheckEntitlement
  last_active_subscription?: Record<string, unknown> | null
  is_eligible_for_yearly_plus_subscription: boolean
}

export interface ApiAccountsCheck {
  accounts: {
    [key: string]: ApiAccountsCheckAccount
  }
  account_ordering: string[]
}
