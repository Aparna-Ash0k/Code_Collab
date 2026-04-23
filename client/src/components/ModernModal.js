import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import './ModernModal.css';

const ModernModal = ({ 
  isOpen, 
  onClose, 
  title, 
  subtitle,
  children, 
  maxWidth = 'lg',
  showCloseButton = true,
  className = '',
  headerActions = null 
}) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const getMaxWidthClass = () => {
    switch (maxWidth) {
      case 'sm': return 'max-w-md';
      case 'md': return 'max-w-lg';
      case 'lg': return 'max-w-2xl';
      case 'xl': return 'max-w-4xl';
      case '2xl': return 'max-w-6xl';
      default: return 'max-w-2xl';
    }
  };

  return (
    <div 
      className="modern-modal-overlay"
      onClick={handleBackdropClick}
    >
      <div 
        className={`modern-modal ${getMaxWidthClass()} ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        {(title || showCloseButton || headerActions) && (
          <div className="modern-modal-header">
            <div className="modern-modal-header-content">
              {title && (
                <div className="modern-modal-title-section">
                  <h2 className="modern-modal-title">{title}</h2>
                  {subtitle && <p className="modern-modal-subtitle">{subtitle}</p>}
                </div>
              )}
              <div className="modern-modal-header-actions">
                {headerActions}
                {showCloseButton && (
                  <button
                    onClick={onClose}
                    className="modern-modal-close-button"
                    aria-label="Close modal"
                  >
                    <X size={20} />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="modern-modal-content">
          {children}
        </div>
      </div>
    </div>
  );
};

export default ModernModal;
