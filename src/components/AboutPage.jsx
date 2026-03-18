import Footer from "./Footer";
import "./AboutPage.css";

const TEAM = [
    {
        name: "Amitesh Choudhary",
        role: "Founder & Editor-in-Chief",
        grade: "Grade 11",
        accent: "founder",
        bio: [
            "Amitesh is the founder of Chréma Magazine. A passionate advocate for young voices, he found his own through writing and competitive debate — and never looked back.",
            "He believes deeply in the empowerment of students through expression, and that giving young people the space to write is one of the most powerful investments in the next generation.",
            "As Founder, Amitesh sets the direction of Chréma, designates work across the team, and is ultimately responsible for everything the magazine stands for.",
        ],
    },
    {
        name: "Ean Kotadia",
        role: "Co-Founder & Technology",
        grade: "Grade 11",
        accent: "cofounder",
        bio: [
            "Ean is the co-founder and the mind behind everything you're interacting with right now. A Grade 11 science student with a deep love for technology, he designed and built Chréma from the ground up.",
            "Like Amitesh, Ean discovered his resilience and confidence through debate and writing — and channelled that energy into building platforms that give others the same opportunity.",
            "Extremely tech-savvy, Ean operates the backend infrastructure, architecture, and every pixel of this website.",
        ],
    },
    {
        name: "Nimardeep Singh",
        role: "Co-Founder & Buisness",
        grade: "Grade 11",
        accent: "cofounder",
        bio: [
            "Nimardeep is the co-founder who brings Chréma’s vision to life through strategy, leadership, and execution. A Grade 11 student with a strong entrepreneurial mindset, he plays a key role in shaping the platform’s direction and growth.",
            "With a natural ability to lead and connect ideas with action, Nimardeep helps transform concepts into meaningful initiatives that create real opportunities for students.",
            "From planning and outreach to decision-making and development, Nimardeep ensures that Chréma grows not just as a platform, but as a community-driven mission.",
        ],
    },
    {
        name: "Ayaan Warsi",
        role: "Logistics Coordinator",
        grade: "Grade 10",
        accent: "logistics-coordinator",
        bio: [
            "Ayaan is the Logistics Coordinator of Chréma Magazine, helping ensure the publication runs smoothly behind the scenes with structure, consistency, and reliability.",
            "Thoughtful and dependable, he brings organisation, clarity, and a strong sense of responsibility to the team’s workflow and day-to-day operations.",
            "As Logistics Coordinator, Ayaan supports internal coordination, planning, and execution, helping keep Chréma efficient, aligned, and moving forward.",
        ],
    },
    {
        name: "Navya Kashnia",
        role: " Shalom Logistics Coordinator",
        grade: "Grade 11",
        accent: "coeditor",
        bio: [
            "Navya is a Grade 11 student and serves as the Logistics Coordinator of Chréma Magazine, helping ensure the publication runs smoothly through strong organisation and planning.",
            "Calm, dependable, and detail-oriented, she brings structure and consistency to the team’s workflow while helping keep every moving part aligned.",
            "As Logistics Coordinator, Navya supports internal coordination, manages processes behind the scenes, and helps maintain the efficiency and rhythm that keep Chréma moving forward.",
        ],
    },
];
const TICKER_WORDS = ["Empower", "Write", "Debate", "Create", "Publish", "Lead"];
// Duplicate enough times to guarantee seamless fill across any screen width
const TICKER_FULL = [...TICKER_WORDS, ...TICKER_WORDS, ...TICKER_WORDS, ...TICKER_WORDS];

function TeamCard({ member, index }) {
  const reversed = index % 2 !== 0;
  return (
    <article className={`team-card ${reversed ? "team-card--reversed" : ""}`}>

      {/* Photo column */}
      <div className={`team-photo-col team-photo-col--${member.accent}`}>
        <div className="team-photo-frame">
          {/* Placeholder — swap src once you have photos */}
          <div className="team-photo-empty">
            <span className="team-photo-initial">{member.name[0]}</span>
          </div>
          <div className="team-photo-caption">
            <span>{member.name}</span>
            <span>{member.role}</span>
          </div>
        </div>
        <div className={`team-col-stripe team-col-stripe--${member.accent}`} />
      </div>

      {/* Text column */}
      <div className="team-text-col">
        <div className="team-text-top">
          <span className="team-index">0{index + 1}</span>
          <span className={`team-role-label team-role-label--${member.accent}`}>{member.role}</span>
        </div>
        <h2 className="team-name">{member.name}</h2>
        <p className="team-subline">{member.grade} · Chréma Magazine</p>
        <div className="team-rule" />
        <div className="team-bio">
          {member.bio.map((p, i) => <p key={i}>{p}</p>)}
        </div>
      </div>

    </article>
  );
}

export default function AboutPage() {
  return (
    <div className="about-page">

      {/* Nav */}
      <header className="about-nav">
        <a href="/" className="about-nav-logo">CHRÈMA</a>
        <a href="/" className="about-nav-back">Back to Magazine</a>
      </header>

      {/* Hero */}
      <section className="about-hero">
        <div className="about-hero-inner">
          <div className="about-hero-left">
            <span className="about-eyebrow">Who We Are</span>
            <h1 className="about-hero-title">
              Built by<br />
              students.<br />
              <em>For students.</em>
            </h1>
          </div>
          <div className="about-hero-right">
            <p className="about-hero-desc">
              Chréma Magazine is a student-driven publication exploring technology,
              science, design, and research through honest, thoughtful writing.
            </p>
            <p className="about-hero-desc">
              We believe ideas matter more than credentials. Every student has
              something worth saying — Chréma is where they say it.
            </p>
            <div className="about-hero-stats">
              <div className="about-stat">
                <span className="about-stat-n">2</span>
                <span className="about-stat-l">Founders</span>
              </div>

              <div className="about-stat">
                <span className="about-stat-n">1</span>
                <span className="about-stat-l">Mission</span>
              </div>

              <div className="about-stat">
                  <span className="about-stat-n">∞</span>
                  <span className="about-stat-l">Student Voices</span>
              </div>
            </div>
          </div>
        </div>

        {/* Ticker — no stars, starts from left edge */}
        <div className="about-hero-ticker" aria-hidden="true">
          <div className="about-ticker-track">
            {TICKER_FULL.map((w, i) => (
              <span key={i} className="about-ticker-word">
                {w}
                <span className="about-ticker-sep">/</span>
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Pillars — no emojis */}
      <section className="pillars">
        <div className="pillars-inner">
          {[
            { num: "I",   title: "Voice",       body: "Every student deserves a platform. We help young writers find their voice and share it with the world." },
            { num: "II",  title: "Empowerment", body: "Writing builds confidence. Putting words on a page is an act of courage — and we celebrate that." },
            { num: "III", title: "Curiosity",   body: "From science to culture, we cover what students are actually thinking about — not what adults think they should." },
            { num: "IV",  title: "Community",   body: "Chréma isn't just a magazine. It's a space where students support each other's growth as thinkers and creators." },
          ].map((p) => (
            <div key={p.title} className="pillar">
              <span className="pillar-num">{p.num}</span>
              <h3 className="pillar-title">{p.title}</h3>
              <p className="pillar-body">{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Team */}
      <section className="team-section">
        <div className="team-section-inner">
          <div className="team-section-header">
            <span className="about-eyebrow">The Team</span>
            <h2 className="team-section-title">The people<br /><em>behind the page.</em></h2>
            <p className="team-section-sub">Two Grade 11 students who turned a passion for writing into a platform.</p>
          </div>
          <div className="team-list">
            {TEAM.map((member, i) => (
              <TeamCard key={member.name} member={member} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="about-cta">
        <div className="about-cta-inner">
          <span className="about-eyebrow">Join Us</span>
          <h2 className="about-cta-title">Have something to say?</h2>
          <p className="about-cta-sub">We're always looking for curious, passionate writers. No experience needed — just a perspective worth sharing.</p>
          <a href="/submit" className="about-cta-btn">Submit an Article →</a>
        </div>
      </section>

      <Footer />
    </div>
  );
}
