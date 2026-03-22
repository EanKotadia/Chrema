import { useEffect } from "react";
import { trackPageView } from "../utils/analytics";
import "./TermsPopup.css";

export default function TermsPopup({ onAccept }) {
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  async function handleAccept() {
    // Record the visitor in Supabase before letting them in.
    // article_id and article_slug are omitted (null) — this is a site-level
    // entrance event. It counts toward session totals and device breakdown
    // in the dashboard without touching any article's view_count.
    await trackPageView();
    onAccept();
  }

  return (
    <div className="terms-backdrop">
      <div className="terms-modal">
        <div className="terms-header">
          <span className="terms-logo">CHRÈMA</span>
          <h2 className="terms-title">Terms & Conditions</h2>
          <p className="terms-subtitle">Please read before continuing.</p>
        </div>

        <div className="terms-body">
          <section className="terms-section">
            <h3>1. About Chréma</h3>
            <p>Chréma Magazine is a student-run online publication. By accessing this website you agree to these terms. We reserve the right to update them at any time.</p>
          </section>
          <section className="terms-section">
            <h3>2. Content Submissions</h3>
            <p>By submitting an article, you confirm that the work is original and entirely your own. You grant Chréma Magazine a non-exclusive right to publish, display, and promote your content on our platform.</p>
            <p>We reserve the right to edit submissions for clarity, length, and style, and to decline any submission without obligation to provide a reason.</p>
          </section>
          <section className="terms-section">
            <h3>3. Intellectual Property</h3>
            <p>All original content published on Chréma belongs to the respective authors. The Chréma brand, logo, design, and codebase are the intellectual property of Chréma Magazine. You may not reproduce or redistribute our brand assets without written permission.</p>
          </section>
          <section className="terms-section">
            <h3>4. User Conduct</h3>
            <p>You agree not to submit content that is plagiarised, defamatory, hateful, or otherwise unlawful. Chréma is a respectful space for student voices — we expect all contributors and readers to uphold that standard.</p>
          </section>
          <section className="terms-section">
            <h3>5. Privacy</h3>
            <p>When you submit an article, we collect your name and email address solely for the purpose of communicating with you about your submission. We do not sell or share your personal information with third parties.</p>
          </section>
          <section className="terms-section">
            <h3>6. Limitation of Liability</h3>
            <p>Chréma Magazine is a student project provided as-is. We make no warranties about the accuracy or completeness of any content published. Opinions expressed are those of the individual authors and do not represent the views of Chréma Magazine.</p>
          </section>
          <section className="terms-section">
            <h3>7. Contact</h3>
            <p>Questions about these terms? Reach out to us via the submission form or contact a member of our team directly.</p>
          </section>
        </div>

        <div className="terms-footer">
          <p className="terms-footer-note">
            By clicking "I Agree" you confirm you have read and accept these terms.
          </p>
          <button className="terms-accept-btn" onClick={handleAccept}>
            I Agree — Enter Chréma →
          </button>
        </div>
      </div>
    </div>
  );
}
