"use client";

/**
 * The capture screen.
 *
 * Three steps, in the order they happen:
 *
 *   ACCEPT   The human confirms they are near the store and gives the address
 *            the money should go to. This redeems the single-use link.
 *   CAPTURE  A photo and a location fix. The photo is downscaled in the
 *            browser and uploaded DIRECTLY to Storage, so the image bytes
 *            never pass through a function.
 *   RESULT   Six rules, green or red, and — if they are all green — the
 *            payout.
 *
 * The rule set is not shown to the human as a set of things they must satisfy.
 * It is shown as the reason money did or did not move. That is the whole
 * product: an agent's question, a human's answer, and a deterministic verdict.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { distanceMetersOrNull, formatDistance } from "@/domain/geo";
import { Badge, Button, Field, Input, Money, Panel, PanelHeader, RuleRow } from "@/components/ui/primitives";
import { makeDemoPhoto, preparePhoto, type PreparedPhoto } from "./photo";

export interface ClaimBountyView {
  id: string;
  sku: string;
  storeName: string;
  storeAddress: string;
  storeLat: number;
  storeLng: number;
  radiusM: number;
  expectedValueCents: number;
  tolerancePct: number;
  rewardCents: number;
  currency: string;
  status: string;
  expiresAt: string;
  claimedByEmail: string | null;
}

export type ClaimLinkState = "valid" | "replaced" | "redeemed";

interface RuleCheck {
  id: string;
  label: string;
  passed: boolean;
  expected: string;
  actual: string;
  detail: string;
}

interface PayoutInfo {
  status: string;
  amountCents: number;
  currency: string;
  payeeEmail: string;
  senderBatchId: string;
  externalId: string | null;
}

interface SubmitResult {
  success: boolean;
  bountyId: string;
  status: string;
  passed: boolean;
  checks: RuleCheck[];
  failedRuleIds: string[];
  payout: PayoutInfo | null;
  error?: { code: string; message: string };
}

interface Fix {
  lat: number;
  lng: number;
  accuracy: number;
}

const GPS_MESSAGES: Record<number, string> = {
  1: "Location permission was denied. Allow it in your browser settings, or type the coordinates in.",
  2: "Your location is not available right now. Type the coordinates in instead.",
  3: "Finding your location took too long. Type the coordinates in instead.",
};

export function ClaimCapture({
  token,
  bounty,
  linkState,
}: {
  token: string;
  bounty: ClaimBountyView;
  linkState: ClaimLinkState;
}) {
  const [phase, setPhase] = useState<"accept" | "capture" | "result">(
    bounty.status === "POSTED" && linkState === "valid" ? "accept" : "capture",
  );
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SubmitResult | null>(null);

  const [fix, setFix] = useState<Fix | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [manualMode, setManualMode] = useState(false);
  const [manualLat, setManualLat] = useState("");
  const [manualLng, setManualLng] = useState("");

  const [photo, setPhoto] = useState<PreparedPhoto | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<string | null>(null);

  // Release the preview object URL when the component goes away.
  useEffect(() => {
    return () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    };
  }, []);

  const requestLocation = useCallback(() => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setGpsError("This browser cannot report a location. Type the coordinates in.");
      setManualMode(true);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFix({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
        setGpsError(null);
      },
      (geoError) => {
        setGpsError(GPS_MESSAGES[geoError.code] ?? "Your location could not be read.");
        setManualMode(true);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }, []);

  useEffect(() => {
    if (phase !== "capture") return;
    requestLocation();
  }, [phase, requestLocation]);

  const distance =
    fix === null
      ? null
      : distanceMetersOrNull(
          { lat: fix.lat, lng: fix.lng },
          { lat: bounty.storeLat, lng: bounty.storeLng },
        );

  function resolvedFix(): Fix | null {
    if (fix) return fix;
    const lat = Number(manualLat);
    const lng = Number(manualLng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    // A manually typed coordinate is treated as exact. The human is telling us
    // where they are, and the honest accuracy of a typed number is unknown.
    return { lat, lng, accuracy: 0 };
  }

  async function accept() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/claim", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ op: "accept", token, email }),
      });
      const body = (await response.json()) as { error?: { message: string } };
      if (!response.ok) {
        throw new Error(body.error?.message ?? "This bounty could not be accepted.");
      }
      setPhase("capture");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "This bounty could not be accepted.");
    } finally {
      setBusy(false);
    }
  }

  async function onFileChosen(file: File | null | undefined) {
    if (!file) return;
    setPhotoError(null);
    setPreparing(true);
    try {
      const prepared = await preparePhoto(file);
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
      previewRef.current = prepared.previewUrl;
      setPhoto(prepared);
    } catch (caught) {
      setPhotoError(
        caught instanceof Error
          ? caught.message
          : "This image could not be read. Try taking the photo again, or use a JPEG.",
      );
      setPhoto(null);
    } finally {
      setPreparing(false);
    }
  }

  async function useDemoFixture() {
    setPhotoError(null);
    setPreparing(true);
    try {
      const prepared = await makeDemoPhoto(bounty.expectedValueCents, bounty.sku);
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
      previewRef.current = prepared.previewUrl;
      setPhoto(prepared);
      // The fixture is at the store, so the location is the store's.
      setFix({ lat: bounty.storeLat, lng: bounty.storeLng, accuracy: 5 });
      setManualMode(false);
      setGpsError(null);
    } catch (caught) {
      setPhotoError(
        caught instanceof Error ? caught.message : "The demo fixture could not be drawn.",
      );
    } finally {
      setPreparing(false);
    }
  }

  async function submit() {
    setError(null);

    if (!photo) {
      setError("Take a photo of the price tag first.");
      return;
    }
    const position = resolvedFix();
    if (!position) {
      setError("We need your location to prove you are at the store.");
      return;
    }

    setBusy(true);
    try {
      // 1. Ask the server for a signed upload URL bound to THIS bounty.
      const signResponse = await fetch("/api/uploads/sign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          token,
          kind: "full",
          contentType: photo.mime,
          bytes: photo.originalBytes,
        }),
      });
      const signed = (await signResponse.json()) as {
        signedUrl?: string;
        path?: string;
        error?: { message: string };
      };
      if (!signResponse.ok || !signed.signedUrl || !signed.path) {
        throw new Error(signed.error?.message ?? "The photo could not be prepared for upload.");
      }

      // 2. Upload the bytes straight to Storage. They never touch a function,
      //    so the platform body limit is irrelevant and the photo is not
      //    degraded to fit through one.
      const upload = await fetch(signed.signedUrl, {
        method: "PUT",
        headers: { "content-type": photo.mime, "x-upsert": "true" },
        body: photo.blob,
      });
      if (!upload.ok) {
        throw new Error("The photo could not be uploaded. Check your connection and retry.");
      }

      // 3. Submit the evidence.
      const claimResponse = await fetch("/api/claim", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          op: "submit",
          token,
          evidencePath: signed.path,
          thumbPath: null,
          bytes: photo.originalBytes,
          mime: photo.mime,
          sha256: null,
          capturedAt: new Date().toISOString(),
          lat: position.lat,
          lng: position.lng,
          accuracyM: Math.round(position.accuracy),
        }),
      });
      const body = (await claimResponse.json()) as SubmitResult;
      if (!claimResponse.ok) {
        throw new Error(body.error?.message ?? "The evidence could not be submitted.");
      }
      setResult(body);
      setPhase("result");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The evidence could not be submitted.");
    } finally {
      setBusy(false);
    }
  }

  // ------------------------------------------------------------------ accept
  if (phase === "accept") {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-4">
        <Panel>
          <PanelHeader title="A verification bounty" hint="You are being asked to prove one fact." />
          <div className="flex flex-col gap-3 p-4">
            <div>
              <p className="label">Prove that</p>
              <p className="mt-1 text-sm text-text">
                SKU <span className="num">{bounty.sku}</span> is on the shelf at{" "}
                <span className="font-medium">{bounty.storeName}</span> and the price tag reads{" "}
                <Money cents={bounty.expectedValueCents} currency={bounty.currency} className="text-sm" />{" "}
                <span className="text-faint">
                  (±{bounty.tolerancePct}%)
                </span>
              </p>
            </div>

            <div className="rounded-md border border-line bg-ink px-3 py-2">
              <p className="text-xs text-faint">{bounty.storeAddress}</p>
              <p className="num mt-1 text-[11px] text-faint">
                {bounty.storeLat.toFixed(4)}, {bounty.storeLng.toFixed(4)} · within {bounty.radiusM} m
              </p>
            </div>

            <div className="flex items-baseline justify-between rounded-md border border-money/30 bg-money/10 px-3 py-2">
              <span className="text-sm text-muted">You earn</span>
              <Money
                cents={bounty.rewardCents}
                currency={bounty.currency}
                tone="money"
                className="text-lg"
              />
            </div>

            <Field
              label="Your email"
              hint="PayPal Payouts sends the money here — it must be an address you control."
            >
              <Input
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </Field>

            {error ? (
              <p role="alert" className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
                {error}
              </p>
            ) : null}

            <Button
              variant="primary"
              size="lg"
              onClick={accept}
              disabled={busy || !email.includes("@")}
              className="w-full"
            >
              {busy ? "Accepting…" : "Accept and earn the reward"}
            </Button>

            <p className="text-[11px] leading-relaxed text-faint">
              Accepting redeems this link. It can be used once, and only the hash of it is ever
              stored.
            </p>
          </div>
        </Panel>
      </div>
    );
  }

  // ----------------------------------------------------------------- capture
  if (phase === "capture") {
    const accuracyOk = fix !== null && fix.accuracy <= bounty.radiusM;
    const withinRadius = distance !== null && distance <= bounty.radiusM;

    return (
      <div className="mx-auto flex max-w-md flex-col gap-4">
        <Panel>
          <PanelHeader
            title="Photograph the price tag"
            hint={`SKU ${bounty.sku} · ${bounty.storeName} · you earn ${(bounty.rewardCents / 100).toFixed(2)}`}
            action={
              <Badge tone={linkState === "redeemed" ? "info" : "neutral"}>
                {linkState === "redeemed" ? "accepted" : "live"}
              </Badge>
            }
          />

          <div className="flex flex-col gap-4 p-4">
            <div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                onChange={(event) => onFileChosen(event.target.files?.[0])}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex w-full flex-col items-center justify-center gap-2 rounded-md border border-dashed border-line-strong bg-ink px-4 py-8 text-center transition-colors hover:border-money/50"
              >
                {photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photo.previewUrl}
                    alt="The photo you are about to submit"
                    className="max-h-56 rounded border border-line object-contain"
                  />
                ) : (
                  <>
                    <span className="text-2xl text-faint">◎</span>
                    <span className="text-sm text-text">Take a photo of the price tag</span>
                    <span className="text-[11px] text-faint">
                      or choose one from your library
                    </span>
                  </>
                )}
              </button>

              {preparing ? (
                <p className="mt-2 text-center text-[11px] text-faint">Preparing the photo…</p>
              ) : null}

              {photo ? (
                <p className="num mt-2 text-center text-[11px] text-faint">
                  {photo.width}×{photo.height} · {(photo.bytes / 1024).toFixed(0)} KB uploaded ·{" "}
                  {(photo.originalBytes / 1024).toFixed(0)} KB original
                </p>
              ) : null}

              {photoError ? (
                <p className="mt-2 text-center text-[11px] text-danger">{photoError}</p>
              ) : null}
            </div>

            <div className="rounded-md border border-line bg-ink px-3 py-2">
              <div className="flex items-center justify-between">
                <span className="label">Location</span>
                {fix ? (
                  <Badge tone={accuracyOk ? "money" : "warn"}>
                    ±{Math.round(fix.accuracy)} m
                  </Badge>
                ) : null}
              </div>

              {fix ? (
                <p className="num mt-1 text-[11px] text-muted">
                  {fix.lat.toFixed(5)}, {fix.lng.toFixed(5)} · {formatDistance(distance)} from the
                  store{" "}
                  {withinRadius ? (
                    <span className="text-money">· inside the {bounty.radiusM} m radius</span>
                  ) : (
                    <span className="text-danger">· outside the {bounty.radiusM} m radius</span>
                  )}
                </p>
              ) : (
                <p className="mt-1 text-[11px] text-faint">Waiting for a location fix…</p>
              )}

              {gpsError ? <p className="mt-1 text-[11px] text-warn">{gpsError}</p> : null}

              {manualMode ? (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <Input
                    placeholder="latitude"
                    inputMode="decimal"
                    value={manualLat}
                    onChange={(event) => setManualLat(event.target.value)}
                    aria-label="Latitude"
                  />
                  <Input
                    placeholder="longitude"
                    inputMode="decimal"
                    value={manualLng}
                    onChange={(event) => setManualLng(event.target.value)}
                    aria-label="Longitude"
                  />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setManualMode(true)}
                  className="mt-1 text-[11px] text-muted underline-offset-2 hover:text-money hover:underline"
                >
                  Enter coordinates manually
                </button>
              )}
            </div>

            {error ? (
              <p role="alert" className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
                {error}
              </p>
            ) : null}

            <Button variant="primary" size="lg" onClick={submit} disabled={busy} className="w-full">
              {busy ? "Submitting…" : "Submit evidence and get paid"}
            </Button>

            <button
              type="button"
              onClick={useDemoFixture}
              disabled={preparing}
              className="text-[11px] text-faint underline-offset-2 transition-colors hover:text-money hover:underline"
            >
              No camera? Use the disclosed demo fixture instead
            </button>
          </div>
        </Panel>
      </div>
    );
  }

  // ------------------------------------------------------------------ result
  if (phase === "result" && result) {
    const paid = result.status === "PAID" || result.payout?.status === "PAID";
    const failed = !result.passed;

    return (
      <div className="mx-auto flex max-w-md flex-col gap-4">
        <Panel>
          <PanelHeader
            title={failed ? "Evidence rejected" : "Evidence accepted"}
            hint={
              failed
                ? "One or more rules failed, so no money moved."
                : "Every rule passed, so the payout is on its way."
            }
          />
          <div className="flex flex-col gap-3 p-4">
            <div
              className={`rounded-md border px-3 py-3 ${
                paid
                  ? "border-money/40 bg-money/10"
                  : failed
                    ? "border-danger/30 bg-danger/10"
                    : "border-warn/30 bg-warn/10"
              }`}
            >
              {paid && result.payout ? (
                <>
                  <p className="label text-money">Paid</p>
                  <p className="num mt-1 text-2xl text-money">
                    {(
                      (result.payout.amountCents ?? 0) / 100
                    ).toFixed(2)}{" "}
                    <span className="text-sm">USD</span>
                  </p>
                  <p className="mt-1 text-[11px] text-muted">
                    Sent to {result.payout.payeeEmail}
                  </p>
                  <p className="num mt-1 text-[10px] text-faint">
                    batch {result.payout.senderBatchId}
                  </p>
                </>
              ) : failed ? (
                <>
                  <p className="label text-danger">Not paid</p>
                  <p className="mt-1 text-sm text-text">
                    The rules did not all pass, so no payout was created.
                  </p>
                  <p className="mt-1 text-[11px] text-muted">
                    Failed: {result.failedRuleIds.join(", ")}
                  </p>
                </>
              ) : (
                <>
                  <p className="label text-warn">Processing</p>
                  <p className="mt-1 text-sm text-text">
                    The payout has been created and is waiting for confirmation.
                  </p>
                </>
              )}
            </div>

            <div>
              <p className="label">The six rules</p>
              <div className="mt-1 overflow-hidden rounded-md border border-line">
                {result.checks.map((check) => (
                  <RuleRow
                    key={check.id}
                    passed={check.passed}
                    label={check.label}
                    expected={check.expected}
                    actual={check.actual}
                    detail={check.detail}
                  />
                ))}
              </div>
            </div>

            <a
              href={`/bounty/${result.bountyId}`}
              className="text-center text-xs text-muted underline-offset-2 transition-colors hover:text-money hover:underline"
            >
              Open the full evidence record →
            </a>
          </div>
        </Panel>
      </div>
    );
  }

  return null;
}
