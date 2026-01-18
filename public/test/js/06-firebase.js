// ==================== FIREBASE MANAGER ====================
        const firebaseManager = {
            // Users/{loginId}.points ga ball qo'shish (transaction: Rules bilan ham ishlaydi)
            async addUserPoints(delta) {
                try {
                    if (!CONFIG.useFirebase || !appState.firebaseAvailable || !appState.db) return false;
                    if (!appState.currentStudent) return false;

                    const userId = appState.currentStudent.id || appState.currentStudent.loginId;
                    if (!userId) return false;

                    const userRef = appState.db.collection('users').doc(String(userId));

                    // points odatda butun son; Rules ham ko'pincha int talab qiladi.
                    const add = Math.round(Number(delta) || 0);
                    if (!add) return true;

                    await appState.db.runTransaction(async (tx) => {
                        const snap = await tx.get(userRef);
                        const oldPoints = (snap.exists && typeof snap.data().points === 'number') ? snap.data().points : 0;
                        const newPoints = Math.round(Number(oldPoints) || 0) + add;
                        tx.set(userRef, { points: newPoints }, { merge: true });
                    });
                    return true;
                } catch (e) {
                    console.warn('Points yozishda xato:', e);
                    return false;
                }
            },

            async initialize() {
                try {
                    if (!CONFIG.useFirebase) {
                        console.log("Firebase o'chirilgan");
                        appState.firebaseAvailable = false;
                        return false;
                    }
                    
                    if (!firebase.apps.length) {
                        firebase.initializeApp(FIREBASE_CONFIG);
                    }
                    appState.db = firebase.firestore();
                    
                    appState.db.settings({
                        cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED
                    });
                    
                    console.log("Firestore muvaffaqiyatli ishga tushdi");
                    appState.firebaseAvailable = true;
                    return true;
                } catch (error) {
                    console.error("Firestore ishga tushirishda xato:", error);
                    appState.firebaseAvailable = false;
                    
                    if (CONFIG.fallbackToJSON) {
                        console.log("Firebaseda xatolik. JSON fayllardan foydalanamiz.");
                        return true;
                    }
                    
                    return false;
                }
            },
            
            async loadTest(code) {
                try {
                    if (!appState.firebaseAvailable || !appState.db) {
                        return null;
                    }
                    
                    const testDoc = await appState.db.collection('testlar').doc(code).get({
                        source: 'server'
                    });
                    
                    if (!testDoc.exists) return null;
                    return testDoc.data();
                } catch (error) {
                    console.error('Firestore test yuklashda xato:', error);
                    return null;
                }
            },
            
            async loadClasses() {
                try {
                    if (!appState.firebaseAvailable || !appState.db) {
                        return await utils.loadJSON('classes.json');
                    }
                    
                    const sinflarSnapshot = await appState.db.collection('sinflar').get();
                    
                    if (!sinflarSnapshot.empty) {
                        appState.classes = [];
                        sinflarSnapshot.forEach(doc => {
                            appState.classes.push({
                                id: doc.id,
                                name: doc.data().name || doc.id,
                                ...doc.data()
                            });
                        });
                    } else {
                        const sinfDoc = await appState.db.collection('davomat').doc('sinf').get();
                        if (sinfDoc.exists) {
                            appState.classes = sinfDoc.data().classes || [];
                        }
                    }
                    
                    return appState.classes;
                } catch (error) {
                    console.error('Sinf ma\'lumotlarini yuklashda xato:', error);
                    return await utils.loadJSON('classes.json');
                }
            },
            
            async loadStudents(className) {
                try {
                    const classObj = appState.classes.find(c => c.id === className || c.name === className);
                    if (!classObj) return [];
                    
                    if (classObj.students && Array.isArray(classObj.students)) {
                        return classObj.students.map((student, index) => ({
                            id: student.id || `student_${index}`,
                            fullName: student.fullName || student.fullname || `O'quvchi ${index + 1}`
                        }));
                    }
                    
                    try {
                        const studentsSnapshot = await appState.db.collection('sinflar')
                            .doc(classObj.id)
                            .collection('o_quvchilar')
                            .get();
                        
                        if (!studentsSnapshot.empty) {
                            const students = [];
                            studentsSnapshot.forEach(doc => {
                                students.push({
                                    id: doc.id,
                                    fullName: doc.data().fullName || doc.data().name || `O'quvchi ${doc.id}`,
                                    ...doc.data()
                                });
                            });
                            return students;
                        }
                    } catch (collectionError) {
                        console.warn('Collection dan yuklashda xato:', collectionError);
                    }
                    
                    return [];
                } catch (error) {
                    console.error('O\'quvchilarni yuklashda xato:', error);
                    return [];
                }
            },
            
            async saveTestResult(results) {
                if (!appState.currentStudent || !appState.currentTestCode) {
                    return false;
                }

                // Test turi: default challenge (orqaga moslik)
                const modeRaw = (appState.testData && (appState.testData.mode || appState.testData.type))
                    ? (appState.testData.mode || appState.testData.type)
                    : null;
                const isChallenge = ((modeRaw || 'challenge') + '').toLowerCase() === 'challenge';
                
                const nowIso = new Date().toISOString();

                // Eslatma: localStorage'ga ham saqlab qo'yamiz (offline/diagnostika uchun)
                const testResult = {
                    studentId: appState.currentStudent.id,
                    studentName: appState.currentStudent.fullName,
                    studentClass: appState.currentClass,
                    testCode: appState.currentTestCode,
                    testTitle: appState.testData?.title || 'Test',
                    mode: isChallenge ? 'challenge' : 'open',
                    score: results.finalScore,
                    totalScore: results.totalScore,
                    correctAnswers: results.correctCount,
                    wrongAnswers: results.wrongCount,
                    totalQuestions: appState.testData?.questions?.length || 0,
                    timeSpent: appState.timeSpent,
                    violations: appState.violations,
                    // Katta maydonlar resurs yeb qo'yadi: faqat challenge + kerak bo'lsa yozamiz
                    userAnswers: (isChallenge && CONFIG.storeFullResultForChallenge) ? (appState.userAnswers || {}) : undefined,
                    userActions: (isChallenge && CONFIG.logUserActions) ? (appState.userActions || []) : undefined,
                    detailedResults: (isChallenge && CONFIG.storeFullResultForChallenge) ? (results.detailedResults || []) : undefined,
                    sectionScores: (isChallenge && CONFIG.storeFullResultForChallenge) ? (results.sectionScores || {}) : undefined,
                    penalty: results.penalty || 0,
                    completedAt: nowIso
                };

                const userId = appState.currentStudent.id || appState.currentStudent.loginId;
                const code = appState.currentTestCode;
                const pointsToAdd = Math.round(Number(results.finalScore) || 0);

                // Telegramga yuborish (open mode) - token/clientga chiqmaydi: netlify function orqali
                const notifyTelegramOpen = async (payload) => {
                    try {
                        if (!CONFIG.telegramNotifyOpen) return;
                        const url = CONFIG.telegramEndpoint || '/.netlify/functions/notify-open';
                        await fetch(url, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(payload)
                        });
                    } catch (e) {
                        console.warn('Telegram notify xato:', e);
                    }
                };
                
                try {
                    if (CONFIG.useFirebase && appState.firebaseAvailable && appState.db) {
                        // ====== OPEN MODE: natija Firestore'ga yozilmaydi, Telegramga yuboriladi ======
                        if (!isChallenge) {
                            // 1) Points faqat 1-urinishda qo'shilsin (resurs + adolat)
                            //    Buni serverda ishonchli qilish uchun "open_awards/{code}__{uid}" doc ishlatamiz.
                            let pointsAdded = false;
                            if (pointsToAdd) {
                                const awardId = `${code}__${userId}`;
                                const awardRef = appState.db.collection('open_awards').doc(String(awardId));
                                const userRef = appState.db.collection('users').doc(String(userId));

                                await appState.db.runTransaction(async (tx) => {
                                    const awardSnap = await tx.get(awardRef);
                                    if (awardSnap.exists) {
                                        pointsAdded = false;
                                        return;
                                    }
                                    // 1-urinish: award yaratamiz + points qo'shamiz
                                    const userSnap = await tx.get(userRef);
                                    const oldPoints = (userSnap.exists && typeof userSnap.data().points === 'number') ? userSnap.data().points : 0;
                                    const newPoints = Math.round(Number(oldPoints) || 0) + pointsToAdd;
                                    tx.set(userRef, { points: newPoints }, { merge: true });
                                    tx.create(awardRef, {
                                        uid: String(userId),
                                        testCode: String(code),
                                        score: pointsToAdd,
                                        createdAt: nowIso
                                    });
                                    pointsAdded = true;
                                });
                            }

                            // 2) Telegramga har safar yuboramiz (points qo'shildimi - ham ko'rsatamiz)
                            await notifyTelegramOpen({
                                ...testResult,
                                pointsAdded,
                                pointsAddedAmount: pointsAdded ? pointsToAdd : 0
                            });

                            const localStorageKey = `test_attempt_${code}_${userId}`;
                            localStorage.setItem(localStorageKey, JSON.stringify(testResult));
                            return true;
                        }

                        // ====== CHALLENGE MODE: Firestore'ga minimal natija + reyting ======
                        // Yagona urinish: doc id deterministik, transaction ichida "create" qilamiz.
                        const resultId = `${code}__${userId}`;
                        const resultRef = appState.db.collection('test_results').doc(String(resultId));
                        const userRef = appState.db.collection('users').doc(String(userId));

                        await appState.db.runTransaction(async (tx) => {
                            const existing = await tx.get(resultRef);
                            if (existing.exists && CONFIG.singleAttempt) {
                                throw new Error('ALREADY_SUBMITTED');
                            }
                            // Natija (minimal)
                            const minimal = {
                                studentId: String(userId),
                                studentName: String(appState.currentStudent.fullName || ''),
                                studentClass: String(appState.currentClass || ''),
                                testCode: String(code),
                                testTitle: String(appState.testData?.title || 'Test'),
                                mode: 'challenge',
                                score: Number(results.finalScore) || 0,
                                totalScore: Number(results.totalScore) || 0,
                                correctAnswers: Number(results.correctCount) || 0,
                                wrongAnswers: Number(results.wrongCount) || 0,
                                totalQuestions: Number(appState.testData?.questions?.length || 0),
                                timeSpent: Number(appState.timeSpent) || 0,
                                violations: Number(appState.violations) || 0,
                                penalty: Number(results.penalty) || 0,
                                completedAt: nowIso
                            };

                            // Agar to'liq saqlash kerak bo'lsa
                            if (CONFIG.storeFullResultForChallenge) {
                                minimal.userAnswers = appState.userAnswers || {};
                                minimal.detailedResults = results.detailedResults || [];
                                minimal.sectionScores = results.sectionScores || {};
                            }

                            // create => duplicate bo'lsa xato beradi
                            if (existing.exists) tx.set(resultRef, minimal, { merge: true });
                            else tx.create(resultRef, minimal);

                            // Points: challengeda ham qo'shiladi (singleAttempt bo'lsa 1 marta)
                            if (pointsToAdd) {
                                const userSnap = await tx.get(userRef);
                                const oldPoints = (userSnap.exists && typeof userSnap.data().points === 'number') ? userSnap.data().points : 0;
                                const newPoints = Math.round(Number(oldPoints) || 0) + pointsToAdd;
                                tx.set(userRef, { points: newPoints }, { merge: true });
                            }
                        });

                        // (Ixtiyoriy) userActions - faqat yoqilgan bo'lsa va challengeda
                        if (CONFIG.logUserActions && Array.isArray(appState.userActions) && appState.userActions.length > 0) {
                            const batch = appState.db.batch();
                            const cap = Math.min(appState.userActions.length, 50); // resurs uchun limit
                            for (let i = 0; i < cap; i++) {
                                const action = appState.userActions[i];
                                const actionRef = appState.db.collection('user_actions').doc();
                                batch.set(actionRef, {
                                    ...action,
                                    studentId: String(userId),
                                    studentName: String(appState.currentStudent.fullName || ''),
                                    testCode: String(code),
                                    resultId: String(resultId),
                                    createdAt: nowIso
                                });
                            }
                            await batch.commit();
                        }
                    }
                    
                    const localStorageKey = `test_attempt_${appState.currentTestCode}_${appState.currentStudent.id}`;
                    localStorage.setItem(localStorageKey, JSON.stringify(testResult));
                    
                    return true;
                } catch (error) {
                    if (String(error?.message || '').includes('ALREADY_SUBMITTED')) {
                        return false;
                    }
                    console.error('Natijani saqlashda xato:', error);
                    try {
                        const localStorageKey = `test_attempt_${appState.currentTestCode}_${appState.currentStudent.id}`;
                        localStorage.setItem(localStorageKey, JSON.stringify(testResult));
                        return true;
                    } catch (e) {
                        console.error('LocalStorage ga saqlashda xato:', e);
                        return false;
                    }
                }
            }
        };
