export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <span className="footer-logo">CHRÈMA</span>
          <p className="footer-tagline">
            A student-driven magazine exploring technology, science, design, and research.
          </p>
        </div>
        <div className="footer-links">
          <a href="/about">About Us</a>
          <a href="/submit">Write for Us</a>
          <a href="/events">Events & Contests</a>
          <a href="/about#team">Meet the Team</a>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} Chréma Magazine. All rights reserved.</span>
          <div className="footer-admin-links">
            <a href="/admin">Admin</a>
            <a href="/admin/submissions">Submissions</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
