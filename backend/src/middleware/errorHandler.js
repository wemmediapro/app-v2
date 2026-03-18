/**
 * Middleware Express de gestion des erreurs (4 arguments : err, req, res, next).
 * À placer après les routes ; capte les erreurs passées à next(err).
 */
function errorHandler(err, req, res, next) {
  const status = err.status ?? err.statusCode ?? res.statusCode ?? 500;
  const message = err.message ?? 'Internal Server Error';
  if (status >= 500) {
    console.error('[errorHandler]', status, req.method, req.url, message);
    if (err.stack) console.error(err.stack);
  }
  res.status(status).json({
    message: status >= 500 ? 'Internal Server Error' : message,
    ...(process.env.NODE_ENV !== 'production' && { error: message }),
  });
}

module.exports = { errorHandler };
