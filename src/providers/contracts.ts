/**
 * Payment states shared by the billing application service and every payment
 * provider adapter. Provider-specific statuses must be normalized to one of
 * these values before crossing the adapter boundary.
 */
export type PaymentStatus = "PENDING" | "SUCCEEDED" | "EXPIRED" | "FAILED";

export interface PaymentAmount {
  /** The smallest unit for the currency, represented exactly as a decimal string. */
  readonly minorUnits: string;
  readonly currency: string;
}

export interface CreatePaymentInput {
  /** An opaque, application-owned reference; never a customer-facing payload. */
  readonly merchantReference: string;
  readonly amount: PaymentAmount;
  readonly idempotencyKey: string;
  readonly description?: string;
}

export interface PaymentAction {
  readonly kind: "QR" | "REDIRECT";
  readonly value: string;
}

export interface PaymentCreation {
  readonly providerReference: string;
  readonly status: PaymentStatus;
  readonly expiresAt?: Date;
  readonly action?: PaymentAction;
}

export interface PaymentStatusInput {
  readonly providerReference: string;
}

export interface PaymentStatusResult {
  readonly providerReference: string;
  readonly status: PaymentStatus;
  readonly paidAt?: Date;
  readonly expiresAt?: Date;
}

export interface SignedWebhookInput {
  /** The unmodified request body used by the provider signature verifier. */
  readonly body: string;
  readonly signature: string;
  readonly headers?: Readonly<Record<string, string>>;
}

export interface PaymentWebhookEvent {
  readonly eventId: string;
  readonly providerReference: string;
  readonly status: PaymentStatus;
  readonly occurredAt: Date;
}

/**
 * Internal payment boundary. Implementations may use a provider SDK behind
 * this interface, but SDK types and errors must never escape it. Expected
 * provider failures are thrown as the transport-neutral ProviderError.
 */
export interface PaymentProvider {
  createPayment(input: CreatePaymentInput): Promise<PaymentCreation>;
  getPaymentStatus(input: PaymentStatusInput): Promise<PaymentStatusResult>;
  verifyWebhook(input: SignedWebhookInput): Promise<PaymentWebhookEvent>;
}

export type EmailDeliveryStatus =
  | "ACCEPTED"
  | "DELIVERED"
  | "BOUNCED"
  | "COMPLAINED"
  | "FAILED";

export interface EmailMessage {
  readonly from: string;
  readonly to: readonly string[];
  readonly subject: string;
  readonly text?: string;
  readonly html?: string;
  readonly headers?: Readonly<Record<string, string>>;
  readonly idempotencyKey?: string;
}

export interface EmailSendResult {
  readonly providerMessageId: string;
  readonly status: "ACCEPTED";
  readonly acceptedAt: Date;
}

export interface EmailDeliveryEvent {
  readonly eventId: string;
  readonly providerMessageId: string;
  readonly status: EmailDeliveryStatus;
  readonly occurredAt: Date;
}

/**
 * Internal email boundary. The notification domain supplies a message and
 * receives normalized delivery facts, never a provider SDK response.
 */
export interface EmailService {
  send(message: EmailMessage): Promise<EmailSendResult>;
  verifyWebhook(input: SignedWebhookInput): Promise<EmailDeliveryEvent>;
}

export interface CreateUploadUrlInput {
  readonly objectKey: string;
  readonly contentType: string;
  readonly maxBytes: number;
  readonly expiresInSeconds: number;
}

export interface PresignedUpload {
  readonly url: string;
  readonly method: "PUT";
  readonly headers: Readonly<Record<string, string>>;
  readonly expiresAt: Date;
}

export interface CreateDownloadUrlInput {
  readonly objectKey: string;
  readonly expiresInSeconds: number;
  readonly contentDisposition?: string;
}

export interface PresignedDownload {
  readonly url: string;
  readonly expiresAt: Date;
}

export interface StorageObjectInput {
  readonly objectKey: string;
}

/**
 * Internal object-storage boundary. Deletion is idempotent: an already
 * missing object is a successful no-op, as required by the media lifecycle.
 */
export interface StorageProvider {
  createUploadUrl(input: CreateUploadUrlInput): Promise<PresignedUpload>;
  createDownloadUrl(input: CreateDownloadUrlInput): Promise<PresignedDownload>;
  deleteObject(input: StorageObjectInput): Promise<void>;
}

/**
 * The application composes providers once at the server boundary. Domain and
 * application code can depend on this shape and tests can supply fakes.
 */
export interface ProviderServices {
  readonly payment: PaymentProvider;
  readonly email: EmailService;
  readonly storage: StorageProvider;
}
