/* keyboard.js - injected helper */
(function(){
    const keyboard = document.getElementById('math-keyboard');
    const closeBtn = document.getElementById('close-keyboard');
    let activeInput = null;

    function openKeyboardFor(inputEl) {
        activeInput = inputEl;
        if (!activeInput) return;
        keyboard.classList.add('visible');
        keyboard.setAttribute('aria-hidden','false');
    }

    function closeKeyboard() {
        keyboard.classList.remove('visible');
        keyboard.setAttribute('aria-hidden','true');
        activeInput = null;
    }

    document.addEventListener('DOMContentLoaded', () => {
        // Ensure buttons do not act as submit buttons
        document.querySelectorAll('button').forEach(b => {
            if (!b.hasAttribute('type')) b.setAttribute('type','button');
        });

        // Prevent default on anchor href="#" links
        document.querySelectorAll('a[href="#"]').forEach(a => {
            a.addEventListener('click', e => e.preventDefault());
        });

        // Attach toggle buttons
        document.querySelectorAll('.keyboard-toggle').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const targetId = btn.dataset.target;
                const el = document.getElementById(targetId);
                if (!el) return;
                openKeyboardFor(el);
            });
        });

        if (closeBtn) closeBtn.addEventListener('click', closeKeyboard);

        document.querySelectorAll('.keyboard-btn').forEach(kb => {
            kb.addEventListener('click', () => {
                if (!activeInput) return;
                const v = kb.dataset.value;
                if (v === 'backspace') {
                    activeInput.value = activeInput.value.slice(0, -1);
                } else if (v === 'clear') {
                    activeInput.value = '';
                } else if (v === 'switch') {
                    activeInput = (activeInput.id === 'x1') ? document.getElementById('x2') : document.getElementById('x1');
                } else {
                    activeInput.value = activeInput.value + v;
                }
                activeInput.dispatchEvent(new Event('input', { bubbles: true }));
            });
        });

        // Close when clicking outside keyboard
        document.addEventListener('click', (e) => {
            if (!keyboard.classList.contains('visible')) return;
            if (e.target.closest('#math-keyboard') || e.target.classList.contains('keyboard-toggle')) return;
            closeKeyboard();
        });
    });

    window.vietKeyboard = { openKeyboardFor, closeKeyboard };
})();