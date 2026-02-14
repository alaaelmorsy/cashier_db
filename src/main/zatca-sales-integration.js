const { ipcMain } = require('electron');
const ZatcaIntegration = require('./zatca');

class ZatcaSalesIntegration {
    constructor() {
        this.zatca = null;
        // تأخير إعداد IPC handlers حتى يتم تحميل electron
        setImmediate(() => {
            this.setupIpcHandlers();
        });
        this.initZatca();
    }

    async initZatca() {
        try {
            this.zatca = new ZatcaIntegration();
        } catch (error) {
            console.error('خطأ في تهيئة ZATCA:', error);
        }
    }

    setupIpcHandlers() {
        // IPC handlers منقولة إلى sales.js لتجنب التداخل
        // هذا الملف يوفر فقط الطرق للاستخدام من sales.js
    }

    /**
     * إنشاء فاتورة ZATCA من بيانات البيع
     */
    async generateZatcaInvoice(saleData) {
        try {
            if (!this.zatca) {
                return { 
                    success: false, 
                    message: 'نظام ZATCA غير مفعل',
                    zatcaEnabled: false
                };
            }

            // التحقق من إعداد ZATCA
            const zatcaConfig = await this.zatca.getConfig();
            if (!zatcaConfig.certificates?.certificate) {
                return { 
                    success: false, 
                    message: 'شهادة ZATCA غير مثبتة',
                    zatcaEnabled: false
                };
            }

            // تحويل بيانات البيع إلى صيغة ZATCA
            const invoiceData = await this.convertSaleToZatcaFormat(saleData, zatcaConfig);
            
            // إنشاء الفاتورة XML
            const invoiceResult = await this.zatca.generateInvoice(invoiceData);
            if (!invoiceResult.success) {
                return invoiceResult;
            }

            // توقيع الفاتورة
            const signResult = await this.zatca.signInvoice(invoiceResult.xml);
            if (!signResult.success) {
                return signResult;
            }

            // إنشاء QR Code للفاتورة
            const qrCode = this.generateQRCode(invoiceData, signResult.signedXML);

            return {
                success: true,
                zatcaEnabled: true,
                invoiceXML: signResult.signedXML,
                qrCode: qrCode,
                invoiceHash: signResult.hash,
                uuid: signResult.uuid,
                base64: signResult.base64,
                message: 'تم إنشاء فاتورة ZATCA بنجاح'
            };

        } catch (error) {
            console.error('خطأ في إنشاء فاتورة ZATCA:', error);
            return {
                success: false,
                zatcaEnabled: true,
                message: 'خطأ في إنشاء فاتورة ZATCA: ' + error.message
            };
        }
    }

    /**
     * إرسال الفاتورة إلى ZATCA
     */
    async submitZatcaInvoice(invoiceData) {
        try {
            if (!this.zatca) {
                return { 
                    success: false, 
                    message: 'نظام ZATCA غير مفعل'
                };
            }

            const result = await this.zatca.submitInvoice(invoiceData);
            return result;

        } catch (error) {
            console.error('خطأ في إرسال فاتورة ZATCA:', error);
            return {
                success: false,
                message: 'خطأ في إرسال فاتورة ZATCA: ' + error.message
            };
        }
    }

    /**
     * الحصول على حالة ZATCA
     */
    async getZatcaStatus() {
        try {
            if (!this.zatca) {
                return { 
                    enabled: false, 
                    configured: false,
                    message: 'نظام ZATCA غير مفعل'
                };
            }

            const config = await this.zatca.getConfig();
            const enabled = !!(config.certificates?.certificate && config.credentials?.username);
            
            return {
                enabled: enabled,
                configured: !!config.companyData,
                environment: config.environment || 'sandbox',
                message: enabled ? 'ZATCA مفعل وجاهز' : 'ZATCA غير مكتمل الإعداد'
            };

        } catch (error) {
            return {
                enabled: false,
                configured: false,
                message: 'خطأ في قراءة حالة ZATCA'
            };
        }
    }

    /**
     * تحويل بيانات البيع إلى صيغة ZATCA
     */
    async convertSaleToZatcaFormat(saleData, zatcaConfig) {
        const now = new Date();
        
        // استخراج بيانات الشركة من الإعدادات
        const companyData = zatcaConfig.companyData || {};
        
        // حساب المجاميع
        const subtotal = Math.abs(parseFloat(saleData.subtotal || 0));
        const discount = Math.abs(parseFloat(saleData.discount_amount || 0));
        const vatTotal = Math.abs(parseFloat(saleData.vat_amount || 0));
        const totalWithVAT = Math.abs(parseFloat(saleData.total || 0));

        // تحديد نوع المستند
        const documentType = saleData.doc_type === 'credit_note' ? '381' : '388';

        // بناء بيانات الفاتورة
        const invoiceData = {
            invoiceNumber: saleData.invoice_no || saleData.id?.toString(),
            issueDate: saleData.created_at ? new Date(saleData.created_at) : now,
            documentType: documentType,
            currency: 'SAR',
            
            // بيانات البائع
            seller: {
                name: companyData.organizationName || 'شركة تجريبية',
                vatNumber: companyData.vatNumber || '300000000000003',
                commercialRegistration: companyData.commercialRegistration,
                address: companyData.address || {
                    street: 'شارع الملك فهد',
                    city: 'الرياض',
                    country: 'SA'
                }
            },
            
            // بيانات المشتري
            buyer: {
                name: saleData.customer_name || 'عميل نقدي',
                vatNumber: saleData.customer_vat,
                address: {
                    street: saleData.customer_address || '',
                    city: 'الرياض',
                    country: 'SA'
                }
            },
            
            // بنود الفاتورة
            items: await this.convertSaleItemsToZatcaFormat(saleData.items || []),
            
            // المجاميع
            totals: {
                subtotal: subtotal,
                discount: discount,
                vatTotal: vatTotal,
                totalWithVAT: totalWithVAT,
                charges: Math.abs(parseFloat(saleData.charges || saleData.shipping_price || 0))
            },
            
            // طريقة الدفع
            payment: {
                method: this.mapPaymentMethod(saleData.payment_method)
            }
        };

        // إضافة مرجع الفاتورة الأصلية للمذكرة الدائنة
        if (documentType === '381' && saleData.original_invoice_no) {
            invoiceData.originalInvoiceReference = saleData.original_invoice_no;
            invoiceData.originalInvoiceDate = saleData.original_invoice_date;
        }

        return invoiceData;
    }

    /**
     * تحويل بنود البيع إلى صيغة ZATCA
     * - يراعي إعداد النظام: الأسعار شاملة الضريبة أم لا (prices_include_vat)
     * - يضبط BT-146 بشكل صحيح وفق الوضع
     */
    async convertSaleItemsToZatcaFormat(items) {
        // قراءة إعداد الأسعار شاملة الضريبة ونسبة الضريبة الافتراضية من قاعدة البيانات
        let includeVAT = true;
        let defaultVat = 15;
        try {
            const conn = await dbAdapter.getConnection();
            try {
                const [rows] = await conn.query('SELECT prices_include_vat, vat_percent FROM app_settings WHERE id=1 LIMIT 1');
                if (rows && rows[0]) {
                    includeVAT = !!rows[0].prices_include_vat;
                    defaultVat = Number(rows[0].vat_percent || defaultVat);
                }
            } finally {
                // تأكد من إرجاع الاتصال للمسبح
                try { conn.release(); } catch (_) {}
            }
        } catch (_) { /* استخدم القيم الافتراضية عند الفشل */ }

        const num = (v) => Math.abs(parseFloat(v || 0));

        return items.map(item => {
            const qty = num(item.quantity || 1);
            const price = num(item.price || 0);
            const vatRate = num(item.vat_rate ?? defaultVat);

            const base = {
                name: item.product_name || item.name || 'منتج',
                description: item.description || '',
                quantity: qty,
                vatRate: vatRate,
                taxCategory: 'S', // Standard rate
                unitCode: 'PCE', // Piece
                lineTotal: num(item.total || 0)
            };

            if (includeVAT) {
                // السعر المدخل شامل الضريبة -> نمرره كـ Gross ليُشتق الصافي تلقائيًا (BT-146)
                return { ...base, unitPrice: price, unitPriceIsGross: true };
            } else {
                // السعر المدخل غير شامل الضريبة -> مرر صافي السعر مباشرةً
                return { ...base, unitPriceNet: price };
            }
        });
    }

    /**
     * تحويل طريقة الدفع إلى كود ZATCA
     */
    mapPaymentMethod(method) {
        const methodMap = {
            'cash': 'cash',
            'credit_card': 'credit',
            'debit_card': 'debit',
            'bank_transfer': 'transfer',
            'check': 'check'
        };
        return methodMap[method] || 'cash';
    }

    /**
     * إنشاء QR Code للفاتورة
     */
    generateQRCode(invoiceData, signedXML) {
        try {
            // بناء QR Code وفقاً لمعايير ZATCA
            const totalWithVAT = Math.abs(Number(invoiceData.totals.totalWithVAT || 0)).toFixed(2);
            const vatTotal = Math.abs(Number(invoiceData.totals.vatTotal || 0)).toFixed(2);
            const qrElements = [
                { tag: 1, value: String(invoiceData.seller.name || '') },
                { tag: 2, value: String(invoiceData.seller.vatNumber || '') },
                { tag: 3, value: new Date(invoiceData.issueDate).toISOString() },
                { tag: 4, value: totalWithVAT },
                { tag: 5, value: vatTotal }
            ];

            let qrCodeData = '';
            for (const element of qrElements) {
                const tagByte = String.fromCharCode(element.tag);
                const lengthByte = String.fromCharCode(element.value.length);
                qrCodeData += tagByte + lengthByte + element.value;
            }

            return Buffer.from(qrCodeData, 'utf8').toString('base64');
        } catch (error) {
            console.error('خطأ في إنشاء QR Code:', error);
            return '';
        }
    }

    /**
     * تحديث بيانات البيع بمعلومات ZATCA
     */
    async updateSaleWithZatcaData(saleId, zatcaData) {
        try {
            const conn = await dbAdapter.getConnection();

            try {
                
                await conn.query(`
                    UPDATE sales 
                    SET zatca_uuid = ?, zatca_hash = ?, zatca_qr = ?, zatca_submitted = NOW()
                    WHERE id = ?
                `, [
                    zatcaData.uuid,
                    zatcaData.invoiceHash,
                    zatcaData.qrCode,
                    saleId
                ]);

                return { success: true };
            } finally {
                conn.release();
            }
        } catch (error) {
            console.error('خطأ في تحديث بيانات البيع:', error);
            return { success: false, message: error.message };
        }
    }

    // Map external POS payload to internal ZATCA invoice format with positivity enforced
    mapExternalPayloadToInvoiceData(external) {
        const num = (v) => Math.abs(Number(v || 0));
        const pick = (...vals) => vals.find(v => v !== undefined && v !== null && String(v).trim() !== '');

        const documentType = String(pick(external.type_inv, external.typeInv, external.type) || '388');
        const isCreditNote = documentType === '381';

        // Seller (branch)
        const branch = external.branch || {};
        const seller = {
            name: pick(branch.ar_name, branch.en_name, branch.branch_name, 'Seller') ,
            vatNumber: pick(branch.tax_number, '300000000000003'),
            commercialRegistration: branch.commercial_num,
            address: {
                street: pick(branch.ar_address, branch.en_address, ''),
                building: pick(branch.build_number, branch.building_number, ''),
                city: pick(branch.city?.ar_name, branch.city?.en_name, branch.city?.name, 'الرياض'),
                postalCode: pick(branch.zip, ''),
                district: pick(branch.subdivision, ''),
                country: 'SA'
            }
        };

        // Buyer (customer)
        const customer = external.customer || {};
        const buyer = {
            name: pick(customer.ar_name, customer.en_name, 'عميل نقدي'),
            vatNumber: customer.tax_number,
            address: {
                street: pick(customer.ar_address, customer.en_address, ''),
                city: pick(customer.city?.ar_name, customer.city?.en_name, 'الرياض'),
                district: pick(customer.subdivision, ''),
                country: 'SA'
            }
        };

        // Items
        const items = Array.isArray(external.products) ? external.products.map(p => ({
            name: pick(p.name, `Item ${p.id || ''}`),
            description: '',
            quantity: num(p.count || p.quantity || 1),
            unitPrice: num(p.selling_price ?? p.price ?? 0), // unit price net of VAT
            lineTotal: num(p.total_selling_after_dis ?? p.total_net ?? (num(p.selling_price ?? p.price ?? 0) * num(p.count || 1))),
            vatRate: num(p.tax_rate ?? external.tax_rate ?? 15),
            taxCategory: 'S',
            unitCode: 'PCE'
        })) : [];

        // Totals
        const totals = {
            subtotal: num(pick(external.total_without_tax, external.sum, 0)),
            discount: num(pick(external.discount, external.dis_val, 0)),
            vatTotal: num(pick(external.tax, 0)),
            totalWithVAT: num(pick(external.total_with_tax, external.total, 0)),
            charges: num(pick(external.shipping_price, 0))
        };

        // Payment mapping
        const paymentCode = String(pick(external.payment_type, '10'));
        const method = this.mapPaymentMethodFromCode(paymentCode);

        const invoiceData = {
            invoiceNumber: String(pick(external.type_invoice, external.invoice_no, external.id, Date.now())),
            issueDate: external.invoice_date ? new Date(external.invoice_date) : new Date(),
            documentType: isCreditNote ? '381' : '388',
            currency: 'SAR',
            seller,
            buyer,
            items,
            totals,
            payment: { method },
        };

        // Optional original invoice reference for credit notes
        const firstRef = Array.isArray(external.return_invoices) && external.return_invoices.length ? external.return_invoices[0] : null;
        if (isCreditNote && (external.return_id || firstRef)) {
            invoiceData.originalInvoiceReference = pick(firstRef?.invoice_no, external.return_id);
            invoiceData.originalInvoiceDate = pick(firstRef?.invoice_date, external.original_invoice_date);
        }

        return invoiceData;
    }

    // Map UN/ECE 4461 numeric codes to our internal payment method strings
    mapPaymentMethodFromCode(code) {
        switch (String(code)) {
            case '10': return 'cash';
            case '48': return 'credit';
            case '49': return 'debit';
            case '42': return 'transfer';
            case '20': return 'check';
            default: return 'cash';
        }
    }

    // Full pipeline: map -> generate -> sign -> submit (positive-only amounts throughout)
    async processAndSubmitExternalInvoice(externalPayload) {
        if (!this.zatca) {
            return { success: false, message: 'نظام ZATCA غير مفعل', zatcaEnabled: false };
        }
        const config = await this.zatca.getConfig();
        if (!config.certificates?.certificate) {
            return { success: false, message: 'شهادة ZATCA غير مثبتة', zatcaEnabled: false };
        }

        const invoiceData = this.mapExternalPayloadToInvoiceData(externalPayload);

        // Generate XML (Invoice or CreditNote based on documentType)
        const gen = await this.zatca.generateInvoice(invoiceData);
        if (!gen.success) return gen;

        // Sign
        const signed = await this.zatca.signInvoice(gen.xml);
        if (!signed.success) return signed;

        // QR (positive totals already ensured)
        const qrCode = this.generateQRCode(invoiceData, signed.signedXML);

        // Submit to ZATCA
        const submitted = await this.zatca.submitInvoice({
            hash: signed.hash,
            uuid: signed.uuid,
            base64: signed.base64
        });

        return {
            success: submitted.success,
            zatcaEnabled: true,
            invoiceXML: signed.signedXML,
            invoiceHash: signed.hash,
            uuid: signed.uuid,
            base64: signed.base64,
            qrCode,
            data: submitted.data,
            message: submitted.message || 'تم إنشاء وتوقيع وإرسال المستند بنجاح'
        };
    }
}

module.exports = ZatcaSalesIntegration;