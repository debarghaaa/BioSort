import { ContactSection } from '../components/contact/ContactSection';
import { SITE_CONFIG } from '../config/siteConfig';

export function ContactPage() {
  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 space-y-8">
      <header className="max-w-2xl space-y-3 border-b border-[#E5E5E5] pb-7">
        <p className="oi-metadata font-medium tracking-[0.14em] uppercase text-[#4338CA]">
          Platform Communication
        </p>
        <h1 className="oi-page-title">Contact {SITE_CONFIG.platformName}</h1>
        <p className="oi-body">
          Reach the platform administration team for privacy inquiries, terms questions, or technical
          deployment coordination. Only verified, explicitly configured communication channels are
          displayed below.
        </p>
      </header>

      <ContactSection />
    </div>
  );
}
