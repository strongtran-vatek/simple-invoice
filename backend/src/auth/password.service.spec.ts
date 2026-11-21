import { PasswordService } from './password.service.js';

// The lowest bcrypt cost keeps these tests fast; production uses 10.
const passwords = new PasswordService(4);

describe('PasswordService', () => {
  it('stores a bcrypt hash, never the password itself', async () => {
    const hashed = await passwords.hash('correct horse');

    expect(hashed).toMatch(/^\$2[aby]\$04\$/);
    expect(hashed).not.toContain('correct horse');
  });

  it('accepts the right password', async () => {
    const hashed = await passwords.hash('correct horse');

    await expect(passwords.verify('correct horse', hashed)).resolves.toBe(true);
  });

  it('rejects a wrong password', async () => {
    const hashed = await passwords.hash('correct horse');

    await expect(passwords.verify('wrong horse', hashed)).resolves.toBe(false);
  });

  it('rejects any password when there is no stored hash', async () => {
    await expect(passwords.verify('anything', undefined)).resolves.toBe(false);
    await expect(passwords.verify('anything', null)).resolves.toBe(false);
  });

  it('does not accept the placeholder password for a missing user', async () => {
    await expect(
      passwords.verify('placeholder-password', undefined),
    ).resolves.toBe(false);
  });
});
