// src/controllers/layout.controller.js
const { getLayoutConfigModel } = require('../config/database');
const mongoose = require('mongoose');

/**
 * Normalize section data to ensure compatibility
 */
const normalizeSection = (section, page, index) => {
  // Create a clean section object
  const normalized = {
    sectionId: section.sectionId || `${page}-section-${index + 1}-${Date.now().toString(36)}`,
    type: section.type,
    enabled: section.enabled !== false,
    order: typeof section.order === 'number' ? section.order : index,
    title: section.title || '',
    subtitle: section.subtitle || '',
    showViewAll: section.showViewAll || false,
    viewAllTarget: section.viewAllTarget || '',
    dataSource: section.dataSource || '',
    
    // Layout configuration
    layout: {
      style: section.layout?.style || 'grid',
      columns: section.layout?.columns || 2,
      rows: section.layout?.rows || 2,
      itemsToShow: section.layout?.itemsToShow || 4,
      spacing: section.layout?.spacing || 16,
      showBorder: section.layout?.showBorder || false,
      roundedCorners: section.layout?.roundedCorners || 12,
      aspectRatio: section.layout?.aspectRatio || '16:9',
      autoScroll: section.layout?.autoScroll || false,
      autoScrollInterval: section.layout?.autoScrollInterval || 3000,
      showIndicators: section.layout?.showIndicators !== false,
      showArrows: section.layout?.showArrows || false,
      snapToItem: section.layout?.snapToItem !== false,
      itemWidth: section.layout?.itemWidth || null,
      itemHeight: section.layout?.itemHeight || null,
    },
    
    // Style configuration
    style: {
      backgroundColor: section.style?.backgroundColor || 'transparent',
      paddingTop: section.style?.paddingTop || 0,
      paddingBottom: section.style?.paddingBottom || 0,
      paddingHorizontal: section.style?.paddingHorizontal || 16,
      marginTop: section.style?.marginTop || 0,
      marginBottom: section.style?.marginBottom || 24,
      borderRadius: section.style?.borderRadius || 0,
      borderWidth: section.style?.borderWidth || 0,
      borderColor: section.style?.borderColor || 'transparent',
      shadowEnabled: section.style?.shadowEnabled || false,
      shadowColor: section.style?.shadowColor || 'rgba(0,0,0,0.1)',
      shadowOffset: section.style?.shadowOffset || 2,
      shadowRadius: section.style?.shadowRadius || 4,
    },
    
    // Card style configuration
    cardStyle: {
      showImage: section.cardStyle?.showImage !== false,
      showTitle: section.cardStyle?.showTitle !== false,
      showSubtitle: section.cardStyle?.showSubtitle || false,
      showPrice: section.cardStyle?.showPrice || false,
      showRating: section.cardStyle?.showRating || false,
      showBadge: section.cardStyle?.showBadge !== false,
      imageAspectRatio: section.cardStyle?.imageAspectRatio || '16:9',
      titleLines: section.cardStyle?.titleLines || 2,
      showDescription: section.cardStyle?.showDescription || false,
      descriptionLines: section.cardStyle?.descriptionLines || 2,
      showButton: section.cardStyle?.showButton || false,
      buttonText: section.cardStyle?.buttonText || 'View',
      showIcon: section.cardStyle?.showIcon !== false,
      showDiscount: section.cardStyle?.showDiscount || false,
      showAvailability: section.cardStyle?.showAvailability || false,
      imagePosition: section.cardStyle?.imagePosition || 'top',
      cardBackground: section.cardStyle?.cardBackground || '#FFFFFF',
      titleColor: section.cardStyle?.titleColor || '#1F2937',
      subtitleColor: section.cardStyle?.subtitleColor || '#6B7280',
      priceColor: section.cardStyle?.priceColor || '#059669',
    },
    
    // Filters
    filters: {
      categories: section.filters?.categories || [],
      services: section.filters?.services || [],
      tags: section.filters?.tags || [],
      cities: section.filters?.cities || [],
      isPopular: section.filters?.isPopular ?? null,
      isFeatured: section.filters?.isFeatured ?? null,
      isEmergency: section.filters?.isEmergency ?? null,
      isTrending: section.filters?.isTrending ?? null,
      minRating: section.filters?.minRating ?? null,
      maxPrice: section.filters?.maxPrice ?? null,
      minPrice: section.filters?.minPrice ?? null,
      providers: section.filters?.providers || [],
      sortBy: section.filters?.sortBy || '',
      sortOrder: section.filters?.sortOrder || '',
      limit: section.filters?.limit ?? null,
    },
    
    // Custom data
    customData: section.customData || {},
    
    // A/B Testing
    abTest: {
      enabled: section.abTest?.enabled || false,
      variantId: section.abTest?.variantId || '',
      testName: section.abTest?.testName || '',
      trafficPercentage: section.abTest?.trafficPercentage || 50,
    },
    
    // Visibility
    visibility: {
      requireAuth: section.visibility?.requireAuth || false,
      newUsersOnly: section.visibility?.newUsersOnly || false,
      platforms: section.visibility?.platforms?.length > 0 ? section.visibility.platforms : ['all'],
      minAppVersion: section.visibility?.minAppVersion || '',
      maxAppVersion: section.visibility?.maxAppVersion || '',
      startDate: section.visibility?.startDate || null,
      endDate: section.visibility?.endDate || null,
      userSegments: section.visibility?.userSegments || [],
      excludeUserSegments: section.visibility?.excludeUserSegments || [],
      geoLocations: section.visibility?.geoLocations || [],
      languages: section.visibility?.languages || [],
      isScheduled: section.visibility?.isScheduled || false,
    },
    
    // Actions
    actions: {
      onTap: {
        actionType: section.actions?.onTap?.actionType || '',
        target: section.actions?.onTap?.target || '',
        params: section.actions?.onTap?.params || {},
      },
      onViewAll: {
        actionType: section.actions?.onViewAll?.actionType || '',
        target: section.actions?.onViewAll?.target || '',
        params: section.actions?.onViewAll?.params || {},
      },
    },
    
    // Animation
    animation: {
      enabled: section.animation?.enabled || false,
      animationType: section.animation?.animationType || '',
      duration: section.animation?.duration || 300,
      delay: section.animation?.delay || 0,
    },
  };

  // Normalize layout style - map legacy values
  const styleMapping = {
    'horizontal': 'horizontal-scroll',
    'scroll': 'horizontal-scroll',
  };
  if (styleMapping[normalized.layout.style]) {
    normalized.layout.style = styleMapping[normalized.layout.style];
  }

  return normalized;
};

/**
 * Get all layouts
 */
exports.getLayouts = async (req, res) => {
  try {
    console.log('📋 Fetching all layouts...');
    const LayoutConfig = getLayoutConfigModel();
    
    const layouts = await LayoutConfig.find()
      .sort({ page: 1 })
      .lean();

    console.log(`✅ Found ${layouts.length} layouts`);

    res.json({
      success: true,
      data: layouts,
    });
  } catch (error) {
    console.error('❌ Error fetching layouts:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch layouts',
      error: error.message,
    });
  }
};

/**
 * Get layout by page name
 */
exports.getLayoutByPage = async (req, res) => {
  try {
    const LayoutConfig = getLayoutConfigModel();
    const { page } = req.params;

    console.log(`📋 Fetching layout for page: ${page}`);

    let layout = await LayoutConfig.findOne({ page, isActive: true });

    // If no layout exists, create default
    if (!layout) {
      console.log(`📋 No layout found, creating default for: ${page}`);
      layout = await LayoutConfig.createDefaultLayout(page);
    }

    console.log(`✅ Layout found: ${layout.page}, sections: ${layout.sections?.length || 0}`);

    res.json({
      success: true,
      data: layout,
    });
  } catch (error) {
    console.error('❌ Error fetching layout:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch layout',
      error: error.message,
    });
  }
};

/**
 * Create new layout
 */
exports.createLayout = async (req, res) => {
  try {
    const LayoutConfig = getLayoutConfigModel();
    
    const {
      page,
      pageName,
      description,
      sections,
      settings,
    } = req.body;

    console.log(`📝 Creating layout for page: ${page}`);

    // Check if layout already exists
    const existingLayout = await LayoutConfig.findOne({ page });
    
    if (existingLayout) {
      return res.status(400).json({
        success: false,
        message: `Layout for page "${page}" already exists`,
      });
    }

    // Normalize sections
    const normalizedSections = (sections || []).map((section, index) => 
      normalizeSection(section, page, index)
    );

    const layout = new LayoutConfig({
      page,
      pageName: pageName || page.charAt(0).toUpperCase() + page.slice(1),
      description: description || '',
      sections: normalizedSections,
      settings: settings || {},
      isActive: true,
      isPublished: false,
      version: 1,
      createdBy: req.user?._id || req.admin?._id,
    });

    await layout.save();

    console.log(`✅ Layout created: ${layout.page}`);

    res.status(201).json({
      success: true,
      message: 'Layout created successfully',
      data: layout,
    });
  } catch (error) {
    console.error('❌ Error creating layout:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create layout',
      error: error.message,
    });
  }
};

/**
 * Update layout
 */
exports.updateLayout = async (req, res) => {
  try {
    const LayoutConfig = getLayoutConfigModel();
    const { id } = req.params;

    console.log(`📝 Updating layout: ${id}`);

    const layout = await LayoutConfig.findById(id);

    if (!layout) {
      return res.status(404).json({
        success: false,
        message: 'Layout not found',
      });
    }

    const {
      pageName,
      description,
      sections,
      settings,
      isActive,
    } = req.body;

    // Update fields
    if (pageName !== undefined) layout.pageName = pageName;
    if (description !== undefined) layout.description = description;
    if (sections !== undefined) {
      layout.sections = sections.map((section, index) => 
        normalizeSection(section, layout.page, index)
      );
    }
    if (settings !== undefined) layout.settings = { ...layout.settings, ...settings };
    if (isActive !== undefined) layout.isActive = isActive;
    
    layout.updatedBy = req.user?._id || req.admin?._id;
    layout.updatedAt = new Date();

    await layout.save();

    console.log(`✅ Layout updated: ${layout.page}`);

    res.json({
      success: true,
      message: 'Layout updated successfully',
      data: layout,
    });
  } catch (error) {
    console.error('❌ Error updating layout:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update layout',
      error: error.message,
    });
  }
};

/**
 * Update layout sections - FIXED VERSION
 */
exports.updateSections = async (req, res) => {
  try {
    const LayoutConfig = getLayoutConfigModel();
    const { id } = req.params;
    const { sections } = req.body;

    console.log(`📝 Updating sections for layout: ${id}`);
    console.log(`📝 Received ${sections?.length || 0} sections`);

    // Validate ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid layout ID',
      });
    }

    const layout = await LayoutConfig.findById(id);

    if (!layout) {
      console.log(`❌ Layout not found: ${id}`);
      return res.status(404).json({
        success: false,
        message: 'Layout not found',
      });
    }

    if (!Array.isArray(sections)) {
      return res.status(400).json({
        success: false,
        message: 'Sections must be an array',
      });
    }

    // Normalize sections
    const normalizedSections = sections.map((section, index) => 
      normalizeSection(section, layout.page, index)
    );

    console.log(`📝 Normalized ${normalizedSections.length} sections`);

    // Update using findByIdAndUpdate to avoid validation issues
    const updatedLayout = await LayoutConfig.findByIdAndUpdate(
      id,
      {
        $set: {
          sections: normalizedSections,
          updatedBy: req.user?._id || req.admin?._id,
          updatedAt: new Date(),
        }
      },
      { 
        new: true, 
        runValidators: false // Skip validation for complex nested objects
      }
    );

    if (!updatedLayout) {
      return res.status(500).json({
        success: false,
        message: 'Failed to update sections',
      });
    }

    console.log(`✅ Sections updated for layout: ${updatedLayout.page}`);
    console.log(`✅ New sections count: ${updatedLayout.sections.length}`);

    res.json({
      success: true,
      message: 'Sections updated successfully',
      data: updatedLayout,
    });
  } catch (error) {
    console.error('❌ Error updating sections:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update sections',
      error: error.message,
    });
  }
};

/**
 * Reorder sections
 */
exports.reorderSections = async (req, res) => {
  try {
    const LayoutConfig = getLayoutConfigModel();
    const { id } = req.params;
    const { sections } = req.body;

    console.log(`📝 Reordering sections for layout: ${id}`);

    const layout = await LayoutConfig.findById(id);

    if (!layout) {
      return res.status(404).json({
        success: false,
        message: 'Layout not found',
      });
    }

    // Update order for each section
    sections.forEach((item) => {
      const section = layout.sections.find(s => s.sectionId === item.sectionId);
      if (section) {
        section.order = item.order;
      }
    });

    // Sort sections by order
    layout.sections.sort((a, b) => a.order - b.order);

    // Save using updateOne to avoid validation issues
    await LayoutConfig.updateOne(
      { _id: id },
      { 
        $set: { 
          sections: layout.sections,
          updatedBy: req.user?._id || req.admin?._id,
          updatedAt: new Date(),
        }
      }
    );

    const updatedLayout = await LayoutConfig.findById(id);

    console.log(`✅ Sections reordered for layout: ${updatedLayout.page}`);

    res.json({
      success: true,
      message: 'Sections reordered successfully',
      data: updatedLayout,
    });
  } catch (error) {
    console.error('❌ Error reordering sections:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reorder sections',
      error: error.message,
    });
  }
};

/**
 * Toggle section enabled/disabled
 */
exports.toggleSection = async (req, res) => {
  try {
    const LayoutConfig = getLayoutConfigModel();
    const { id, sectionId } = req.params;
    const { enabled } = req.body;

    console.log(`📝 Toggling section: ${sectionId} to ${enabled}`);

    const layout = await LayoutConfig.findById(id);

    if (!layout) {
      return res.status(404).json({
        success: false,
        message: 'Layout not found',
      });
    }

    const sectionIndex = layout.sections.findIndex(s => s.sectionId === sectionId);

    if (sectionIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Section not found',
      });
    }

    layout.sections[sectionIndex].enabled = enabled;

    await LayoutConfig.updateOne(
      { _id: id },
      { 
        $set: { 
          sections: layout.sections,
          updatedBy: req.user?._id || req.admin?._id,
          updatedAt: new Date(),
        }
      }
    );

    const updatedLayout = await LayoutConfig.findById(id);

    console.log(`✅ Section toggled: ${sectionId} = ${enabled}`);

    res.json({
      success: true,
      message: `Section ${enabled ? 'enabled' : 'disabled'} successfully`,
      data: updatedLayout,
    });
  } catch (error) {
    console.error('❌ Error toggling section:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to toggle section',
      error: error.message,
    });
  }
};

/**
 * Update single section config
 */
exports.updateSectionConfig = async (req, res) => {
  try {
    const LayoutConfig = getLayoutConfigModel();
    const { id, sectionId } = req.params;
    const updates = req.body;

    console.log(`📝 Updating section config: ${sectionId}`);

    const layout = await LayoutConfig.findById(id);

    if (!layout) {
      return res.status(404).json({
        success: false,
        message: 'Layout not found',
      });
    }

    const sectionIndex = layout.sections.findIndex(s => s.sectionId === sectionId);

    if (sectionIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Section not found',
      });
    }

    // Get existing section as plain object
    const existingSection = layout.sections[sectionIndex].toObject 
      ? layout.sections[sectionIndex].toObject() 
      : layout.sections[sectionIndex];
    
    // Merge updates
    const mergedSection = {
      ...existingSection,
      ...updates,
      sectionId: existingSection.sectionId, // Keep original sectionId
    };

    // Normalize and update
    layout.sections[sectionIndex] = normalizeSection(mergedSection, layout.page, sectionIndex);

    await LayoutConfig.updateOne(
      { _id: id },
      { 
        $set: { 
          sections: layout.sections,
          updatedBy: req.user?._id || req.admin?._id,
          updatedAt: new Date(),
        }
      }
    );

    const updatedLayout = await LayoutConfig.findById(id);

    console.log(`✅ Section config updated: ${sectionId}`);

    res.json({
      success: true,
      message: 'Section config updated successfully',
      data: updatedLayout.sections[sectionIndex],
    });
  } catch (error) {
    console.error('❌ Error updating section config:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update section config',
      error: error.message,
    });
  }
};

/**
 * Add new section to layout
 */
exports.addSection = async (req, res) => {
  try {
    const LayoutConfig = getLayoutConfigModel();
    const { id } = req.params;
    const sectionData = req.body;

    console.log(`📝 Adding section to layout: ${id}`);
    console.log(`📝 Section type: ${sectionData.type}`);

    const layout = await LayoutConfig.findById(id);

    if (!layout) {
      return res.status(404).json({
        success: false,
        message: 'Layout not found',
      });
    }

    // Generate section ID
    const sectionId = sectionData.sectionId || 
      `${layout.page}-${sectionData.type || 'section'}-${Date.now()}`;

    // Calculate order (add to end)
    const maxOrder = layout.sections.reduce((max, s) => Math.max(max, s.order || 0), -1);

    const newSection = normalizeSection({
      ...sectionData,
      sectionId,
      order: typeof sectionData.order === 'number' ? sectionData.order : maxOrder + 1,
    }, layout.page, layout.sections.length);

    // Add section
    layout.sections.push(newSection);

    await LayoutConfig.updateOne(
      { _id: id },
      { 
        $set: { 
          sections: layout.sections,
          updatedBy: req.user?._id || req.admin?._id,
          updatedAt: new Date(),
        }
      }
    );

    const updatedLayout = await LayoutConfig.findById(id);

    console.log(`✅ Section added: ${sectionId}`);
    console.log(`✅ Total sections: ${updatedLayout.sections.length}`);

    res.status(201).json({
      success: true,
      message: 'Section added successfully',
      data: newSection,
    });
  } catch (error) {
    console.error('❌ Error adding section:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add section',
      error: error.message,
    });
  }
};

/**
 * Delete section from layout
 */
exports.deleteSection = async (req, res) => {
  try {
    const LayoutConfig = getLayoutConfigModel();
    const { id, sectionId } = req.params;

    console.log(`🗑️ Deleting section: ${sectionId} from layout: ${id}`);

    const layout = await LayoutConfig.findById(id);

    if (!layout) {
      return res.status(404).json({
        success: false,
        message: 'Layout not found',
      });
    }

    const sectionIndex = layout.sections.findIndex(s => s.sectionId === sectionId);

    if (sectionIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Section not found',
      });
    }

    // Remove section
    layout.sections.splice(sectionIndex, 1);

    // Reorder remaining sections
    layout.sections.forEach((section, index) => {
      section.order = index;
    });

    await LayoutConfig.updateOne(
      { _id: id },
      { 
        $set: { 
          sections: layout.sections,
          updatedBy: req.user?._id || req.admin?._id,
          updatedAt: new Date(),
        }
      }
    );

    console.log(`✅ Section deleted: ${sectionId}`);

    res.json({
      success: true,
      message: 'Section deleted successfully',
    });
  } catch (error) {
    console.error('❌ Error deleting section:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete section',
      error: error.message,
    });
  }
};

/**
 * Save draft
 */
exports.saveDraft = async (req, res) => {
  try {
    const LayoutConfig = getLayoutConfigModel();
    const { id } = req.params;
    const { sections, settings } = req.body;

    console.log(`📝 Saving draft for layout: ${id}`);

    const layout = await LayoutConfig.findById(id);

    if (!layout) {
      return res.status(404).json({
        success: false,
        message: 'Layout not found',
      });
    }

    const normalizedSections = sections 
      ? sections.map((section, index) => normalizeSection(section, layout.page, index))
      : layout.sections;

    await LayoutConfig.updateOne(
      { _id: id },
      { 
        $set: { 
          draft: {
            sections: normalizedSections,
            settings: settings || layout.settings,
            lastSavedAt: new Date(),
          },
          updatedBy: req.user?._id || req.admin?._id,
          updatedAt: new Date(),
        }
      }
    );

    const updatedLayout = await LayoutConfig.findById(id);

    console.log(`✅ Draft saved for layout: ${layout.page}`);

    res.json({
      success: true,
      message: 'Draft saved successfully',
      data: updatedLayout.draft,
    });
  } catch (error) {
    console.error('❌ Error saving draft:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save draft',
      error: error.message,
    });
  }
};

/**
 * Publish layout - FIXED VERSION
 */
exports.publishLayout = async (req, res) => {
  try {
    const LayoutConfig = getLayoutConfigModel();
    const { id } = req.params;
    const { changes } = req.body;

    console.log(`📤 Publishing layout: ${id}`);

    // Validate ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid layout ID',
      });
    }

    const layout = await LayoutConfig.findById(id);

    if (!layout) {
      console.log(`❌ Layout not found: ${id}`);
      return res.status(404).json({
        success: false,
        message: 'Layout not found',
      });
    }

    console.log(`📤 Current layout: ${layout.page}`);
    console.log(`📤 Current sections: ${layout.sections?.length || 0}`);
    console.log(`📤 Has draft: ${!!(layout.draft && layout.draft.sections)}`);

    const adminId = req.user?._id || req.admin?._id;
    const newVersion = (layout.version || 0) + 1;

    // Prepare update data
    const updateData = {
      isPublished: true,
      publishedAt: new Date(),
      publishedBy: adminId,
      version: newVersion,
      updatedBy: adminId,
      updatedAt: new Date(),
    };

    // If there's a draft with sections, use it
    if (layout.draft && layout.draft.sections && layout.draft.sections.length > 0) {
      console.log(`📤 Publishing from draft (${layout.draft.sections.length} sections)`);
      updateData.sections = layout.draft.sections;
      if (layout.draft.settings) {
        updateData.settings = { ...layout.settings, ...layout.draft.settings };
      }
      updateData.draft = null; // Clear draft
    } else {
      console.log(`📤 Publishing current sections (${layout.sections?.length || 0} sections)`);
    }

    // Add to publish history
    const historyEntry = {
      version: newVersion,
      publishedAt: new Date(),
      publishedBy: adminId,
      changes: changes || 'Published via admin panel',
    };

    // Update layout
    await LayoutConfig.updateOne(
      { _id: id },
      { 
        $set: updateData,
        $push: { publishHistory: historyEntry }
      }
    );

    // Fetch updated layout
    const updatedLayout = await LayoutConfig.findById(id);

    console.log(`✅ Layout published successfully!`);
    console.log(`✅ Page: ${updatedLayout.page}`);
    console.log(`✅ Version: ${updatedLayout.version}`);
    console.log(`✅ isPublished: ${updatedLayout.isPublished}`);
    console.log(`✅ Sections: ${updatedLayout.sections?.length || 0}`);

    // Emit socket event for real-time update
    const io = req.app.get('io');
    if (io) {
      io.emit('layout:published', {
        page: updatedLayout.page,
        version: updatedLayout.version,
        publishedAt: updatedLayout.publishedAt,
      });
    }

    res.json({
      success: true,
      message: 'Layout published successfully',
      data: updatedLayout,
    });
  } catch (error) {
    console.error('❌ Error publishing layout:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to publish layout',
      error: error.message,
    });
  }
};

/**
 * Delete layout
 */
exports.deleteLayout = async (req, res) => {
  try {
    const LayoutConfig = getLayoutConfigModel();
    const { id } = req.params;

    console.log(`🗑️ Deleting layout: ${id}`);

    const layout = await LayoutConfig.findById(id);

    if (!layout) {
      return res.status(404).json({
        success: false,
        message: 'Layout not found',
      });
    }

    // Prevent deleting home layout
    if (layout.page === 'home') {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete home page layout',
      });
    }

    await LayoutConfig.deleteOne({ _id: id });

    console.log(`✅ Layout deleted: ${layout.page}`);

    res.json({
      success: true,
      message: 'Layout deleted successfully',
    });
  } catch (error) {
    console.error('❌ Error deleting layout:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete layout',
      error: error.message,
    });
  }
};

/**
 * Get layout for mobile app (public endpoint) - FIXED VERSION
 */
exports.getPublicLayout = async (req, res) => {
  try {
    const LayoutConfig = getLayoutConfigModel();
    const { page = 'home' } = req.query;

    console.log(`📱 Public layout request for page: ${page}`);

    let layout = await LayoutConfig.findOne({ 
      page, 
      isActive: true,
    });

    console.log(`📱 Found layout: ${layout ? 'Yes' : 'No'}`);
    
    if (layout) {
      console.log(`📱 isPublished: ${layout.isPublished}`);
      console.log(`📱 Sections count: ${layout.sections?.length || 0}`);
    }

    // If no layout exists, create default
    if (!layout) {
      console.log(`📱 Creating default layout for: ${page}`);
      layout = await LayoutConfig.createDefaultLayout(page);
    }

    // Get only enabled sections sorted by order
    let enabledSections = [];
    
    if (layout.sections && layout.sections.length > 0) {
      enabledSections = layout.sections
        .filter(section => section.enabled !== false)
        .sort((a, b) => (a.order || 0) - (b.order || 0))
        .map(section => {
          // Convert to plain object if needed
          const sectionObj = section.toObject ? section.toObject() : { ...section };
          // Add id field
          sectionObj.id = sectionObj._id || sectionObj.sectionId;
          return sectionObj;
        });
    }

    console.log(`📱 Returning ${enabledSections.length} enabled sections`);

    res.json({
      success: true,
      data: {
        page: layout.page,
        pageName: layout.pageName || layout.page,
        sections: enabledSections,
        settings: layout.settings || {},
        version: layout.version || 1,
        publishedAt: layout.publishedAt,
        isPublished: layout.isPublished,
      },
    });
  } catch (error) {
    console.error('❌ Error fetching public layout:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch layout',
      error: error.message,
      // Return empty data so app doesn't crash
      data: {
        page: req.query.page || 'home',
        sections: [],
        settings: {},
        version: 1,
      },
    });
  }
};

/**
 * Duplicate layout
 */
exports.duplicateLayout = async (req, res) => {
  try {
    const LayoutConfig = getLayoutConfigModel();
    const { id } = req.params;
    const { newPage } = req.body;

    console.log(`📋 Duplicating layout: ${id} to ${newPage}`);

    if (!newPage) {
      return res.status(400).json({
        success: false,
        message: 'New page name is required',
      });
    }

    const layout = await LayoutConfig.findById(id);

    if (!layout) {
      return res.status(404).json({
        success: false,
        message: 'Layout not found',
      });
    }

    // Check if target page already exists
    const existingLayout = await LayoutConfig.findOne({ page: newPage });
    if (existingLayout) {
      return res.status(400).json({
        success: false,
        message: `Layout for page "${newPage}" already exists`,
      });
    }

    // Clone layout data
    const clonedData = layout.toObject();
    delete clonedData._id;
    delete clonedData.id;
    clonedData.page = newPage;
    clonedData.pageName = newPage.charAt(0).toUpperCase() + newPage.slice(1);
    clonedData.isPublished = false;
    clonedData.version = 1;
    clonedData.publishHistory = [];
    clonedData.draft = undefined;
    clonedData.createdBy = req.user?._id || req.admin?._id;
    clonedData.createdAt = new Date();
    clonedData.updatedAt = new Date();

    // Regenerate section IDs
    clonedData.sections = clonedData.sections.map((section, index) => {
      const newSection = { ...section };
      delete newSection._id;
      newSection.sectionId = `${newPage}-section-${index + 1}-${Date.now().toString(36)}`;
      return newSection;
    });

    const clonedLayout = await LayoutConfig.create(clonedData);

    console.log(`✅ Layout duplicated: ${clonedLayout.page}`);

    res.status(201).json({
      success: true,
      message: 'Layout duplicated successfully',
      data: clonedLayout,
    });
  } catch (error) {
    console.error('❌ Error duplicating layout:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to duplicate layout',
      error: error.message,
    });
  }
};

/**
 * Get layout stats
 */
exports.getLayoutStats = async (req, res) => {
  try {
    const LayoutConfig = getLayoutConfigModel();

    console.log(`📊 Fetching layout stats...`);

    const [
      totalLayouts,
      publishedLayouts,
      activeLayouts,
    ] = await Promise.all([
      LayoutConfig.countDocuments(),
      LayoutConfig.countDocuments({ isPublished: true }),
      LayoutConfig.countDocuments({ isActive: true }),
    ]);

    // Get sections count per layout
    const layouts = await LayoutConfig.find().select('page sections').lean();
    const sectionCounts = {};
    let totalSections = 0;
    
    layouts.forEach(layout => {
      sectionCounts[layout.page] = layout.sections?.length || 0;
      totalSections += layout.sections?.length || 0;
    });

    console.log(`✅ Layout stats: ${totalLayouts} layouts, ${totalSections} sections`);

    res.json({
      success: true,
      data: {
        totalLayouts,
        publishedLayouts,
        activeLayouts,
        draftLayouts: totalLayouts - publishedLayouts,
        totalSections,
        sectionCounts,
      },
    });
  } catch (error) {
    console.error('❌ Error fetching layout stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch layout stats',
      error: error.message,
    });
  }
};

/**
 * Revert to previous version
 */
exports.revertToVersion = async (req, res) => {
  try {
    const LayoutConfig = getLayoutConfigModel();
    const { id } = req.params;
    const { version } = req.body;

    console.log(`⏪ Reverting layout: ${id} to version: ${version}`);

    const layout = await LayoutConfig.findById(id);

    if (!layout) {
      return res.status(404).json({
        success: false,
        message: 'Layout not found',
      });
    }

    const historyItem = layout.publishHistory.find(h => h.version === version);

    if (!historyItem) {
      return res.status(404).json({
        success: false,
        message: `Version ${version} not found in history`,
      });
    }

    res.status(501).json({
      success: false,
      message: 'Version revert not yet implemented. Please manually reconfigure.',
    });
  } catch (error) {
    console.error('❌ Error reverting layout:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to revert layout',
      error: error.message,
    });
  }
};