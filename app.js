// Register PWA Service Worker for Offline capability
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(err => console.log('SW registration failed:', err));
}

document.addEventListener('DOMContentLoaded', () => {
    const inputs = document.querySelectorAll('.budget-input');
    const incomeVA = 4822; 
    const incomeEmily = 3500;
    const grossDividends = 1690.67;
    const totalGross = incomeVA + incomeEmily + grossDividends;

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
        }
    }
});
