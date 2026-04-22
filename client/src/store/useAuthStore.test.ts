import { describe, it, expect } from 'vitest';
import { MFARequiredError } from './useAuthStore';

describe('MFARequiredError', () => {
  it('MFA 토큰과 메서드를 포함', () => {
    const err = new MFARequiredError('test-token', ['totp'], false);
    expect(err.name).toBe('MFARequiredError');
    expect(err.mfaToken).toBe('test-token');
    expect(err.mfaMethods).toEqual(['totp']);
    expect(err.webAuthnEnabled).toBe(false);
    expect(err instanceof Error).toBe(true);
  });

  it('기본값: mfaMethods=[], webAuthnEnabled=false', () => {
    const err = new MFARequiredError('token');
    expect(err.mfaMethods).toEqual([]);
    expect(err.webAuthnEnabled).toBe(false);
  });

  it('WebAuthn 활성화 상태', () => {
    const err = new MFARequiredError('token', ['webauthn', 'totp'], true);
    expect(err.mfaMethods).toContain('webauthn');
    expect(err.webAuthnEnabled).toBe(true);
  });
});
