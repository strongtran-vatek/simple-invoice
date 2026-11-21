import { validateEnvironment } from './env.validation.js';

const valid = {
  DB_HOST: 'localhost',
  DB_PORT: '5432',
  DB_USER: 'user',
  DB_PASSWORD: 'password',
  DB_NAME: 'database',
  JWT_SECRET: 'a'.repeat(32),
  FRONTEND_ORIGIN: 'http://localhost:8080',
};

describe('validateEnvironment', () => {
  it('converts numeric variables from strings', () => {
    const environment = validateEnvironment({ ...valid, BACKEND_PORT: '4000' });

    expect(environment.DB_PORT).toBe(5432);
    expect(environment.BACKEND_PORT).toBe(4000);
  });

  it('defaults the token lifetime to 3600 seconds', () => {
    expect(validateEnvironment(valid).JWT_EXPIRES_IN).toBe(3600);
  });

  it('defaults the port to 3000 and the timezone to UTC', () => {
    const environment = validateEnvironment(valid);

    expect(environment.BACKEND_PORT).toBe(3000);
    expect(environment.APP_TIMEZONE).toBe('UTC');
  });

  it('treats an empty variable as unset', () => {
    const environment = validateEnvironment({ ...valid, JWT_EXPIRES_IN: '' });

    expect(environment.JWT_EXPIRES_IN).toBe(3600);
  });

  it('rejects a missing JWT secret', () => {
    const { JWT_SECRET: _omitted, ...withoutSecret } = valid;

    expect(() => validateEnvironment(withoutSecret)).toThrow(/JWT_SECRET/);
  });

  it('rejects a JWT secret shorter than 32 characters', () => {
    expect(() =>
      validateEnvironment({ ...valid, JWT_SECRET: 'short' }),
    ).toThrow(/JWT_SECRET/);
  });

  it('rejects a non-numeric token lifetime', () => {
    expect(() =>
      validateEnvironment({ ...valid, JWT_EXPIRES_IN: 'one hour' }),
    ).toThrow(/JWT_EXPIRES_IN/);
  });

  it('rejects an unknown timezone', () => {
    expect(() =>
      validateEnvironment({ ...valid, APP_TIMEZONE: 'Mars/Olympus' }),
    ).toThrow(/APP_TIMEZONE/);
  });

  it('lists every problem at once', () => {
    expect(() => validateEnvironment({})).toThrow(
      /DB_HOST[\s\S]*DB_PORT[\s\S]*JWT_SECRET/,
    );
  });
});
