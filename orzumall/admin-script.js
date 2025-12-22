class AdminPanel {
    constructor() {
        this.db = firebase.firestore();
        this.storage = firebase.storage();
        this.init();
    }

    async init() {
        await this.loadAllData();
        this.setupEventListeners();
    }

    async loadAllData() {
        await this.loadMainCategories();
        await this.loadSubCategories();
        await this.loadProducts();
        await this.loadOrders();
        await this.loadUsers();
    }

    async loadMainCategories() {
        try {
            const snapshot = await this.db.collection('mainCategories')
                .orderBy('order')
                .get();
            
            const container = document.getElementById('mainCategoriesList');
            container.innerHTML = '';
            
            snapshot.forEach(doc => {
                const category = { id: doc.id, ...doc.data() };
                const col = document.createElement('div');
                col.className = 'col-md-6 mb-3';
                col.innerHTML = `
                    <div class="card">
                        <div class="card-body">
                            <div class="d-flex justify-content-between align-items-center">
                                <div>
                                    <h6 class="mb-0">
                                        <i class="${category.icon || 'fas fa-tag'} me-2"></i>
                                        ${category.name}
                                    </h6>
                                    <small class="text-muted">ID: ${category.id}</small>
                                </div>
                                <button class="btn btn-sm btn-danger" onclick="admin.deleteCategory('${doc.id}', 'main')">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                `;
                container.appendChild(col);
            });
            
            // Main category select optionlarini yangilash
            await this.populateMainCategorySelect();
        } catch (error) {
            console.error('Asosiy kategoriyalarni yuklashda xatolik:', error);
        }
    }

    async loadSubCategories() {
        try {
            const snapshot = await this.db.collection('subCategories')
                .orderBy('order')
                .get();
            
            const container = document.getElementById('subCategoriesList');
            container.innerHTML = '';
            
            // Main kategoriyalar ma'lumotlarini olish
            const mainCategories = {};
            const mainSnapshot = await this.db.collection('mainCategories').get();
            mainSnapshot.forEach(doc => {
                mainCategories[doc.id] = doc.data().name;
            });
            
            snapshot.forEach(doc => {
                const category = { id: doc.id, ...doc.data() };
                const mainCategoryName = mainCategories[category.mainCategoryId] || 'Noma\'lum';
                
                const col = document.createElement('div');
                col.className = 'col-md-6 mb-3';
                col.innerHTML = `
                    <div class="card">
                        <div class="card-body">
                            <div class="d-flex justify-content-between align-items-center">
                                <div>
                                    <h6 class="mb-0">
                                        <i class="${category.icon || 'fas fa-tag'} me-2"></i>
                                        ${category.name}
                                    </h6>
                                    <small class="text-muted">
                                        Asosiy kategoriya: ${mainCategoryName}<br>
                                        ID: ${category.id}
                                    </small>
                                </div>
                                <button class="btn btn-sm btn-danger" onclick="admin.deleteCategory('${doc.id}', 'sub')">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                `;
                container.appendChild(col);
            });
        } catch (error) {
            console.error('Pastki kategoriyalarni yuklashda xatolik:', error);
        }
    }

    async loadProducts() {
        try {
            const snapshot = await this.db.collection('products')
                .orderBy('createdAt', 'desc')
                .get();
            
            const container = document.getElementById('productsList');
            container.innerHTML = '';
            
            // Kategoriya ma'lumotlarini olish
            const categories = {};
            const subCategories = {};
            
            const mainSnapshot = await this.db.collection('mainCategories').get();
            mainSnapshot.forEach(doc => {
                categories[doc.id] = doc.data().name;
            });
            
            const subSnapshot = await this.db.collection('subCategories').get();
            subSnapshot.forEach(doc => {
                subCategories[doc.id] = doc.data().name;
            });
            
            snapshot.forEach(doc => {
                const product = { id: doc.id, ...doc.data() };
                const mainCategoryName = categories[product.mainCategoryId] || 'Noma\'lum';
                const subCategoryName = subCategories[product.subCategoryId] || 'Noma\'lum';
                
                const col = document.createElement('div');
                col.className = 'col-md-4 mb-3';
                col.innerHTML = `
                    <div class="card h-100">
                        <img src="${product.imageUrl || 'https://via.placeholder.com/300x200'}" 
                             class="card-img-top" alt="${product.name}">
                        <div class="card-body">
                            <h6 class="card-title">${product.name}</h6>
                            <p class="card-text text-primary fw-bold">${product.price} so'm</p>
                            <small class="text-muted d-block">
                                ${mainCategoryName} → ${subCategoryName}
                            </small>
                            <div class="mt-2">
                                <button class="btn btn-sm btn-danger" onclick="admin.deleteProduct('${doc.id}')">
                                    <i class="fas fa-trash"></i> O'chirish
                                </button>
                                <span class="badge ${product.active ? 'bg-success' : 'bg-secondary'} ms-2">
                                    ${product.active ? 'Faol' : 'Nofaol'}
                                </span>
                            </div>
                        </div>
                    </div>
                `;
                container.appendChild(col);
            });
        } catch (error) {
            console.error('Tovarlarni yuklashda xatolik:', error);
        }
    }

    async loadOrders() {
        try {
            const snapshot = await this.db.collection('orders')
                .orderBy('createdAt', 'desc')
                .get();
            
            const container = document.getElementById('ordersList');
            container.innerHTML = '';
            
            if (snapshot.empty) {
                container.innerHTML = '<p class="text-muted">Hozircha buyurtmalar yo\'q</p>';
                return;
            }
            
            const ordersTable = document.createElement('table');
            ordersTable.className = 'table table-striped';
            ordersTable.innerHTML = `
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Foydalanuvchi ID</th>
                        <th>Mahsulot</th>
                        <th>Holati</th>
                        <th>Sana</th>
                        <th>Amallar</th>
                    </tr>
                </thead>
                <tbody id="ordersTableBody"></tbody>
            `;
            container.appendChild(ordersTable);
            
            const tbody = document.getElementById('ordersTableBody');
            snapshot.forEach(doc => {
                const order = { id: doc.id, ...doc.data() };
                const date = order.createdAt ? order.createdAt.toDate().toLocaleDateString('uz-UZ') : '-';
                
                const row = tbody.insertRow();
                row.innerHTML = `
                    <td>${order.id.substring(0, 8)}...</td>
                    <td>${order.userId}</td>
                    <td>${order.productName}</td>
                    <td>
                        <select class="form-select form-select-sm" onchange="admin.updateOrderStatus('${doc.id}', this.value)">
                            <option value="yangi" ${order.status === 'yangi' ? 'selected' : ''}>Yangi</option>
                            <option value="qabul" ${order.status === 'qabul' ? 'selected' : ''}>Qabul qilindi</option>
                            <option value="yetkazilmoqda" ${order.status === 'yetkazilmoqda' ? 'selected' : ''}>Yetkazilmoqda</option>
                            <option value="yetkazildi" ${order.status === 'yetkazildi' ? 'selected' : ''}>Yetkazildi</option>
                            <option value="bekor" ${order.status === 'bekor' ? 'selected' : ''}>Bekor qilindi</option>
                        </select>
                    </td>
                    <td>${date}</td>
                    <td>
                        <button class="btn btn-sm btn-danger" onclick="admin.deleteOrder('${doc.id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                `;
            });
        } catch (error) {
            console.error('Buyurtmalarni yuklashda xatolik:', error);
        }
    }

    async loadUsers() {
        try {
            const snapshot = await this.db.collection('users')
                .orderBy('createdAt', 'desc')
                .limit(50)
                .get();
            
            const container = document.getElementById('usersList');
            container.innerHTML = '';
            
            if (snapshot.empty) {
                container.innerHTML = '<p class="text-muted">Foydalanuvchilar yo\'q</p>';
                return;
            }
            
            const usersTable = document.createElement('table');
            usersTable.className = 'table table-striped';
            usersTable.innerHTML = `
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Yaratilgan sana</th>
                        <th>Oxirgi faollik</th>
                    </tr>
                </thead>
                <tbody id="usersTableBody"></tbody>
            `;
            container.appendChild(usersTable);
            
            const tbody = document.getElementById('usersTableBody');
            snapshot.forEach(doc => {
                const user = doc.data();
                const createdDate = user.createdAt ? user.createdAt.toDate().toLocaleDateString('uz-UZ') : '-';
                const lastActiveDate = user.lastActive ? user.lastActive.toDate().toLocaleDateString('uz-UZ') : '-';
                
                const row = tbody.insertRow();
                row.innerHTML = `
                    <td>${user.id}</td>
                    <td>${createdDate}</td>
                    <td>${lastActiveDate}</td>
                `;
            });
        } catch (error) {
            console.error('Foydalanuvchilarni yuklashda xatolik:', error);
        }
    }

    async populateMainCategorySelect() {
        try {
            const mainSelect = document.getElementById('mainCategorySelect');
            const productMainSelect = document.getElementById('productMainCategory');
            
            // Selectlarni tozalash
            mainSelect.innerHTML = '';
            productMainSelect.innerHTML = '<option value="">Tanlang...</option>';
            
            const snapshot = await this.db.collection('mainCategories')
                .orderBy('order')
                .get();
            
            snapshot.forEach(doc => {
                const category = doc.data();
                const option = document.createElement('option');
                option.value = doc.id;
                option.textContent = category.name;
                
                const option2 = option.cloneNode(true);
                
                mainSelect.appendChild(option);
                productMainSelect.appendChild(option2);
            });
        } catch (error) {
            console.error('Main category select ni to\'ldirishda xatolik:', error);
        }
    }

    async saveCategory() {
        try {
            const type = document.getElementById('categoryType').value;
            const name = document.getElementById('categoryName').value;
            const icon = document.getElementById('categoryIcon').value;
            const order = parseInt(document.getElementById('categoryOrder').value) || 0;
            
            if (!name.trim()) {
                alert('Kategoriya nomini kiriting!');
                return;
            }
            
            const categoryData = {
                name: name.trim(),
                icon: icon.trim() || 'fas fa-tag',
                order: order,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            if (type === 'sub') {
                const mainCategoryId = document.getElementById('mainCategorySelect').value;
                if (!mainCategoryId) {
                    alert('Asosiy kategoriyani tanlang!');
                    return;
                }
                categoryData.mainCategoryId = mainCategoryId;
                
                await this.db.collection('subCategories').add(categoryData);
            } else {
                await this.db.collection('mainCategories').add(categoryData);
            }
            
            // Modalni yopish va formani tozalash
            document.getElementById('categoryForm').reset();
            bootstrap.Modal.getInstance(document.getElementById('addCategoryModal')).hide();
            
            // Ma'lumotlarni yangilash
            await this.loadAllData();
            
            alert('Kategoriya muvaffaqiyatli saqlandi!');
        } catch (error) {
            console.error('Kategoriyani saqlashda xatolik:', error);
            alert('Xatolik yuz berdi: ' + error.message);
        }
    }

    async saveProduct() {
        try {
            const name = document.getElementById('productName').value;
            const price = document.getElementById('productPrice').value;
            const mainCategoryId = document.getElementById('productMainCategory').value;
            const subCategoryId = document.getElementById('productSubCategory').value;
            const description = document.getElementById('productDescription').value;
            const imageUrl = document.getElementById('productImageUrl').value;
            const imageFile = document.getElementById('productImageFile').files[0];
            
            if (!name || !price || !mainCategoryId || !subCategoryId) {
                alert('Barcha majburiy maydonlarni to\'ldiring!');
                return;
            }
            
            let finalImageUrl = imageUrl;
            
            // Agar fayl yuklansa
            if (imageFile) {
                finalImageUrl = await this.uploadImage(imageFile);
            }
            
            const productData = {
                name: name.trim(),
                price: parseInt(price),
                mainCategoryId: mainCategoryId,
                subCategoryId: subCategoryId,
                description: description.trim(),
                imageUrl: finalImageUrl || 'https://via.placeholder.com/300x200',
                active: true,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            await this.db.collection('products').add(productData);
            
            // Modalni yopish va formani tozalash
            document.getElementById('productForm').reset();
            document.getElementById('imagePreview').innerHTML = '';
            bootstrap.Modal.getInstance(document.getElementById('addProductModal')).hide();
            
            // Ma'lumotlarni yangilash
            await this.loadAllData();
            
            alert('Tovar muvaffaqiyatli saqlandi!');
        } catch (error) {
            console.error('Tovarni saqlashda xatolik:', error);
            alert('Xatolik yuz berdi: ' + error.message);
        }
    }

    async uploadImage(file) {
        try {
            const storageRef = this.storage.ref();
            const fileRef = storageRef.child(`products/${Date.now()}_${file.name}`);
            await fileRef.put(file);
            return await fileRef.getDownloadURL();
        } catch (error) {
            console.error('Rasm yuklashda xatolik:', error);
            throw error;
        }
    }

    async deleteCategory(id, type) {
        if (!confirm('Rostdan ham o\'chirmoqchimisiz?')) return;
        
        try {
            if (type === 'main') {
                // Pastki kategoriyalarni ham o'chirish
                const subCategories = await this.db.collection('subCategories')
                    .where('mainCategoryId', '==', id)
                    .get();
                
                const batch = this.db.batch();
                subCategories.forEach(doc => {
                    batch.delete(doc.ref);
                });
                batch.delete(this.db.collection('mainCategories').doc(id));
                await batch.commit();
            } else {
                await this.db.collection('subCategories').doc(id).delete();
            }
            
            await this.loadAllData();
            alert('Muvaffaqiyatli o\'chirildi!');
        } catch (error) {
            console.error('Kategoriyani o\'chirishda xatolik:', error);
            alert('Xatolik yuz berdi: ' + error.message);
        }
    }

    async deleteProduct(id) {
        if (!confirm('Rostdan ham o\'chirmoqchimisiz?')) return;
        
        try {
            await this.db.collection('products').doc(id).delete();
            await this.loadAllData();
            alert('Muvaffaqiyatli o\'chirildi!');
        } catch (error) {
            console.error('Tovarni o\'chirishda xatolik:', error);
            alert('Xatolik yuz berdi: ' + error.message);
        }
    }

    async deleteOrder(id) {
        if (!confirm('Rostdan ham o\'chirmoqchimisiz?')) return;
        
        try {
            await this.db.collection('orders').doc(id).delete();
            await this.loadOrders();
            alert('Muvaffaqiyatli o\'chirildi!');
        } catch (error) {
            console.error('Buyurtmani o\'chirishda xatolik:', error);
            alert('Xatolik yuz berdi: ' + error.message);
        }
    }

    async updateOrderStatus(orderId, status) {
        try {
            await this.db.collection('orders').doc(orderId).update({
                status: status,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        } catch (error) {
            console.error('Buyurtma holatini yangilashda xatolik:', error);
            alert('Xatolik yuz berdi: ' + error.message);
        }
    }

    async loadSubCategories() {
        try {
            const mainCategoryId = document.getElementById('productMainCategory').value;
            if (!mainCategoryId) return;
            
            const snapshot = await this.db.collection('subCategories')
                .where('mainCategoryId', '==', mainCategoryId)
                .orderBy('order')
                .get();
            
            const select = document.getElementById('productSubCategory');
            select.innerHTML = '<option value="">Tanlang...</option>';
            
            snapshot.forEach(doc => {
                const option = document.createElement('option');
                option.value = doc.id;
                option.textContent = doc.data().name;
                select.appendChild(option);
            });
        } catch (error) {
            console.error('Pastki kategoriyalarni yuklashda xatolik:', error);
        }
    }

    setupEventListeners() {
        // Hech qanday maxsus event listener kerak emas, chunki barchasi inline functionlar orqali boshqariladi
    }
}

// Global functionlar
function showSection(sectionId) {
    // Barcha sectionlarni yashirish
    document.querySelectorAll('.section').forEach(section => {
        section.classList.add('d-none');
    });
    
    // Tanlangan sectionni ko'rsatish
    document.getElementById(sectionId + 'Section').classList.remove('d-none');
    
    // Menu aktivligini yangilash
    document.querySelectorAll('.list-group-item').forEach(item => {
        item.classList.remove('active');
    });
    event.target.classList.add('active');
}

function toggleCategoryFields() {
    const type = document.getElementById('categoryType').value;
    document.getElementById('mainCategoryField').style.display = 
        type === 'sub' ? 'block' : 'none';
}

function previewImage() {
    const file = document.getElementById('productImageFile').files[0];
    const preview = document.getElementById('imagePreview');
    
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            preview.innerHTML = `
                <img src="${e.target.result}" class="img-fluid rounded" style="max-height: 200px;">
                <small class="text-muted d-block mt-1">${file.name}</small>
            `;
        };
        reader.readAsDataURL(file);
    } else {
        preview.innerHTML = '';
    }
}

// Admin panelni ishga tushirish
let admin;
window.onload = () => {
    admin = new AdminPanel();
};