import { useState, useRef } from "react";
import { submitArticle, uploadImage } from "../utils/supabase";
import { sendReceiptEmail } from "../utils/email";
import Footer from "./Footer";
import "./SubmitPage.css";

const CATEGORIES = [
  "Technology",
  "Science",
  "Design",
  "Research",
  "Culture",
  "Opinion",
  "Literature",
  "History",
  "Business",
  "Global Affairs",
  "Politics",
  "Philosophy",
  "Environment",
  "Health",
  "Sports",
  "Arts",
];

const EMPTY = {
  name: "",
  email: "",
  title: "",
  category: "",
  excerpt: "",
  body: "",
  bio: "",
};

const STEPS = ["About You", "Your Article", "Cover Image", "Review & Submit"];

export default function SubmitPage() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(EMPTY);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [imageUrl, setImageUrl] = useState(null);
  const [imageError, setImageError] = useState("");
  const [status, setStatus] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const fileInputRef = useRef(null);

  const set = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const canNext = () => {
    if (step === 0) return form.name.trim() && form.email.trim();
    if (step === 1) return form.title.trim() && form.body.trim();
    return true; // step 2 (image) is optional
  };

  const handleImagePick = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setImageError("Image must be under 5MB.");
      return;
    }
    setImageError("");
    setImageFile(file);
    setImageUrl(null);
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleImageUpload = async () => {
    if (!imageFile) return;
    setImageUploading(true);
    setImageError("");
    try {
      const url = await uploadImage(imageFile);
      setImageUrl(url);
    } catch (err) {
      setImageError(err.message || "Upload failed. Please try again.");
    } finally {
      setImageUploading(false);
    }
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setImageUrl(null);
    setImageError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async () => {
    setStatus("submitting");
    setErrorMsg("");
    try {
      // If image was picked but not yet uploaded, upload it now
      let finalImageUrl = imageUrl;
      if (imageFile && !imageUrl) {
        finalImageUrl = await uploadImage(imageFile);
        setImageUrl(finalImageUrl);
      }

      await submitArticle({
        name: form.name,
        email: form.email,
        title: form.title,
        category: form.category || null,
        excerpt: form.excerpt || null,
        body: form.body,
        bio: form.bio || null,
        image_url: finalImageUrl || null,
        submitted_at: new Date().toISOString(),
        status: "pending",
      });
      setStatus("success");
      sendReceiptEmail({
        name: form.name,
        email: form.email,
        title: form.title,
      }).catch((e) => console.warn("Receipt email failed:", e));
    } catch (err) {
      setErrorMsg(err.message);
      setStatus("error");
    }
  };

  if (status === "success") {
    return (
      <div className="submit-page">
        <header className="submit-nav">
          <a href="/public" className="submit-nav-logo">CHRÈMA</a>
        </header>
        <div className="submit-success">
          <div className="success-icon">✓</div>
          <h1 className="success-heading">Submission received.</h1>
          <p className="success-body">
            Thanks, {form.name.split(" ")[0]}. We review every submission carefully
            and will reach out to <strong>{form.email}</strong> if your piece is a good fit.
          </p>
          <a href="/public" className="success-back">← Back to Chréma</a>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="submit-page">
      <header className="submit-nav">
        <a href="/public" className="submit-nav-logo">CHRÈMA</a>
        <a href="/public" className="submit-nav-back">← Back</a>
      </header>

      <div className="submit-inner">
        <div className="submit-page-header">
          <span className="submit-eyebrow">Write for Chréma</span>
          <h1 className="submit-title">Submit an Article</h1>
          <p className="submit-desc">
            Chréma is a student-driven magazine. We welcome thoughtful, original writing
            from anyone with something worth saying — across any topic.
          </p>
        </div>

        <div className="submit-guidelines">
          {[
            "Original, unpublished work only",
            "500–3,000 words",
            "Any category — literature, science, opinion, global affairs and more",
            "We'll reply within 2 weeks",
          ].map((g) => (
            <div key={g} className="guideline">
              <span className="guideline-icon">✦</span>
              <span>{g}</span>
            </div>
          ))}
        </div>

        {/* Step indicator */}
        <div className="step-indicator">
          {STEPS.map((label, i) => (
            <div key={i} className={`step-item ${i === step ? "active" : ""} ${i < step ? "done" : ""}`}>
              <div className="step-dot">{i < step ? "✓" : i + 1}</div>
              <span className="step-label">{label}</span>
              {i < STEPS.length - 1 && <div className="step-line" />}
            </div>
          ))}
        </div>

        <div className="submit-form">

          {/* ── Step 0: About You ── */}
          {step === 0 && (
            <div className="form-panel">
              <h2 className="panel-heading">Tell us about yourself</h2>

              <div className="submit-field">
                <label className="submit-label" htmlFor="name">
                  Full Name <span className="req">*</span>
                </label>
                <input id="name" className="submit-input" type="text"
                  placeholder="Jane Smith" value={form.name} onChange={set("name")} />
              </div>

              <div className="submit-field">
                <label className="submit-label" htmlFor="email">
                  Email Address <span className="req">*</span>
                </label>
                <input id="email" className="submit-input" type="email"
                  placeholder="jane@example.com" value={form.email} onChange={set("email")} />
                <span className="field-hint">We'll only contact you about your submission.</span>
              </div>

              <div className="submit-field">
                <label className="submit-label" htmlFor="bio">
                  Short Bio <span className="optional">(optional)</span>
                </label>
                <textarea id="bio" className="submit-input submit-textarea"
                  placeholder="A sentence or two about who you are…"
                  rows={3} value={form.bio} onChange={set("bio")} />
              </div>
            </div>
          )}

          {/* ── Step 1: Your Article ── */}
          {step === 1 && (
            <div className="form-panel">
              <h2 className="panel-heading">Your article</h2>

              <div className="submit-field">
                <label className="submit-label" htmlFor="title">
                  Title <span className="req">*</span>
                </label>
                <input id="title" className="submit-input submit-input--large"
                  type="text" placeholder="A compelling headline…"
                  value={form.title} onChange={set("title")} />
              </div>

              <div className="submit-row">
                <div className="submit-field">
                  <label className="submit-label" htmlFor="category">
                    Category <span className="optional">(optional)</span>
                  </label>
                  <select id="category" className="submit-input submit-select"
                    value={form.category} onChange={set("category")}>
                    <option value="">Select a category…</option>
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Category pills for quick picking */}
              <div className="category-pills">
                {CATEGORIES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`cat-pill ${form.category === c ? "cat-pill--active" : ""}`}
                    onClick={() => setForm((p) => ({ ...p, category: c }))}
                  >
                    {c}
                  </button>
                ))}
              </div>

              <div className="submit-field">
                <label className="submit-label" htmlFor="excerpt">
                  Summary <span className="optional">(optional)</span>
                </label>
                <textarea id="excerpt" className="submit-input submit-textarea"
                  placeholder="A 1–2 sentence summary of your article…"
                  rows={3} value={form.excerpt} onChange={set("excerpt")} />
              </div>

              <div className="submit-field">
                <label className="submit-label" htmlFor="body">
                  Article Body <span className="req">*</span>
                </label>
                <textarea id="body" className="submit-input submit-textarea submit-textarea--tall"
                  placeholder="Write your full article here. Use double line breaks to separate paragraphs…"
                  rows={18} value={form.body} onChange={set("body")} />
                <span className="field-hint">
                  {form.body.trim().split(/\s+/).filter(Boolean).length} words · Aim for 500–3,000
                </span>
              </div>
            </div>
          )}

          {/* ── Step 2: Cover Image ── */}
          {step === 2 && (
            <div className="form-panel">
              <h2 className="panel-heading">Cover image</h2>
              <p className="panel-subheading">
                Add a cover image for your article. This is optional but recommended —
                it'll appear at the top of your published piece.
              </p>

              {!imagePreview ? (
                <div
                  className="image-dropzone"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const file = e.dataTransfer.files[0];
                    if (file) handleImagePick({ target: { files: [file] } });
                  }}
                >
                  <div className="dropzone-icon">🖼</div>
                  <p className="dropzone-title">Drop your image here</p>
                  <p className="dropzone-sub">or click to browse · JPG, PNG, WebP · Max 5MB</p>
                  <button type="button" className="dropzone-btn">Choose Image</button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleImagePick}
                    style={{ display: "none" }}
                  />
                </div>
              ) : (
                <div className="image-preview-wrap">
                  <img src={imagePreview} alt="Cover preview" className="image-preview" />
                  <div className="image-preview-overlay">
                    <span className="image-preview-name">{imageFile?.name}</span>
                    <div className="image-preview-actions">
                      {!imageUrl && (
                        <button
                          type="button"
                          className="img-action-btn img-action-btn--upload"
                          onClick={handleImageUpload}
                          disabled={imageUploading}
                        >
                          {imageUploading ? "Uploading…" : "⬆ Upload Image"}
                        </button>
                      )}
                      {imageUrl && (
                        <span className="img-uploaded-badge">✓ Uploaded</span>
                      )}
                      <button
                        type="button"
                        className="img-action-btn img-action-btn--remove"
                        onClick={handleRemoveImage}
                        disabled={imageUploading}
                      >
                        ✕ Remove
                      </button>
                    </div>
                  </div>
                  {imageError && <p className="image-error">{imageError}</p>}
                </div>
              )}

              {imageError && !imagePreview && (
                <p className="image-error">{imageError}</p>
              )}

              <p className="image-skip-note">
                You can skip this step — your article will still be submitted without a cover image.
              </p>
            </div>
          )}

          {/* ── Step 3: Review ── */}
          {step === 3 && (
            <div className="form-panel">
              <h2 className="panel-heading">Review your submission</h2>

              {[
                { key: "Name", val: form.name },
                { key: "Email", val: form.email },
                form.bio && { key: "Bio", val: form.bio },
              ].filter(Boolean).map(({ key, val }) => (
                <div key={key} className="review-block">
                  <span className="review-key">{key}</span>
                  <span className="review-val">{val}</span>
                </div>
              ))}

              <div className="review-divider" />

              <div className="review-block">
                <span className="review-key">Title</span>
                <span className="review-val review-val--title">{form.title}</span>
              </div>
              {form.category && (
                <div className="review-block">
                  <span className="review-key">Category</span>
                  <span className="review-val"><span className="review-tag">{form.category}</span></span>
                </div>
              )}
              {form.excerpt && (
                <div className="review-block">
                  <span className="review-key">Summary</span>
                  <span className="review-val">{form.excerpt}</span>
                </div>
              )}

              {/* Image preview in review */}
              <div className="review-block review-block--image">
                <span className="review-key">Cover Image</span>
                <span className="review-val">
                  {imagePreview ? (
                    <div className="review-image-wrap">
                      <img src={imagePreview} alt="Cover" className="review-image" />
                      {imageUrl
                        ? <span className="review-img-status review-img-status--ok">✓ Ready to submit</span>
                        : <span className="review-img-status review-img-status--pending">Will upload on submit</span>
                      }
                    </div>
                  ) : (
                    <span className="review-none">No image added</span>
                  )}
                </span>
              </div>

              <div className="review-block review-block--body">
                <span className="review-key">Article</span>
                <span className="review-val review-val--body">
                  {form.body.slice(0, 300)}{form.body.length > 300 ? "…" : ""}
                </span>
              </div>

              <div className="review-divider" />
              <p className="review-note">
                By submitting, you confirm this is original work and grant Chréma the right
                to publish it. You'll hear back within 2 weeks.
              </p>

              {status === "error" && (
                <div className="submit-status submit-status--error">
                  ✗ {errorMsg || "Something went wrong. Please try again."}
                </div>
              )}
            </div>
          )}

          {/* Navigation */}
          <div className="form-nav">
            {step > 0 && (
              <button className="form-btn form-btn--back"
                onClick={() => setStep((s) => s - 1)}
                disabled={status === "submitting"}>
                ← Back
              </button>
            )}
            <div style={{ flex: 1 }} />
            {step < STEPS.length - 1 ? (
              <button className="form-btn form-btn--next"
                onClick={() => setStep((s) => s + 1)}
                disabled={!canNext()}>
                Continue →
              </button>
            ) : (
              <button className="form-btn form-btn--submit"
                onClick={handleSubmit}
                disabled={status === "submitting" || imageUploading}>
                {status === "submitting" ? "Submitting…" : "Submit Article"}
              </button>
            )}
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
