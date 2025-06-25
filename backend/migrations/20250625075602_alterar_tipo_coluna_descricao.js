/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  // Altera a tabela 'Livros'
  return knex.schema.alterTable('Livros', function(table) {
    // Muda o tipo da coluna 'descricao' de string(255) para text
    table.text('descricao').alter();
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  // Reverte a alteração, caso precisemos voltar a migração
  return knex.schema.alterTable('Livros', function(table) {
    // Muda o tipo da coluna de volta para string(255)
    table.string('descricao').alter();
  });
};