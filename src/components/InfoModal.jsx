import React from 'react';
import '../styles/InfoModal.css';

const InfoModal = ({ isOpen, onClose, children }) => {
  if (!isOpen) return null;
  
  return (
    <div className="info-modal-overlay" onClick={onClose}>
      <div className="info-modal-content" onClick={e => e.stopPropagation()}>
        <button className="info-modal-close" onClick={onClose}>×</button>
        <div className="info-modal-body">
          {children}
        </div>
      </div>
    </div>
  );
};

export default InfoModal; 