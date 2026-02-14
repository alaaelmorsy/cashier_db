const moment = require('moment-timezone');
const { XMLBuilder } = require('xml2js');

class ZatcaInvoiceGenerator {
    constructor(config) {
        this.config = config;
    }

    /**
     * إنشاء فاتورة XML متوافقة مع معايير ZATCA
     */
    async generateInvoiceXML(invoiceData) {
        try {
            // التحقق من صحة البيانات المطلوبة
            this.validateInvoiceData(invoiceData);

            // بناء هيكل الفاتورة
            const invoiceXML = {
                Invoice: {
                    '@_xmlns': "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2",
                    '@_xmlns:cac': "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2",
                    '@_xmlns:cbc': "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2",
                    
                    // معلومات أساسية
                    'cbc:CustomizationID': "urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0",
                    'cbc:ProfileID': "reporting:1.0",
                    'cbc:ID': invoiceData.invoiceNumber,
                    'cbc:IssueDate': moment(invoiceData.issueDate).format('YYYY-MM-DD'),
                    'cbc:IssueTime': moment(invoiceData.issueDate).format('HH:mm:ss'),
                    'cbc:InvoiceTypeCode': {
                        '@_listAgencyID': "6",
                        '@_listID': "UN/ECE 1001 Subset",
                        '#text': invoiceData.documentType || "388"
                    },
                    'cbc:Note': invoiceData.note || "",
                    'cbc:TaxPointDate': moment(invoiceData.issueDate).format('YYYY-MM-DD'),
                    'cbc:DocumentCurrencyCode': invoiceData.currency || "SAR",
                    'cbc:TaxCurrencyCode': invoiceData.currency || "SAR",
                    
                    // مرجع الطلب (إذا وجد)
                    ...(invoiceData.orderReference && {
                        'cac:OrderReference': {
                            'cbc:ID': invoiceData.orderReference
                        }
                    }),

                    // معلومات البائع
                    'cac:AccountingSupplierParty': this.buildSupplierParty(invoiceData.seller),
                    
                    // معلومات المشتري
                    'cac:AccountingCustomerParty': this.buildCustomerParty(invoiceData.buyer),
                    
                    // معلومات التسليم (إذا وجدت)
                    ...(invoiceData.delivery && {
                        'cac:Delivery': this.buildDelivery(invoiceData.delivery)
                    }),

                    // شروط الدفع
                    'cac:PaymentMeans': this.buildPaymentMeans(invoiceData.payment),
                    
                    // سنبني البنود أولاً لحساب مجاميع دقيقة من نفس المنطق المستخدم في الخطوط
                    ...(function(ctx){
                        const lines = [];
                        let sumLineNet = 0;
                        let sumVat = 0;
                        (invoiceData.items||[]).forEach((item, index) => {
                            const line = ctx.buildInvoiceLine(item, index + 1);
                            const ln = Number(line?.['cbc:LineExtensionAmount']?.['#text'] || 0);
                            const lvat = Number(line?.['cac:TaxTotal']?.['cbc:TaxAmount']?.['#text'] || 0);
                            sumLineNet += ln;
                            sumVat += lvat;
                            lines.push(line);
                        });
                        sumLineNet = Number(sumLineNet.toFixed(2));
                        sumVat = Number(sumVat.toFixed(2));
                        const docDiscount = Math.abs(Number(invoiceData.totals?.discount || 0));
                        const docCharges = Math.abs(Number(invoiceData.totals?.charges || 0));
                        const totalsRecalc = {
                            subtotal: sumLineNet,
                            discount: docDiscount,
                            charges: docCharges,
                            vatTotal: sumVat,
                            totalWithVAT: Number((sumLineNet - docDiscount + docCharges + sumVat).toFixed(2))
                        };
                        return {
                            'cac:TaxTotal': ctx.buildTaxTotal(totalsRecalc, invoiceData.taxBreakdown),
                            'cac:LegalMonetaryTotal': ctx.buildLegalMonetaryTotal(totalsRecalc),
                            'cac:InvoiceLine': lines
                        };
                    })(this)
                }
            };

            // بناء XML
            const builder = new XMLBuilder({
                ignoreAttributes: false,
                format: true,
                indentBy: "  ",
                suppressEmptyNode: true
            });

            const xmlString = builder.build(invoiceXML);
            
            // إضافة XML declaration
            const fullXML = '<?xml version="1.0" encoding="UTF-8"?>\n' + xmlString;

            return fullXML;

        } catch (error) {
            throw new Error('خطأ في إنشاء فاتورة XML: ' + error.message);
        }
    }

    /**
     * التحقق من صحة بيانات الفاتورة
     */
    validateInvoiceData(data) {
        const required = ['invoiceNumber', 'issueDate', 'seller', 'buyer', 'items', 'totals'];
        
        for (const field of required) {
            if (!data[field]) {
                throw new Error(`الحقل المطلوب ${field} غير موجود`);
            }
        }

        // التحقق من بيانات البائع
        if (!data.seller.name || !data.seller.vatNumber) {
            throw new Error('بيانات البائع غير مكتملة (الاسم ورقم الضريبة مطلوبان)');
        }

        // التحقق من بيانات المشتري
        if (!data.buyer.name) {
            throw new Error('اسم المشتري مطلوب');
        }

        // التحقق من وجود بنود
        if (!Array.isArray(data.items) || data.items.length === 0) {
            throw new Error('يجب وجود بند واحد على الأقل في الفاتورة');
        }
    }

    /**
     * بناء معلومات البائع
     */
    buildSupplierParty(seller) {
        // Normalize CRN to digits only and validate length
        const onlyDigits = (s) => String(s || '').replace(/\D+/g, '');
        const crn = onlyDigits(seller.commercialRegistration);
        const hasValidCRN = crn.length === 10;

        const party = {
            'cac:Party': {
                // Use BT-30 (PartyLegalEntity/CompanyID) for CRN to avoid BR-KSA-F-08 on BT-29
                'cac:PartyName': {
                    'cbc:Name': seller.name
                },
                'cac:PostalAddress': {
                    'cbc:StreetName': seller.address?.street || "",
                    'cbc:BuildingNumber': seller.address?.building || "",
                    'cbc:CityName': seller.address?.city || "الرياض",
                    'cbc:PostalZone': seller.address?.postalCode || "",
                    'cbc:CountrySubentity': seller.address?.district || "",
                    'cac:Country': {
                        'cbc:IdentificationCode': seller.address?.country || "SA"
                    }
                },
                'cac:PartyTaxScheme': {
                    'cbc:CompanyID': seller.vatNumber,
                    'cac:TaxScheme': {
                        'cbc:ID': "VAT"
                    }
                },
                'cac:PartyLegalEntity': {
                    'cbc:RegistrationName': seller.name,
                    // Seller legal registration identifier (BT-30)
                    ...(hasValidCRN ? { 'cbc:CompanyID': { '@_schemeID': 'CRN', '#text': crn } } : {})
                }
            }
        };
        return party;
    }

    /**
     * بناء معلومات المشتري
     */
    buildCustomerParty(buyer) {
        const party = {
            'cac:Party': {
                'cac:PartyName': {
                    'cbc:Name': buyer.name
                },
                'cac:PostalAddress': {
                    'cbc:StreetName': buyer.address?.street || "",
                    'cbc:CityName': buyer.address?.city || "الرياض",
                    'cbc:CountrySubentity': buyer.address?.district || "",
                    'cac:Country': {
                        'cbc:IdentificationCode': buyer.address?.country || "SA"
                    }
                }
            }
        };

        // إضافة رقم الضريبة إذا كان متوفراً
        if (buyer.vatNumber) {
            party['cac:Party']['cac:PartyTaxScheme'] = {
                'cbc:CompanyID': buyer.vatNumber,
                'cac:TaxScheme': {
                    'cbc:ID': "VAT"
                }
            };
        }

        return party;
    }

    /**
     * بناء معلومات التسليم
     */
    buildDelivery(delivery) {
        return {
            'cbc:ActualDeliveryDate': moment(delivery.date).format('YYYY-MM-DD'),
            'cac:DeliveryLocation': {
                'cac:Address': {
                    'cbc:StreetName': delivery.address?.street || "",
                    'cbc:CityName': delivery.address?.city || "الرياض",
                    'cac:Country': {
                        'cbc:IdentificationCode': "SA"
                    }
                }
            }
        };
    }

    /**
     * بناء معلومات الدفع
     */
    buildPaymentMeans(payment) {
        const paymentMeansCode = this.getPaymentMeansCode(payment.method);
        
        return {
            'cbc:PaymentMeansCode': {
                '@_listAgencyID': "6",
                '@_listID': "UN/ECE 4461",
                '#text': paymentMeansCode
            },
            'cbc:InstructionNote': payment.instruction || ""
        };
    }

    /**
     * الحصول على رمز طريقة الدفع
     */
    getPaymentMeansCode(method) {
        const codes = {
            'cash': '10',      // نقدي
            'credit': '48',    // بطاقة ائتمان
            'debit': '49',     // بطاقة خصم
            'transfer': '42',  // تحويل بنكي
            'check': '20'      // شيك
        };
        return codes[method] || '10';
    }

    /**
     * بناء المجاميع الضريبية
     */
    buildTaxTotal(totals, taxBreakdown) {
        const taxSubtotals = [];
        const subtotal = Math.abs(Number(totals?.subtotal || 0));
        const discount = Math.abs(Number(totals?.discount || 0));
        const charges = Math.abs(Number(totals?.charges || 0));
        // BT-116 taxable base = BT-131 (sum of line net) - BT-92 (allowances) + BT-99 (charges)
        const taxableBaseRaw = Number((subtotal - discount + charges).toFixed(2));
        const taxableBase = Math.max(0, taxableBaseRaw);
        const vatTotal = Math.abs(Number(totals?.vatTotal || 0));

        if (taxBreakdown && Array.isArray(taxBreakdown) && taxBreakdown.length) {
            for (const tax of taxBreakdown) {
                const tTaxable = Math.abs(Number(tax.taxableAmount || 0));
                const tAmount = Math.abs(Number(tax.taxAmount || 0));
                const tRate = Number(tax.rate || 15);
                taxSubtotals.push({
                    'cbc:TaxableAmount': {
                        '@_currencyID': 'SAR',
                        '#text': tTaxable.toFixed(2)
                    },
                    'cbc:TaxAmount': {
                        '@_currencyID': 'SAR',
                        '#text': tAmount.toFixed(2)
                    },
                    'cac:TaxCategory': {
                        'cbc:ID': {
                            '@_schemeAgencyID': '6',
                            '@_schemeID': 'UN/ECE 5305',
                            '#text': tax.categoryCode || 'S'
                        },
                        'cbc:Percent': tRate.toFixed(2),
                        'cac:TaxScheme': {
                            'cbc:ID': {
                                '@_schemeAgencyID': '6',
                                '@_schemeID': 'UN/ECE 5153',
                                '#text': 'VAT'
                            }
                        }
                    }
                });
            }
        } else {
            // Default: standard rate on taxable base (after allowances and plus charges)
            taxSubtotals.push({
                'cbc:TaxableAmount': {
                    '@_currencyID': 'SAR',
                    '#text': taxableBase.toFixed(2)
                },
                'cbc:TaxAmount': {
                    '@_currencyID': 'SAR',
                    '#text': vatTotal.toFixed(2)
                },
                'cac:TaxCategory': {
                    'cbc:ID': 'S',
                    'cbc:Percent': '15.00',
                    'cac:TaxScheme': {
                        'cbc:ID': 'VAT'
                    }
                }
            });
        }

        return {
            'cbc:TaxAmount': {
                '@_currencyID': 'SAR',
                '#text': vatTotal.toFixed(2)
            },
            'cac:TaxSubtotal': taxSubtotals
        };
    }

    /**
     * بناء المجاميع القانونية
     */
    buildLegalMonetaryTotal(totals) {
        const subtotal = Math.abs(Number(totals?.subtotal || 0));
        const discount = Math.abs(Number(totals?.discount || 0));
        const charges = Math.abs(Number(totals?.charges || 0));
        const vatTotal = Math.abs(Number(totals?.vatTotal || 0));

        // EN16931: BT-109 (TaxExclusiveAmount) = Sum(BT-131) - BT-92 (doc allowances) + BT-99 (doc charges)
        const taxExclusive = Number((subtotal - discount + charges).toFixed(2));
        const taxInclusive = Number((taxExclusive + vatTotal).toFixed(2));

        const legal = {
            'cbc:LineExtensionAmount': {
                '@_currencyID': "SAR",
                '#text': subtotal.toFixed(2)
            },
            'cbc:TaxExclusiveAmount': {
                '@_currencyID': "SAR",
                '#text': taxExclusive.toFixed(2)
            },
            'cbc:TaxInclusiveAmount': {
                '@_currencyID': "SAR",
                '#text': taxInclusive.toFixed(2)
            },
            'cbc:PayableAmount': {
                '@_currencyID': "SAR",
                '#text': taxInclusive.toFixed(2)
            }
        };
        if (discount > 0) {
            legal['cbc:AllowanceTotalAmount'] = {
                '@_currencyID': "SAR",
                '#text': discount.toFixed(2)
            };
        }
        if (charges > 0) {
            legal['cbc:ChargeTotalAmount'] = {
                '@_currencyID': "SAR",
                '#text': charges.toFixed(2)
            };
        }
        return legal;
    }

    /**
     * بناء بند الفاتورة
     */
    buildInvoiceLine(item, lineNumber) {
        // Helper rounding to keep EN16931-11 satisfied
        const round2 = (n) => Number((Math.round((Number(n)||0) * 100) / 100).toFixed(2));
        const toFixed4 = (n) => (Number(n)||0).toFixed(4);

        // Quantize quantity to 4 decimals and use the same value in both calculation and XML (BT-129)
        const qtyRaw = Math.abs(Number(item.quantity || 0));
        const qty4Str = toFixed4(qtyRaw);
        const qty4Num = Number(qty4Str);
        const vatRate = Math.abs(Number(item.vatRate ?? 15));

        // Determine net unit price (exclude VAT). If only gross provided, derive net from VAT.
        const hasNet = item.unitPriceNet != null;
        const hasGross = item.unitPrice != null && item.unitPriceIsGross === true;
        const unitPriceNet = hasNet
          ? Math.abs(Number(item.unitPriceNet))
          : (hasGross
              ? Math.abs(Number(item.unitPrice)) / (1 + (vatRate/100))
              : Math.abs(Number(item.unitPrice || 0)));

        // Support price base quantity (BT-149). Default is 1 if not provided.
        const baseQtyRaw = Number(item.baseQuantity ?? item.priceBaseQuantity ?? 1);
        const baseQtySafe = baseQtyRaw > 0 ? baseQtyRaw : 1;
        const baseQty4Str = toFixed4(baseQtySafe);
        const baseQty4Num = Number(baseQty4Str);

        // PriceAmount (BT-146) is the price per BaseQuantity (BT-149)
        const priceAmountPerBase = unitPriceNet * baseQty4Num;
        const priceAmount4Str = toFixed4(priceAmountPerBase);
        const priceAmount4Num = Number(priceAmount4Str);

        // Line allowances/charges: quantize to 2 decimals so math equals XML representation
        const lineDiscountRaw = Math.abs(Number(item.lineDiscount || 0));
        const lineChargeRaw  = Math.abs(Number(item.lineCharge  || 0));
        const lineDiscount = Number(lineDiscountRaw.toFixed(2));
        const lineCharge = Number(lineChargeRaw.toFixed(2));
        const allowanceCharges = [];
        if (lineDiscount > 0) {
            allowanceCharges.push({ 'cbc:ChargeIndicator': false, 'cbc:Amount': { '@_currencyID': 'SAR', '#text': lineDiscount.toFixed(2) } });
        }
        if (lineCharge > 0) {
            allowanceCharges.push({ 'cbc:ChargeIndicator': true,  'cbc:Amount': { '@_currencyID': 'SAR', '#text': lineCharge.toFixed(2) } });
        }

        // Compute line net (BT-131) EXACTLY from the XML-exposed values to satisfy EN16931-11:
        // BT-131 = Qty(BT-129) * (PriceAmount(BT-146) / BaseQuantity(BT-149)) + Sum(Charges) - Sum(Allowances)
        const lineBase = qty4Num * (priceAmount4Num / baseQty4Num);
        const lineNet = round2(lineBase - lineDiscount + lineCharge);

        // VAT per line from line net
        const lineVAT = round2((lineNet * vatRate) / 100);

        return {
            'cbc:ID': lineNumber.toString(),
            'cbc:InvoicedQuantity': {
                '@_unitCode': item.unitCode || "PCE",
                '#text': qty4Str
            },
            'cbc:LineExtensionAmount': {
                '@_currencyID': "SAR",
                '#text': lineNet.toFixed(2)
            },
            'cac:Item': {
                'cbc:Description': item.description || "",
                'cbc:Name': item.name,
                'cac:ClassifiedTaxCategory': {
                    'cbc:ID': item.taxCategory || "S",
                    'cbc:Percent': vatRate.toFixed(2),
                    'cac:TaxScheme': {
                        'cbc:ID': "VAT"
                    }
                }
            },
            // Optional: include line-level allowances/charges if present to be explicit
            ...(allowanceCharges.length ? { 'cac:AllowanceCharge': allowanceCharges } : {}),

            // Line-level tax total based on line net
            'cac:TaxTotal': {
                'cbc:TaxAmount': {
                    '@_currencyID': "SAR",
                    '#text': lineVAT.toFixed(2)
                },
                'cac:TaxSubtotal': {
                    'cbc:TaxableAmount': {
                        '@_currencyID': "SAR",
                        '#text': lineNet.toFixed(2)
                    },
                    'cbc:TaxAmount': {
                        '@_currencyID': "SAR",
                        '#text': lineVAT.toFixed(2)
                    },
                    'cac:TaxCategory': {
                        'cbc:ID': item.taxCategory || "S",
                        'cbc:Percent': vatRate.toFixed(2),
                        'cac:TaxScheme': {
                            'cbc:ID': "VAT"
                        }
                    }
                }
            },
            'cac:Price': {
                'cbc:PriceAmount': {
                    '@_currencyID': "SAR",
                    '#text': priceAmount4Str
                },
                'cbc:BaseQuantity': {
                    '@_unitCode': item.unitCode || "PCE",
                    '#text': baseQty4Str
                }
            }
        };
    }

    /**
     * إنشاء بند مذكرة دائنة (مطابق لمنطق الفاتورة لضمان EN16931-11)
     */
    buildCreditNoteLine(item, lineNumber) {
        // نفس منطق التقريب والحساب المستخدم في buildInvoiceLine
        const round2 = (n) => Number((Math.round((Number(n)||0) * 100) / 100).toFixed(2));
        const toFixed4 = (n) => (Number(n)||0).toFixed(4);

        const qtyRaw = Math.abs(Number(item.quantity || 0));
        const qty4Str = toFixed4(qtyRaw);
        const qty4Num = Number(qty4Str);
        const vatRate = Math.abs(Number(item.vatRate ?? 15));

        // تحديد سعر الوحدة الصافي (بدون ضريبة)
        const hasNet = item.unitPriceNet != null;
        const hasGross = item.unitPrice != null && item.unitPriceIsGross === true;
        const unitPriceNet = hasNet
          ? Math.abs(Number(item.unitPriceNet))
          : (hasGross
              ? Math.abs(Number(item.unitPrice)) / (1 + (vatRate/100))
              : Math.abs(Number(item.unitPrice || 0)));

        // دعم BaseQuantity (BT-149)
        const baseQtyRaw = Number(item.baseQuantity ?? item.priceBaseQuantity ?? 1);
        const baseQtySafe = baseQtyRaw > 0 ? baseQtyRaw : 1;
        const baseQty4Str = toFixed4(baseQtySafe);
        const baseQty4Num = Number(baseQty4Str);

        // PriceAmount (BT-146) هو السعر لكل BaseQuantity
        const priceAmountPerBase = unitPriceNet * baseQty4Num;
        const priceAmount4Str = toFixed4(priceAmountPerBase);
        const priceAmount4Num = Number(priceAmount4Str);

        const lineDiscountRaw = Math.abs(Number(item.lineDiscount || 0));
        const lineChargeRaw  = Math.abs(Number(item.lineCharge  || 0));
        const lineDiscount = Number(lineDiscountRaw.toFixed(2));
        const lineCharge = Number(lineChargeRaw.toFixed(2));
        const allowanceCharges = [];
        if (lineDiscount > 0) {
            allowanceCharges.push({ 'cbc:ChargeIndicator': false, 'cbc:Amount': { '@_currencyID': 'SAR', '#text': lineDiscount.toFixed(2) } });
        }
        if (lineCharge > 0) {
            allowanceCharges.push({ 'cbc:ChargeIndicator': true,  'cbc:Amount': { '@_currencyID': 'SAR', '#text': lineCharge.toFixed(2) } });
        }

        // BT-131 = Qty * (PriceAmount/BaseQuantity) + Charges - Allowances
        const lineBase = qty4Num * (priceAmount4Num / baseQty4Num);
        const lineNet = round2(lineBase - lineDiscount + lineCharge);

        const lineVAT = round2((lineNet * vatRate) / 100);

        return {
            'cbc:ID': lineNumber.toString(),
            'cbc:CreditedQuantity': {
                '@_unitCode': item.unitCode || "PCE",
                '#text': qty4Str
            },
            'cbc:LineExtensionAmount': {
                '@_currencyID': "SAR",
                '#text': lineNet.toFixed(2)
            },
            'cac:Item': {
                'cbc:Description': item.description || "",
                'cbc:Name': item.name,
                'cac:ClassifiedTaxCategory': {
                    'cbc:ID': item.taxCategory || "S",
                    'cbc:Percent': vatRate.toFixed(2),
                    'cac:TaxScheme': {
                        'cbc:ID': "VAT"
                    }
                }
            },
            ...(allowanceCharges.length ? { 'cac:AllowanceCharge': allowanceCharges } : {}),
            'cac:TaxTotal': {
                'cbc:TaxAmount': {
                    '@_currencyID': "SAR",
                    '#text': lineVAT.toFixed(2)
                },
                'cac:TaxSubtotal': {
                    'cbc:TaxableAmount': {
                        '@_currencyID': "SAR",
                        '#text': lineNet.toFixed(2)
                    },
                    'cbc:TaxAmount': {
                        '@_currencyID': "SAR",
                        '#text': lineVAT.toFixed(2)
                    },
                    'cac:TaxCategory': {
                        'cbc:ID': item.taxCategory || "S",
                        'cbc:Percent': vatRate.toFixed(2),
                        'cac:TaxScheme': {
                            'cbc:ID': "VAT"
                        }
                    }
                }
            },
            'cac:Price': {
                'cbc:PriceAmount': {
                    '@_currencyID': "SAR",
                    '#text': priceAmount4Str
                },
                'cbc:BaseQuantity': {
                    '@_unitCode': item.unitCode || "PCE",
                    '#text': baseQty4Str
                }
            }
        };
    }

    /**
     * إنشاء فاتورة مبسطة (B2C)
     */
    async generateSimplifiedInvoiceXML(invoiceData) {
        // نسخ البيانات وتعديل نوع المستند
        const simplifiedData = { ...invoiceData };
        simplifiedData.documentType = "388"; // كود الفاتورة المبسطة
        
        // إزالة بعض المتطلبات غير الضرورية للفاتورة المبسطة
        if (simplifiedData.buyer && !simplifiedData.buyer.vatNumber) {
            simplifiedData.buyer.vatNumber = undefined;
        }

        return this.generateInvoiceXML(simplifiedData);
    }

    /**
     * إنشاء مذكرة دائنة
     */
    async generateCreditNoteXML(creditData) {
        // Validate input
        this.validateInvoiceData(creditData);
        const data = { ...creditData };
        const currency = data.currency || 'SAR';

        // Positive totals
        const subtotal = Math.abs(Number(data.totals?.subtotal || 0));
        const discount = Math.abs(Number(data.totals?.discount || 0));
        const vatTotal = Math.abs(Number(data.totals?.vatTotal || 0));
        const totalWithVAT = Math.abs(Number(data.totals?.totalWithVAT || 0));

        // Build CreditNote structure
        const creditNote = {
            CreditNote: {
                '@_xmlns': 'urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2',
                '@_xmlns:cac': 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2',
                '@_xmlns:cbc': 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2',
                'cbc:CustomizationID': 'urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0',
                'cbc:ProfileID': 'reporting:1.0',
                'cbc:ID': data.invoiceNumber,
                'cbc:IssueDate': moment(data.issueDate).format('YYYY-MM-DD'),
                'cbc:IssueTime': moment(data.issueDate).format('HH:mm:ss'),
                'cbc:CreditNoteTypeCode': {
                    '@_listAgencyID': '6',
                    '@_listID': 'UN/ECE 1001 Subset',
                    '#text': '381'
                },
                'cbc:Note': data.note || '',
                'cbc:TaxPointDate': moment(data.issueDate).format('YYYY-MM-DD'),
                'cbc:DocumentCurrencyCode': currency,
                'cbc:TaxCurrencyCode': currency,

                // Supplier and customer
                'cac:AccountingSupplierParty': this.buildSupplierParty(data.seller),
                'cac:AccountingCustomerParty': this.buildCustomerParty(data.buyer),

                // Billing reference to the original invoice (if provided)
                ...(data.originalInvoiceReference ? {
                    'cac:BillingReference': {
                        'cac:InvoiceDocumentReference': {
                            'cbc:ID': data.originalInvoiceReference,
                            ...(data.originalInvoiceDate ? { 'cbc:IssueDate': moment(data.originalInvoiceDate).format('YYYY-MM-DD') } : {})
                        }
                    }
                } : {}),

                // Payment means (optional but kept for parity)
                'cac:PaymentMeans': this.buildPaymentMeans(data.payment || { method: 'cash' }),

                // Tax total (positive)
                'cac:TaxTotal': this.buildTaxTotal({ subtotal, discount, vatTotal }, data.taxBreakdown),

                // Legal monetary totals (positive)
                'cac:LegalMonetaryTotal': (() => {
                    const legal = {
                        'cbc:LineExtensionAmount': { '@_currencyID': currency, '#text': subtotal.toFixed(2) },
                        'cbc:TaxExclusiveAmount': { '@_currencyID': currency, '#text': subtotal.toFixed(2) },
                        'cbc:TaxInclusiveAmount': { '@_currencyID': currency, '#text': totalWithVAT.toFixed(2) },
                        'cbc:PayableAmount': { '@_currencyID': currency, '#text': totalWithVAT.toFixed(2) }
                    };
                    if (discount > 0) {
                        legal['cbc:AllowanceTotalAmount'] = { '@_currencyID': currency, '#text': discount.toFixed(2) };
                    }
                    return legal;
                })(),

                // CreditNote lines (positive quantities and amounts)
                'cac:CreditNoteLine': data.items.map((item, index) => this.buildCreditNoteLine(item, index + 1))
            }
        };

        const builder = new XMLBuilder({ ignoreAttributes: false, format: true, indentBy: '  ', suppressEmptyNode: true });
        const xmlString = builder.build(creditNote);
        const fullXML = '<?xml version="1.0" encoding="UTF-8"?>\n' + xmlString;
        return fullXML;
    }
}

module.exports = ZatcaInvoiceGenerator;