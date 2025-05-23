const express = require('express');
const router = express.Router();
const dwgController = require('../controllers/dwgController');

// Use the DWG controller routes
router.use('/', dwgController);

module.exports = router; 