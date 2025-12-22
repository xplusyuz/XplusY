class ShoppingPlatform {
    constructor() {
        this.userId = null;
        this.currentMainCategory = null;
        this.currentSubCategory = null;
        this.mainCategories = [];
        this.subCategories = [];
        this.products = [];
        
        this.init();
    }

    async init() {
        // User ID ni olish yoki yaratish
        await this.getOrCreateUserId();
        
        // Data larni yuklash
        await this.loadCategories();
        
        // Event listener lar
        this.setupEventListeners();
        
        // UI ni ko'rsatish
        this.showApp();
    }

    async getOrCreateUserId() {
        // LocalStorage dan user ID ni tekshirish
        this.userId = localStorage.getItem('user_id');
        
        if (!this.userId) {
            // Yangi 6 xonali ID yaratish
            this.userId = Math.floor(100000 + Math.random() * 900000).toString();
            localStorage.setItem('user_id', this.userId);
            
            // Firebase ga user qo'shish
            await db.collection('users').doc(this.userId).set({
                id: this.userId,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                lastActive: firebase.firestore.FieldValue.serverTimestamp()
            });
        }
        
        // User ID ni yangilash
        document.getElementById('userBadge').textContent = `ID: ${this.userId}`;
        document.getElementById('userIdDisplay').innerHTML = 
            `<strong>Sizning ID raqamingiz:</strong><br>
             <span class="user-id">${this.userId}</span><br>
             <small>Bu ID ni saqlab qo'ying</small>`;
    }

    async loadCategories() {
        try {
            // Asosiy kategoriyalarni yuklash
            const mainSnapshot = await db.collection('mainCategories')
                .orderBy('order')
                .get();
            
            this.mainCategories = [];
            mainSnapshot.forEach(doc => {
                this.mainCategories.push({ id: doc.id, ...doc.data() });
            });

            // Sub kategoriyalarni yuklash
            const subSnapshot = await db.collection('subCategories')
                .orderBy('order')
                .get();
            
            this.subCategories = [];
            subSnapshot.forEach(doc => {
                this.subCategories.push({ id: doc.id, ...doc.data() });
            });

            // UI ni yangilash
            this.renderMainCategories();
            
            // Birinchi kategoriyani tanlash
            if (this.mainCategories.length > 0) {
                this.selectMainCategory(this.mainCategories[0].id);
            }
        } catch (error) {
            console.error('Kategoriyalarni yuklashda xatolik:', error);
        }
    }

    renderMainCategories() {
        const container = document.getElementById('mainCategories');
        container.innerHTML = '';
        
        this.mainCategories.forEach(category => {
            const chip = document.createElement('div');
            chip.className = `main-chip ${this.currentMainCategory === category.id ? 'active' : ''}`;
            chip.innerHTML = `
                <i class="${category.icon || 'fas fa-box'} me-2"></i>
                ${category.name}
            `;
            chip.onclick = () => this.selectMainCategory(category.id);
            container.appendChild(chip);
        });
    }

    async selectMainCategory(categoryId) {
        this.currentMainCategory = categoryId;
        this.currentSubCategory = null;
        
        // UI ni yangilash
        this.renderMainCategories();
        
        // Tanlangan kategoriya nomini yangilash
        const selectedCategory = this.mainCategories.find(c => c.id === categoryId);
        document.getElementById('selectedCategoryName').textContent = selectedCategory?.name || 'Barcha tovarlar';
        
        // Sub kategoriyalarni filter qilish
        const filteredSubs = this.subCategories.filter(sub => sub.mainCategoryId === categoryId);
        this.renderSubCategories(filteredSubs);
        
        // Tovarlarni yuklash
        await this.loadProducts(categoryId);
    }

    renderSubCategories(subs) {
        const container = document.getElementById('subCategories');
        container.innerHTML = '';
        
        // Barchasi chipi
        const allChip = document.createElement('div');
        allChip.className = `sub-chip ${!this.currentSubCategory ? 'active' : ''}`;
        allChip.innerHTML = '<i class="fas fa-border-all me-2"></i>Barchasi';
        allChip.onclick = () => this.selectSubCategory(null);
        container.appendChild(allChip);
        
        // Sub kategoriya chip lar
        subs.forEach(sub => {
            const chip = document.createElement('div');
            chip.className = `sub-chip ${this.currentSubCategory === sub.id ? 'active' : ''}`;
            chip.innerHTML = `
                <i class="${sub.icon || 'fas fa-tag'} me-2"></i>
                ${sub.name}
            `;
            chip.onclick = () => this.selectSubCategory(sub.id);
            container.appendChild(chip);
        });
        
        // Sub kategoriya soni
        document.getElementById('subCategoryCount').textContent = `${subs.length} ta`;
    }

    async selectSubCategory(subCategoryId) {
        this.currentSubCategory = subCategoryId;
        
        // UI ni yangilash
        const container = document.getElementById('subCategories');
        const chips = container.querySelectorAll('.sub-chip');
        chips.forEach(chip => chip.classList.remove('active'));
        
        if (subCategoryId) {
            const targetChip = Array.from(chips).find(chip => 
                chip.onclick && chip.onclick.name === 'selectSubCategory' &&
                chip.getAttribute('data-id') === subCategoryId
            );
            if (targetChip) targetChip.classList.add('active');
        } else {
            chips[0].classList.add('active');
        }
        
        // Tovarlarni filter qilish
        await this.loadProducts(this.currentMainCategory, subCategoryId);
    }

    async loadProducts(mainCategoryId, subCategoryId = null) {
        try {
            let query = db.collection('products')
                .where('mainCategoryId', '==', mainCategoryId)
                .where('active', '==', true);
            
            if (subCategoryId) {
                query = query.where('subCategoryId', '==', subCategoryId);
            }
            
            const snapshot = await query.orderBy('createdAt', 'desc').get();
            this.products = [];
            snapshot.forEach(doc => {
                this.products.push({ id: doc.id, ...doc.data() });
            });
            
            this.renderProducts();
        } catch (error) {
            console.error('Tovarlarni yuklashda xatolik:', error);
        }
    }

    renderProducts() {
        const container = document.getElementById('productsGrid');
        container.innerHTML = '';
        
        if (this.products.length === 0) {
            container.innerHTML = `
                <div class="col-12 text-center py-5">
                    <i class="fas fa-box-open fa-3x text-muted mb-3"></i>
                    <h5 class="text-muted">Hozircha tovarlar mavjud emas</h5>
                </div>
            `;
            return;
        }
        
        this.products.forEach(product => {
            const col = document.createElement('div');
            col.className = 'col-6 col-md-4 mb-3';
            col.innerHTML = `
                <div class="product-card" onclick="platform.showProductModal('${product.id}')">
                    <div class="product-image">
                        <img src="${product.imageUrl || 'https://via.placeholder.com/300x200'}" 
                             alt="${product.name}" class="img-fluid">
                    </div>
                    <div class="product-info p-2">
                        <h6 class="product-title">${product.name}</h6>
                        <p class="product-price text-primary fw-bold">${product.price} so'm</p>
                        <div class="product-badges">
                            <span class="badge bg-secondary">${product.categoryName}</span>
                        </div>
                    </div>
                </div>
            `;
            container.appendChild(col);
        });
    }

    async showProductModal(productId) {
        const product = this.products.find(p => p.id === productId);
        if (!product) return;
        
        document.getElementById('productModalTitle').textContent = product.name;
        document.getElementById('productModalDescription').textContent = product.description || 'Tavsif mavjud emas';
        document.getElementById('productModalPrice').textContent = `${product.price} so'm`;
        document.getElementById('productModalCategory').textContent = product.categoryName;
        document.getElementById('productModalImage').src = product.imageUrl || 'https://via.placeholder.com/300x200';
        
        const modal = new bootstrap.Modal(document.getElementById('productModal'));
        modal.show();
    }

    setupEventListeners() {
        // Refresh tugmasi
        document.getElementById('refreshBtn').onclick = () => {
            this.loadCategories();
        };
        
        // Buyurtma qilish tugmasi
        document.getElementById('orderBtn').onclick = () => {
            this.createOrder();
        };
    }

    async createOrder() {
        const modalTitle = document.getElementById('productModalTitle').textContent;
        
        try {
            await db.collection('orders').add({
                userId: this.userId,
                productName: modalTitle,
                status: 'yangi',
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            alert('Buyurtmangiz qabul qilindi!');
            bootstrap.Modal.getInstance(document.getElementById('productModal')).hide();
        } catch (error) {
            console.error('Buyurtma yaratishda xatolik:', error);
            alert('Xatolik yuz berdi, qayta urinib ko\'ring.');
        }
    }

    showApp() {
        document.getElementById('loadingScreen').style.display = 'none';
        document.getElementById('mainApp').classList.remove('d-none');
    }
}

// Platformani ishga tushirish
let platform;
window.onload = () => {
    platform = new ShoppingPlatform();
};