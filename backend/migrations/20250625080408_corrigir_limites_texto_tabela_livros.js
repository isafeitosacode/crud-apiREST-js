/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  // Altera a tabela 'Livros'
  return knex.schema.alterTable('Livros', function(table) {
    // Força TODAS as colunas de texto que podem ser longas para o tipo TEXT, que não tem limite.
    table.text('titulo').alter();
    table.text('capa_url').alter();
    table.text('descricao').alter();
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  // Reverte para o padrão string(255) se precisarmos voltar atrás
  return knex.schema.alterTable('Livros', function(table) {
    table.string('titulo').alter();
    table.string('capa_url').alter();
    table.string('descricao').alter();
  });
};