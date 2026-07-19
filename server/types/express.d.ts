declare global {
  namespace Express {
    interface Request {
      userId?: string
      adminId?: string
      extensionUserId?: string
      extensionSessionId?: string
      requestId: string
    }
  }
}

export {}
