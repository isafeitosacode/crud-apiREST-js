document.addEventListener('DOMContentLoaded', () => {
    const GOOGLE_API_URL = 'https://www.googleapis.com/books/v1/volumes';
    const API_BASE_URL = window.API_URL; // Vem do config.js

    const toHttps = (url) => {
        if (!url) return 'https://via.placeholder.com/180x260.png?text=Sem+Capa';
        return url.replace('http://', 'https://');
    };

    // --- VARIÁVEIS DO DOM ---
    const views = document.querySelectorAll('.view');
    const menuLinks = document.querySelectorAll('.sidebar-menu .menu-link');
    const searchInput = document.getElementById('searchInput');
    const addShelfBtn = document.getElementById('add-shelf-btn');
    const shelvesList = document.getElementById('shelves-list');
    
    // Modal de Adicionar à Estante
    const addToShelfModal = document.getElementById('add-to-shelf-modal');
    const confirmAddBtn = document.getElementById('modal-confirm-add-btn');
    const cancelAddBtn = document.getElementById('modal-cancel-btn');
    const modalStatusSelect = document.getElementById('modal-status-select');

    // Modal de Alterar Status
    const changeStatusModal = document.getElementById('change-status-modal');
    const confirmStatusBtn = document.getElementById('status-modal-confirm-btn');
    const cancelStatusBtn = document.getElementById('status-modal-cancel-btn');
    const statusModalSelectUpdate = document.getElementById('status-modal-select-update');

    // --- VARIÁVEIS DE ESTADO ---
    let currentBookData = null; // Dados do livro da API do Google
    let currentBookInShelf = null; // Dados do livro na nossa estante (com status e id_associacao)
    let currentShelf = { id: null, name: null };
    const STATUS = {
        WANT_TO_READ: 'Quero Ler',
        READING: 'Lendo',
        READ: 'Lido'
    };

    // --- FUNÇÕES DE LÓGICA E CONTROLE ---

    async function handleFetchError(response) {
        if (!response.ok) {
            let errorMessage = `Erro ${response.status}: ${response.statusText}`;
            try {
                const errorData = await response.json();
                errorMessage = errorData.message || errorMessage;
            } catch (e) { /* corpo do erro não era JSON */ }
            throw new Error(errorMessage);
        }
        // Se o status for 204 (No Content), não há corpo para converter para JSON
        if (response.status === 204) {
            return null;
        }
        return response.json();
    }

    function switchView(viewId) {
        views.forEach(view => view.classList.add('hidden'));
        const targetView = document.getElementById(viewId);
        if (targetView) {
            targetView.classList.remove('hidden');
        }

        document.querySelectorAll('.menu-link.active, .shelf-link.active').forEach(link => link.classList.remove('active'));
        
        const activeLink = document.querySelector(`.menu-link[data-view="${viewId}"]`) || document.querySelector(`.shelf-link[data-shelf-id="${currentShelf.id}"]`);
        if (activeLink) {
            activeLink.classList.add('active');
        }
    }

    // --- FUNÇÕES DE INICIALIZAÇÃO E NAVEGAÇÃO ---

    menuLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const viewId = link.dataset.view;
            if (viewId === 'home-view') {
                loadHomePage();
            }
            if (viewId === 'search-view') {
                document.getElementById('searchResults').innerHTML = '<p>Busque por um livro para ver os resultados.</p>';
            }
            currentShelf = { id: null, name: null };
            switchView(viewId);
        });
    });

    document.querySelector('.sidebar-logo').addEventListener('click', (e) => {
        e.preventDefault();
        currentShelf = { id: null, name: null };
        loadHomePage();
        switchView('home-view');
    });

    async function loadHomePage() {
        const grid = document.getElementById('home-books-grid');
        grid.innerHTML = `<p>Carregando sua lista de leitura...</p>`;
        try {
            const books = await fetch(`${API_BASE_URL}/livros/status/${encodeURIComponent(STATUS.WANT_TO_READ)}`).then(handleFetchError);
            displayBooks(books, grid, { context: 'home' });
        } catch (error) {
            console.error(error);
            grid.innerHTML = `<p>Erro ao carregar sua lista de leitura.</p>`;
        }
    }

    // --- LÓGICA DAS ESTANTES (LÓGICA RESTAURADA) ---

    addShelfBtn.addEventListener('click', async () => {
        const shelfName = prompt('Digite o nome da nova estante:');
        if (shelfName && shelfName.trim() !== '') {
            try {
                await fetch(`${API_BASE_URL}/estantes`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ nome: shelfName.trim() })
                }).then(handleFetchError);
                loadShelves(); // Recarrega a lista de estantes
            } catch (error) {
                alert(`Erro ao criar estante: ${error.message}`);
            }
        }
    });

async function loadShelves() {
    try {
        const shelves = await fetch(`${API_BASE_URL}/estantes`).then(handleFetchError);
        const shelvesList = document.getElementById('shelves-list');
        shelvesList.innerHTML = '';

        // Popula a lista de estantes na barra lateral
        shelves.forEach(shelf => {
            const shelfContainer = document.createElement('div');
            shelfContainer.className = 'shelf-item-container';
            shelfContainer.innerHTML = `
                <a href="#" class="shelf-link" data-shelf-id="${shelf.id_estante}">${shelf.nome}</a>
                <div class="shelf-actions">
                    <i class="fa-solid fa-pencil edit-shelf-btn" title="Renomear"></i>
                    <i class="fa-solid fa-trash-can delete-shelf-btn" title="Excluir"></i>
                </div>
            `;
            shelvesList.appendChild(shelfContainer);
        });
        
        // Adiciona os event listeners para os elementos recém-criados
        shelvesList.querySelectorAll('.shelf-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const shelfId = link.dataset.shelfId;
                loadBooksFromShelf(shelfId, link.textContent);
            });
        });

        shelvesList.querySelectorAll('.edit-shelf-btn').forEach((btn, index) => {
            btn.addEventListener('click', () => editShelfName(shelves[index].id_estante, shelves[index].nome));
        });

        shelvesList.querySelectorAll('.delete-shelf-btn').forEach((btn, index) => {
            btn.addEventListener('click', () => deleteShelf(shelves[index].id_estante, shelves[index].nome));
        });
        
        // --- A CORREÇÃO PRINCIPAL ESTÁ AQUI ---
        // Limpa e popula o menu <select> do modal com os valores corretos
        const modalShelfSelect = document.getElementById('modal-shelf-select');
        modalShelfSelect.innerHTML = '';
        shelves.forEach(shelf => {
            // A sintaxe é: new Option(TEXTO_VISIVEL, VALOR_INTERNO);
            // O valor interno DEVE ser o ID numérico da estante para a API funcionar.
            const option = new Option(shelf.nome, shelf.id_estante); // <<< A LINHA MAIS IMPORTANTE
            modalShelfSelect.add(option);
        });

    } catch (error) {
        document.getElementById('shelves-list').innerHTML = '<li>Erro ao carregar estantes.</li>';
        console.error('Erro em loadShelves:', error);
    }
}
    
    async function editShelfName(shelfId, oldName) {
        const newName = prompt('Digite o novo nome para a estante:', oldName);
        if (newName && newName.trim() !== '' && newName !== oldName) {
            try {
                await fetch(`${API_BASE_URL}/estantes/${shelfId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ nome: newName.trim() })
                }).then(handleFetchError);
                loadShelves();
            } catch (error) {
                alert(`Erro ao renomear estante: ${error.message}`);
            }
        }
    }
    
    async function deleteShelf(shelfId, shelfName) {
        if (confirm(`Tem certeza que deseja excluir a estante "${shelfName}"? Todos os livros nela serão removidos.`)) {
            try {
                await fetch(`${API_BASE_URL}/estantes/${shelfId}`, { method: 'DELETE' }).then(handleFetchError);
                loadShelves();
                // Se a estante deletada era a que estava sendo vista, volta para a home
                if (currentShelf.id === shelfId) {
                    loadHomePage();
                    switchView('home-view');
                }
            } catch (error) {
                alert(`Erro ao excluir estante: ${error.message}`);
            }
        }
    }

    // --- LÓGICA DOS LIVROS ---

    async function loadBooksFromShelf(shelfId, shelfName) {
        currentShelf = { id: shelfId, name: shelfName };
        document.getElementById('shelf-title').textContent = shelfName;
        const shelfBooksDiv = document.getElementById('shelf-books');
        shelfBooksDiv.innerHTML = `<p>Carregando livros...</p>`;
        switchView('shelf-view');
        try {
            const books = await fetch(`${API_BASE_URL}/estantes/${shelfId}/livros`).then(handleFetchError);
            displayBooks(books, shelfBooksDiv, { context: 'shelf', shelfId });
        } catch(error) {
            shelfBooksDiv.innerHTML = `<p>Erro ao carregar livros: ${error.message}</p>`;
        }
    }

    async function removeBookFromShelf(googleBookId, shelfId) {
        if (confirm('Tem certeza que deseja remover este livro da estante?')) {
            try {
                await fetch(`${API_BASE_URL}/estantes/${shelfId}/livros/${googleBookId}`, {
                    method: 'DELETE'
                }).then(handleFetchError);
                // Recarrega a estante atual
                loadBooksFromShelf(shelfId, currentShelf.name);
            } catch (error) {
                alert(`Erro ao remover livro: ${error.message}`);
            }
        }
    }

    // --- LÓGICA DE STATUS ---
    function openChangeStatusModal(book) {
        currentBookInShelf = book;
        document.getElementById('status-modal-book-title').textContent = book.titulo;
        statusModalSelectUpdate.value = book.status;
        changeStatusModal.classList.remove('hidden');
    }

    cancelStatusBtn.addEventListener('click', () => changeStatusModal.classList.add('hidden'));

    confirmStatusBtn.addEventListener('click', async () => {
        const newStatus = statusModalSelectUpdate.value;
        if (!currentBookInShelf || !currentBookInShelf.id_associacao) return;

        try {
            await fetch(`${API_BASE_URL}/livros_estante/${currentBookInShelf.id_associacao}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
            }).then(handleFetchError);
            
            alert('Status atualizado com sucesso!');
            changeStatusModal.classList.add('hidden');

            if (document.getElementById('detail-view').classList.contains('hidden')) {
                 // Recarrega a view de lista (home ou estante)
                if (currentShelf.id) {
                    loadBooksFromShelf(currentShelf.id, currentShelf.name);
                } else {
                    loadHomePage();
                }
            } else {
                // Recarrega os detalhes do livro para mostrar o status novo
                displayBookDetails(currentBookInShelf.google_book_id || currentBookInShelf.id, {
                    ...currentBookInShelf,
                    status: newStatus
                });
            }
        } catch (error) {
            alert(`Erro ao atualizar status: ${error.message}`);
        }
    });
    
    // --- FUNÇÕES DE BUSCA E EXIBIÇÃO ---

    let searchTimeout;
    searchInput.addEventListener('keyup', (e) => {
        clearTimeout(searchTimeout);
        if (e.key === 'Enter' || searchInput.value.length > 2) {
            searchTimeout = setTimeout(() => {
                searchGoogleBooks(searchInput.value);
            }, 500); // Debounce para evitar muitas requisições
        }
    });

    async function searchGoogleBooks(query, containerId = 'searchResults') {
        const container = document.getElementById(containerId);
        container.innerHTML = '<p>Buscando...</p>';
        try {
            const response = await fetch(`${GOOGLE_API_URL}?q=${encodeURIComponent(query)}&maxResults=20`);
            const data = await response.json();
            displayBooks(data.items, container, { context: 'search' });
        } catch (error) {
            container.innerHTML = `<p>Erro na busca: ${error.message}</p>`;
        }
    }

    function displayBooks(books, container, options = { context: 'search' }) {
        container.innerHTML = '';
        if (!books || books.length === 0) {
            container.innerHTML = `<p>${options.context === 'home' ? 'Nenhum livro como "Quero Ler". Busque e adicione novos livros!' : 'Nenhum livro encontrado.'}</p>`;
            return;
        }

        books.forEach(book => {
            const googleId = book.id || book.google_book_id;
            const card = document.createElement('div');
            card.className = 'book-card';
            
            const imageUrl = toHttps(book.volumeInfo?.imageLinks?.thumbnail || book.capa_url);
            const title = book.volumeInfo?.title || book.titulo;
            
            card.innerHTML = `
                ${options.context === 'shelf' ? `<button class="remove-book-btn" title="Remover da estante">&times;</button>` : ''}
                <img src="${imageUrl}" alt="Capa de ${title}">
                <div class="book-card-overlay">
                    <h4 class="book-card-title">${title}</h4>
                </div>
            `;
            
            if (book.status) {
                const statusBadge = document.createElement('div');
                statusBadge.className = `status-badge status-${book.status.toLowerCase().replace(' ', '-')}`;
                statusBadge.textContent = book.status;
                statusBadge.title = 'Alterar status de leitura';
                statusBadge.onclick = (e) => {
                    e.stopPropagation();
                    openChangeStatusModal(book);
                };
                card.prepend(statusBadge);
            }

            const imgElement = card.querySelector('img');
            if(imgElement) {
                imgElement.addEventListener('click', () => displayBookDetails(googleId, { shelfId: options.shelfId, id_associacao: book.id_associacao, status: book.status, google_book_id: googleId }));
            }
            
            if (options.context === 'shelf') {
                const removeBtn = card.querySelector('.remove-book-btn');
                if(removeBtn) {
                   removeBtn.addEventListener('click', (e) => {
                       e.stopPropagation();
                       removeBookFromShelf(googleId, options.shelfId);
                   });
                }
            }
            container.appendChild(card);
        });
    }

    async function displayBookDetails(googleBookId, bookContext = {}) {
        const view = document.getElementById('detail-view');
        view.innerHTML = '<p>Carregando detalhes...</p>'; // Limpa a view e mostra carregando
        switchView('detail-view');
        
        try {
            // Busca os detalhes completos na API do Google
            const response = await fetch(`${GOOGLE_API_URL}/${googleBookId}`);
            currentBookData = await response.json(); // Salva os dados completos
            
            // Recarrega o HTML original da view, pois ele foi substituído pelo "Carregando..."
            view.innerHTML = `
                <div class="view-header">
                    <button id="detail-back-to-shelf-btn" class="btn-link hidden"><i class="fa-solid fa-arrow-left"></i> <span id="back-to-shelf-name">Voltar</span></button>
                </div>
                <div class="detail-content">
                    <div class="detail-left">
                        <h1 id="detail-title"></h1>
                        <p class="detail-author">Por <span id="detail-author-name"></span></p>
                        <div class="detail-status-section hidden">
                            <span>Status:</span>
                            <strong id="detail-current-status">Nenhum</strong>
                            <button id="detail-change-status-btn" class="btn-link-small"><i class="fa-solid fa-pencil"></i> Alterar</button>
                        </div>
                        <p id="detail-description"></p>
                        <div class="detail-actions">
                            <button id="detail-add-to-shelf-btn"><i class="fa-solid fa-plus"></i> Adicionar à Estante</button>
                            <button id="detail-remove-from-shelf-btn" class="btn-danger hidden"><i class="fa-solid fa-trash-can"></i> Remover da Estante</button>
                        </div>
                    </div>
                    <div class="detail-right">
                        <img id="detail-cover" src="" alt="Capa do livro">
                    </div>
                </div>
                <div class="similar-books">
                    <h2>Mais Livros Similares</h2>
                    <div id="similar-books-grid" class="book-grid"></div>
                </div>`;
            
            // Preenche os detalhes
            document.getElementById('detail-title').textContent = currentBookData.volumeInfo.title || 'Título não encontrado';
            document.getElementById('detail-author-name').textContent = currentBookData.volumeInfo.authors?.join(', ') || 'Autor desconhecido';
            document.getElementById('detail-description').innerHTML = currentBookData.volumeInfo.description || 'Descrição não disponível.';
            document.getElementById('detail-cover').src = toHttps(currentBookData.volumeInfo.imageLinks?.thumbnail);

            currentBookInShelf = bookContext;

            // Lógica para mostrar o status
            const statusSection = document.querySelector('.detail-status-section');
            if (bookContext.status) {
                document.getElementById('detail-current-status').textContent = bookContext.status;
                statusSection.classList.remove('hidden');
                document.getElementById('detail-change-status-btn').onclick = () => openChangeStatusModal(bookContext);
            } else {
                statusSection.classList.add('hidden');
            }

            // Lógica para botões de adicionar/remover
            const addBtn = document.getElementById('detail-add-to-shelf-btn');
            const removeBtn = document.getElementById('detail-remove-from-shelf-btn');
            if (bookContext.shelfId) {
                addBtn.classList.add('hidden');
                removeBtn.classList.remove('hidden');
                removeBtn.onclick = () => removeBookFromShelf(googleBookId, bookContext.shelfId);
            } else {
                addBtn.classList.remove('hidden');
                removeBtn.classList.add('hidden');
                addBtn.onclick = openAddToShelfModal;
            }

            // Botão de voltar
            const backBtn = document.getElementById('detail-back-to-shelf-btn');
            if (currentShelf.id) {
                backBtn.classList.remove('hidden');
                document.getElementById('back-to-shelf-name').textContent = `Voltar para ${currentShelf.name}`;
                backBtn.onclick = () => loadBooksFromShelf(currentShelf.id, currentShelf.name);
            } else {
                 backBtn.classList.add('hidden');
            }

            // Lógica de livros similares (opcional, busca por autor)
            if (currentBookData.volumeInfo.authors) {
                searchGoogleBooks(`inauthor:"${currentBookData.volumeInfo.authors[0]}"`, 'similar-books-grid');
            }

        } catch (error) {
            view.innerHTML = `<p>Erro ao carregar detalhes do livro: ${error.message}</p>`;
        }
    }

    // --- LÓGICA DO MODAL DE ADICIONAR LIVRO ---
    async function openAddToShelfModal() {
        await loadShelves(); 
        if (document.getElementById('modal-shelf-select').options.length === 0) {
            alert('Você precisa criar uma estante primeiro!');
            return;
        }
        document.getElementById('modal-book-title').textContent = currentBookData.volumeInfo.title;
        addToShelfModal.classList.remove('hidden');
    }
    
    cancelAddBtn.addEventListener('click', () => addToShelfModal.classList.add('hidden'));
    
    confirmAddBtn.addEventListener('click', async () => {
        const selectedShelfId = document.getElementById('modal-shelf-select').value;
        const selectedStatus = modalStatusSelect.value;
        if (!currentBookData || !selectedShelfId) return;

        const bookData = {
            google_book_id: currentBookData.id,
            titulo: currentBookData.volumeInfo.title,
            autores: currentBookData.volumeInfo.authors || [],
            capa_url: currentBookData.volumeInfo.imageLinks?.thumbnail || null,
            descricao: currentBookData.volumeInfo.description || null,
            status: selectedStatus
        };
        
        try {
            await fetch(`${API_BASE_URL}/estantes/${selectedShelfId}/livros`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bookData)
            }).then(handleFetchError);
            alert(`'${bookData.titulo}' foi adicionado com sucesso!`);
            addToShelfModal.classList.add('hidden');
            const shelfName = document.getElementById('modal-shelf-select').selectedOptions[0].text;
            loadBooksFromShelf(selectedShelfId, shelfName);
        } catch (error) {
            alert(`Erro ao adicionar livro: ${error.message}`);
        }
    });

    // --- INICIALIZAÇÃO ---
    loadShelves().then(() => {
        loadHomePage();
        switchView('home-view');
    });
});