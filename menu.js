const assistiveBtn = document.getElementById('assistiveBtn');
const mathMenu = document.getElementById('mathMenu');
const closeMenuBtn = document.getElementById('closeMenuBtn');

// Dastlab menyu yopiq
document.addEventListener('DOMContentLoaded', function() {
    if (mathMenu) mathMenu.style.display = 'none';
});

// Tugma bosilganda menyuni ochish/yopish
assistiveBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    if (mathMenu.style.display === 'none' || mathMenu.style.display === '') {
        mathMenu.style.display = 'flex';
    } else {
        mathMenu.style.display = 'none';
    }
});

// Yopish tugmasi
closeMenuBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    mathMenu.style.display = 'none';
});

// Tashqariga bosilganda menyuni yopish
document.addEventListener('click', function(e) {
    if (!mathMenu.contains(e.target) && e.target !== assistiveBtn) {
        mathMenu.style.display = 'none';
    }
});

// Menyuni bosilganda yopilishining oldini olish
mathMenu.addEventListener('click', function(e) {
    e.stopPropagation();
});

// Drag-and-drop funksiyasi
let isDragging = false;
let offsetX, offsetY;

assistiveBtn.addEventListener('mousedown', startDrag);
assistiveBtn.addEventListener('touchstart', startDrag, {passive: false});

function startDrag(e) {
    e.preventDefault();
    isDragging = true;
    const rect = assistiveBtn.getBoundingClientRect();
    offsetX = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    offsetY = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;

    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', stopDrag);
    document.addEventListener('touchmove', drag, {passive: false});
    document.addEventListener('touchend', stopDrag);
}

function drag(e) {
    if (!isDragging) return;
    e.preventDefault();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - offsetX;
    const y = (e.touches ? e.touches[0].clientY : e.clientY) - offsetY;

    const maxX = window.innerWidth - assistiveBtn.offsetWidth;
    const maxY = window.innerHeight - assistiveBtn.offsetHeight;

    assistiveBtn.style.left = Math.min(Math.max(0, x), maxX) + 'px';
    assistiveBtn.style.top = Math.min(Math.max(0, y), maxY) + 'px';
    assistiveBtn.style.right = 'auto';
    assistiveBtn.style.bottom = 'auto';
}

function stopDrag() {
    isDragging = false;
    document.removeEventListener('mousemove', drag);
    document.removeEventListener('mouseup', stopDrag);
    document.removeEventListener('touchmove', drag);
    document.removeEventListener('touchend', stopDrag);
}
