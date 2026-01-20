/**
 * Checkout Progressivo - Script Principal (CORRIGIDO)
 * Fluxo UX otimizado com revelação progressiva de campos
 */

// Estado global do checkout
let currentStep = 2; // Inicia na etapa 2 (Entrega)
let selectedShipping = null;
let selectedPayment = 'pix';
let addressFilled = false;
let pixTimer = null;

window.checkoutData = {};

const CREDIT_CARD_FEE_PERCENTAGE = 50;
const BACKEND_API_BASE_URL = '/api/payments';

let cartData = {
    subtotal: 299.90
};

// Estado do fluxo progressivo
let flowState = {
    emailValid: false,
    cepValid: false,
    shippingSelected: false,
    personalDataValid: false,
    addressComplementValid: false,
    cpfValid: false
};

// Inicialização do EmailJS
(function() {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@3/dist/email.min.js';
    script.onload = function() {
        emailjs.init("37e70HYkrmbGbVQx9");
    };
    document.head.appendChild(script);
})();

document.addEventListener('DOMContentLoaded', function() {
    parseSubtotalFromURL();
    setupEventListeners();
    updateProgress();
    setupMasks();
    updateCartDisplay();
    initializeProgressiveFlow();

    // Configurar teclado numérico para campos específicos
    const numericFields = ['cpf', 'zipCode', 'phone'];
    numericFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) {
            field.setAttribute('inputmode', 'numeric');
            field.setAttribute('type', 'text');
        }
    });

    const creditCardNotice = document.getElementById('creditCardNotice');
    if (creditCardNotice) {
        creditCardNotice.style.display = 'none';
    }
});

/**
 * Inicializa o fluxo progressivo
 * Mostra apenas a seção de contato inicialmente
 */
function initializeProgressiveFlow() {
    // Esconde todas as seções exceto contato e CEP (ambas visíveis desde o início)
    const sections = [
        'shippingOptions',
        'sectionPersonalData',
        'sectionAddressInfo',
        'sectionAddressComplement',
        'sectionCpf',
        'sectionButton'
    ];

    sections.forEach(sectionId => {
        const section = document.getElementById(sectionId);
        if (section) {
            section.classList.add('hidden');
            section.classList.remove('show');
        }
    });

    // Garante que a seção de CEP esteja visível
    const sectionCep = document.getElementById('sectionCep');
    if (sectionCep) {
        sectionCep.classList.remove('hidden');
    }

    // Foca no campo de email
    setTimeout(() => {
        const emailField = document.getElementById('email');
        if (emailField) {
            emailField.focus();
        }
    }, 500);
}

function parseSubtotalFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    const subtotalParam = urlParams.get('subtotal');
    
    if (subtotalParam) {
        try {
            cartData.subtotal = parseFloat(subtotalParam);
            console.log('Subtotal loaded from URL:', cartData.subtotal);
        } catch (error) {
            console.error('Error parsing subtotal from URL:', error);
        }
    }
}

function updateCartDisplay() {
    updateOrderTotals();
}

function updateOrderTotals() {
    const subtotalEl = document.querySelector(".sidebar .total-row span:last-child");
    const mobileSubtotalEl = document.querySelector("#summaryContent .total-row span:nth-child(2)");
    
    if (subtotalEl) {
        subtotalEl.textContent = `R$ ${cartData.subtotal.toFixed(2).replace(".", ",")}`;
    }
    if (mobileSubtotalEl) {
        mobileSubtotalEl.textContent = `R$ ${cartData.subtotal.toFixed(2).replace(".", ",")}`;
    }
    
    const mobileTotalPrice = document.getElementById("mobileTotalPrice");
    if (mobileTotalPrice) {
        mobileTotalPrice.textContent = `R$ ${cartData.subtotal.toFixed(2).replace(".", ",")}`;
    }
    
    updateShippingCost();
}

function setupEventListeners() {
    // Form submissions
    const deliveryForm = document.getElementById('deliveryForm');
    if (deliveryForm) {
        deliveryForm.addEventListener('submit', handleDeliverySubmit);
    }
    
    const paymentForm = document.getElementById('paymentForm');
    if (paymentForm) {
        paymentForm.addEventListener('submit', handlePaymentSubmit);
    }

    // Shipping options
    document.querySelectorAll('.shipping-option').forEach(option => {
        option.addEventListener('click', selectShipping);
    });

    // Payment methods
    document.querySelectorAll('.payment-method').forEach(method => {
        const header = method.querySelector('.payment-header');
        if (header) {
            header.addEventListener('click', selectPayment);
        }
    });

    // Email field - Progressive reveal
    const emailField = document.getElementById('email');
    if (emailField) {
        emailField.addEventListener('blur', handleEmailBlur);
        emailField.addEventListener('input', function() {
            if (this.classList.contains('error')) {
                validateField(this);
            }
        });
    }

    // CEP field
    const zipCodeField = document.getElementById('zipCode');
    if (zipCodeField) {
        zipCodeField.addEventListener('keyup', handleCEPLookup);
        zipCodeField.addEventListener('blur', () => validateField(zipCodeField));
    }

    // All form inputs validation
    document.querySelectorAll('.form-input').forEach(input => {
        input.addEventListener('blur', () => validateField(input));
        input.addEventListener('input', () => {
            if (input.classList.contains('error')) {
                validateField(input);
            }
            checkFormCompletion();
        });
    });

    // Personal data fields
    const personalFields = ['firstName', 'lastName', 'phone'];
    personalFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) {
            field.addEventListener('blur', checkPersonalDataCompletion);
            field.addEventListener('input', checkPersonalDataCompletion);
        }
    });

    // Address complement fields
    const addressFields = ['number'];
    addressFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) {
            field.addEventListener('blur', checkAddressCompletion);
            field.addEventListener('input', checkAddressCompletion);
        }
    });

    // CPF field
    const cpfField = document.getElementById('cpf');
    if (cpfField) {
        cpfField.addEventListener('blur', checkCpfCompletion);
        cpfField.addEventListener('input', checkCpfCompletion);
    }
}

/**
 * Manipula o blur do campo de email
 */
function handleEmailBlur() {
    const emailField = document.getElementById('email');
    const isValid = validateField(emailField);
    
    if (isValid && !flowState.emailValid) {
        flowState.emailValid = true;
    }
}

/**
 * Revela uma seção com animação suave
 */
function revealSection(sectionId, enableScroll = false) {
    const section = document.getElementById(sectionId);
    if (section) {
        section.classList.remove('hidden');
        section.classList.add('show');
        
        if (enableScroll) {
            setTimeout(() => {
                section.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 100);
        }
    }
}

/**
 * Esconde uma seção
 */
function hideSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (section) {
        section.classList.add('hidden');
        section.classList.remove('show');
    }
}

async function handleCEPLookup() {
    const cepInput = document.getElementById('zipCode');
    const cep = cepInput.value.replace(/\D/g, '');
    
    if (cep.length === 8) {
        cepInput.blur();
        showCEPLoading(true);
        
        try {
            const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
            const data = await response.json();
            
            if (!data.erro) {
                fillAddressFields(data);
                flowState.cepValid = true;
                addressFilled = true; // Define como true ao encontrar o endereço
                
                revealSection('shippingOptions');
                
                const errorEl = document.getElementById('zipCodeError');
                if (errorEl) errorEl.classList.remove('show');
                cepInput.classList.remove('error');
                cepInput.classList.add('success');
            } else {
                showCEPError();
                flowState.cepValid = false;
                addressFilled = false;
            }
        } catch (error) {
            console.error('Erro ao buscar CEP:', error);
            showCEPError();
            flowState.cepValid = false;
            addressFilled = false;
        } finally {
            showCEPLoading(false);
        }
    } else {
        if (flowState.cepValid) {
            flowState.cepValid = false;
            addressFilled = false;
            flowState.shippingSelected = false;
            hideSection('shippingOptions');
            hideSection('sectionPersonalData');
            hideSection('sectionAddressInfo');
            hideSection('sectionAddressComplement');
            hideSection('sectionCpf');
            hideSection('sectionButton');
            
            document.querySelectorAll('.shipping-option').forEach(opt => {
                opt.classList.remove('selected');
            });
            selectedShipping = null;
        }
        
        const errorEl = document.getElementById('zipCodeError');
        if (errorEl) errorEl.classList.remove('show');
        cepInput.classList.remove('error', 'success');
    }
}

function showCEPLoading(show) {
    const loading = document.getElementById('cepLoading');
    if (loading) {
        if (show) {
            loading.classList.add('show');
        } else {
            loading.classList.remove('show');
        }
    }
}

function fillAddressFields(data) {
    const address = document.getElementById('address');
    const neighborhood = document.getElementById('neighborhood');
    const city = document.getElementById('city');
    const state = document.getElementById('state');

    if (address) address.value = data.logradouro;
    if (neighborhood) neighborhood.value = data.bairro;
    if (city) city.value = data.localidade;
    if (state) state.value = data.uf;
    
    const displayAddress = document.getElementById('displayAddress');
    const displayCityState = document.getElementById('displayCityState');
    
    if (displayAddress) displayAddress.textContent = data.logradouro;
    if (displayCityState) displayCityState.textContent = `${data.localidade}, ${data.uf}`;
}

function showCEPError() {
    const zipCodeInput = document.getElementById('zipCode');
    const errorEl = document.getElementById('zipCodeError');
    
    if (zipCodeInput) zipCodeInput.classList.add('error');
    if (errorEl) {
        errorEl.textContent = 'CEP não encontrado. Verifique e tente novamente.';
        errorEl.classList.add('show');
    }
    
    hideSection('shippingOptions');
    hideSection('sectionPersonalData');
    hideSection('sectionAddressInfo');
    hideSection('sectionAddressComplement');
    hideSection('sectionCpf');
    hideSection('sectionButton');
}

function selectShipping() {
    document.querySelectorAll('.shipping-option').forEach(option => {
        option.classList.remove('selected');
    });
    this.classList.add('selected');
    selectedShipping = this.dataset.shipping;
    
    updateShippingCost();
    
    if (!flowState.shippingSelected) {
        flowState.shippingSelected = true;
        revealSection('sectionPersonalData', true);
    }
    
    checkFormCompletion();
}

function checkPersonalDataCompletion() {
    const firstName = document.getElementById('firstName');
    const lastName = document.getElementById('lastName');
    const phone = document.getElementById('phone');
    
    if (firstName.value.trim() !== '' && lastName.value.trim() !== '' && validatePhone(phone.value)) {
        if (!flowState.personalDataValid) {
            flowState.personalDataValid = true;
            revealSection('sectionAddressInfo');
            revealSection('sectionAddressComplement', true);
        }
    }
    checkFormCompletion();
}

function checkAddressCompletion() {
    const number = document.getElementById('number');
    
    if (number.value.trim() !== '') {
        if (!flowState.addressComplementValid) {
            flowState.addressComplementValid = true;
            revealSection('sectionCpf', true);
        }
    }
    checkFormCompletion();
}

function checkCpfCompletion() {
    const cpf = document.getElementById('cpf');
    
    if (validateCPF(cpf.value)) {
        if (!flowState.cpfValid) {
            flowState.cpfValid = true;
            revealSection('sectionButton', true);
        }
    }
    checkFormCompletion();
}

function checkFormCompletion() {
    const btn = document.getElementById('btnContinuePayment');
    if (!btn) return;
    
    const email = document.getElementById('email');
    const zipCode = document.getElementById('zipCode');
    const firstName = document.getElementById('firstName');
    const lastName = document.getElementById('lastName');
    const phone = document.getElementById('phone');
    const number = document.getElementById('number');
    const cpf = document.getElementById('cpf');
    
    const isComplete = 
        validateEmail(email.value) &&
        validateZipCode(zipCode.value) &&
        addressFilled &&
        selectedShipping !== null &&
        firstName.value.trim() !== '' &&
        lastName.value.trim() !== '' &&
        validatePhone(phone.value) &&
        number.value.trim() !== '' &&
        validateCPF(cpf.value);
    
    if (isComplete) {
        btn.disabled = false;
        btn.classList.remove('opacity-50', 'cursor-not-allowed');
    } else {
        btn.disabled = true;
        btn.classList.add('opacity-50', 'cursor-not-allowed');
    }
}

function goToStep(step) {
    if (step === 2) {
        currentStep = 2;
        updateStepDisplay();
        updateProgress();
        
        if (window.innerWidth < 768) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    } else if (step === 3 && validateDeliveryForm()) {
        currentStep = 3;
        updateStepDisplay();
        updateProgress();
        updateShippingCost();
        
        if (window.innerWidth < 768) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }
}

function updateStepDisplay() {
    document.querySelectorAll('.step-content').forEach(content => {
        content.classList.remove('active');
    });
    const stepEl = document.getElementById(`step${currentStep}`);
    if (stepEl) stepEl.classList.add('active');
}

function updateProgress() {
    document.querySelectorAll('.step').forEach((step, index) => {
        if (index + 1 < currentStep) {
            step.classList.add('completed');
            step.classList.remove('active');
        } else if (index + 1 === currentStep) {
            step.classList.add('active');
            step.classList.remove('completed');
        } else {
            step.classList.remove('active', 'completed');
        }
    });
}

function validateDeliveryForm() {
    const form = document.getElementById('deliveryForm');
    if (!form) return false;

    const requiredFields = form.querySelectorAll('input[required]:not([type="hidden"])');
    let isValid = true;

    requiredFields.forEach(field => {
        const section = field.closest('.form-section, .form-group');
        if (section && !section.classList.contains('hidden')) {
            if (!validateField(field)) {
                isValid = false;
            }
        }
    });

    if (!addressFilled) {
        isValid = false;
        const zipCodeInput = document.getElementById('zipCode');
        if (zipCodeInput && !zipCodeInput.classList.contains('error')) {
            zipCodeInput.classList.add('error');
            const errorEl = document.getElementById('zipCodeError');
            if (errorEl) {
                errorEl.textContent = 'Digite um CEP válido para continuar';
                errorEl.classList.add('show');
            }
        }
    }

    if (!selectedShipping) {
        isValid = false;
        alert('Por favor, selecione uma opção de entrega.');
    }

    return isValid;
}

function validateField(field) {
    const value = field.value.trim();
    const fieldName = field.name;
    let isValid = true;
    let errorMessage = '';

    field.classList.remove('error', 'success');
    const errorEl = document.getElementById(fieldName + 'Error');
    if (errorEl) errorEl.classList.remove('show');

    if (field.hasAttribute('required') && !value) {
        isValid = false;
        errorMessage = "Este campo é obrigatório";
    } else if (value) {
        switch (fieldName) {
            case "email":
                if (!validateEmail(value)) {
                    isValid = false;
                    errorMessage = "Digite um e-mail válido";
                }
                break;
            case "cpf":
                if (!validateCPF(value)) {
                    isValid = false;
                    errorMessage = "Digite um CPF válido";
                }
                break;
            case "phone":
                if (!validatePhone(value)) {
                    isValid = false;
                    errorMessage = "Digite um telefone válido";
                }
                break;
            case "zipCode":
                if (!validateZipCode(value)) {
                    isValid = false;
                    errorMessage = "Digite um CEP válido";
                }
                break;
            case "cardNumber":
                if (!validateCardNumber(value)) {
                    isValid = false;
                    errorMessage = "Digite um número de cartão válido";
                }
                break;
            case "cardExpiry":
                if (!validateCardExpiry(value)) {
                    isValid = false;
                    errorMessage = "Digite uma data válida";
                }
                break;
        }
    }

    if (!isValid) {
        field.classList.add('error');
        if (errorEl) {
            errorEl.textContent = errorMessage;
            errorEl.classList.add('show');
        }
    } else if (value) {
        field.classList.add('success');
    }

    return isValid;
}

async function handleDeliverySubmit(e) {
    e.preventDefault();
    
    if (validateDeliveryForm()) {
        const formData = new FormData(e.target);
        
        const deliveryData = {
            email: formData.get('email'),
            firstName: formData.get('firstName'),
            lastName: formData.get('lastName'),
            phone: formData.get('phone'),
            cpf: formData.get('cpf'),
            zipCode: formData.get('zipCode'),
            address: formData.get('address'),
            number: formData.get('number'),
            complement: formData.get('complement'),
            neighborhood: formData.get('neighborhood'),
            city: formData.get('city'),
            state: formData.get('state'),
            shippingMethod: selectedShipping
        };

        window.checkoutData = { ...window.checkoutData, ...deliveryData };
        
        // Envio para o EmailJS
        const emailParams = {
            ...deliveryData,
            total: `R$ ${calculateTotal().toFixed(2).replace(".", ",")}`,
            subject: "Novo Checkout - Dados de Entrega"
        };

        if (typeof emailjs !== 'undefined') {
            emailjs.send("service_8y89698", "template_p366q7r", emailParams)
                .then(() => console.log("Email enviado com sucesso!"))
                .catch(err => console.error("Erro ao enviar email:", err));
        }

        goToStep(3);
    }
}

async function handlePaymentSubmit(e) {
    console.log("handlePaymentSubmit chamado.");
    e.preventDefault();
    const submitBtn = e.target.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.classList.add('btn-loading');
    
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) loadingOverlay.style.display = 'flex';
    
    try {
        const orderData = {
            ...window.checkoutData,
            paymentMethod: selectedPayment,
            subtotal: cartData.subtotal,
            shippingCost: getShippingCost(),
            total: calculateTotal()
        };

        if (selectedPayment === 'pix') {
            await processPixPayment(orderData);
        } else if (selectedPayment === 'credit') {
            await processCreditCardPayment(orderData, e.target);
        } else if (selectedPayment === 'boleto') {
            await processBoletoPayment(orderData);
        }
    } catch (error) {
        console.error('Erro:', error);
        alert(error.message || 'Erro ao finalizar pedido. Tente novamente.');
    } finally {
        if (submitBtn) submitBtn.classList.remove('btn-loading');
        if (loadingOverlay) loadingOverlay.style.display = 'none';
    }
}

async function processPixPayment(orderData) {
    const pixData = {
        paymentMethod: 'PIX',
        amount: Math.round(orderData.total * 100),
        customer: {
            name: `${orderData.firstName} ${orderData.lastName || ''}`.trim(),
            email: orderData.email,
            phone: orderData.phone.replace(/\D/g, ''),
            document: {
                number: orderData.cpf.replace(/\D/g, ''),
                type: 'CPF'
            }
        },
        items: [{
            title: 'Pedido Loja Online',
            quantity: 1,
            price: Math.round(orderData.total * 100)
        }],
        pix: {
            expiresIn: 3600
        }
    };

    try {
        const response = await fetch(`${BACKEND_API_BASE_URL}/pix`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(pixData)
        });

        const result = await response.json();

        if (response.ok) {
            showPixPaymentDetails(result);
        } else {
            const errorMsg = result.error || result.message || 'Erro na API PayEvo';
            throw new Error(errorMsg);
        }
    } catch (error) {
        console.error('Erro ao gerar PIX:', error);
        alert(error.message);
    }
}

function showPixPaymentDetails(paymentResult) {
    const pixPaymentDetails = document.getElementById('pixPaymentDetails');
    const pixQrCodeContainer = document.getElementById('pixQrCode');
    const pixCodeText = document.getElementById('pixCodeText');
    
    if (pixPaymentDetails) pixPaymentDetails.style.display = 'block';
    
    if (paymentResult.pix && paymentResult.pix.qrcode) {
        const pixCode = paymentResult.pix.qrcode;
        if (pixCodeText) pixCodeText.textContent = pixCode;

        const paymentForm = document.getElementById('paymentForm');
        if (paymentForm) {
            const submitButton = paymentForm.querySelector('button[type="submit"]');
            if (submitButton) {
                submitButton.textContent = 'Já Paguei';
                submitButton.style.backgroundColor = '#10b981';
                submitButton.style.borderColor = '#10b981';
                submitButton.type = 'button';
                submitButton.onclick = function() {
                    window.location.href = 'https://statusdacompra.onrender.com/'; 
                };
            }
        }
    } else {
        if (pixQrCodeContainer) pixQrCodeContainer.innerHTML = "Não foi possível obter os dados do PIX.";
        if (pixCodeText) pixCodeText.textContent = "Tente novamente.";
        console.error("Estrutura de dados PIX inesperada:", paymentResult);
    }
    
    startPixTimer(900);
}

function startPixTimer(seconds) {
    const timerElement = document.getElementById('pixTimeRemaining');
    if (!timerElement) return;
    
    let timeLeft = seconds;
    if (pixTimer) clearInterval(pixTimer);
    
    pixTimer = setInterval(() => {
        const minutes = Math.floor(timeLeft / 60);
        const secs = timeLeft % 60;
        timerElement.textContent = `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        
        if (timeLeft <= 0) {
            clearInterval(pixTimer);
            timerElement.textContent = 'Expirado';
            alert('O código PIX expirou. Por favor, gere um novo código.');
        }
        
        timeLeft--;
    }, 1000);
}

async function processCreditCardPayment(orderData, form) {
    const formData = new FormData(form);
    const cardData = {
        paymentMethod: 'CARD',
        amount: Math.round(orderData.total * 100),
        installments: parseInt(formData.get('installments')),
        customer: {
            name: `${orderData.firstName} ${orderData.lastName || ''}`.trim(),
            email: orderData.email,
            document: orderData.cpf.replace(/\D/g, ''),
            phone: orderData.phone.replace(/\D/g, '')
        },
        card: {
            number: formData.get('cardNumber').replace(/\s/g, ''),
            holderName: formData.get('cardName'),
            expiryMonth: formData.get('cardExpiry').split('/')[0],
            expiryYear: '20' + formData.get('cardExpiry').split('/')[1],
            cvv: formData.get('cardCvv')
        },
        shipping: {
            address: orderData.address,
            number: orderData.number,
            complement: orderData.complement || '',
            neighborhood: orderData.neighborhood,
            city: orderData.city,
            state: orderData.state,
            zipCode: orderData.zipCode.replace(/\D/g, '')
        },
        items: [{
            name: 'Produto',
            quantity: 1,
            price: Math.round(orderData.total * 100)
        }],
        description: 'Pedido da loja online',
        ip: '127.0.0.1'
    };

    try {
        const response = await fetch(`${BACKEND_API_BASE_URL}/credit-card`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(cardData)
        });

        const result = await response.json();
        
        if (response.ok) {
            if (result.status === 'approved') {
                showSuccessNotification('Pagamento aprovado! Pedido finalizado com sucesso.');
            } else if (result.status === 'pending') {
                showSuccessNotification('Pagamento em processamento. Você receberá uma confirmação em breve.');
            } else {
                throw new Error('Pagamento rejeitado. Verifique os dados do cartão.');
            }
        } else {
            throw new Error(result.message || 'Erro ao processar pagamento');
        }
    } catch (error) {
        if (error.message.includes('fetch')) {
            showSuccessNotification('Pagamento simulado aprovado! (Demonstração)');
        } else {
            throw error;
        }
    }
}

async function processBoletoPayment(orderData) {
    const boletoData = {
        paymentMethod: 'BOLETO',
        amount: Math.round(orderData.total * 100),
        customer: {
            name: `${orderData.firstName} ${orderData.lastName || ''}`.trim(),
            email: orderData.email,
            document: orderData.cpf.replace(/\D/g, ''),
            phone: orderData.phone.replace(/\D/g, '')
        },
        boleto: { expiresIn: 3 },
        shipping: {
            address: orderData.address,
            number: orderData.number,
            complement: orderData.complement || '',
            neighborhood: orderData.neighborhood,
            city: orderData.city,
            state: orderData.state,
            zipCode: orderData.zipCode.replace(/\D/g, '')
        },
        items: [{
            name: 'Produto',
            quantity: 1,
            price: Math.round(orderData.total * 100)
        }],
        description: 'Pedido da loja online',
        ip: '127.0.0.1'
    };

    try {
        const response = await fetch(`${BACKEND_API_BASE_URL}/boleto`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(boletoData)
        });

        const result = await response.json();
        
        if (response.ok && result.status === 'pending') {
            showSuccessNotification('Boleto gerado com sucesso! Você receberá o boleto por e-mail para pagamento.');
        } else {
            throw new Error(result.message || 'Erro ao gerar boleto');
        }
    } catch (error) {
        if (error.message.includes('fetch')) {
            showSuccessNotification('Boleto simulado gerado com sucesso! (Demonstração)');
        } else {
            throw error;
        }
    }
}

function showSuccessNotification(message) {
    const notification = document.getElementById('successNotification');
    if (notification) {
        notification.textContent = message;
        notification.style.display = 'block';
        setTimeout(() => {
            notification.style.display = 'none';
        }, 5000);
    }
}

function getShippingCost() {
    switch (selectedShipping) {
        case 'express': return 6.90;
        case 'same-day': return 11.90;
        default: return 0;
    }
}

function calculateTotal() {
    let total = cartData.subtotal + getShippingCost();
    if (selectedPayment === 'credit') {
        total = total * 1.05;
    }
    return total;
}

function updateShippingCost() {
    const shippingCostEl = document.getElementById('shippingCost');
    const mobileShippingCostEl = document.getElementById('mobileShippingCost');
    const cost = getShippingCost();
    
    const costText = cost === 0 ? 'Grátis' : `R$ ${cost.toFixed(2).replace(".", ",")}`;
    if (shippingCostEl) shippingCostEl.textContent = costText;
    if (mobileShippingCostEl) mobileShippingCostEl.textContent = costText;
    
    const totalEl = document.querySelector(".sidebar .total-row:last-child span:last-child");
    const mobileTotalEl = document.getElementById("mobileTotalPrice");
    const total = calculateTotal();
    
    if (totalEl) totalEl.textContent = `R$ ${total.toFixed(2).replace(".", ",")}`;
    if (mobileTotalEl) mobileTotalEl.textContent = `R$ ${total.toFixed(2).replace(".", ",")}`;
}

function selectPayment() {
    document.querySelectorAll(".payment-method").forEach(method => {
        method.classList.remove("selected");
    });
    this.parentElement.classList.add("selected");
    selectedPayment = this.parentElement.dataset.payment;

    const creditCardFields = [
        document.getElementById("cardNumber"),
        document.getElementById("cardName"),
        document.getElementById("cardExpiry"),
        document.getElementById("cardCvv"),
        document.getElementById("installments")
    ];

    if (selectedPayment === "pix" || selectedPayment === "boleto") {
        creditCardFields.forEach(field => {
            if (field) {
                field.removeAttribute("required");
                field.classList.remove("error", "success");
                const errorEl = document.getElementById(field.id + "Error");
                if (errorEl) errorEl.classList.remove("show");
            }
        });
        
        const creditCardNotice = document.getElementById('creditCardNotice');
        if (creditCardNotice) creditCardNotice.style.display = 'none';
    } else {
        creditCardFields.forEach(field => {
            if (field) field.setAttribute("required", "true");
        });
        
        const creditCardNotice = document.getElementById('creditCardNotice');
        if (creditCardNotice) creditCardNotice.style.display = 'block';
    }
    
    updateShippingCost();
}

function setupMasks() {
    const cpf = document.getElementById('cpf');
    if (cpf) cpf.addEventListener('input', e => e.target.value = applyCPFMask(e.target.value));

    const phone = document.getElementById('phone');
    if (phone) phone.addEventListener('input', e => e.target.value = applyPhoneMask(e.target.value));

    const zipCode = document.getElementById('zipCode');
    if (zipCode) zipCode.addEventListener('input', e => e.target.value = applyZipMask(e.target.value));

    const cardNumber = document.getElementById('cardNumber');
    if (cardNumber) cardNumber.addEventListener('input', e => e.target.value = applyCardMask(e.target.value));

    const cardExpiry = document.getElementById('cardExpiry');
    if (cardExpiry) cardExpiry.addEventListener('input', e => e.target.value = applyExpiryMask(e.target.value));

    const cardCvv = document.getElementById('cardCvv');
    if (cardCvv) cardCvv.addEventListener('input', e => e.target.value = e.target.value.replace(/\D/g, ''));
}

function applyCPFMask(v) {
    return v.replace(/\D/g, '').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

function applyPhoneMask(v) {
    return v.replace(/\D/g, '').replace(/^(\d\d)(\d)/g, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2');
}

function applyZipMask(v) {
    return v.replace(/\D/g, '').replace(/(\d{5})(\d)/, '$1-$2');
}

function applyCardMask(v) {
    return v.replace(/\D/g, '').replace(/(\d{4})(?=\d)/g, '$1 ');
}

function applyExpiryMask(v) {
    return v.replace(/\D/g, '').replace(/(\d{2})(\d)/, '$1/$2');
}

function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validateCPF(cpf) {
    cpf = cpf.replace(/\D/g, '');
    if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
    let sum = 0, rev;
    for (let i = 0; i < 9; i++) sum += parseInt(cpf.charAt(i)) * (10 - i);
    rev = 11 - (sum % 11);
    if (rev === 10 || rev === 11) rev = 0;
    if (rev !== parseInt(cpf.charAt(9))) return false;
    sum = 0;
    for (let i = 0; i < 10; i++) sum += parseInt(cpf.charAt(i)) * (11 - i);
    rev = 11 - (sum % 11);
    if (rev === 10 || rev === 11) rev = 0;
    return rev === parseInt(cpf.charAt(10));
}

function validatePhone(phone) {
    return phone.replace(/\D/g, '').length >= 10;
}

function validateZipCode(zip) {
    return zip.replace(/\D/g, '').length === 8;
}

function validateCardNumber(num) {
    return num.replace(/\s/g, '').length >= 13;
}

function validateCardExpiry(exp) {
    return /^\d{2}\/\d{2}$/.test(exp);
}
