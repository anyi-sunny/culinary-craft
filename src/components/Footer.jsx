import React from "react";
import "./Footer.css";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="footer-content">
        <div className="footer-section">
          <h3>Culinary Craft</h3>
          <p>Your AI-powered recipe generation and meal planning assistant.</p>
        </div>

        <div className="footer-section">
          <h4>Connect</h4>
          <div className="footer-links">
            <a
              href="https://anyi.sp-devs.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="footer-link"
            >
              Portfolio
            </a>
            <a
              href="mailto:asunnysky65@gmail.com"
              className="footer-link"
            >
              Request Help
            </a>
          </div>
        </div>

        <div className="footer-section">
          <h4>Credits</h4>
          <p className="credits-text">
            Developed by <strong>Anyi Sun</strong><br />
            Assisted by Claude Code & Gemini
          </p>
        </div>
      </div>

      <div className="footer-divider" />

      <div className="footer-bottom">
        <p>&copy; {currentYear} Culinary Craft. All rights reserved.</p>
        <p className="attribution-credit">
          <a href="https://www.vecteezy.com/free-videos/cooking" target="_blank" rel="noopener noreferrer">
            Cooking Stock Videos by Vecteezy
          </a>
        </p>
      </div>
    </footer>
  );
}
