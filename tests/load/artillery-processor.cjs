/**
 * Processor Artillery — en-tête Bearer pour /api/messages si LOAD_TEST_JWT est défini.
 */
function addAuthIfAny(reqParams, context, ee, next) {
  const t = process.env.LOAD_TEST_JWT || '';
  if (t) {
    reqParams.headers = reqParams.headers || {};
    reqParams.headers.Authorization = `Bearer ${t}`;
  }
  return next();
}

module.exports = { addAuthIfAny };
