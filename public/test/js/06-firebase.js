// ==================== FIREBASE MANAGER ====================
        const firebaseManager = {
            // Test turini aniqlash (orqaga moslik uchun default: challenge)
            getTestMode() {
                const td = appState.testData || {};
                const mode = (td.mode || td.type || '').toString().toLowerCase();
                if (mode === 'open' || mode === 'oddiy' || mode === 'simple') return 'open';
                if (mode === 'challenge' || mode === 'chelenge' || mode === 'closed') return 'challenge';
                if (td.isChallenge === true || td.challenge === true) return 'challenge';
                // Eski testlaringiz buzilmasligi uchun default challenge qoldirdik
                return 'challenge';
            },

            // Foydalanuvchining umumiy pointsini yangilash (users/{studentId}.points)
            async addUserPoints(delta, extra = {}) {
                if (!CONFIG.useFirebase || !appState.firebaseAvailable || !appState.db) return false;
                if (!appState.currentStudent?.id) return false;
                const studentId = String(appState.currentStudent.id);
                const pointsDelta = Math.max(0, Math.floor(Number(delta || 0)));
                if (!Number.isFinite(pointsDelta) || pointsDelta <= 0) return true;

                const userRef = appState.db.collection('users').doc(studentId);
                try {
                    await appState.db.runTransaction(async (tx) => {
                        const snap = await tx.get(userRef);
                        const oldPoints = snap.exists ? (snap.data().points || 0) : 0;
                        const newPoints = (Number(oldPoints) || 0) + pointsDelta;
                        if (!snap.exists) {
                            tx.set(userRef, {
                                points: newPoints,
                                // Minimal profil (agar platformada allaqachon bo'lsa, merge qiladi)
                                fullName: appState.currentStudent?.fullName || '',
                                lastPointsDelta: pointsDelta,
                                lastTestCode: appState.currentTestCode || '',
                                lastUpdatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                                ...extra
                            }, { merge: true });
                        } else {
                            tx.set(userRef, {
                                points: newPoints,
                                lastPointsDelta: pointsDelta,
                                lastTestCode: appState.currentTestCode || '',
                                lastUpdatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                                ...extra
                            }, { merge: true });
                        }
                    });
                    return true;
                } catch (e) {
                    console.error('Points yangilashda xato:', e);
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
                
                const testResult = {
                    studentId: appState.currentStudent.id,
                    studentName: appState.currentStudent.fullName,
                    studentClass: appState.currentClass,
                    testCode: appState.currentTestCode,
                    testTitle: appState.testData?.title || 'Test',
                    score: results.finalScore,
                    totalScore: results.totalScore,
                    correctAnswers: results.correctCount,
                    wrongAnswers: results.wrongCount,
                    totalQuestions: appState.testData?.questions?.length || 0,
                    timeSpent: appState.timeSpent,
                    violations: appState.violations,
                    userAnswers: appState.userAnswers,
                    userActions: CONFIG.logUserActions ? appState.userActions : [],
                    completedAt: new Date().toISOString(),
                    detailedResults: results.detailedResults || [],
                    sectionScores: results.sectionScores || {},
                    penalty: results.penalty || 0
                };
                
                try {
                    // 1) Har qanday testda points qo'shamiz (resurs tejamkor: bitta users doc)
                    await this.addUserPoints(Math.round(results.finalScore || 0), {
                        studentClass: appState.currentClass || '',
                    });

                    // 2) Faqat CHALLENGE testlarda natijani (reyting uchun) Firestore'ga yozamiz
                    const mode = this.getTestMode();
                    if (CONFIG.useFirebase && appState.firebaseAvailable && appState.db && mode === 'challenge') {
                        const resultRef = appState.db.collection('test_results').doc();
                        await resultRef.set(testResult);

                        // User actions ham faqat challenge'larda (write kamayadi)
                        if (CONFIG.logUserActions && appState.userActions.length > 0) {
                            const batch = appState.db.batch();
                            appState.userActions.forEach((action) => {
                                const actionRef = appState.db.collection('user_actions').doc();
                                batch.set(actionRef, {
                                    ...action,
                                    studentId: appState.currentStudent.id,
                                    studentName: appState.currentStudent.fullName,
                                    testCode: appState.currentTestCode,
                                    resultId: resultRef.id
                                });
                            });
                            await batch.commit();
                        }
                    }
                    
                    const localStorageKey = `test_attempt_${appState.currentTestCode}_${appState.currentStudent.id}`;
                    localStorage.setItem(localStorageKey, JSON.stringify(testResult));
                    
                    return true;
                } catch (error) {
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
