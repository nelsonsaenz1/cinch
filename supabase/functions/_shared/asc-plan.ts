import { PRODUCT_PLANS, type Plan } from './superwall-plan.ts';

/**
 * What an App Store Server Notification (V2) means for a user's plan.
 *
 * The forwarding rearrangement (docs/superwall/webhook-nondelivery-handoff.md,
 * 2026-08-26): Apple now posts notifications to OUR `asc-notifications`
 * function, which forwards the unmodified body to Superwall and — because
 * Superwall's own dispatcher has never delivered a webhook to us — ALSO settles
 * the plan directly from Apple's word. This module is that settlement's
 * decision table, split out for the same reason `superwall-plan.ts` was:
 * dependency-free, so the node suite executes every branch instead of reading
 * them.
 *
 * The product mapping is NOT duplicated — `PRODUCT_PLANS` is imported from the
 * Superwall module, so the two pipelines can never disagree about what a
 * product grants.
 *
 * ── The philosophy, inherited ───────────────────────────────────────────────
 *
 * Same rules as the Superwall table, translated to Apple's vocabulary:
 *
 *   - Turning OFF auto-renew is not a revocation. `DID_CHANGE_RENEWAL_STATUS`
 *     changes nothing; the user keeps what they paid for until `EXPIRED`.
 *   - A failed charge is not a revocation. `DID_FAIL_TO_RENEW` opens Apple's
 *     retry/grace machinery; if it fails for good, `EXPIRED` or
 *     `GRACE_PERIOD_EXPIRED` arrives on its own.
 *   - `DID_CHANGE_RENEWAL_PREF` grants only on subtype `UPGRADE`, because an
 *     upgrade takes effect immediately with the new product; a downgrade
 *     applies at the next renewal, which `DID_RENEW` will report with the new
 *     productId when it happens.
 *   - `REFUND_REVERSED` re-grants: Apple decided the refund should not have
 *     happened, so the entitlement comes back.
 */

/** Notification types that mean "entitled right now, to this product". */
export const ASC_GRANTING: ReadonlySet<string> = new Set([
  'SUBSCRIBED',
  'DID_RENEW',
  'OFFER_REDEEMED',
  'RENEWAL_EXTENDED',
  'REFUND_REVERSED',
]);

/** Notification types that end the entitlement. */
export const ASC_REVOKING: ReadonlySet<string> = new Set([
  'EXPIRED',
  'GRACE_PERIOD_EXPIRED',
  'REVOKE',
  'REFUND',
]);

export type AscVerdict =
  | { kind: 'grant'; plan: Plan }
  | { kind: 'no_change' }
  | { kind: 'unmapped'; productId: string | null };

export function ascVerdict(
  type: string,
  subtype: string | null | undefined,
  productId: string | null | undefined,
): AscVerdict {
  if (ASC_REVOKING.has(type)) return { kind: 'grant', plan: 'free' };

  const granting =
    ASC_GRANTING.has(type) || (type === 'DID_CHANGE_RENEWAL_PREF' && subtype === 'UPGRADE');
  if (!granting) return { kind: 'no_change' };

  const mapped = productId ? PRODUCT_PLANS[productId] : undefined;
  if (!mapped) return { kind: 'unmapped', productId: productId ?? null };
  return { kind: 'grant', plan: mapped };
}

/**
 * Apple Root CA - G3, DER, base64 — the pinned trust anchor for every signed
 * payload this pipeline accepts.
 *
 * Fetched 2026-08-26 from https://www.apple.com/certificateauthority/
 * AppleRootCA-G3.cer; SHA-256 63:34:3A:BF:B8:9A:6A:03:EB:B5:7E:9B:3F:5F:A7:BE:
 * 7C:4F:5C:75:6F:30:17:B3:A8:C4:88:C3:65:3E:91:79, matching Apple's published
 * fingerprint. Valid to 2039. The verifier requires the x5c chain's root to be
 * BYTE-IDENTICAL to this value — an x5c is attacker-supplied input, and a chain
 * that merely "looks like Apple's" proves nothing.
 */
export const APPLE_ROOT_CA_G3_B64 =
  'MIICQzCCAcmgAwIBAgIILcX8iNLFS5UwCgYIKoZIzj0EAwMwZzEbMBkGA1UEAwwSQXBwbGUgUm9vdCBDQSAtIEczMSYwJAYDVQQLDB1BcHBsZSBDZXJ0aWZpY2F0aW9uIEF1dGhvcml0eTETMBEGA1UECgwKQXBwbGUgSW5jLjELMAkGA1UEBhMCVVMwHhcNMTQwNDMwMTgxOTA2WhcNMzkwNDMwMTgxOTA2WjBnMRswGQYDVQQDDBJBcHBsZSBSb290IENBIC0gRzMxJjAkBgNVBAsMHUFwcGxlIENlcnRpZmljYXRpb24gQXV0aG9yaXR5MRMwEQYDVQQKDApBcHBsZSBJbmMuMQswCQYDVQQGEwJVUzB2MBAGByqGSM49AgEGBSuBBAAiA2IABJjpLz1AcqTtkyJygRMc3RCV8cWjTnHcFBbZDuWmBSp3ZHtfTjjTuxxEtX/1H7YyYl3J6YRbTzBPEVoA/VhYDKX1DyxNB0cTddqXl5dvMVztK517IDvYuVTZXpmkOlEKMaNCMEAwHQYDVR0OBBYEFLuw3qFYM4iapIqZ3r6966/ayySrMA8GA1UdEwEB/wQFMAMBAf8wDgYDVR0PAQH/BAQDAgEGMAoGCCqGSM49BAMDA2gAMGUCMQCD6cHEFl4aXTQY2e3v9GwOAEZLuN+yRhHFD/3meoyhpmvOwgPUnPWTxnS4at+qIxUCMG1mihDK1A3UT82NQz60imOlM27jbdoXt2QfyFMm+YhidDkLF1vLUagM6BgD56KyKA==';

/**
 * Where forwarded notifications go — Superwall's App Store Connect intake, the
 * exact URL their dashboard's "Event Forwarding" setup prints for this app.
 * The `pk` is the same publishable key that was previously pasted into ASC's
 * server-notification URL fields directly (publishable by construction, like
 * the SDK key).
 */
export const SUPERWALL_FORWARD_URL =
  'https://integrations.superwall.com/integrations/app-store-connect/webhook?pk=pk_4b232d84ff2f6e73c982c0939e20ca8ffed708e962fe09d3';
