/**
 * Simple FilenameModal component for file naming
 */
import React, { useState, useEffect } from 'react';
import './Modal.css';

const FilenameModal = ({ 
  isOpen, 
  onClose, 
  onSubmit,
  onConfirm, // Support both prop names for compatibility
  title = "Enter filename",
  placeholder = "filename.js",
  initialValue = ""
}) => {
  const [filename, setFilename] = useState(initialValue);

  // Reset filename when modal opens/closes or initialValue changes
  useEffect(() => {
    if (isOpen) {
      setFilename(initialValue);
    }
  }, [isOpen, initialValue]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (filename.trim()) {
      // Use onConfirm if provided, otherwise use onSubmit
      const submitHandler = onConfirm || onSubmit;
      if (submitHandler) {
        submitHandler(filename.trim());
        setFilename('');
      }
    }
  };

  const handleClose = () => {
    setFilename('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <h3>{title}</h3>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={filename}
            onChange={(e) => setFilename(e.target.value)}
            placeholder={placeholder}
            autoFocus
          />
          <div className="modal-buttons">
            <button type="button" onClick={onClose}>Cancel</button>
            <button type="submit" disabled={!filename.trim()}>Create</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default FilenameModal;
