/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  // Cria a tabela de Livros
  return knex.schema.createTable('Livros', function(table) {
    table.increments('id_livro').primary();
    table.string('google_book_id').notNullable().unique();
    table.string('titulo').notNullable();
    table.jsonb('autores'); // Usar jsonb para armazenar a lista de autores
    table.string('capa_url');
    table.text('descricao');
  })
  // Cria a tabela de Estantes
  .createTable('Estantes', function(table) {
    table.increments('id_estante').primary();
    table.string('nome').notNullable();
  })
  // Cria a tabela de associação (a tabela do problema)
  .createTable('Livros_Estante', function(table) {
    // AQUI ESTÁ A ESTRUTURA CORRETA E FINAL:
    table.increments('id_associacao').primary(); // Chave primária única e simples
    
    // Chave estrangeira para Livros
    table.string('id_livro_fk').notNullable().references('google_book_id').inTable('Livros').onDelete('CASCADE');
    
    // Chave estrangeira para Estantes
    table.integer('id_estante_fk').notNullable().unsigned().references('id_estante').inTable('Estantes').onDelete('CASCADE');

    table.string('status').notNullable();

    // Garante que um livro não pode estar na mesma estante mais de uma vez
    table.unique(['id_livro_fk', 'id_estante_fk']);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  // Apaga as tabelas na ordem inversa para evitar erros de referência
  return knex.schema
    .dropTableIfExists('Livros_Estante')
    .dropTableIfExists('Estantes')
    .dropTableIfExists('Livros');
};