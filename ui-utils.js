/**
 * UI Utilities for KNS Inventory System
 * Provides Toasts and Custom Confirm modals
 */

const UIUtils = {
    /**
     * Show a toast notification
     * @param {string} message - The message to display
     * @param {string} type - 'success', 'error', 'warning', 'info'
     * @param {number} duration - Milliseconds to show the toast
     */
    showToast(message, type = 'info', duration = 3000) {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        const icons = {
            success: '<svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>',
            error: '<svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>',
            warning: '<svg viewBox="0 0 24 24"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>',
            info: '<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>'
        };

        toast.innerHTML = `
            <div class="toast-icon">${icons[type]}</div>
            <div class="toast-message">${message}</div>
            <button class="toast-close">&times;</button>
        `;

        container.appendChild(toast);

        // Auto remove
        const timer = setTimeout(() => {
            this.hideToast(toast);
        }, duration);

        toast.querySelector('.toast-close').onclick = () => {
            clearTimeout(timer);
            this.hideToast(toast);
        };
    },

    hideToast(toast) {
        toast.classList.add('hide');
        toast.addEventListener('animationend', () => {
            toast.remove();
        });
    },

    /**
     * Custom premium confirmation modal
     * @param {string} message - The question to ask
     * @returns {Promise<boolean>}
     */
    showConfirm(message) {
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.className = 'confirm-modal-overlay';
            modal.innerHTML = `
                <div class="confirm-modal-content">
                    <div class="confirm-modal-header">
                        <div class="confirm-icon">
                            <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
                        </div>
                        <h3>Confirm Action</h3>
                    </div>
                    <div class="confirm-modal-body">
                        <p>${message}</p>
                    </div>
                    <div class="confirm-modal-footer">
                        <button class="btn-confirm-cancel">Cancel</button>
                        <button class="btn-confirm-ok">Yes, Proceed</button>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);

            const close = (result) => {
                modal.classList.add('hide');
                modal.addEventListener('animationend', () => {
                    modal.remove();
                    resolve(result);
                });
            };

            modal.querySelector('.btn-confirm-cancel').onclick = () => close(false);
            modal.querySelector('.btn-confirm-ok').onclick = () => close(true);
            
            // Allow clicking overlay to cancel
            modal.onclick = (e) => {
                if (e.target === modal) close(false);
            };
        });
    }
};

// Expose globally
window.showToast = UIUtils.showToast.bind(UIUtils);
window.showConfirm = UIUtils.showConfirm.bind(UIUtils);
