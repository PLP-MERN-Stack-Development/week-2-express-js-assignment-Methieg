// server.js - Starter Express server for Week 2 assignment

// Import required modules
const express = require('express');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware setup
app.use(bodyParser.json());

// Custom Middleware

// 1. Logging Middleware
const loggingMiddleware = (req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
};

// 2. Authentication Middleware (simple token-based)
const authMiddleware = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
  
  if (token === 'secret-token') {
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized: Invalid or missing token' });
  }
};

// 3. Validation Middleware for product creation/update
const validateProduct = (req, res, next) => {
  const { name, price, category } = req.body;
  
  if (!name || typeof name !== 'string' || name.trim() === '') {
    return res.status(400).json({ error: 'Name is required and must be a non-empty string' });
  }
  
  if (price === undefined || typeof price !== 'number' || price < 0) {
    return res.status(400).json({ error: 'Price is required and must be a non-negative number' });
  }
  
  if (!category || typeof category !== 'string' || category.trim() === '') {
    return res.status(400).json({ error: 'Category is required and must be a non-empty string' });
  }
  
  next();
};

// Error Handling Middleware
const errorHandler = (err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
};

// Apply logging middleware to all routes
app.use(loggingMiddleware);

// Sample in-memory products database
let products = [
  {
    id: '1',
    name: 'Laptop',
    description: 'High-performance laptop with 16GB RAM',
    price: 1200,
    category: 'electronics',
    inStock: true
  },
  {
    id: '2',
    name: 'Smartphone',
    description: 'Latest model with 128GB storage',
    price: 800,
    category: 'electronics',
    inStock: true
  },
  {
    id: '3',
    name: 'Coffee Maker',
    description: 'Programmable coffee maker with timer',
    price: 50,
    category: 'kitchen',
    inStock: false
  }
];

// Root route
app.get('/', (req, res) => {
  res.json({ message: 'Product API is running!' });
});

// API Routes

// GET /api/products - Get all products with filtering, pagination, and search
app.get('/api/products', (req, res) => {
  try {
    let filteredProducts = [...products];
    
    // Search functionality
    const search = req.query.search;
    if (search) {
      filteredProducts = filteredProducts.filter(product => 
        product.name.toLowerCase().includes(search.toLowerCase()) ||
        product.description.toLowerCase().includes(search.toLowerCase())
      );
    }
    
    // Category filtering
    const category = req.query.category;
    if (category) {
      filteredProducts = filteredProducts.filter(product => 
        product.category.toLowerCase() === category.toLowerCase()
      );
    }
    
    // Stock filtering
    const inStock = req.query.inStock;
    if (inStock !== undefined) {
      const stockValue = inStock === 'true';
      filteredProducts = filteredProducts.filter(product => product.inStock === stockValue);
    }
    
    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    
    const result = {};
    
    if (endIndex < filteredProducts.length) {
      result.next = {
        page: page + 1,
        limit: limit
      };
    }
    
    if (startIndex > 0) {
      result.previous = {
        page: page - 1,
        limit: limit
      };
    }
    
    result.products = filteredProducts.slice(startIndex, endIndex);
    result.total = filteredProducts.length;
    result.page = page;
    result.limit = limit;
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve products' });
  }
});

// GET /api/products/:id - Get a specific product
app.get('/api/products/:id', (req, res) => {
  try {
    const productId = req.params.id;
    const product = products.find(p => p.id === productId);
    
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    res.json(product);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve product' });
  }
});

// POST /api/products - Create a new product (requires authentication)
app.post('/api/products', authMiddleware, validateProduct, (req, res) => {
  try {
    const { name, description, price, category, inStock } = req.body;
    
    // Check if product with same name already exists
    const existingProduct = products.find(p => p.name.toLowerCase() === name.toLowerCase());
    if (existingProduct) {
      return res.status(409).json({ error: 'Product with this name already exists' });
    }
    
    const newProduct = {
      id: uuidv4(),
      name,
      description: description || '',
      price,
      category,
      inStock: inStock !== undefined ? inStock : true
    };
    
    products.push(newProduct);
    res.status(201).json(newProduct);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create product' });
  }
});

// PUT /api/products/:id - Update a product (requires authentication)
app.put('/api/products/:id', authMiddleware, validateProduct, (req, res) => {
  try {
    const productId = req.params.id;
    const productIndex = products.findIndex(p => p.id === productId);
    
    if (productIndex === -1) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    const { name, description, price, category, inStock } = req.body;
    
    // Check if another product has the same name
    const existingProduct = products.find(p => 
      p.name.toLowerCase() === name.toLowerCase() && p.id !== productId
    );
    if (existingProduct) {
      return res.status(409).json({ error: 'Product with this name already exists' });
    }
    
    const updatedProduct = {
      id: productId,
      name,
      description: description || '',
      price,
      category,
      inStock: inStock !== undefined ? inStock : products[productIndex].inStock
    };
    
    products[productIndex] = updatedProduct;
    res.json(updatedProduct);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update product' });
  }
});

// DELETE /api/products/:id - Delete a product (requires authentication)
app.delete('/api/products/:id', authMiddleware, (req, res) => {
  try {
    const productId = req.params.id;
    const productIndex = products.findIndex(p => p.id === productId);
    
    if (productIndex === -1) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    const deletedProduct = products.splice(productIndex, 1)[0];
    res.json({ message: 'Product deleted successfully', product: deletedProduct });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

// 404 handler for undefined routes
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handling middleware
app.use(errorHandler);

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

// Export the app for testing purposes
module.exports = app;