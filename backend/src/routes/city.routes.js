const express = require('express');
const router = express.Router();
const cityController = require('../controllers/city.controller');
const authMiddleware = require('../middleware/authMiddleware');

// Debug middleware
router.use((req, res, next) => {
  console.log(`\n📍 City Route Hit: ${req.method} ${req.path}`);
  next();
});

// All routes require authentication
router.use(authMiddleware);

// Statistics route (must be before :id route)
router.get('/stats', cityController.getCityStats);

// Active cities for dropdown (must be before :id route)
router.get('/active/list', cityController.getActiveCities);

// CRUD routes
router.get('/', cityController.getCities);
router.post('/', cityController.createCity);
router.get('/:id', cityController.getCityById);
router.patch('/:id', cityController.updateCity);
router.patch('/:id/status', cityController.toggleCityStatus);
router.delete('/:id', cityController.deleteCity);

module.exports = router;