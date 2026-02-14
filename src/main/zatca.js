const { ipcMain } = require('electron');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');
const forge = require('node-forge');
const { app } = require('electron');

// Resolve a writable path for ZATCA config regardless of dev/production (asar)
function getZatcaConfigPath(){
  try{
    const userData = app.getPath('userData');
    return path.join(userData, '.zatca-config.json');
  }catch(_){
    // Fallback to CWD if app is not initialized
    return path.join(process.cwd(), '.zatca-config.json');
  }
}

// Prevent duplicate IPC handler registration across multiple instances
let ZATCA_HANDLERS_REGISTERED = false;

class ZatcaIntegration {
    constructor() {
        this.config = {
            environment: 'sandbox', // sandbox, simulation, production
            endpoints: {
                sandbox: 'https://gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal',
                simulation: 'https://gw-fatoora.zatca.gov.sa/e-invoicing/simulation', 
                production: 'https://gw-fatoora.zatca.gov.sa/e-invoicing/core'
            },
            certificates: {
                privateKey: null,
                certificate: null,
                csr: null
            },
            credentials: {
                username: null,
                password: null,
                otp: null
            }
        };
        
        // تأخير إعداد IPC handlers حتى يتم تحميل electron
        setImmediate(() => {
            this.setupIpcHandlers();
        });
        this.loadConfig();
    }

    setupIpcHandlers() {
        if (ZATCA_HANDLERS_REGISTERED) {
            return; // Avoid double-registration
        }
        ZATCA_HANDLERS_REGISTERED = true;
        // إعدادات ZATCA
        ipcMain.handle('zatca:getConfig', () => this.getConfig());
        ipcMain.handle('zatca:saveConfig', (event, config) => this.saveConfig(config));
        
        // إدارة الشهادات
        ipcMain.handle('zatca:generateCSR', (event, data) => this.generateCSR(data));
        ipcMain.handle('zatca:submitCSR', (event, csr, otp) => this.submitCSR(csr, otp));
        ipcMain.handle('zatca:installCertificate', (event, certData) => this.installCertificate(certData));
        
        // الفواتير الإلكترونية
        ipcMain.handle('zatca:generateInvoice', (event, invoiceData) => this.generateInvoice(invoiceData));
        ipcMain.handle('zatca:signInvoice', (event, invoiceXML) => this.signInvoice(invoiceXML));
        ipcMain.handle('zatca:submitInvoice', (event, signedInvoice) => this.submitInvoice(signedInvoice));
        
        // تقارير الامتثال
        ipcMain.handle('zatca:complianceCheck', (event, invoiceData) => this.complianceCheck(invoiceData));
        ipcMain.handle('zatca:getComplianceReport', () => this.getComplianceReport());
    }

    async loadConfig() {
        try {
            const configPath = getZatcaConfigPath();
            const data = await fs.readFile(configPath, 'utf8');
            this.config = { ...this.config, ...JSON.parse(data) };
        } catch (error) {
            // Avoid non-ASCII output in Windows console to prevent mojibake
            console.log('ZATCA settings file initialized');
        }
    }

    async saveConfig(newConfig) {
        try {
            this.config = { ...this.config, ...newConfig };
            const configPath = getZatcaConfigPath();
            await fs.writeFile(configPath, JSON.stringify(this.config, null, 2));
            return { success: true, message: 'تم حفظ الإعدادات بنجاح' };
        } catch (error) {
            return { success: false, message: 'خطأ في حفظ الإعدادات: ' + error.message };
        }
    }

    getConfig() {
        // إرجاع الإعدادات بدون البيانات الحساسة
        const safeConfig = { ...this.config };
        if (safeConfig.certificates?.privateKey) {
            safeConfig.certificates.privateKey = '***محجوب***';
        }
        if (safeConfig.credentials?.password) {
            safeConfig.credentials.password = '***محجوب***';
        }
        return safeConfig;
    }

    async generateCSR(companyData) {
        try {
            const keys = forge.pki.rsa.generateKeyPair(2048);
            const csr = forge.pki.createCertificationRequest();
            
            csr.publicKey = keys.publicKey;
            
            // إعداد معلومات الشركة
            csr.setSubject([
                { name: 'countryName', value: 'SA' },
                { name: 'organizationName', value: companyData.organizationName },
                { name: 'organizationalUnitName', value: companyData.organizationalUnit || 'IT Department' },
                { name: 'commonName', value: companyData.commonName },
                { name: 'serialNumber', value: companyData.serialNumber }
            ]);

            // إضافة السمات المطلوبة لـ ZATCA
            const extensions = [
                {
                    name: 'subjectAltName',
                    altNames: [
                        { type: 1, value: companyData.serialNumber }, // ZATCA Tax ID
                        { type: 2, value: companyData.vatNumber }, // VAT Registration Number
                        { type: 6, value: companyData.businessCategory || 'Supply activities' },
                        { type: 1, value: companyData.location || 'Riyadh' }
                    ]
                }
            ];

            csr.setAttributes([
                {
                    name: 'extensionRequest',
                    extensions: extensions
                }
            ]);

            csr.sign(keys.privateKey);

            const csrPem = forge.pki.certificationRequestToPem(csr);
            const privateKeyPem = forge.pki.privateKeyToPem(keys.privateKey);

            // حفظ المفاتيح
            this.config.certificates.privateKey = privateKeyPem;
            this.config.certificates.csr = csrPem;
            await this.saveConfig(this.config);

            return {
                success: true,
                csr: csrPem,
                message: 'تم إنشاء طلب الشهادة بنجاح'
            };

        } catch (error) {
            return {
                success: false,
                message: 'خطأ في إنشاء طلب الشهادة: ' + error.message
            };
        }
    }

    async submitCSR(csr, otp) {
        try {
            const endpoint = this.config.endpoints[this.config.environment];
            const url = `${endpoint}/compliance`;

            const response = await axios.post(url, {
                csr: Buffer.from(csr).toString('base64')
            }, {
                headers: {
                    'Accept': 'application/json',
                    'OTP': otp,
                    'Accept-Version': 'V2',
                    'Content-Type': 'application/json'
                }
            });

            if (response.data.binarySecurityToken) {
                // حفظ الشهادة المستلمة
                this.config.certificates.certificate = response.data.binarySecurityToken;
                this.config.credentials.username = response.data.requestID;
                this.config.credentials.password = response.data.secret;
                await this.saveConfig(this.config);

                return {
                    success: true,
                    data: response.data,
                    message: 'تم استلام الشهادة بنجاح'
                };
            }

            return {
                success: false,
                message: 'لم يتم استلام الشهادة من الخادم'
            };

        } catch (error) {
            return {
                success: false,
                message: 'خطأ في إرسال طلب الشهادة: ' + error.response?.data?.message || error.message
            };
        }
    }

    async installCertificate(certData) {
        try {
            this.config.certificates.certificate = certData.certificate;
            this.config.credentials.username = certData.username;
            this.config.credentials.password = certData.password;
            
            await this.saveConfig(this.config);
            
            return {
                success: true,
                message: 'تم تثبيت الشهادة بنجاح'
            };
        } catch (error) {
            return {
                success: false,
                message: 'خطأ في تثبيت الشهادة: ' + error.message
            };
        }
    }

    async generateInvoice(invoiceData) {
        try {
            const InvoiceGenerator = require('./zatca-invoice-generator');
            const generator = new InvoiceGenerator(this.config);
            
            // Choose correct document generator based on documentType
            const isCreditNote = String(invoiceData?.documentType) === '381';
            const xml = isCreditNote
                ? await generator.generateCreditNoteXML(invoiceData)
                : await generator.generateInvoiceXML(invoiceData);
            
            return {
                success: true,
                xml,
                message: 'تم إنشاء الفاتورة بنجاح'
            };
        } catch (error) {
            return {
                success: false,
                message: 'خطأ في إنشاء الفاتورة: ' + error.message
            };
        }
    }

    async signInvoice(invoiceXML) {
        try {
            const DigitalSignature = require('./zatca-digital-signature');
            const signer = new DigitalSignature(this.config);
            
            const res = await signer.signInvoiceXML(invoiceXML);
            // Normalize return shape so callers can access signedXML/hash/uuid/base64 directly
            return {
                success: true,
                signedXML: res.signedXML,
                hash: res.hash,
                uuid: res.uuid,
                base64: res.base64,
                message: 'تم توقيع الفاتورة بنجاح'
            };
        } catch (error) {
            return {
                success: false,
                message: 'خطأ في توقيع الفاتورة: ' + error.message
            };
        }
    }

    async submitInvoice(signedInvoice) {
        try {
            const endpoint = this.config.endpoints[this.config.environment];
            const url = `${endpoint}/invoices/reporting/single`;

            const auth = Buffer.from(`${this.config.credentials.username}:${this.config.credentials.password}`).toString('base64');

            const response = await axios.post(url, {
                invoiceHash: signedInvoice.hash,
                uuid: signedInvoice.uuid,
                invoice: signedInvoice.base64
            }, {
                headers: {
                    'Authorization': `Basic ${auth}`,
                    'Accept': 'application/json',
                    'Accept-Version': 'V2',
                    'Content-Type': 'application/json'
                }
            });

            return {
                success: true,
                data: response.data,
                message: 'تم إرسال الفاتورة بنجاح'
            };

        } catch (error) {
            return {
                success: false,
                message: 'خطأ في إرسال الفاتورة: ' + error.response?.data?.message || error.message
            };
        }
    }

    async complianceCheck(invoiceData) {
        try {
            // إنشاء فاتورة تجريبية للفحص
            const invoice = await this.generateInvoice(invoiceData);
            if (!invoice.success) return invoice;

            const signedInvoice = await this.signInvoice(invoice.xml);
            if (!signedInvoice.success) return signedInvoice;

            const endpoint = this.config.endpoints[this.config.environment];
            const url = `${endpoint}/compliance/invoices`;

            const auth = Buffer.from(`${this.config.credentials.username}:${this.config.credentials.password}`).toString('base64');

            const response = await axios.post(url, {
                invoiceHash: signedInvoice.hash,
                uuid: signedInvoice.uuid,
                invoice: signedInvoice.base64
            }, {
                headers: {
                    'Authorization': `Basic ${auth}`,
                    'Accept': 'application/json',
                    'Accept-Version': 'V2',
                    'Content-Type': 'application/json'
                }
            });

            return {
                success: true,
                complianceResult: response.data,
                message: 'تم فحص الامتثال بنجاح'
            };

        } catch (error) {
            return {
                success: false,
                message: 'خطأ في فحص الامتثال: ' + error.response?.data?.message || error.message
            };
        }
    }

    async getComplianceReport() {
        try {
            // إنشاء تقرير الامتثال بناءً على البيانات المحفوظة
            const report = {
                certificateStatus: this.config.certificates.certificate ? 'مفعل' : 'غير مفعل',
                environment: this.config.environment,
                lastUpdate: new Date().toLocaleString('ar-SA'),
                complianceChecks: {
                    certificateInstalled: !!this.config.certificates.certificate,
                    credentialsConfigured: !!(this.config.credentials.username && this.config.credentials.password),
                    environmentSet: !!this.config.environment
                }
            };

            return {
                success: true,
                report: report,
                message: 'تم استخراج تقرير الامتثال'
            };
        } catch (error) {
            return {
                success: false,
                message: 'خطأ في استخراج تقرير الامتثال: ' + error.message
            };
        }
    }
}

module.exports = ZatcaIntegration;