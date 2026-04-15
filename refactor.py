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

# Replace table rows
def replace_row(match):
    name = match.group(1).replace('<tr><td colspan="4">', '').replace('<strong>', '').replace('</strong>', '')
    val = match.group(2).replace(',', '')
    sub = match.group(3) if match.group(3) else ''
    
    # We shouldn't replace "Total expenses" inside a table row if it is a list instead of a table. Wait, it's <tr><td>
    if 'subtotal' in name.lower() or 'total' in name.lower() or name == 'Holding':
        # Don't replace subtotals or totals or headers with inputs
        return match.group(0)
    
    # Do not replace rows representing dividend values etc (like "SPYI", "SCHD")
    if 'span class="ticker"' in name or 'Current Value' in name:
        return match.group(0)
    
    # We want to replace actual expenses. Let's do a strict list if possible, or just ignore known bads.
    if 'SPYI' in name or 'SCHD' in name or 'SCHY' in name or 'VMFXX' in name or '1.00 (strong' in name or '1.05' in name or '1.09' in name or '1.15' in name or '1.20' in name or '1.25' in name or '1.30' in name:
        return match.group(0)
        
    cleaned_name = name.split("<")[0].strip().replace(' ', '_').lower()
    input_html = f'<td><div class=\"input-wrap\"><span>$</span><input type=\"number\" class=\"budget-input\" data-cat=\"{cleaned_name}\" value=\"{val}\"></div>{sub}</td>'
    return f'<tr><td>{match.group(1)}</td>{input_html}</tr>'

table1 = re.sub(r'<tr><td>(.*?)</td><td>\$([0-9]+(?:\.[0-9]{2})?)(.*?)</td></tr>', replace_row, html)
html = table1

# Add Script and PWA Manifest
html = html.replace('</head>', '  <link rel="manifest" href="manifest.json">\n</head>')
html = html.replace('</body>', '  <script src="app.js"></script>\n</body>')

with open('C:/Users/m3lib/Desktop/Command-Center-App/index.html', 'w', encoding='utf-8') as f:
    f.write(html)
