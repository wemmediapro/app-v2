const Feedback = require('../../../src/models/Feedback');
const { feedbackValid } = require('../../fixtures');

describe('Feedback model', () => {
  it('rejette sans user / type / category / title / description', () => {
    const f = new Feedback({});
    const err = f.validateSync();
    expect(err.errors.user).toBeDefined();
    expect(err.errors.type).toBeDefined();
    expect(err.errors.category).toBeDefined();
    expect(err.errors.title).toBeDefined();
    expect(err.errors.description).toBeDefined();
  });

  it('accepte un feedback valide', () => {
    const f = new Feedback(feedbackValid);
    expect(f.validateSync()).toBeUndefined();
  });

  it('title max 100', () => {
    const f = new Feedback({
      ...feedbackValid,
      title: 'x'.repeat(101),
    });
    const err = f.validateSync();
    expect(err.errors.title).toBeDefined();
  });

  it('priority enum', () => {
    const f = new Feedback({
      ...feedbackValid,
      priority: 'mega',
    });
    const err = f.validateSync();
    expect(err.errors.priority).toBeDefined();
  });

  it('indexes status+priority+createdAt', () => {
    const idx = Feedback.schema.indexes().map((x) => x[0]);
    expect(idx.some((fields) => fields.status === 1 && fields.priority === 1)).toBe(true);
  });
});
