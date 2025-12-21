// Algebra mavzusi uchun savol generatori
const algebraModule = (function() {
    // Modul nomi
    const moduleName = "algebra";
    
    // Savollar bazasi
    const questions = {
        oson: [
            {
                question: "x + 7 = 15 tenglamani yeching.",
                answer: "x = 15 - 7 = 8",
                topic: "algebra",
                sinf: [6, 7]
            },
            {
                question: "3x = 21 tenglamani yeching.",
                answer: "x = 21 ÷ 3 = 7",
                topic: "algebra",
                sinf: [6, 7]
            }
        ],
        "o'rta": [
            {
                question: "2x + 5 = 17 tenglamani yeching.",
                answer: "2x = 17 - 5 = 12<br>x = 12 ÷ 2 = 6",
                topic: "algebra",
                sinf: [7, 8]
            },
            {
                question: "Agar a = 3, b = 4 bo'lsa, 2a² - 3b ifodaning qiymatini hisoblang.",
                answer: "2×(3)² - 3×4 = 2×9 - 12 = 18 - 12 = 6",
                topic: "algebra",
                sinf: [7, 8]
            }
        ],
        qiyin: [
            {
                question: "x² - 5x + 6 = 0 kvadrat tenglamani yeching.",
                answer: "Diskriminant: D = (-5)² - 4×1×6 = 25 - 24 = 1<br>x₁ = (5 + 1)/2 = 3, x₂ = (5 - 1)/2 = 2",
                topic: "algebra",
                sinf: [9, 10]
            },
            {
                question: "y = 2x - 3 va y = -x + 6 to'g'ri chiziqlarning kesishish nuqtasini toping.",
                answer: "2x - 3 = -x + 6<br>2x + x = 6 + 3<br>3x = 9, x = 3<br>y = 2×3 - 3 = 3<br>Kesishish nuqtasi: (3, 3)",
                topic: "algebra",
                sinf: [9, 10]
            }
        ]
    };
    
    // Savol generatsiya qilish
    function generateQuestion(sinf, daraja) {
        // Daraja bo'yicha savollarni filtrlash
        let filteredQuestions = questions[daraja].filter(q => q.sinf.includes(sinf));
        
        // Agar sinf uchun savol topilmasa, barcha savollardan tanlash
        if (filteredQuestions.length === 0) {
            filteredQuestions = questions[daraja];
        }
        
        // Tasodifiy savol tanlash
        const randomIndex = Math.floor(Math.random() * filteredQuestions.length);
        return filteredQuestions[randomIndex];
    }
    
    // Savollar sonini qaytarish
    function getQuestionCount() {
        let count = 0;
        for (const daraja in questions) {
            count += questions[daraja].length;
        }
        return count;
    }
    
    // Modulni eksport qilish
    return {
        generateQuestion: generateQuestion,
        getQuestionCount: getQuestionCount,
        moduleName: moduleName
    };
})();