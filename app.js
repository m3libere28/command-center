// Register PWA Service Worker for Offline capability
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(err => console.log('SW registration failed:', err));
}

document.addEventListener('DOMContentLoaded', () => {
    const gate = document.getElementById('access-gate');
    const gatePass = document.getElementById('gate-pass');
    const gateSubmit = document.getElementById('gate-submit');
    const gateStatus = document.getElementById('gate-status');
    const gatePanel = document.getElementById('gate-panel');
    const GATE_CODE = '0351';

    const unlockGate = () => {
        if (!gate) return;
        gate.classList.add('granted');
        if (gateStatus) {
            gateStatus.textContent = '● Access Granted';
            gateStatus.classList.remove('bad');
            gateStatus.classList.add('good');
        }
        setTimeout(() => {
            gate.classList.add('fadeout');
            setTimeout(() => {
                gate.classList.add('hidden');
                document.body.classList.remove('gate-locked');
            }, 680);
        }, 800);
    };

    const lockGate = () => {
        if (!gate) return;
        document.body.classList.add('gate-locked');
        gate.classList.remove('hidden');
        if (gatePass) {
            gatePass.value = '';
            gatePass.focus();
        }
        if (gateStatus) {
            gateStatus.textContent = '● Awaiting credential';
            gateStatus.classList.remove('bad', 'good');
        }
    };

    const validateGate = () => {
        if (!gate || !gatePass) return true;
        const entered = (gatePass.value || '').trim();
        if (entered === GATE_CODE) {
            sessionStorage.setItem('cc_unlocked', '1');
            unlockGate();
            return true;
        }

        if (gateStatus) {
            gateStatus.textContent = '● Access Denied';
            gateStatus.classList.remove('good');
            gateStatus.classList.add('bad');
        }
        if (gatePanel) {
            gatePanel.classList.remove('gate-bad');
            // Force reflow to restart animation
            void gatePanel.offsetWidth;
            gatePanel.classList.add('gate-bad');
        }
        if (gatePass) {
            gatePass.value = '';
            gatePass.focus();
        }
        return false;
    };

    if (gate && gatePass && gateSubmit) {
        const alreadyUnlocked = sessionStorage.getItem('cc_unlocked') === '1';
        if (alreadyUnlocked) {
            gate.classList.add('hidden');
            document.body.classList.remove('gate-locked');
        } else {
            lockGate();
        }

        gateSubmit.addEventListener('click', validateGate);
        gatePass.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') validateGate();
            if (e.key === 'Escape') lockGate();
        });

        // Clicking outside the panel focuses input
        gate.addEventListener('mousedown', (e) => {
            if (e.target === gate && gatePass) gatePass.focus();
        });
    }

    const inputs = document.querySelectorAll('.budget-input');
    const incomeVA = 4822; 
    const incomeEmily = 3500;
    const grossDividends = 1690.67;
    const totalGross = incomeVA + incomeEmily + grossDividends;

    const fmtMoney0 = (num) => '$' + (Math.round(num)).toLocaleString('en-US');

    const updateDividendCalendar = () => {
        const spyiEl = document.querySelector('.live-val[data-ticker="SPYI"]');
        const schdEl = document.querySelector('.live-val[data-ticker="SCHD"]');
        const schyEl = document.querySelector('.live-val[data-ticker="SCHY"]');
        const vmfxxEl = document.querySelector('.live-val[data-ticker="VMFXX"]');
        if (!spyiEl || !schdEl || !schyEl || !vmfxxEl) return;

        const getHolding = (el) => {
            const ticker = el.getAttribute('data-ticker');
            const shares = parseFloat(el.getAttribute('data-shares')) || 0;
            const y = parseFloat(el.getAttribute('data-yield')) || 0;

            let price = 1;
            if (ticker !== 'VMFXX') {
                const saved = localStorage.getItem(`price_${ticker}`);
                if (saved) price = parseFloat(saved) || 0;
            }

            const value = shares * price;
            const annual = value * y;
            return { ticker, shares, y, price, value, annual };
        };

        const spyi = getHolding(spyiEl);
        const schd = getHolding(schdEl);
        const schy = getHolding(schyEl);
        const vmfxx = getHolding(vmfxxEl);

        const spyiMo = spyi.annual / 12;
        const vmfxxMo = vmfxx.annual / 12;
        const schdQ = schd.annual / 4;
        const schyQ = schy.annual / 4;

        const nonQ = spyiMo + vmfxxMo;
        const qHit = nonQ + schdQ + schyQ;
        const annual = nonQ * 8 + qHit * 4;

        const setText = (selector, text) => {
            document.querySelectorAll(selector).forEach(el => {
                el.textContent = text;
            });
        };

        const spyiTxt = fmtMoney0(spyiMo);
        const vmfxxTxt = fmtMoney0(vmfxxMo);
        const schdQTxt = fmtMoney0(schdQ);
        const schyQTxt = fmtMoney0(schyQ);
        const nonQTxt = fmtMoney0(nonQ);
        const qHitTxt = fmtMoney0(qHit);
        const annualTxt = fmtMoney0(annual);

        const kpiSpyi = document.getElementById('cal-kpi-spyi');
        const kpiSchd = document.getElementById('cal-kpi-schd');
        const kpiSchy = document.getElementById('cal-kpi-schy');
        const kpiVmfxx = document.getElementById('cal-kpi-vmfxx');
        if (kpiSpyi) kpiSpyi.textContent = spyiTxt;
        if (kpiSchd) kpiSchd.textContent = fmtMoney0(schd.annual / 12);
        if (kpiSchy) kpiSchy.textContent = fmtMoney0(schy.annual / 12);
        if (kpiVmfxx) kpiVmfxx.textContent = vmfxxTxt;

        const calSpyi = document.getElementById('cal-spyi');
        const calVmfxx = document.getElementById('cal-vmfxx');
        if (calSpyi) calSpyi.textContent = spyiTxt;
        if (calVmfxx) calVmfxx.textContent = vmfxxTxt;
        setText('.cal-spyi-val', spyiTxt);
        setText('.cal-vmfxx-val', vmfxxTxt);

        const calSchdQ = document.getElementById('cal-schd-q');
        const calSchyQ = document.getElementById('cal-schy-q');
        if (calSchdQ) calSchdQ.textContent = schdQTxt;
        if (calSchyQ) calSchyQ.textContent = schyQTxt;
        setText('.cal-schd-q-val', schdQTxt);
        setText('.cal-schy-q-val', schyQTxt);

        const totalNonQ = document.getElementById('cal-total-nonq');
        const totalQ = document.getElementById('cal-total-q');
        if (totalNonQ) totalNonQ.textContent = nonQTxt;
        if (totalQ) totalQ.textContent = qHitTxt;
        setText('.cal-total-nonq', nonQTxt);
        setText('.cal-total-q', qHitTxt);

        const sumNonQ = document.getElementById('cal-summary-nonq');
        const sumQ = document.getElementById('cal-summary-q');
        const sumAnnual = document.getElementById('cal-summary-annual');
        if (sumNonQ) sumNonQ.textContent = nonQTxt;
        if (sumQ) sumQ.textContent = qHitTxt;
        if (sumAnnual) sumAnnual.textContent = annualTxt;
    };

    const calculate = () => {
        let spanSum = 0;
        let usSum = 0;
        let bizSum = 0;
        let adminSum = 0;
        let totalExpenses = 0;

        inputs.forEach(inp => {
            const val = parseFloat(inp.value) || 0;
            totalExpenses += val;
            
            const table = inp.closest('table');
            if (table) {
                const titleElement = table.previousElementSibling;
                if (titleElement && titleElement.classList.contains('section-title')) {
                    const title = titleElement.textContent.toLowerCase();
                    if (title.includes('spain')) spanSum += val;
                    else if (title.includes('us carrying')) usSum += val;
                    else if (title.includes('business')) bizSum += val;
                    else if (title.includes('admin')) adminSum += val;
                }
            }
        });

        const fmt = (num) => '$' + num.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits:2});
        
        // Update DOM by hard IDs
        const dynExp1 = document.getElementById('dyn-total-expenses');
        const dynExp2 = document.getElementById('dyn-total-expenses-2');
        if (dynExp1) dynExp1.textContent = fmt(totalExpenses);
        if (dynExp2) dynExp2.textContent = fmt(totalExpenses);

        const surpStrFmt = fmt(totalGross - totalExpenses);
        const dynSurp1 = document.getElementById('dyn-monthly-surplus');
        const dynSurp2 = document.getElementById('dyn-monthly-surplus-2');
        if (dynSurp1) dynSurp1.textContent = surpStrFmt;
        if (dynSurp2) dynSurp2.innerHTML = `<strong>${surpStrFmt}</strong>`;
        
        const spainEl = document.getElementById('dyn-spain-subtotal');
        if (spainEl) spainEl.textContent = fmt(spanSum);
        
        const usEl = document.getElementById('dyn-us-subtotal');
        if (usEl) usEl.textContent = fmt(usSum);
        
        const bizEl = document.getElementById('dyn-biz-subtotal');
        if (bizEl) bizEl.textContent = fmt(bizSum);
        
        const adminEl = document.getElementById('dyn-admin-subtotal');
        if (adminEl) adminEl.textContent = fmt(adminSum);

        // Connect reactivity to the What-If Emily Slider via global var
        window.DYNAMIC_EXPENSES = totalExpenses;
        const emilySlid = document.getElementById('emilyIncomeSlider');
        if (emilySlid) {
            emilySlid.dispatchEvent(new Event('input'));
        }
    };

    // State Hydration from Browser LocalStorage
    inputs.forEach(inp => {
        const cat = inp.getAttribute('data-cat');
        if (cat) {
            const saved = localStorage.getItem('budget_' + cat);
            if (saved !== null && !isNaN(saved) && saved !== '') {
                inp.value = saved;
            }
        }
        
        inp.addEventListener('input', () => {
            localStorage.setItem('budget_' + cat, inp.value);
            calculate();
        });
    });

    // Run first calculation iteration
    calculate();

    updateDividendCalendar();

    const updateFxBadge = async () => {
        const el = document.getElementById('fx-live');
        if (!el) return;

        const BASE = 1.09;
        const cachedRate = parseFloat(localStorage.getItem('fx_eurusd_rate') || '');
        const cachedTs = parseInt(localStorage.getItem('fx_eurusd_ts') || '', 10);
        const cacheFresh = cachedRate && cachedTs && (Date.now() - cachedTs) < (6 * 60 * 60 * 1000);

        const render = (rate, stale) => {
            const delta = rate - BASE;
            const abs = Math.abs(delta);
            let strength = 'Near base';
            let color = 'var(--text-muted)';
            if (abs >= 0.005) {
                if (delta > 0) {
                    strength = 'USD weaker';
                    color = 'var(--orange)';
                } else {
                    strength = 'USD stronger';
                    color = 'var(--green)';
                }
            }

            el.textContent = `● 1 EUR = ${rate.toFixed(4)} USD · ${strength}${stale ? ' (Saved)' : ''}`;
            el.style.color = color;
            el.style.borderColor = 'rgba(255,255,255,0.10)';
            el.style.background = 'rgba(0,0,0,0.18)';
        };

        if (cacheFresh) {
            render(cachedRate, false);
            return;
        }

        if (cachedRate) {
            render(cachedRate, true);
        }

        try {
            const res = await fetch('https://api.frankfurter.app/latest?from=EUR&to=USD', { cache: 'no-store' });
            if (!res.ok) throw new Error('fx fetch failed');
            const data = await res.json();
            const rate = data && data.rates && typeof data.rates.USD === 'number' ? data.rates.USD : null;
            if (!rate) throw new Error('fx parse failed');

            localStorage.setItem('fx_eurusd_rate', String(rate));
            localStorage.setItem('fx_eurusd_ts', String(Date.now()));
            render(rate, false);
        } catch (e) {
            if (!cachedRate) {
                el.textContent = '● Rate unavailable';
                el.style.color = 'var(--text-muted)';
            }
        }
    };

    updateFxBadge();
    setInterval(updateFxBadge, 60 * 60 * 1000);

    // ==========================================
    // PORTFOLIO LIVE API FETCHING
    // ==========================================
    const apiKeyInput = document.getElementById('finnhub-api-key');
    const refreshBtn = document.getElementById('btn-fetch-live');
    const statusBadge = document.getElementById('api-status-badge');
    
    if (apiKeyInput && refreshBtn) {
        // Load key
        const savedKey = localStorage.getItem('finnhub_key') || '';
        apiKeyInput.value = savedKey;

        apiKeyInput.addEventListener('input', () => {
            localStorage.setItem('finnhub_key', apiKeyInput.value.trim());
        });

        const fmtPort = (num) => '$' + num.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits:2});

        const fetchLivePrices = async () => {
            const key = localStorage.getItem('finnhub_key');
            if (!key) {
                statusBadge.textContent = '● Paste Key';
                statusBadge.style.color = 'var(--text-muted)';
                return;
            }

            statusBadge.textContent = '● Fetching...';
            statusBadge.style.color = 'var(--blue)';

            const tickers = ['SPYI', 'SCHD', 'SCHY'];
            let overallTotal = 50009.17; // Start with fixed VMFXX amount
            let hasError = false;

            for (const ticker of tickers) {
                const priceSpans = document.querySelectorAll(`.live-price[data-ticker="${ticker}"]`);
                const valSpans = document.querySelectorAll(`.live-val[data-ticker="${ticker}"]`);
                
                try {
                    const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=${ticker.replace('SPYI','SPYI')}&token=${key}`);
                    if (!res.ok) throw new Error('API limit or error');
                    const data = await res.json();
                    
                    // The 'c' property is current price
                    const price = data.c; 
                    if (price) {
                        localStorage.setItem(`price_${ticker}`, price);
                        priceSpans.forEach(el => el.textContent = `@ $${price.toFixed(2)}`);
                        
                        valSpans.forEach(el => {
                            const shares = parseFloat(el.getAttribute('data-shares')) || 0;
                            const total = shares * price;
                            el.textContent = fmtPort(total);
                            overallTotal += total; // only add once? Wait, this loop modifies spans but we only want to add to overall once per ticker.
                        });
                    }
                } catch (err) {
                    hasError = true;
                    // Fallback to local storage
                    const fallbackPrice = localStorage.getItem(`price_${ticker}`);
                    if (fallbackPrice) {
                        priceSpans.forEach(el => el.textContent = `@ $${parseFloat(fallbackPrice).toFixed(2)} (Offline)`);
                        valSpans.forEach(el => {
                            const shares = parseFloat(el.getAttribute('data-shares')) || 0;
                            const total = shares * parseFloat(fallbackPrice);
                            el.textContent = fmtPort(total);
                        });
                    }
                }
            }

            // Fix the loop bug: we shouldn't add to `overallTotal` inside `valSpans.forEach` because there are TWO spans per ticker (one in table, one in list).
            // Let's recalculate the overall safely
            let finalOverall = 50009.17; // VMFXX
            for (const ticker of tickers) {
                const el = document.querySelector(`.live-val[data-ticker="${ticker}"]`);
                if (el) {
                    const shares = parseFloat(el.getAttribute('data-shares')) || 0;
                    const price = localStorage.getItem(`price_${ticker}`);
                    if (price) finalOverall += (shares * parseFloat(price));
                }
            }

            // Only update KPI if we actually got prices
            if (finalOverall > 50009.17) {
                const dynTotal = document.getElementById('dyn-portfolio-total');
                if (dynTotal) dynTotal.textContent = fmtPort(finalOverall);
            }

            if (hasError) {
                statusBadge.textContent = '● Offline / Error';
                statusBadge.style.color = 'var(--red)';
            } else {
                statusBadge.textContent = '● Live Tracking';
                statusBadge.style.color = 'var(--green)';
            }

            updateDividendCalendar();
        };

        refreshBtn.addEventListener('click', fetchLivePrices);
        
        // Auto-fetch if key exists
        if (savedKey) {
            fetchLivePrices();
        } else {
            // Load fallbacks directly if no key
            const tickers = ['SPYI', 'SCHD', 'SCHY'];
            tickers.forEach(ticker => {
                const fallbackPrice = localStorage.getItem(`price_${ticker}`);
                if (fallbackPrice) {
                    document.querySelectorAll(`.live-price[data-ticker="${ticker}"]`).forEach(el => el.textContent = `@ $${parseFloat(fallbackPrice).toFixed(2)} (Saved)`);
                    document.querySelectorAll(`.live-val[data-ticker="${ticker}"]`).forEach(el => {
                        const shares = parseFloat(el.getAttribute('data-shares')) || 0;
                        el.textContent = fmtPort(shares * parseFloat(fallbackPrice));
                    });
                } else {
                    document.querySelectorAll(`.live-price[data-ticker="${ticker}"]`).forEach(el => el.textContent = `Awaiting Key API`);
                }
            });

            updateDividendCalendar();
        }
    }
});
