jest.mock('../../../src/lib/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const mockLogAction = jest.fn().mockResolvedValue({ _id: 'a1' });
jest.mock('../../../src/services/auditService', () => ({
  logAction: (...a) => mockLogAction(...a),
}));

describe('jobs submitAuditLog sans Bull', () => {
  const orig = process.env.BULL_JOBS_ENABLED;

  afterEach(() => {
    if (orig === undefined) delete process.env.BULL_JOBS_ENABLED;
    else process.env.BULL_JOBS_ENABLED = orig;
    jest.resetModules();
    mockLogAction.mockClear();
  });

  it('délègue à auditService.logAction si BULL_JOBS_ENABLED absent', async () => {
    delete process.env.BULL_JOBS_ENABLED;
    const { submitAuditLog } = require('../../../src/jobs');
    await submitAuditLog({
      userId: '507f1f77bcf86cd799439011',
      action: 'update-user',
      resource: 'user',
      resourceId: '507f1f77bcf86cd799439011',
    });
    expect(mockLogAction).toHaveBeenCalledTimes(1);
    expect(mockLogAction.mock.calls[0][0].action).toBe('update-user');
  });
});
