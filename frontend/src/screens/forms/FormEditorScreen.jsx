import React, { useState, useMemo, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { FileText, Plus, Trash2, Edit3, GripVertical, Check, X, AlertTriangle, ShieldAlert, ChevronDown, ChevronUp, Layers, CheckCircle2, Tag, SlidersHorizontal, Store } from "lucide-react";

import { c, sans, mono, cardStyle } from "../../config/theme";
import Header from "../../shared/Header";
import Section from "../../shared/Section";
import ModalWrapper from "../../shared/ModalWrapper";
import api from "../../config/api";

export const DEFAULT_CATEGORIES = [
  "ความสะอาด",
  "เอกสาร",
  "กระบวนการทำงาน",
  "คุณภาพสินค้า-วัตถุดิบ",
  "การบริการ"
];

export const CATEGORY_CODE_MAP = {
  "ความสะอาด": "CLN",
  "เอกสาร": "DOC",
  "กระบวนการทำงาน": "OPS",
  "คุณภาพสินค้า-วัตถุดิบ": "QLT",
  "การบริการ": "SVC"
};

export const DEFAULT_FORM_METADATA_CONFIG = [
  {
    id: "auditor",
    label: "ผู้ตรวจประเมิน (Auditor)",
    type: "auditor",
    required: true,
    enabled: true,
    isSystem: true
  },
  {
    id: "audit_type",
    label: "ประเภทการตรวจ (Audit Type)",
    type: "select",
    options: ["ตามกำหนดการ", "นอกกำหนดการ (Spot)", "ปลอมตัว"],
    required: true,
    enabled: true,
    isSystem: true
  },
  {
    id: "staff_count",
    label: "จำนวนพนักงานขณะตรวจ",
    type: "number",
    unit: "คน",
    min: 0,
    required: true,
    enabled: true,
    isSystem: true
  }
];

export default function FormEditorScreen({ form, onBack, onSave, readOnly = false }) {
  const [formName, setFormName] = useState(form ? (form.name || form.title) : "แบบฟอร์มมาตรฐานใหม่");
  const [formType, setFormType] = useState(form ? (form.type || form.locationTypeName || "สาขาหน้าร้าน") : "สาขาหน้าร้าน");
  const [locationTypeId, setLocationTypeId] = useState(form?.locationTypeId || 1);
  const [locationTypes, setLocationTypes] = useState([]);
  const [brands, setBrands] = useState([]);
  const [brandIds, setBrandIds] = useState(() => {
    if (form?.brandIds && Array.isArray(form.brandIds)) return form.brandIds.map(Number);
    if (form?.brandId) return [Number(form.brandId)];
    return [];
  });
  const [isBrandDropdownOpen, setIsBrandDropdownOpen] = useState(false);
  const brandDropdownRef = useRef(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let isMounted = true;
    api.get('/location-type')
      .then(res => {
        if (isMounted && res.data && Array.isArray(res.data)) {
          setLocationTypes(res.data);
        }
      })
      .catch(() => {});

    api.get('/brand')
      .then(res => {
        if (isMounted && res.data && Array.isArray(res.data)) {
          setBrands(res.data);
        }
      })
      .catch(() => {});

    const handleClickOutside = (e) => {
      if (brandDropdownRef.current && !brandDropdownRef.current.contains(e.target)) {
        setIsBrandDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      isMounted = false;
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);
  const [activeEditorTab, setActiveEditorTab] = useState("metadata"); // 'metadata' | 'checklist'
  const [metadataConfig, setMetadataConfig] = useState(() => {
    if (form?.metadataConfig && Array.isArray(form.metadataConfig) && form.metadataConfig.length > 0) {
      return form.metadataConfig;
    }
    if (form?.metadataConfigJson) {
      try {
        const parsed = JSON.parse(form.metadataConfigJson);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {}
    }
    return DEFAULT_FORM_METADATA_CONFIG;
  });

  const [metaFieldModal, setMetaFieldModal] = useState(false);
  const [metaFieldForm, setMetaFieldForm] = useState({
    id: "",
    label: "",
    type: "number",
    unit: "คน",
    min: 0,
    max: 9999,
    options: ["ตามกำหนดการ", "สุ่มตรวจ (Spot)", "ปลอมตัว"],
    newOptionInput: "",
    required: false,
    enabled: true,
    placeholder: ""
  });
  const [editingMetaIndex, setEditingMetaIndex] = useState(null);
  const [metaFieldErrors, setMetaFieldErrors] = useState({});
  const [formErrors, setFormErrors] = useState({});

  const [description, setDescription] = useState(
    form?.description || "แบบฟอร์มตรวจสอบมาตรฐานคุณภาพ การบริการ และสุขอนามัยประจำสาขา (Q.S.C. Standard)"
  );
  const [passingScore, setPassingScore] = useState(() => {
    if (form && form.passingScore !== undefined && form.passingScore !== null) {
      return Number(form.passingScore);
    }
    return 85;
  });

  const [categories, setCategories] = useState(() => {
    const fromItems = new Set();
    if (form?.sections) {
      form.sections.forEach(s => {
        (s.items || []).forEach(i => {
          if (i.categoryName) fromItems.add(i.categoryName);
          else if (i.category) fromItems.add(i.category);
        });
      });
    }
    DEFAULT_CATEGORIES.forEach(c => fromItems.add(c));
    return Array.from(fromItems);
  });
  const [newCategoryInput, setNewCategoryInput] = useState("");

  const [sections, setSections] = useState(() => {
    if (form?.sections && form.sections.length > 0) {
      return form.sections.map(s => ({
        id: s.id,
        title: s.title,
        orderIndex: s.orderIndex,
        weightPercent: s.weightPercent || 0,
        items: (s.items || []).map(i => {
          const cat = i.categoryName || i.category || (i.categoryCode === "DOC" ? "เอกสาร" : i.categoryCode === "OPS" ? "กระบวนการทำงาน" : i.categoryCode === "QLT" ? "คุณภาพสินค้า-วัตถุดิบ" : i.categoryCode === "SVC" ? "การบริการ" : DEFAULT_CATEGORIES[0]);
          return {
            id: i.id || ("q_" + Math.random().toString(36).substr(2, 9)),
            text: i.questionText || i.text || i.title || "",
            questionText: i.questionText || i.text || i.title || "",
            type: ((i.questionType || i.type || "yesno").toLowerCase() === "scale") ? "scale" : "yesno",
            fullScore: Number(i.fullScore !== undefined ? i.fullScore : (i.maxScore !== undefined ? i.maxScore : 10)),
            critical: !!(i.isCritical !== undefined ? i.isCritical : i.critical),
            category: cat,
            categoryName: cat,
            categoryCode: i.categoryCode || CATEGORY_CODE_MAP[cat] || "GEN"
          };
        })
      }));
    }
    return [
      {
        title: "หัวข้อหลัก",
        weightPercent: 0,
        items: [
          { id: "q1", text: "คำถามรายข้อ", questionText: "คำถามรายข้อ", type: "yesno", fullScore: 10, critical: false, category: DEFAULT_CATEGORIES[0], categoryName: DEFAULT_CATEGORIES[0], categoryCode: "CLN" }
        ]
      }
    ];
  });

  const [editingId, setEditingId] = useState(null);
  const [editingSecIdx, setEditingSecIdx] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null); // { type: 'section' | 'item', secIdx, itemId?, title?, text?, itemIdx? }
  const [warningModal, setWarningModal] = useState({ isOpen: false, title: '', message: '' });
  const toastTimerRef = useRef(null);

  // Drag-to-reorder state and refs
  const itemRefs = useRef({});
  const sectionRefs = useRef({});
  const dragRef = useRef(null);
  const [dragUI, setDragUI] = useState(null);

  useEffect(() => {
    let isMounted = true;
    api.get('/location-type')
      .then(res => {
        if (isMounted && res.data && Array.isArray(res.data)) {
          setLocationTypes(res.data);
          if (!form?.locationTypeId && res.data.length > 0) {
            setLocationTypeId(res.data[0].id);
            setFormType(res.data[0].name || res.data[0].code);
          }
        }
      })
      .catch(() => {});
    return () => { isMounted = false; };
  }, [form]);

  const showToast = (msg) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastMessage(msg);
    toastTimerRef.current = setTimeout(() => setToastMessage(null), 2500);
  };

  // Add a new section and auto-scroll to it
  const addSection = () => {
    const newSecNumber = sections.length + 1;
    const newSecIdx = sections.length;
    const defaultCat = categories[0] || DEFAULT_CATEGORIES[0];
    const newSection = {
      title: `หมวดหมู่ใหม่ (New Section)`,
      weightPercent: 0,
      items: [
        { id: "q_" + Date.now(), text: "ระบุข้อคำถามที่ต้องการตรวจประเมิน...", type: "yesno", fullScore: 10, critical: false, category: defaultCat }
      ]
    };
    setSections([...sections, newSection]);
    //showToast("เพิ่มหมวดหมู่ใหม่เรียบร้อยแล้ว");

    // Auto-scroll smooth to newly added section
    setTimeout(() => {
      const el = sectionRefs.current[newSecIdx];
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 80);
  };

  // Request remove section (Open popup confirm)
  const handleRequestRemoveSection = (secIdx) => {
    if (sections.length <= 1) {
      setWarningModal({
        isOpen: true,
        title: "ไม่สามารถลบหมวดหมู่ได้",
        message: "แบบฟอร์มต้องมีอย่างน้อย 1 หมวดหมู่ เพื่อใช้ในการตรวจประเมิน"
      });
      return;
    }
    const sec = sections[secIdx];
    setDeleteTarget({
      type: "section",
      secIdx,
      title: sec.title,
      itemCount: sec.items?.length || 0
    });
  };

  // Add question to section and auto-scroll to it
  const addItemToSection = (secIdx) => {
    const newId = "q_" + Date.now();
    const secTitle = sections[secIdx]?.title || "";
    const defaultCat = categories.find(c => secTitle.includes(c)) || categories[0] || DEFAULT_CATEGORIES[0];
    
    setSections(prev => prev.map((sec, sIdx) => {
      if (sIdx !== secIdx) return sec;
      return {
        ...sec,
        items: [
          ...(sec.items || []),
          {
            id: newId,
            text: "ระบุข้อคำถามใหม่...",
            questionText: "ระบุข้อคำถามใหม่...",
            type: "yesno",
            questionType: "YESNO",
            fullScore: 10,
            critical: false,
            category: defaultCat,
            categoryName: defaultCat,
            categoryCode: CATEGORY_CODE_MAP[defaultCat] || "GEN"
          }
        ]
      };
    }));

    // Auto-scroll smooth to newly added question
    setTimeout(() => {
      const itemEl = itemRefs.current[`${secIdx}-${newId}`];
      if (itemEl) {
        itemEl.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 80);
  };

  // Request remove question (Open popup confirm)
  const handleRequestRemoveItem = (secIdx, item, itemIdx) => {
    if (sections[secIdx].items.length <= 1) {
      setWarningModal({
        isOpen: true,
        title: "ไม่สามารถลบข้อคำถามได้",
        message: "หมวดหมู่นี้ต้องมีคำถามอย่างน้อย 1 ข้อ หากไม่ต้องการใช้หมวดหมู่นี้ สามารถเลือกลบทั้งหมวดหมู่แทนได้ครับ"
      });
      return;
    }
    setDeleteTarget({
      type: "item",
      secIdx,
      itemId: item.id,
      itemIdx: itemIdx + 1,
      text: item.text
    });
  };

  // Execute confirmed deletion
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    if (deleteTarget.type === "form") {
      try {
        if (typeof deleteTarget.id === 'number') {
          await api.delete(`/form/${deleteTarget.id}`);
        }
      } catch (err) {}
      setDeleteTarget(null);
      onBack();
      return;
    }

    if (deleteTarget.type === "section") {
      setSections(prev => prev.filter((_, idx) => idx !== deleteTarget.secIdx));
      //showToast("ลบหมวดหมู่ออกเรียบร้อยแล้ว");
    } else if (deleteTarget.type === "item") {
      setSections(prev => prev.map((sec, sIdx) => {
        if (sIdx !== deleteTarget.secIdx) return sec;
        return {
          ...sec,
          items: (sec.items || []).filter(i => i.id !== deleteTarget.itemId)
        };
      }));
      //showToast("ลบข้อคำถามเรียบร้อยแล้ว");
    }

    setDeleteTarget(null);
  };

  // Update question text
  const updateItemText = (secIdx, itemId, newText) => {
    setSections(prev => prev.map((sec, sIdx) => {
      if (sIdx !== secIdx) return sec;
      return {
        ...sec,
        items: (sec.items || []).map(i => i.id === itemId ? { ...i, text: newText, questionText: newText } : i)
      };
    }));
  };

  // Update question type (yesno / scale / text)
  const updateItemType = (secIdx, itemId, newType) => {
    setSections(prev => prev.map((sec, sIdx) => {
      if (sIdx !== secIdx) return sec;
      return {
        ...sec,
        items: (sec.items || []).map(i => i.id === itemId ? { ...i, type: newType, questionType: newType } : i)
      };
    }));
  };

  // Update question category (ความสะอาด, เอกสาร, กระบวนการทำงาน, etc.)
  const updateItemCategory = (secIdx, itemId, newCat) => {
    setSections(prev => prev.map((sec, sIdx) => {
      if (sIdx !== secIdx) return sec;
      return {
        ...sec,
        items: (sec.items || []).map(i => {
          if (i.id === itemId) {
            return {
              ...i,
              category: newCat,
              categoryName: newCat,
              categoryCode: CATEGORY_CODE_MAP[newCat] || "GEN"
            };
          }
          return i;
        })
      };
    }));
  };

  // Add new scoring category
  const handleAddCategory = () => {
    const trimmed = newCategoryInput.trim();
    if (!trimmed) return;
    if (categories.includes(trimmed)) {
      showToast("มีหมวดคะแนนนี้อยู่แล้ว");
      return;
    }
    setCategories(prev => [...prev, trimmed]);
    setNewCategoryInput("");
    showToast(`เพิ่มหมวดคะแนน "${trimmed}" เรียบร้อย`);
  };

  // Remove custom scoring category
  const handleRemoveCategory = (catName) => {
    if (categories.length <= 1) {
      showToast("ต้องมีหมวดคะแนนอย่างน้อย 1 หมวด");
      return;
    }
    setCategories(prev => prev.filter(c => c !== catName));
    // Re-assign items that had this category to the first available category
    const fallbackCat = categories.find(c => c !== catName) || DEFAULT_CATEGORIES[0];
    setSections(prev => prev.map(s => ({
      ...s,
      items: (s.items || []).map(item => (item.category === catName || item.categoryName === catName) ? { ...item, category: fallbackCat, categoryName: fallbackCat, categoryCode: CATEGORY_CODE_MAP[fallbackCat] || "GEN" } : item)
    })));
    showToast(`ลบหมวดคะแนน "${catName}" เรียบร้อย`);
  };

  const categoryCounts = useMemo(() => {
    const counts = {};
    categories.forEach(c => { counts[c] = 0; });
    sections.forEach(s => {
      s.items.forEach(i => {
        const cat = i.category || i.categoryName || DEFAULT_CATEGORIES[0];
        counts[cat] = (counts[cat] || 0) + 1;
      });
    });
    return counts;
  }, [categories, sections]);

  // Toggle Critical Failure Flag
  const toggleItemCritical = (secIdx, itemId) => {
    setSections(prev => prev.map((sec, sIdx) => {
      if (sIdx !== secIdx) return sec;
      return {
        ...sec,
        items: (sec.items || []).map(i => i.id === itemId ? { ...i, critical: !i.critical, isCritical: !i.critical } : i)
      };
    }));
  };

  // Update question score
  const updateItemScore = (secIdx, itemId, newScore) => {
    const val = newScore === "" ? "" : Number(newScore);
    setSections(prev => prev.map((sec, sIdx) => {
      if (sIdx !== secIdx) return sec;
      return {
        ...sec,
        items: (sec.items || []).map(i => {
          if (i.id === itemId) {
            return {
              ...i,
              fullScore: val,
              maxScore: val
            };
          }
          return i;
        })
      };
    }));
  };

  // On blur, if score is empty or 0, fallback to 10
  const handleItemScoreBlur = (secIdx, itemId, currentVal) => {
    if (currentVal === "" || isNaN(Number(currentVal)) || Number(currentVal) < 1) {
      updateItemScore(secIdx, itemId, 10);
    }
  };

  // Update section title
  const updateSectionTitle = (secIdx, newTitle) => {
    setSections(prev => prev.map((sec, sIdx) => sIdx === secIdx ? { ...sec, title: newTitle } : sec));
  };

  // Move section Up/Down
  const moveSection = (secIdx, direction) => {
    const targetIdx = direction === 'up' ? secIdx - 1 : secIdx + 1;
    if (targetIdx < 0 || targetIdx >= sections.length) return;
    const next = [...sections];
    const temp = next[secIdx];
    next[secIdx] = next[targetIdx];
    next[targetIdx] = temp;
    setSections(next);
    //showToast("สลับลำดับหมวดหมู่เรียบร้อย");
  };

  // Drag handlers for reordering items inside a section
  const handlePointerDown = (e, secIdx, itemId) => {
    e.preventDefault();
    const section = sections[secIdx];
    if (!section) return;
    const itemIds = section.items.map(i => i.id);
    const startIdx = itemIds.indexOf(itemId);
    if (startIdx === -1) return;

    const tops = [];
    const heights = [];
    itemIds.forEach(id => {
      const el = itemRefs.current[`${secIdx}-${id}`];
      if (el) {
        const rect = el.getBoundingClientRect();
        tops.push(rect.top + window.scrollY);
        heights.push(rect.height);
      } else {
        tops.push(0);
        heights.push(60);
      }
    });

    const startPointerY = e.clientY;
    dragRef.current = {
      secIdx,
      id: itemId,
      startIdx,
      currentIdx: startIdx,
      itemIds,
      tops,
      heights,
      startPointerY
    };

    setDragUI({ secIdx, id: itemId, deltaY: 0, displace: {} });

    const handlePointerMove = (moveEvent) => {
      if (!dragRef.current) return;
      const d = dragRef.current;
      const deltaY = moveEvent.clientY - d.startPointerY;
      const currentCenterY = d.tops[d.startIdx] + deltaY + d.heights[d.startIdx] / 2;

      let newIdx = d.startIdx;
      for (let i = 0; i < d.tops.length; i++) {
        const itemCenter = d.tops[i] + d.heights[i] / 2;
        if (i < d.startIdx && currentCenterY < itemCenter) {
          newIdx = i;
          break;
        } else if (i > d.startIdx && currentCenterY > itemCenter) {
          newIdx = i;
        }
      }

      d.currentIdx = newIdx;
      const displace = {};
      d.itemIds.forEach((id, i) => {
        if (id === d.id) return;
        if (d.startIdx < newIdx && i > d.startIdx && i <= newIdx) {
          displace[id] = -d.heights[d.startIdx];
        } else if (d.startIdx > newIdx && i >= newIdx && i < d.startIdx) {
          displace[id] = d.heights[d.startIdx];
        } else {
          displace[id] = 0;
        }
      });

      setDragUI({ secIdx: d.secIdx, id: d.id, deltaY, displace });
    };

    const handlePointerUp = () => {
      if (dragRef.current) {
        const d = dragRef.current;
        if (d.startIdx !== d.currentIdx) {
          const next = [...sections];
          const items = [...next[d.secIdx].items];
          const [movedItem] = items.splice(d.startIdx, 1);
          items.splice(d.currentIdx, 0, movedItem);
          next[d.secIdx].items = items;
          setSections(next);
          //showToast("สลับลำดับข้อคำถามเรียบร้อย");
        }
      }
      dragRef.current = null;
      setDragUI(null);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  };
  const totalQuestions = useMemo(() => {
    return sections.reduce((sum, s) => sum + s.items.length, 0);
  }, [sections]);

  // Metadata field helpers
  const getFieldTypeLabel = (type) => {
    switch (type) {
      case "number": return "ตัวเลข / จำนวน";
      case "date": return "ปฏิทิน (วันที่)";
      case "time": return "เวลา (ชั่วโมง:นาที)";
      case "select": return "ตัวเลือก (Dropdown/Badges)";
      case "text":
      case "textarea": return "ข้อความ / หมายเหตุ";
      case "toggle": return "สวิตช์ ใช่/ไม่ใช่";
      case "auditor": return "ผู้ตรวจประเมิน";
      default: return type || "ทั่วไป";
    }
  };

  const moveMetaField = (index, direction) => {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= metadataConfig.length) return;
    const next = [...metadataConfig];
    const temp = next[index];
    next[index] = next[targetIdx];
    next[targetIdx] = temp;
    setMetadataConfig(next);
  };

  const toggleMetaFieldEnabled = (id) => {
    setMetadataConfig(prev => prev.map(f => f.id === id ? { ...f, enabled: f.enabled === false ? true : false } : f));
  };

  const deleteMetaField = (id) => {
    setMetadataConfig(prev => prev.filter(f => f.id !== id));
    showToast("ลบฟิลด์ข้อมูลเรียบร้อย");
  };

  const openAddMetaField = () => {
    setEditingMetaIndex(null);
    setMetaFieldErrors({});
    setMetaFieldForm({
      id: "meta_" + Date.now().toString(36),
      label: "",
      type: "number",
      unit: "คน",
      min: 0,
      max: 9999,
      options: ["ตามกำหนดการ", "สุ่มตรวจ (Spot)", "ปลอมตัว"],
      newOptionInput: "",
      required: false,
      enabled: true,
      placeholder: ""
    });
    setMetaFieldModal(true);
  };

  const openEditMetaField = (field, index) => {
    setEditingMetaIndex(index);
    setMetaFieldErrors({});
    setMetaFieldForm({
      id: field.id || ("meta_" + index),
      label: field.label || "",
      type: field.type || "text",
      unit: field.unit || "",
      min: field.min !== undefined ? field.min : 0,
      max: field.max !== undefined ? field.max : 9999,
      options: Array.isArray(field.options) ? [...field.options] : ["ตามกำหนดการ", "สุ่มตรวจ (Spot)", "ปลอมตัว"],
      newOptionInput: "",
      required: !!field.required,
      enabled: field.enabled !== false,
      placeholder: field.placeholder || "",
      isSystem: !!field.isSystem
    });
    setMetaFieldModal(true);
  };

  const handleSaveMetaField = () => {
    if (!metaFieldForm.label.trim()) {
      setMetaFieldErrors({ label: true });
      return;
    }
    setMetaFieldErrors({});

    const fieldObj = {
      id: metaFieldForm.id || ("meta_" + Date.now().toString(36)),
      label: metaFieldForm.label.trim(),
      type: metaFieldForm.type,
      required: !!metaFieldForm.required,
      enabled: metaFieldForm.enabled !== false,
      placeholder: metaFieldForm.placeholder?.trim() || "",
      isSystem: !!metaFieldForm.isSystem
    };

    if (metaFieldForm.type === "number") {
      fieldObj.unit = metaFieldForm.unit?.trim() || "";
      if (metaFieldForm.min !== "") fieldObj.min = Number(metaFieldForm.min);
      if (metaFieldForm.max !== "") fieldObj.max = Number(metaFieldForm.max);
    } else if (metaFieldForm.type === "select") {
      fieldObj.options = metaFieldForm.options.filter(opt => opt.trim().length > 0);
    }

    if (editingMetaIndex !== null && editingMetaIndex >= 0) {
      const next = [...metadataConfig];
      next[editingMetaIndex] = fieldObj;
      setMetadataConfig(next);
      showToast("อัปเดตฟิลด์ข้อมูลเรียบร้อย");
    } else {
      setMetadataConfig(prev => [...prev, fieldObj]);
      showToast("เพิ่มฟิลด์ข้อมูลเรียบร้อย");
    }

    setMetaFieldModal(false);
  };

  // Save form
  const handleSave = async () => {
    if (readOnly) return;
    if (!formName.trim()) {
      setFormErrors({ name: true });
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setFormErrors({});
    if (sections.length === 0) {
      showToast("ต้องมีอย่างน้อย 1 หมวดหมู่");
      return;
    }

    setIsSaving(true);
    const dto = {
      title: formName.trim(),
      locationTypeId: locationTypeId || 1,
      brandId: brandIds.length > 0 ? brandIds[0] : null,
      brandIds: brandIds.map(Number),
      passingScore: Number(passingScore) || 85,
      targetingMode: "ALL_LOCATIONS",
      version: form?.version || "v1.0",
      metadataConfigJson: JSON.stringify(metadataConfig),
      sections: sections.map((sec, sIdx) => ({
        id: typeof sec.id === 'number' ? sec.id : undefined,
        title: sec.title,
        orderIndex: sIdx + 1,
        weightPercent: 0,
        items: (sec.items || []).map((item, iIdx) => {
          const cat = item.category || item.categoryName || DEFAULT_CATEGORIES[0];
          return {
            id: typeof item.id === 'number' ? item.id : undefined,
            questionText: item.text || item.questionText || "",
            questionType: (item.type || item.questionType) === "scale" ? "SCALE" : "YESNO",
            fullScore: Number(item.fullScore) || 10,
            isCritical: !!(item.critical || item.isCritical),
            categoryCode: item.categoryCode || CATEGORY_CODE_MAP[cat] || "GEN",
            categoryName: cat,
            orderIndex: iIdx + 1
          };
        })
      }))
    };

    let backendId = form?.id;
    try {
      if (form?.id && typeof form.id === 'number') {
        const res = await api.put(`/form/${form.id}`, dto);
        if (res.data?.formId) backendId = res.data.formId;
      } else {
        const res = await api.post('/form', dto);
        if (res.data?.id) backendId = res.data.id;
      }
      showToast("บันทึกแบบฟอร์มลงฐานข้อมูลเรียบร้อยแล้ว");
    } catch (err) {
      console.error("Could not save form directly to API:", err);
      const errMsg = err.response?.data?.message || "ไม่สามารถบันทึกแบบฟอร์มลงฐานข้อมูลได้ กรุณาลองใหม่อีกครั้ง";
      showToast(`⚠️ ${errMsg}`);
      setIsSaving(false);
      return;
    }

    const selectedBrandObjects = brands.filter(b => brandIds.includes(b.id));
    const savedForm = {
      id: backendId || form?.id || "f_" + Date.now(),
      name: formName.trim(),
      title: formName.trim(),
      type: formType,
      locationTypeId: locationTypeId || 1,
      brandId: brandIds.length > 0 ? brandIds[0] : null,
      brandIds: brandIds.map(Number),
      brandName: selectedBrandObjects.length > 0 ? selectedBrandObjects[0].name : null,
      brandNames: selectedBrandObjects.map(b => b.name),
      description: description.trim(),
      passingScore: Number(passingScore) || 85,
      metadataConfig: metadataConfig,
      metadataConfigJson: JSON.stringify(metadataConfig),
      sections: sections,
      itemCount: totalQuestions,
      updatedAt: "วันนี้"
    };

    if (onSave) {
      onSave(savedForm);
    }
    setIsSaving(false);
    onBack();
  };

  return (
    <div className="page-transition p-4 sm:p-6 space-y-6 w-full max-w-[100%] sm:max-w-[92%] mx-auto pb-24">
      {/* 1. TOP HEADER */}
      <Header
        title={form ? `แก้ไขแบบฟอร์ม: ${form.name || form.title}` : "สร้างแบบฟอร์มมาตรฐานใหม่"}
        subtitle="กำหนดเกณฑ์คะแนน หัวข้อ และหมวดหมู่คำถามสำหรับการตรวจประเมิน"
        onBack={onBack}
      />

      {/* ⚠️ IN-USE WARNING BANNER */}
      {(form?.usedCount > 0 || form?.scheduledCount > 0) && (
        <div className="rounded-2xl p-4 bg-amber-50/90 border border-amber-200 text-amber-950 flex items-start gap-3 shadow-2xs">
          <AlertTriangle size={20} className="text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs sm:text-sm space-y-1">
            <p className="font-bold text-amber-950 flex items-center gap-2 flex-wrap">
              <span>แบบฟอร์มนี้มีการใช้งานอยู่ในระบบ</span>
              {form.usedCount > 0 && (
                <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 font-mono text-xs font-bold">
                  ตรวจแล้ว {form.usedCount} ครั้ง
                </span>
              )}
              {form.scheduledCount > 0 && (
                <span className="px-2 py-0.5 rounded-md bg-purple-100 text-purple-900 font-mono text-xs font-bold">
                  มีนัดตรวจ {form.scheduledCount} รายการ
                </span>
              )}
            </p>
            <p className="text-slate-600 text-xs leading-relaxed">
              การแก้ไขข้อคำถามหรือเกณฑ์คะแนน ระบบจะจัดเก็บเป็นประวัติเวอร์ชันใหม่อัตโนมัติ เพื่อรักษาความถูกต้องของรายงานผลตรวจย้อนหลัง
            </p>
          </div>
        </div>
      )}

      {/* 🌟 2. STREAMLINED FORM SETTINGS CARD */}
      <div className="rounded-3xl p-5 sm:p-6 bg-white border border-slate-200 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-[#0F6659] flex items-center justify-center font-bold shrink-0">
              <FileText size={18} />
            </div>
            <h3 className="text-sm sm:text-base font-bold text-slate-800 leading-snug">ข้อมูลทั่วไปและเกณฑ์ของแบบฟอร์ม</h3>
          </div>
          <div className="text-right shrink-0 px-2.5 py-1 rounded-xl bg-emerald-50 text-[#0F6659] border border-emerald-200/80 shadow-2xs">
            <div className="text-[11px] font-normal leading-tight whitespace-nowrap text-emerald-800">
              {sections.length} หมวดหมู่
            </div>
            <div className="text-[11px] font-normal leading-tight whitespace-nowrap text-emerald-700 mt-0.5">
              {totalQuestions} ข้อคำถาม
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {/* 1. ชื่อแบบฟอร์ม */}
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5 flex items-center justify-between">
              <span>ชื่อแบบฟอร์มการตรวจ (Form Title) <span className="text-rose-500">*</span></span>
              {formErrors.name && (
                <span className="text-xs font-bold text-rose-600 animate-in fade-in flex items-center gap-1">
                  <AlertTriangle size={13} /> กรุณาระบุชื่อแบบฟอร์ม
                </span>
              )}
            </label>
            <input
              value={formName}
              onChange={(e) => {
                setFormName(e.target.value);
                if (formErrors.name) setFormErrors(prev => ({ ...prev, name: false }));
              }}
              placeholder="เช่น แบบฟอร์มมาตรฐาน 5 ดาว (QSC Core Store Audit)..."
              className={`w-full text-sm sm:text-base font-semibold px-4.5 py-3.5 min-h-[50px] rounded-2xl border outline-none transition-all shadow-xs placeholder:text-slate-400 ${
                formErrors.name
                  ? "border-rose-500 ring-2 ring-rose-500/20 bg-rose-50/40 text-slate-800 animate-shake"
                  : "bg-white border-slate-200 text-slate-800 focus:border-[#0F6659]"
              }`}
              required
            />
          </div>

          {/* 2. แถวกลาง: เกณฑ์คะแนน + ประเภทฟอร์ม + แบรนด์ */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            {/* เกณฑ์คะแนนผ่าน (%) */}
            <div className="min-w-0">
              <label className="block text-sm font-medium text-slate-600 mb-1.5 truncate">
                เกณฑ์ผ่าน (%) <span className="text-rose-500">*</span>
              </label>
              <div className="flex items-center justify-between px-3.5 py-3 min-h-[50px] rounded-2xl bg-white border border-slate-200 focus-within:border-[#0F6659] transition-all shadow-xs gap-1.5">
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={passingScore ?? 85}
                    onChange={(e) => {
                      const val = e.target.value === '' ? '' : Math.min(100, Math.max(1, Number(e.target.value) || 0));
                      setPassingScore(val);
                    }}
                    onBlur={() => {
                      if (!passingScore || passingScore < 1) setPassingScore(85);
                    }}
                    className="w-12 text-sm sm:text-base font-bold text-slate-800 focus:text-emerald-950 outline-none font-mono text-center p-0 bg-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    placeholder="85"
                    required
                  />
                  <span className="text-xs font-semibold text-slate-400 select-none whitespace-nowrap">
                    % ขึ้นไป
                  </span>
                </div>
              </div>
            </div>

            {/* ประเภทฟอร์ม */}
            <div className="min-w-0">
              <label className="block text-sm font-medium text-slate-600 mb-1.5 truncate">
                ประเภทฟอร์ม (Category)
              </label>
              <div className="relative flex items-center bg-white border border-slate-200 hover:border-slate-300 focus-within:border-[#0F6659] focus-within:ring-2 focus-within:ring-[#0F6659]/10 rounded-2xl transition-all shadow-xs min-h-[50px] px-3.5">
                <Tag size={16} className="text-[#0F6659] shrink-0 mr-2 pointer-events-none" />
                <select
                  value={locationTypeId || ""}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setLocationTypeId(val);
                    const selectedObj = locationTypes.find(lt => lt.id === val);
                    if (selectedObj) setFormType(selectedObj.name || selectedObj.code);
                  }}
                  className="w-full bg-transparent text-xs sm:text-sm font-semibold text-slate-700 outline-none cursor-pointer appearance-none truncate pr-8 py-3"
                >
                  {locationTypes.length > 0 ? (
                    locationTypes.map(lt => (
                      <option key={lt.id} value={lt.id}>{lt.name || lt.code}</option>
                    ))
                  ) : (
                    <>
                      <option value={1}>สาขาหน้าร้าน (Store Front)</option>
                      <option value={2}>ครัวและคลังสินค้า (Kitchen & Storage)</option>
                      <option value={3}>ขับรถรับ (Drive-Thru)</option>
                      <option value={4}>จัดส่งและเดลิเวอรี (Delivery)</option>
                      <option value={5}>ตรวจความปลอดภัยอาหาร (Food Safety)</option>
                    </>
                  )}
                </select>
                <ChevronDown size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none shrink-0" />
              </div>
            </div>

            {/* แบรนด์ (Brand) - Multi-Select */}
            <div className="min-w-0 relative">
              <label className="block text-sm font-medium text-slate-600 mb-1.5 truncate flex items-center justify-between">
                <span>แบรนด์ (Brand)</span>
                <span className="text-[11px] font-medium text-slate-400">เลือกได้หลายแบรนด์</span>
              </label>
              <div 
                ref={brandDropdownRef}
                onClick={() => setIsBrandDropdownOpen(prev => !prev)}
                className={`w-full min-h-[50px] px-3.5 py-2 rounded-2xl bg-white border transition-all shadow-xs cursor-pointer flex items-center justify-between gap-2 ${
                  isBrandDropdownOpen ? 'border-[#0F6659] ring-2 ring-[#0F6659]/10' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-1.5 flex-wrap min-w-0 flex-1 py-0.5">
                  {brandIds.length === 0 ? (
                    <span className="text-sm font-normal text-slate-500 flex items-center gap-1.5">
                      <Store size={14} className="text-slate-400" />
                      <span>ทุกแบรนด์ (All Brands / Global)</span>
                    </span>
                  ) : (
                    brandIds.map(bid => {
                      const bObj = brands.find(b => b.id === bid);
                      return (
                        <span 
                          key={bid}
                          className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-lg bg-emerald-50 text-[#0F6659] border border-emerald-200/80 shrink-0 select-none animate-in fade-in zoom-in-95 duration-100"
                          onClick={(e) => {
                            e.stopPropagation();
                            setBrandIds(prev => prev.filter(id => id !== bid));
                          }}
                          title="คลิกเพื่อลบแบรนด์นี้ออก"
                        >
                          <Store size={11} className="text-emerald-600" />
                          <span>{bObj?.name || `Brand #${bid}`}</span>
                          <X size={12} className="text-emerald-700 hover:text-rose-600 cursor-pointer ml-0.5" />
                        </span>
                      );
                    })
                  )}
                </div>
                <ChevronDown size={16} className={`text-slate-400 shrink-0 transition-transform duration-200 ${isBrandDropdownOpen ? 'rotate-180 text-[#0F6659]' : ''}`} />
              </div>

              {/* Multi-Brand Popover Menu */}
              {isBrandDropdownOpen && (
                <div 
                  className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 p-2 space-y-1 animate-in fade-in zoom-in-95 duration-150 max-h-56 overflow-y-auto"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* All Brands Option */}
                  <label 
                    onClick={() => setBrandIds([])}
                    className={`flex items-center gap-2.5 p-2 rounded-xl cursor-pointer transition-colors text-xs sm:text-sm font-bold ${
                      brandIds.length === 0 ? 'bg-emerald-50 text-[#0F6659]' : 'text-slate-800 hover:bg-slate-50'
                    }`}
                  >
                    <input 
                      type="checkbox"
                      checked={brandIds.length === 0}
                      onChange={() => setBrandIds([])}
                      className="w-4 h-4 rounded text-[#0F6659] focus:ring-[#0F6659] accent-[#0F6659] cursor-pointer"
                    />
                    <span className="flex-1">ทุกแบรนด์ (All Brands / Global)</span>
                  </label>
                  
                  <div className="border-t border-slate-100 my-1" />

                  {/* Individual Brands */}
                  {brands.map(b => {
                    const isChecked = brandIds.includes(b.id);
                    return (
                      <label 
                        key={b.id}
                        onClick={() => {
                          setBrandIds(prev => {
                            if (prev.includes(b.id)) {
                              return prev.filter(id => id !== b.id);
                            } else {
                              return [...prev, b.id];
                            }
                          });
                        }}
                        className={`flex items-center gap-2.5 p-2 rounded-xl cursor-pointer transition-colors text-xs sm:text-sm font-medium ${
                          isChecked ? 'bg-emerald-50 text-[#0F6659] font-bold' : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <input 
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          className="w-4 h-4 rounded text-[#0F6659] focus:ring-[#0F6659] accent-[#0F6659] cursor-pointer"
                        />
                        <span className="flex-1">{b.name}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* 3. คำอธิบายแบบฟอร์ม */}
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">
              คำอธิบาย / วัตถุประสงค์การตรวจ
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="ระบุคำอธิบาย หรือข้อแนะนำสำหรับผู้ตรวจ..."
              className="w-full text-sm sm:text-base font-semibold px-4.5 py-3.5 min-h-[50px] rounded-2xl bg-white border border-slate-200 text-slate-800 focus:border-[#0F6659] outline-none transition-all shadow-xs placeholder:text-slate-400"
            />
          </div>
        </div>
      </div>

      {/* 🌟 TABS NAVIGATION */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveEditorTab("metadata")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
            activeEditorTab === "metadata"
              ? "bg-[#0F6659] text-white shadow-sm"
              : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
          }`}
        >
          <SlidersHorizontal size={16} />
          <span>รายละเอียดการตรวจ</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveEditorTab("checklist")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
            activeEditorTab === "checklist"
              ? "bg-[#0F6659] text-white shadow-sm"
              : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
          }`}
        >
          <CheckCircle2 size={16} />
          <span>หมวดหมู่ คำถาม ({totalQuestions} ข้อ)</span>
        </button>
      </div>

      {/* 📋 TAB 1: CHECKLIST & QUESTIONS */}
      {activeEditorTab === "checklist" && (
        <div className="space-y-6 animate-in fade-in duration-150">
          {/* 🌟 2.5. SCORING CATEGORIES MANAGER (ประเภทหมวดคะแนน) */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div>
                  <h3 className="text-sm sm:text-base font-extrabold text-slate-800">
                    ประเภทหมวดคะแนนในแบบฟอร์มนี้ (Scoring Categories)
                  </h3>
                  <p className="text-xs text-slate-500">
                    กำหนดหมวดคะแนน นำไปใช้คำนวณสถิติแยกตามหมวด
                  </p>
                </div>
              </div>

              <span className="text-xs font-bold px-3 py-1 rounded-xl bg-slate-100 text-slate-700 self-start sm:self-auto font-mono">
                {categories.length} หมวดคะแนน
              </span>
            </div>

        {/* Categories Badges List */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {categories.map((cat, idx) => {
            const count = categoryCounts[cat] || 0;
            return (
              <div
                key={idx}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50/80 border border-emerald-200 text-emerald-900 text-xs font-bold group shadow-2xs transition-all"
              >
                <span>{cat}</span>
                <span className="px-1.5 py-0.5 rounded-md bg-white border border-emerald-200 text-[#0F6659] text-[10px] font-black font-mono">
                  {count} ข้อ
                </span>
                {categories.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveCategory(cat)}
                    className="text-emerald-400 hover:text-rose-600 p-0.5 rounded hover:bg-white cursor-pointer transition-colors"
                    title={`ลบหมวดคะแนน "${cat}"`}
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Add Category Input Bar */}
        <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
          <div className="relative flex-1 max-w-sm">
            <Tag size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="เพิ่มชื่อหมวดคะแนนใหม่ (เช่น ความปลอดภัย, สุขาภิบาล)..."
              value={newCategoryInput}
              onChange={(e) => setNewCategoryInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddCategory();
                }
              }}
              className="w-full text-xs pl-8 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 outline-none font-semibold text-slate-800 focus:bg-white focus:border-[#0F6659] transition-all"
            />
          </div>
          <button
            type="button"
            onClick={handleAddCategory}
            className="px-3.5 py-2 rounded-xl bg-[#0F6659] hover:bg-[#0D5449] text-white text-xs font-bold flex items-center gap-1 cursor-pointer transition-all active:scale-95 shadow-2xs shrink-0"
          >
            <Plus size={14} />
            <span>เพิ่มหมวดคะแนน</span>
          </button>
        </div>
      </div>

      {/* 🌟 3. SECTIONS & QUESTIONS BUILDER */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers size={18} className="text-[#0F6659]" />
            <h3 className="text-base font-extrabold text-slate-800">หมวดหมู่และข้อคำถามการตรวจ</h3>
          </div>
          <button
            type="button"
            onClick={addSection}
            className="px-3.5 py-2 rounded-2xl bg-emerald-50 hover:bg-emerald-100 text-[#0F6659] font-extrabold text-xs sm:text-sm border border-emerald-200 flex items-center gap-1.5 cursor-pointer shadow-2xs transition-all active:scale-95"
          >
            <Plus size={16} />
            <span>เพิ่มหมวดหมู่</span>
          </button>
        </div>

        {sections.map((sec, secIdx) => (
          <div
            key={secIdx}
            ref={(el) => { sectionRefs.current[secIdx] = el; }}
            className="rounded-3xl p-4 sm:p-6 bg-white border border-slate-200 shadow-2xs space-y-4 transition-all"
          >
            {/* Section Header Bar */}
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                <span className="w-7 h-7 rounded-xl bg-emerald-100 text-[#0F6659] flex items-center justify-center text-xs font-black shrink-0">
                  {secIdx + 1}
                </span>

                {editingSecIdx === secIdx ? (
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <input
                      type="text"
                      value={sec.title}
                      onChange={(e) => updateSectionTitle(secIdx, e.target.value)}
                      onBlur={() => setEditingSecIdx(null)}
                      onKeyDown={(e) => { if (e.key === "Enter") setEditingSecIdx(null); }}
                      className="text-sm sm:text-base font-bold px-3 py-1.5 rounded-xl border border-[#0F6659] bg-white text-slate-800 focus:outline-none flex-1 shadow-2xs"
                      autoFocus
                    />
                  </div>
                ) : (
                  <div className="flex items-center gap-2 min-w-0 group cursor-pointer flex-1" onClick={() => setEditingSecIdx(secIdx)}>
                    <h4 className="text-sm sm:text-base font-bold text-slate-800 truncate">{sec.title}</h4>
                    <Edit3 size={14} className="text-slate-300 group-hover:text-[#0F6659] shrink-0 transition-colors" />
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {/* Reorder Section Buttons */}
                <button
                  type="button"
                  disabled={secIdx === 0}
                  onClick={() => moveSection(secIdx, 'up')}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                  title="เลื่อนหมวดหมู่ขึ้น"
                >
                  <ChevronUp size={16} />
                </button>
                <button
                  type="button"
                  disabled={secIdx === sections.length - 1}
                  onClick={() => moveSection(secIdx, 'down')}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                  title="เลื่อนหมวดหมู่ลง"
                >
                  <ChevronDown size={16} />
                </button>

                <span className="text-xs font-bold px-2.5 py-1 rounded-xl bg-slate-100 text-slate-600">
                  {sec.items.length} ข้อ
                </span>

                <button
                  type="button"
                  onClick={() => handleRequestRemoveSection(secIdx)}
                  className="p-2 rounded-xl text-red-500 hover:bg-red-50 cursor-pointer transition-colors"
                  title="ลบหมวดหมู่นี้"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            {/* Questions List */}
            <div className="space-y-3">
              {sec.items.map((item, itemIdx) => {
                const isDragging = dragUI && dragUI.secIdx === secIdx && dragUI.id === item.id;
                const displacePx = (dragUI && dragUI.secIdx === secIdx && dragUI.displace[item.id]) || 0;

                return (
                  <div
                    key={item.id}
                    ref={(el) => { itemRefs.current[`${secIdx}-${item.id}`] = el; }}
                    style={{
                      transform: isDragging
                        ? `translateY(${dragUI.deltaY}px) scale(1.01)`
                        : displacePx
                        ? `translateY(${displacePx}px)`
                        : undefined,
                      zIndex: isDragging ? 40 : 1,
                      boxShadow: isDragging ? "0 16px 32px rgba(0,0,0,0.12)" : undefined,
                      borderColor: item.critical ? "#FCA5A5" : undefined,
                      background: item.critical ? "#FFFDFD" : "#FAFAF8",
                      transition: isDragging ? "box-shadow 0.15s" : "transform 0.18s cubic-bezier(0.2,0,0,1)"
                    }}
                    className="p-3.5 sm:p-4 rounded-2xl border border-slate-200 space-y-3 relative transition-colors"
                  >
                    {/* 1. Item Header Bar: Drag Handle + Question Number (Left) | Score + Critical + Delete (Right) */}
                    <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-200/60">
                      {/* Left: Drag Handle & Question Number Badge */}
                      <div className="flex items-center gap-2 min-w-0">
                        <button
                          type="button"
                          onPointerDown={(e) => handlePointerDown(e, secIdx, item.id)}
                          className="p-1 text-slate-400 hover:text-slate-700 cursor-grab active:cursor-grabbing rounded-lg hover:bg-slate-200/60 shrink-0 touch-none"
                          title="คลิกลากเพื่อสลับลำดับข้อ"
                        >
                          <GripVertical size={16} />
                        </button>
                        <span className="text-xs font-black text-slate-800 font-mono px-2.5 py-0.5 bg-slate-100 border border-slate-200/80 rounded-lg shrink-0">
                          ข้อ {itemIdx + 1}
                        </span>
                      </div>

                      {/* Right: Score Input + Critical Toggle + Delete */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Score Setting Input (Compact without 'แต้ม') */}
                        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl px-2 py-1 shadow-2xs hover:border-[#0F6659] focus-within:border-[#0F6659] transition-colors shrink-0">
                          <span className="text-[11px] font-semibold text-slate-500">คะแนน:</span>
                          <input
                            type="number"
                            min="1"
                            max="500"
                            value={item.fullScore !== undefined && item.fullScore !== null ? item.fullScore : 10}
                            onChange={(e) => updateItemScore(secIdx, item.id, e.target.value)}
                            onBlur={(e) => handleItemScoreBlur(secIdx, item.id, e.target.value)}
                            className="w-8 text-xs font-bold text-center font-mono text-[#0F6659] outline-none bg-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none p-0"
                            title="กำหนดคะแนนเต็มของข้อนี้"
                          />
                        </div>

                        {/* Critical Toggle Button */}
                        <button
                          type="button"
                          onClick={() => toggleItemCritical(secIdx, item.id)}
                          className={`px-2 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shadow-2xs shrink-0 ${
                            item.critical
                              ? 'bg-rose-50 text-rose-600 border border-rose-300 ring-1 ring-rose-200'
                              : 'bg-white border border-slate-200 text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                          }`}
                          title={item.critical ? "ยกเลิกความสำคัญ" : "ตั้งเป็นข้อสำคัญ (ไม่ผ่านตกทันที)"}
                        >
                          <ShieldAlert size={14} className={item.critical ? "text-rose-600" : "text-slate-400"} />
                          {item.critical && <span className="text-[11px] font-bold text-rose-600">สำคัญ</span>}
                        </button>

                        {/* Delete Question Button */}
                        <button
                          type="button"
                          onClick={() => handleRequestRemoveItem(secIdx, item, itemIdx)}
                          className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer transition-colors shrink-0"
                          title="ลบคำถามข้อนี้"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    {/* 2. Full-Width Question Text Area */}
                    <div className="w-full">
                      {editingId === item.id ? (
                        <div className="flex items-center gap-2 w-full">
                          <textarea
                            rows={2}
                            value={item.text}
                            onChange={(e) => updateItemText(secIdx, item.id, e.target.value)}
                            onBlur={() => setEditingId(null)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                setEditingId(null);
                              }
                            }}
                            placeholder="ระบุข้อความคำถามสำหรับการตรวจประเมิน..."
                            className="w-full text-xs sm:text-sm font-medium p-3 rounded-xl border border-[#0F6659] bg-white text-slate-800 outline-none shadow-2xs resize-none leading-relaxed"
                            autoFocus
                          />
                        </div>
                      ) : (
                        <div
                          onClick={() => setEditingId(item.id)}
                          className="w-full group/text cursor-pointer hover:bg-emerald-50/50 p-2.5 -mx-1 rounded-xl transition-all flex items-start justify-between gap-3"
                          title="คลิกเพื่อแก้ไขข้อความคำถาม"
                        >
                          <p className="text-xs sm:text-sm font-medium text-slate-800 group-hover/text:text-[#0F6659] transition-colors leading-relaxed flex-1 break-words">
                            {item.text}
                          </p>
                          <Edit3 size={15} className="text-slate-300 group-hover/text:text-[#0F6659] shrink-0 mt-0.5 transition-colors" />
                        </div>
                      )}
                    </div>

                    {/* Question Footer: Type Selector (Left) & Category Selector (Right) */}
                    <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2.5 border-t border-slate-100">
                      {/* Left: Answer Type */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-500">ประเภทคำตอบ:</span>
                        <div className="flex rounded-xl p-0.5 bg-slate-100 text-xs font-semibold">
                          <button
                            type="button"
                            onClick={() => updateItemType(secIdx, item.id, "yesno")}
                            className={`px-3 py-1.5 rounded-lg cursor-pointer transition-all ${
                              item.type === "yesno" || item.type !== "scale" ? 'bg-white text-[#0F6659] shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            ผ่าน / ไม่ผ่าน
                          </button>
                          <button
                            type="button"
                            onClick={() => updateItemType(secIdx, item.id, "scale")}
                            className={`px-3 py-1.5 rounded-lg cursor-pointer transition-all ${
                              item.type === "scale" ? 'bg-white text-[#0F6659] shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            คะแนน 1-5
                          </button>
                        </div>
                      </div>

                      {/* Right: Category Selector (หมวดคะแนนของข้อนี้) */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-500">หมวดคะแนน:</span>
                        <div className="relative">
                          <select
                            value={item.category || DEFAULT_CATEGORIES[0]}
                            onChange={(e) => updateItemCategory(secIdx, item.id, e.target.value)}
                            className="text-sm sm:text-xs font-semibold pl-3 pr-7 py-2 min-h-[38px] rounded-xl border border-slate-200 bg-white text-slate-800 outline-none hover:border-[#0F6659] focus:border-[#0F6659] shadow-2xs cursor-pointer appearance-none"
                          >
                            {categories.map((cat, cIdx) => (
                              <option key={cIdx} value={cat}>{cat}</option>
                            ))}
                          </select>
                          <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Add Question Button */}
            <button
              type="button"
              onClick={() => addItemToSection(secIdx)}
              className="w-full py-3 rounded-2xl bg-slate-50 hover:bg-emerald-50/60 border border-dashed border-slate-300 hover:border-emerald-400 text-xs sm:text-sm font-extrabold text-slate-600 hover:text-[#0F6659] flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.99]"
            >
              <Plus size={16} />
              <span>เพิ่มข้อคำถามในหมวดหมู่นี้</span>
            </button>
          </div>
        ))}
          </div>
        </div>
      )}

      {/* ⚙️ TAB 2: AUDIT DETAILS METADATA CONFIG */}
      {activeEditorTab === "metadata" && (
        <div className="space-y-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                  <SlidersHorizontal size={18} className="text-[#0F6659]" />
                  <span>ข้อมูลการตรวจ</span>
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  กำหนดรายการข้อมูลที่ต้องระบุก่อนเริ่มตรวจ เช่น ผู้ตรวจ, ประเภทการตรวจ, จำนวนพนักงาน, วันที่, เวลา, กะ หรืออุณหภูมิห้อง
                </p>
              </div>

              <button
                type="button"
                onClick={openAddMetaField}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-[#0F6659] text-white rounded-2xl text-xs font-bold hover:bg-emerald-800 transition-all shadow-xs cursor-pointer active:scale-95 shrink-0"
              >
                <Plus size={15} />
                <span>เพิ่มฟิลด์ข้อมูลใหม่</span>
              </button>
            </div>

            {/* List of Fields */}
            <div className="space-y-3">
              {metadataConfig.map((field, idx) => (
                <div
                  key={field.id || idx}
                  className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    field.enabled !== false
                      ? "bg-slate-50/70 border-slate-200 hover:border-emerald-300 shadow-2xs"
                      : "bg-slate-100/50 border-slate-200 opacity-60"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex flex-col gap-0.5 shrink-0">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => moveMetaField(idx, -1)}
                        className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-20 cursor-pointer"
                        title="เลื่อนขึ้น"
                      >
                        <ChevronUp size={14} />
                      </button>
                      <button
                        type="button"
                        disabled={idx === metadataConfig.length - 1}
                        onClick={() => moveMetaField(idx, 1)}
                        className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-20 cursor-pointer"
                        title="เลื่อนลง"
                      >
                        <ChevronDown size={14} />
                      </button>
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-slate-900">{field.label}</span>
                        {field.required && (
                          <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-rose-100 text-rose-700">
                            * บังคับกรอก
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-500 flex-wrap">
                        <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 font-semibold text-slate-700">
                          ประเภท: {getFieldTypeLabel(field.type)}
                        </span>
                        {field.type === "number" && field.unit && (
                          <span className="px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold">
                            หน่วย: {field.unit}
                          </span>
                        )}
                        {field.type === "select" && Array.isArray(field.options) && field.options.length > 0 && (
                          <span className="px-2 py-0.5 rounded-md bg-blue-50 border border-blue-200 text-blue-800 font-medium truncate max-w-xs">
                            ตัวเลือก ({field.options.length}): {field.options.join(", ")}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                    <button
                      type="button"
                      onClick={() => toggleMetaFieldEnabled(field.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer border ${
                        field.enabled !== false
                          ? "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100"
                          : "bg-slate-200 text-slate-600 border-slate-300 hover:bg-slate-300"
                      }`}
                    >
                      {field.enabled !== false ? "✓ เปิดใช้งาน" : "ปิดใช้งาน"}
                    </button>

                    <button
                      type="button"
                      onClick={() => openEditMetaField(field, idx)}
                      className="p-2 text-slate-500 hover:text-[#0F6659] bg-white border border-slate-200 rounded-xl hover:border-emerald-400 cursor-pointer shadow-2xs"
                      title="แก้ไขฟิลด์นี้"
                    >
                      <Edit3 size={14} />
                    </button>

                    {!field.isSystem && (
                      <button
                        type="button"
                        onClick={() => deleteMetaField(field.id)}
                        className="p-2 text-slate-400 hover:text-rose-600 bg-white border border-slate-200 rounded-xl hover:border-rose-300 cursor-pointer shadow-2xs"
                        title="ลบฟิลด์นี้"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification (Floating Top Screen Edge Banner via Portal) */}
      {toastMessage && typeof document !== "undefined" && createPortal(
        <div className="fixed top-4 sm:top-5 left-1/2 -translate-x-1/2 z-[99999] bg-white/95 text-slate-800 text-xs sm:text-sm font-bold px-4.5 py-2.5 rounded-2xl shadow-xl backdrop-blur-md flex items-center gap-2.5 animate-in fade-in slide-in-from-top-3 duration-200 border border-slate-200 ring-1 ring-emerald-500/20 pointer-events-none">
          <CheckCircle2 size={18} className="text-[#0F6659] shrink-0" />
          <span className="text-slate-800">{toastMessage}</span>
        </div>,
        document.body
      )}

      {/* 🌟 4. BOTTOM ACTION BUTTONS */}
      <div className="pt-3 flex items-center gap-3">
        {form?.id && !readOnly &&(
          <button
            type="button"
            onClick={() => setDeleteTarget({ type: "form", title: formName, id: form.id })}
            className="px-4 py-4 rounded-2xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 border border-red-200 text-red-600 hover:bg-red-50 cursor-pointer shadow-xs active:scale-95 transition-all shrink-0"
            title="ลบแบบฟอร์มนี้ออกจากระบบ"
          >
            <Trash2 size={16} />
            <span className="hidden sm:inline">ลบแบบฟอร์มนี้</span>
          </button>
        )}
        {!readOnly && (
          <button
            type="button"
            onClick={handleSave}
            className="flex-1 py-4 rounded-2xl text-sm sm:text-base font-extrabold flex items-center justify-center gap-2 cursor-pointer shadow-md text-white active:scale-95 bg-gradient-to-tr from-[#0F6659] via-[#117a6b] to-emerald-700 hover:opacity-95 transition-all"
          >
            <Check size={18} />
            <span>บันทึกแบบฟอร์ม</span>
          </button>
        )}
      </div>

      {/* ⚙️ POPUP MODAL: ADD / EDIT METADATA FIELD */}
      {metaFieldModal && (
        <ModalWrapper onClose={() => setMetaFieldModal(false)} maxWidth="max-w-md">
          <div className="p-4 sm:p-6 space-y-3.5 sm:space-y-4 max-h-[82dvh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <h3 className="text-sm sm:text-base font-bold text-slate-800 flex items-center gap-2">
                <SlidersHorizontal size={17} className="text-[#0F6659]" />
                <span>{editingMetaIndex !== null ? "แก้ไขฟิลด์ข้อมูลการตรวจ" : "เพิ่มฟิลด์ข้อมูลการตรวจใหม่"}</span>
              </h3>
              <button onClick={() => setMetaFieldModal(false)} className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 sm:space-y-3.5">
              {/* Field Label */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                  <span>ชื่อฟิลด์ข้อมูล (Label) <span className="text-rose-500">*</span></span>
                  {metaFieldErrors.label && (
                    <span className="text-[11px] font-bold text-rose-600 animate-in fade-in flex items-center gap-1">
                      <AlertTriangle size={12} /> กรุณาระบุชื่อฟิลด์ข้อมูล
                    </span>
                  )}
                </label>
                <input
                  type="text"
                  value={metaFieldForm.label}
                  onChange={(e) => {
                    setMetaFieldForm({ ...metaFieldForm, label: e.target.value });
                    if (metaFieldErrors.label) setMetaFieldErrors(prev => ({ ...prev, label: false }));
                  }}
                  placeholder="เช่น อุณหภูมิตู้แช่หลัก, กะการทำงาน..."
                  className={`w-full text-xs sm:text-sm font-medium py-2 sm:py-2.5 px-3 sm:px-3.5 rounded-xl border outline-none shadow-2xs transition-all ${
                    metaFieldErrors.label
                      ? "border-rose-500 ring-2 ring-rose-500/20 bg-rose-50/40 animate-shake text-slate-900"
                      : "border-slate-200 focus:border-[#0F6659] bg-white text-slate-800"
                  }`}
                />
              </div>

              {/* Field Type */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ประเภทข้อมูล (Input Type) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <select
                    value={metaFieldForm.type === "textarea" ? "text" : metaFieldForm.type}
                    disabled={metaFieldForm.isSystem}
                    onChange={(e) => setMetaFieldForm({ ...metaFieldForm, type: e.target.value })}
                    className="w-full text-xs sm:text-sm pl-4 pr-10 py-3 min-h-[40px] rounded-2xl bg-slate-50 border border-slate-200 outline-none font-semibold text-slate-700 focus:border-[#0F6659] focus:bg-white transition-all shadow-xs cursor-pointer appearance-none truncate"
                  >
                    <option value="number">ตัวเลข / จำนวน (ระบุหน่วย)</option>
                    <option value="date">ปฏิทิน (วัน/เดือน/ปี)</option>
                    <option value="time">เวลา (ชั่วโมง:นาที)</option>
                    <option value="select">ตัวเลือกปุ่มกด / Dropdown</option>
                    <option value="text">ข้อความ / หมายเหตุ (Text)</option>
                    <option value="toggle">สวิตช์ ใช่/ไม่ใช่ (Toggle)</option>
                  </select>
                  <ChevronDown size={18} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>

              {/* Specific Config for NUMBER (Unit & Min/Max) */}
              {metaFieldForm.type === "number" && (
                <div className="p-2.5 sm:p-3 rounded-xl bg-emerald-50/60 border border-emerald-200 space-y-1.5">
                  <div>
                    <label className="block text-xs font-bold text-emerald-950 mb-1">
                      หน่วยของตัวเลข
                    </label>
                    <input
                      type="text"
                      value={metaFieldForm.unit}
                      onChange={(e) => setMetaFieldForm({ ...metaFieldForm, unit: e.target.value })}
                      placeholder="ระบุหน่วย เช่น คน หรือ °C"
                      className="w-full text-xs sm:text-sm font-semibold py-1.5 sm:py-2 px-3 rounded-lg border border-emerald-200 outline-none focus:border-[#0F6659] bg-white"
                    />
                  </div>
                </div>
              )}

              {/* Specific Config for SELECT (Options Manager) */}
              {metaFieldForm.type === "select" && (
                <div className="p-2.5 sm:p-3 rounded-xl bg-blue-50/60 border border-blue-200 space-y-2">
                  <label className="block text-xs font-bold text-blue-950">
                    รายการตัวเลือก (Options)
                  </label>
                  <div className="space-y-1.5">
                    {(metaFieldForm.options || []).map((opt, oIdx) => (
                      <div key={oIdx} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={opt}
                          onChange={(e) => {
                            const next = [...metaFieldForm.options];
                            next[oIdx] = e.target.value;
                            setMetaFieldForm({ ...metaFieldForm, options: next });
                          }}
                          className="flex-1 text-xs font-semibold py-1.5 px-2.5 rounded-lg border border-blue-200 bg-white outline-none focus:border-blue-500"
                        />
                        {metaFieldForm.options.length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              const next = metaFieldForm.options.filter((_, idx) => idx !== oIdx);
                              setMetaFieldForm({ ...metaFieldForm, options: next });
                            }}
                            className="text-rose-500 hover:text-rose-700 p-1 cursor-pointer"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center gap-2 pt-0.5">
                    <input
                      type="text"
                      placeholder="พิมพ์ตัวเลือกเพิ่ม..."
                      value={metaFieldForm.newOptionInput || ""}
                      onChange={(e) => setMetaFieldForm({ ...metaFieldForm, newOptionInput: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && metaFieldForm.newOptionInput?.trim()) {
                          e.preventDefault();
                          setMetaFieldForm({
                            ...metaFieldForm,
                            options: [...metaFieldForm.options, metaFieldForm.newOptionInput.trim()],
                            newOptionInput: ""
                          });
                        }
                      }}
                      className="flex-1 text-xs font-semibold py-1.5 px-2.5 rounded-lg border border-blue-200 bg-white outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (metaFieldForm.newOptionInput?.trim()) {
                          setMetaFieldForm({
                            ...metaFieldForm,
                            options: [...metaFieldForm.options, metaFieldForm.newOptionInput.trim()],
                            newOptionInput: ""
                          });
                        }
                      }}
                      className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 cursor-pointer shadow-2xs"
                    >
                      + เพิ่ม
                    </button>
                  </div>
                </div>
              )}

              {/* Required Toggle */}
              <label className="flex items-center gap-2.5 sm:gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors select-none">
                <input
                  type="checkbox"
                  checked={metaFieldForm.required}
                  onChange={(e) => setMetaFieldForm({ ...metaFieldForm, required: e.target.checked })}
                  className="w-4 h-4 sm:w-4.5 sm:h-4.5 rounded text-[#0F6659] focus:ring-[#0F6659] accent-[#0F6659] shrink-0 cursor-pointer"
                />
                <div className="flex-1 min-w-0">
                  <span className="text-xs sm:text-sm font-bold text-slate-800 block leading-tight">
                    บังคับกรอกข้อมูล (Required)
                  </span>
                  <span className="text-[10px] sm:text-[11px] text-slate-400 font-normal block mt-0.5">
                    ผู้ตรวจต้องระบุข้อมูลนี้ก่อนจึงจะเริ่มตรวจข้อคำถามได้
                  </span>
                </div>
              </label>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2.5 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setMetaFieldModal(false)}
                className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer transition-colors"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleSaveMetaField}
                className="px-4.5 py-2 rounded-xl text-xs font-bold bg-[#0F6659] text-white hover:bg-emerald-800 cursor-pointer shadow-sm active:scale-95 transition-all"
              >
                บันทึกฟิลด์
              </button>
            </div>
          </div>
        </ModalWrapper>
      )}

      {/* 🛑 5. POPUP CONFIRMATION FOR DELETION */}
      {deleteTarget && (
        <ModalWrapper onClose={() => setDeleteTarget(null)} maxWidth="max-w-md">
          <div className="p-6 space-y-4 text-center">
            {/* Warning Icon */}
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto shadow-xs ${
              deleteTarget.type === "form" && (form?.usedCount > 0 || form?.scheduledCount > 0)
                ? "bg-amber-100 text-amber-600"
                : "bg-rose-100 text-rose-600"
            }`}>
              {deleteTarget.type === "form" && (form?.usedCount > 0 || form?.scheduledCount > 0) ? (
                <AlertTriangle size={28} strokeWidth={2.2} />
              ) : (
                <Trash2 size={26} strokeWidth={2.2} />
              )}
            </div>

            {/* Content Message */}
            <div className="space-y-2">
              <h3 className="text-base sm:text-lg font-black text-slate-800">
                {deleteTarget.type === "form"
                  ? (form?.usedCount > 0 || form?.scheduledCount > 0 ? "คำเตือน: แบบฟอร์มนี้มีการใช้งานอยู่!" : "ยืนยันการลบแบบฟอร์มนี้?")
                  : deleteTarget.type === "section"
                  ? "ยืนยันการลบหมวดหมู่?"
                  : "ยืนยันการลบข้อคำถาม?"}
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-sm mx-auto">
                {deleteTarget.type === "form" ? (
                  <>
                    คุณต้องการลบแบบฟอร์ม <strong className="text-slate-800">"{deleteTarget.title}"</strong> ออกจากระบบใช่หรือไม่?
                  </>
                ) : deleteTarget.type === "section" ? (
                  <>
                    คุณต้องการลบหมวดหมู่ <strong className="text-slate-800">"{deleteTarget.title}"</strong> ใช่หรือไม่? ข้อคำถามทั้งหมด <strong className="text-rose-600 font-bold">{deleteTarget.itemCount} ข้อ</strong> ในหมวดนี้จะถูกลบออกด้วย
                  </>
                ) : (
                  <>
                    คุณต้องการลบข้อคำถาม <strong className="text-slate-800">ข้อ {deleteTarget.itemIdx}</strong> ใช่หรือไม่?
                    <span className="italic text-slate-700 block mt-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 text-xs text-left">
                      "{deleteTarget.text}"
                    </span>
                  </>
                )}
              </p>
            </div>

            {/* In-Use Alert Box inside Modal */}
            {deleteTarget.type === "form" && (form?.usedCount > 0 || form?.scheduledCount > 0) && (
              <div className="p-3.5 rounded-2xl bg-amber-50/90 border border-amber-200 text-left space-y-1.5 text-xs text-amber-900">
                <div className="font-bold flex items-center gap-1.5 text-amber-800">
                  <AlertTriangle size={14} className="shrink-0 text-amber-600" />
                  <span>ประวัติการใช้งานในระบบปัจจุบัน:</span>
                </div>
                <ul className="list-disc list-inside space-y-0.5 text-slate-700 pl-1 text-[11px]">
                  {form.usedCount > 0 && (
                    <li>มีการใช้ตรวจประเมินไปแล้ว: <strong className="text-amber-900">{form.usedCount} ครั้ง</strong></li>
                  )}
                  {form.scheduledCount > 0 && (
                    <li>มีกำหนดการนัดตรวจล่วงหน้า: <strong className="text-purple-900">{form.scheduledCount} รายการ</strong></li>
                  )}
                </ul>
                <p className="text-[11px] text-slate-500 pt-1 border-t border-amber-200/60 leading-tight">
                  * หากยืนยันลบ ระบบจะปิดการใช้งานฟอร์ม (Deactivate) เพื่อล็อกประวัติผลตรวจเดิมไว้ และจะไม่สามารถเลือกฟอร์มนี้ตรวจใหม่ได้
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="flex-1 py-3 px-4 rounded-2xl text-xs sm:text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 cursor-pointer transition-colors active:scale-95"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className={`py-3 px-4 rounded-2xl text-xs sm:text-sm font-bold text-white shadow-md cursor-pointer transition-colors active:scale-95 flex items-center justify-center gap-1.5 ${
                  deleteTarget.type === "form" && (form?.usedCount > 0 || form?.scheduledCount > 0)
                    ? "bg-amber-600 hover:bg-amber-700 shadow-amber-200"
                    : "bg-rose-600 hover:bg-rose-700 shadow-rose-200"
                }`}
              >
                <Trash2 size={16} />
                <span>ยืนยันการลบ</span>
              </button>
            </div>
          </div>
        </ModalWrapper>
      )}

      {/* ⚠️ 6. POPUP WARNING / RESTRICTION MODAL */}
      {warningModal.isOpen && (
        <ModalWrapper onClose={() => setWarningModal({ isOpen: false, title: '', message: '' })} maxWidth="max-w-sm">
          <div className="p-6 space-y-4 text-center">
            <div className="w-13 h-13 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto shadow-xs">
              <AlertTriangle size={26} strokeWidth={2.3} />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-base font-extrabold text-slate-800">
                {warningModal.title}
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-xs mx-auto">
                {warningModal.message}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setWarningModal({ isOpen: false, title: '', message: '' })}
              className="w-full py-3 px-4 rounded-2xl text-xs sm:text-sm font-bold bg-[#0F6659] hover:bg-[#0B4E44] text-white cursor-pointer transition-colors active:scale-95 shadow-sm"
            >
              เข้าใจแล้ว
            </button>
          </div>
        </ModalWrapper>
      )}

      {/* 🌟 8. TOP FLOATING TOAST (Fresh Mint & Pure Emerald - Option 1) */}
      {toastMessage && createPortal(
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[999999] pointer-events-none flex items-center gap-3 px-5 py-3 rounded-2xl bg-emerald-50/95 backdrop-blur-md text-emerald-950 shadow-xl shadow-emerald-600/15 border border-emerald-300 ring-1 ring-emerald-400/20 text-xs sm:text-sm font-bold animate-in fade-in slide-in-from-top-4 duration-200">
          <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
            <CheckCircle2 size={16} strokeWidth={2.5} />
          </div>
          <span className="tracking-tight">{toastMessage}</span>
        </div>,
        document.body
      )}
    </div>
  );
}
