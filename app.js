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
                    else if (title.includes('us')) usSum += val;
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

    calculate();
});
