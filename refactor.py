import re

with open('C:/Users/m3lib/Desktop/Command-Center-App/index.html', 'r', encoding='utf-8') as f:
    html = f.read()

css = '''
    /* -- BUDGET INPUTS -- */
    .input-wrap { display:inline-flex; align-items:center; background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.1); border-radius:6px; padding:4px 8px; transition:border 0.2s; }
    .input-wrap:focus-within { border-color:var(--gold-light); }
    .input-wrap span { color:var(--text-muted); font-size:13px; margin-right:4px; font-weight:700; font-family:'Courier New',monospace; }
    .budget-input { background:transparent; border:none; color:var(--text); font-family:'Courier New',monospace; font-size:14px; font-weight:800; width:65px; outline:none; }
    .budget-input::-webkit-outer-spin-button, .budget-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
  </style>
'''
html = html.replace('  </style>', css)

# Add explicit IDs so app.js doesn't need to guess
html = html.replace('<div class="kpi-value red">$7,628</div>', '<div class="kpi-value red" id="dyn-total-expenses">$7,628</div>')
html = html.replace('<div class="value red">$7,628</div>', '<div class="value red" id="dyn-total-expenses-2">$7,628</div>')

html = html.replace('<div class="kpi-value green">$2,385</div>', '<div class="kpi-value green" id="dyn-monthly-surplus">$2,385</div>')
html = html.replace('<div class="value green"><strong>$2,385</strong></div>', '<div class="value green" id="dyn-monthly-surplus-2"><strong>$2,385</strong></div>')

html = html.replace('<tr><td><strong>Spain subtotal</strong></td><td><strong>$5,411</strong></td></tr>', '<tr><td><strong>Spain subtotal</strong></td><td><strong id="dyn-spain-subtotal">$5,411</strong></td></tr>')
html = html.replace('<tr><td><strong>US subtotal</strong></td><td><strong>$865</strong></td></tr>', '<tr><td><strong>US subtotal</strong></td><td><strong id="dyn-us-subtotal">$865</strong></td></tr>')
html = html.replace('<tr><td><strong>Biz & family subtotal</strong></td><td><strong>$617.31</strong></td></tr>', '<tr><td><strong>Biz & family subtotal</strong></td><td><strong id="dyn-biz-subtotal">$617.31</strong></td></tr>')
html = html.replace('<tr><td><strong>Admin subtotal</strong></td><td><strong>$735</strong></td></tr>', '<tr><td><strong>Admin subtotal</strong></td><td><strong id="dyn-admin-subtotal">$735</strong></td></tr>')

# Inline EXP overwrite
html = html.replace('const VA = 4822, DIVS = 1690.67, EXP = 7628.31;\n    const update = () => {', 'const VA = 4822, DIVS = 1690.67;\n    const update = () => {\n      const EXP = window.DYNAMIC_EXPENSES || 7628.31;')

# Replace table rows to inject inputs - FIXED REGEX TO HANDLE COMMAS
def replace_row(match):
    name = match.group(1).replace('<tr><td colspan="4">', '').replace('<strong>', '').replace('</strong>', '')
    val_str = match.group(2)
    sub = match.group(3) if match.group(3) else ''
    
    val_cleaned = val_str.replace(',', '')
    
    # Exclude non-input rows
    if 'subtotal' in name.lower() or 'total' in name.lower() or name == 'Holding':
        return match.group(0)
    if 'span class="ticker"' in name or 'Current Value' in name:
        return match.group(0)
    if 'SPYI' in name or 'SCHD' in name or 'SCHY' in name or 'VMFXX' in name or '1.00 (strong' in name or '1.05' in name or '1.09' in name or '1.15' in name or '1.20' in name or '1.25' in name or '1.30' in name:
        return match.group(0)
        
    cleaned_name = name.split("<")[0].strip().replace(' ', '_').lower()
    input_html = f'<td><div class=\"input-wrap\"><span>$</span><input type=\"number\" class=\"budget-input\" data-cat=\"{cleaned_name}\" value=\"{val_cleaned}\"></div>{sub}</td>'
    return f'<tr><td>{match.group(1)}</td>{input_html}</tr>'

table1 = re.sub(r'<tr><td>(.*?)</td><td>\$([0-9,\.]+)(.*?)</td></tr>', replace_row, html)
html = table1

# Add Script and PWA Manifest
html = html.replace('</head>', '  <link rel="manifest" href="manifest.json">\n</head>')
html = html.replace('</body>', '  <script src="app.js"></script>\n</body>')

with open('C:/Users/m3lib/Desktop/Command-Center-App/index.html', 'w', encoding='utf-8') as f:
    f.write(html)
