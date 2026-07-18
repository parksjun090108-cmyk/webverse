declare global {
  namespace Express {
    interface Request {
      userId?: string
      extensionUserId?: string
      extensionSessionId?: string
      requestId: string
    }
  }
}

export {}
