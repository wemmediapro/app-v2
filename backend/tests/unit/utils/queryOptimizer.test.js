const { withSecondaryRead } = require('../../../src/utils/queryOptimizer');

describe('queryOptimizer', () => {
  test('withSecondaryRead appelle .read secondaryPreferred', () => {
    const q = { read: jest.fn().mockReturnThis() };
    const out = withSecondaryRead(q);
    expect(q.read).toHaveBeenCalledWith('secondaryPreferred');
    expect(out).toBe(q);
  });

  test('withSecondaryRead laisse passer un mock sans .read (tests unitaires)', () => {
    const q = { select: jest.fn().mockReturnThis() };
    expect(withSecondaryRead(q)).toBe(q);
  });
});
