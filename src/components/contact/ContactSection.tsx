import { Mail, ShieldAlert, Wrench } from 'lucide-react';
import {
  SITE_CONFIG,
  hasAnyVerifiedContactChannel,
  type SiteLegalContactConfig,
} from '../../config/siteConfig';
import { ContactForm } from './ContactForm';

export interface ContactSectionProps {
  config?: SiteLegalContactConfig;
}

export function ContactSection({ config = SITE_CONFIG }: ContactSectionProps) {
  const anyChannel = hasAnyVerifiedContactChannel(config);

  const verifiedChannels = [
    {
      label: 'General Platform Contact',
      value: config.contactEmail,
      envVar: 'VITE_CONTACT_EMAIL',
    },
    {
      label: 'Privacy & Data Rights',
      value: config.privacyEmail,
      envVar: 'VITE_PRIVACY_EMAIL',
    },
    {
      label: 'Legal & Terms Inquiries',
      value: config.legalEmail,
      envVar: 'VITE_LEGAL_EMAIL',
    },
    {
      label: 'Grievance / Data Protection Contact',
      value:
        config.grievanceOfficerName && config.grievanceOfficerEmail
          ? `${config.grievanceOfficerName} (${config.grievanceOfficerEmail})`
          : config.grievanceOfficerEmail || config.grievanceOfficerName,
      envVar: 'VITE_GRIEVANCE_OFFICER_EMAIL',
    },
  ];

  return (
    <section aria-label="Contact channels and inquiry form" className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
      {/* Left Column: Verified Channels & Configuration Audit */}
      <div className="lg:col-span-5 flex flex-col gap-5">
        <div className="oi-panel h-full flex flex-col justify-between space-y-5">
          <div className="space-y-4">
            <div className="oi-panel-header">
              <div>
                <h2 className="oi-card-title">Verified Communication Channels</h2>
                <p className="oi-component-subtitle mt-0.5">
                  Centralized operator contact details populated strictly from deployment configuration.
                </p>
              </div>
              <Mail className="h-4 w-4 text-[#4338CA] shrink-0" aria-hidden="true" />
            </div>

            {!anyChannel && (
              <div className="oi-tile space-y-2">
                <div className="flex items-center gap-2">
                  <Wrench className="h-4 w-4 text-[#B45309] shrink-0" aria-hidden="true" />
                  <p className="oi-subpanel-title">No Contact Channels Configured Yet</p>
                </div>
                <p className="oi-component-subtitle leading-relaxed">
                  No verified email addresses, physical office addresses, telephone numbers, or
                  contact form endpoints are configured in this workspace build. Set the relevant{' '}
                  <code className="font-mono text-[#171717]">VITE_*</code> environment variables
                  before public launch.
                </p>
              </div>
            )}

            <div className="space-y-3">
              {verifiedChannels.map((channel) => (
                <div key={channel.label} className="oi-tile space-y-1">
                  <p className="oi-subpanel-title">{channel.label}</p>
                  {channel.value ? (
                    <p className="text-sm text-[#4338CA] font-medium break-all">
                      {channel.value.includes('@') && !channel.value.includes(' ') ? (
                        <a
                          href={`mailto:${channel.value}`}
                          className="hover:underline underline-offset-2"
                        >
                          {channel.value}
                        </a>
                      ) : (
                        channel.value
                      )}
                    </p>
                  ) : (
                    <p className="oi-metadata">
                      Unconfigured (set <code className="text-[#171717]">{channel.envVar}</code>)
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="oi-inset-sm px-4 py-3 space-y-1.5 text-xs text-[#525252]">
            <div className="flex items-center gap-2 font-semibold text-[#171717]">
              <ShieldAlert className="h-3.5 w-3.5 text-[#4338CA] shrink-0" aria-hidden="true" />
              <span>Operational &amp; Privacy Notice</span>
            </div>
            <p className="leading-relaxed">
              Submitted contact inquiries are intended solely for platform feedback, privacy
              requests, and integration questions. Do not submit clinical emergencies or patient
              records.
            </p>
          </div>
        </div>
      </div>

      {/* Right Column: Validated Inquiry Form */}
      <div className="lg:col-span-7">
        <ContactForm endpointUrl={config.contactEndpointUrl} />
      </div>
    </section>
  );
}
