// Global appointment notification system with persistent storage
(function() {
  const STORAGE_KEY = 'active_appointment_notifications';
  const NOTIFICATION_DURATION = 30000; // 30 seconds (30000ms)
  
  const notificationContainer = document.createElement('div');
  notificationContainer.id = 'appointment-notifications';
  notificationContainer.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 999999;
    max-width: 400px;
    pointer-events: none;
  `;
  
  // Create custom confirm dialog
  const confirmDialog = document.createElement('dialog');
  confirmDialog.id = 'appointment-confirm-dialog';
  confirmDialog.style.cssText = `
    max-width: 420px;
    width: min(95vw, 420px);
    border: none;
    border-radius: 12px;
    padding: 0;
    box-shadow: 0 10px 50px rgba(0,0,0,0.3);
    z-index: 9999999;
  `;
  confirmDialog.innerHTML = `
    <div style="padding: 20px 24px; background: #3b82f6; color: white; font-size: 18px; font-weight: bold; border-radius: 12px 12px 0 0; display: flex; align-items: center; gap: 8px;">
      <span>❓</span>
      <span>تأكيد</span>
    </div>
    <div style="padding: 24px; font-family: 'Cairo', system-ui, -apple-system, sans-serif;">
      <div style="display: flex; gap: 12px; margin-bottom: 20px;">
        <div style="font-size: 32px;">❓</div>
        <div id="appointment-confirm-text" style="color: #1f2937; font-size: 16px; line-height: 1.6; direction: rtl;"></div>
      </div>
      <div style="display: flex; gap: 12px; justify-content: flex-end;">
        <button id="appointment-confirm-cancel" style="padding: 10px 20px; background: #6b7280; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; font-family: 'Cairo', system-ui, -apple-system, sans-serif;">إلغاء</button>
        <button id="appointment-confirm-ok" style="padding: 10px 20px; background: #3b82f6; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; font-family: 'Cairo', system-ui, -apple-system, sans-serif;">✓ موافق</button>
      </div>
    </div>
  `;
  
  document.addEventListener('DOMContentLoaded', () => {
    document.body.appendChild(notificationContainer);
    document.body.appendChild(confirmDialog);
    restoreActiveNotifications();
  });

  if (document.readyState === 'loading') {
    // Wait for DOMContentLoaded
  } else {
    document.body.appendChild(notificationContainer);
    document.body.appendChild(confirmDialog);
    restoreActiveNotifications();
  }
  
  // Custom confirm function
  function customConfirm(text) {
    return new Promise((resolve) => {
      const confirmText = confirmDialog.querySelector('#appointment-confirm-text');
      const confirmOk = confirmDialog.querySelector('#appointment-confirm-ok');
      const confirmCancel = confirmDialog.querySelector('#appointment-confirm-cancel');
      
      confirmText.textContent = text;
      
      try {
        confirmDialog.showModal();
      } catch(e) {
        try {
          confirmDialog.close();
          confirmDialog.showModal();
        } catch(e2) {
          resolve(false);
          return;
        }
      }
      
      const onOk = () => {
        cleanup();
        resolve(true);
      };
      
      const onCancel = () => {
        cleanup();
        resolve(false);
      };
      
      function cleanup() {
        confirmOk.removeEventListener('click', onOk);
        confirmCancel.removeEventListener('click', onCancel);
        confirmDialog.close();
        try { window.focus(); } catch(e) {}
      }
      
      confirmOk.addEventListener('click', onOk);
      confirmCancel.addEventListener('click', onCancel);
    });
  }
  
  // Load and restore notifications from localStorage
  function restoreActiveNotifications() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const notifications = JSON.parse(stored);
        const now = Date.now();
        
        // Filter out expired notifications
        const activeNotifications = notifications.filter(n => n.expiresAt > now);
        
        // Save back filtered list
        if (activeNotifications.length !== notifications.length) {
          saveActiveNotifications(activeNotifications);
        }
        
        // Restore each active notification
        activeNotifications.forEach(notifData => {
          const remainingTime = notifData.expiresAt - now;
          showAppointmentNotification(notifData, remainingTime, false);
        });
      }
    } catch (err) {
      console.error('Error restoring notifications:', err);
    }
  }
  
  // Save active notifications to localStorage
  function saveActiveNotifications(notifications) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
    } catch (err) {
      console.error('Error saving notifications:', err);
    }
  }
  
  // Add notification to storage
  function addNotificationToStorage(data, expiresAt) {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const notifications = stored ? JSON.parse(stored) : [];
      
      // Check if notification already exists (by id)
      const existingIndex = notifications.findIndex(n => n.id === data.id);
      
      const notificationData = { ...data, expiresAt };
      
      if (existingIndex >= 0) {
        notifications[existingIndex] = notificationData;
      } else {
        notifications.push(notificationData);
      }
      
      saveActiveNotifications(notifications);
    } catch (err) {
      console.error('Error adding notification to storage:', err);
    }
  }
  
  // Remove notification from storage
  function removeNotificationFromStorage(notificationId) {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const notifications = JSON.parse(stored);
        const filtered = notifications.filter(n => n.id !== notificationId);
        saveActiveNotifications(filtered);
      }
    } catch (err) {
      console.error('Error removing notification from storage:', err);
    }
  }

  function formatTime(timeStr) {
    if (!timeStr) return '';
    return timeStr.substring(0, 5);
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB');
  }

  function showAppointmentNotification(data, customDuration = NOTIFICATION_DURATION, playSound = true) {
    // Check if notification with same ID already exists
    const existingNotification = notificationContainer.querySelector(`[data-notification-id="${data.id}"]`);
    if (existingNotification) {
      return; // Don't show duplicate
    }
    
    const notification = document.createElement('div');
    notification.className = 'appointment-notification';
    notification.setAttribute('data-notification-id', data.id);
    notification.style.cssText = `
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 20px;
      border-radius: 12px;
      margin-bottom: 10px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.3);
      animation: slideInRight 0.5s ease-out;
      pointer-events: auto;
      cursor: pointer;
      transition: transform 0.2s, box-shadow 0.2s;
      direction: rtl;
      font-family: 'Cairo', system-ui, -apple-system, sans-serif;
    `;
    
    const expiresAt = Date.now() + customDuration;
    addNotificationToStorage(data, expiresAt);

    const minutesText = data.minutesUntil === 1 ? 'دقيقة واحدة' : 
                       data.minutesUntil === 2 ? 'دقيقتين' :
                       `${data.minutesUntil} دقيقة`;

    notification.innerHTML = `
      <div style="display: flex; align-items: start; gap: 15px;">
        <div style="font-size: 32px; flex-shrink: 0;">🔔</div>
        <div style="flex: 1;">
          <div style="font-size: 18px; font-weight: bold; margin-bottom: 8px;">
            تذكير بموعد قادم
          </div>
          <div style="font-size: 14px; line-height: 1.6; opacity: 0.95;">
            <div style="margin-bottom: 4px;">
              <strong>العميل:</strong> ${data.customerName || 'غير محدد'}
            </div>
            ${data.customerPhone ? `
              <div style="margin-bottom: 4px;">
                <strong>الجوال:</strong> ${data.customerPhone}
              </div>
            ` : ''}
            <div style="margin-bottom: 4px;">
              <strong>التاريخ:</strong> ${formatDate(data.date)}
            </div>
            <div style="margin-bottom: 4px;">
              <strong>الوقت:</strong> ${formatTime(data.time)}
            </div>
            <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.3);">
              <strong style="color: #ffd700;">⏰ باقي ${minutesText}</strong>
            </div>
            ${data.notes ? `
              <div style="margin-top: 8px; padding: 8px; background: rgba(255,255,255,0.1); border-radius: 6px; font-size: 13px;">
                <strong>ملاحظات:</strong> ${data.notes}
              </div>
            ` : ''}
          </div>
        </div>
        <button class="close-notification-btn" style="
          background: rgba(255,255,255,0.2);
          border: none;
          color: white;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          cursor: pointer;
          font-size: 16px;
          line-height: 1;
          flex-shrink: 0;
          transition: background 0.2s;
        " onmouseover="this.style.background='rgba(255,255,255,0.3)'" 
           onmouseout="this.style.background='rgba(255,255,255,0.2)'">×</button>
      </div>
    `;

    notification.addEventListener('mouseenter', () => {
      notification.style.transform = 'translateX(-5px)';
      notification.style.boxShadow = '0 15px 50px rgba(0,0,0,0.4)';
    });

    notification.addEventListener('mouseleave', () => {
      notification.style.transform = 'translateX(0)';
      notification.style.boxShadow = '0 10px 40px rgba(0,0,0,0.3)';
    });

    notification.addEventListener('click', async (e) => {
      if (e.target.tagName !== 'BUTTON' && !e.target.classList.contains('close-notification-btn')) {
        if (window.location.href.indexOf('appointments') === -1) {
          const confirmed = await customConfirm('هل تريد الانتقال إلى صفحة المواعيد؟');
          if (confirmed) {
            window.location.href = '../appointments/index.html';
          }
        }
      }
    });
    
    // Close button handler
    const closeBtn = notification.querySelector('.close-notification-btn');
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      removeNotificationFromStorage(data.id);
      notification.style.animation = 'slideOutRight 0.5s ease-out';
      setTimeout(() => notification.remove(), 500);
    });

    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideInRight {
        from {
          transform: translateX(400px);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
      
      @keyframes slideOutRight {
        from {
          transform: translateX(0);
          opacity: 1;
        }
        to {
          transform: translateX(400px);
          opacity: 0;
        }
      }
    `;
    document.head.appendChild(style);

    notificationContainer.appendChild(notification);

    if (playSound) {
      const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBi2F0fPTgjMGHm7A7+OZRA0PVqzn77BdGQg+ltzy0H4pBSh+zPDdi0EHEluu5/CoWRYHTKXh8L1qIQUnfs/w04w2CSB0zPDajzsIE2S76+yhUhELTKDj8rppHgYqf9Dw3Iw3CSN3z/Dciz4JElux5++rVxUIRp/h8sFpJAQogs3z1Ik2Bx5wxe/fmUUMDlKp5PK1ZR0GNIzV8cx7KQUle8rx3Y5ACRJZsOf0qVkVC0Se4PO+aCQGKH3O8NuNOAkebsP07Z1GDA9Tq+X0s2IdBzaP1vPNeisFJHjI8N+PQQkSWbHn8qtYFQlGnuHz') ||
                  new Audio();
      audio.volume = 0.3;
      audio.play().catch(() => {});
    }

    // Auto-remove after custom duration
    setTimeout(() => {
      if (notification.parentNode) {
        removeNotificationFromStorage(data.id);
        notification.style.animation = 'slideOutRight 0.5s ease-out';
        setTimeout(() => notification.remove(), 500);
      }
    }, customDuration);
  }

  function showWhatsAppErrorNotification(reason, details) {
    const notification = document.createElement('div');
    notification.className = 'whatsapp-error-notification';
    
    const isNoInternet = reason === 'no-internet';
    const isNotConnected = reason === 'not-connected';
    
    // Both types use red color for critical warnings
    const bgColor = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
    const shadowColor = 'rgba(239, 68, 68, 0.4)';
    const icon = isNoInternet ? '🌐❌' : '📱❌';
    const title = isNoInternet ? 'لا يوجد اتصال بالإنترنت' : 'WhatsApp غير متصل';
    const subtitle = isNoInternet ? 'يرجى التحقق من الاتصال بالإنترنت' : 'يرجى ربط حساب WhatsApp أولاً';
    
    notification.style.cssText = `
      background: ${bgColor};
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      margin-bottom: 8px;
      box-shadow: 0 6px 20px ${shadowColor};
      animation: slideInRight 0.5s ease-out;
      pointer-events: auto;
      cursor: pointer;
      transition: transform 0.2s, box-shadow 0.2s;
      direction: rtl;
      font-family: 'Cairo', system-ui, -apple-system, sans-serif;
      max-width: 350px;
    `;
    
    notification.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px;">
        <div style="font-size: 20px; flex-shrink: 0;">${icon}</div>
        <div style="flex: 1;">
          <div style="font-size: 14px; font-weight: bold; margin-bottom: 2px;">
            ${title}
          </div>
          <div style="font-size: 12px; line-height: 1.4; opacity: 0.9;">
            ${subtitle}
          </div>
          ${details ? `
            <div style="font-size: 11px; line-height: 1.3; opacity: 0.8; margin-top: 3px;">
              ${details}
            </div>
          ` : ''}
        </div>
        <button class="close-notification-btn" style="
          background: rgba(255,255,255,0.2);
          border: none;
          color: white;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          cursor: pointer;
          font-size: 14px;
          line-height: 1;
          flex-shrink: 0;
          transition: background 0.2s;
        " onmouseover="this.style.background='rgba(255,255,255,0.3)'" 
           onmouseout="this.style.background='rgba(255,255,255,0.2)'">×</button>
      </div>
    `;

    notification.addEventListener('mouseenter', () => {
      notification.style.transform = 'translateX(-5px)';
      notification.style.boxShadow = `0 15px 50px ${shadowColor}`;
    });

    notification.addEventListener('mouseleave', () => {
      notification.style.transform = 'translateX(0)';
      notification.style.boxShadow = `0 10px 40px ${shadowColor}`;
    });
    
    const closeBtn = notification.querySelector('.close-notification-btn');
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      notification.style.animation = 'slideOutRight 0.5s ease-out';
      setTimeout(() => notification.remove(), 500);
    });

    notificationContainer.appendChild(notification);

    setTimeout(() => {
      if (notification.parentNode) {
        notification.style.animation = 'slideOutRight 0.5s ease-out';
        setTimeout(() => notification.remove(), 500);
      }
    }, 7000);
  }

  function showWhatsAppNotification(message, invoiceNo) {
    const notification = document.createElement('div');
    notification.className = 'whatsapp-notification';
    notification.style.cssText = `
      background: linear-gradient(135deg, #25D366 0%, #128C7E 100%);
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      margin-bottom: 8px;
      box-shadow: 0 6px 20px rgba(37, 211, 102, 0.4);
      animation: slideInRight 0.5s ease-out;
      pointer-events: auto;
      cursor: pointer;
      transition: transform 0.2s, box-shadow 0.2s;
      direction: rtl;
      font-family: 'Cairo', system-ui, -apple-system, sans-serif;
      max-width: 320px;
    `;
    
    notification.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px;">
        <div style="font-size: 20px; flex-shrink: 0;">✅</div>
        <div style="flex: 1;">
          <div style="font-size: 14px; font-weight: bold; margin-bottom: 2px;">
            ${message || 'تم إرسال الفاتورة عبر واتساب'}
          </div>
          ${invoiceNo ? `
            <div style="font-size: 12px; line-height: 1.4; opacity: 0.9;">
              <strong>رقم:</strong> ${invoiceNo}
            </div>
          ` : ''}
        </div>
        <button class="close-notification-btn" style="
          background: rgba(255,255,255,0.2);
          border: none;
          color: white;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          cursor: pointer;
          font-size: 14px;
          line-height: 1;
          flex-shrink: 0;
          transition: background 0.2s;
        " onmouseover="this.style.background='rgba(255,255,255,0.3)'" 
           onmouseout="this.style.background='rgba(255,255,255,0.2)'">×</button>
      </div>
    `;

    notification.addEventListener('mouseenter', () => {
      notification.style.transform = 'translateX(-5px)';
      notification.style.boxShadow = '0 15px 50px rgba(37, 211, 102, 0.5)';
    });

    notification.addEventListener('mouseleave', () => {
      notification.style.transform = 'translateX(0)';
      notification.style.boxShadow = '0 10px 40px rgba(37, 211, 102, 0.4)';
    });
    
    const closeBtn = notification.querySelector('.close-notification-btn');
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      notification.style.animation = 'slideOutRight 0.5s ease-out';
      setTimeout(() => notification.remove(), 500);
    });

    notificationContainer.appendChild(notification);

    const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBi2F0fPTgjMGHm7A7+OZRA0PVqzn77BdGQg+ltzy0H4pBSh+zPDdi0EHEluu5/CoWRYHTKXh8L1qIQUnfs/w04w2CSB0zPDajzsIE2S76+yhUhELTKDj8rppHgYqf9Dw3Iw3CSN3z/Dciz4JElux5++rVxUIRp/h8sFpJAQogs3z1Ik2Bx5wxe/fmUUMDlKp5PK1ZR0GNIzV8cx7KQUle8rx3Y5ACRJZsOf0qVkVC0Se4PO+aCQGKH3O8NuNOAkebsP07Z1GDA9Tq+X0s2IdBzaP1vPNeisFJHjI8N+PQQkSWbHn8qtYFQlGnuHz') ||
                  new Audio();
    audio.volume = 0.3;
    audio.play().catch(() => {});

    setTimeout(() => {
      if (notification.parentNode) {
        notification.style.animation = 'slideOutRight 0.5s ease-out';
        setTimeout(() => notification.remove(), 500);
      }
    }, 5000);
  }

  if (window.api && window.api.on) {
    window.api.on('appointment-reminder', (data) => {
      showAppointmentNotification(data);
    });
    
    window.api.on('whatsapp-invoice-sent', (data) => {
      showWhatsAppNotification(data.message, data.invoiceNo);
    });
  }

  window.showAppointmentNotification = showAppointmentNotification;
  window.showWhatsAppNotification = showWhatsAppNotification;
  window.showWhatsAppErrorNotification = showWhatsAppErrorNotification;
})();
