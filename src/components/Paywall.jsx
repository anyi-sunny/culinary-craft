import React from 'react';
import './Paywall.css';

function Paywall() {
  return (
    <div className="paywall-overlay">
      <div className="paywall-content">
        <h2 className="paywall-title">Success!</h2>
        <p className="paywall-message">
          Great news! This website is receiving enough traffic that Anyi can't afford to cover the cost of scaling up her site!
        </p>
        <p className="paywall-subtext">
          Please consider reaching out at <a href="mailto:asunnysky65@gmail.com">asunnysky65@gmail.com</a> to let her know!
        </p>
        <div className="paywall-footer">
          <p>Your usage quota has been reached. Please contact the site owner to discuss ongoing support.</p>
        </div>
      </div>
    </div>
  );
}

export default Paywall;
