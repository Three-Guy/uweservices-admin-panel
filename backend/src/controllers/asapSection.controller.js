// src/controllers/asapSection.controller.js
const { getASAPSectionModel, getSubserviceModel, getCategoryModel } = require('../config/database');
const { deleteImage } = require('../config/cloudinary');

/**
 * Get all ASAP sections
 */
exports.getAllASAPSections = async (req, res) => {
  try {
    const ASAPSection = getASAPSectionModel();

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('📋 GET ALL ASAP SECTIONS');
    console.log('═══════════════════════════════════════════════════════════');

    const {
      page = 1,
      limit = 50,
      search = '',
      isActive,
      sortBy = 'sortOrder',
      sortOrder = 'asc',
    } = req.query;

    // Build query
    const query = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    // Build sort
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Execute query with population
    const sections = await ASAPSection.find(query)
      .populate({
        path: 'items.subservice',
        select: 'name subserviceId description icon iconName image images pricing duration rating isActive category categoryId',
        populate: {
          path: 'category',
          select: 'name categoryId icon',
        },
      })
      .populate('allowedCategories', 'name categoryId icon')
      .sort(sort)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .lean();

    const total = await ASAPSection.countDocuments(query);

    console.log(`✅ Found ${sections.length} ASAP sections (Total: ${total})`);
    console.log('═══════════════════════════════════════════════════════════\n');

    res.json({
      success: true,
      data: sections,
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
    console.error('❌ Error fetching ASAP sections:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch ASAP sections',
      error: error.message,
    });
  }
};

/**
 * Get ASAP section by ID
 */
exports.getASAPSectionById = async (req, res) => {
  try {
    const ASAPSection = getASAPSectionModel();
    const { id } = req.params;

    console.log(`\n📋 GET ASAP SECTION: ${id}`);

    const section = await ASAPSection.findById(id)
      .populate({
        path: 'items.subservice',
        select: 'name subserviceId description icon iconName image images pricing duration rating isActive category categoryId',
        populate: {
          path: 'category',
          select: 'name categoryId icon',
        },
      })
      .populate('allowedCategories', 'name categoryId icon')
      .lean();

    if (!section) {
      return res.status(404).json({
        success: false,
        message: 'ASAP section not found',
      });
    }

    console.log(`✅ Found section: ${section.name}`);

    res.json({
      success: true,
      data: section,
    });
  } catch (error) {
    console.error('❌ Error fetching ASAP section:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch ASAP section',
      error: error.message,
    });
  }
};

/**
 * Create ASAP section
 */
exports.createASAPSection = async (req, res) => {
  try {
    const ASAPSection = getASAPSectionModel();

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('📝 CREATE ASAP SECTION');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📦 Request body:', JSON.stringify(req.body, null, 2));

    const {
      name,
      title,
      subtitle,
      highlightText,
      description,
      icon,
      items,
      maxItems,
      allowedCategories,
      styling,
      arrivalTime,
      displaySettings,
      pricingModifier,
      targeting,
      schedule,
      position,
      sortOrder,
      isActive,
    } = req.body;

    // Validate required fields
    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Section name is required',
      });
    }

    if (!title) {
      return res.status(400).json({
        success: false,
        message: 'Section title is required',
      });
    }

    // Parse JSON fields
    const parseJSON = (field, defaultValue = {}) => {
      if (!field) return defaultValue;
      try {
        return typeof field === 'string' ? JSON.parse(field) : field;
      } catch (e) {
        console.error(`Failed to parse field:`, e);
        return defaultValue;
      }
    };

    // Parse arrival time
    const parsedArrivalTime = parseJSON(arrivalTime, { 
      minutes: 13, 
      displayFormat: 'Arrival Within {time} mins', 
      showBadge: true 
    });

    // Generate sectionId (IMPORTANT: Do this BEFORE creating the document)
    const timestamp = Date.now().toString(36);
    const nameSlug = name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
    const generatedSectionId = `${nameSlug}-${timestamp}`;

    console.log(`✅ Generated sectionId: ${generatedSectionId}`);

    // Generate highlightText
    const generatedHighlightText = highlightText || 
      parsedArrivalTime.displayFormat?.replace('{time}', parsedArrivalTime.minutes) || 
      `Arrival Within ${parsedArrivalTime.minutes} mins`;

    // Create section
    const section = new ASAPSection({
      sectionId: generatedSectionId,
      name,
      title: title || 'Need a Service Provider ASAP?',
      subtitle: subtitle || 'Get it done quickly!',
      highlightText: generatedHighlightText,
      description: description || '',
      icon: icon || '⚡',
      items: parseJSON(items, []),
      maxItems: maxItems ? parseInt(maxItems) : 2,
      allowedCategories: parseJSON(allowedCategories, []),
      styling: parseJSON(styling, {
        cardBackgroundColor: '#1a1a2e',
        cardBorderRadius: 32,
        cardPadding: 32,
        titleColor: '#ffffff',
        titleFontSize: 24,
        subtitleColor: 'rgba(255,255,255,0.6)',
        highlightColor: '#FF8C42',
        glowEffects: {
          enabled: true,
          topLeftColor: 'rgba(255, 140, 66, 0.3)',
          bottomRightColor: 'rgba(45, 107, 223, 0.3)',
        },
        buttonStyle: {
          backgroundColor: 'rgba(255,255,255,0.1)',
          borderRadius: 16,
          borderColor: 'rgba(255,255,255,0.1)',
          textColor: '#ffffff',
        },
      }),
      arrivalTime: parsedArrivalTime,
      displaySettings: parseJSON(displaySettings, {
        layout: 'row',
        maxItemsToShow: 2,
      }),
      pricingModifier: parseJSON(pricingModifier, {
        enabled: false,
        type: 'percentage',
        value: 0,
        displayText: '',
      }),
      targeting: parseJSON(targeting, {}),
      schedule: parseJSON(schedule, {}),
      position: position || 'after_banner',
      sortOrder: sortOrder ? parseInt(sortOrder) : 0,
      isActive: isActive !== false && isActive !== 'false',
      createdBy: req.user?._id || req.admin?._id,
    });

    console.log('📦 Section object before save:', {
      sectionId: section.sectionId,
      name: section.name,
      title: section.title,
      maxItems: section.maxItems,
    });

    await section.save();

    console.log('✅ Section saved successfully');

    // Populate for response
    await section.populate([
      {
        path: 'items.subservice',
        select: 'name subserviceId description icon iconName image images pricing duration rating isActive category categoryId',
        populate: {
          path: 'category',
          select: 'name categoryId icon',
        },
      },
      {
        path: 'allowedCategories',
        select: 'name categoryId icon',
      },
    ]);

    console.log(`✅ ASAP Section created: ${section.name} (${section.sectionId})`);
    console.log('═══════════════════════════════════════════════════════════\n');

    res.status(201).json({
      success: true,
      message: 'ASAP section created successfully',
      data: section,
    });
  } catch (error) {
    console.error('❌ Error creating ASAP section:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create ASAP section',
      error: error.message,
    });
  }
};

/**
 * Update ASAP section
 */
exports.updateASAPSection = async (req, res) => {
  try {
    const ASAPSection = getASAPSectionModel();
    const { id } = req.params;

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log(`📝 UPDATE ASAP SECTION: ${id}`);
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📦 Request body:', JSON.stringify(req.body, null, 2));

    const section = await ASAPSection.findById(id);

    if (!section) {
      return res.status(404).json({
        success: false,
        message: 'ASAP section not found',
      });
    }

    const {
      name,
      title,
      subtitle,
      highlightText,
      description,
      icon,
      items,
      maxItems,
      allowedCategories,
      styling,
      arrivalTime,
      displaySettings,
      pricingModifier,
      targeting,
      schedule,
      position,
      sortOrder,
      isActive,
    } = req.body;

    // Parse JSON helper
    const parseJSON = (field) => {
      if (field === undefined) return undefined;
      if (!field) return field;
      try {
        return typeof field === 'string' ? JSON.parse(field) : field;
      } catch (e) {
        console.error(`Failed to parse field:`, e);
        return undefined;
      }
    };

    // Update basic fields
    if (name !== undefined) section.name = name;
    if (title !== undefined) section.title = title;
    if (subtitle !== undefined) section.subtitle = subtitle;
    if (highlightText !== undefined) section.highlightText = highlightText;
    if (description !== undefined) section.description = description;
    if (icon !== undefined) section.icon = icon;
    if (position !== undefined) section.position = position;
    if (sortOrder !== undefined) section.sortOrder = parseInt(sortOrder);
    if (maxItems !== undefined) section.maxItems = parseInt(maxItems);
    if (isActive !== undefined) section.isActive = isActive === true || isActive === 'true';

    // Update items
    const parsedItems = parseJSON(items);
    if (parsedItems !== undefined) {
      section.items = parsedItems;
      console.log(`📦 Updated items: ${section.items.length} items`);
    }

    // Update allowedCategories
    const parsedCategories = parseJSON(allowedCategories);
    if (parsedCategories !== undefined) {
      section.allowedCategories = parsedCategories;
    }

    // Update styling
    const parsedStyling = parseJSON(styling);
    if (parsedStyling !== undefined) {
      const existingStyling = section.styling?.toObject?.() || section.styling || {};
      section.styling = { ...existingStyling, ...parsedStyling };
    }

    // Update arrivalTime
    const parsedArrivalTime = parseJSON(arrivalTime);
    if (parsedArrivalTime !== undefined) {
      const existingArrivalTime = section.arrivalTime?.toObject?.() || section.arrivalTime || {};
      section.arrivalTime = { ...existingArrivalTime, ...parsedArrivalTime };
    }

    // Update displaySettings
    const parsedDisplaySettings = parseJSON(displaySettings);
    if (parsedDisplaySettings !== undefined) {
      const existingDisplaySettings = section.displaySettings?.toObject?.() || section.displaySettings || {};
      section.displaySettings = { ...existingDisplaySettings, ...parsedDisplaySettings };
    }

    // Update pricingModifier
    const parsedPricingModifier = parseJSON(pricingModifier);
    if (parsedPricingModifier !== undefined) {
      const existingPricingModifier = section.pricingModifier?.toObject?.() || section.pricingModifier || {};
      section.pricingModifier = { ...existingPricingModifier, ...parsedPricingModifier };
    }

    // Update targeting
    const parsedTargeting = parseJSON(targeting);
    if (parsedTargeting !== undefined) {
      const existingTargeting = section.targeting?.toObject?.() || section.targeting || {};
      section.targeting = { ...existingTargeting, ...parsedTargeting };
    }

    // Update schedule
    const parsedSchedule = parseJSON(schedule);
    if (parsedSchedule !== undefined) {
      const existingSchedule = section.schedule?.toObject?.() || section.schedule || {};
      section.schedule = { ...existingSchedule, ...parsedSchedule };
    }

    section.updatedBy = req.user?._id || req.admin?._id;

    await section.save();

    // Populate for response
    await section.populate([
      {
        path: 'items.subservice',
        select: 'name subserviceId description icon iconName image images pricing duration rating isActive category categoryId',
        populate: {
          path: 'category',
          select: 'name categoryId icon',
        },
      },
      {
        path: 'allowedCategories',
        select: 'name categoryId icon',
      },
    ]);

    console.log(`✅ ASAP Section updated: ${section.name}`);
    console.log('═══════════════════════════════════════════════════════════\n');

    res.json({
      success: true,
      message: 'ASAP section updated successfully',
      data: section,
    });
  } catch (error) {
    console.error('❌ Error updating ASAP section:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update ASAP section',
      error: error.message,
    });
  }
};

/**
 * Delete ASAP section
 */
exports.deleteASAPSection = async (req, res) => {
  try {
    const ASAPSection = getASAPSectionModel();
    const { id } = req.params;

    console.log(`\n🗑️ DELETE ASAP SECTION: ${id}`);

    const section = await ASAPSection.findById(id);

    if (!section) {
      return res.status(404).json({
        success: false,
        message: 'ASAP section not found',
      });
    }

    // Delete any custom images from items
    for (const item of section.items) {
      if (item.customImage?.publicId) {
        await deleteImage(item.customImage.publicId).catch(console.error);
      }
    }

    await section.deleteOne();

    console.log(`✅ ASAP Section deleted: ${section.name}`);

    res.json({
      success: true,
      message: 'ASAP section deleted successfully',
    });
  } catch (error) {
    console.error('❌ Error deleting ASAP section:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete ASAP section',
      error: error.message,
    });
  }
};

/**
 * Get all categories for selection
 */
exports.getAllCategories = async (req, res) => {
  try {
    const Category = getCategoryModel();

    const categories = await Category.find({ isActive: true })
      .select('name categoryId icon image color isMoreServicesSection')
      .sort({ sortOrder: 1, name: 1 })
      .lean();

    res.json({
      success: true,
      data: categories,
    });
  } catch (error) {
    console.error('❌ Error fetching categories:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch categories',
      error: error.message,
    });
  }
};

/**
 * Get subservices by category ID
 * Returns subservices with their icons for auto-fetching
 */
exports.getSubservicesByCategory = async (req, res) => {
  try {
    const Subservice = getSubserviceModel();
    const Category = getCategoryModel();
    const { categoryId } = req.params;
    const { search = '', limit = 100, excludeIds = '' } = req.query;

    console.log(`\n🔍 GET SUBSERVICES BY CATEGORY: ${categoryId}`);

    // Verify category exists
    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found',
      });
    }

    // Build query
    const query = {
      category: categoryId,
      isActive: true,
    };

    // Exclude already selected subservices
    if (excludeIds) {
      const excludeArray = excludeIds.split(',').filter(id => id);
      if (excludeArray.length > 0) {
        query._id = { $nin: excludeArray };
      }
    }

    // Search filter
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    // Include icon and iconName fields for auto-fetching
    const subservices = await Subservice.find(query)
      .select('name subserviceId description icon iconName image images pricing duration rating isActive category categoryId')
      .limit(parseInt(limit))
      .sort({ name: 1 })
      .lean();

    console.log(`✅ Found ${subservices.length} subservices in category: ${category.name}`);
    
    // Log icons for debugging
    subservices.slice(0, 3).forEach(s => {
      console.log(`   - ${s.name}: icon=${s.icon || 'N/A'}, iconName=${s.iconName || 'N/A'}`);
    });

    res.json({
      success: true,
      data: {
        category: {
          _id: category._id,
          name: category.name,
          icon: category.icon,
          categoryId: category.categoryId,
        },
        subservices,
      },
    });
  } catch (error) {
    console.error('❌ Error fetching subservices by category:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch subservices',
      error: error.message,
    });
  }
};

/**
 * Add item to ASAP section
 * Auto-fetches icon from subservice if not provided
 */
exports.addItemToSection = async (req, res) => {
  try {
    const ASAPSection = getASAPSectionModel();
    const Subservice = getSubserviceModel();
    const { id } = req.params;

    console.log(`\n📦 ADD ITEM TO ASAP SECTION: ${id}`);
    console.log('📦 Request body:', req.body);

    const section = await ASAPSection.findById(id);

    if (!section) {
      return res.status(404).json({
        success: false,
        message: 'ASAP section not found',
      });
    }

    // Check max items limit
    if (section.items.length >= (section.maxItems || 2)) {
      return res.status(400).json({
        success: false,
        message: `Maximum ${section.maxItems || 2} items allowed in this section`,
      });
    }

    const {
      subserviceId,
      customName,
      customDescription,
      customIcon,
      customPriceText,
      customDurationText,
      navigationRoute,
      buttonColor,
      iconColor,
      sortOrder,
      isActive,
    } = req.body;

    if (!subserviceId) {
      return res.status(400).json({
        success: false,
        message: 'Subservice ID is required',
      });
    }

    // Check if subservice exists and get its icon
    const subservice = await Subservice.findById(subserviceId);
    if (!subservice) {
      return res.status(404).json({
        success: false,
        message: 'Subservice not found',
      });
    }

    // Check if already added
    const existingItem = section.items.find(
      item => item.subservice.toString() === subserviceId
    );
    if (existingItem) {
      return res.status(400).json({
        success: false,
        message: 'Subservice already added to this section',
      });
    }

    // Auto-fetch icon from subservice if not provided
    // Priority: customIcon from request > subservice.icon > subservice.iconName > default
    const resolvedIcon = customIcon || subservice.icon || subservice.iconName || '🔧';
    
    console.log(`📍 Icon resolution: customIcon=${customIcon}, subservice.icon=${subservice.icon}, subservice.iconName=${subservice.iconName}, resolved=${resolvedIcon}`);

    // Add item with auto-fetched or custom icon
    section.items.push({
      subservice: subserviceId,
      customName: customName || '',
      customDescription: customDescription || '',
      customIcon: resolvedIcon, // Store the resolved icon
      customPriceText: customPriceText || '',
      customDurationText: customDurationText || '',
      navigationRoute: navigationRoute || '',
      buttonColor: buttonColor || 'rgba(255,255,255,0.1)',
      iconColor: iconColor || '#FF8C42',
      sortOrder: sortOrder ? parseInt(sortOrder) : section.items.length,
      isActive: isActive !== false && isActive !== 'false',
    });

    section.updatedBy = req.user?._id || req.admin?._id;

    await section.save();

    // Populate for response
    await section.populate([
      {
        path: 'items.subservice',
        select: 'name subserviceId description icon iconName image images pricing duration rating isActive category categoryId',
        populate: {
          path: 'category',
          select: 'name categoryId icon',
        },
      },
      {
        path: 'allowedCategories',
        select: 'name categoryId icon',
      },
    ]);

    console.log(`✅ Item added to section: ${subservice.name} with icon: ${resolvedIcon}`);

    res.json({
      success: true,
      message: 'Item added to ASAP section successfully',
      data: section,
    });
  } catch (error) {
    console.error('❌ Error adding item to ASAP section:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add item to ASAP section',
      error: error.message,
    });
  }
};

/**
 * Update item in ASAP section
 */
exports.updateSectionItem = async (req, res) => {
  try {
    const ASAPSection = getASAPSectionModel();
    const { id, itemId } = req.params;

    console.log(`\n📝 UPDATE ITEM IN ASAP SECTION: ${id}, Item: ${itemId}`);
    console.log('📦 Request body:', req.body);

    const section = await ASAPSection.findById(id);

    if (!section) {
      return res.status(404).json({
        success: false,
        message: 'ASAP section not found',
      });
    }

    const itemIndex = section.items.findIndex(item => item._id.toString() === itemId);
    if (itemIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Item not found in section',
      });
    }

    const {
      customName,
      customDescription,
      customIcon,
      customPriceText,
      customDurationText,
      navigationRoute,
      buttonColor,
      iconColor,
      sortOrder,
      isActive,
    } = req.body;

    // Update item fields
    if (customName !== undefined) section.items[itemIndex].customName = customName;
    if (customDescription !== undefined) section.items[itemIndex].customDescription = customDescription;
    if (customIcon !== undefined) section.items[itemIndex].customIcon = customIcon;
    if (customPriceText !== undefined) section.items[itemIndex].customPriceText = customPriceText;
    if (customDurationText !== undefined) section.items[itemIndex].customDurationText = customDurationText;
    if (navigationRoute !== undefined) section.items[itemIndex].navigationRoute = navigationRoute;
    if (buttonColor !== undefined) section.items[itemIndex].buttonColor = buttonColor;
    if (iconColor !== undefined) section.items[itemIndex].iconColor = iconColor;
    if (sortOrder !== undefined) section.items[itemIndex].sortOrder = parseInt(sortOrder);
    if (isActive !== undefined) section.items[itemIndex].isActive = isActive === true || isActive === 'true';

    section.updatedBy = req.user?._id || req.admin?._id;

    await section.save();

    // Populate for response
    await section.populate([
      {
        path: 'items.subservice',
        select: 'name subserviceId description icon iconName image images pricing duration rating isActive category categoryId',
        populate: {
          path: 'category',
          select: 'name categoryId icon',
        },
      },
      {
        path: 'allowedCategories',
        select: 'name categoryId icon',
      },
    ]);

    console.log(`✅ Item updated in section`);

    res.json({
      success: true,
      message: 'Item updated successfully',
      data: section,
    });
  } catch (error) {
    console.error('❌ Error updating item in ASAP section:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update item',
      error: error.message,
    });
  }
};

/**
 * Remove item from ASAP section
 */
exports.removeItemFromSection = async (req, res) => {
  try {
    const ASAPSection = getASAPSectionModel();
    const { id, itemId } = req.params;

    console.log(`\n🗑️ REMOVE ITEM FROM ASAP SECTION: ${id}, Item: ${itemId}`);

    const section = await ASAPSection.findById(id);

    if (!section) {
      return res.status(404).json({
        success: false,
        message: 'ASAP section not found',
      });
    }

    const itemIndex = section.items.findIndex(item => item._id.toString() === itemId);
    if (itemIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Item not found in section',
      });
    }

    // Delete custom image if exists
    if (section.items[itemIndex].customImage?.publicId) {
      await deleteImage(section.items[itemIndex].customImage.publicId).catch(console.error);
    }

    // Remove item
    section.items.splice(itemIndex, 1);

    section.updatedBy = req.user?._id || req.admin?._id;

    await section.save();

    console.log(`✅ Item removed from section`);

    res.json({
      success: true,
      message: 'Item removed from ASAP section successfully',
      data: section,
    });
  } catch (error) {
    console.error('❌ Error removing item from ASAP section:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove item',
      error: error.message,
    });
  }
};

/**
 * Reorder items in ASAP section
 */
exports.reorderSectionItems = async (req, res) => {
  try {
    const ASAPSection = getASAPSectionModel();
    const { id } = req.params;
    const { items } = req.body;

    console.log(`\n🔄 REORDER ITEMS IN ASAP SECTION: ${id}`);

    if (!Array.isArray(items)) {
      return res.status(400).json({
        success: false,
        message: 'Items must be an array',
      });
    }

    const section = await ASAPSection.findById(id);

    if (!section) {
      return res.status(404).json({
        success: false,
        message: 'ASAP section not found',
      });
    }

    // Update sort orders
    items.forEach((item) => {
      const sectionItem = section.items.find(i => i._id.toString() === item.id);
      if (sectionItem) {
        sectionItem.sortOrder = item.sortOrder;
      }
    });

    // Sort items array by sortOrder
    section.items.sort((a, b) => a.sortOrder - b.sortOrder);

    section.updatedBy = req.user?._id || req.admin?._id;

    await section.save();

    console.log(`✅ Items reordered`);

    res.json({
      success: true,
      message: 'Items reordered successfully',
      data: section,
    });
  } catch (error) {
    console.error('❌ Error reordering items:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reorder items',
      error: error.message,
    });
  }
};

/**
 * Get active ASAP sections for mobile app
 */
exports.getActiveSectionsForApp = async (req, res) => {
  try {
    const ASAPSection = getASAPSectionModel();

    console.log('\n📱 GET ACTIVE ASAP SECTIONS FOR APP');

    const { cityId, platform = 'all' } = req.query;

    // Use static method if available, otherwise manual query
    let sections;
    if (typeof ASAPSection.getActiveSections === 'function') {
      sections = await ASAPSection.getActiveSections({ cityId, platform });
    } else {
      // Manual query fallback
      const query = { isActive: true };
      sections = await ASAPSection.find(query)
        .populate({
          path: 'items.subservice',
          select: 'name description icon iconName image pricing duration rating isActive categoryId',
          populate: {
            path: 'category',
            select: 'name categoryId icon',
          },
        })
        .sort({ sortOrder: 1 })
        .lean();

      // Filter out inactive items
      sections = sections.map(section => ({
        ...section,
        items: section.items
          .filter(item => item.isActive && item.subservice && item.subservice.isActive)
          .slice(0, section.displaySettings?.maxItemsToShow || 2),
      }));
    }

    // Transform for mobile app - matching Emergency.tsx structure
    const transformedSections = sections
      .filter(section => section.items && section.items.length > 0)
      .map(section => ({
        id: section._id,
        sectionId: section.sectionId,
        // Main content
        title: section.title,
        subtitle: section.subtitle,
        highlightText: section.highlightText || section.arrivalTime?.displayFormat?.replace('{time}', section.arrivalTime?.minutes || 13),
        icon: section.icon,
        // Arrival time
        arrivalTime: {
          minutes: section.arrivalTime?.minutes || 13,
          displayText: section.highlightText || `Arrival Within ${section.arrivalTime?.minutes || 13} mins`,
        },
        // Styling
        styling: section.styling,
        // Position
        position: section.position,
        // Items (services/buttons)
        items: section.items.map(item => ({
          id: item._id,
          subserviceId: item.subservice?._id,
          // Display name (custom or original)
          name: item.customName || item.subservice?.name || 'Service',
          description: item.customDescription || item.subservice?.description || '',
          // Icon (custom or from subservice) - This is the key change
          icon: item.customIcon || item.subservice?.icon || item.subservice?.iconName || 'build',
          // Navigation
          navigationRoute: item.navigationRoute || `/services/${item.subservice?.categoryId || 'default'}`,
          // Styling
          buttonColor: item.buttonColor || 'rgba(255,255,255,0.1)',
          iconColor: item.iconColor || '#FF8C42',
          // Pricing
          price: item.customPriceText || item.subservice?.pricing?.displayText || '',
          duration: item.customDurationText || item.subservice?.duration?.displayText || '',
          // Category info
          category: item.subservice?.category ? {
            id: item.subservice.category._id,
            name: item.subservice.category.name,
            icon: item.subservice.category.icon,
          } : null,
        })),
        // Display settings
        displaySettings: section.displaySettings,
      }));

    console.log(`✅ Found ${transformedSections.length} active sections`);

    res.json({
      success: true,
      data: transformedSections,
    });
  } catch (error) {
    console.error('❌ Error fetching ASAP sections for app:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch ASAP sections',
      error: error.message,
    });
  }
};

/**
 * Get available subservices for adding to ASAP section
 */
exports.getAvailableSubservices = async (req, res) => {
  try {
    const ASAPSection = getASAPSectionModel();
    const Subservice = getSubserviceModel();
    const { id } = req.params;
    const { search = '', categoryId, limit = 50 } = req.query;

    console.log(`\n🔍 GET AVAILABLE SUBSERVICES FOR ASAP SECTION: ${id}`);

    // Get section to find already added subservices
    const section = await ASAPSection.findById(id);
    const addedSubserviceIds = section ? section.items.map(item => item.subservice.toString()) : [];

    // Build query
    const query = {
      isActive: true,
      _id: { $nin: addedSubserviceIds }, // Exclude already added
    };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    if (categoryId) {
      query.category = categoryId;
    }

    // Include icon and iconName for auto-fetching
    const subservices = await Subservice.find(query)
      .populate('category', 'name categoryId icon')
      .select('name subserviceId description icon iconName image images pricing duration rating category')
      .limit(parseInt(limit))
      .sort({ name: 1 })
      .lean();

    console.log(`✅ Found ${subservices.length} available subservices`);

    res.json({
      success: true,
      data: subservices,
    });
  } catch (error) {
    console.error('❌ Error fetching available subservices:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch available subservices',
      error: error.message,
    });
  }
};

/**
 * Bulk update items in ASAP section
 */
exports.bulkUpdateItems = async (req, res) => {
  try {
    const ASAPSection = getASAPSectionModel();
    const Subservice = getSubserviceModel();
    const { id } = req.params;
    const { items } = req.body;

    console.log(`\n📦 BULK UPDATE ITEMS IN ASAP SECTION: ${id}`);

    if (!Array.isArray(items)) {
      return res.status(400).json({
        success: false,
        message: 'Items must be an array',
      });
    }

    const section = await ASAPSection.findById(id);

    if (!section) {
      return res.status(404).json({
        success: false,
        message: 'ASAP section not found',
      });
    }

    // Check max items limit
    if (items.length > (section.maxItems || 2)) {
      return res.status(400).json({
        success: false,
        message: `Maximum ${section.maxItems || 2} items allowed in this section`,
      });
    }

    // Process items and auto-fetch icons if needed
    const processedItems = await Promise.all(items.map(async (item, index) => {
      let resolvedIcon = item.customIcon;
      
      // If no icon provided, fetch from subservice
      if (!resolvedIcon) {
        const subserviceId = item.subservice || item.subserviceId;
        if (subserviceId) {
          const subservice = await Subservice.findById(subserviceId).select('icon iconName').lean();
          if (subservice) {
            resolvedIcon = subservice.icon || subservice.iconName || '🔧';
          }
        }
      }

      return {
        subservice: item.subservice || item.subserviceId,
        customName: item.customName || '',
        customDescription: item.customDescription || '',
        customIcon: resolvedIcon || '🔧',
        customPriceText: item.customPriceText || '',
        customDurationText: item.customDurationText || '',
        navigationRoute: item.navigationRoute || '',
        buttonColor: item.buttonColor || 'rgba(255,255,255,0.1)',
        iconColor: item.iconColor || '#FF8C42',
        customImage: item.customImage || { url: null, publicId: null },
        sortOrder: item.sortOrder !== undefined ? item.sortOrder : index,
        isActive: item.isActive !== false,
      };
    }));

    // Replace all items
    section.items = processedItems;
    section.updatedBy = req.user?._id || req.admin?._id;

    await section.save();

    // Populate for response
    await section.populate([
      {
        path: 'items.subservice',
        select: 'name subserviceId description icon iconName image images pricing duration rating isActive category categoryId',
        populate: {
          path: 'category',
          select: 'name categoryId icon',
        },
      },
      {
        path: 'allowedCategories',
        select: 'name categoryId icon',
      },
    ]);

    console.log(`✅ Bulk updated ${section.items.length} items`);

    res.json({
      success: true,
      message: 'Items updated successfully',
      data: section,
    });
  } catch (error) {
    console.error('❌ Error bulk updating items:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update items',
      error: error.message,
    });
  }
};

/**
 * Clone ASAP section
 */
exports.cloneASAPSection = async (req, res) => {
  try {
    const ASAPSection = getASAPSectionModel();
    const { id } = req.params;
    const { name } = req.body;

    console.log(`\n📋 CLONE ASAP SECTION: ${id}`);

    const originalSection = await ASAPSection.findById(id).lean();

    if (!originalSection) {
      return res.status(404).json({
        success: false,
        message: 'ASAP section not found',
      });
    }

    // Generate new sectionId
    const timestamp = Date.now().toString(36);
    const cloneName = name || `${originalSection.name} (Copy)`;
    const nameSlug = cloneName
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
    const newSectionId = `${nameSlug}-${timestamp}`;

    // Remove _id fields
    delete originalSection._id;
    originalSection.items = originalSection.items.map(item => {
      delete item._id;
      return item;
    });

    // Create cloned section
    const clonedSection = new ASAPSection({
      ...originalSection,
      sectionId: newSectionId,
      name: cloneName,
      title: `${originalSection.title}`,
      isActive: false, // Start as inactive
      analytics: { impressions: 0, clicks: 0, conversions: 0 },
      createdBy: req.user?._id || req.admin?._id,
      createdAt: undefined,
      updatedAt: undefined,
    });

    await clonedSection.save();

    console.log(`✅ Section cloned: ${clonedSection.name}`);

    res.status(201).json({
      success: true,
      message: 'ASAP section cloned successfully',
      data: clonedSection,
    });
  } catch (error) {
    console.error('❌ Error cloning ASAP section:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clone ASAP section',
      error: error.message,
    });
  }
};

/**
 * Seed default ASAP section (for initial setup)
 */
exports.seedDefaultSection = async (req, res) => {
  try {
    const ASAPSection = getASAPSectionModel();

    console.log('\n🌱 SEEDING DEFAULT ASAP SECTION');

    // Check if any section exists
    const existingCount = await ASAPSection.countDocuments();
    if (existingCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'ASAP sections already exist. Delete them first to reseed.',
      });
    }

    // Generate sectionId
    const timestamp = Date.now().toString(36);
    const sectionId = `emergency-services-${timestamp}`;

    // Create default section matching the Emergency.tsx component
    const defaultSection = new ASAPSection({
      sectionId: sectionId,
      name: 'Emergency Services',
      title: 'Need a Service Provider ASAP?',
      subtitle: 'Get urgent help right away',
      highlightText: 'Arrival Within 13 mins',
      description: 'Quick emergency services for your urgent needs',
      icon: '⚡',
      maxItems: 2,
      arrivalTime: {
        minutes: 13,
        displayFormat: 'Arrival Within {time} mins',
        showBadge: true,
      },
      styling: {
        cardBackgroundColor: '#1a1a2e',
        cardBorderRadius: 32,
        cardPadding: 32,
        titleColor: '#ffffff',
        titleFontSize: 24,
        subtitleColor: 'rgba(255,255,255,0.6)',
        highlightColor: '#FF8C42',
        glowEffects: {
          enabled: true,
          topLeftColor: 'rgba(255, 140, 66, 0.3)',
          bottomRightColor: 'rgba(45, 107, 223, 0.3)',
        },
        buttonStyle: {
          backgroundColor: 'rgba(255,255,255,0.1)',
          borderRadius: 16,
          borderColor: 'rgba(255,255,255,0.1)',
          textColor: '#ffffff',
        },
      },
      displaySettings: {
        layout: 'row',
        maxItemsToShow: 2,
        cardStyle: {
          showImage: false,
          showIcon: true,
          showPrice: false,
          showDuration: false,
        },
      },
      position: 'after_banner',
      sortOrder: 0,
      isActive: true,
      items: [], // Items will be added via the admin panel
      createdBy: req.user?._id || req.admin?._id,
    });

    await defaultSection.save();

    console.log(`✅ Default ASAP Section created: ${defaultSection.name} (${defaultSection.sectionId})`);

    res.status(201).json({
      success: true,
      message: 'Default ASAP section created successfully. Now add subservices via the admin panel.',
      data: defaultSection,
    });
  } catch (error) {
    console.error('❌ Error seeding default section:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to seed default section',
      error: error.message,
    });
  }
};