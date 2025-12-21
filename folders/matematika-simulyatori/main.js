// Savol generatorini markaziy boshqaruvchi
document.addEventListener('DOMContentLoaded', function() {
    // DOM elementlari
    const generateBtn = document.getElementById('generate-btn');
    const showAnswerBtn = document.getElementById('show-answer-btn');
    const sinfSelect = document.getElementById('sinf');
    const mavzuSelect = document.getElementById('mavzu');
    const darajaSelect = document.getElementById('daraja');
    const questionContent = document.getElementById('question-content');
    const answerContainer = document.getElementById('answer-container');
    const answerContent = document.getElementById('answer-content');
    const mavzuBadge = document.getElementById('mavzu-badge');
    const darajaBadge = document.getElementById('daraja-badge');
    const sinfBadge = document.getElementById('sinf-badge');
    const questionCount = document.getElementById('question-count');
    const todayCount = document.getElementById('today-count');
    
    // Bugun olingan savollar soni
    let todayQuestions = localStorage.getItem('todayQuestions') || 0;
    todayCount.textContent = todayQuestions;
    
    // Mavzular va ularning yuklanganligini kuzatish
    const loadedModules = {
        arifmetika: typeof arifmetikaModule !== 'undefined',
        algebra: typeof algebraModule !== 'undefined',
        geometriya: typeof geometriyaModule !== 'undefined',
        trigonometriya: typeof trigonometriyaModule !== 'undefined'
    };
    
    // Umumiy savollar sonini hisoblash
    function calculateTotalQuestions() {
        let total = 0;
        
        if (loadedModules.arifmetika) total += arifmetikaModule.getQuestionCount();
        if (loadedModules.algebra) total += algebraModule.getQuestionCount();
        if (loadedModules.geometriya) total += geometriyaModule.getQuestionCount();
        if (loadedModules.trigonometriya) total += trigonometriyaModule.getQuestionCount();
        
        questionCount.textContent = total;
    }
    
    // Dastlabki yuklashda umumiy savollar sonini hisobla
    calculateTotalQuestions();
    
    // Mavzular ro'yxatini yangilash
    function updateMavzuOptions() {
        // Agar barcha mavzular tanlangan bo'lsa, barcha mavzulardan savol berish
        const selectedMavzu = mavzuSelect.value;
        
        // Badge ni yangilash
        if (selectedMavzu === 'barcha') {
            mavzuBadge.textContent = "Barcha mavzular";
        } else {
            mavzuBadge.textContent = selectedMavzu.charAt(0).toUpperCase() + selectedMavzu.slice(1);
        }
    }
    
    // Savol generatsiya qilish
    function generateQuestion() {
        const sinf = parseInt(sinfSelect.value);
        const mavzu = mavzuSelect.value;
        const daraja = darajaSelect.value;
        
        // Tanlangan parametrlarga mos mavzuni tanlash
        let selectedModule;
        
        if (mavzu === 'barcha') {
            // Barcha mavzulardan tasodifiy tanlash
            const availableModules = [];
            if (loadedModules.arifmetika) availableModules.push('arifmetika');
            if (loadedModules.algebra) availableModules.push('algebra');
            if (loadedModules.geometriya) availableModules.push('geometriya');
            if (loadedModules.trigonometriya) availableModules.push('trigonometriya');
            
            if (availableModules.length === 0) {
                questionContent.innerHTML = '<p style="color:red;">Hech qanday mavzu moduli yuklanmagan</p>';
                return;
            }
            
            const randomModule = availableModules[Math.floor(Math.random() * availableModules.length)];
            
            if (randomModule === 'arifmetika') selectedModule = arifmetikaModule;
            else if (randomModule === 'algebra') selectedModule = algebraModule;
            else if (randomModule === 'geometriya') selectedModule = geometriyaModule;
            else if (randomModule === 'trigonometriya') selectedModule = trigonometriyaModule;
        } else {
            // Maxsus mavzu tanlangan
            if (!loadedModules[mavzu]) {
                questionContent.innerHTML = `<p style="color:red;">${mavzu} moduli yuklanmagan</p>`;
                return;
            }
            
            if (mavzu === 'arifmetika') selectedModule = arifmetikaModule;
            else if (mavzu === 'algebra') selectedModule = algebraModule;
            else if (mavzu === 'geometriya') selectedModule = geometriyaModule;
            else if (mavzu === 'trigonometriya') selectedModule = trigonometriyaModule;
        }
        
        // Moduldan savol olish
        const questionData = selectedModule.generateQuestion(sinf, daraja);
        
        // Savolni ko'rsatish
        questionContent.innerHTML = questionData.question;
        answerContent.innerHTML = questionData.answer;
        
        // Javobni yashirish
        answerContainer.style.display = 'none';
        
        // Badgelarni yangilash
        mavzuBadge.textContent = questionData.topic.charAt(0).toUpperCase() + questionData.topic.slice(1);
        darajaBadge.textContent = daraja.charAt(0).toUpperCase() + daraja.slice(1);
        sinfBadge.textContent = `${sinf}-sinf`;
        
        // Bugun olingan savollar sonini oshirish
        todayQuestions++;
        todayCount.textContent = todayQuestions;
        localStorage.setItem('todayQuestions', todayQuestions);
    }
    
    // Javobni ko'rsatish
    function showAnswer() {
        answerContainer.style.display = 'block';
    }
    
    // Hodisa qo'shish
    generateBtn.addEventListener('click', generateQuestion);
    showAnswerBtn.addEventListener('click', showAnswer);
    mavzuSelect.addEventListener('change', updateMavzuOptions);
    
    // Dastlabki savolni yaratish
    generateQuestion();
    
    // Modullar yuklanganligini tekshirish
    console.log("Yuklangan modullar:");
    console.log("Arifmetika:", loadedModules.arifmetika);
    console.log("Algebra:", loadedModules.algebra);
    console.log("Geometriya:", loadedModules.geometriya);
    console.log("Trigonometriya:", loadedModules.trigonometriya);
});