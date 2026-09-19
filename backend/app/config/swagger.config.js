const swaggerJsdoc = require('swagger-jsdoc');
const path = require('path');

// Builds the OpenAPI spec from the @openapi JSDoc/YAML comment blocks placed
// directly above each route definition
const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'SoutheastCubing.org API',
      version: '1.0.0',
    },
  },
  apis: [path.join(__dirname, '../routes/*.routes.js')],
};


const swaggerSpec = swaggerJsdoc(options);

module.exports = { swaggerSpec };
