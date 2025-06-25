

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./db/knex.js');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

/*
|--------------------------------------------------------------------------
| Rotas para gerenciar ESTANTES
|--------------------------------------------------------------------------
*/

// ROTA PARA LISTAR TODAS AS ESTANTES
app.get('/api/estantes', async (req, res) => {
    try {
        const estantes = await db('Estantes').select('*').orderBy('nome', 'asc'); // <<< CORREÇÃO AQUI (nome da coluna)
        res.json(estantes);
    } catch (error) {
        console.error("Erro ao listar estantes:", error);
        res.status(500).json({ message: "Erro interno do servidor." });
    }
});

// ROTA PARA CRIAR UMA NOVA ESTANTE
app.post('/api/estantes', async (req, res) => {
    try {
        const { nome } = req.body; // <<< CORREÇÃO AQUI (nome do campo)
        if (!nome || nome.trim() === '') {
            return res.status(400).json({ message: "O nome da estante é obrigatório." });
        }
        
        const [estanteAdicionada] = await db('Estantes')
            .insert({ nome: nome.trim() }) // <<< CORREÇÃO AQUI (nome da coluna)
            .returning('*');

        res.status(201).json(estanteAdicionada);

    } catch (error) {
        if (error.code === '23505') {
            return res.status(409).json({ message: "Uma estante com este nome já existe." });
        }
        console.error("Erro ao criar estante:", error);
        res.status(500).json({ message: "Erro interno do servidor." });
    }
});

// ROTA PARA ATUALIZAR NOME DA ESTANTE
app.patch('/api/estantes/:id', async (req, res) => { // <<< MUDANÇA AQUI: Usando PATCH que é mais apropriado para atualizações parciais
    try {
        const { id } = req.params;
        const { nome } = req.body; // <<< CORREÇÃO AQUI (nome do campo)
        if (!nome || nome.trim() === '') {
            return res.status(400).json({ message: "O nome da estante é obrigatório." });
        }

        const count = await db('Estantes').where({ id_estante: id }).update({ nome: nome.trim() }); // <<< CORREÇÃO AQUI (nome da coluna)

        if (count > 0) {
            res.status(200).json({ message: "Estante atualizada com sucesso." });
        } else {
            res.status(404).json({ message: "Estante não encontrada." });
        }
    } catch (error) {
        if (error.code === '23505') {
            return res.status(409).json({ message: "Uma estante com este nome já existe." });
        }
        console.error("Erro ao atualizar estante:", error);
        res.status(500).json({ message: "Erro interno do servidor." });
    }
});

// ROTA PARA DELETAR UMA ESTANTE 
app.delete('/api/estantes/:id', async (req, res) => {
    try {
        const { id } = req.params;
        // O `onDelete('CASCADE')` na migração já cuida de apagar as referências
        // em `Livros_Estante`, então a transação não é estritamente necessária.
        const count = await db('Estantes').where({ id_estante: id }).del();
        
        if (count > 0) {
            res.status(204).send(); // <<< MUDANÇA AQUI: 204 No Content é a resposta padrão para delete com sucesso
        } else {
            res.status(404).json({ message: "Estante não encontrada." });
        }
    } catch (error) {
        console.error("Erro ao deletar estante:", error);
        res.status(500).json({ message: "Erro interno do servidor." });
    }
});

/*
|--------------------------------------------------------------------------
| Rotas para gerenciar LIVROS dentro das estantes
|--------------------------------------------------------------------------
*/

// ROTA PARA LISTAR OS LIVROS DE UMA ESTANTE
app.get('/api/estantes/:id/livros', async (req, res) => {
    try {
        const { id } = req.params;
        const livros = await db('Livros_Estante')
            // <<< CORREÇÃO AQUI: Junção correta usando google_book_id
            .join('Livros', 'Livros_Estante.id_livro_fk', '=', 'Livros.google_book_id')
            .where({ id_estante_fk: id })
            .select(
                'Livros.*', 
                'Livros_Estante.status', 
                'Livros_Estante.id_associacao'
            );
        
        res.json(livros);
    } catch (error) {
        console.error("Erro ao listar livros da estante:", error);
        res.status(500).json({ message: "Erro interno do servidor." });
    }
});

// ROTA PARA ADICIONAR UM LIVRO A UMA ESTANTE
app.post('/api/estantes/:id/livros', async (req, res) => {
    const { id: id_estante_fk } = req.params;
    const { google_book_id, titulo, autores, capa_url, descricao, status } = req.body;

    if (!google_book_id) {
        return res.status(400).json({ message: "O ID do livro é obrigatório." });
    }

    try {
        await db.transaction(async trx => {
            // Garante que o livro existe na tabela 'Livros' antes de adicioná-lo à estante
            await trx('Livros')
                .insert({
                    google_book_id,
                    titulo,
                    autores: JSON.stringify(autores || []), // <<< CORREÇÃO AQUI: Salva como JSON
                    capa_url,
                    descricao
                })
                .onConflict('google_book_id') // Se o livro já existe (baseado no ID único do Google)
                .ignore();                  // não faz nada, apenas segue em frente.

            // Insere a associação na tabela 'Livros_Estante'
            await trx('Livros_Estante').insert({ 
                id_livro_fk: google_book_id, // <<< CORREÇÃO AQUI: Usando a chave correta
                id_estante_fk, 
                status: status || 'Quero Ler'
            });
        });

        res.status(201).json({ message: "Livro adicionado à estante com sucesso." });
    } catch (error) {
        if (error.code === '23505') { // Código de erro para violação de unicidade
            return res.status(409).json({ message: "Este livro já está nesta estante." });
        }
        console.error("Erro ao adicionar livro à estante:", error);
        res.status(500).json({ message: "Erro interno do servidor." });
    }
});

// ROTA PARA REMOVER UM LIVRO DE UMA ESTANTE
app.delete('/api/estantes/:shelfId/livros/:bookId', async (req, res) => {
    try {
        const { shelfId, bookId } = req.params;
        
        const count = await db('Livros_Estante')
             // <<< CORREÇÃO AQUI: Usando as chaves corretas para o delete
            .where({ id_estante_fk: shelfId, id_livro_fk: bookId })
            .del();
        
        if (count > 0) {
            res.status(204).send();
        } else {
            res.status(404).json({ message: "Este livro não foi encontrado nesta estante." });
        }
    } catch (error) {
        console.error("Erro ao remover livro da estante:", error);
        res.status(500).json({ message: "Erro interno do servidor." });
    }
});

/*
|--------------------------------------------------------------------------
| Rotas para gerenciar STATUS
|--------------------------------------------------------------------------
*/

// ROTA PARA BUSCAR TODOS OS LIVROS COM UM STATUS ESPECÍFICO
app.get('/api/livros/status/:status', async (req, res) => {
    try {
        const { status } = req.params;
        const decodedStatus = decodeURIComponent(status);
        
        const livros = await db('Livros_Estante')
            // <<< CORREÇÃO AQUI: Junção correta usando google_book_id
            .join('Livros', 'Livros_Estante.id_livro_fk', '=', 'Livros.google_book_id')
            .where('Livros_Estante.status', decodedStatus)
            .select(
                'Livros.*',
                'Livros_Estante.status',
                'Livros_Estante.id_associacao'
            );
        res.json(livros);
    } catch (error) {
        console.error(`Erro ao listar livros com status ${req.params.status}:`, error);
        res.status(500).json({ message: "Erro interno do servidor." });
    }
});

// ROTA PARA ATUALIZAR O STATUS DE UM LIVRO EM UMA ESTANTE
app.patch('/api/livros_estante/:id_associacao/status', async (req, res) => {
    try {
        const { id_associacao } = req.params;
        const { status } = req.body;
        
        if (!status) {
            return res.status(400).json({ message: "O novo status é obrigatório." });
        }

        const [updatedEntry] = await db('Livros_Estante')
            .where({ id_associacao: id_associacao })
            .update({ status: status })
            .returning('*');

        if (updatedEntry) {
            res.status(200).json(updatedEntry);
        } else {
            res.status(404).json({ message: "Associação livro-estante não encontrada." });
        }
    } catch (error) {
        console.error("Erro ao atualizar status do livro:", error);
        res.status(500).json({ message: "Erro interno do servidor." });
    }
});

// Listener do servidor
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor backend rodando em http://0.0.0.0:${PORT}`);
});
