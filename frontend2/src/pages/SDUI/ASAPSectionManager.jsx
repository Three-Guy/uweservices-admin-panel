// src/pages/SDUI/ASAPSectionManager.jsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  IconButton,
  Grid,
  Card,
  CardContent,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Switch,
  FormControlLabel,
  Chip,
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  Alert,
  Snackbar,
  CircularProgress,
  Tabs,
  Tab,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Tooltip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  InputAdornment,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  DragIndicator as DragIcon,
  Bolt as BoltIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  ExpandMore as ExpandMoreIcon,
  Save as SaveIcon,
  Refresh as RefreshIcon,
  CheckCircle as CheckCircleIcon,
  Palette as PaletteIcon,
  EmojiEmotions as EmojiIcon,
} from '@mui/icons-material';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { apiClient } from '../../lib/api';

// Material Icons List (subset for quick selection)
const MATERIAL_ICONS = [
  { name: 'water-damage', label: 'Water Damage' },
  { name: 'plumbing', label: 'Plumbing' },
  { name: 'bolt', label: 'Electricity' },
  { name: 'electrical-services', label: 'Electrical' },
  { name: 'construction', label: 'Construction' },
  { name: 'handyman', label: 'Handyman' },
  { name: 'build', label: 'Build' },
  { name: 'home-repair-service', label: 'Home Repair' },
  { name: 'ac-unit', label: 'AC Unit' },
  { name: 'cleaning-services', label: 'Cleaning' },
  { name: 'local-shipping', label: 'Shipping' },
  { name: 'local-laundry-service', label: 'Laundry' },
  { name: 'pest-control', label: 'Pest Control' },
  { name: 'carpenter', label: 'Carpenter' },
  { name: 'plumber', label: 'Plumber' },
  { name: 'kitchen', label: 'Kitchen' },
  { name: 'bathroom', label: 'Bathroom' },
  { name: 'spa', label: 'Spa' },
  { name: 'medical-services', label: 'Medical' },
  { name: 'directions-car', label: 'Car' },
];

// Common Emojis for quick selection
const COMMON_EMOJIS = [
  '🔧', '🔨', '⚡', '💧', '🚿', '🛠️', '🏠', '🧹', '🧼', '🚗',
  '❄️', '🔥', '💨', '🌡️', '🪛', '🔩', '⚙️', '🛁', '🚽', '🍳',
  '🧰', '📦', '🚚', '🧴', '🪣', '🧽', '🪥', '💡', '🔌', '📱',
  '🏥', '💊', '🩺', '🚑', '🧑‍🔧', '👨‍🔧', '👷', '🏗️', '🪜', '🎨',
  '❤️', '⭐', '✨', '🌟', '💪', '👍', '✅', '🎯', '🚀', '💎',
];

// Tab Panel Component
function TabPanel({ children, value, index, ...other }) {
  return (
    <div hidden={value !== index} {...other}>
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

// Icon Picker Component
const IconPicker = ({ value, onChange, label = "Icon" }) => {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [iconType, setIconType] = useState('emoji'); // 'emoji' or 'material'

  // Detect if current value is emoji or material icon
  useEffect(() => {
    if (value) {
      // Check if it's an emoji (contains unicode emoji characters)
      const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u2702-\u27B0]/u;
      if (emojiRegex.test(value)) {
        setIconType('emoji');
      } else {
        setIconType('material');
      }
    }
  }, [value]);

  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
        <Button
          variant={iconType === 'emoji' ? 'contained' : 'outlined'}
          size="small"
          onClick={() => setIconType('emoji')}
          startIcon={<EmojiIcon />}
        >
          Emoji
        </Button>
        <Button
          variant={iconType === 'material' ? 'contained' : 'outlined'}
          size="small"
          onClick={() => setIconType('material')}
        >
          Material Icon
        </Button>
      </Box>

      {iconType === 'emoji' ? (
        <Box>
          <TextField
            fullWidth
            label={label}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Enter emoji or click below"
            InputProps={{
              startAdornment: value ? (
                <InputAdornment position="start">
                  <Typography fontSize={24}>{value}</Typography>
                </InputAdornment>
              ) : null,
            }}
            helperText="Type an emoji or select from below"
          />
          <Box sx={{ mt: 2 }}>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
              Quick Select:
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {COMMON_EMOJIS.map((emoji) => (
                <Button
                  key={emoji}
                  variant={value === emoji ? 'contained' : 'outlined'}
                  size="small"
                  onClick={() => onChange(emoji)}
                  sx={{ 
                    minWidth: 40, 
                    height: 40, 
                    fontSize: '1.2rem',
                    p: 0,
                  }}
                >
                  {emoji}
                </Button>
              ))}
            </Box>
          </Box>
        </Box>
      ) : (
        <FormControl fullWidth>
          <InputLabel>{label}</InputLabel>
          <Select
            value={value}
            label={label}
            onChange={(e) => onChange(e.target.value)}
          >
            {MATERIAL_ICONS.map((icon) => (
              <MenuItem key={icon.name} value={icon.name}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography>{icon.name}</Typography>
                  <Typography variant="body2" color="text.secondary">({icon.label})</Typography>
                </Box>
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      )}

      {/* Preview */}
      <Box sx={{ mt: 2, p: 2, bgcolor: 'action.hover', borderRadius: 1, textAlign: 'center' }}>
        <Typography variant="caption" color="text.secondary">Preview:</Typography>
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          mt: 1,
        }}>
          <Avatar sx={{ 
            bgcolor: 'primary.main', 
            width: 48, 
            height: 48,
            fontSize: '1.5rem',
          }}>
            {value || '?'}
          </Avatar>
        </Box>
      </Box>
    </Box>
  );
};

const ASAPSectionManager = () => {
  // State
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedSection, setSelectedSection] = useState(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [addItemDialogOpen, setAddItemDialogOpen] = useState(false);
  const [editItemDialogOpen, setEditItemDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [availableSubservices, setAvailableSubservices] = useState([]);
  const [selectedSubservice, setSelectedSubservice] = useState(null); // Changed to single selection
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [tabValue, setTabValue] = useState(0);
  const [addItemStep, setAddItemStep] = useState(0);

  // Form state for the new item being added
  const [newItemForm, setNewItemForm] = useState({
    customName: '',
    customIcon: '',
    customDescription: '',
    navigationRoute: '',
    buttonColor: 'rgba(255,255,255,0.1)',
    iconColor: '#FF8C42',
    isActive: true,
  });

  // Form state for section
  const [sectionForm, setSectionForm] = useState({
    name: '',
    title: 'Need a Service Provider ASAP?',
    subtitle: 'Get urgent help right away',
    highlightText: 'Arrival Within 13 mins',
    description: '',
    icon: '⚡',
    maxItems: 2,
    position: 'after_banner',
    sortOrder: 0,
    isActive: true,
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
    },
  });

  // Form state for editing item
  const [itemForm, setItemForm] = useState({
    subservice: null,
    customName: '',
    customIcon: '',
    customDescription: '',
    navigationRoute: '',
    buttonColor: 'rgba(255,255,255,0.1)',
    iconColor: '#FF8C42',
    isActive: true,
  });

  // Fetch sections
  const fetchSections = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/admin/asap-sections');
      if (response.data.success) {
        setSections(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching ASAP sections:', error);
      showSnackbar('Failed to fetch ASAP sections', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch categories
  const fetchCategories = useCallback(async () => {
    try {
      const response = await apiClient.get('/admin/asap-sections/categories');
      if (response.data.success) {
        setCategories(response.data.data.filter(cat => !cat.isMoreServicesSection));
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  }, []);

  useEffect(() => {
    fetchSections();
    fetchCategories();
  }, [fetchSections, fetchCategories]);

  // Show snackbar
  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  // Handle section form change
  const handleSectionFormChange = (field, value) => {
    setSectionForm(prev => {
      const fields = field.split('.');
      if (fields.length === 1) {
        return { ...prev, [field]: value };
      }
      const newForm = { ...prev };
      let current = newForm;
      for (let i = 0; i < fields.length - 1; i++) {
        current[fields[i]] = { ...current[fields[i]] };
        current = current[fields[i]];
      }
      current[fields[fields.length - 1]] = value;
      return newForm;
    });
  };

  // Open create dialog
  const handleCreateSection = () => {
    setSectionForm({
      name: '',
      title: 'Need a Service Provider ASAP?',
      subtitle: 'Get urgent help right away',
      highlightText: 'Arrival Within 13 mins',
      description: '',
      icon: '⚡',
      maxItems: 2,
      position: 'after_banner',
      sortOrder: sections.length,
      isActive: true,
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
      },
    });
    setSelectedSection(null);
    setTabValue(0);
    setEditDialogOpen(true);
  };

  // Open edit dialog
  const handleEditSection = (section) => {
    setSelectedSection(section);
    setSectionForm({
      name: section.name || '',
      title: section.title || 'Need a Service Provider ASAP?',
      subtitle: section.subtitle || '',
      highlightText: section.highlightText || 'Arrival Within 13 mins',
      description: section.description || '',
      icon: section.icon || '⚡',
      maxItems: section.maxItems || 2,
      position: section.position || 'after_banner',
      sortOrder: section.sortOrder || 0,
      isActive: section.isActive !== false,
      arrivalTime: section.arrivalTime || {
        minutes: 13,
        displayFormat: 'Arrival Within {time} mins',
        showBadge: true,
      },
      styling: section.styling || {
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
      displaySettings: section.displaySettings || {
        layout: 'row',
        maxItemsToShow: 2,
      },
    });
    setTabValue(0);
    setEditDialogOpen(true);
  };

  // Save section
  const handleSaveSection = async () => {
    try {
      setSaving(true);

      if (!sectionForm.name.trim()) {
        showSnackbar('Section name is required', 'error');
        setSaving(false);
        return;
      }

      if (!sectionForm.title.trim()) {
        showSnackbar('Section title is required', 'error');
        setSaving(false);
        return;
      }

      const highlightTextValue = sectionForm.highlightText || 
        (sectionForm.arrivalTime?.displayFormat?.replace('{time}', sectionForm.arrivalTime?.minutes || 13)) || 
        'Arrival Within 13 mins';

      const payload = {
        name: sectionForm.name,
        title: sectionForm.title,
        subtitle: sectionForm.subtitle,
        highlightText: highlightTextValue,
        description: sectionForm.description,
        icon: sectionForm.icon,
        maxItems: sectionForm.maxItems || 2,
        position: sectionForm.position,
        sortOrder: sectionForm.sortOrder,
        isActive: sectionForm.isActive,
        arrivalTime: JSON.stringify(sectionForm.arrivalTime),
        styling: JSON.stringify(sectionForm.styling),
        displaySettings: JSON.stringify(sectionForm.displaySettings),
      };

      let response;
      if (selectedSection) {
        response = await apiClient.put(`/admin/asap-sections/${selectedSection._id}`, payload);
      } else {
        response = await apiClient.post('/admin/asap-sections', payload);
      }

      if (response.data.success) {
        showSnackbar(
          selectedSection ? 'Section updated successfully' : 'Section created successfully'
        );
        setEditDialogOpen(false);
        fetchSections();
      }
    } catch (error) {
      console.error('Error saving section:', error);
      showSnackbar(error.response?.data?.message || 'Failed to save section', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Delete section
  const handleDeleteSection = async (sectionId) => {
    if (!window.confirm('Are you sure you want to delete this ASAP section?')) {
      return;
    }

    try {
      const response = await apiClient.delete(`/admin/asap-sections/${sectionId}`);
      if (response.data.success) {
        showSnackbar('Section deleted successfully');
        fetchSections();
      }
    } catch (error) {
      console.error('Error deleting section:', error);
      showSnackbar('Failed to delete section', 'error');
    }
  };

  // Toggle section active
  const handleToggleSectionActive = async (section) => {
    try {
      const response = await apiClient.put(`/admin/asap-sections/${section._id}`, {
        isActive: !section.isActive,
      });
      if (response.data.success) {
        showSnackbar(`Section ${section.isActive ? 'deactivated' : 'activated'}`);
        fetchSections();
      }
    } catch (error) {
      console.error('Error toggling section:', error);
      showSnackbar('Failed to update section', 'error');
    }
  };

  // Seed default section
  const handleSeedDefault = async () => {
    try {
      setSaving(true);
      const response = await apiClient.post('/admin/asap-sections/seed');
      if (response.data.success) {
        showSnackbar('Default ASAP section created! Now add subservices to it.');
        fetchSections();
      }
    } catch (error) {
      console.error('Error seeding section:', error);
      showSnackbar(error.response?.data?.message || 'Failed to seed section', 'error');
    } finally {
      setSaving(false);
    }
  };

  // ==================== ADD ITEM WORKFLOW (Like Trending Service) ====================

  // Step 1: Open add item dialog
  const handleOpenAddItemDialog = (section) => {
    if (section.items && section.items.length >= (section.maxItems || 2)) {
      showSnackbar(`Maximum ${section.maxItems || 2} items allowed in this section`, 'error');
      return;
    }

    setSelectedSection(section);
    setSelectedCategory(null);
    setSelectedSubservice(null);
    setAvailableSubservices([]);
    setNewItemForm({
      customName: '',
      customIcon: '',
      customDescription: '',
      navigationRoute: '',
      buttonColor: 'rgba(255,255,255,0.1)',
      iconColor: '#FF8C42',
      isActive: true,
    });
    setAddItemStep(0);
    setAddItemDialogOpen(true);
  };

  // Step 2: Select category
  const handleCategorySelect = async (category) => {
    setSelectedCategory(category);
    setSelectedSubservice(null);
    setAddItemStep(1);

    try {
      const excludeIds = selectedSection?.items?.map(item => {
        if (item.subservice && typeof item.subservice === 'object') {
          return item.subservice._id;
        }
        return item.subservice;
      }).filter(Boolean).join(',') || '';

      const response = await apiClient.get(`/admin/asap-sections/subservices/category/${category._id}`, {
        params: { excludeIds },
      });

      if (response.data.success) {
        setAvailableSubservices(response.data.data.subservices || []);
      }
    } catch (error) {
      console.error('Error fetching subservices:', error);
      showSnackbar('Failed to fetch subservices', 'error');
    }
  };

  // Step 3: Select subservice (single selection like Trending Service)
  const handleSubserviceSelect = (subservice) => {
    setSelectedSubservice(subservice);
    
    // Auto-populate the form with subservice data (like Trending Service)
    setNewItemForm({
      customName: '', // Leave empty to use original name
      customIcon: subservice.icon || subservice.iconName || '🔧', // Auto-fetch icon from subservice
      customDescription: '',
      navigationRoute: `/services/${subservice.categoryId || selectedCategory?.categoryId || 'default'}`,
      buttonColor: 'rgba(255,255,255,0.1)',
      iconColor: '#FF8C42',
      isActive: true,
    });
    
    setAddItemStep(2);
  };

  // Step 4: Add item to section
  const handleAddItem = async () => {
    if (!selectedSubservice) {
      showSnackbar('Please select a subservice', 'error');
      return;
    }

    try {
      setSaving(true);

      const payload = {
        subserviceId: selectedSubservice._id,
        customName: newItemForm.customName,
        customIcon: newItemForm.customIcon, // This now contains the auto-fetched or customized icon
        customDescription: newItemForm.customDescription,
        navigationRoute: newItemForm.navigationRoute || `/services/${selectedSubservice.categoryId || selectedCategory?.categoryId || 'default'}`,
        buttonColor: newItemForm.buttonColor,
        iconColor: newItemForm.iconColor,
        isActive: newItemForm.isActive,
      };

      const response = await apiClient.post(`/admin/asap-sections/${selectedSection._id}/items`, payload);

      if (response.data.success) {
        showSnackbar('Item added successfully');
        setAddItemDialogOpen(false);
        fetchSections();
      }
    } catch (error) {
      console.error('Error adding item:', error);
      showSnackbar(error.response?.data?.message || 'Failed to add item', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Go back in stepper
  const handleStepBack = () => {
    if (addItemStep === 1) {
      setSelectedCategory(null);
      setSelectedSubservice(null);
      setAvailableSubservices([]);
      setAddItemStep(0);
    } else if (addItemStep === 2) {
      setSelectedSubservice(null);
      setAddItemStep(1);
    }
  };

  // ==================== EDIT ITEM ====================

  // Open edit item dialog
  const handleOpenEditItemDialog = (section, item) => {
    setSelectedSection(section);
    setSelectedItem(item);
    setItemForm({
      subservice: item.subservice,
      customName: item.customName || '',
      customIcon: item.customIcon || item.subservice?.icon || '🔧',
      customDescription: item.customDescription || '',
      navigationRoute: item.navigationRoute || '',
      buttonColor: item.buttonColor || 'rgba(255,255,255,0.1)',
      iconColor: item.iconColor || '#FF8C42',
      isActive: item.isActive !== false,
    });
    setEditItemDialogOpen(true);
  };

  // Update item
  const handleUpdateItem = async () => {
    try {
      setSaving(true);
      const response = await apiClient.put(
        `/admin/asap-sections/${selectedSection._id}/items/${selectedItem._id}`,
        {
          customName: itemForm.customName,
          customIcon: itemForm.customIcon,
          customDescription: itemForm.customDescription,
          navigationRoute: itemForm.navigationRoute,
          buttonColor: itemForm.buttonColor,
          iconColor: itemForm.iconColor,
          isActive: itemForm.isActive,
        }
      );

      if (response.data.success) {
        showSnackbar('Item updated successfully');
        setEditItemDialogOpen(false);
        fetchSections();
      }
    } catch (error) {
      console.error('Error updating item:', error);
      showSnackbar('Failed to update item', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Remove item
  const handleRemoveItem = async (section, item) => {
    if (!window.confirm('Remove this item from the ASAP section?')) {
      return;
    }

    try {
      const response = await apiClient.delete(
        `/admin/asap-sections/${section._id}/items/${item._id}`
      );
      if (response.data.success) {
        showSnackbar('Item removed successfully');
        fetchSections();
      }
    } catch (error) {
      console.error('Error removing item:', error);
      showSnackbar('Failed to remove item', 'error');
    }
  };

  // Handle drag end for items
  const handleDragEnd = async (result, section) => {
    if (!result.destination) return;

    const items = Array.from(section.items);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    const updatedSections = sections.map(s => {
      if (s._id === section._id) {
        return { ...s, items };
      }
      return s;
    });
    setSections(updatedSections);

    try {
      await apiClient.put(`/admin/asap-sections/${section._id}/items/reorder`, {
        items: items.map((item, index) => ({
          id: item._id,
          sortOrder: index,
        })),
      });
    } catch (error) {
      console.error('Error reordering items:', error);
      showSnackbar('Failed to save order', 'error');
      fetchSections();
    }
  };

  // Position options
  const positionOptions = [
    { value: 'top', label: 'Top of page' },
    { value: 'after_banner', label: 'After banner' },
    { value: 'after_categories', label: 'After categories' },
    { value: 'middle', label: 'Middle' },
    { value: 'bottom', label: 'Bottom' },
  ];

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <BoltIcon sx={{ color: '#EF4444' }} />
            ASAP Sections
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage "Need a Service Provider ASAP?" emergency sections
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={fetchSections}
          >
            Refresh
          </Button>
          {sections.length === 0 && (
            <Button
              variant="outlined"
              color="info"
              startIcon={<AddIcon />}
              onClick={handleSeedDefault}
              disabled={saving}
            >
              {saving ? 'Seeding...' : 'Seed Default Section'}
            </Button>
          )}
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleCreateSection}
          >
            Create Section
          </Button>
        </Box>
      </Box>

      {/* Info Alert */}
      <Alert severity="info" sx={{ mb: 3 }}>
        <Typography variant="body2">
          <strong>How it works:</strong> Create an ASAP section → Add subservices (icon auto-fetched from subservice) → Customize names, icons, and navigation → Match your Emergency.tsx component design
        </Typography>
      </Alert>

      {/* Sections Grid */}
      {sections.length === 0 ? (
        <Paper sx={{ p: 6, textAlign: 'center' }}>
          <BoltIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No ASAP Sections Yet
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Create your first ASAP section to match the Emergency.tsx component
          </Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleSeedDefault} disabled={saving}>
            {saving ? 'Creating...' : 'Seed Default Section'}
          </Button>
        </Paper>
      ) : (
        <Grid container spacing={3}>
          {sections.map((section) => (
            <Grid item xs={12} key={section._id}>
              <Card 
                sx={{ 
                  opacity: section.isActive ? 1 : 0.7,
                  border: section.isActive ? '2px solid #10B981' : '2px solid #9CA3AF',
                }}
              >
                <CardContent>
                  {/* Section Header */}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Avatar 
                        sx={{ 
                          bgcolor: section.styling?.glowEffects?.topLeftColor || '#FEE2E2',
                          width: 56,
                          height: 56,
                          fontSize: '1.5rem',
                        }}
                      >
                        {section.icon || '⚡'}
                      </Avatar>
                      <Box>
                        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                          {section.title}
                          <Chip
                            label={section.isActive ? 'Active' : 'Inactive'}
                            size="small"
                            color={section.isActive ? 'success' : 'default'}
                          />
                          <Chip
                            label={section.position}
                            size="small"
                            variant="outlined"
                          />
                          <Chip
                            label={`Max ${section.maxItems || 2} items`}
                            size="small"
                            variant="outlined"
                            color="info"
                          />
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {section.name} • {section.items?.length || 0}/{section.maxItems || 2} items
                        </Typography>
                        {section.highlightText && (
                          <Typography variant="body2" sx={{ color: section.styling?.highlightColor || '#FF8C42', fontWeight: 'bold' }}>
                            {section.highlightText}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Tooltip title={section.isActive ? 'Deactivate' : 'Activate'}>
                        <IconButton onClick={() => handleToggleSectionActive(section)}>
                          {section.isActive ? <VisibilityIcon /> : <VisibilityOffIcon />}
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Edit">
                        <IconButton onClick={() => handleEditSection(section)}>
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton color="error" onClick={() => handleDeleteSection(section._id)}>
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Box>

                  <Divider sx={{ my: 2 }} />

                  {/* Items List */}
                  <Box sx={{ mb: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                      <Typography variant="subtitle1" fontWeight="bold">
                        Section Items ({section.items?.length || 0}/{section.maxItems || 2})
                      </Typography>
                      <Button
                        size="small"
                        startIcon={<AddIcon />}
                        onClick={() => handleOpenAddItemDialog(section)}
                        disabled={(section.items?.length || 0) >= (section.maxItems || 2)}
                      >
                        Add Item {(section.items?.length || 0) >= (section.maxItems || 2) && '(Full)'}
                      </Button>
                    </Box>

                    {(!section.items || section.items.length === 0) ? (
                      <Alert severity="info">
                        No items in this section. Click "Add Item" to select subservices from a category.
                      </Alert>
                    ) : (
                      <DragDropContext onDragEnd={(result) => handleDragEnd(result, section)}>
                        <Droppable droppableId={`section-${section._id}`}>
                          {(provided) => (
                            <List {...provided.droppableProps} ref={provided.innerRef} dense>
                              {section.items
                                .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
                                .map((item, index) => (
                                  <Draggable
                                    key={item._id}
                                    draggableId={item._id}
                                    index={index}
                                  >
                                    {(dragProvided, snapshot) => (
                                      <Paper
                                        ref={dragProvided.innerRef}
                                        {...dragProvided.draggableProps}
                                        sx={{
                                          mb: 1,
                                          bgcolor: snapshot.isDragging ? 'action.hover' : 'background.paper',
                                          opacity: item.isActive ? 1 : 0.6,
                                        }}
                                      >
                                        <ListItem>
                                          <Box
                                            {...dragProvided.dragHandleProps}
                                            sx={{ mr: 2, cursor: 'grab', display: 'flex', alignItems: 'center' }}
                                          >
                                            <DragIcon color="action" />
                                          </Box>
                                          <ListItemAvatar>
                                            <Avatar
                                              sx={{ 
                                                bgcolor: item.buttonColor || 'rgba(255,255,255,0.1)',
                                                color: item.iconColor || '#FF8C42',
                                                fontSize: '1.2rem',
                                              }}
                                            >
                                              {item.customIcon || item.subservice?.icon || '🔧'}
                                            </Avatar>
                                          </ListItemAvatar>
                                          <ListItemText
                                            primary={
                                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <Typography fontWeight="medium">
                                                  {item.customName || item.subservice?.name || 'Unknown'}
                                                </Typography>
                                                {item.customName && (
                                                  <Chip
                                                    label="Custom Name"
                                                    size="small"
                                                    color="primary"
                                                    variant="outlined"
                                                  />
                                                )}
                                                {item.customIcon && (
                                                  <Chip
                                                    label={`Icon: ${item.customIcon}`}
                                                    size="small"
                                                    color="secondary"
                                                    variant="outlined"
                                                  />
                                                )}
                                                {!item.isActive && (
                                                  <Chip label="Hidden" size="small" color="default" />
                                                )}
                                              </Box>
                                            }
                                            secondary={
                                              <Box>
                                                <Typography variant="body2" color="text.secondary">
                                                  Original: {item.subservice?.name || 'N/A'}
                                                </Typography>
                                                <Typography variant="body2" color="text.secondary">
                                                  Route: {item.navigationRoute || 'not set'}
                                                </Typography>
                                                {item.subservice?.category && (
                                                  <Chip
                                                    label={item.subservice.category.name}
                                                    size="small"
                                                    sx={{ mt: 0.5 }}
                                                  />
                                                )}
                                              </Box>
                                            }
                                          />
                                          <ListItemSecondaryAction>
                                            <IconButton
                                              size="small"
                                              onClick={() => handleOpenEditItemDialog(section, item)}
                                            >
                                              <EditIcon fontSize="small" />
                                            </IconButton>
                                            <IconButton
                                              size="small"
                                              color="error"
                                              onClick={() => handleRemoveItem(section, item)}
                                            >
                                              <DeleteIcon fontSize="small" />
                                            </IconButton>
                                          </ListItemSecondaryAction>
                                        </ListItem>
                                      </Paper>
                                    )}
                                  </Draggable>
                                ))}
                              {provided.placeholder}
                            </List>
                          )}
                        </Droppable>
                      </DragDropContext>
                    )}
                  </Box>

                  {/* Styling Preview */}
                  <Accordion>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography variant="subtitle2">
                        <PaletteIcon fontSize="small" sx={{ mr: 1, verticalAlign: 'middle' }} />
                        Styling & Design
                      </Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Grid container spacing={2}>
                        <Grid item xs={6} md={3}>
                          <Typography variant="body2" color="text.secondary">Background</Typography>
                          <Box sx={{ 
                            width: 40, 
                            height: 40, 
                            borderRadius: 1, 
                            bgcolor: section.styling?.cardBackgroundColor || '#1a1a2e',
                            border: '1px solid #ddd',
                          }} />
                        </Grid>
                        <Grid item xs={6} md={3}>
                          <Typography variant="body2" color="text.secondary">Highlight Color</Typography>
                          <Box sx={{ 
                            width: 40, 
                            height: 40, 
                            borderRadius: 1, 
                            bgcolor: section.styling?.highlightColor || '#FF8C42',
                            border: '1px solid #ddd',
                          }} />
                        </Grid>
                        <Grid item xs={6} md={3}>
                          <Typography variant="body2" color="text.secondary">Border Radius</Typography>
                          <Typography>{section.styling?.cardBorderRadius || 32}px</Typography>
                        </Grid>
                        <Grid item xs={6} md={3}>
                          <Typography variant="body2" color="text.secondary">Glow Effects</Typography>
                          <Typography>
                            {section.styling?.glowEffects?.enabled ? 'Enabled' : 'Disabled'}
                          </Typography>
                        </Grid>
                      </Grid>
                    </AccordionDetails>
                  </Accordion>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Edit Section Dialog */}
      <Dialog
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {selectedSection ? 'Edit ASAP Section' : 'Create ASAP Section'}
        </DialogTitle>
        <DialogContent>
          <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)} sx={{ mb: 2 }}>
            <Tab label="Content" />
            <Tab label="Styling" />
            <Tab label="Settings" />
          </Tabs>

          <TabPanel value={tabValue} index={0}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Section Name (Internal)"
                  value={sectionForm.name}
                  onChange={(e) => handleSectionFormChange('name', e.target.value)}
                  required
                  helperText="For admin reference only"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Display Title"
                  value={sectionForm.title}
                  onChange={(e) => handleSectionFormChange('title', e.target.value)}
                  required
                  helperText="e.g., 'Need a Service Provider ASAP?'"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Subtitle"
                  value={sectionForm.subtitle}
                  onChange={(e) => handleSectionFormChange('subtitle', e.target.value)}
                  helperText="e.g., 'Get urgent help right away'"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Highlight Text"
                  value={sectionForm.highlightText}
                  onChange={(e) => handleSectionFormChange('highlightText', e.target.value)}
                  helperText="e.g., 'Arrival Within 13 mins'"
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={2}
                  label="Description"
                  value={sectionForm.description}
                  onChange={(e) => handleSectionFormChange('description', e.target.value)}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <Box>
                  <Typography variant="subtitle2" gutterBottom>Section Icon</Typography>
                  <IconPicker
                    value={sectionForm.icon}
                    onChange={(value) => handleSectionFormChange('icon', value)}
                    label="Section Icon"
                  />
                </Box>
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  type="number"
                  label="Arrival Time (minutes)"
                  value={sectionForm.arrivalTime?.minutes || 13}
                  onChange={(e) => handleSectionFormChange('arrivalTime.minutes', parseInt(e.target.value) || 13)}
                  inputProps={{ min: 1, max: 120 }}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  type="number"
                  label="Max Items Allowed"
                  value={sectionForm.maxItems}
                  onChange={(e) => handleSectionFormChange('maxItems', parseInt(e.target.value) || 2)}
                  inputProps={{ min: 1, max: 6 }}
                  helperText="Usually 2"
                />
              </Grid>
            </Grid>
          </TabPanel>

          <TabPanel value={tabValue} index={1}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Typography variant="subtitle2" gutterBottom>Card Styling</Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Card Background Color"
                  value={sectionForm.styling?.cardBackgroundColor || '#1a1a2e'}
                  onChange={(e) => handleSectionFormChange('styling.cardBackgroundColor', e.target.value)}
                  type="color"
                  helperText="Dark theme background"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Highlight Color"
                  value={sectionForm.styling?.highlightColor || '#FF8C42'}
                  onChange={(e) => handleSectionFormChange('styling.highlightColor', e.target.value)}
                  type="color"
                  helperText="For arrival time text"
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Title Color"
                  value={sectionForm.styling?.titleColor || '#ffffff'}
                  onChange={(e) => handleSectionFormChange('styling.titleColor', e.target.value)}
                  type="color"
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Subtitle Color"
                  value={sectionForm.styling?.subtitleColor || 'rgba(255,255,255,0.6)'}
                  onChange={(e) => handleSectionFormChange('styling.subtitleColor', e.target.value)}
                  helperText="Use rgba for transparency"
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  type="number"
                  label="Border Radius"
                  value={sectionForm.styling?.cardBorderRadius || 32}
                  onChange={(e) => handleSectionFormChange('styling.cardBorderRadius', parseInt(e.target.value) || 32)}
                  inputProps={{ min: 0, max: 50 }}
                />
              </Grid>

              <Grid item xs={12}>
                <Divider sx={{ my: 1 }} />
                <Typography variant="subtitle2" gutterBottom>Glow Effects</Typography>
              </Grid>
              <Grid item xs={12} md={4}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={sectionForm.styling?.glowEffects?.enabled !== false}
                      onChange={(e) => handleSectionFormChange('styling.glowEffects.enabled', e.target.checked)}
                    />
                  }
                  label="Enable Glow"
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Top Left Glow Color"
                  value={sectionForm.styling?.glowEffects?.topLeftColor || 'rgba(255, 140, 66, 0.3)'}
                  onChange={(e) => handleSectionFormChange('styling.glowEffects.topLeftColor', e.target.value)}
                  disabled={sectionForm.styling?.glowEffects?.enabled === false}
                  helperText="Use rgba for transparency"
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Bottom Right Glow Color"
                  value={sectionForm.styling?.glowEffects?.bottomRightColor || 'rgba(45, 107, 223, 0.3)'}
                  onChange={(e) => handleSectionFormChange('styling.glowEffects.bottomRightColor', e.target.value)}
                  disabled={sectionForm.styling?.glowEffects?.enabled === false}
                  helperText="Use rgba for transparency"
                />
              </Grid>

              <Grid item xs={12}>
                <Divider sx={{ my: 1 }} />
                <Typography variant="subtitle2" gutterBottom>Button Style</Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Button Background Color"
                  value={sectionForm.styling?.buttonStyle?.backgroundColor || 'rgba(255,255,255,0.1)'}
                  onChange={(e) => handleSectionFormChange('styling.buttonStyle.backgroundColor', e.target.value)}
                  helperText="Use rgba for transparency"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Button Text Color"
                  value={sectionForm.styling?.buttonStyle?.textColor || '#ffffff'}
                  onChange={(e) => handleSectionFormChange('styling.buttonStyle.textColor', e.target.value)}
                  type="color"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  type="number"
                  label="Button Border Radius"
                  value={sectionForm.styling?.buttonStyle?.borderRadius || 16}
                  onChange={(e) => handleSectionFormChange('styling.buttonStyle.borderRadius', parseInt(e.target.value) || 16)}
                  inputProps={{ min: 0, max: 50 }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Button Border Color"
                  value={sectionForm.styling?.buttonStyle?.borderColor || 'rgba(255,255,255,0.1)'}
                  onChange={(e) => handleSectionFormChange('styling.buttonStyle.borderColor', e.target.value)}
                  helperText="Use rgba for transparency"
                />
              </Grid>
            </Grid>
          </TabPanel>

          <TabPanel value={tabValue} index={2}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Position</InputLabel>
                  <Select
                    value={sectionForm.position}
                    label="Position"
                    onChange={(e) => handleSectionFormChange('position', e.target.value)}
                  >
                    {positionOptions.map((opt) => (
                      <MenuItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  type="number"
                  label="Sort Order"
                  value={sectionForm.sortOrder}
                  onChange={(e) => handleSectionFormChange('sortOrder', parseInt(e.target.value) || 0)}
                />
              </Grid>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={sectionForm.isActive}
                      onChange={(e) => handleSectionFormChange('isActive', e.target.checked)}
                    />
                  }
                  label="Active"
                />
              </Grid>
            </Grid>
          </TabPanel>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSaveSection}
            disabled={saving}
            startIcon={saving ? <CircularProgress size={20} /> : <SaveIcon />}
          >
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Item Dialog with Stepper (Like Trending Service) */}
      <Dialog
        open={addItemDialogOpen}
        onClose={() => setAddItemDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Add Item to ASAP Section ({selectedSection?.items?.length || 0}/{selectedSection?.maxItems || 2})
        </DialogTitle>
        <DialogContent>
          <Stepper activeStep={addItemStep} orientation="vertical">
            {/* Step 1: Select Category */}
            <Step>
              <StepLabel>Select Category</StepLabel>
              <StepContent>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Choose a category to select a subservice from
                </Typography>
                <Grid container spacing={2}>
                  {categories.map((category) => (
                    <Grid item xs={6} md={4} key={category._id}>
                      <Card
                        sx={{
                          cursor: 'pointer',
                          border: selectedCategory?._id === category._id ? '2px solid #1976d2' : '1px solid #ddd',
                          '&:hover': { boxShadow: 3 },
                        }}
                        onClick={() => handleCategorySelect(category)}
                      >
                        <CardContent sx={{ textAlign: 'center', p: 2 }}>
                          <Avatar sx={{ width: 48, height: 48, mx: 'auto', mb: 1, bgcolor: 'primary.light', fontSize: '1.5rem' }}>
                            {category.icon || '📦'}
                          </Avatar>
                          <Typography variant="body2" fontWeight="bold">
                            {category.name}
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
                {categories.length === 0 && (
                  <Alert severity="warning" sx={{ mt: 2 }}>
                    No categories found. Please create categories first.
                  </Alert>
                )}
              </StepContent>
            </Step>

            {/* Step 2: Select Subservice (Single Selection like Trending Service) */}
            <Step>
              <StepLabel>Select Subservice</StepLabel>
              <StepContent>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Select a subservice. Icon will be auto-fetched from the subservice.
                </Typography>

                {availableSubservices.length === 0 ? (
                  <Alert severity="warning">
                    No available subservices in this category. They may already be added or the category is empty.
                  </Alert>
                ) : (
                  <List dense sx={{ maxHeight: 300, overflow: 'auto' }}>
                    {availableSubservices.map((subservice) => {
                      const isSelected = selectedSubservice?._id === subservice._id;
                      return (
                        <ListItem
                          key={subservice._id}
                          button
                          onClick={() => handleSubserviceSelect(subservice)}
                          sx={{
                            border: isSelected ? '2px solid #1976d2' : '1px solid #eee',
                            mb: 1,
                            borderRadius: 1,
                            bgcolor: isSelected ? 'action.selected' : 'background.paper',
                          }}
                        >
                          <ListItemAvatar>
                            <Avatar 
                              src={subservice.image?.url || subservice.images?.[0]?.url}
                              sx={{ bgcolor: 'primary.light', fontSize: '1.2rem' }}
                            >
                              {subservice.icon || subservice.iconName || '🔧'}
                            </Avatar>
                          </ListItemAvatar>
                          <ListItemText
                            primary={
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Typography>{subservice.name}</Typography>
                                <Chip 
                                  label={`Icon: ${subservice.icon || subservice.iconName || '🔧'}`} 
                                  size="small" 
                                  variant="outlined"
                                  color="secondary"
                                />
                              </Box>
                            }
                            secondary={subservice.pricing?.displayText || `₹${subservice.pricing?.price || 0}`}
                          />
                          <ListItemSecondaryAction>
                            {isSelected && <CheckCircleIcon color="primary" />}
                          </ListItemSecondaryAction>
                        </ListItem>
                      );
                    })}
                  </List>
                )}

                <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                  <Button onClick={handleStepBack}>
                    Back
                  </Button>
                </Box>
              </StepContent>
            </Step>

            {/* Step 3: Customize Item (Icon, Name, etc.) */}
            <Step>
              <StepLabel>Customize Item</StepLabel>
              <StepContent>
                {selectedSubservice && (
                  <Box>
                    {/* Selected Subservice Preview */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
                      <Avatar
                        src={selectedSubservice.image?.url || selectedSubservice.images?.[0]?.url}
                        sx={{ width: 56, height: 56, bgcolor: 'primary.light', fontSize: '1.5rem' }}
                      >
                        {selectedSubservice.icon || selectedSubservice.iconName || '🔧'}
                      </Avatar>
                      <Box>
                        <Typography variant="subtitle1" fontWeight="bold">
                          {selectedSubservice.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Original Subservice • Icon: {selectedSubservice.icon || selectedSubservice.iconName || '🔧'}
                        </Typography>
                      </Box>
                    </Box>

                    <Grid container spacing={2}>
                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          label="Custom Name (Optional)"
                          value={newItemForm.customName}
                          onChange={(e) => setNewItemForm(prev => ({ ...prev, customName: e.target.value }))}
                          placeholder={selectedSubservice.name}
                          helperText="Leave empty to use original name"
                        />
                      </Grid>
                      
                      <Grid item xs={12}>
                        <Typography variant="subtitle2" gutterBottom>
                          Item Icon (Auto-fetched from subservice, you can change it)
                        </Typography>
                        <IconPicker
                          value={newItemForm.customIcon}
                          onChange={(value) => setNewItemForm(prev => ({ ...prev, customIcon: value }))}
                          label="Item Icon"
                        />
                      </Grid>

                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          label="Custom Description (Optional)"
                          value={newItemForm.customDescription}
                          onChange={(e) => setNewItemForm(prev => ({ ...prev, customDescription: e.target.value }))}
                          multiline
                          rows={2}
                          helperText="Leave empty to use original description"
                        />
                      </Grid>

                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          label="Navigation Route"
                          value={newItemForm.navigationRoute}
                          onChange={(e) => setNewItemForm(prev => ({ ...prev, navigationRoute: e.target.value }))}
                          placeholder="/services/plumbing"
                          helperText="Where to navigate when tapped"
                        />
                      </Grid>

                      <Grid item xs={12} md={6}>
                        <TextField
                          fullWidth
                          label="Button Background Color"
                          value={newItemForm.buttonColor}
                          onChange={(e) => setNewItemForm(prev => ({ ...prev, buttonColor: e.target.value }))}
                          helperText="Use rgba() for transparency"
                        />
                      </Grid>

                      <Grid item xs={12} md={6}>
                        <TextField
                          fullWidth
                          label="Icon Color"
                          value={newItemForm.iconColor}
                          onChange={(e) => setNewItemForm(prev => ({ ...prev, iconColor: e.target.value }))}
                          type="color"
                        />
                      </Grid>

                      <Grid item xs={12}>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={newItemForm.isActive}
                              onChange={(e) => setNewItemForm(prev => ({ ...prev, isActive: e.target.checked }))}
                            />
                          }
                          label="Active"
                        />
                      </Grid>
                    </Grid>

                    <Box sx={{ mt: 3, display: 'flex', gap: 1 }}>
                      <Button onClick={handleStepBack}>
                        Back
                      </Button>
                      <Button
                        variant="contained"
                        onClick={handleAddItem}
                        disabled={saving}
                        startIcon={saving ? <CircularProgress size={20} /> : <AddIcon />}
                      >
                        {saving ? 'Adding...' : 'Add Item'}
                      </Button>
                    </Box>
                  </Box>
                )}
              </StepContent>
            </Step>
          </Stepper>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddItemDialogOpen(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>

      {/* Edit Item Dialog */}
      <Dialog
        open={editItemDialogOpen}
        onClose={() => setEditItemDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Edit Item</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            {selectedItem?.subservice && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
                <Avatar
                  src={selectedItem.subservice.image?.url || selectedItem.subservice.images?.[0]?.url}
                  sx={{ width: 56, height: 56, bgcolor: 'primary.light', fontSize: '1.5rem' }}
                >
                  {selectedItem.subservice.icon || '🔧'}
                </Avatar>
                <Box>
                  <Typography variant="subtitle1" fontWeight="bold">
                    {selectedItem.subservice.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Original Subservice • Icon: {selectedItem.subservice.icon || '🔧'}
                  </Typography>
                </Box>
              </Box>
            )}

            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Custom Name"
                  value={itemForm.customName}
                  onChange={(e) => setItemForm(prev => ({ ...prev, customName: e.target.value }))}
                  placeholder={selectedItem?.subservice?.name || 'Service Name'}
                  helperText="Leave empty to use original name (e.g., 'Emergency Plumbing')"
                />
              </Grid>
              
              <Grid item xs={12}>
                <Typography variant="subtitle2" gutterBottom>Item Icon</Typography>
                <IconPicker
                  value={itemForm.customIcon}
                  onChange={(value) => setItemForm(prev => ({ ...prev, customIcon: value }))}
                  label="Item Icon"
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Custom Description"
                  value={itemForm.customDescription}
                  onChange={(e) => setItemForm(prev => ({ ...prev, customDescription: e.target.value }))}
                  multiline
                  rows={2}
                  helperText="Leave empty to use original description"
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Navigation Route"
                  value={itemForm.navigationRoute}
                  onChange={(e) => setItemForm(prev => ({ ...prev, navigationRoute: e.target.value }))}
                  placeholder="/services/plumbing"
                  helperText="Where to navigate when tapped"
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Button Background Color"
                  value={itemForm.buttonColor}
                  onChange={(e) => setItemForm(prev => ({ ...prev, buttonColor: e.target.value }))}
                  helperText="Use rgba() for transparency"
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Icon Color"
                  value={itemForm.iconColor}
                  onChange={(e) => setItemForm(prev => ({ ...prev, iconColor: e.target.value }))}
                  type="color"
                />
              </Grid>

              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={itemForm.isActive}
                      onChange={(e) => setItemForm(prev => ({ ...prev, isActive: e.target.checked }))}
                    />
                  }
                  label="Active"
                />
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditItemDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleUpdateItem}
            disabled={saving}
            startIcon={saving ? <CircularProgress size={20} /> : <SaveIcon />}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default ASAPSectionManager;