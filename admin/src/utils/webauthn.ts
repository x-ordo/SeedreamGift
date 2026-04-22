/**
 * @file webauthn.ts
 * @description WebAuthn (Passkey) browser API utilities
 *
 * Handles base64url <-> ArrayBuffer conversion and wraps the
 * navigator.credentials.create / .get calls so callers only deal
 * with plain JSON objects that can be sent straight to the server.
 */

// ── Encoding helpers ──────────────────────────────────────────

/** Convert a base64url-encoded string to an ArrayBuffer. */
function base64urlToBuffer(base64url: string): ArrayBuffer {
  let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4 !== 0) base64 += '=';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/** Convert an ArrayBuffer (or Uint8Array) to a base64url string. */
function bufferToBase64url(buffer: ArrayBuffer | ArrayLike<number>): string {
  const bytes = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// ── Public API ────────────────────────────────────────────────

export interface WebAuthnRegistrationResult {
  id: string;
  rawId: string;
  type: string;
  response: {
    attestationObject: string;
    clientDataJSON: string;
  };
}

export interface WebAuthnAuthenticationResult {
  id: string;
  rawId: string;
  type: string;
  response: {
    authenticatorData: string;
    clientDataJSON: string;
    signature: string;
    userHandle: string;
  };
}

export async function startWebAuthnRegistration(
  serverOptions: any,
): Promise<WebAuthnRegistrationResult> {
  const options: PublicKeyCredentialCreationOptions = {
    ...serverOptions,
    challenge: base64urlToBuffer(serverOptions.challenge),
    user: {
      ...serverOptions.user,
      id: base64urlToBuffer(serverOptions.user.id),
    },
    excludeCredentials: (serverOptions.excludeCredentials || []).map(
      (cred: any) => ({
        ...cred,
        id: base64urlToBuffer(cred.id),
      }),
    ),
  };

  const credential = (await navigator.credentials.create({
    publicKey: options,
  })) as PublicKeyCredential | null;

  if (!credential) {
    throw new Error('패스키 등록이 취소되었습니다');
  }

  const attestationResponse = credential.response as AuthenticatorAttestationResponse;

  return {
    id: credential.id,
    rawId: bufferToBase64url(credential.rawId),
    type: credential.type,
    response: {
      attestationObject: bufferToBase64url(attestationResponse.attestationObject),
      clientDataJSON: bufferToBase64url(attestationResponse.clientDataJSON),
    },
  };
}

export async function startWebAuthnAuthentication(
  serverOptions: any,
): Promise<WebAuthnAuthenticationResult> {
  const options: PublicKeyCredentialRequestOptions = {
    ...serverOptions,
    challenge: base64urlToBuffer(serverOptions.challenge),
    allowCredentials: (serverOptions.allowCredentials || []).map(
      (cred: any) => ({
        ...cred,
        id: base64urlToBuffer(cred.id),
      }),
    ),
  };

  const credential = (await navigator.credentials.get({
    publicKey: options,
  })) as PublicKeyCredential | null;

  if (!credential) {
    throw new Error('패스키 인증이 취소되었습니다');
  }

  const assertionResponse = credential.response as AuthenticatorAssertionResponse;

  return {
    id: credential.id,
    rawId: bufferToBase64url(credential.rawId),
    type: credential.type,
    response: {
      authenticatorData: bufferToBase64url(assertionResponse.authenticatorData),
      clientDataJSON: bufferToBase64url(assertionResponse.clientDataJSON),
      signature: bufferToBase64url(assertionResponse.signature),
      userHandle: assertionResponse.userHandle
        ? bufferToBase64url(assertionResponse.userHandle)
        : '',
    },
  };
}

export function isWebAuthnSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    !!window.PublicKeyCredential
  );
}
