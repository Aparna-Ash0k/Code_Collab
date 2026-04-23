/**
 * Simple FolderModal component for folder naming
 */
import React, { useState, useEffect } from 'react';
import './Modal.css';

const FolderModal = ({ 
  isOpen, 
  onClose, 
  onSubmit,
  onConfirm, // Support both prop names for compatibility
  title = "Enter folder name",
  placeholder = "folder-name",
  initialValue = ""
}) => {
  const [folderName, setFolderName] = useState(initialValue);

  // Reset folder name when modal opens/closes or initialValue changes
  useEffect(() => {
    if (isOpen) {
      setFolderName(initialValue);
    }
  }, [isOpen, initialValue]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (folderName.trim()) {
      // Use onConfirm if provided, otherwise use onSubmit
      const submitHandler = onConfirm || onSubmit;
      if (submitHandler) {
        submitHandler(folderName.trim());
        setFolderName('');
      }
    }
  };

  const handleClose = () => {
    setFolderName('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button 
            type="button" 
            className="modal-close-btn"
            onClick={handleClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <input
              type="text"
              className="modal-input"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              placeholder={placeholder}
              autoFocus
            />
          </div>
          <div className="modal-footer">
            <button type="button" className="modal-btn modal-btn-secondary" onClick={handleClose}>
              Cancel
            </button>
            <button type="submit" className="modal-btn modal-btn-primary" disabled={!folderName.trim()}>
              Create Folder
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default FolderModal;
