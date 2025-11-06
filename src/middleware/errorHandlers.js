/**
 * 404 handler for data routes
 */
export function notFoundHandler(req, res) {
  res.status(404).json({
    error: "Not found",
    message: "The requested resource does not exist"
  });
}

/**
 * Global error handler
 */
export function globalErrorHandler(err, req, res, next) {
  console.error("❌ Unhandled error:", err);

  if (err.type === 'entity.too.large') {
    return res.status(413).json({
      error: "Payload too large",
      message: `Request size exceeds limit`
    });
  }

  res.status(500).json({
    error: "Internal server error",
    message: process.env.NODE_ENV === 'production'
      ? "An unexpected error occurred"
      : err.message
  });
}
