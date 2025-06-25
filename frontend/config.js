// frontend/config.js

const environments = {
  // Para quando você rodar o site no seu PC (desenvolvimento)
  development: {
    apiUrl: 'http://localhost:3000/api'
  },
  // Para quando o site estiver no ar no Render (produção)
  production: {
    apiUrl: 'https://livraria-api-phg1.onrender.com/api'
  }
};

// Este código detecta o ambiente e escolhe a URL certa
const isProduction = window.location.hostname.includes('onrender.com');
const apiBaseUrl = (isProduction ? environments.production : environments.development).apiUrl;

// Deixamos a URL base global para o script.js poder usá-la
window.API_URL = apiBaseUrl;

console.log(`URL da API em uso: ${window.API_URL}`);