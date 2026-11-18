import React, { useId, useState } from 'react';
import { AlertCircle, ArrowRight, CheckCircle2, Info } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  SITE_CONFIG,
  isContactEndpointConfigured,
  submitContactInquiry,
} from '../../config/siteConfig';
import { validateEmail } from '../../utils/authValidation';

export interface ContactFormValues {
  name: string;
  email: string;
  subject: string;
  message: string;
  honeypot: string;
}

export type ContactFormErrors = Partial<Record<'name' | 'email' | 'subject' | 'message', string>>;

export function validateContactForm(values: ContactFormValues): ContactFormErrors {
  const errors: ContactFormErrors = {};

  const trimmedName = values.name.trim();
  if (!trimmedName) {
    errors.name = 'Full name is required.';
  } else if (trimmedName.length < 2) {
    errors.name = 'Name must be at least 2 characters.';
  } else if (trimmedName.length > 120) {
    errors.name = 'Name must not exceed 120 characters.';
  }

  const emailError = validateEmail(values.email);
  if (emailError) {
    errors.email = emailError;
  }

  const trimmedSubject = values.subject.trim();
  if (!trimmedSubject) {
    errors.subject = 'Subject is required.';
  } else if (trimmedSubject.length < 3) {
    errors.subject = 'Subject must be at least 3 characters.';
  } else if (trimmedSubject.length > 160) {
    errors.subject = 'Subject must not exceed 160 characters.';
  }

  const trimmedMessage = values.message.trim();
  if (!trimmedMessage) {
    errors.message = 'Message is required.';
  } else if (trimmedMessage.length < 15) {
    errors.message = 'Please provide at least 15 characters describing your inquiry.';
  } else if (trimmedMessage.length > 4000) {
    errors.message = 'Message must not exceed 4,000 characters.';
  }

  return errors;
}

export interface ContactFormProps {
  endpointUrl?: string | null;
  onSubmitInquiry?: typeof submitContactInquiry;
}

export function ContactForm({
  endpointUrl = SITE_CONFIG.contactEndpointUrl,
  onSubmitInquiry = submitContactInquiry,
}: ContactFormProps) {
  const formId = useId();
  const endpointReady = isContactEndpointConfigured({
    ...SITE_CONFIG,
    contactEndpointUrl: endpointUrl ?? null,
  });

  const [values, setValues] = useState<ContactFormValues>({
    name: '',
    email: '',
    subject: '',
    message: '',
    honeypot: '',
  });
  const [fieldErrors, setFieldErrors] = useState<ContactFormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<{
    message: string;
    referenceId: string | null;
  } | null>(null);

  const handleChange =
    (field: keyof ContactFormValues) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const nextValue = e.target.value;
      setValues((prev) => ({ ...prev, [field]: nextValue }));
      if (field !== 'honeypot' && fieldErrors[field]) {
        setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
      }
      if (submitError) setSubmitError(null);
    };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) return;

    setSubmitError(null);
    setSubmitSuccess(null);

    const validationErrors = validateContactForm(values);
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      return;
    }

    // Silent drop only if automated bot filled the hidden honeypot field
    if (values.honeypot.trim().length > 0) {
      setSubmitError('Submission rejected by anti-spam verification.');
      return;
    }

    if (!endpointReady) {
      setSubmitError(
        'No backend contact endpoint is configured in this deployment (VITE_CONTACT_ENDPOINT_URL is unset). Message was not sent.'
      );
      return;
    }

    setSubmitting(true);
    try {
      const result = await onSubmitInquiry(
        {
          name: values.name,
          email: values.email,
          subject: values.subject,
          message: values.message,
        },
        endpointUrl
      );
      setSubmitSuccess({
        message: result.message,
        referenceId: result.referenceId,
      });
      setValues({
        name: '',
        email: '',
        subject: '',
        message: '',
        honeypot: '',
      });
      setFieldErrors({});
    } catch (err) {
      setSubmitError(
        err instanceof Error
          ? err.message
          : 'Unable to deliver your message. Please try again later.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="oi-panel h-full flex flex-col justify-between space-y-5">
      <div className="space-y-4">
        <div className="oi-panel-header">
          <div>
            <h2 className="oi-card-title">Send an Inquiry</h2>
            <p className="oi-component-subtitle mt-0.5">
              Validated inquiry form with real endpoint delivery and explicit status feedback.
            </p>
          </div>
          <span className="oi-metadata uppercase tracking-wider">
            {endpointReady ? 'Endpoint Active' : 'Endpoint Unconfigured'}
          </span>
        </div>

        {!endpointReady && (
          <div
            role="note"
            className="flex items-start gap-2.5 rounded-xl border border-[#B45309]/30 bg-[#FFFBEB] px-3.5 py-3 text-xs text-[#92400E]"
          >
            <Info className="h-4 w-4 text-[#B45309] shrink-0 mt-0.5" aria-hidden="true" />
            <div className="space-y-1 leading-relaxed">
              <p className="font-semibold text-[#171717]">
                Backend contact delivery is not configured
              </p>
              <p>
                BioSort does not simulate message delivery. To enable online submissions in production,
                deploy a server contact handler and set{' '}
                <code className="font-mono text-[#171717]">VITE_CONTACT_ENDPOINT_URL</code>.
              </p>
            </div>
          </div>
        )}

        {submitError && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-xl border border-[#D9534F]/40 bg-[#FDF3F2] px-3.5 py-3 text-xs text-[#9F2D2A]"
          >
            <AlertCircle className="h-4 w-4 text-[#D9534F] shrink-0 mt-0.5" aria-hidden="true" />
            <span className="leading-relaxed">{submitError}</span>
          </div>
        )}

        {submitSuccess && (
          <div
            role="status"
            className="flex items-start gap-2.5 rounded-xl border border-[#238B68]/35 bg-[#F2FAF7] px-3.5 py-3 text-xs text-[#17644A]"
          >
            <CheckCircle2 className="h-4 w-4 text-[#238B68] shrink-0 mt-0.5" aria-hidden="true" />
            <div className="space-y-1 leading-relaxed">
              <p>{submitSuccess.message}</p>
              {submitSuccess.referenceId && (
                <p className="font-mono text-[11px]">Reference: {submitSuccess.referenceId}</p>
              )}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {/* Anti-spam honeypot field — intentionally hidden from assistive tech and visual users */}
          <div className="hidden" aria-hidden="true">
            <label htmlFor={`${formId}-company`}>Leave this field blank</label>
            <input
              id={`${formId}-company`}
              type="text"
              name="company_website"
              tabIndex={-1}
              autoComplete="off"
              value={values.honeypot}
              onChange={handleChange('honeypot')}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor={`${formId}-name`} className="oi-label block">
                Name
              </label>
              <input
                id={`${formId}-name`}
                type="text"
                name="name"
                autoComplete="name"
                required
                disabled={submitting}
                value={values.name}
                onChange={handleChange('name')}
                aria-invalid={Boolean(fieldErrors.name)}
                aria-describedby={fieldErrors.name ? `${formId}-name-error` : undefined}
                placeholder="Your full name"
                className="oi-input w-full px-3.5 py-2.5"
              />
              {fieldErrors.name && (
                <p id={`${formId}-name-error`} className="text-xs text-[#9F2D2A]">
                  {fieldErrors.name}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label htmlFor={`${formId}-email`} className="oi-label block">
                Email
              </label>
              <input
                id={`${formId}-email`}
                type="email"
                name="email"
                autoComplete="email"
                required
                disabled={submitting}
                value={values.email}
                onChange={handleChange('email')}
                aria-invalid={Boolean(fieldErrors.email)}
                aria-describedby={fieldErrors.email ? `${formId}-email-error` : undefined}
                placeholder="name@organization.org"
                className="oi-input w-full px-3.5 py-2.5"
              />
              {fieldErrors.email && (
                <p id={`${formId}-email-error`} className="text-xs text-[#9F2D2A]">
                  {fieldErrors.email}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor={`${formId}-subject`} className="oi-label block">
              Subject
            </label>
            <input
              id={`${formId}-subject`}
              type="text"
              name="subject"
              required
              disabled={submitting}
              value={values.subject}
              onChange={handleChange('subject')}
              aria-invalid={Boolean(fieldErrors.subject)}
              aria-describedby={fieldErrors.subject ? `${formId}-subject-error` : undefined}
              placeholder="Topic (e.g., Privacy request, deployment integration, review feedback)"
              className="oi-input w-full px-3.5 py-2.5"
            />
            {fieldErrors.subject && (
              <p id={`${formId}-subject-error`} className="text-xs text-[#9F2D2A]">
                {fieldErrors.subject}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor={`${formId}-message`} className="oi-label block">
              Message
            </label>
            <textarea
              id={`${formId}-message`}
              name="message"
              rows={5}
              required
              disabled={submitting}
              value={values.message}
              onChange={handleChange('message')}
              aria-invalid={Boolean(fieldErrors.message)}
              aria-describedby={fieldErrors.message ? `${formId}-message-error` : undefined}
              placeholder="Describe your inquiry without sharing sensitive patient or medical record details..."
              className="oi-input w-full px-3.5 py-3 min-h-[132px] resize-y"
            />
            {fieldErrors.message && (
              <p id={`${formId}-message-error`} className="text-xs text-[#9F2D2A]">
                {fieldErrors.message}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <p className="text-xs text-[#737373]">
              Do not include patient identifiers or protected health information. See{' '}
              <Link
                to="/privacy-policy"
                className="text-[#4338CA] hover:text-[#3730A3] underline underline-offset-2"
              >
                Privacy Policy
              </Link>
              .
            </p>

            <button
              type="submit"
              disabled={submitting || !endpointReady}
              className="oi-btn-primary inline-flex items-center justify-center gap-2 px-5 py-2.5 whitespace-nowrap shrink-0"
            >
              <span>
                {submitting
                  ? 'Sending inquiry...'
                  : endpointReady
                    ? 'Send Message'
                    : 'Delivery Unavailable'}
              </span>
              <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
