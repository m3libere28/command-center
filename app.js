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

    let accessGrantedAudio = null;

    let sbClient = null;
    const getSupabaseClient = () => {
        if (sbClient) return sbClient;
        if (!window.supabase || !window.supabase.createClient) return null;
        const SUPABASE_URL = 'https://lfhifmauilsstkxczjeb.supabase.co';
        const SUPABASE_ANON_KEY = 'sb_publishable_fsOsWpTTea94kT8rpkjNRw_XzYdn7yD';
        sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        return sbClient;
    };

    const playAccessGuitarOnce = () => {
        try {
            if (sessionStorage.getItem('cc_access_sound_played') === '1') return;
            sessionStorage.setItem('cc_access_sound_played', '1');

            const tryPlayWav = () => {
                try {
                    const a = new Audio('./sfx/access-granted.wav');
                    a.preload = 'auto';
                    a.currentTime = 0;
                    a.volume = 1;

                    accessGrantedAudio = a;
                    a.addEventListener('ended', () => {
                        if (accessGrantedAudio === a) accessGrantedAudio = null;
                    });
                    a.addEventListener('error', () => {
                        if (accessGrantedAudio === a) accessGrantedAudio = null;
                    });

                    const p = a.play();
                    return p;
                } catch (e) {
                    return Promise.reject(e);
                }
            };

            tryPlayWav().catch(() => {
                const AudioCtx = window.AudioContext || window.webkitAudioContext;
                if (!AudioCtx) return;
                const ctx = new AudioCtx();
                const now = ctx.currentTime;

                const out = ctx.createGain();
                out.gain.value = 0.85;
                out.connect(ctx.destination);

                const mkImpulse = (dur = 1.6, decay = 4.5) => {
                    const rate = ctx.sampleRate;
                    const len = Math.max(1, Math.floor(rate * dur));
                    const buf = ctx.createBuffer(2, len, rate);
                    for (let ch = 0; ch < 2; ch++) {
                        const data = buf.getChannelData(ch);
                        for (let i = 0; i < len; i++) {
                            const t = i / len;
                            data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay);
                        }
                    }
                    return buf;
                };

                const convolver = ctx.createConvolver();
                convolver.buffer = mkImpulse(1.6, 4.5);
                const wet = ctx.createGain();
                wet.gain.value = 0.18;
                convolver.connect(wet);
                wet.connect(out);

                const dry = ctx.createGain();
                dry.gain.value = 0.95;
                dry.connect(out);

                const noteHz = (midi) => 440 * Math.pow(2, (midi - 69) / 12);
                const strum = (midiNotes, startAt, totalDur) => {
                    const spacing = 0.02;
                    midiNotes.forEach((midi, i) => {
                        const t0 = startAt + i * spacing;

                        const osc1 = ctx.createOscillator();
                        const osc2 = ctx.createOscillator();
                        osc1.type = 'triangle';
                        osc2.type = 'sine';
                        const hz = noteHz(midi);
                        osc1.frequency.setValueAtTime(hz, t0);
                        osc2.frequency.setValueAtTime(hz * 2, t0);

                        const g = ctx.createGain();
                        const lp = ctx.createBiquadFilter();
                        lp.type = 'lowpass';
                        lp.frequency.setValueAtTime(2200, t0);
                        lp.Q.setValueAtTime(0.7, t0);

                        const a = 0.004;
                        const d = Math.max(0.25, totalDur - (i * spacing));
                        g.gain.setValueAtTime(0.0001, t0);
                        g.gain.exponentialRampToValueAtTime(0.22, t0 + a);
                        g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);

                        osc1.connect(lp);
                        osc2.connect(lp);
                        lp.connect(g);

                        g.connect(dry);
                        g.connect(convolver);

                        osc1.start(t0);
                        osc2.start(t0);
                        osc1.stop(t0 + d);
                        osc2.stop(t0 + d);
                    });
                };

                strum([57, 60, 64, 69], now + 0.00, 1.15);
                strum([55, 59, 62, 67], now + 0.55, 1.25);
                strum([52, 57, 60, 64, 69], now + 1.15, 1.35);

                const stopAt = now + 3.05;
                setTimeout(() => {
                    try { ctx.close(); } catch (e) {}
                }, Math.max(0, Math.ceil((stopAt - now) * 1000)));
            });
        } catch (e) {
            try { sessionStorage.removeItem('cc_access_sound_played'); } catch (e2) {}
        }
    };

    const unlockGate = () => {
        if (!gate) return;
        playAccessGuitarOnce();
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

    const CC_FX_FALLBACK = 1.09;
    const CC_MIGRATION_RATE = 1.09;
    const CC_MIGRATION_KEY = 'budget_cur_migrated_v1';
    const ccGetRate = () => {
        const r = parseFloat(localStorage.getItem('fx_eurusd_rate'));
        return (isFinite(r) && r > 0) ? r : CC_FX_FALLBACK;
    };
    const ccIsEurNative = (inp) => !!(inp && inp.getAttribute && inp.getAttribute('data-cur') === 'eur');
    const ccInputUsdValue = (inp) => {
        if (!inp) return 0;
        const v = parseFloat(inp.value);
        if (!isFinite(v)) return 0;
        return ccIsEurNative(inp) ? v * ccGetRate() : v;
    };
    const migrateBudgetCurrenciesIfNeeded = () => {
        try {
            if (localStorage.getItem(CC_MIGRATION_KEY) === '1') return false;
            const eurInputs = document.querySelectorAll('.budget-input[data-cur="eur"]');
            let changed = false;
            eurInputs.forEach(inp => {
                const cat = inp.getAttribute('data-cat');
                if (!cat) return;
                const key = 'budget_' + cat;
                const stored = localStorage.getItem(key);
                if (stored === null || stored === '') return;
                const num = parseFloat(stored);
                if (!isFinite(num) || num <= 0) return;
                const eurGuess = Math.round(num / CC_MIGRATION_RATE);
                if (eurGuess > 0 && num > eurGuess) {
                    localStorage.setItem(key, String(eurGuess));
                    changed = true;
                }
            });
            localStorage.setItem(CC_MIGRATION_KEY, '1');
            return changed;
        } catch (e) {
            console.log('budget currency migration skipped:', e);
            return false;
        }
    };
    const ccFmtNum = (n, dec = 0) => {
        const abs = Math.abs(n);
        return abs.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
    };
    const ccDualFromUsd = (usd, dec = 0, suffix = '') => {
        const rate = ccGetRate();
        const eur = usd / rate;
        const sign = usd < 0 ? '-' : '';
        const eurDec = Math.abs(eur) >= 1000 ? 0 : (dec || 0);
        return `<span class="mn-primary">${sign}€${ccFmtNum(eur, eurDec)}${suffix}</span><span class="mn-secondary">${sign}$${ccFmtNum(usd, dec)}${suffix}</span>`;
    };

    const ccMoneyRegex = /^\s*(-)?\$\s*([\d]{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?)\s*(\/mo|\/month)?\s*$/i;
    const ccRenderDualMoneyScope = (root) => {
        if (!root) return;
        const selectors = [
            '.kpi-value',
            '.row .value',
            '.live-val',
            'td strong',
            '.fx-base',
            '.fx-good',
            '.fx-warn',
            '.fx-bad'
        ];
        const nodes = root.querySelectorAll(selectors.join(','));
        nodes.forEach(node => {
            if (node.querySelector('input, button, select, textarea')) return;
            if (node.querySelector('.mn-primary')) {
                if (!node.dataset.ccUsd) return;
                const usd = parseFloat(node.dataset.ccUsd);
                const suffix = node.dataset.ccSuffix || '';
                if (!isFinite(usd)) return;
                const dec = (usd % 1 !== 0) ? 2 : 0;
                node.innerHTML = ccDualFromUsd(usd, dec, suffix);
                return;
            }
            const raw = (node.textContent || '').trim();
            const m = raw.match(ccMoneyRegex);
            if (!m) return;
            const neg = m[1] === '-';
            const numStr = m[2].replace(/,/g, '');
            const value = parseFloat(numStr);
            if (!isFinite(value)) return;
            const usd = neg ? -value : value;
            const suffix = m[3] ? m[3] : '';
            const dec = numStr.includes('.') ? (numStr.split('.')[1].length) : 0;
            const decOut = dec > 2 ? 2 : dec;
            node.dataset.ccUsd = String(usd);
            node.dataset.ccSuffix = suffix;
            node.innerHTML = ccDualFromUsd(usd, decOut, suffix);
        });
    };
    const ccRenderDualMoney = () => ccRenderDualMoneyScope(document);

    const addBudgetInputEurMirrors = () => {
        document.querySelectorAll('.budget-input').forEach(inp => {
            const cell = inp.closest('td') || inp.parentElement;
            if (!cell) return;
            let mirror = cell.querySelector(':scope > .input-eur-live');
            if (!mirror) {
                mirror = document.createElement('span');
                mirror.className = 'input-eur-live';
                cell.appendChild(mirror);
            }
            const renderMirror = () => {
                const rate = ccGetRate();
                const v = parseFloat(inp.value) || 0;
                if (ccIsEurNative(inp)) {
                    const usd = v * rate;
                    mirror.textContent = `≈ $${Math.round(usd).toLocaleString('en-US')}`;
                } else {
                    const eur = v / rate;
                    mirror.textContent = `≈ €${Math.round(eur).toLocaleString('en-US')}`;
                }
            };
            renderMirror();
            if (!inp.dataset.ccEurBound) {
                inp.addEventListener('input', renderMirror);
                inp.dataset.ccEurBound = '1';
            }
        });
    };

    window.ccRenderAllMoney = () => {
        ccRenderDualMoney();
        addBudgetInputEurMirrors();
    };

    const setupCountdown = () => {
        const card = document.getElementById('countdown-card');
        if (!card) return;

        const pad = n => String(n).padStart(2, '0');

        const cdDays = document.getElementById('cd-days');
        const cdHrs = document.getElementById('cd-hrs');
        const cdMin = document.getElementById('cd-min');
        const cdSec = document.getElementById('cd-sec');
        const chipWeeks = document.getElementById('chip-weeks');
        const pctEl = document.getElementById('cd-pct');
        const fillEl = document.getElementById('cd-fill');

        const DEPARTURE = new Date(2026, 5, 14, 9, 0, 0).getTime();
        const START = new Date(2026, 3, 13, 0, 0, 0).getTime();
        const TOTAL = DEPARTURE - START;

        const setText = (el, val) => {
            if (!el) return;
            if (el.textContent === val) return;
            el.textContent = val;
            el.classList.remove('tick');
            void el.offsetWidth;
            el.classList.add('tick');
        };

        const tick = () => {
            const now = Date.now();
            let diff = DEPARTURE - now;

            if (diff <= 0) {
                setText(cdDays, '0');
                setText(cdHrs, '00');
                setText(cdMin, '00');
                setText(cdSec, '00');
                if (chipWeeks) chipWeeks.textContent = '¡hola Valencia!';
                if (pctEl) pctEl.textContent = '100%';
                if (fillEl) fillEl.style.width = '100%';
                card.classList.add('arrived');
                return;
            }

            const days = Math.floor(diff / 86400000);
            diff -= days * 86400000;
            const hrs = Math.floor(diff / 3600000);
            diff -= hrs * 3600000;
            const min = Math.floor(diff / 60000);
            diff -= min * 60000;
            const sec = Math.floor(diff / 1000);

            setText(cdDays, String(days));
            setText(cdHrs, pad(hrs));
            setText(cdMin, pad(min));
            setText(cdSec, pad(sec));

            const weeks = Math.floor(days / 7);
            if (chipWeeks) chipWeeks.textContent = `${weeks} week${weeks === 1 ? '' : 's'} out`;

            const elapsed = Math.max(0, now - START);
            const pct = Math.min(100, Math.max(0, (elapsed / TOTAL) * 100));
            if (pctEl) pctEl.textContent = `${pct.toFixed(1)}%`;
            if (fillEl) fillEl.style.width = `${pct}%`;
        };

        tick();
        setInterval(tick, 1000);
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

        const emilyEl = document.getElementById('income-emily');
        if (emilyEl && active !== emilyEl) {
            const saved = localStorage.getItem('budget_income_emily');
            if (saved !== null && saved !== '' && !isNaN(saved)) {
                const next = String(parseFloat(saved));
                if (String(emilyEl.value) !== next) {
                    emilyEl.value = next;
                }
            }
        }
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
                if (!k.startsWith('budget_') && k !== 'budget_income_emily' && !k.startsWith('doc_status_')) continue;
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
            const migrated = migrateBudgetCurrenciesIfNeeded();
            applyLocalBudgetToInputs();
            hydrateChecklistFromLocal();
            calculate();
            if (typeof window.ccRenderAllMoney === 'function') window.ccRenderAllMoney();
            localStorage.setItem('sync_last_pull_ts', String(Date.now()));
            await refreshBadgeFromState();
            if (migrated) {
                try { await pushBudget(); } catch (e) { console.log('push after migration failed:', e); }
            }
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
    const grossDividends = 1690.67;

    const getEmilyIncome = () => {
        const saved = localStorage.getItem('budget_income_emily');
        if (saved !== null && saved !== '' && !isNaN(saved)) return parseFloat(saved);
        return 3500;
    };

    const setEmilyIncome = (val) => {
        localStorage.setItem('budget_income_emily', String(val));
    };

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

        const incomeEmily = getEmilyIncome();
        const totalGross = incomeVA + incomeEmily + grossDividends;

        inputs.forEach(inp => {
            const usdVal = ccInputUsdValue(inp);
            totalExpenses += usdVal;

            const table = inp.closest('table');
            if (table) {
                const titleElement = table.previousElementSibling;
                if (titleElement && titleElement.classList.contains('section-title')) {
                    const title = titleElement.textContent.toLowerCase();
                    if (title.includes('spain')) spanSum += usdVal;
                    else if (title.includes('us carrying')) usSum += usdVal;
                    else if (title.includes('business')) bizSum += usdVal;
                    else if (title.includes('admin')) adminSum += usdVal;
                }
            }
        });

        const writeDual = (el, usd) => {
            if (!el) return;
            el.dataset.ccUsd = String(usd);
            el.dataset.ccSuffix = '';
            el.innerHTML = ccDualFromUsd(usd, 0, '');
        };

        const dynGross1 = document.getElementById('dyn-total-gross');
        const dynGross2 = document.getElementById('dyn-total-gross-2');
        writeDual(dynGross1, totalGross);
        writeDual(dynGross2, totalGross);

        const dynExp1 = document.getElementById('dyn-total-expenses');
        const dynExp2 = document.getElementById('dyn-total-expenses-2');
        writeDual(dynExp1, totalExpenses);
        writeDual(dynExp2, totalExpenses);

        // Tax set-aside is kept outside the budget inputs so the admin subtotal
        // represents lifestyle/admin only. The conservative Scenario C tax is
        // deducted here so the displayed surplus reflects real cash flow.
        const TAX_SETASIDE_MO = 1192;
        const dynSurp1 = document.getElementById('dyn-monthly-surplus');
        const dynSurp2 = document.getElementById('dyn-monthly-surplus-2');
        writeDual(dynSurp1, totalGross - totalExpenses - TAX_SETASIDE_MO);
        writeDual(dynSurp2, totalGross - totalExpenses - TAX_SETASIDE_MO);

        writeDual(document.getElementById('dyn-spain-subtotal'), spanSum);
        writeDual(document.getElementById('dyn-us-subtotal'), usSum);
        writeDual(document.getElementById('dyn-biz-subtotal'), bizSum);
        writeDual(document.getElementById('dyn-admin-subtotal'), adminSum);

        addBudgetInputEurMirrors();

        // Connect reactivity to the What-If Emily Slider via global var
        window.DYNAMIC_EXPENSES = totalExpenses;
        const emilySlid = document.getElementById('emilyIncomeSlider');
        if (emilySlid) {
            emilySlid.dispatchEvent(new Event('input'));
        }
    };

    const emilyIncomeInput = document.getElementById('income-emily');
    if (emilyIncomeInput) {
        const saved = localStorage.getItem('budget_income_emily');
        if (saved !== null && saved !== '' && !isNaN(saved)) {
            emilyIncomeInput.value = String(parseFloat(saved));
        } else {
            setEmilyIncome(parseFloat(emilyIncomeInput.value || '3500') || 3500);
        }

        emilyIncomeInput.addEventListener('input', () => {
            const v = parseFloat(emilyIncomeInput.value) || 0;
            setEmilyIncome(v);
            calculate();

            const evt = new Event('input', { bubbles: true });
            document.body.dispatchEvent(evt);
        });
    }

    // State Hydration from Browser LocalStorage
    migrateBudgetCurrenciesIfNeeded();

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

    if (typeof window.ccRenderAllMoney === 'function') window.ccRenderAllMoney();

    setupCountdown();

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
            if (typeof window.ccRenderAllMoney === 'function') window.ccRenderAllMoney();
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

        const fmtSigned = (num) => {
            const abs = Math.abs(num);
            const s = '$' + abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            return (num >= 0 ? '' : '-') + s;
        };

        const updateTickerDayGain = (ticker, dollarDelta, pctChange) => {
            const row = document.querySelector(`.day-gain-row[data-ticker="${ticker}"]`);
            const amtEl = document.getElementById(`day-gain-${ticker}`);
            const pctEl = document.getElementById(`day-gain-${ticker}-pct`);
            if (amtEl) {
                const arrow = dollarDelta >= 0 ? '↑' : '↓';
                amtEl.textContent = `${arrow} ${fmtSigned(dollarDelta)}`;
                amtEl.classList.remove('green', 'red');
                amtEl.classList.add(dollarDelta >= 0 ? 'green' : 'red');
            }
            if (pctEl && isFinite(pctChange)) {
                const sign = pctChange >= 0 ? '+' : '';
                pctEl.textContent = `${sign}${pctChange.toFixed(2)}%`;
            }
        };

        const getTickerLiveValue = (t) => {
            const el = document.querySelector(`.live-val[data-ticker="${t}"]`);
            if (!el) return 0;
            const shares = parseFloat(el.getAttribute('data-shares')) || 0;
            if (t === 'VMFXX') return shares;
            const price = parseFloat(localStorage.getItem(`price_${t}`));
            if (isFinite(price) && price > 0) return shares * price;
            const cached = parseFloat(el.dataset.ccUsd);
            if (isFinite(cached) && cached > 0) return cached;
            const raw = (el.textContent || '').match(/\$?([\d,]+\.?\d*)/);
            return raw ? parseFloat(raw[1].replace(/,/g, '')) : 0;
        };

        const recalcAllPortfolioDerivedTotals = () => {
            const spyiVal = getTickerLiveValue('SPYI');
            const schdVal = getTickerLiveValue('SCHD');
            const schyVal = getTickerLiveValue('SCHY');
            const vmfxxVal = getTickerLiveValue('VMFXX');
            const total = spyiVal + schdVal + schyVal + vmfxxVal;

            const setDual = (id, usd, dec = 0) => {
                const el = document.getElementById(id);
                if (!el) return;
                el.dataset.ccUsd = String(usd);
                el.dataset.ccSuffix = '';
                if (typeof ccDualFromUsd === 'function') {
                    el.innerHTML = ccDualFromUsd(usd, dec, '');
                } else {
                    el.textContent = '$' + usd.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
                }
            };

            // Overview + Plan at a glance
            setDual('dyn-overview-total', total, 0);
            setDual('dyn-plan-total', total, 2);
            setDual('dyn-plan-spyi', spyiVal, 2);
            setDual('dyn-plan-other', schdVal + schyVal + vmfxxVal, 2);

            // Emily-Optional progress
            const EO_TARGET = 364690;
            const eoPct = Math.min(100, Math.max(0, (total / EO_TARGET) * 100));
            const eoBar = document.getElementById('dyn-eo-bar');
            if (eoBar) eoBar.style.width = `${eoPct.toFixed(1)}%`;
            const eoText = document.getElementById('dyn-eo-progress');
            if (eoText) eoText.textContent = `$${Math.round(total).toLocaleString('en-US')} of $364,690 · ${eoPct.toFixed(1)}% complete`;

            // Independence
            setDual('dyn-ind-portfolio', total, 0);
            setDual('dyn-ind-postmove', total - 2977, 0);

            // Net Worth
            const NW_HOUSE = 458000;
            const NW_LIABS = 2977.45;
            const nwTotal = total + NW_HOUSE - NW_LIABS;
            setDual('dyn-nw-portfolio', total, 0);
            setDual('dyn-nw-total', nwTotal, 0);
            setDual('dyn-nw-list-portfolio', total, 2);
            setDual('dyn-nw-list-total', nwTotal, 0);
            const portBar = document.getElementById('dyn-nw-comp-port-bar');
            const oakBar = document.getElementById('dyn-nw-comp-oak-bar');
            const portPct = total + NW_HOUSE > 0 ? (total / (total + NW_HOUSE)) * 100 : 0;
            const oakPct = 100 - portPct;
            if (portBar) portBar.style.width = `${portPct.toFixed(1)}%`;
            if (oakBar) oakBar.style.width = `${oakPct.toFixed(1)}%`;
            const portLbl = document.getElementById('dyn-nw-comp-port-label');
            if (portLbl) portLbl.textContent = `■ Investment portfolio ${portPct.toFixed(1)}% ($${Math.round(total).toLocaleString('en-US')})`;
            const oakLbl = document.getElementById('dyn-nw-comp-oak-label');
            if (oakLbl) oakLbl.textContent = `■ Oakland Park equity ${oakPct.toFixed(1)}% (~$458,000)`;

            // Portfolio top cards
            setDual('dyn-port-card-spyi', spyiVal, 2);
            setDual('dyn-port-card-schd', schdVal, 2);
            setDual('dyn-port-card-schy', schyVal, 2);

            // Income table: estimated annual/monthly per ticker = value * yield
            const yields = { SPYI: 0.1224, SCHD: 0.0330, SCHY: 0.0312, VMFXX: 0.0358 };
            const vals = { SPYI: spyiVal, SCHD: schdVal, SCHY: schyVal, VMFXX: vmfxxVal };
            let totAnnual = 0, totMonthly = 0;
            ['SPYI', 'SCHD', 'SCHY', 'VMFXX'].forEach(t => {
                const annual = vals[t] * yields[t];
                const monthly = annual / 12;
                totAnnual += annual;
                totMonthly += monthly;
                setDual(`dyn-inc-${t}-annual`, annual, 2);
                setDual(`dyn-inc-${t}-monthly`, monthly, 2);
            });
            setDual('dyn-inc-total-annual', totAnnual, 2);
            setDual('dyn-inc-total-monthly', totMonthly, 2);
        };

        const renderDayGainTotal = () => {
            const tickers = ['SPYI', 'SCHD', 'SCHY'];
            let totalDelta = 0;
            let totalPrev = 0;
            let haveAny = false;
            tickers.forEach(t => {
                const el = document.querySelector(`.live-val[data-ticker="${t}"]`);
                if (!el) return;
                const shares = parseFloat(el.getAttribute('data-shares')) || 0;
                const dPerShare = parseFloat(localStorage.getItem(`dprice_${t}`));
                const pcPerShare = parseFloat(localStorage.getItem(`pclose_${t}`));
                if (isFinite(dPerShare)) { totalDelta += dPerShare * shares; haveAny = true; }
                if (isFinite(pcPerShare)) totalPrev += pcPerShare * shares;
            });
            if (!haveAny) return;
            const bigEl = document.getElementById('day-gain-total-val');
            const amtEl = document.getElementById('day-gain-total-amt');
            const pctEl = document.getElementById('day-gain-total-pct');
            const arrowEl = bigEl ? bigEl.querySelector('.day-gain-arrow') : null;
            if (bigEl) {
                bigEl.classList.remove('green', 'red');
                bigEl.classList.add(totalDelta >= 0 ? 'green' : 'red');
            }
            if (arrowEl) arrowEl.textContent = totalDelta >= 0 ? '↑' : '↓';
            if (amtEl) amtEl.textContent = fmtSigned(totalDelta);
            if (pctEl && totalPrev > 0) {
                const pct = (totalDelta / totalPrev) * 100;
                const sign = pct >= 0 ? '+' : '';
                const asof = new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
                pctEl.textContent = `${sign}${pct.toFixed(2)}% · updated ${asof}`;
            }
        };

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
                    
                    // The 'c' property is current price; 'd' is day $ change per share; 'dp' is % change; 'pc' is previous close
                    const price = data.c;
                    const dChange = (typeof data.d === 'number') ? data.d : null;
                    const dPct = (typeof data.dp === 'number') ? data.dp : null;
                    const prevClose = (typeof data.pc === 'number') ? data.pc : null;
                    if (price) {
                        localStorage.setItem(`price_${ticker}`, price);
                        if (dChange !== null) localStorage.setItem(`dprice_${ticker}`, String(dChange));
                        if (prevClose !== null) localStorage.setItem(`pclose_${ticker}`, String(prevClose));
                        priceSpans.forEach(el => el.textContent = `@ $${price.toFixed(2)}`);

                        let tickerShares = 0;
                        valSpans.forEach(el => {
                            const shares = parseFloat(el.getAttribute('data-shares')) || 0;
                            const total = shares * price;
                            el.textContent = fmtPort(total);
                            tickerShares = shares;
                        });

                        if (dChange !== null && tickerShares > 0) {
                            updateTickerDayGain(ticker, dChange * tickerShares, dPct);
                        }
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
            renderDayGainTotal();
            recalcAllPortfolioDerivedTotals();
            if (typeof window.ccRenderAllMoney === 'function') window.ccRenderAllMoney();
        };

        // Initial paint from cached values (works offline / before first fetch)
        recalcAllPortfolioDerivedTotals();
        renderDayGainTotal();
        (['SPYI','SCHD','SCHY']).forEach(t => {
            const d = parseFloat(localStorage.getItem(`dprice_${t}`));
            const pc = parseFloat(localStorage.getItem(`pclose_${t}`));
            if (isFinite(d)) {
                const el = document.querySelector(`.live-val[data-ticker="${t}"]`);
                const shares = el ? (parseFloat(el.getAttribute('data-shares')) || 0) : 0;
                const pct = isFinite(pc) && pc > 0 ? (d / pc) * 100 : NaN;
                if (shares > 0) updateTickerDayGain(t, d * shares, pct);
            }
        });

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
            recalcAllPortfolioDerivedTotals();
            if (typeof window.ccRenderAllMoney === 'function') window.ccRenderAllMoney();
        }
    }
});
