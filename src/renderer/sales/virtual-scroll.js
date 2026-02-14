// Virtual Scrolling للجدول - يعرض فقط الصفوف المرئية لتحسين الأداء
class VirtualScrollTable {
  constructor(container, renderRowCallback, options = {}) {
    this.container = container;
    this.renderRowCallback = renderRowCallback;
    this.items = [];
    this.itemHeight = options.itemHeight || 60; // ارتفاع افتراضي للصف
    this.bufferSize = options.bufferSize || 5; // عدد الصفوف الإضافية خارج الشاشة
    this.enabled = options.enabled !== false; // افتراضياً مفعّل
    
    this.scrollContainer = null;
    this.tbody = null;
    this.viewportStart = 0;
    this.viewportEnd = 0;
    
    this.init();
  }
  
  init() {
    if (!this.enabled || !this.container) return;
    
    // إنشاء هيكل للـ virtual scroll
    const scrollWrapper = document.createElement('div');
    scrollWrapper.className = 'virtual-scroll-wrapper';
    scrollWrapper.style.cssText = `
      position: relative;
      overflow-y: auto;
      max-height: inherit;
    `;
    
    const spacer = document.createElement('div');
    spacer.className = 'virtual-scroll-spacer';
    spacer.style.cssText = `
      position: relative;
      height: 0;
    `;
    
    scrollWrapper.appendChild(spacer);
    
    // نقل tbody الموجود إلى داخل spacer
    this.tbody = this.container.querySelector('tbody');
    if (this.tbody) {
      spacer.appendChild(this.tbody);
    }
    
    // استبدال المحتوى
    const table = this.container.querySelector('table');
    if (table) {
      const parent = table.parentElement;
      parent.replaceChild(scrollWrapper, table);
      scrollWrapper.appendChild(table);
    }
    
    this.scrollContainer = scrollWrapper;
    this.spacer = spacer;
    
    // إضافة مستمع للتمرير
    if (this.scrollContainer) {
      this.scrollContainer.addEventListener('scroll', () => this.handleScroll());
    }
  }
  
  setItems(items) {
    this.items = items || [];
    this.render();
  }
  
  handleScroll() {
    if (!this.enabled || !this.scrollContainer) return;
    
    const scrollTop = this.scrollContainer.scrollTop;
    const viewportHeight = this.scrollContainer.clientHeight;
    
    const newStart = Math.max(0, Math.floor(scrollTop / this.itemHeight) - this.bufferSize);
    const newEnd = Math.min(
      this.items.length,
      Math.ceil((scrollTop + viewportHeight) / this.itemHeight) + this.bufferSize
    );
    
    if (newStart !== this.viewportStart || newEnd !== this.viewportEnd) {
      this.viewportStart = newStart;
      this.viewportEnd = newEnd;
      this.render();
    }
  }
  
  render() {
    if (!this.enabled || !this.tbody || !this.spacer) {
      // fallback: رسم عادي
      if (this.tbody) {
        this.tbody.innerHTML = '';
        this.items.forEach((item, index) => {
          const rows = this.renderRowCallback(item, index);
          if (Array.isArray(rows)) {
            rows.forEach(row => this.tbody.appendChild(row));
          } else if (rows) {
            this.tbody.appendChild(rows);
          }
        });
      }
      return;
    }
    
    // حساب الارتفاع الكلي
    const totalHeight = this.items.length * this.itemHeight;
    this.spacer.style.height = totalHeight + 'px';
    
    // حساب نطاق العرض
    if (this.viewportStart === 0 && this.viewportEnd === 0) {
      const viewportHeight = this.scrollContainer.clientHeight;
      this.viewportEnd = Math.min(
        this.items.length,
        Math.ceil(viewportHeight / this.itemHeight) + this.bufferSize
      );
    }
    
    // مسح الصفوف الحالية
    this.tbody.innerHTML = '';
    
    // رسم الصفوف المرئية فقط
    for (let i = this.viewportStart; i < this.viewportEnd; i++) {
      if (i >= this.items.length) break;
      
      const item = this.items[i];
      const rows = this.renderRowCallback(item, i);
      
      if (Array.isArray(rows)) {
        rows.forEach(row => {
          row.style.position = 'absolute';
          row.style.top = (i * this.itemHeight) + 'px';
          row.style.width = '100%';
          this.tbody.appendChild(row);
        });
      } else if (rows) {
        rows.style.position = 'absolute';
        rows.style.top = (i * this.itemHeight) + 'px';
        rows.style.width = '100%';
        this.tbody.appendChild(rows);
      }
    }
  }
  
  destroy() {
    if (this.scrollContainer) {
      this.scrollContainer.removeEventListener('scroll', this.handleScroll);
    }
  }
  
  enable() {
    this.enabled = true;
    this.render();
  }
  
  disable() {
    this.enabled = false;
    this.render();
  }
}

// تصدير للاستخدام في الملفات الأخرى
if (typeof module !== 'undefined' && module.exports) {
  module.exports = VirtualScrollTable;
}
