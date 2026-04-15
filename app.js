// Register PWA Service Worker for Offline capability
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(err => console.log('SW registration failed:', err));
}

document.addEventListener('DOMContentLoaded', () => {
    // Collect all inputs we injected
    const inputs = document.querySelectorAll('.budget-input');
    const incomeVA = 4822; // Core assumptions
    const incomeEmily = 3500;
    const grossDividends = 1690.67;
    const totalGross = incomeVA + incomeEmily + grossDividends;
    
    // Tag the display elements dynamically so we can update them without hardcoding IDs
    const identifyAndTag = () => {
       const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
       let node;
       while ((node = walker.nextNode())) {
           // We look for our baseline amounts and tag their parents
           const val = node.nodeValue.trim();
           if (val === '$7,628') node.parentElement.classList.add('dyn-total-expenses');
           if (val === '$2,385') node.parentElement.classList.add('dyn-monthly-surplus');
           if (val === '$5,411') node.parentElement.classList.add('dyn-spain-subtotal');
           if (val === '$865') node.parentElement.classList.add('dyn-us-subtotal');
           if (val === '$617.31') node.parentElement.classList.add('dyn-biz-subtotal');
           if (val === '$735') node.parentElement.classList.add('dyn-admin-subtotal');
       }
    };
    identifyAndTag();

    const calculate = () => {
        let spanSum = 0;
        let usSum = 0;
        let bizSum = 0;
        let adminSum = 0;
        let totalExpenses = 0;

        // Traverse each input box to recalculate
        inputs.forEach(inp => {
            const val = parseFloat(inp.value) || 0;
            totalExpenses += val;
            
            // Ascertain which subtotal bucket this input belongs to
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

        // Formatter helper
        const fmt = (num) => '$' + num.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits:2});
        
        // Update DOM visuals
        document.querySelectorAll('.dyn-total-expenses').forEach(el => el.textContent = fmt(totalExpenses));
        document.querySelectorAll('.dyn-monthly-surplus').forEach(el => el.textContent = fmt(totalGross - totalExpenses));
        
        document.querySelectorAll('.dyn-spain-subtotal').forEach(el => el.textContent = fmt(spanSum));
        document.querySelectorAll('.dyn-us-subtotal').forEach(el => el.textContent = fmt(usSum));
        document.querySelectorAll('.dyn-biz-subtotal').forEach(el => el.textContent = fmt(bizSum));
        document.querySelectorAll('.dyn-admin-subtotal').forEach(el => el.textContent = fmt(adminSum));

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
            // Ignore NaN loads or blanks
            if (saved !== null && !isNaN(saved) && saved !== '') {
                inp.value = saved;
            }
        }
        
        // On keystroke/arrows, instantly persist and recalculate
        inp.addEventListener('input', () => {
            localStorage.setItem('budget_' + cat, inp.value);
            calculate();
        });
    });

    // Run first calculation iteration
    calculate();
});
