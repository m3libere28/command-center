// Register PWA Service Worker for Offline capability
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(err => console.log('SW registration failed:', err));
}

document.addEventListener('DOMContentLoaded', () => {
    const gate = document.getElementById('access-gate');
    const gateEmail = document.getElementById('gate-email');
    const gatePass = document.getElementById('gate-pass');
    const gateSubmit = document.getElementById('gate-submit');
    const gateStatus = document.getElementById('gate-status');
    const gatePanel = document.getElementById('gate-panel');

    let sbClient = null;
    const getSupabaseClient = () => {
        if (sbClient) return sbClient;
        if (!window.supabase || !window.supabase.createClient) return null;
        const SUPABASE_URL = 'https://lfhifmauilsstkxczjeb.supabase.co';
        const SUPABASE_ANON_KEY = 'sb_publishable_fsOsWpTTea94kT8rpkjNRw_XzYdn7yD';
        sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        return sbClient;
    };

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
        if (gateEmail) gateEmail.focus();
        if (gateStatus) {
            gateStatus.textContent = '● Awaiting credential';
            gateStatus.classList.remove('bad', 'good');
        }
    };

    const shakeGateBad = () => {
        if (!gatePanel) return;
        gatePanel.classList.remove('gate-bad');
        void gatePanel.offsetWidth;
        gatePanel.classList.add('gate-bad');
    };

    const pullSettingsIntoLocal = async (sb) => {
        const { data, error } = await sb.from('user_settings').select('key,value,updated_at');
        if (error) throw error;
        if (!Array.isArray(data)) return;
        data.forEach(row => {
            if (!row || typeof row.key !== 'string') return;
            localStorage.setItem(row.key, row.value ?? '');
        });
    };

    const applyLocalBudgetToInputs = () => {
        const active = document.activeElement;
        document.querySelectorAll('.budget-input').forEach(inp => {
            const cat = inp.getAttribute('data-cat');
            if (!cat) return;
            const v = localStorage.getItem('budget_' + cat);
            if (v === null || v === '' || isNaN(v)) return;
            if (active === inp) return;
            if (String(inp.value) !== String(v)) {
                inp.value = v;
            }
        });
    };

    const hydrateChecklistFromLocal = () => {
        document.querySelectorAll('.check[data-doc]').forEach(row => {
            const id = row.getAttribute('data-doc');
            if (!id) return;
            const saved = localStorage.getItem('doc_status_' + id);
            if (!saved) return;
            const statusEl = row.querySelector('.status');
            if (!statusEl) return;

            if (saved === 'confirmed') {
                statusEl.textContent = 'Confirmed';
                statusEl.classList.remove('pending', 'todo');
                statusEl.classList.add('done');
            } else if (saved === 'pending') {
                statusEl.textContent = 'Pending';
                statusEl.classList.remove('done', 'todo');
                statusEl.classList.add('pending');
            }
        });
    };

    const setupChecklistToggle = () => {
        const onToggle = (row) => {
            const id = row.getAttribute('data-doc');
            if (!id) return;
            const statusEl = row.querySelector('.status');
            if (!statusEl) return;

            const isConfirmed = statusEl.classList.contains('done') || statusEl.textContent.trim().toLowerCase() === 'confirmed';
            if (isConfirmed) {
                statusEl.textContent = 'Pending';
                statusEl.classList.remove('done', 'todo');
                statusEl.classList.add('pending');
                localStorage.setItem('doc_status_' + id, 'pending');
            } else {
                statusEl.textContent = 'Confirmed';
                statusEl.classList.remove('pending', 'todo');
                statusEl.classList.add('done');
                localStorage.setItem('doc_status_' + id, 'confirmed');
            }
        };

        document.querySelectorAll('.check[data-doc]').forEach(row => {
            row.style.cursor = 'pointer';
            row.addEventListener('click', () => {
                onToggle(row);
                const evt = new Event('input', { bubbles: true });
                document.body.dispatchEvent(evt);
            });
        });
    };

    const setupAutoBudgetSync = () => {
        const sb = getSupabaseClient();
        if (!sb) return;

        const badge = document.getElementById('sync-badge');
        const syncNowBtn = document.getElementById('sync-now-btn');
        const setBadge = (txt, color) => {
            if (!badge) return;
            badge.textContent = txt;
            if (color) badge.style.color = color;
        };

        const fmtTime = (ts) => {
            if (!ts) return '—';
            try {
                return new Date(Number(ts)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            } catch {
                return '—';
            }
        };

        const refreshBadgeFromState = async () => {
            const { data } = await sb.auth.getSession();
            const signedIn = !!(data && data.session);
            const lp = localStorage.getItem('sync_last_push_ts');
            const ll = localStorage.getItem('sync_last_pull_ts');
            if (!signedIn) {
                setBadge('● Sync: signed out', 'var(--text-muted)');
                return;
            }
            setBadge(`● Sync: on · ↑ ${fmtTime(lp)} · ↓ ${fmtTime(ll)}`, 'var(--teal)');
        };

        let pushTimer = null;
        let pullTimer = null;

        const pushBudget = async () => {
            const user = (await sb.auth.getUser()).data.user;
            if (!user) return;

            const payload = [];
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (!k) continue;
                if (!k.startsWith('budget_') && !k.startsWith('doc_status_')) continue;
                payload.push({ user_id: user.id, key: k, value: localStorage.getItem(k) || '' });
            }
            if (payload.length === 0) return;

            const { error } = await sb.from('user_settings').upsert(payload, { onConflict: 'user_id,key' });
            if (error) throw error;
            localStorage.setItem('sync_last_push_ts', String(Date.now()));
            await refreshBadgeFromState();
        };

        const pullBudget = async () => {
            const user = (await sb.auth.getUser()).data.user;
            if (!user) return;
            await pullSettingsIntoLocal(sb);
            applyLocalBudgetToInputs();
            hydrateChecklistFromLocal();
            calculate();
            localStorage.setItem('sync_last_pull_ts', String(Date.now()));
            await refreshBadgeFromState();
        };

        const schedulePush = () => {
            if (pushTimer) clearTimeout(pushTimer);
            pushTimer = setTimeout(async () => {
                try {
                    setBadge('● Sync: uploading…', 'var(--blue)');
                    await pushBudget();
                } catch (e) {
                    setBadge('● Sync error: upload failed', 'var(--red)');
                    console.log('Auto-sync push failed:', e);
                }
            }, 900);
        };

        document.querySelectorAll('.budget-input').forEach(inp => {
            inp.addEventListener('input', () => {
                schedulePush();
            });
        });

        document.body.addEventListener('input', (e) => {
            if (e && e.target && e.target.classList && e.target.classList.contains('budget-input')) return;
            schedulePush();
        });

        sb.auth.getSession().then(({ data }) => {
            if (data && data.session) {
                setBadge('● Sync: downloading…', 'var(--blue)');
                pullBudget().catch((e) => {
                    setBadge('● Sync error: download failed', 'var(--red)');
                    console.log('Auto-sync pull failed:', e);
                });
            } else {
                refreshBadgeFromState().catch(() => {});
            }
        });

        if (pullTimer) clearInterval(pullTimer);
        pullTimer = setInterval(() => {
            sb.auth.getSession().then(({ data }) => {
                if (data && data.session) {
                    pullBudget().catch((e) => {
                        setBadge('● Sync error: download failed', 'var(--red)');
                        console.log('Auto-sync pull failed:', e);
                    });
                }
            });
        }, 45 * 1000);

        sb.auth.onAuthStateChange((_event, session) => {
            if (session) {
                refreshBadgeFromState().catch(() => {});
                setBadge('● Sync: downloading…', 'var(--blue)');
                pullBudget().catch((e) => {
                    setBadge('● Sync error: download failed', 'var(--red)');
                    console.log('Auto-sync pull failed:', e);
                });
            } else {
                refreshBadgeFromState().catch(() => {});
            }
        });

        if (syncNowBtn) {
            syncNowBtn.addEventListener('click', async () => {
                try {
                    setBadge('● Sync: uploading…', 'var(--blue)');
                    await pushBudget();
                    setBadge('● Sync: downloading…', 'var(--blue)');
                    await pullBudget();
                } catch (e) {
                    const msg = (e && e.message) ? e.message : 'unknown';
                    setBadge(`● Sync error: ${msg}`, 'var(--red)');
                    console.log('Manual sync failed:', e);
                }
            });
        }

        refreshBadgeFromState().catch(() => {});
    };

    const validateGate = async () => {
        if (!gate || !gatePass || !gateEmail) return true;
        const sb = getSupabaseClient();
        if (!sb) {
            if (gateStatus) {
                gateStatus.textContent = '● Cloud auth unavailable';
                gateStatus.classList.remove('good');
                gateStatus.classList.add('bad');
            }
            shakeGateBad();
            return false;
        }

        const email = (gateEmail.value || '').trim();
        const password = gatePass.value || '';
        if (!email || !password) {
            if (gateStatus) {
                gateStatus.textContent = '● Enter email + password';
                gateStatus.classList.remove('good');
                gateStatus.classList.add('bad');
            }
            shakeGateBad();
            return false;
        }

        if (gateStatus) {
            gateStatus.textContent = '● Signing in…';
            gateStatus.classList.remove('bad', 'good');
        }

        let res = await sb.auth.signInWithPassword({ email, password });
        if (res.error) {
            const su = await sb.auth.signUp({ email, password });
            if (!su.error) {
                res = await sb.auth.signInWithPassword({ email, password });
            }
        }

        if (res.error) {
            if (gateStatus) {
                gateStatus.textContent = '● Access Denied';
                gateStatus.classList.remove('good');
                gateStatus.classList.add('bad');
            }
            shakeGateBad();
            return false;
        }

        try {
            await pullSettingsIntoLocal(sb);
        } catch (e) {
            // ok if table/policies not set up yet
        }

        unlockGate();
        return true;
    };

    if (gate && gatePass && gateSubmit && gateEmail) {
        const sb = getSupabaseClient();
        if (!sb) {
            lockGate();
            if (gateStatus) {
                gateStatus.textContent = '● Cloud auth unavailable';
                gateStatus.classList.add('bad');
            }
        } else {
            sb.auth.getSession().then(async ({ data }) => {
                if (data && data.session) {
                    try {
                        await pullSettingsIntoLocal(sb);
                    } catch (e) {
                        // ok
                    }
                    unlockGate();
                } else {
                    lockGate();
                }
            });
        }

        gateSubmit.addEventListener('click', () => {
            validateGate();
        });
        [gateEmail, gatePass].forEach((el) => {
            el.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') validateGate();
                if (e.key === 'Escape') lockGate();
            });
        });

        gate.addEventListener('mousedown', (e) => {
            if (e.target === gate && gateEmail) gateEmail.focus();
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

    hydrateChecklistFromLocal();
    setupChecklistToggle();

    setupAutoBudgetSync();

    updateDividendCalendar();

    const updateFxConverterUi = () => {
        const fromCurEl = document.getElementById('fx-from-cur');
        const toCurEl = document.getElementById('fx-to-cur');
        const fromAmtEl = document.getElementById('fx-from-amt');
        const toAmtEl = document.getElementById('fx-to-amt');
        const rateEl = document.getElementById('fx-conv-rate');
        const updatedEl = document.getElementById('fx-conv-updated');

        if (!fromCurEl || !toCurEl || !fromAmtEl || !toAmtEl || !rateEl || !updatedEl) return;

        const rate = parseFloat(localStorage.getItem('fx_eurusd_rate') || '');
        const ts = parseInt(localStorage.getItem('fx_eurusd_ts') || '', 10);
        if (!rate || !isFinite(rate)) {
            rateEl.textContent = '● Rate: —';
            updatedEl.textContent = 'Updated: —';
            return;
        }

        rateEl.textContent = `● Rate: 1 EUR = ${rate.toFixed(4)} USD`;
        if (ts && isFinite(ts)) {
            updatedEl.textContent = 'Updated: ' + new Date(ts).toLocaleString();
        } else {
            updatedEl.textContent = 'Updated: —';
        }

        const fromCur = fromCurEl.value;
        const toCur = toCurEl.value;
        const fromAmt = parseFloat(fromAmtEl.value || '0');

        if (!fromAmtEl.value || !isFinite(fromAmt)) {
            toAmtEl.value = '';
            return;
        }

        const convert = (amt, f, t) => {
            if (f === t) return amt;
            if (f === 'EUR' && t === 'USD') return amt * rate;
            if (f === 'USD' && t === 'EUR') return amt / rate;
            return NaN;
        };

        const out = convert(fromAmt, fromCur, toCur);
        if (!isFinite(out)) {
            toAmtEl.value = '';
            return;
        }
        toAmtEl.value = out.toFixed(2);
    };

    const setupFxConverter = () => {
        const fromCurEl = document.getElementById('fx-from-cur');
        const toCurEl = document.getElementById('fx-to-cur');
        const fromAmtEl = document.getElementById('fx-from-amt');
        const swapEl = document.getElementById('fx-swap');
        if (!fromCurEl || !toCurEl || !fromAmtEl || !swapEl) return;

        const onChange = () => updateFxConverterUi();
        fromCurEl.addEventListener('change', onChange);
        toCurEl.addEventListener('change', onChange);
        fromAmtEl.addEventListener('input', onChange);
        swapEl.addEventListener('click', () => {
            const a = fromCurEl.value;
            fromCurEl.value = toCurEl.value;
            toCurEl.value = a;
            updateFxConverterUi();
        });

        updateFxConverterUi();
    };

    setupFxConverter();

    const updateFxBadge = async (forceRefresh = false) => {
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

            updateFxConverterUi();
        };

        if (cacheFresh && !forceRefresh) {
            render(cachedRate, true);
            return;
        }

        if (cachedRate) {
            render(cachedRate, true);
        }

        const fetchJson = async (url) => {
            const controller = new AbortController();
            const t = setTimeout(() => controller.abort(), 6500);
            try {
                const res = await fetch(url, { cache: 'no-store', signal: controller.signal });
                if (!res.ok) throw new Error(`fx http ${res.status}`);
                return await res.json();
            } finally {
                clearTimeout(t);
            }
        };

        const providers = [
            async () => {
                const data = await fetchJson('https://api.frankfurter.app/latest?from=EUR&to=USD');
                const rate = data && data.rates && typeof data.rates.USD === 'number' ? data.rates.USD : null;
                return rate;
            },
            async () => {
                const data = await fetchJson('https://api.exchangerate.host/latest?base=EUR&symbols=USD');
                const rate = data && data.rates && typeof data.rates.USD === 'number' ? data.rates.USD : null;
                return rate;
            },
            async () => {
                const data = await fetchJson('https://open.er-api.com/v6/latest/EUR');
                const rate = data && data.rates && typeof data.rates.USD === 'number' ? data.rates.USD : null;
                return rate;
            }
        ];

        try {
            let rate = null;
            for (const p of providers) {
                try {
                    rate = await p();
                    if (rate) break;
                } catch (err) {
                    console.log('FX provider failed:', err);
                }
            }
            if (!rate) throw new Error('fx all providers failed');

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

    const fxRefreshBtn = document.getElementById('fx-refresh');
    if (fxRefreshBtn) {
        fxRefreshBtn.addEventListener('click', () => {
            updateFxBadge(true);
        });
    }

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
