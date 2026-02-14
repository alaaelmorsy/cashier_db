const crypto = require('crypto');
const forge = require('node-forge');
const { XMLParser, XMLBuilder } = require('xml2js');

class ZatcaDigitalSignature {
    constructor(config) {
        this.config = config;
    }

    /**
     * توقيع البيانات باستخدام المفتاح الخاص
     */
    signData(data, privateKeyPem) {
        try {
            const privateKey = crypto.createPrivateKey(privateKeyPem);
            const sign = crypto.createSign('SHA256');
            sign.update(data);
            sign.end();
            
            const signature = sign.sign(privateKey);
            return Buffer.from(signature).toString('base64');
        } catch (error) {
            throw new Error('خطأ في توقيع البيانات: ' + error.message);
        }
    }

    /**
     * التحقق من التوقيع الرقمي
     */
    verifySignature(data, signatureBase64, publicKeyPem) {
        try {
            const publicKey = crypto.createPublicKey(publicKeyPem);
            const verify = crypto.createVerify('SHA256');
            verify.update(data);
            verify.end();
            
            const signature = Buffer.from(signatureBase64, 'base64');
            return verify.verify(publicKey, signature);
        } catch (error) {
            throw new Error('خطأ في التحقق من التوقيع: ' + error.message);
        }
    }

    /**
     * إنشاء hash للفاتورة
     */
    generateInvoiceHash(invoiceXML) {
        try {
            // تنظيف XML وإزالة المسافات الزائدة
            const cleanXML = invoiceXML.replace(/>\s+</g, '><').trim();
            
            // إنشاء SHA256 hash
            const hash = crypto.createHash('sha256');
            hash.update(cleanXML, 'utf8');
            
            return hash.digest('base64');
        } catch (error) {
            throw new Error('خطأ في إنشاء hash للفاتورة: ' + error.message);
        }
    }

    /**
     * إنشاء QR Code للفاتورة
     */
    generateQRCode(invoiceData) {
        try {
            // بناء QR Code وفقاً لمعايير ZATCA
            const qrElements = [
                { tag: 1, value: invoiceData.seller.name }, // اسم البائع
                { tag: 2, value: invoiceData.seller.vatNumber }, // رقم التسجيل الضريبي
                { tag: 3, value: invoiceData.issueDateTime }, // تاريخ ووقت الإصدار
                { tag: 4, value: invoiceData.totals.totalWithVAT.toString() }, // إجمالي الفاتورة شامل الضريبة
                { tag: 5, value: invoiceData.totals.vatTotal.toString() } // مبلغ ضريبة القيمة المضافة
            ];

            let qrCodeData = '';
            for (const element of qrElements) {
                const tagByte = String.fromCharCode(element.tag);
                const lengthByte = String.fromCharCode(element.value.length);
                qrCodeData += tagByte + lengthByte + element.value;
            }

            return Buffer.from(qrCodeData, 'utf8').toString('base64');
        } catch (error) {
            throw new Error('خطأ في إنشاء QR Code: ' + error.message);
        }
    }

    /**
     * تأمين أن كل القيم الرقمية (Amounts/Quantities/Percent) موجبة
     */
    ensureAllAmountsPositive(node) {
        const isObject = (v) => v && typeof v === 'object';
        const numericTags = new Set([
            // CommonBasicComponents names (without prefix)
            'Amount','TaxAmount','TaxableAmount','LineExtensionAmount','PriceAmount','PayableAmount',
            'TaxExclusiveAmount','TaxInclusiveAmount','AllowanceTotalAmount','ChargeTotalAmount',
            'PrepaidAmount','RoundingAmount','Quantity','InvoicedQuantity','CreditedQuantity','DebitedQuantity',
            'BaseQuantity','Percent'
        ]);

        const fixValue = (val) => {
            if (val == null) return val;
            if (typeof val === 'number') return Math.abs(val);
            if (typeof val === 'string') {
                const num = Number(val);
                return isNaN(num) ? val : Math.abs(num).toFixed(2);
            }
            if (isObject(val) && '#text' in val) {
                const num = Number(val['#text']);
                if (!isNaN(num)) {
                    const fixed = Math.abs(num).toFixed(2);
                    return { ...val, '#text': fixed };
                }
            }
            return val;
        };

        const walk = (obj) => {
            if (!isObject(obj)) return;
            for (const key of Object.keys(obj)) {
                const val = obj[key];
                const local = key.includes(':') ? key.split(':')[1] : key; // drop prefix
                if (numericTags.has(local)) {
                    obj[key] = fixValue(val);
                }
                if (Array.isArray(val)) {
                    for (const item of val) walk(item);
                } else if (isObject(val)) {
                    walk(val);
                }
            }
        };

        walk(node);
        return node;
    }

    /**
     * توقيع فاتورة XML كاملة
     */
    async signInvoiceXML(invoiceXML) {
        try {
            if (!this.config.certificates.privateKey) {
                throw new Error('المفتاح الخاص غير متوفر');
            }

            // تحليل XML
            const parser = new XMLParser({ 
                ignoreAttributes: false,
                parseAttributeValue: true,
                trimValues: true
            });
            let xmlDoc = parser.parse(invoiceXML);
            
            // طبّق تحويل كل القيم إلى موجبة قبل أي حسابات لاحقة
            xmlDoc = this.ensureAllAmountsPositive(xmlDoc);

            // إنشاء معرف فريد للفاتورة
            const uuid = require('crypto').randomUUID();

            // تأكد من أن كل المبالغ في QR موجبة إذا تم تمريرها لاحقاً
            // (منطق QR يبقى في طبقة أخرى؛ هذا تذكير لضمان تناسق البيانات)
            
            // أعد بناء XML من الكائن المُصحّح لضمان أن الهاش على نسخة موجبة بالكامل
            const rebuildBuilder = new XMLBuilder({ ignoreAttributes: false, format: true, indentBy: '  ', suppressEmptyNode: true });
            const sanitizedXML = rebuildBuilder.build(xmlDoc);

            // إنشاء hash للفاتورة على XML الموجب
            const invoiceHash = this.generateInvoiceHash(sanitizedXML);
            
            // تحديد جذر المستند (Invoice أو CreditNote)
            const rootName = xmlDoc.Invoice ? 'Invoice' : (xmlDoc.CreditNote ? 'CreditNote' : null);
            if (!rootName) {
                throw new Error('نوع المستند غير مدعوم: يجب أن يكون Invoice أو CreditNote');
            }
            // إضافة معلومات التوقيع إلى XML
            if (!xmlDoc[rootName].UBLExtensions) {
                xmlDoc[rootName].UBLExtensions = {};
            }
            
            if (!xmlDoc[rootName].UBLExtensions.UBLExtension) {
                xmlDoc[rootName].UBLExtensions.UBLExtension = [];
            }

            // إضافة UBL Extension للتوقيع الرقمي
            const signatureExtension = {
                ExtensionURI: "urn:oasis:names:specification:ubl:dsig:enveloped:xades",
                ExtensionContent: {
                    Signature: {
                        '@_xmlns': "http://www.w3.org/2000/09/xmldsig#",
                        '@_Id': "signature",
                        SignedInfo: {
                            CanonicalizationMethod: {
                                '@_Algorithm': "http://www.w3.org/2006/12/xml-c14n11"
                            },
                            SignatureMethod: {
                                '@_Algorithm': "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"
                            },
                            Reference: {
                                '@_URI': "",
                                Transforms: {
                                    Transform: [
                                        { '@_Algorithm': "http://www.w3.org/2000/09/xmldsig#enveloped-signature" },
                                        { '@_Algorithm': "http://www.w3.org/2006/12/xml-c14n11" }
                                    ]
                                },
                                DigestMethod: {
                                    '@_Algorithm': "http://www.w3.org/2001/04/xmlenc#sha256"
                                },
                                DigestValue: invoiceHash
                            }
                        },
                        SignatureValue: this.signData(sanitizedXML, this.config.certificates.privateKey),
                        KeyInfo: {
                            X509Data: {
                                X509Certificate: this.config.certificates.certificate
                            }
                        }
                    }
                }
            };

            xmlDoc[rootName].UBLExtensions.UBLExtension.push(signatureExtension);

            // إضافة UUID للفاتورة/الإشعار الدائن
            xmlDoc[rootName].UUID = uuid;

            // بناء XML مرة أخرى
            const builder = new XMLBuilder({
                ignoreAttributes: false,
                format: true,
                indentBy: "  ",
                suppressEmptyNode: true
            });
            
            const signedXML = builder.build(xmlDoc);

            // نضمن أن المحسوب base64 و hash مبنيان على XML الموجب والموقع
            const finalXML = signedXML;

            return {
                success: true,
                signedXML: finalXML,
                hash: invoiceHash,
                uuid: uuid,
                base64: Buffer.from(finalXML).toString('base64')
            };

        } catch (error) {
            throw new Error('خطأ في توقيع فاتورة XML: ' + error.message);
        }
    }

    /**
     * التحقق من صحة التوقيع في فاتورة XML
     */
    async verifyInvoiceSignature(signedInvoiceXML) {
        try {
            const parser = new XMLParser({ 
                ignoreAttributes: false,
                parseAttributeValue: true 
            });
            const xmlDoc = parser.parse(signedInvoiceXML);

            // استخراج التوقيع والشهادة
            const signature = xmlDoc.Invoice.UBLExtensions?.UBLExtension?.find(ext => 
                ext.ExtensionContent?.Signature
            );

            if (!signature) {
                throw new Error('لم يتم العثور على التوقيع في الفاتورة');
            }

            const signatureValue = signature.ExtensionContent.Signature.SignatureValue;
            const certificate = signature.ExtensionContent.Signature.KeyInfo.X509Data.X509Certificate;

            // تحويل الشهادة إلى مفتاح عام
            const cert = forge.pki.certificateFromPem(
                '-----BEGIN CERTIFICATE-----\n' + 
                certificate + 
                '\n-----END CERTIFICATE-----'
            );
            const publicKeyPem = forge.pki.publicKeyToPem(cert.publicKey);

            // التحقق من التوقيع
            // إزالة التوقيع من XML للتحقق
            const xmlForVerification = signedInvoiceXML.replace(
                /<UBLExtension>.*<\/UBLExtension>/s, 
                ''
            );

            const isValid = this.verifySignature(xmlForVerification, signatureValue, publicKeyPem);

            return {
                success: true,
                isValid: isValid,
                message: isValid ? 'التوقيع صحيح' : 'التوقيع غير صحيح'
            };

        } catch (error) {
            return {
                success: false,
                message: 'خطأ في التحقق من التوقيع: ' + error.message
            };
        }
    }

    /**
     * استخراج معلومات الشهادة
     */
    getCertificateInfo() {
        try {
            if (!this.config.certificates.certificate) {
                throw new Error('الشهادة غير متوفرة');
            }

            const cert = forge.pki.certificateFromPem(
                '-----BEGIN CERTIFICATE-----\n' + 
                this.config.certificates.certificate + 
                '\n-----END CERTIFICATE-----'
            );

            return {
                subject: cert.subject.attributes.map(attr => ({
                    name: attr.name,
                    value: attr.value
                })),
                issuer: cert.issuer.attributes.map(attr => ({
                    name: attr.name,
                    value: attr.value
                })),
                validity: {
                    notBefore: cert.validity.notBefore,
                    notAfter: cert.validity.notAfter
                },
                serialNumber: cert.serialNumber,
                fingerprint: forge.md.sha256.create().update(
                    forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes()
                ).digest().toHex()
            };
        } catch (error) {
            throw new Error('خطأ في قراءة معلومات الشهادة: ' + error.message);
        }
    }
}

module.exports = ZatcaDigitalSignature;