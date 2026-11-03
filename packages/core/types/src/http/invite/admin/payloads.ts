export type AdminAcceptInvite = {
  /**
   * The user's email.
   */
  email?: string | null
  /**
   * The user's first name.
   */
  first_name?: string | null
  /**
   * The user's last name.
   */
  last_name?: string | null
}

export type AdminCreateInvite = {
  /**
   * The email of the user to invite.
   */
  email: string
  /**
   * Key-value pairs of custom data.
   */
  metadata?: Record<string, unknown> | null
}
