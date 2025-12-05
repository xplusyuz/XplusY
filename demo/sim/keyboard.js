// keyboard.js
// Simple math keyboard behavior. Ensures .keyboard-toggle buttons open the keyboard,
// buttons input values to the active input, and close button hides it.

(function(){
    const keyboard = document.getElementById('math-keyboard');
    const closeBtn = document.getElementById('close-keyboard');
    let activeInput = null;

    function openKeyboardFor(inputEl) {
        activeInput = inputEl;
        if (!activeInput) return;
        // show keyboard
        keyboard.classList.add('visible');
        keyboard.setAttribute('aria-hidden','false');
        // focus is readonly for inputs; we don't call focus() to avoid native keyboard on mobile
    }

    function closeKeyboard() {
        keyboard.classList.remove('visible');
        keyboard.setAttribute('aria-hidden','true');
        activeInput = null;
    }

    // Attach toggle buttons
    document.querySelectorAll('.keyboard-toggle').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const targetId = btn.dataset.target;
            const el = document.getElementById(targetId);
            if (!el) return;
            openKeyboardFor(el);
        });
    });

    // Close button
    if (closeBtn) closeBtn.addEventListener('click', closeKeyboard);

    // Keyboard buttons
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
            // dispatch input event
            activeInput.dispatchEvent(new Event('input', { bubbles: true }));
        });
    });

    // Close when clicking outside keyboard
    document.addEventListener('click', (e) => {
        if (!keyboard.classList.contains('visible')) return;
        if (e.target.closest('#math-keyboard') || e.target.classList.contains('keyboard-toggle')) return;
        closeKeyboard();
    });

    // Export for debugging
    window.vietKeyboard = { openKeyboardFor, closeKeyboard };
})();