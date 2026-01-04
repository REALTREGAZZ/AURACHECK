// payment-orchestrator.js
// Sistema de orquestación de pagos para web (JavaScript)

class PaymentAccount {
    constructor({ id, provider, addressOrEmail, currentBalance = 0, monthlyLimit, isVerified = false, isAdultOwned = false }) {
        this.id = id;
        this.provider = provider; // 'paypal', 'skrill', 'crypto'
        this.addressOrEmail = addressOrEmail;
        this.currentBalance = currentBalance;
        this.monthlyLimit = monthlyLimit;
        this.isVerified = isVerified;
        this.isAdultOwned = isAdultOwned;
    }

    canAccept(amount, threshold = 0.85) {
        return this.isVerified && (this.currentBalance + amount <= this.monthlyLimit * threshold);
    }

    addBalance(amount) {
        this.currentBalance += amount;
    }
}

class PaymentTransaction {
    constructor({ id, userId, grossAmount, createdAt, allocations, status = 'pending' }) {
        this.id = id;
        this.userId = userId;
        this.grossAmount = grossAmount;
        this.createdAt = createdAt;
        this.allocations = allocations; // { accountId: amount }
        this.status = status;
    }

    toJSON() {
        return {
            id: this.id,
            userId: this.userId,
            grossAmount: this.grossAmount,
            createdAt: this.createdAt.toISOString(),
            allocations: this.allocations,
            status: this.status
        };
    }
}

class PaymentOrchestrator {
    constructor({ cryptoWallet, fiatAccounts = [], targetCryptoPct = 0.75, threshold = 0.85 }) {
        this.cryptoWallet = cryptoWallet;
        this.fiatAccounts = fiatAccounts;
        this.targetCryptoPct = targetCryptoPct;
        this.threshold = threshold;
    }

    async processPayment({ userId, amount }) {
        // 1. Calcular división
        let cryptoAlloc = amount * this.targetCryptoPct;
        let fiatAlloc = amount - cryptoAlloc;

        const allocations = {};
        let remainingFiat = fiatAlloc;

        // 2. Distribuir Fiat solo a cuentas VERIFICADAS
        for (const acc of this.fiatAccounts) {
            if (remainingFiat <= 0) break;
            if (!acc.isVerified || !acc.isAdultOwned) continue; // 🛡️ COMPLIANCE CHECK

            const space = acc.monthlyLimit - acc.currentBalance;
            if (space <= 0) continue;

            const toAllocate = Math.min(space, remainingFiat);
            acc.addBalance(toAllocate);
            allocations[acc.id] = toAllocate;
            remainingFiat -= toAllocate;

            this._log(`Allocated €${toAllocate.toFixed(2)} to ${acc.id}`);
        }

        // 3. Overflow a Crypto
        if (remainingFiat > 0) {
            cryptoAlloc += remainingFiat;
            this._log(`Fiat overflow €${remainingFiat.toFixed(2)} -> routed to crypto`);
        }

        // 4. Generar Transacción
        const tx = new PaymentTransaction({
            id: this._generateTxId(),
            userId,
            grossAmount: amount,
            createdAt: new Date(),
            allocations: {
                [this.cryptoWallet]: parseFloat(cryptoAlloc.toFixed(6)),
                ...allocations
            },
            status: 'completed'
        });

        // 5. Persistir transacción
        await this._saveTx(tx);

        return tx;
    }

    async _saveTx(tx) {
        // Guardar en localStorage como fallback
        const txHistory = JSON.parse(localStorage.getItem('payment_history') || '[]');
        txHistory.push(tx.toJSON());
        localStorage.setItem('payment_history', JSON.stringify(txHistory));

        this._log(`Persisting tx ${tx.id} -> ${JSON.stringify(tx.allocations)}`);

        // TODO: Enviar a Supabase/Firebase si está configurado
        // await supabase.from('payment_txs').insert(tx.toJSON());
    }

    _log(message) {
        console.log(`[PaymentOrchestrator] ${message}`);
    }

    _generateTxId() {
        return `TX-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    forceToCryptoMode() {
        this.targetCryptoPct = 1.0;
        this._log("EMERGENCY MODE ON: All incoming funds to crypto");
    }

    getHistory() {
        return JSON.parse(localStorage.getItem('payment_history') || '[]');
    }
}

// Export para usar en módulos
export { PaymentAccount, PaymentTransaction, PaymentOrchestrator };
