/**
 * 404 handler for data routes
 */
export function notFoundHandler(req, res) {
  res.status(404).json({
    error: 'Not found',
    message: 'The requested resource does not exist',
  });
}

/**
 * Global error handler
 */
export function globalErrorHandler(err, req, res, next) {
  // Log only safe fields. Full err objects can carry request bodies, query
  // params, or row values that include credentials or PII.
  const safeFields = {
    message: err.message,
    code: err.code,
    name: err.name,
    statusCode: err.statusCode,
    method: req?.method,
    path: req?.path,
  };
  if (process.env.NODE_ENV !== 'production' && err.stack) {
    safeFields.stack = err.stack.split('\n').slice(0, 5).join('\n');
  }
  console.error('❌ Unhandled error:', safeFields);

  if (err.type === 'entity.too.large') {
    return res.status(413).json({
      error: 'Payload too large',
      message: `Request size exceeds limit`,
    });
  }

  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'production' ? 'An unexpected error occurred' : err.message,
  });
}
