// src/controllers/category.controller.js
const { getCategoryModel, getServiceModel } = require('../config/database');
const { deleteImage } = require('../config/cloudinary');

/**
 * Helper function to build populate options for moreServicesConfig
 * Returns populate options array
 */
const getPopulateOptions = () => {
  return [
    {
      path: 'moreServicesConfig.action.targetCategory',
      select: 'name categoryId icon',
      match: { _id: { $exists: true } },
    },
    {
      path: 'moreServicesConfig.serviceFilters.includeCategories',
      select: 'name categoryId',
    },
    {
      path: 'moreServicesConfig.serviceFilters.excludeCategories',
      select: 'name categoryId',
    },
  ];
};

/**
 * Safe populate function that handles missing paths gracefully
 */
const safePopulate = async (query) => {
  try {
    return await query
      .populate({
        path: 'moreServicesConfig.action.targetCategory',
        select: 'name categoryId icon',
        strictPopulate: false,
      })
      .populate({
        path: 'moreServicesConfig.serviceFilters.includeCategories',
        select: 'name categoryId',
        strictPopulate: false,
      })
      .populate({
        path: 'moreServicesConfig.serviceFilters.excludeCategories',
        select: 'name categoryId',
        strictPopulate: false,
      });
  } catch (error) {
    console.warn('Population warning (non-fatal):', error.message);
    // Return query without population if it fails
    return query;
  }
};

/**
 * Safe populate for a single document
 */
const safePopulateDocument = async (doc) => {
  if (!doc) return doc;

  try {
    // Only populate if moreServicesConfig exists
    if (doc.moreServicesConfig) {
      if (doc.moreServicesConfig.action?.targetCategory) {
        await doc.populate({
          path: 'moreServicesConfig.action.targetCategory',
          select: 'name categoryId icon',
        });
      }
      if (doc.moreServicesConfig.serviceFilters?.includeCategories?.length > 0) {
        await doc.populate({
          path: 'moreServicesConfig.serviceFilters.includeCategories',
          select: 'name categoryId',
        });
      }
      if (doc.moreServicesConfig.serviceFilters?.excludeCategories?.length > 0) {
        await doc.populate({
          path: 'moreServicesConfig.serviceFilters.excludeCategories',
          select: 'name categoryId',
        });
      }
    }
    return doc;
  } catch (error) {
    console.warn('Document population warning (non-fatal):', error.message);
    return doc;
  }
};

/**
 * Helper function to manually populate moreServicesConfig references
 * Works with lean() query results (plain objects)
 */
const populateMoreServicesConfig = async (categoryObj, Category) => {
  if (!categoryObj) return categoryObj;
  
  if (!categoryObj.isMoreServicesSection || !categoryObj.moreServicesConfig) {
    return categoryObj;
  }

  try {
    // Populate targetCategory
    if (categoryObj.moreServicesConfig.action?.targetCategory) {
      const targetCat = await Category.findById(
        categoryObj.moreServicesConfig.action.targetCategory,
        'name categoryId icon'
      ).lean();
      categoryObj.moreServicesConfig.action.targetCategory = targetCat;
    }

    // Populate includeCategories
    if (categoryObj.moreServicesConfig.serviceFilters?.includeCategories?.length > 0) {
      const includeCats = await Category.find(
        { _id: { $in: categoryObj.moreServicesConfig.serviceFilters.includeCategories } },
        'name categoryId'
      ).lean();
      categoryObj.moreServicesConfig.serviceFilters.includeCategories = includeCats;
    }

    // Populate excludeCategories
    if (categoryObj.moreServicesConfig.serviceFilters?.excludeCategories?.length > 0) {
      const excludeCats = await Category.find(
        { _id: { $in: categoryObj.moreServicesConfig.serviceFilters.excludeCategories } },
        'name categoryId'
      ).lean();
      categoryObj.moreServicesConfig.serviceFilters.excludeCategories = excludeCats;
    }
  } catch (error) {
    console.warn('populateMoreServicesConfig warning (non-fatal):', error.message);
  }

  return categoryObj;
};

/**
 * Helper function to populate action references
 * Works with lean() query results (plain objects)
 */
const populateActionReferences = async (categoryObj, Category) => {
  if (!categoryObj || !categoryObj.action) {
    return categoryObj;
  }

  try {
    // Populate targetCategory in action
    if (categoryObj.action.targetCategory) {
      const targetCat = await Category.findById(
        categoryObj.action.targetCategory,
        'name categoryId icon'
      ).lean();
      categoryObj.action.targetCategory = targetCat;
    }

    // Populate targetService in action
    if (categoryObj.action.targetService) {
      const Service = getServiceModel();
      const targetService = await Service.findById(
        categoryObj.action.targetService,
        'name serviceId icon'
      ).lean();
      categoryObj.action.targetService = targetService;
    }
  } catch (error) {
    console.warn('populateActionReferences warning (non-fatal):', error.message);
  }

  return categoryObj;
};

/**
 * Helper function to populate all references for a category object
 */
const populateAllReferences = async (categoryObj, Category) => {
  if (!categoryObj) return categoryObj;
  
  await populateMoreServicesConfig(categoryObj, Category);
  await populateActionReferences(categoryObj, Category);
  
  return categoryObj;
};

/**
 * Get all categories
 */
exports.getCategories = async (req, res) => {
  try {
    const Category = getCategoryModel();

    const {
      page = 1,
      limit = 50,
      search = '',
      isActive,
      isFeatured,
      isMoreServicesSection,
      sortBy = 'sortOrder',
      sortOrder = 'asc',
    } = req.query;

    // Build query
    const query = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    if (isFeatured !== undefined) {
      query.isFeatured = isFeatured === 'true';
    }

    if (isMoreServicesSection !== undefined) {
      query.isMoreServicesSection = isMoreServicesSection === 'true';
    }

    // Build sort
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Execute query without populate first
    let categories = await Category.find(query)
      .sort(sort)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .lean();

    // Manually populate references for categories that have them
    const populatedCategories = await Promise.all(
      categories.map(async (cat) => {
        // Populate moreServicesConfig references
        if (cat.isMoreServicesSection && cat.moreServicesConfig) {
          // Populate targetCategory
          if (cat.moreServicesConfig.action?.targetCategory) {
            const targetCat = await Category.findById(
              cat.moreServicesConfig.action.targetCategory,
              'name categoryId icon'
            ).lean();
            cat.moreServicesConfig.action.targetCategory = targetCat;
          }

          // Populate includeCategories
          if (cat.moreServicesConfig.serviceFilters?.includeCategories?.length > 0) {
            const includeCats = await Category.find(
              { _id: { $in: cat.moreServicesConfig.serviceFilters.includeCategories } },
              'name categoryId'
            ).lean();
            cat.moreServicesConfig.serviceFilters.includeCategories = includeCats;
          }

          // Populate excludeCategories
          if (cat.moreServicesConfig.serviceFilters?.excludeCategories?.length > 0) {
            const excludeCats = await Category.find(
              { _id: { $in: cat.moreServicesConfig.serviceFilters.excludeCategories } },
              'name categoryId'
            ).lean();
            cat.moreServicesConfig.serviceFilters.excludeCategories = excludeCats;
          }
        }

        // Populate action references
        if (cat.action) {
          if (cat.action.targetCategory) {
            const targetCat = await Category.findById(
              cat.action.targetCategory,
              'name categoryId icon'
            ).lean();
            cat.action.targetCategory = targetCat;
          }

          if (cat.action.targetService) {
            const Service = getServiceModel();
            const targetService = await Service.findById(
              cat.action.targetService,
              'name serviceId icon'
            ).lean();
            cat.action.targetService = targetService;
          }
        }

        return cat;
      })
    );

    const total = await Category.countDocuments(query);

    res.json({
      success: true,
      data: populatedCategories,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch categories',
      error: error.message,
    });
  }
};

/**
 * Get category by ID
 */
exports.getCategoryById = async (req, res) => {
  try {
    const Category = getCategoryModel();
    const { id } = req.params;

    let category = await Category.findById(id).lean();

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found',
      });
    }

    // Manually populate moreServicesConfig references if it exists
    if (category.isMoreServicesSection && category.moreServicesConfig) {
      // Populate targetCategory
      if (category.moreServicesConfig.action?.targetCategory) {
        const targetCat = await Category.findById(
          category.moreServicesConfig.action.targetCategory,
          'name categoryId icon'
        ).lean();
        category.moreServicesConfig.action.targetCategory = targetCat;
      }

      // Populate includeCategories
      if (category.moreServicesConfig.serviceFilters?.includeCategories?.length > 0) {
        const includeCats = await Category.find(
          { _id: { $in: category.moreServicesConfig.serviceFilters.includeCategories } },
          'name categoryId'
        ).lean();
        category.moreServicesConfig.serviceFilters.includeCategories = includeCats;
      }

      // Populate excludeCategories
      if (category.moreServicesConfig.serviceFilters?.excludeCategories?.length > 0) {
        const excludeCats = await Category.find(
          { _id: { $in: category.moreServicesConfig.serviceFilters.excludeCategories } },
          'name categoryId'
        ).lean();
        category.moreServicesConfig.serviceFilters.excludeCategories = excludeCats;
      }
    }

    // Populate action references
    if (category.action) {
      if (category.action.targetCategory) {
        const targetCat = await Category.findById(
          category.action.targetCategory,
          'name categoryId icon'
        ).lean();
        category.action.targetCategory = targetCat;
      }

      if (category.action.targetService) {
        const Service = getServiceModel();
        const targetService = await Service.findById(
          category.action.targetService,
          'name serviceId icon'
        ).lean();
        category.action.targetService = targetService;
      }
    }

    res.json({
      success: true,
      data: category,
    });
  } catch (error) {
    console.error('Error fetching category:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch category',
      error: error.message,
    });
  }
};

/**
 * Create category
 */
exports.createCategory = async (req, res) => {
  try {
    const Category = getCategoryModel();

    console.log('📤 Creating category...');
    console.log('📦 Request body:', req.body);
    console.log('📎 File:', req.file ? req.file.filename : 'No file');

    const {
      name,
      description,
      icon,
      color,
      colorClass,
      sortOrder,
      isFeatured,
      isActive,
      isMoreServicesSection,
      moreServicesConfig,
      action, // Action configuration
    } = req.body;

    // Validate required fields
    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Category name is required',
      });
    }

    // Check if trying to create "More Services" section when one already exists
    if (isMoreServicesSection === 'true' || isMoreServicesSection === true) {
      const existingSection = await Category.ensureSingleMoreServicesSection();
      if (existingSection) {
        return res.status(400).json({
          success: false,
          message: 'A "More Services" section already exists. Please edit the existing one or delete it first.',
        });
      }
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Category image is required',
      });
    }

    // Auto-generate categoryId from name
    const categoryId = name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();

    console.log('🔑 Generated categoryId:', categoryId);

    // Check if categoryId already exists
    const existingCategory = await Category.findOne({ categoryId });
    if (existingCategory) {
      // Delete uploaded image
      if (req.file?.filename) {
        await deleteImage(req.file.filename).catch(console.error);
      }

      return res.status(400).json({
        success: false,
        message: `A category with a similar name already exists: "${existingCategory.name}"`,
      });
    }

    // Parse moreServicesConfig if provided
    let parsedConfig = {};
    if (moreServicesConfig) {
      try {
        parsedConfig = typeof moreServicesConfig === 'string'
          ? JSON.parse(moreServicesConfig)
          : moreServicesConfig;

        // Convert 'type' to 'actionType' if present (for backward compatibility)
        if (parsedConfig.action && parsedConfig.action.type) {
          parsedConfig.action.actionType = parsedConfig.action.type;
          delete parsedConfig.action.type;
        }
      } catch (e) {
        console.error('Failed to parse moreServicesConfig:', e);
      }
    }

    // Parse action if provided
    let parsedAction = {
      actionType: 'services', // Default
      targetUrl: '',
      screenName: '',
      deeplink: '',
      targetCategory: null,
      targetService: null,
      promoCode: '',
      params: {},
      openInExternalBrowser: false,
    };

    if (action) {
      try {
        const actionData = typeof action === 'string' ? JSON.parse(action) : action;
        parsedAction = { ...parsedAction, ...actionData };

        // Convert 'type' to 'actionType' if present (for backward compatibility)
        if (actionData.type) {
          parsedAction.actionType = actionData.type;
        }
      } catch (e) {
        console.error('Failed to parse action:', e);
      }
    }

    // Create category
    const category = new Category({
      categoryId,
      name,
      description: description || '',
      icon: icon || '📦',
      image: {
        url: req.file.path,
        publicId: req.file.filename,
      },
      color: color || '#FF8C42',
      colorClass: colorClass || 'bg-orange-100',
      sortOrder: sortOrder ? parseInt(sortOrder) : 0,
      isActive: isActive === 'false' ? false : true,
      isFeatured: isFeatured === 'true',
      isMoreServicesSection: isMoreServicesSection === 'true',
      moreServicesConfig: isMoreServicesSection === 'true' ? parsedConfig : undefined,
      action: parsedAction, // Add action configuration
      servicesCount: 0,
      createdBy: req.user?._id || req.admin?._id,
    });

    await category.save();

    console.log('✅ Category created:', category.categoryId);
    console.log('✅ Action type:', category.action?.actionType);

    res.status(201).json({
      success: true,
      message: 'Category created successfully',
      data: category,
    });
  } catch (error) {
    console.error('Error creating category:', error);

    // Delete uploaded image if category creation fails
    if (req.file?.filename) {
      await deleteImage(req.file.filename).catch(console.error);
    }

    res.status(500).json({
      success: false,
      message: 'Failed to create category',
      error: error.message,
    });
  }
};

//**
 //Update category

exports.updateCategory = async (req, res) => {
  try {
    const Category = getCategoryModel();
    const { id } = req.params;

    console.log('📤 Updating category:', id);
    console.log('📦 Request body:', req.body);
    console.log('📎 File:', req.file ? req.file.filename : 'No file');

    const category = await Category.findById(id);

    if (!category) {
      // Delete uploaded image if category not found
      if (req.file?.filename) {
        await deleteImage(req.file.filename).catch(console.error);
      }

      return res.status(404).json({
        success: false,
        message: 'Category not found',
      });
    }

    const {
      name,
      description,
      icon,
      color,
      colorClass,
      sortOrder,
      isActive,
      isFeatured,
      isMoreServicesSection,
      moreServicesConfig,
      action, // Action configuration (old format)
      actionConfig, // ✅ NEW: Action configuration (new format from frontend)
    } = req.body;

    // Check if trying to make this "More Services" section when one already exists
    if ((isMoreServicesSection === 'true' || isMoreServicesSection === true) && !category.isMoreServicesSection) {
      const existingSection = await Category.ensureSingleMoreServicesSection(id);
      if (existingSection) {
        if (req.file?.filename) {
          await deleteImage(req.file.filename).catch(console.error);
        }
        return res.status(400).json({
          success: false,
          message: 'A "More Services" section already exists. Please disable the existing one first.',
        });
      }
    }

    // Handle image update
    if (req.file) {
      // Delete old image
      if (category.image.publicId) {
        await deleteImage(category.image.publicId).catch(console.error);
      }

      category.image.url = req.file.path;
      category.image.publicId = req.file.filename;
    }

    // Update fields
    if (name !== undefined) {
      category.name = name;

      // Update categoryId if name changes
      const newCategoryId = name
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();

      // Check if new categoryId conflicts with another category
      if (newCategoryId !== category.categoryId) {
        const existingCategory = await Category.findOne({ categoryId: newCategoryId });
        if (existingCategory && existingCategory._id.toString() !== id) {
          // Delete uploaded image
          if (req.file?.filename) {
            await deleteImage(req.file.filename).catch(console.error);
          }

          return res.status(400).json({
            success: false,
            message: `A category with a similar name already exists: "${existingCategory.name}"`,
          });
        }
        category.categoryId = newCategoryId;
      }
    }

    if (description !== undefined) category.description = description;
    if (icon !== undefined) category.icon = icon;
    if (color !== undefined) category.color = color;
    if (colorClass !== undefined) category.colorClass = colorClass;
    if (sortOrder !== undefined) category.sortOrder = parseInt(sortOrder);
    if (isActive !== undefined) category.isActive = isActive === 'true' || isActive === true;
    if (isFeatured !== undefined) category.isFeatured = isFeatured === 'true' || isFeatured === true;
    if (isMoreServicesSection !== undefined) {
      category.isMoreServicesSection = isMoreServicesSection === 'true' || isMoreServicesSection === true;
    }

    // Update moreServicesConfig
    if (moreServicesConfig !== undefined) {
      try {
        let parsedConfig = typeof moreServicesConfig === 'string'
          ? JSON.parse(moreServicesConfig)
          : moreServicesConfig;

        // Convert 'type' to 'actionType' if present (for backward compatibility)
        if (parsedConfig.action && parsedConfig.action.type) {
          parsedConfig.action.actionType = parsedConfig.action.type;
          delete parsedConfig.action.type;
        }

        category.moreServicesConfig = parsedConfig;
      } catch (e) {
        console.error('Failed to parse moreServicesConfig:', e);
      }
    }

    // ✅ NEW: Handle actionConfig from frontend
    if (actionConfig !== undefined) {
      try {
        let parsedActionConfig = typeof actionConfig === 'string'
          ? JSON.parse(actionConfig)
          : actionConfig;

        console.log('📥 Received actionConfig:', parsedActionConfig);

        // Map frontend actionConfig to database action schema
        const mappedAction = {
          actionType: parsedActionConfig.actionType || 'services',
          targetUrl: parsedActionConfig.url || '', // ✅ Map 'url' to 'targetUrl'
          screenName: parsedActionConfig.screenName || '',
          deeplink: parsedActionConfig.deeplink || '',
          targetCategory: parsedActionConfig.targetCategory || null,
          targetService: parsedActionConfig.targetService || null,
          promoCode: parsedActionConfig.promoCode || '',
          params: parsedActionConfig.params || {},
          openInExternalBrowser: parsedActionConfig.openInExternalBrowser || false,
        };

        // ✅ Handle 'external_url' action type
        if (parsedActionConfig.actionType === 'external_url') {
          mappedAction.actionType = 'url'; // Convert to schema-compatible value
          mappedAction.targetUrl = parsedActionConfig.url || '';
          mappedAction.openInExternalBrowser = true;
        }

        category.action = mappedAction;

        console.log('✅ Mapped action to save:', category.action);

      } catch (e) {
        console.error('Failed to parse actionConfig:', e);
      }
    }

    // ✅ FALLBACK: Handle old 'action' format (for backward compatibility)
    if (!actionConfig && action !== undefined) {
      try {
        const actionData = typeof action === 'string' ? JSON.parse(action) : action;

        // Convert 'type' to 'actionType' if present (for backward compatibility)
        if (actionData.type) {
          actionData.actionType = actionData.type;
          delete actionData.type;
        }

        // Merge with existing action or create new
        const existingAction = category.action?.toObject ? category.action.toObject() : (category.action || {});
        category.action = {
          ...existingAction,
          ...actionData,
        };

        console.log('✅ Updated action (old format):', category.action);
      } catch (e) {
        console.error('Failed to parse action:', e);
      }
    }

    category.updatedBy = req.user?._id || req.admin?._id;

    await category.save();

    // Convert to plain object for manual population
    let categoryObj = category.toObject();

    // Manually populate moreServicesConfig references if it exists
    if (categoryObj.isMoreServicesSection && categoryObj.moreServicesConfig) {
      // Populate targetCategory
      if (categoryObj.moreServicesConfig.action?.targetCategory) {
        const targetCat = await Category.findById(
          categoryObj.moreServicesConfig.action.targetCategory,
          'name categoryId icon'
        ).lean();
        categoryObj.moreServicesConfig.action.targetCategory = targetCat;
      }

      // Populate includeCategories
      if (categoryObj.moreServicesConfig.serviceFilters?.includeCategories?.length > 0) {
        const includeCats = await Category.find(
          { _id: { $in: categoryObj.moreServicesConfig.serviceFilters.includeCategories } },
          'name categoryId'
        ).lean();
        categoryObj.moreServicesConfig.serviceFilters.includeCategories = includeCats;
      }

      // Populate excludeCategories
      if (categoryObj.moreServicesConfig.serviceFilters?.excludeCategories?.length > 0) {
        const excludeCats = await Category.find(
          { _id: { $in: categoryObj.moreServicesConfig.serviceFilters.excludeCategories } },
          'name categoryId'
        ).lean();
        categoryObj.moreServicesConfig.serviceFilters.excludeCategories = excludeCats;
      }
    }

    // Populate action references
    if (categoryObj.action) {
      if (categoryObj.action.targetCategory) {
        const targetCat = await Category.findById(
          categoryObj.action.targetCategory,
          'name categoryId icon'
        ).lean();
        categoryObj.action.targetCategory = targetCat;
      }

      if (categoryObj.action.targetService) {
        const Service = getServiceModel();
        const targetService = await Service.findById(
          categoryObj.action.targetService,
          'name serviceId icon'
        ).lean();
        categoryObj.action.targetService = targetService;
      }
    }

    console.log('✅ Category updated:', category.categoryId);
    console.log('✅ Final action saved:', categoryObj.action);

    res.json({
      success: true,
      message: 'Category updated successfully',
      data: categoryObj,
    });
  } catch (error) {
    console.error('Error updating category:', error);

    // Delete uploaded image if update fails
    if (req.file?.filename) {
      await deleteImage(req.file.filename).catch(console.error);
    }

    res.status(500).json({
      success: false,
      message: 'Failed to update category',
      error: error.message,
    });
  }
};
/**
 * Delete category
 */
exports.deleteCategory = async (req, res) => {
  try {
    const Category = getCategoryModel();
    const Service = getServiceModel();
    const { id } = req.params;

    const category = await Category.findById(id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found',
      });
    }

    // Don't allow deletion if it has services (unless it's More Services section)
    if (!category.isMoreServicesSection) {
      const serviceCount = await Service.countDocuments({ category: id });

      if (serviceCount > 0) {
        return res.status(400).json({
          success: false,
          message: `Cannot delete category. It has ${serviceCount} service(s) linked to it.`,
        });
      }
    }

    // Delete image from Cloudinary
    if (category.image.publicId) {
      await deleteImage(category.image.publicId).catch(console.error);
    }

    await category.deleteOne();

    console.log('🗑️ Category deleted:', category.categoryId);

    res.json({
      success: true,
      message: 'Category deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete category',
      error: error.message,
    });
  }
};

/**
 * Reorder categories
 */
exports.reorderCategories = async (req, res) => {
  try {
    const Category = getCategoryModel();
    const { categories } = req.body;

    if (!Array.isArray(categories)) {
      return res.status(400).json({
        success: false,
        message: 'Categories must be an array',
      });
    }

    console.log('🔄 Reordering categories...');

    const updatePromises = categories.map((item) =>
      Category.findByIdAndUpdate(item.id, {
        sortOrder: item.sortOrder,
        updatedBy: req.user?._id || req.admin?._id,
      })
    );

    await Promise.all(updatePromises);

    console.log('✅ Categories reordered');

    res.json({
      success: true,
      message: 'Categories reordered successfully',
    });
  } catch (error) {
    console.error('Error reordering categories:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reorder categories',
      error: error.message,
    });
  }
};

/**
 * Get category stats
 */
exports.getCategoryStats = async (req, res) => {
  try {
    const Category = getCategoryModel();
    const Service = getServiceModel();

    const [
      totalCategories,
      activeCategories,
      featuredCategories,
      moreServicesSections,
      totalServices,
    ] = await Promise.all([
      Category.countDocuments(),
      Category.countDocuments({ isActive: true }),
      Category.countDocuments({ isFeatured: true }),
      Category.countDocuments({ isMoreServicesSection: true }),
      Service.countDocuments({ isActive: true }),
    ]);

    // Get services per category
    const categoryServiceCounts = await Service.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: 'categories',
          localField: '_id',
          foreignField: '_id',
          as: 'category',
        },
      },
      { $unwind: '$category' },
      {
        $project: {
          name: '$category.name',
          count: 1,
        },
      },
    ]);

    const servicesPerCategory = {};
    categoryServiceCounts.forEach((item) => {
      servicesPerCategory[item.name] = item.count;
    });

    res.json({
      success: true,
      data: {
        totalCategories,
        activeCategories,
        inactiveCategories: totalCategories - activeCategories,
        featuredCategories,
        moreServicesSections,
        totalServices,
        servicesPerCategory,
      },
    });
  } catch (error) {
    console.error('Error fetching category stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch category stats',
      error: error.message,
    });
  }
};

/**
 * Update services count for a category
 */
exports.updateServicesCount = async (req, res) => {
  try {
    const Category = getCategoryModel();
    const Service = getServiceModel();
    const { id } = req.params;

    const category = await Category.findById(id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found',
      });
    }

    const count = await Service.countDocuments({
      category: id,
      isActive: true,
    });

    category.servicesCount = count;
    await category.save();

    res.json({
      success: true,
      message: 'Services count updated',
      data: { servicesCount: count },
    });
  } catch (error) {
    console.error('Error updating services count:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update services count',
      error: error.message,
    });
  }
};

/**
 * Get "More Services" configuration
 */
exports.getMoreServicesConfig = async (req, res) => {
  try {
    const Category = getCategoryModel();

    let moreServicesSection = await Category.findOne({ isMoreServicesSection: true }).lean();

    if (!moreServicesSection) {
      return res.status(404).json({
        success: false,
        message: 'No "More Services" section configured',
      });
    }

    // Manually populate references
    if (moreServicesSection.moreServicesConfig) {
      // Populate targetCategory
      if (moreServicesSection.moreServicesConfig.action?.targetCategory) {
        const targetCat = await Category.findById(
          moreServicesSection.moreServicesConfig.action.targetCategory,
          'name categoryId icon'
        ).lean();
        moreServicesSection.moreServicesConfig.action.targetCategory = targetCat;
      }

      // Populate includeCategories
      if (moreServicesSection.moreServicesConfig.serviceFilters?.includeCategories?.length > 0) {
        const includeCats = await Category.find(
          { _id: { $in: moreServicesSection.moreServicesConfig.serviceFilters.includeCategories } },
          'name categoryId'
        ).lean();
        moreServicesSection.moreServicesConfig.serviceFilters.includeCategories = includeCats;
      }

      // Populate excludeCategories
      if (moreServicesSection.moreServicesConfig.serviceFilters?.excludeCategories?.length > 0) {
        const excludeCats = await Category.find(
          { _id: { $in: moreServicesSection.moreServicesConfig.serviceFilters.excludeCategories } },
          'name categoryId'
        ).lean();
        moreServicesSection.moreServicesConfig.serviceFilters.excludeCategories = excludeCats;
      }
    }

    // Populate action references
    if (moreServicesSection.action) {
      if (moreServicesSection.action.targetCategory) {
        const targetCat = await Category.findById(
          moreServicesSection.action.targetCategory,
          'name categoryId icon'
        ).lean();
        moreServicesSection.action.targetCategory = targetCat;
      }

      if (moreServicesSection.action.targetService) {
        const Service = getServiceModel();
        const targetService = await Service.findById(
          moreServicesSection.action.targetService,
          'name serviceId icon'
        ).lean();
        moreServicesSection.action.targetService = targetService;
      }
    }

    res.json({
      success: true,
      data: moreServicesSection,
    });
  } catch (error) {
    console.error('Error fetching More Services config:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch More Services configuration',
      error: error.message,
    });
  }
};

/**
 * Update "More Services" configuration
 */
exports.updateMoreServicesConfig = async (req, res) => {
  try {
    const Category = getCategoryModel();
    const { config } = req.body;

    const moreServicesSection = await Category.findOne({ isMoreServicesSection: true });

    if (!moreServicesSection) {
      return res.status(404).json({
        success: false,
        message: 'No "More Services" section found',
      });
    }

    // Convert 'type' to 'actionType' if present (for backward compatibility)
    let processedConfig = { ...config };
    if (processedConfig.action && processedConfig.action.type) {
      processedConfig.action.actionType = processedConfig.action.type;
      delete processedConfig.action.type;
    }

    // Get existing config as plain object
    const existingConfig = moreServicesSection.moreServicesConfig?.toObject
      ? moreServicesSection.moreServicesConfig.toObject()
      : moreServicesSection.moreServicesConfig || {};

    moreServicesSection.moreServicesConfig = {
      ...existingConfig,
      ...processedConfig,
    };

    moreServicesSection.updatedBy = req.user?._id || req.admin?._id;

    await moreServicesSection.save();

    // Convert to plain object for manual population
    let sectionObj = moreServicesSection.toObject();

    // Manually populate references
    if (sectionObj.moreServicesConfig) {
      // Populate targetCategory
      if (sectionObj.moreServicesConfig.action?.targetCategory) {
        const targetCat = await Category.findById(
          sectionObj.moreServicesConfig.action.targetCategory,
          'name categoryId icon'
        ).lean();
        sectionObj.moreServicesConfig.action.targetCategory = targetCat;
      }

      // Populate includeCategories
      if (sectionObj.moreServicesConfig.serviceFilters?.includeCategories?.length > 0) {
        const includeCats = await Category.find(
          { _id: { $in: sectionObj.moreServicesConfig.serviceFilters.includeCategories } },
          'name categoryId'
        ).lean();
        sectionObj.moreServicesConfig.serviceFilters.includeCategories = includeCats;
      }

      // Populate excludeCategories
      if (sectionObj.moreServicesConfig.serviceFilters?.excludeCategories?.length > 0) {
        const excludeCats = await Category.find(
          { _id: { $in: sectionObj.moreServicesConfig.serviceFilters.excludeCategories } },
          'name categoryId'
        ).lean();
        sectionObj.moreServicesConfig.serviceFilters.excludeCategories = excludeCats;
      }
    }

    // Populate action references
    if (sectionObj.action) {
      if (sectionObj.action.targetCategory) {
        const targetCat = await Category.findById(
          sectionObj.action.targetCategory,
          'name categoryId icon'
        ).lean();
        sectionObj.action.targetCategory = targetCat;
      }

      if (sectionObj.action.targetService) {
        const Service = getServiceModel();
        const targetService = await Service.findById(
          sectionObj.action.targetService,
          'name serviceId icon'
        ).lean();
        sectionObj.action.targetService = targetService;
      }
    }

    res.json({
      success: true,
      message: 'More Services configuration updated successfully',
      data: sectionObj,
    });
  } catch (error) {
    console.error('Error updating More Services config:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update More Services configuration',
      error: error.message,
    });
  }
};

/**
 * Get categories for grid display (3 categories + More Services)
 * Used by mobile app home screen
 */
exports.getCategoryGrid = async (req, res) => {
  try {
    const Category = getCategoryModel();

    console.log('📱 Fetching category grid for mobile app...');

    // Get all active categories, sorted by sortOrder
    const categories = await Category.find({ 
      isActive: true,
      isMoreServicesSection: false // Exclude "More Services" section itself
    })
      .select('_id categoryId name icon image color colorClass sortOrder servicesCount subservicesCount')
      .sort({ sortOrder: 1 })
      .limit(3) // Only first 3 categories
      .lean();

    console.log(`✅ Found ${categories.length} categories for grid`);

    // Get "More Services" section configuration
    let moreServicesSection = await Category.findOne({ 
      isMoreServicesSection: true,
      isActive: true 
    })
      .select('name icon image color colorClass moreServicesConfig')
      .lean();

    // Count total categories (excluding More Services section)
    const totalCategories = await Category.countDocuments({ 
      isActive: true,
      isMoreServicesSection: false 
    });

    const hasMore = totalCategories > 3;

    // Build More Services card data
    let moreServicesCard = null;
    if (hasMore) {
      moreServicesCard = {
        id: 'more-services',
        categoryId: 'more-services',
        name: moreServicesSection?.moreServicesConfig?.displaySettings?.title || 'More Services',
        icon: moreServicesSection?.moreServicesConfig?.displaySettings?.icon || '🔧',
        image: moreServicesSection?.moreServicesConfig?.displaySettings?.image || {
          url: null,
          publicId: null,
        },
        color: moreServicesSection?.moreServicesConfig?.displaySettings?.color || '#6366F1',
        colorClass: moreServicesSection?.moreServicesConfig?.displaySettings?.colorClass || 'bg-indigo-100',
        isMoreCard: true,
        serviceCount: totalCategories - 3,
        actionType: moreServicesSection?.moreServicesConfig?.action?.actionType || 'all_services',
        config: moreServicesSection?.moreServicesConfig || {},
      };
    }

    // Transform categories for mobile app
    const gridCategories = categories.map(cat => ({
      id: cat._id.toString(),
      categoryId: cat.categoryId,
      name: cat.name,
      icon: cat.icon,
      imageUrl: cat.image?.url || null,
      color: cat.color,
      colorClass: cat.colorClass,
      serviceCount: cat.servicesCount || cat.subservicesCount || 0,
      isMoreCard: false,
    }));

    // Add More Services card if applicable
    if (moreServicesCard) {
      gridCategories.push(moreServicesCard);
    }

    res.json({
      success: true,
      data: {
        categories: gridCategories,
        hasMore,
        totalCategories,
        displayedCategories: categories.length,
      },
    });
  } catch (error) {
    console.error('❌ Error fetching category grid:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch category grid',
      error: error.message,
    });
  }
};

/**
 * Get all categories for "All Services" screen
 * Includes subservices for each category
 */
exports.getAllCategoriesWithSubservices = async (req, res) => {
  try {
    const Category = getCategoryModel();
    const Subservice = getSubserviceModel();

    console.log('📱 Fetching all categories with subservices...');

    const {
      search = '',
      sortBy = 'name',
      sortOrder = 'asc',
    } = req.query;

    // Build query
    const query = {
      isActive: true,
      isMoreServicesSection: false,
    };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    // Build sort
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Get all active categories
    const categories = await Category.find(query)
      .select('_id categoryId name description icon image color colorClass servicesCount subservicesCount')
      .sort(sort)
      .lean();

    console.log(`✅ Found ${categories.length} categories`);

    // Get subservices for each category
    const categoriesWithSubservices = await Promise.all(
      categories.map(async (category) => {
        const subservices = await Subservice.find({
          category: category._id,
          isActive: true,
        })
          .select('_id subserviceId name description icon image pricing duration rating isPopular sortOrder')
          .sort({ sortOrder: 1 })
          .lean();

        return {
          id: category._id.toString(),
          categoryId: category.categoryId,
          name: category.name,
          description: category.description,
          icon: category.icon,
          imageUrl: category.image?.url || null,
          color: category.color,
          colorClass: category.colorClass,
          subservicesCount: subservices.length,
          subservices: subservices.map(sub => ({
            id: sub._id.toString(),
            subserviceId: sub.subserviceId,
            name: sub.name,
            description: sub.description,
            icon: sub.icon,
            imageUrl: sub.image?.url || null,
            price: sub.pricing?.displayText || `₹${sub.pricing?.price} onwards`,
            duration: sub.duration?.displayText || `${sub.duration?.minutes || 60} mins`,
            rating: sub.rating?.average || 0,
            ratingCount: sub.rating?.count || 0,
            isPopular: sub.isPopular || false,
          })),
        };
      })
    );

    // Filter out categories with no subservices (optional)
    const categoriesWithContent = categoriesWithSubservices.filter(cat => cat.subservices.length > 0);

    res.json({
      success: true,
      data: {
        categories: categoriesWithContent,
        totalCategories: categoriesWithContent.length,
        totalSubservices: categoriesWithContent.reduce((sum, cat) => sum + cat.subservices.length, 0),
      },
    });
  } catch (error) {
    console.error('❌ Error fetching categories with subservices:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch categories with subservices',
      error: error.message,
    });
  }
};