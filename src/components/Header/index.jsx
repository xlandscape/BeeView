// src/components/Header/index.js
import React from 'react';
import RunSelector from '../RunSelector';
import ViewRunsPicker from '../ViewRunsPicker';
import './Header.css';

function Header() {
  return (
    <div className="header">
      <div className="header-title">
        <h1>BeeView</h1>
        <span className="header-subtitle">xPollinator Visualization</span>
      </div>
      <div className="header-runs">
        <RunSelector />
        <ViewRunsPicker />
      </div>
      <div className="header-actions">
        {/* <button className="header-button">
          <i className="fa fa-download"></i> Export
        </button>
        <button className="header-button">
          <i className="fa fa-question-circle"></i> Help
        </button> */}
      </div>
    </div>
  );
}

export default Header;