import React, { useState, useMemo, useEffect, useRef, useContext } from "react";
import { createPortal } from "react-dom";
import { FileText, Plus, Trash2, Edit3, GripVertical, Check, X, AlertTriangle, ShieldAlert, ChevronDown, ChevronUp, Layers, CheckCircle2, Tag, SlidersHorizontal, Sliders, Store, Loader2, Table, Hash, Calendar, Clock, UserCheck, CircleDot, CheckSquare, ChevronDownSquare, Settings2, Calculator } from "lucide-react";

import { c, sans, mono, cardStyle } from "../../config/theme";
import Header from "../../shared/Header";
import Section from "../../shared/Section";
import ModalWrapper from "../../shared/ModalWrapper";
import FieldTypeSelectModal from "../../modals/FieldTypeSelectModal";
import GridConfigModal, { CASH_AUDIT_PRESET } from "../../modals/GridConfigModal";
import api from "../../config/api";
import { DataContext } from "../../context/DataContext";
import { CATEGORY_DISPLAY_MAP, getCategoryDisplay } from "../../config/constants";

export const DEFAULT_CATEGORIES = [
  "Product",
  "Process",
  "Service",
  "Cleanliness",
  "Documents"
];

export const CATEGORY_CODE_MAP = {
  "Product": "PD",
  "Process": "PC",
  "Service": "S",
  "Cleanliness": "C",
  "Documents": "DM"
};

export const NORMALIZE_CATEGORY = (val) => {
  if (!val) return DEFAULT_CATEGORIES[0];
  const s = String(val).trim();
  const u = s.toUpperCase();
  if (u === "PD" || u === "QLT" || s === "Product" || s.includes("คุณภาพ")) return "Product";
  if (u === "PC" || u === "OPS" || s === "Process" || s.includes("กระบวนการ") || s.includes("โรงงาน") || s.includes("GMP")) return "Process";
  if (u === "S" || u === "SVC" || s === "Service" || s.includes("บริการ")) return "Service";
  if (u === "C" || u === "CLN" || s === "Cleanliness" || s.includes("สะอาด") || s.includes("สุขอนามัย")) return "Cleanliness";
  if (u === "DM" || u === "DOC" || s === "Documents" || s.includes("เอกสาร")) return "Documents";
  return DEFAULT_CATEGORIES[0];
};

export const DEFAULT_FORM_METADATA_CONFIG = [
  {
    id: "auditor",
    label: "ผู้ตรวจประเมิน (Auditor)",
    type: "auditor",
    required: false,
    enabled: true,
    isSystem: true
  },
  {
    id: "audit_type",
    label: "ประเภทการตรวจ (Audit Type)",
    type: "select",
    options: ["ตามกำหนดการ", "นอกกำหนดการ", "ปลอมตัว"],
    required: true,
    enabled: true,
    isSystem: true
  },
  {
    id: "staff_count",
    label: "จำนวนพนักงานขณะตรวจ",
    type: "number",
    unit: "คน",
    required: true,
    enabled: true,
    isSystem: true
  }
];

export const getNonScoredFieldInfo = (type) => {
  switch ((type || "").toLowerCase()) {
    case "yesno":
      return { label: "ผ่าน / ไม่ผ่าน (Yes / No)", icon: CheckCircle2, color: "emerald" };
    case "scale":
      return { label: "คะแนน 1-5 (Scale)", icon: Sliders, color: "teal" };
    case "grid":
      return { label: "ตารางข้อมูล (Grid)", icon: Table, color: "emerald" };
    case "number":
      return { label: "ตัวเลข (Number)", icon: Hash, color: "teal" };
    case "select":
      return { label: "รายการเลือก (Dropdown)", icon: ChevronDownSquare, color: "sky" };
    case "radio":
      return { label: "ตัวเลือกเดียว (Radio)", icon: CircleDot, color: "indigo" };
    case "checkbox":
      return { label: "หลายตัวเลือก (Checkbox)", icon: CheckSquare, color: "violet" };
    case "date":
      return { label: "วันที่ (Date)", icon: Calendar, color: "amber" };
    case "time":
      return { label: "เวลา (Time)", icon: Clock, color: "orange" };
    case "auditor":
      return { label: "ผู้ตรวจประเมิน (Auditor)", icon: UserCheck, color: "emerald" };
    default:
      return { label: "ข้อความ (Text)", icon: FileText, color: "slate" };
  }
};

export const getQuestionPlaceholder = (type) => {
  switch ((type || "").toLowerCase()) {
    case "yesno":
      return "ระบุข้อความคำถามสำหรับการตรวจประเมิน...";
    case "scale":
      return "ระบุข้อความคำถามสำหรับการให้คะแนน (1-5)...";
    case "grid":
      return "ระบุชื่อตารางหรือข้อคำถาม (เช่น ตรวจนับเงินสด)...";
    case "number":
      return "ระบุข้อความคำถามสำหรับตัวเลข (เช่น ระบุจำนวนพนักงาน)...";
    case "select":
      return "ระบุข้อความคำถามสำหรับรายการเลือก (Dropdown)...";
    case "radio":
      return "ระบุข้อความคำถามสำหรับตัวเลือกเดียว (Radio)...";
    case "checkbox":
      return "ระบุข้อความคำถามสำหรับหลายตัวเลือก (Checkbox)...";
    case "date":
      return "ระบุข้อความคำถามสำหรับวันที่...";
    case "time":
      return "ระบุข้อความคำถามสำหรับเวลา / กะงาน...";
    case "auditor":
      return "ระบุข้อความคำถามสำหรับผู้ตรวจประเมิน...";
    case "text":
      return "ระบุข้อความคำถามหรือรายละเอียด / หมายเหตุ...";
    default:
      return "ระบุข้อความคำถามสำหรับการตรวจประเมิน...";
  }
};

export default function FormEditorScreen({ form, onBack, onSave, readOnly = false }) {
  const { brands: contextBrands, currentUser } = useContext(DataContext);
  const userRole = (currentUser?.role || currentUser?.roleCode || "").toUpperCase();
  const isAuditorOrAuditee = userRole === "AUDITOR" || userRole === "AUDITEE";
  const canManage = !isAuditorOrAuditee && (userRole === "ADMIN" || userRole === "STANDARD" || (currentUser?.permissions || []).includes("forms.manage"));
  const isReadOnly = readOnly || !canManage;

  // 🌟 แปลง sections จากรูปแบบ API ให้เป็นรูปแบบ state ของ editor นี้ (ใช้ทั้งตอน init และตอนโหลดข้อมูลเต็มมาซิงค์ทีหลัง)
  const mapApiSectionsToState = (apiSections) => (apiSections || []).map(s => {
    const secType = (s.sectionType || "AUDIT").toUpperCase();
    const isInfoSec = secType === "INFO";
    return {
      id: s.id,
      title: s.title,
      sectionType: secType,
      orderIndex: s.orderIndex,
      weightPercent: s.weightPercent || 0,
      items: (s.items || []).map(i => {
        const cat = NORMALIZE_CATEGORY(i.categoryName || i.category || i.categoryCode);
        const rawType = (i.questionType || i.type || "yesno").toLowerCase();
        const canBeScored = rawType === "yesno" || rawType === "scale";
        const hasScore = i.fullScore !== undefined && i.fullScore !== null && Number(i.fullScore) > 0;
        const isScored = canBeScored && (i.isScored !== undefined ? Boolean(i.isScored) : (!isInfoSec && hasScore));
        return {
          id: i.id || ("q_" + Math.random().toString(36).substr(2, 9)),
          text: i.questionText || i.text || i.title || "",
          questionText: i.questionText || i.text || i.title || "",
          type: rawType === "scale" ? "scale" : rawType === "yesno" ? "yesno" : rawType,
          questionType: i.questionType || (rawType === "scale" ? "SCALE" : isScored ? "YESNO" : rawType.toUpperCase()),
          fullScore: isScored ? Number(i.fullScore !== undefined ? i.fullScore : (i.maxScore !== undefined ? i.maxScore : 10)) : 0,
          isScored: isScored,
          critical: isScored ? !!(i.isCritical !== undefined ? i.isCritical : i.critical) : false,
          category: isScored ? cat : (i.category || "รายละเอียด"),
          categoryName: isScored ? cat : (i.categoryName || "รายละเอียด"),
          categoryCode: isScored ? (CATEGORY_CODE_MAP[cat] || "PD") : "INFO",
          fieldConfig: i.fieldConfig || i.fieldConfigJson ? (typeof i.fieldConfigJson === "string" ? JSON.parse(i.fieldConfigJson) : i.fieldConfig) : null
        };
      })
    };
  });

  const [formName, setFormName] = useState(form ? (form.name || form.title) : "แบบฟอร์มมาตรฐานใหม่");
  const [formType, setFormType] = useState(form ? (form.type || form.locationTypeName || "สาขาหน้าร้าน") : "สาขาหน้าร้าน");
  const [locationTypeId, setLocationTypeId] = useState(form?.locationTypeId || 1);
  const [locationTypes, setLocationTypes] = useState([]);
  const [brands, setBrands] = useState(() => (Array.isArray(contextBrands) && contextBrands.length > 0 ? contextBrands : []));
  const [brandIds, setBrandIds] = useState(() => {
    if (form?.brandIds && Array.isArray(form.brandIds)) return form.brandIds.map(Number);
    if (form?.formBrands && Array.isArray(form.formBrands)) return form.formBrands.map(fb => Number(fb.brandId || fb.id));
    if (form?.brandId) return [Number(form.brandId)];
    return [];
  });
  const [isBrandDropdownOpen, setIsBrandDropdownOpen] = useState(false);
  const brandDropdownRef = useRef(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingFullForm, setIsLoadingFullForm] = useState(() => Boolean(form?.id && (!form.sections || form.sections.length === 0)));
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    if (contextBrands && contextBrands.length > 0 && brands.length === 0) {
      setBrands(contextBrands);
    }

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

    // 🌟 Load latest complete form data and metadataConfig from API if editing existing form
    if (form?.id && typeof form.id === 'number') {
      setIsLoadingFullForm(true);
      api.get(`/form/${form.id}`)
        .then(res => {
          if (isMounted && res.data) {
            const formData = res.data;
            if (formData.metadataConfigJson) {
              try {
                const parsed = JSON.parse(formData.metadataConfigJson);
                if (Array.isArray(parsed) && parsed.length > 0) {
                  setMetadataConfig(parsed);
                }
              } catch (e) {}
            } else if (Array.isArray(formData.metadataConfig) && formData.metadataConfig.length > 0) {
              setMetadataConfig(formData.metadataConfig);
            }

            // 🌟 ซิงค์ sections/items ชุดเต็มจริงกลับเข้า state เสมอ (แก้บั๊คข้อมูลหาย)
            // form ตัวตั้งต้นอาจมาจากหน้ารายการแบบ summary (ไม่มี sections) แล้วเคยเข้าเงื่อนไข
            // default stub 1 หมวด/1 ข้อ มาก่อน พอโหลดชุดเต็มสำเร็จ ต้องเขียนทับให้ตรงของจริงเสมอ
            if (Array.isArray(formData.sections) && formData.sections.length > 0) {
              const mapped = mapApiSectionsToState(formData.sections);
              setSections(mapped);

              const filterScoringCategories = (cats) => (cats || []).filter(c => c && c !== "รายละเอียด" && c !== "INFO");

              if (formData.categoryOrderJson) {
                try {
                  const parsed = JSON.parse(formData.categoryOrderJson);
                  if (Array.isArray(parsed) && parsed.length > 0) {
                    const catList = filterScoringCategories(parsed);
                    mapped.forEach(s => s.items.forEach(i => {
                      if (i.isScored === false || Number(i.fullScore) === 0) return;
                      const cName = i.categoryName || i.category;
                      if (cName && cName !== "รายละเอียด" && cName !== "INFO" && !catList.includes(cName)) catList.push(cName);
                    }));
                    setCategories(catList.length > 0 ? catList : [...DEFAULT_CATEGORIES]);
                  } else {
                    const catList = [];
                    mapped.forEach(s => s.items.forEach(i => {
                      if (i.isScored === false || Number(i.fullScore) === 0) return;
                      const cName = i.categoryName || i.category;
                      if (cName && cName !== "รายละเอียด" && cName !== "INFO" && !catList.includes(cName)) catList.push(cName);
                    }));
                    DEFAULT_CATEGORIES.forEach(c => { if (!catList.includes(c)) catList.push(c); });
                    setCategories(filterScoringCategories(catList));
                  }
                } catch (e) {
                  setCategories([...DEFAULT_CATEGORIES]);
                }
              } else {
                const catList = [];
                mapped.forEach(s => s.items.forEach(i => {
                  if (i.isScored === false || Number(i.fullScore) === 0) return;
                  const cName = i.categoryName || i.category;
                  if (cName && cName !== "รายละเอียด" && cName !== "INFO" && !catList.includes(cName)) catList.push(cName);
                }));
                DEFAULT_CATEGORIES.forEach(c => { if (!catList.includes(c)) catList.push(c); });
                setCategories(filterScoringCategories(catList));
              }
            }

            if (formData.title && !formName) setFormName(formData.title);
            if (formData.locationTypeId) setLocationTypeId(formData.locationTypeId);
            if (formData.passingScore !== undefined && formData.passingScore !== null) setPassingScore(formData.passingScore);
            if (Array.isArray(formData.brandIds) && formData.brandIds.length > 0) setBrandIds(formData.brandIds.map(Number));
            setLoadError(null);
          }
        })
        .catch(err => {
          console.error("Failed to load form details:", err);
          if (isMounted) {
            setLoadError("ไม่สามารถโหลดรายละเอียดแบบฟอร์มได้ กรุณาลองใหม่อีกครั้ง");
            showToast("⚠️ ไม่สามารถโหลดรายละเอียดแบบฟอร์มได้");
          }
        })
        .finally(() => {
          if (isMounted) {
            setIsLoadingFullForm(false);
          }
        });
    }

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
  }, [form?.id]);

  // 🌟 Sync brands from context lazily without re-fetching or resetting form
  useEffect(() => {
    if (contextBrands && contextBrands.length > 0 && brands.length === 0) {
      setBrands(contextBrands);
    }
  }, [contextBrands]);
  const [activeEditorTab, setActiveEditorTab] = useState("checklist"); // 'checklist' | 'metadata'
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
    form?.description || "แบบฟอร์มตรวจสอบมาตรฐานคุณภาพ การบริการ และความปลอดภัย"
  );
  const [passingScore, setPassingScore] = useState(() => {
    if (form && form.passingScore !== undefined && form.passingScore !== null) {
      return Number(form.passingScore);
    }
    return 85;
  });

  const [categories, setCategories] = useState(() => {
    const filterScoringCats = (cats) => (cats || []).filter(c => c && c !== "รายละเอียด" && c !== "INFO");
    if (form?.categoryOrderJson) {
      try {
        const parsed = JSON.parse(form.categoryOrderJson);
        const filtered = filterScoringCats(parsed);
        if (filtered.length > 0) return filtered;
      } catch (e) {}
    }
    if (Array.isArray(form?.categories) && form.categories.length > 0) {
      const filtered = filterScoringCats(form.categories);
      if (filtered.length > 0) return filtered;
    }
    const fromItems = [];
    if (form?.sections) {
      form.sections.forEach(s => {
        (s.items || []).forEach(i => {
          if (i.isScored === false || Number(i.fullScore) === 0) return;
          const cName = i.categoryName || i.category;
          if (cName && cName !== "รายละเอียด" && cName !== "INFO" && !fromItems.includes(cName)) fromItems.push(cName);
        });
      });
    }
    DEFAULT_CATEGORIES.forEach(c => {
      if (!fromItems.includes(c)) fromItems.push(c);
    });
    return filterScoringCats(fromItems);
  });
  const [newCategoryInput, setNewCategoryInput] = useState("");

  const [sections, setSections] = useState(() => {
    if (form?.sections && form.sections.length > 0) {
      return mapApiSectionsToState(form.sections);
    }
    // 🌟 If editing existing form whose full data is still loading, do NOT prefill with fake stub
    if (form?.id) {
      return [];
    }
    return [
      {
        id: "sec_default",
        sectionType: "AUDIT",
        title: "หมวดที่ 1",
        weightPercent: 0,
        items: [
          {
            id: "q1",
            text: "",
            questionText: "",
            type: "yesno",
            questionType: "YESNO",
            fullScore: 10,
            isScored: true,
            critical: false,
            category: DEFAULT_CATEGORIES[0],
            categoryName: DEFAULT_CATEGORIES[0],
            categoryCode: CATEGORY_CODE_MAP[DEFAULT_CATEGORIES[0]] || "PD"
          }
        ]
      }
    ];
  });

  const [editingId, setEditingId] = useState(null);
  const [editingSecIdx, setEditingSecIdx] = useState(null);
  const [movementMap, setMovementMap] = useState({}); // { [secId]: 'up' | 'down' }
  const [metaMovementMap, setMetaMovementMap] = useState({}); // { [fieldId]: 'up' | 'down' }
  const moveAnimTimerRef = useRef(null);
  const metaMoveAnimTimerRef = useRef(null);
  const [toastMessage, setToastMessage] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null); // { type: 'form' | 'section' | 'item' | 'metaField' | 'scoringCategory', secIdx?, itemId?, fieldId?, catName?, count?, label?, title?, text?, itemIdx?, idx? }
  const [warningModal, setWarningModal] = useState({ isOpen: false, title: '', message: '' });
  const toastTimerRef = useRef(null);

  const [fieldTypeModalTarget, setFieldTypeModalTarget] = useState(null); // { secIdx, itemId? }
  const [gridModalTarget, setGridModalTarget] = useState(null); // { secIdx, itemId, initialConfig, initialTitle }

  // Drag-to-reorder state and refs
  const itemRefs = useRef({});
  const sectionRefs = useRef({});
  const dragRef = useRef(null);
  const [dragUI, setDragUI] = useState(null);

  const metaRefs = useRef({});
  const metaDragRef = useRef(null);
  const [metaDragUI, setMetaDragUI] = useState(null);

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

  const showToast = (msg, isError = false) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    const text = typeof msg === "object" && msg?.text ? msg.text : msg;
    const detectedError = Boolean(
      isError ||
      msg?.isError ||
      (typeof text === "string" && (
        text.startsWith("⚠️") ||
        text.includes("ไม่สามารถ") ||
        text.includes("ข้อผิดพลาด") ||
        text.includes("กรุณา") ||
        text.includes("ต้องมี")
      ))
    );
    setToastMessage({
      text: typeof text === "string" ? text.replace(/^⚠️\s*/, "") : text,
      isError: detectedError
    });
    toastTimerRef.current = setTimeout(() => setToastMessage(null), 3000);
  };

  // Add a new section and auto-scroll to it
  const addSection = () => {
    const newSecNumber = sections.length + 1;
    const newSecIdx = sections.length;
    const defaultCat = categories[0] || DEFAULT_CATEGORIES[0];
    const newQId = "q_" + Date.now();
    const newSection = {
      id: "sec_" + Date.now(),
      title: `หมวดที่ ${newSecNumber}`,
      weightPercent: 0,
      items: [
        {
          id: newQId,
          text: "",
          questionText: "",
          type: "yesno",
          questionType: "YESNO",
          fullScore: 10,
          isScored: true,
          critical: false,
          category: defaultCat,
          categoryName: defaultCat,
          categoryCode: CATEGORY_CODE_MAP[defaultCat] || "PD"
        }
      ]
    };
    setSections([...sections, newSection]);

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

  // Add question / item to section (Opens unified type selector modal)
  const handleAddItemClick = (secIdx) => {
    setFieldTypeModalTarget({ secIdx });
  };

  const addItemToSection = (secIdx, fieldType = "yesno") => {
    const sec = sections[secIdx];
    const type = fieldType || "yesno";
    const isScored = type === "yesno" || type === "scale";
    const newId = "q_" + Date.now();
    const secTitle = sec?.title || "";
    const defaultCat = categories.find(c => secTitle.includes(c)) || categories[0] || DEFAULT_CATEGORIES[0];
    
    let fieldConfig = null;

    if (type === "grid") {
      fieldConfig = JSON.parse(JSON.stringify(CASH_AUDIT_PRESET));
    } else if (type === "number") {
      fieldConfig = { unit: "", placeholder: "0" };
    } else if (type === "select" || type === "radio" || type === "checkbox") {
      fieldConfig = { options: ["ตัวเลือกที่ 1", "ตัวเลือกที่ 2"] };
    }

    const placeholder = getQuestionPlaceholder(type);

    setSections(prev => prev.map((secItem, sIdx) => {
      if (sIdx !== secIdx) return secItem;
      return {
        ...secItem,
        items: [
          ...(secItem.items || []),
          {
            id: newId,
            text: "",
            questionText: "",
            placeholder: placeholder,
            type: type,
            questionType: type.toUpperCase(),
            fullScore: isScored ? 10 : 0,
            isScored: isScored,
            critical: false,
            category: isScored ? defaultCat : "รายละเอียด",
            categoryName: isScored ? defaultCat : "รายละเอียด",
            categoryCode: isScored ? (CATEGORY_CODE_MAP[defaultCat] || "PD") : "INFO",
            fieldConfig
          }
        ]
      };
    }));

    if (type === "grid") {
      setTimeout(() => {
        setGridModalTarget({
          secIdx,
          itemId: newId,
          initialConfig: fieldConfig,
          initialTitle: ""
        });
      }, 100);
    }

    // Auto-scroll smooth to newly added question
    setTimeout(() => {
      const itemEl = itemRefs.current[`${secIdx}-${newId}`];
      if (itemEl) {
        itemEl.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 80);
  };

  const handleSelectFieldType = (chosenType) => {
    if (!fieldTypeModalTarget) return;
    const { secIdx, itemId, isMeta, metaId } = fieldTypeModalTarget;

    // A) If handling metadata field
    if (isMeta) {
      if (metaId) {
        setMetadataConfig(prev => prev.map(m => {
          if (m.id !== metaId) return m;
          let fieldConfig = m.fieldConfig || {};
          let options = m.options || [];
          let unit = m.unit || "";
          if (chosenType === "grid" && (!fieldConfig.columns || fieldConfig.columns.length === 0)) {
            fieldConfig = JSON.parse(JSON.stringify(CASH_AUDIT_PRESET));
          } else if ((chosenType === "select" || chosenType === "radio" || chosenType === "checkbox") && options.length === 0) {
            options = ["ตัวเลือกที่ 1", "ตัวเลือกที่ 2"];
          } else if (chosenType === "number" && !unit) {
            unit = "คน";
          }
          return {
            ...m,
            type: chosenType,
            unit,
            options,
            fieldConfig
          };
        }));

        if (chosenType === "grid") {
          const currentMeta = metadataConfig.find(m => m.id === metaId);
          setTimeout(() => {
            setGridModalTarget({
              isMeta: true,
              metaId,
              initialConfig: currentMeta?.fieldConfig || CASH_AUDIT_PRESET,
              initialTitle: currentMeta?.label || "ตารางข้อมูล"
            });
          }, 100);
        }

        setFieldTypeModalTarget(null);
        return;
      }

      const newMetaId = "meta_" + Date.now().toString(36);
      let defaultLabel = "";
      let fieldConfig = null;
      let unit = "";
      let options = [];

      if (chosenType === "grid") {
        defaultLabel = "ตารางตรวจนับเงินสด";
        fieldConfig = JSON.parse(JSON.stringify(CASH_AUDIT_PRESET));
      } else if (chosenType === "number") {
        defaultLabel = "จำนวน...";
        unit = "คน";
      } else if (chosenType === "select") {
        defaultLabel = "เลือกรายการ (Dropdown)...";
        options = ["ตัวเลือกที่ 1", "ตัวเลือกที่ 2"];
      } else if (chosenType === "radio") {
        defaultLabel = "เลือกหนึ่งตัวเลือก (Radio)...";
        options = ["ตัวเลือกที่ 1", "ตัวเลือกที่ 2"];
      } else if (chosenType === "checkbox") {
        defaultLabel = "เลือกหลายรายการ (Checkbox)...";
        options = ["ตัวเลือกที่ 1", "ตัวเลือกที่ 2"];
      } else if (chosenType === "date") {
        defaultLabel = "วันที่ตรวจ...";
      } else if (chosenType === "time") {
        defaultLabel = "เวลาตรวจ...";
      } else if (chosenType === "auditor") {
        defaultLabel = "ผู้ตรวจประเมิน";
      } else {
        defaultLabel = "รายละเอียด...";
      }

      const newMeta = {
        id: newMetaId,
        label: "",
        placeholder: defaultLabel,
        type: chosenType,
        unit,
        options,
        fieldConfig,
        required: false,
        enabled: true,
        isSystem: false
      };

      setMetadataConfig(prev => [...prev, newMeta]);
      setFieldTypeModalTarget(null);

      if (chosenType === "grid") {
        setTimeout(() => {
          setGridModalTarget({
            isMeta: true,
            metaId: newMetaId,
            initialConfig: fieldConfig,
            initialTitle: defaultLabel
          });
        }, 100);
      }
      return;
    }

    // B) If handling section item
    if (itemId) {
      // Switching type on existing item
      const isNowScored = chosenType === "yesno" || chosenType === "scale";
      setSections(prev => prev.map((sec, sIdx) => {
        if (sIdx !== secIdx) return sec;
        return {
          ...sec,
          items: (sec.items || []).map(it => {
            if (it.id !== itemId) return it;
            let fieldConfig = it.fieldConfig || {};
            if (chosenType === "grid" && (!fieldConfig.columns || fieldConfig.columns.length === 0)) {
              fieldConfig = JSON.parse(JSON.stringify(CASH_AUDIT_PRESET));
            } else if ((chosenType === "select" || chosenType === "radio" || chosenType === "checkbox") && !fieldConfig.options) {
              fieldConfig = { options: ["ตัวเลือกที่ 1", "ตัวเลือกที่ 2"] };
            } else if (chosenType === "number" && !fieldConfig.unit) {
              fieldConfig = { unit: "", placeholder: "0" };
            }
            return {
              ...it,
              type: chosenType,
              questionType: chosenType.toUpperCase(),
              isScored: isNowScored,
              fullScore: isNowScored ? (it.fullScore && Number(it.fullScore) > 0 ? it.fullScore : 10) : 0,
              critical: isNowScored ? it.critical : false,
              fieldConfig
            };
          })
        };
      }));

      if (chosenType === "grid") {
        const currentItem = (sections[secIdx]?.items || []).find(it => it.id === itemId);
        setTimeout(() => {
          setGridModalTarget({
            secIdx,
            itemId,
            initialConfig: currentItem?.fieldConfig || CASH_AUDIT_PRESET,
            initialTitle: currentItem?.text || "ตารางข้อมูล"
          });
        }, 100);
      }

      setFieldTypeModalTarget(null);
      return;
    }

    addItemToSection(secIdx, chosenType);
    setFieldTypeModalTarget(null);
  };

  const handleSaveGridConfig = ({ title, fieldConfig }) => {
    if (!gridModalTarget) return;
    if (gridModalTarget.isMeta) {
      setMetadataConfig(prev => prev.map(m => {
        if (m.id !== gridModalTarget.metaId) return m;
        return {
          ...m,
          label: title,
          fieldConfig
        };
      }));
      setGridModalTarget(null);
      return;
    }

    const { secIdx, itemId } = gridModalTarget;
    setSections(prev => prev.map((sec, sIdx) => {
      if (sIdx !== secIdx) return sec;
      return {
        ...sec,
        items: (sec.items || []).map(it => {
          if (it.id !== itemId) return it;
          return {
            ...it,
            text: title,
            questionText: title,
            fieldConfig
          };
        })
      };
    }));
    setGridModalTarget(null);
  };

  const updateMetaFieldInline = (metaId, patch) => {
    setMetadataConfig(prev => prev.map(m => m.id === metaId ? { ...m, ...patch } : m));
  };

  const updateItemFieldConfig = (secIdx, itemId, patch) => {
    setSections(prev => prev.map((sec, sIdx) => {
      if (sIdx !== secIdx) return sec;
      return {
        ...sec,
        items: (sec.items || []).map(it => {
          if (it.id !== itemId) return it;
          return {
            ...it,
            fieldConfig: {
              ...(it.fieldConfig || {}),
              ...patch
            }
          };
        })
      };
    }));
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

    if (deleteTarget.type === "metaField") {
      setMetadataConfig(prev => prev.filter(f => f.id !== deleteTarget.fieldId));
      showToast("ลบฟิลด์ข้อมูลเรียบร้อยแล้ว");
      setDeleteTarget(null);
      return;
    }



    if (deleteTarget.type === "scoringCategory") {
      const catName = deleteTarget.catName;
      setCategories(prev => prev.filter(c => c !== catName));
      const fallbackCat = categories.find(c => c !== catName) || DEFAULT_CATEGORIES[0];
      setSections(prev => prev.map(s => ({
        ...s,
        items: (s.items || []).map(item => (item.category === catName || item.categoryName === catName) ? { ...item, category: fallbackCat, categoryName: fallbackCat, categoryCode: CATEGORY_CODE_MAP[fallbackCat] || "PD" } : item)
      })));
      showToast(`ลบหมวดคะแนน "${catName}" เรียบร้อยแล้ว`);
      setDeleteTarget(null);
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
              categoryCode: CATEGORY_CODE_MAP[newCat] || "PD"
            };
          }
          return i;
        })
      };
    }));
  };

  const categoryCounts = useMemo(() => {
    const counts = {};
    categories.forEach(c => { counts[c] = 0; });
    sections.forEach(s => {
      (s.items || []).forEach(i => {
        if (i.isScored === false || Number(i.fullScore) === 0) return;
        const cat = i.category || i.categoryName || DEFAULT_CATEGORIES[0];
        counts[cat] = (counts[cat] || 0) + 1;
      });
    });
    return counts;
  }, [categories, sections]);

  // Move category Up/Down (ลำดับ 1, 2, 3...)
  const moveCategory = (idx, direction) => {
    const targetIdx = direction === "up" ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= categories.length) return;
    setCategories(prev => {
      const next = [...prev];
      const temp = next[idx];
      next[idx] = next[targetIdx];
      next[targetIdx] = temp;
      return next;
    });
  };

  const categoryRefs = useRef({});
  const categoryDragRef = useRef(null);
  const [categoryDragUI, setCategoryDragUI] = useState(null);

  const handleCategoryPointerDown = (e, cat) => {
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();
    const startIdx = categories.indexOf(cat);
    if (startIdx === -1) return;

    const tops = [];
    const heights = [];
    categories.forEach(c => {
      const el = categoryRefs.current[c];
      if (el) {
        const rect = el.getBoundingClientRect();
        tops.push(rect.top + window.scrollY);
        heights.push(rect.height);
      } else {
        tops.push(0);
        heights.push(48);
      }
    });

    const step = tops.length > 1 && tops[1] > tops[0] 
      ? (tops[1] - tops[0]) 
      : ((heights[startIdx] || 48) + 8);

    const startPointerY = e.clientY;
    categoryDragRef.current = {
      cat,
      startIdx,
      currentIdx: startIdx,
      categoriesList: [...categories],
      tops,
      heights,
      step,
      startPointerY
    };

    setCategoryDragUI({ cat, deltaY: 0, displace: {} });

    const handlePointerMove = (moveEvent) => {
      if (!categoryDragRef.current) return;
      const d = categoryDragRef.current;
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
      d.categoriesList.forEach((c, i) => {
        if (c === d.cat) return;
        if (d.startIdx < newIdx && i > d.startIdx && i <= newIdx) {
          displace[c] = -d.step;
        } else if (d.startIdx > newIdx && i >= newIdx && i < d.startIdx) {
          displace[c] = d.step;
        } else {
          displace[c] = 0;
        }
      });

      setCategoryDragUI({ cat: d.cat, deltaY, displace });
    };

    const handlePointerUp = () => {
      if (categoryDragRef.current) {
        const d = categoryDragRef.current;
        if (d.startIdx !== d.currentIdx) {
          setCategories(prev => {
            const next = [...prev];
            const [moved] = next.splice(d.startIdx, 1);
            next.splice(d.currentIdx, 0, moved);
            return next;
          });
        }
      }
      categoryDragRef.current = null;
      setCategoryDragUI(null);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("pointerup", handlePointerUp, { once: true });
  };

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

  // Update question score (supports numbers or '-' to disable scoring)
  const updateItemScore = (secIdx, itemId, newScore) => {
    const strVal = String(newScore ?? "").trim();
    if (strVal === "-" || strVal === "") {
      setSections(prev => prev.map((sec, sIdx) => {
        if (sIdx !== secIdx) return sec;
        return {
          ...sec,
          items: (sec.items || []).map(i => {
            if (i.id === itemId) {
              return {
                ...i,
                fullScore: strVal,
                isScored: false
              };
            }
            return i;
          })
        };
      }));
      return;
    }

    const num = Number(strVal);
    if (!isNaN(num)) {
      setSections(prev => prev.map((sec, sIdx) => {
        if (sIdx !== secIdx) return sec;
        return {
          ...sec,
          items: (sec.items || []).map(i => {
            if (i.id === itemId) {
              return {
                ...i,
                fullScore: num,
                maxScore: num,
                isScored: num > 0
              };
            }
            return i;
          })
        };
      }));
    }
  };

  // On blur, handle '-' or empty
  const handleItemScoreBlur = (secIdx, itemId, currentVal) => {
    const strVal = String(currentVal ?? "").trim();
    if (strVal === "-" || strVal === "0") {
      setSections(prev => prev.map((sec, sIdx) => {
        if (sIdx !== secIdx) return sec;
        return {
          ...sec,
          items: (sec.items || []).map(i => {
            if (i.id === itemId) {
              return {
                ...i,
                fullScore: 0,
                maxScore: 0,
                isScored: false
              };
            }
            return i;
          })
        };
      }));
    } else if (strVal === "" || isNaN(Number(strVal))) {
      updateItemScore(secIdx, itemId, 10);
    } else {
      const num = Math.max(0, Number(strVal));
      updateItemScore(secIdx, itemId, num);
    }
  };

  // Update section title
  const updateSectionTitle = (secIdx, newTitle) => {
    setSections(prev => prev.map((sec, sIdx) => sIdx === secIdx ? { ...sec, title: newTitle } : sec));
  };

  // Move section Up/Down with smooth physical slide motion
  const moveSection = (secIdx, direction) => {
    const targetIdx = direction === 'up' ? secIdx - 1 : secIdx + 1;
    if (targetIdx < 0 || targetIdx >= sections.length) return;

    const movedId = sections[secIdx].id || `sec_${secIdx}`;
    const swappedId = sections[targetIdx].id || `sec_${targetIdx}`;

    const next = [...sections];
    const temp = next[secIdx];
    next[secIdx] = next[targetIdx];
    next[targetIdx] = temp;
    setSections(next);

    // Trigger physical subtle slide animation (350ms)
    if (moveAnimTimerRef.current) clearTimeout(moveAnimTimerRef.current);
    setMovementMap({
      [movedId]: direction,
      [swappedId]: direction === 'up' ? 'down' : 'up'
    });
    moveAnimTimerRef.current = setTimeout(() => {
      setMovementMap({});
    }, 380);
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
    return sections
      .reduce((sum, s) => sum + (s.items || []).filter(i => (i.type === "yesno" || i.type === "scale") && i.isScored !== false && Number(i.fullScore) > 0).length, 0);
  }, [sections]);

  const totalInfoItems = useMemo(() => {
    return sections
      .reduce((sum, s) => sum + (s.items || []).filter(i => i.type !== "yesno" && i.type !== "scale" || i.isScored === false || Number(i.fullScore) === 0).length, 0);
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
      case "toggle": return "ใช่/ไม่ใช่";
      case "auditor": return "ผู้ตรวจประเมิน";
      default: return type || "ทั่วไป";
    }
  };

  const moveMetaField = (index, direction) => {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= metadataConfig.length) return;
    
    const movedId = metadataConfig[index].id;
    const swappedId = metadataConfig[targetIdx].id;

    const next = [...metadataConfig];
    const temp = next[index];
    next[index] = next[targetIdx];
    next[targetIdx] = temp;
    setMetadataConfig(next);

    if (metaMoveAnimTimerRef.current) clearTimeout(metaMoveAnimTimerRef.current);
    setMetaMovementMap({
      [movedId]: direction,
      [swappedId]: direction === 'up' ? 'down' : 'up'
    });
    metaMoveAnimTimerRef.current = setTimeout(() => {
      setMetaMovementMap({});
    }, 380);
  };

  // Drag handler for metadata fields (เหมือนหมวดหมู่คำถาม)
  const handleMetaPointerDown = (e, fieldId) => {
    e.preventDefault();
    if (metadataConfig.length <= 1) return;
    const fieldIds = metadataConfig.map(f => f.id);
    const startIdx = fieldIds.indexOf(fieldId);
    if (startIdx === -1) return;

    const tops = [];
    const heights = [];
    fieldIds.forEach(id => {
      const el = metaRefs.current[id];
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
    metaDragRef.current = {
      id: fieldId,
      startIdx,
      currentIdx: startIdx,
      fieldIds,
      tops,
      heights,
      startPointerY
    };

    setMetaDragUI({ id: fieldId, deltaY: 0, displace: {} });

    const handlePointerMove = (moveEvent) => {
      if (!metaDragRef.current) return;
      const d = metaDragRef.current;
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
      d.fieldIds.forEach((id, i) => {
        if (id === d.id) return;
        if (d.startIdx < newIdx && i > d.startIdx && i <= newIdx) {
          displace[id] = -d.heights[d.startIdx];
        } else if (d.startIdx > newIdx && i >= newIdx && i < d.startIdx) {
          displace[id] = d.heights[d.startIdx];
        } else {
          displace[id] = 0;
        }
      });

      setMetaDragUI({ id: d.id, deltaY, displace });
    };

    const handlePointerUp = () => {
      if (metaDragRef.current) {
        const d = metaDragRef.current;
        if (d.startIdx !== d.currentIdx) {
          const next = [...metadataConfig];
          const [movedField] = next.splice(d.startIdx, 1);
          next.splice(d.currentIdx, 0, movedField);
          setMetadataConfig(next);
        }
      }
      metaDragRef.current = null;
      setMetaDragUI(null);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  };

  const toggleMetaFieldEnabled = (id) => {
    setMetadataConfig(prev => prev.map(f => f.id === id ? { ...f, enabled: f.enabled === false ? true : false } : f));
  };

  const handleRequestRemoveMetaField = (field, idx) => {
    setDeleteTarget({
      type: "metaField",
      fieldId: field.id,
      label: field.label,
      idx: idx + 1
    });
  };

  const deleteMetaField = (id) => {
    const field = metadataConfig.find(f => f.id === id);
    const idx = metadataConfig.findIndex(f => f.id === id);
    if (field) {
      handleRequestRemoveMetaField(field, idx >= 0 ? idx : 0);
    } else {
      setMetadataConfig(prev => prev.filter(f => f.id !== id));
      showToast("ลบฟิลด์ข้อมูลเรียบร้อยแล้ว");
    }
  };

  const openAddMetaField = () => {
    setEditingMetaIndex(null);
    setMetaFieldErrors({});
    setMetaFieldForm({
      id: "meta_" + Date.now().toString(36),
      label: "",
      type: "number",
      unit: "คน",
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
    if (isReadOnly) return;
    if (isLoadingFullForm) {
      showToast("⚠️ กรุณารอระบบโหลดข้อมูลแบบฟอร์มให้เสร็จสมบูรณ์ก่อนบันทึก");
      return;
    }
    if (loadError) {
      showToast("⚠️ ไม่สามารถบันทึกได้เนื่องจากโหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
      return;
    }
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

    // 🌟 Validate sections and questions thoroughly to prevent saving blank/stub data
    for (let sIdx = 0; sIdx < sections.length; sIdx++) {
      const sec = sections[sIdx];
      const secTitle = (sec.title || "").trim();
      if (!secTitle) {
        showToast(`กรุณาระบุชื่อหมวดหมู่ที่ ${sIdx + 1}`);
        setActiveEditorTab("checklist");
        return;
      }
      if (!sec.items || sec.items.length === 0) {
        showToast(`หมวดหมู่ "${secTitle}" ต้องมีข้อคำถามอย่างน้อย 1 ข้อ`);
        setActiveEditorTab("checklist");
        return;
      }
      for (let iIdx = 0; iIdx < sec.items.length; iIdx++) {
        const item = sec.items[iIdx];
        const qText = (item.text || item.questionText || "").trim();
        if (!qText) {
          showToast(`กรุณากรอกข้อความคำถามข้อที่ ${iIdx + 1} ในหมวด "${secTitle}"`);
          setActiveEditorTab("checklist");
          setEditingId(item.id);
          return;
        }
      }
    }

    const cleanMetadataConfig = (metadataConfig || []).map(m => {
      const { min, max, ...rest } = m;
      return rest;
    });

    setIsSaving(true);
    const dto = {
      title: formName.trim(),
      locationTypeId: locationTypeId || 1,
      brandId: brandIds.length > 0 ? brandIds[0] : null,
      brandIds: brandIds.map(Number),
      passingScore: Number(passingScore) || 85,
      targetingMode: "ALL_LOCATIONS",
      version: form?.version || "v1.0",
      metadataConfigJson: JSON.stringify(cleanMetadataConfig),
      categoryOrderJson: JSON.stringify(categories),
      sections: sections.map((sec, sIdx) => {
        const hasScored = (sec.items || []).some(i => (i.type === "yesno" || i.type === "scale") && i.isScored !== false && Number(i.fullScore) > 0);
        const hasNonScored = (sec.items || []).some(i => (i.type !== "yesno" && i.type !== "scale") || i.isScored === false || Number(i.fullScore) === 0);
        const secType = (hasScored && hasNonScored) ? "MIXED" : (hasScored ? "AUDIT" : "INFO");
        return {
          id: typeof sec.id === 'number' ? sec.id : undefined,
          title: sec.title,
          sectionType: secType,
          orderIndex: sIdx + 1,
          weightPercent: 0,
          items: (sec.items || []).map((item, iIdx) => {
            const canBeScored = item.type === "yesno" || item.type === "scale";
            const isScored = canBeScored && item.isScored !== false && Number(item.fullScore) > 0;
            const cat = NORMALIZE_CATEGORY(item.category || item.categoryName);
            return {
              id: typeof item.id === 'number' ? item.id : undefined,
              questionText: item.text || item.questionText || "",
              questionType: isScored
                ? ((item.type || item.questionType) === "scale" ? "SCALE" : "YESNO")
                : (item.questionType || (item.type || "text").toUpperCase()),
              fullScore: isScored ? (Number(item.fullScore) || 10) : 0,
              isScored: isScored,
              isCritical: isScored ? !!(item.critical || item.isCritical) : false,
              categoryCode: isScored ? (CATEGORY_CODE_MAP[cat] || "PD") : "INFO",
              categoryName: isScored ? cat : (item.categoryName || "รายละเอียด"),
              orderIndex: iIdx + 1,
              fieldConfigJson: item.fieldConfig ? JSON.stringify(item.fieldConfig) : (item.fieldConfigJson || null)
            };
          })
        };
      })
    };

    let backendId = form?.id;
    try {
      let toastMsg = "บันทึกแบบฟอร์มลงฐานข้อมูลเรียบร้อยแล้ว";
      if (form?.id && typeof form.id === 'number') {
        const res = await api.put(`/form/${form.id}`, dto);
        if (res.data?.formId) backendId = res.data.formId;
        if (res.data?.message) toastMsg = res.data.message;
      } else {
        const res = await api.post('/form', dto);
        if (res.data?.id) backendId = res.data.id;
        if (res.data?.message) toastMsg = res.data.message;
      }
      showToast(toastMsg);
    } catch (err) {
      console.error("Could not save form directly to API:", err);
      const errMsg = err.response?.data?.message || "ไม่สามารถบันทึกแบบฟอร์มลงฐานข้อมูลได้ กรุณาลองใหม่อีกครั้ง";
      showToast(`⚠️ ${errMsg}`);
      setIsSaving(false);
      return;
    }

    const selectedBrandObjects = brands.filter(b => brandIds.map(Number).includes(Number(b.id)));
    const savedForm = {
      id: backendId || form?.id || "f_" + Date.now(),
      name: formName.trim(),
      title: formName.trim(),
      type: formType,
      locationTypeId: locationTypeId || 1,
      brandId: brandIds.length > 0 ? Number(brandIds[0]) : null,
      brandIds: brandIds.map(Number),
      brandName: selectedBrandObjects.length > 0 ? selectedBrandObjects[0].name : null,
      brandNames: selectedBrandObjects.map(b => b.name),
      description: description.trim(),
      passingScore: Number(passingScore) || 85,
      metadataConfig: cleanMetadataConfig,
      metadataConfigJson: JSON.stringify(cleanMetadataConfig),
      categoryOrderJson: JSON.stringify(categories),
      categories: categories,
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
    <div className="page-transition p-4 sm:p-6 space-y-6 w-full max-w-[100%] sm:max-w-[92%] mx-auto pb-28 sm:pb-32">
      {/* 1. TOP HEADER */}
      <Header
        title={isReadOnly ? `รายละเอียดแบบฟอร์ม: ${form?.name || form?.title || formName}` : (form ? `แก้ไขแบบฟอร์ม: ${form.name || form.title}` : "สร้างแบบฟอร์มมาตรฐานใหม่")}
        onBack={onBack}
      />

      {/* ⚠️ IN-USE WARNING BANNER */}
      {!isReadOnly && (form?.usedCount > 0 || form?.draftCount > 0 || form?.scheduledCount > 0) && (
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
              {form.draftCount > 0 && (
                <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-900 font-mono text-xs font-bold">
                  มีแบบร่าง {form.draftCount} รายการ
                </span>
              )}
              {form.scheduledCount > 0 && (
                <span className="px-2 py-0.5 rounded-md bg-purple-100 text-purple-900 font-mono text-xs font-bold">
                  มีนัดตรวจ {form.scheduledCount} รายการ
                </span>
              )}
            </p>
            <p className="text-slate-600 text-xs leading-relaxed">
              แบบฟอร์มนี้มีข้อมูลการตรวจหรือแบบร่างที่เชื่อมโยงอยู่ เมื่อบันทึกการแก้ไข ระบบจะสร้างเป็นเวอร์ชันใหม่อัตโนมัติ เพื่อรักษาความถูกต้องของข้อมูลเดิม
            </p>
          </div>
        </div>
      )}

      {/* 🌟 2. STREAMLINED FORM SETTINGS CARD */}
      <div className="rounded-3xl p-5 sm:p-6 bg-white border border-slate-200 shadow-2xs space-y-4">
        <div className="flex items-center justify-between gap-2 pb-1">
          <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">ข้อมูลทั่วไปและเกณฑ์ของแบบฟอร์ม</h3>
          <div className="flex items-center gap-2 shrink-0">
            <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold">
              {sections.length} หมวดหมู่
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold">
              {totalQuestions} ข้อคำถาม
            </span>
          </div>
        </div>

        <div className="space-y-4">
          {/* ชื่อแบบฟอร์ม */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5 flex items-center justify-between">
              <span>ชื่อแบบฟอร์มการตรวจ (Form Title) {!isReadOnly && <span className="text-rose-500">*</span>}</span>
              {formErrors.name && (
                <span className="text-xs font-bold text-rose-600 animate-in fade-in flex items-center gap-1">
                  <AlertTriangle size={13} /> กรุณาระบุชื่อแบบฟอร์ม
                </span>
              )}
            </label>
            <input
              value={formName}
              disabled={isReadOnly}
              onChange={(e) => {
                setFormName(e.target.value);
                if (formErrors.name) setFormErrors(prev => ({ ...prev, name: false }));
              }}
              placeholder="แบบฟอร์มมาตรฐานใหม่"
              className={`w-full text-sm sm:text-base font-normal px-4 py-3 min-h-[50px] rounded-2xl border outline-none transition-all shadow-xs placeholder:text-slate-400 ${
                isReadOnly
                  ? "bg-slate-50/80 text-slate-700 border-slate-200 cursor-default"
                  : formErrors.name
                  ? "border-rose-500 ring-2 ring-rose-500/20 bg-rose-50/40 text-slate-700 animate-shake"
                  : "bg-white border-slate-200 text-slate-800 focus:border-[#0F6659]"
              }`}
              required
            />
          </div>

          {/* 2. เกณฑ์ผ่าน (%) ช่องเล็กลง + ประเภทฟอร์ม (Category) ขยายเต็มพื้นที่ */}
          <div className="flex items-start gap-2.5 sm:gap-4">
            {/* เกณฑ์คะแนนผ่าน (%) - ช่องเล็กลงกะทัดรัด */}
            <div className="w-28 sm:w-36 md:w-40 shrink-0">
              <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5 truncate">
                เกณฑ์ผ่าน (%) {!isReadOnly && <span className="text-rose-500">*</span>}
              </label>
              <div className={`flex items-center justify-between px-2.5 sm:px-3.5 py-3 min-h-[50px] rounded-2xl border transition-all shadow-xs gap-1 ${
                isReadOnly ? "bg-slate-50/80 border-slate-200" : "bg-white border-slate-200 focus-within:border-[#0F6659]"
              }`}>
                <input
                  type="number"
                  min="1"
                  max="100"
                  disabled={isReadOnly}
                  value={passingScore ?? 85}
                  onChange={(e) => {
                    const val = e.target.value === '' ? '' : Math.min(100, Math.max(1, Number(e.target.value) || 0));
                    setPassingScore(val);
                  }}
                  onBlur={() => {
                    if (!passingScore || passingScore < 1) setPassingScore(85);
                  }}
                  className={`w-8 sm:w-11 text-sm sm:text-base font-bold outline-none font-mono text-left p-0 bg-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                    isReadOnly ? "text-slate-700 cursor-default" : "text-slate-800 focus:text-emerald-950 cursor-text"
                  }`}
                  placeholder="85"
                  required
                />
                <span className="text-[11px] sm:text-xs font-normal text-slate-400 select-none whitespace-nowrap">
                  % ขึ้นไป
                </span>
              </div>
            </div>

            {/* ประเภทฟอร์ม (Category) */}
            <div className="flex-1 min-w-0">
              <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5 truncate">
                ประเภทฟอร์ม (Category)
              </label>
              <div className={`relative flex items-center border rounded-2xl transition-all shadow-xs min-h-[50px] px-3.5 sm:px-4 ${
                isReadOnly ? "bg-slate-50/80 border-slate-200" : "bg-white border-slate-200 hover:border-slate-300 focus-within:border-[#0F6659] focus-within:ring-2 focus-within:ring-[#0F6659]/10"
              }`}>
                <select
                  disabled={isReadOnly}
                  value={locationTypeId || ""}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setLocationTypeId(val);
                    const selectedObj = locationTypes.find(lt => lt.id === val);
                    if (selectedObj) setFormType(selectedObj.name || selectedObj.code);
                  }}
                  className={`w-full bg-transparent text-xs sm:text-sm font-normal text-slate-800 outline-none appearance-none truncate pr-6 sm:pr-8 py-3 ${
                    isReadOnly ? "cursor-default" : "cursor-pointer"
                  }`}
                >
                  {locationTypes.length > 0 ? (
                    locationTypes.map(lt => (
                      <option key={lt.id} value={lt.id}>{lt.name || lt.code}</option>
                    ))
                  ) : (
                    <>
                      <option value={1}>สาขาหน้าร้าน (Store Front)</option>
                      <option value={2}>ครัวกลาง (Cloud Kitchen)</option>
                      <option value={3}>ขับรถรับ (Drive-Thru)</option>
                      <option value={4}>จัดส่งและเดลิเวอรี (Delivery)</option>
                      <option value={5}>ตรวจความปลอดภัยอาหาร (Food Safety)</option>
                    </>
                  )}
                </select>
                {!isReadOnly && (
                  <ChevronDown size={18} className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 text-[#0F6659] pointer-events-none shrink-0" />
                )}
              </div>
            </div>
          </div>

          {/* แบรนด์ (Brand) */}
          <div ref={brandDropdownRef} className="min-w-0 relative">
            <label className="block text-sm font-medium text-slate-700 mb-1.5 truncate flex items-center justify-between">
              <span>แบรนด์ (Brand)</span>
            </label>
            <div 
              onClick={!isReadOnly ? () => setIsBrandDropdownOpen(prev => !prev) : undefined}
              className={`w-full min-h-[50px] px-4 py-2.5 rounded-2xl border transition-all shadow-xs flex items-center justify-between gap-2 ${
                isReadOnly
                  ? "bg-slate-50/80 border-slate-200 cursor-default"
                  : isBrandDropdownOpen
                  ? "bg-white border-[#0F6659] ring-2 ring-[#0F6659]/10 cursor-pointer"
                  : "bg-white border-slate-200 hover:border-slate-300 cursor-pointer"
              }`}
            >
              <div className="flex items-center gap-1.5 flex-wrap min-w-0 flex-1 py-0.5">
                {brandIds.length === 0 ? (
                  <span className="text-sm font-normal text-slate-800 truncate">
                    ทุกแบรนด์ (All Brands / Global)
                  </span>
                ) : (
                  brandIds.map(bid => {
                    const bObj = brands.find(b => Number(b.id) === Number(bid));
                    return (
                      <span 
                        key={bid}
                        className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-lg bg-emerald-50 text-[#0F6659] border border-emerald-200/80 shrink-0 select-none animate-in fade-in zoom-in-95 duration-100"
                        onClick={!isReadOnly ? (e) => {
                          e.stopPropagation();
                          setBrandIds(prev => prev.filter(id => Number(id) !== Number(bid)));
                        } : undefined}
                        title={!isReadOnly ? "คลิกเพื่อลบแบรนด์นี้ออก" : undefined}
                      >
                        <span>{bObj?.name || `Brand #${bid}`}</span>
                        {!isReadOnly && <X size={12} className="text-emerald-700 hover:text-rose-600 cursor-pointer ml-0.5" />}
                      </span>
                    );
                  })
                )}
              </div>
              {!isReadOnly && (
                <ChevronDown size={18} className={`text-[#0F6659] shrink-0 transition-transform duration-200 ${isBrandDropdownOpen ? 'rotate-180' : ''}`} />
              )}
            </div>

            {/* Multi-Brand Popover Menu */}
            {isBrandDropdownOpen && !isReadOnly && (
              <div 
                className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 p-2 space-y-1 animate-in fade-in zoom-in-95 duration-150 max-h-56 overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
              >
                {/* All Brands Option */}
                <div 
                  role="button"
                  onClick={() => setBrandIds([])}
                  className={`flex items-center gap-2.5 p-2 rounded-xl cursor-pointer transition-colors text-xs sm:text-sm font-bold select-none ${
                    brandIds.length === 0 ? 'bg-emerald-50 text-[#0F6659]' : 'text-slate-800 hover:bg-slate-50'
                  }`}
                >
                  <input 
                    type="checkbox"
                    checked={brandIds.length === 0}
                    readOnly
                    className="w-4 h-4 rounded text-[#0F6659] focus:ring-[#0F6659] accent-[#0F6659] cursor-pointer pointer-events-none"
                  />
                  <span className="flex-1">ทุกแบรนด์ (All Brands / Global)</span>
                </div>
                
                <div className="border-t border-slate-100 my-1" />

                {/* Individual Brands (Active Only) */}
                {brands.filter(b => b.isActive !== false).length === 0 ? (
                  <div className="p-3 text-xs text-slate-400 text-center">
                    ไม่มีรายการแบรนด์ในระบบ
                  </div>
                ) : (
                  brands.filter(b => b.isActive !== false).map(b => {
                    const bid = Number(b.id);
                    const isChecked = brandIds.map(Number).includes(bid);
                    return (
                      <div 
                        key={b.id}
                        role="button"
                        onClick={() => {
                          setBrandIds(prev => {
                            const cur = prev.map(Number);
                            if (cur.includes(bid)) {
                              return cur.filter(id => id !== bid);
                            } else {
                              return [...cur, bid];
                            }
                          });
                        }}
                        className={`flex items-center gap-2.5 p-2 rounded-xl cursor-pointer transition-colors text-xs sm:text-sm font-medium select-none ${
                          isChecked ? 'bg-emerald-50 text-[#0F6659] font-bold' : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <input 
                          type="checkbox"
                          checked={isChecked}
                          readOnly
                          className="w-4 h-4 rounded text-[#0F6659] focus:ring-[#0F6659] accent-[#0F6659] cursor-pointer pointer-events-none"
                        />
                        <span className="flex-1">{b.name}</span>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* คำอธิบายแบบฟอร์ม */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              คำอธิบาย / วัตถุประสงค์การตรวจ
            </label>
            <input
              type="text"
              disabled={isReadOnly}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="แบบฟอร์มตรวจสอบมาตรฐานคุณภาพ การบริการ และความปลอดภัย"
              className={`w-full text-sm sm:text-base font-normal px-4 py-3 min-h-[50px] rounded-2xl border outline-none transition-all shadow-xs placeholder:text-slate-400 ${
                isReadOnly
                  ? "bg-slate-50/80 border-slate-200 text-slate-700 cursor-default"
                  : "bg-white border-slate-200 text-slate-800 focus:border-[#0F6659]"
              }`}
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
          <span>หมวดหมู่คำถาม ({totalQuestions} ข้อ{totalInfoItems > 0 ? ` + ${totalInfoItems} รายละเอียด` : ''})</span>
        </button>
      </div>

      {/* 📋 TAB 1: CHECKLIST & QUESTIONS */}
      {activeEditorTab === "checklist" && (
        isLoadingFullForm ? (
          <div className="bg-white rounded-3xl p-12 border border-slate-200 shadow-2xs flex flex-col items-center justify-center gap-3 text-center my-4 animate-in fade-in duration-200">
            <Loader2 size={36} className="text-[#0F6659] animate-spin" />
            <p className="text-sm sm:text-base font-bold text-slate-800">กำลังโหลดรายการข้อคำถามของแบบฟอร์ม...</p>
            <p className="text-xs text-slate-500">กรุณารอสักครู่ ระบบกำลังดึงหมวดหมู่และเกณฑ์การประเมินชุดเต็มจากฐานข้อมูล</p>
          </div>
        ) : loadError ? (
          <div className="bg-rose-50 rounded-3xl p-8 border border-rose-200 text-center space-y-3 my-4 animate-in fade-in duration-200">
            <AlertTriangle size={32} className="text-rose-500 mx-auto" />
            <p className="text-sm font-bold text-rose-900">{loadError}</p>
            <button
              type="button"
              onClick={onBack}
              className="px-4 py-2 bg-[#0F6659] text-white text-xs font-bold rounded-xl hover:bg-emerald-800 transition-colors cursor-pointer"
            >
              ย้อนกลับไปหน้ารายการฟอร์ม
            </button>
          </div>
        ) : (
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

            {/* Categories Orderly List (ตามแบบร่าง: จุด 6 จุด, ชื่อหมวด, จำนวนข้อ, ข้อ, ลบ) */}
            <div className="space-y-2 pt-1">
              {categories.map((cat, idx) => {
                const count = categoryCounts[cat] || 0;
                const isDragging = categoryDragUI?.cat === cat;
                const displaceY = categoryDragUI?.displace?.[cat] || 0;
                const translateY = isDragging ? categoryDragUI.deltaY : displaceY;

                return (
                  <div
                    key={cat}
                    ref={el => { categoryRefs.current[cat] = el; }}
                    style={{
                      transform: translateY ? `translateY(${translateY}px)` : 'none',
                      zIndex: isDragging ? 50 : 1,
                      willChange: categoryDragUI ? 'transform' : 'auto',
                      transition: (isDragging || !categoryDragUI) ? 'none' : 'transform 0.18s cubic-bezier(0.2, 0, 0, 1)'
                    }}
                    className={`flex items-center justify-between gap-2 px-3 sm:px-4 py-2.5 rounded-2xl bg-white border transition-all ${
                      isDragging
                        ? 'border-[#0F6659] shadow-lg ring-2 ring-[#0F6659]/20 bg-emerald-50/40'
                        : 'border-slate-200 hover:border-emerald-300 shadow-2xs'
                    }`}
                  >
                    {/* Left: จุด 6 จุด + ปุ่มเลื่อนขึ้น-ลง + ลำดับที่ + ชื่อหมวด */}
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {!isReadOnly && (
                        <div className="flex items-center gap-1 shrink-0">
                          {/* จุด 6 จุด (Grip Handle) */}
                          <div
                            onPointerDown={(e) => handleCategoryPointerDown(e, cat)}
                            className="cursor-grab active:cursor-grabbing p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors touch-none"
                            title="ลากเพื่อจัดลำดับหมวดคะแนน"
                          >
                            <GripVertical size={16} />
                          </div>
                        </div>
                      )}

                      {/* หมายเลขลำดับ (1, 2, 3...) */}
                      <span className="w-5 h-5 rounded-md bg-slate-100 text-slate-600 font-mono text-[11px] font-extrabold flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>

                      {/* ชื่อหมวด */}
                      <span className="text-xs sm:text-sm font-bold text-slate-800 truncate">
                        {getCategoryDisplay(cat)}
                      </span>
                    </div>

                    {/* Right: จำนวนข้อ + ข้อ + ปุ่มลบ */}
                    <div className="flex items-center gap-2.5 shrink-0">
                      <div className="flex items-center gap-1">
                        <span className={`px-2 py-0.5 rounded-lg text-xs font-black font-mono border ${
                          count > 0 
                            ? 'bg-emerald-50 text-[#0F6659] border-emerald-200' 
                            : 'bg-slate-50 text-slate-400 border-slate-200'
                        }`}>
                          {count}
                        </span>
                        <span className="text-xs font-semibold text-slate-500">ข้อ</span>
                      </div>

                      {!isReadOnly && (
                        <button
                          type="button"
                          onClick={() => {
                            if (categories.length <= 1) {
                              setWarningModal({
                                isOpen: true,
                                title: "ไม่สามารถลบหมวดคะแนนได้",
                                message: "แบบฟอร์มต้องมีหมวดคะแนนอย่างน้อย 1 หมวด"
                              });
                              return;
                            }
                            setDeleteTarget({
                              type: "scoringCategory",
                              catName: cat,
                              count
                            });
                          }}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors"
                          title={`ลบหมวดคะแนน "${cat}"`}
                        >
                          <X size={15} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

      {/* 🌟 3. SECTIONS & QUESTIONS BUILDER */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers size={18} className="text-[#0F6659]" />
            <h3 className="text-base font-extrabold text-slate-800">หมวดหมู่และข้อคำถามการตรวจ</h3>
          </div>
        </div>

        <style>{`
          @keyframes subtleSlideUp {
            0% {
              transform: translateY(22px);
              opacity: 0.88;
            }
            100% {
              transform: translateY(0);
              opacity: 1;
            }
          }
          @keyframes subtleSlideDown {
            0% {
              transform: translateY(-22px);
              opacity: 0.88;
            }
            100% {
              transform: translateY(0);
              opacity: 1;
            }
          }
        `}</style>

        {sections.map((sec, secIdx) => {
          const moveDir = movementMap[sec.id] || movementMap[`sec_${secIdx}`];
          const animStyle = moveDir === 'up'
            ? { animation: 'subtleSlideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1)' }
            : moveDir === 'down'
            ? { animation: 'subtleSlideDown 0.35s cubic-bezier(0.16, 1, 0.3, 1)' }
            : undefined;

          return (
            <div
              key={sec.id || secIdx}
              ref={(el) => { sectionRefs.current[secIdx] = el; }}
              style={animStyle}
              className={`rounded-3xl p-4 sm:p-6 bg-white border shadow-2xs space-y-4 transition-all duration-300 ${
                moveDir
                  ? "border-emerald-400 ring-2 ring-emerald-400/25 shadow-md bg-emerald-50/15"
                  : "border-slate-200"
              }`}
            >
            {/* Section Header Bar */}
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                <span className="w-7 h-7 rounded-xl flex items-center justify-center text-xs font-black shrink-0 bg-emerald-100 text-[#0F6659]">
                  {secIdx + 1}
                </span>

                {isReadOnly ? (
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <h4 className="text-sm sm:text-base font-bold text-slate-800 truncate">{sec.title || "(ไม่ได้ระบุชื่อหมวดหมู่)"}</h4>
                  </div>
                ) : editingSecIdx === secIdx ? (
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <input
                      autoFocus
                      type="text"
                      value={sec.title || ""}
                      onChange={(e) => updateSectionTitle(secIdx, e.target.value)}
                      onBlur={() => setEditingSecIdx(null)}
                      onKeyDown={(e) => { if (e.key === "Enter") setEditingSecIdx(null); }}
                      placeholder="ระบุชื่อหมวดหมู่..."
                      className="text-sm sm:text-base font-bold px-3 py-1.5 rounded-xl border border-[#0F6659] bg-white text-slate-800 focus:outline-none flex-1 shadow-2xs"
                    />
                  </div>
                ) : (
                  <div className="flex items-center gap-2 min-w-0 group cursor-pointer flex-1" onClick={() => setEditingSecIdx(secIdx)}>
                    <h4 className={`text-sm sm:text-base font-bold truncate ${sec.title ? "text-slate-800" : "text-slate-400 italic"}`}>
                      {sec.title || "ระบุชื่อหมวดหมู่..."}
                    </h4>
                    <Edit3 size={14} className="text-slate-300 group-hover:text-[#0F6659] shrink-0 transition-colors" />
                  </div>
                )}

                {/* Section Summary Badges */}
                {(() => {
                  const scoredCount = (sec.items || []).filter(i => (i.type === "yesno" || i.type === "scale") && i.isScored !== false && Number(i.fullScore) > 0).length;
                  const nonScoredCount = (sec.items || []).length - scoredCount;
                  return (
                    <div className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-bold">
                      {scoredCount > 0 && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-emerald-50 text-[#0F6659] border border-emerald-200/80">
                          <CheckCircle2 size={12} className="text-[#0F6659]" />
                          คิดคะแนน {scoredCount} ข้อ
                        </span>
                      )}
                      {nonScoredCount > 0 && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-slate-100 text-slate-600 border border-slate-200/80">
                          <Table size={12} className="text-slate-500" />
                          ข้อมูล {nonScoredCount} รายการ
                        </span>
                      )}
                    </div>
                  );
                })()}
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {!isReadOnly && (
                  <>
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
                  </>
                )}

                <span className="text-xs font-bold px-2.5 py-1 rounded-xl bg-slate-100 text-slate-600">
                  {sec.items.length} รายการ
                </span>

                {!isReadOnly && (
                  <button
                    type="button"
                    onClick={() => handleRequestRemoveSection(secIdx)}
                    className="p-2 rounded-xl text-red-500 hover:bg-red-50 cursor-pointer transition-colors"
                    title="ลบหมวดหมู่นี้"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
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
                      transition: isDragging ? "box-shadow 0.15s" : (dragUI ? "transform 0.18s cubic-bezier(0.2,0,0,1)" : "none")
                    }}
                    className="p-3.5 sm:p-4 rounded-2xl border border-slate-200 space-y-3 relative transition-colors"
                  >
                    {/* 1. Item Header Bar: Drag Handle + Question Number (Left) | Score + Critical + Delete (Right) */}
                    <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-200/60">
                      {/* Left: Drag Handle & Question Number Badge */}
                      <div className="flex items-center gap-2 min-w-0">
                        {!isReadOnly && (
                          <button
                            type="button"
                            onPointerDown={(e) => handlePointerDown(e, secIdx, item.id)}
                            className="p-1 text-slate-400 hover:text-slate-700 cursor-grab active:cursor-grabbing rounded-lg hover:bg-slate-200/60 shrink-0 touch-none"
                            title="คลิกลากเพื่อสลับลำดับข้อ"
                          >
                            <GripVertical size={16} />
                          </button>
                        )}
                        <span className="text-xs font-black text-slate-800 font-mono px-2.5 py-0.5 bg-slate-100 border border-slate-200/80 rounded-lg shrink-0">
                          ข้อที่ {itemIdx + 1}
                        </span>
                      </div>

                      {/* Right: Score Input + Critical Toggle + Delete */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {(() => {
                          const canBeScored = item.type === "yesno" || item.type === "scale";
                          const isItemScored = canBeScored && item.isScored !== false && Number(item.fullScore) > 0;

                          if (!canBeScored) {
                            return (
                              <div
                                className="flex items-center gap-1 border border-slate-200/70 rounded-xl px-2.5 py-1 bg-slate-100/80 shadow-2xs select-none"
                                title="ฟิลด์ประเภทนี้ยังไม่มีระบบคิดคะแนน (คะแนนเป็น -)"
                              >
                                <span className="text-[11px] font-semibold text-slate-400">คะแนน:</span>
                                <span className="w-6 text-xs font-black text-center font-mono text-slate-400 cursor-not-allowed">
                                  -
                                </span>
                              </div>
                            );
                          }

                          return (
                            <>
                              <div
                                className={`flex items-center gap-1 border rounded-xl px-2 py-1 shadow-2xs transition-colors shrink-0 ${
                                  isReadOnly
                                    ? "bg-slate-50 border-slate-200"
                                    : isItemScored
                                    ? "bg-white border-slate-200 hover:border-[#0F6659] focus-within:border-[#0F6659]"
                                    : "bg-slate-50 border-slate-200 hover:border-slate-300"
                                }`}
                              >
                                <span className="text-[11px] font-semibold text-slate-500">คะแนน:</span>
                                <input
                                  type="text"
                                  disabled={isReadOnly}
                                  value={!isItemScored ? "-" : (item.fullScore ?? 10)}
                                  onChange={(e) => updateItemScore(secIdx, item.id, e.target.value)}
                                  onBlur={(e) => handleItemScoreBlur(secIdx, item.id, e.target.value)}
                                  className={`w-8 text-xs font-bold text-center font-mono outline-none bg-transparent p-0 ${
                                    isReadOnly
                                      ? "text-slate-700 cursor-default"
                                      : !isItemScored
                                      ? "text-slate-400 cursor-text"
                                      : "text-[#0F6659] cursor-text"
                                  }`}
                                  title={isReadOnly ? "คะแนนของข้อนี้" : "กำหนดคะแนน (ใส่ตัวเลข หรือพิมพ์ - เพื่อไม่คิดคะแนน)"}
                                />
                              </div>

                              {isItemScored && (
                                isReadOnly ? (
                                  item.critical ? (
                                    <div className="px-2 py-1 rounded-xl text-xs font-bold flex items-center gap-1 bg-rose-50 text-rose-600 border border-rose-300 shrink-0">
                                      <ShieldAlert size={14} className="text-rose-600" />
                                      <span className="text-[11px] font-bold text-rose-600">สำคัญ</span>
                                    </div>
                                  ) : null
                                ) : (
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
                                )
                              )}
                            </>
                          );
                        })()}

                        {/* Delete Question Button */}
                        {!isReadOnly && (
                          <button
                            type="button"
                            onClick={() => handleRequestRemoveItem(secIdx, item, itemIdx)}
                            className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer transition-colors shrink-0"
                            title="ลบรายการนี้"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* 2. Full-Width Question Text Area */}
                    <div className="w-full min-w-0">
                      {isReadOnly ? (
                        <div className="w-full min-w-0 p-2.5 -mx-1 rounded-xl">
                          <p className={`text-xs sm:text-sm font-medium leading-relaxed break-words [overflow-wrap:anywhere] ${
                            (item.text || item.questionText) ? "text-slate-800" : "text-slate-400 italic"
                          }`}>
                            {item.text || item.questionText || "(ยังไม่ได้ระบุข้อความคำถาม)"}
                          </p>
                        </div>
                      ) : editingId === item.id ? (
                        <div className="flex items-center gap-2 w-full min-w-0">
                          <textarea
                            autoFocus
                            rows={2}
                            value={item.text !== undefined ? item.text : (item.questionText || "")}
                            onChange={(e) => updateItemText(secIdx, item.id, e.target.value)}
                            onBlur={() => setEditingId(null)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                setEditingId(null);
                              }
                            }}
                            placeholder={item.placeholder || getQuestionPlaceholder(item.type || item.questionType)}
                            className="w-full text-xs sm:text-sm font-medium p-3 rounded-xl border border-[#0F6659] bg-white text-slate-800 placeholder:text-slate-400 placeholder:italic outline-none shadow-2xs resize-none leading-relaxed"
                          />
                        </div>
                      ) : (
                        <div
                          onClick={() => setEditingId(item.id)}
                          className="w-full min-w-0 group/text cursor-pointer hover:bg-emerald-50/50 p-2.5 -mx-1 rounded-xl transition-all flex items-start justify-between gap-3"
                          title="คลิกเพื่อแก้ไขข้อความคำถาม"
                        >
                          <p className={`text-xs sm:text-sm font-medium leading-relaxed flex-1 min-w-0 break-words [overflow-wrap:anywhere] ${
                            (item.text || item.questionText)
                              ? "text-slate-800 group-hover/text:text-[#0F6659] transition-colors"
                              : "text-slate-400 italic"
                          }`}>
                            {item.text || item.questionText || item.placeholder || getQuestionPlaceholder(item.type || item.questionType)}
                          </p>
                          <Edit3 size={15} className="text-slate-300 group-hover/text:text-[#0F6659] shrink-0 mt-0.5 transition-colors" />
                        </div>
                      )}
                    </div>

                    {/* Specific Config Preview for Non-Scored Items */}
                    {item.type === "grid" && (
                      <div className="p-3 rounded-2xl bg-emerald-50/40 border border-emerald-200/80 space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            {item.fieldConfig?.columns?.some(c => c.autoSum) && (
                              <span className="text-[11px] text-[#0F6659] font-bold flex items-center gap-1">
                                <Calculator size={13} />
                                <span>มีรวมยอดท้ายตาราง</span>
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Mini preview snippet */}
                        <div className="overflow-x-auto rounded-xl border border-emerald-200/60 bg-white">
                          <table className="w-full text-xs text-left">
                            <thead>
                              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                                <th className="py-1.5 px-2.5 w-8 text-center font-mono">#</th>
                                <th className="py-1.5 px-2.5">รายการ</th>
                                {(item.fieldConfig?.columns || []).map((c, ci) => (
                                  <th key={c.id || ci} className="py-1.5 px-2.5 whitespace-nowrap">
                                    {c.label} {c.autoSum ? "∑" : ""}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-slate-700">
                              {(item.fieldConfig?.rows || []).slice(0, 3).map((r, ri) => (
                                <tr key={r.id || ri} className="hover:bg-slate-50/50">
                                  <td className="py-1 px-2.5 text-center text-slate-400 font-mono">{ri + 1}</td>
                                  <td className="py-1 px-2.5 font-medium">{r.label}</td>
                                  {(item.fieldConfig?.columns || []).map((c, ci) => (
                                    <td key={c.id || ci} className="py-1 px-2.5 text-slate-400 italic">
                                      {c.type === "number" ? "0" : c.type === "radio" ? "🔘" : c.type === "checkbox" ? "☑️" : "—"}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                              {(item.fieldConfig?.rows?.length || 0) > 3 && (
                                <tr>
                                  <td colSpan={(item.fieldConfig?.columns?.length || 0) + 2} className="py-1 px-3 text-center text-[11px] text-slate-400 bg-slate-50/50 italic">
                                    ... และอีก {(item.fieldConfig?.rows?.length || 0) - 3} แถว
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>

                        {/* Edit Button below table */}
                        {!isReadOnly && (
                          <div className="pt-0.5 flex justify-end">
                            <button
                              type="button"
                              onClick={() => setGridModalTarget({
                                secIdx,
                                itemId: item.id,
                                initialConfig: item.fieldConfig || CASH_AUDIT_PRESET,
                                initialTitle: item.text || "ตารางข้อมูล"
                              })}
                              className="w-full sm:w-auto px-3.5 py-1.5 rounded-xl bg-white hover:bg-emerald-50 border border-emerald-300 text-xs font-bold text-[#0F6659] flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer transition-all active:scale-95"
                            >
                              <Settings2 size={13} />
                              <span>แก้ไขโครงสร้าง</span>
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Number Unit Config */}
                    {item.type === "number" && (
                      <div className="flex items-center gap-2 pt-1">
                        <span className="text-xs font-bold text-slate-600">หน่วยนับ:</span>
                        <input
                          type="text"
                          disabled={isReadOnly}
                          value={item.fieldConfig?.unit || ""}
                          onChange={(e) => updateItemFieldConfig(secIdx, item.id, { unit: e.target.value })}
                          placeholder="เช่น บาท, ชิ้น, คน, องศา C..."
                          className="text-xs font-semibold px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none focus:border-[#0F6659] w-40 shadow-2xs"
                        />
                      </div>
                    )}

                    {/* Options Config for Select, Radio, Checkbox */}
                    {(item.type === "select" || item.type === "radio" || item.type === "checkbox") && (
                      <div className="space-y-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                        <span className="text-xs font-bold text-slate-700 block">
                          รายการตัวเลือก ({item.type === "select" ? "Dropdown" : item.type === "radio" ? "Radio" : "Checkbox"}):
                        </span>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {(item.fieldConfig?.options || []).map((opt, oIdx) => (
                            <span key={oIdx} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-xs font-medium text-slate-700 shadow-2xs">
                              <span>{opt}</span>
                              {!isReadOnly && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const nextOpts = (item.fieldConfig?.options || []).filter((_, i) => i !== oIdx);
                                    updateItemFieldConfig(secIdx, item.id, { options: nextOpts });
                                  }}
                                  className="text-slate-400 hover:text-rose-500 cursor-pointer"
                                >
                                  <X size={12} />
                                </button>
                              )}
                            </span>
                          ))}
                          {!isReadOnly && (
                            <div className="flex items-center gap-1">
                              <input
                                type="text"
                                placeholder="+ พิมพ์ตัวเลือก..."
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" && e.target.value.trim()) {
                                    e.preventDefault();
                                    const nextOpts = [...(item.fieldConfig?.options || []), e.target.value.trim()];
                                    updateItemFieldConfig(secIdx, item.id, { options: nextOpts });
                                    e.target.value = "";
                                  }
                                }}
                                className="text-xs font-semibold px-2.5 py-1 rounded-lg border border-dashed border-slate-300 bg-white text-slate-700 focus:outline-none focus:border-[#0F6659] w-36 shadow-2xs"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Question Footer: Type Selector (Left) & Category Selector (Right) */}
                    <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2.5 border-t border-slate-100">
                      {/* Left: Answer Type */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-500">ประเภทคำตอบ:</span>
                        {(() => {
                          const info = getNonScoredFieldInfo(item.type);
                          const Icon = info.icon;
                          const isSpecialType = item.type !== "yesno" && item.type !== "scale";
                          return (
                            <button
                              type="button"
                              disabled={isReadOnly}
                              onClick={() => setFieldTypeModalTarget({ secIdx, itemId: item.id })}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all shadow-2xs cursor-pointer ${
                                isSpecialType
                                  ? "bg-emerald-50 text-[#0F6659] border-emerald-300 hover:bg-emerald-100"
                                  : "bg-white text-slate-700 border-slate-200 hover:border-[#0F6659] hover:bg-slate-50"
                              }`}
                              title="คลิกเพื่อเปลี่ยนประเภทคำตอบ / ข้อมูล"
                            >
                              <Icon size={14} className={isSpecialType ? "text-[#0F6659]" : "text-slate-500"} />
                              <span>{info.label}</span>
                              {!isReadOnly && <ChevronDown size={13} className="text-slate-400" />}
                            </button>
                          );
                        })()}
                      </div>

                      {/* Right: Category Selector (หมวดคะแนนของข้อนี้ - แสดงเฉพาะเมื่อคิดคะแนน) */}
                      {(() => {
                        const canBeScored = item.type === "yesno" || item.type === "scale";
                        const isItemScored = canBeScored && item.isScored !== false && Number(item.fullScore) > 0;
                        if (!isItemScored) return null;

                        return (
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-semibold text-slate-500">หมวดคะแนน:</span>
                            <div className="relative">
                              <select
                                disabled={isReadOnly}
                                value={item.category || DEFAULT_CATEGORIES[0]}
                                onChange={(e) => updateItemCategory(secIdx, item.id, e.target.value)}
                                className={`text-xs sm:text-sm font-semibold pl-2.5 pr-6 py-1.5 min-h-[34px] sm:min-h-[36px] rounded-xl border border-slate-200 bg-white text-slate-800 outline-none shadow-2xs appearance-none ${
                                  isReadOnly ? "cursor-default" : "hover:border-[#0F6659] focus:border-[#0F6659] cursor-pointer"
                                }`}
                              >
                                {categories.map((cat, cIdx) => (
                                  <option key={cIdx} value={cat}>{getCategoryDisplay(cat)}</option>
                                ))}
                              </select>
                              {!isReadOnly && (
                                <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Add Question / Item Button */}
            {!isReadOnly && (
              <button
                type="button"
                onClick={() => handleAddItemClick(secIdx)}
                className="w-full py-3 rounded-2xl border border-dashed text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.99] bg-slate-50 hover:bg-emerald-50/60 border-slate-300 hover:border-emerald-400 text-slate-600 hover:text-[#0F6659]"
              >
                <Plus size={16} />
                <span>เพิ่มข้อคำถาม</span>
              </button>
            )}
          </div>
        );
      })}

        {/* 🌟 Single Add Section Button */}
        {!isReadOnly && (
          <div className="pt-2">
            <button
              type="button"
              onClick={() => addSection()}
              className="w-full py-3.5 px-4 rounded-2xl bg-[#0F6659] hover:bg-[#0c5247] text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2.5 cursor-pointer shadow-sm hover:shadow-md transition-all active:scale-[0.99]"
            >
              <div className="w-6 h-6 rounded-lg bg-white/20 text-white flex items-center justify-center shrink-0 shadow-2xs">
                <Plus size={15} strokeWidth={2.5} />
              </div>
              <div className="text-left">
                <div className="leading-tight font-extrabold text-white text-xs sm:text-sm">เพิ่มหมวดหมู่</div>
              </div>
            </button>
          </div>
        )}
          </div>
        </div>
        )
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

              {!isReadOnly && (
                <button
                  type="button"
                  onClick={() => setFieldTypeModalTarget({ isMeta: true })}
                  className="flex items-center gap-1.5 px-4 py-2.5 bg-[#0F6659] text-white rounded-2xl text-xs font-bold hover:bg-emerald-800 transition-all shadow-xs cursor-pointer active:scale-95 shrink-0"
                >
                  <Plus size={15} />
                  <span>เพิ่มฟิลด์ข้อมูลใหม่</span>
                </button>
              )}
            </div>

            {/* List of Fields */}
            <div className="space-y-3">
              {metadataConfig.length === 0 ? (
                <div className="py-8 px-4 text-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50">
                  <p className="text-xs font-semibold text-slate-500">
                    ยังไม่มีฟิลด์ข้อมูลการตรวจ {!isReadOnly && '(คลิก "+ เพิ่มฟิลด์ข้อมูลใหม่" เพื่อเพิ่ม)'}
                  </p>
                </div>
              ) : (
                metadataConfig.map((field, idx) => {
                  const isDragging = metaDragUI && metaDragUI.id === field.id;
                  const displacePx = (metaDragUI && metaDragUI.displace[field.id]) || 0;
                  const moveDir = metaMovementMap[field.id];

                  const animStyle = moveDir === 'up'
                    ? { animation: 'subtleSlideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1)' }
                    : moveDir === 'down'
                    ? { animation: 'subtleSlideDown 0.35s cubic-bezier(0.16, 1, 0.3, 1)' }
                    : undefined;

                  return (
                    <div
                      key={field.id || idx}
                      ref={(el) => { metaRefs.current[field.id] = el; }}
                      style={{
                        transform: isDragging
                          ? `translateY(${metaDragUI.deltaY}px) scale(1.01)`
                          : displacePx
                          ? `translateY(${displacePx}px)`
                          : undefined,
                        zIndex: isDragging ? 40 : 1,
                        boxShadow: isDragging ? "0 16px 32px rgba(0,0,0,0.12)" : undefined,
                        transition: isDragging ? "box-shadow 0.15s" : (metaDragUI ? "transform 0.18s cubic-bezier(0.2,0,0,1)" : "none"),
                        ...animStyle
                      }}
                      className={`p-3.5 sm:p-4 rounded-2xl border shadow-2xs space-y-3 relative transition-all duration-300 ${
                        moveDir
                          ? "border-emerald-400 ring-2 ring-emerald-400/25 shadow-md bg-emerald-50/15"
                          : "border-slate-200 hover:border-emerald-300 bg-[#FAFAF8]"
                      }`}
                    >
                      {/* 1. Header Bar: Drag Handle + Number Badge + Up/Down Arrows + Controls + Delete */}
                      <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-200/60">
                        {/* Left: Drag Handle & Number Badge & Up/Down Arrows */}
                        <div className="flex items-center gap-2 min-w-0">
                          {!isReadOnly && (
                            <button
                              type="button"
                              onPointerDown={(e) => handleMetaPointerDown(e, field.id)}
                              className="p-1 text-slate-400 hover:text-slate-700 cursor-grab active:cursor-grabbing rounded-lg hover:bg-slate-200/60 shrink-0 touch-none"
                              title="คลิกลากเพื่อสลับลำดับข้อ"
                            >
                              <GripVertical size={16} />
                            </button>
                          )}

                          <span className="text-xs font-black text-slate-800 font-mono px-2.5 py-0.5 bg-slate-100 border border-slate-200/80 rounded-lg shrink-0">
                            รายการที่ {idx + 1}
                          </span>

                          {!isReadOnly && (
                            <div className="flex items-center gap-0.5 shrink-0 ml-0.5">
                              <button
                                type="button"
                                disabled={idx === 0}
                                onClick={() => moveMetaField(idx, -1)}
                                className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 disabled:opacity-20 cursor-pointer transition-colors"
                                title="เลื่อนขึ้น"
                              >
                                <ChevronUp size={15} />
                              </button>
                              <button
                                type="button"
                                disabled={idx === metadataConfig.length - 1}
                                onClick={() => moveMetaField(idx, 1)}
                                className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 disabled:opacity-20 cursor-pointer transition-colors"
                                title="เลื่อนลง"
                              >
                                <ChevronDown size={15} />
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Right: Required Toggle & Delete Button */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          {/* Required Toggle */}
                          {!isReadOnly ? (
                            <button
                              type="button"
                              onClick={() => updateMetaFieldInline(field.id, { required: !field.required })}
                              className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shadow-2xs shrink-0 ${
                                field.required
                                  ? 'bg-rose-50 text-rose-600 border border-rose-300 ring-1 ring-rose-200'
                                  : 'bg-white border border-slate-200 text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                              }`}
                              title={field.required ? "คลิกเพื่อยกเลิกบังคับกรอก" : "คลิกเพื่อตั้งเป็นบังคับกรอก"}
                            >
                              <span className="text-rose-500 font-bold">*</span>
                              <span className="text-[11px] font-bold">{field.required ? "บังคับ" : "ไม่บังคับ"}</span>
                            </button>
                          ) : field.required ? (
                            <span className="px-2 py-0.5 rounded-lg text-[10px] font-extrabold bg-rose-50 text-rose-600 border border-rose-200">
                              * บังคับกรอก
                            </span>
                          ) : null}

                          {/* Delete Button */}
                          {!isReadOnly && (
                            <button
                              type="button"
                              onClick={() => handleRequestRemoveMetaField(field, idx)}
                              className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer transition-colors shrink-0"
                              title="ลบรายการนี้"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* 2. Full-Width Title / Label Input */}
                      <div className="w-full min-w-0">
                        {isReadOnly ? (
                          <div className="w-full min-w-0 p-2.5 -mx-1 rounded-xl">
                            <p className={`text-xs sm:text-sm font-medium leading-relaxed break-words [overflow-wrap:anywhere] ${
                              field.label ? "text-slate-800" : "text-slate-400 italic"
                            }`}>
                              {field.label || "(ยังไม่ได้ระบุชื่อข้อมูล)"}
                            </p>
                          </div>
                        ) : editingId === field.id ? (
                          <div className="flex items-center gap-2 w-full min-w-0">
                            <input
                              autoFocus
                              type="text"
                              value={field.label || ""}
                              onChange={(e) => updateMetaFieldInline(field.id, { label: e.target.value })}
                              onBlur={() => setEditingId(null)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  setEditingId(null);
                                }
                              }}
                              placeholder="ระบุชื่อข้อมูล..."
                              className="w-full text-xs sm:text-sm font-medium px-3 py-2 rounded-xl border border-[#0F6659] bg-white text-slate-800 placeholder:text-slate-400 outline-none shadow-2xs"
                            />
                          </div>
                        ) : (
                          <div
                            onClick={() => setEditingId(field.id)}
                            className="w-full min-w-0 group/text cursor-pointer hover:bg-emerald-50/50 p-2.5 -mx-1 rounded-xl transition-all flex items-center justify-between gap-3"
                            title="คลิกเพื่อแก้ไขชื่อข้อมูล"
                          >
                            <p className={`text-xs sm:text-sm font-medium leading-relaxed flex-1 min-w-0 break-words [overflow-wrap:anywhere] ${
                              field.label
                                ? "text-slate-800 group-hover/text:text-[#0F6659] transition-colors"
                                : "text-slate-400 italic"
                            }`}>
                              {field.label || "ระบุชื่อข้อมูล..."}
                            </p>
                            <Edit3 size={15} className="text-slate-300 group-hover/text:text-[#0F6659] shrink-0 transition-colors" />
                          </div>
                        )}
                      </div>

                      {/* 3. Specific Config: Grid, Number Unit, Options (Select/Radio/Checkbox) */}
                      {field.type === "grid" && (
                        <div className="p-3 rounded-2xl bg-emerald-50/40 border border-emerald-200/80 space-y-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              {field.fieldConfig?.columns?.some(c => c.autoSum) && (
                                <span className="text-[11px] text-[#0F6659] font-bold flex items-center gap-1">
                                  <Calculator size={13} />
                                  <span>มีรวมยอดท้ายตาราง</span>
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Mini preview snippet */}
                          <div className="overflow-x-auto rounded-xl border border-emerald-200/60 bg-white">
                            <table className="w-full text-xs text-left">
                              <thead>
                                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                                  <th className="py-1.5 px-2.5 w-8 text-center font-mono">#</th>
                                  <th className="py-1.5 px-2.5">รายการ</th>
                                  {(field.fieldConfig?.columns || []).map((c, ci) => (
                                    <th key={c.id || ci} className="py-1.5 px-2.5 whitespace-nowrap">
                                      {c.label} {c.autoSum ? "∑" : ""}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 text-slate-700">
                                {(field.fieldConfig?.rows || []).slice(0, 3).map((r, ri) => (
                                  <tr key={r.id || ri} className="hover:bg-slate-50/50">
                                    <td className="py-1 px-2.5 text-center text-slate-400 font-mono">{ri + 1}</td>
                                    <td className="py-1 px-2.5 font-medium">{r.label}</td>
                                    {(field.fieldConfig?.columns || []).map((c, ci) => (
                                      <td key={c.id || ci} className="py-1 px-2.5 text-slate-400 italic">
                                        {c.type === "number" ? "0" : c.type === "radio" ? "🔘" : c.type === "checkbox" ? "☑️" : "—"}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                                {(field.fieldConfig?.rows?.length || 0) > 3 && (
                                  <tr>
                                    <td colSpan={(field.fieldConfig?.columns?.length || 0) + 2} className="py-1 px-3 text-center text-[11px] text-slate-400 bg-slate-50/50 italic">
                                      ... และอีก {(field.fieldConfig?.rows?.length || 0) - 3} แถว
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>

                          {/* Edit Button below table */}
                          {!isReadOnly && (
                            <div className="pt-0.5 flex justify-end">
                              <button
                                type="button"
                                onClick={() => setGridModalTarget({
                                  isMeta: true,
                                  metaId: field.id,
                                  initialConfig: field.fieldConfig || CASH_AUDIT_PRESET,
                                  initialTitle: field.label || "ตารางข้อมูล"
                                })}
                                className="w-full sm:w-auto px-3.5 py-1.5 rounded-xl bg-white hover:bg-emerald-50 border border-emerald-300 text-xs font-bold text-[#0F6659] flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer transition-all active:scale-95"
                              >
                                <Settings2 size={13} />
                                <span>แก้ไขโครงสร้างตาราง (แถว/คอลัมน์)</span>
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {field.type === "number" && (
                        <div className="flex items-center gap-2 pt-1">
                          <span className="text-xs font-bold text-slate-600">หน่วยนับ:</span>
                          <input
                            type="text"
                            disabled={isReadOnly}
                            value={field.unit || ""}
                            onChange={(e) => updateMetaFieldInline(field.id, { unit: e.target.value })}
                            placeholder="เช่น บาท, ชิ้น, คน, องศา C..."
                            className="text-xs font-semibold px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none focus:border-[#0F6659] w-40 shadow-2xs"
                          />
                        </div>
                      )}

                      {(field.type === "select" || field.type === "radio" || field.type === "checkbox") && (
                        <div className="space-y-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                          <span className="text-xs font-bold text-slate-700 block">
                            รายการตัวเลือก ({field.type === "select" ? "Dropdown" : field.type === "radio" ? "Radio" : "Checkbox"}):
                          </span>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {(field.options || []).map((opt, oIdx) => (
                              <span key={oIdx} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-xs font-medium text-slate-700 shadow-2xs">
                                <span>{opt}</span>
                                {!isReadOnly && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const nextOpts = (field.options || []).filter((_, i) => i !== oIdx);
                                      updateMetaFieldInline(field.id, { options: nextOpts });
                                    }}
                                    className="text-slate-400 hover:text-rose-500 cursor-pointer"
                                  >
                                    <X size={12} />
                                  </button>
                                )}
                              </span>
                            ))}
                            {!isReadOnly && (
                              <div className="flex items-center gap-1">
                                <input
                                  type="text"
                                  placeholder="+ พิมพ์ตัวเลือก..."
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" && e.target.value.trim()) {
                                      e.preventDefault();
                                      const nextOpts = [...(field.options || []), e.target.value.trim()];
                                      updateMetaFieldInline(field.id, { options: nextOpts });
                                      e.target.value = "";
                                    }
                                  }}
                                  className="text-xs font-semibold px-2.5 py-1 rounded-lg border border-dashed border-slate-300 bg-white text-slate-700 focus:outline-none focus:border-[#0F6659] w-36 shadow-2xs"
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* 4. Footer: Type Selector (Left) & Info Tag (Right) */}
                      <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2.5 border-t border-slate-100">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-slate-500">ประเภทข้อมูล:</span>
                          {(() => {
                            const info = getNonScoredFieldInfo(field.type);
                            const Icon = info.icon;
                            return (
                              <button
                                type="button"
                                disabled={isReadOnly}
                                onClick={() => setFieldTypeModalTarget({ isMeta: true, metaId: field.id })}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all shadow-2xs cursor-pointer ${
                                  field.type === "grid"
                                    ? "bg-emerald-50 text-[#0F6659] border-emerald-300 hover:bg-emerald-100"
                                    : "bg-white text-slate-700 border-slate-200 hover:border-[#0F6659] hover:bg-slate-50"
                                }`}
                                title="คลิกเพื่อเปลี่ยนประเภทข้อมูล"
                              >
                                <Icon size={14} className={field.type === "grid" ? "text-[#0F6659]" : "text-slate-500"} />
                                <span>{info.label}</span>
                                {!isReadOnly && <ChevronDown size={13} className="text-slate-400" />}
                              </button>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}

              {/* Bottom Add Field Button */}
              {!isReadOnly && metadataConfig.length > 0 && (
                <button
                  type="button"
                  onClick={() => setFieldTypeModalTarget({ isMeta: true })}
                  className="w-full py-3 rounded-2xl border border-dashed border-slate-300 hover:border-slate-400 bg-slate-50 hover:bg-slate-100/80 text-xs sm:text-sm font-extrabold text-slate-600 hover:text-slate-800 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.99]"
                >
                  <Plus size={16} />
                  <span>เพิ่มฟิลด์ข้อมูลการตรวจ</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}


      {/* 🌟 4. COMPACT FLOATING ACTION BAR (Always visible & floating on screen) */}
      {typeof document !== "undefined" && createPortal(
        <div className="fixed bottom-3.5 sm:bottom-5 left-0 right-0 z-[9990] px-3 sm:px-4 pointer-events-none flex justify-center animate-in slide-in-from-bottom-3 duration-200">
          <div className="pointer-events-auto max-w-sm sm:max-w-md w-full bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl sm:rounded-3xl shadow-xl shadow-slate-900/10 p-2 sm:p-2.5 flex items-center gap-2 ring-1 ring-slate-900/5">
            {isReadOnly ? (
              <button
                type="button"
                onClick={onBack}
                className="w-full py-2 sm:py-2.5 px-4 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs bg-[#0F6659] hover:bg-[#0c5247] text-white active:scale-95 transition-all"
              >
                ย้อนกลับ
              </button>
            ) : (
              <>
                {form?.id && (
                  <button
                    type="button"
                    onClick={() => setDeleteTarget({ type: "form", title: formName, id: form.id })}
                    className="p-2 sm:px-3 sm:py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 border border-rose-200 text-rose-600 hover:bg-rose-50 cursor-pointer transition-all active:scale-95 shrink-0"
                    title="ลบแบบฟอร์มนี้ออกจากระบบ"
                  >
                    <Trash2 size={14} />
                    <span className="hidden sm:inline">ลบ</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={onBack}
                  className="flex-1 py-2 sm:py-2.5 px-3 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1 cursor-pointer bg-slate-100 hover:bg-slate-200 text-slate-700 active:scale-95 transition-all"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving || isLoadingFullForm}
                  className="flex-1 py-2 sm:py-2.5 px-3.5 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs text-white active:scale-95 bg-[#0F6659] hover:bg-[#0c5247] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving || isLoadingFullForm ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <Check size={15} strokeWidth={2.5} />
                  )}
                  <span>{isSaving ? "กำลังบันทึก..." : isLoadingFullForm ? "กำลังโหลดข้อมูล..." : "บันทึกแบบฟอร์ม"}</span>
                </button>
              </>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* ⚙️ POPUP MODAL: ADD / EDIT METADATA FIELD */}
      {metaFieldModal && (
        <ModalWrapper onClose={() => setMetaFieldModal(false)} maxWidth="max-w-md">
          <div className="p-4 sm:p-6 space-y-3.5 sm:space-y-4 max-h-[82dvh] overflow-y-auto overscroll-contain">
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
                    <span className="text-xs font-bold text-rose-600 animate-in fade-in flex items-center gap-1">
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
                    onChange={(e) => setMetaFieldForm({ ...metaFieldForm, type: e.target.value })}
                    className="w-full text-sm pl-4 pr-10 py-3 min-h-[44px] rounded-2xl bg-white border border-slate-200 outline-none font-semibold text-slate-700 focus:border-[#0F6659] transition-all shadow-xs cursor-pointer appearance-none truncate"
                  >
                    <option value="auditor">ผู้ตรวจประเมิน (Auditor)</option>
                    <option value="number">ตัวเลข / จำนวน (ระบุหน่วย)</option>
                    <option value="text">ข้อความ / หมายเหตุ (Text)</option>
                    <option value="select">ตัวเลือกปุ่มกด / Dropdown</option>
                    <option value="date">ปฏิทิน (วัน/เดือน/ปี)</option>
                    <option value="time">เวลา (ชั่วโมง:นาที)</option>
                    <option value="toggle">สวิตช์ ใช่/ไม่ใช่ (Toggle)</option>
                  </select>
                  <ChevronDown size={18} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>

              {/* Specific Config for AUDITOR */}
              {metaFieldForm.type === "auditor" && (
                <div className="p-2.5 sm:p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 text-xs font-semibold text-emerald-900 leading-relaxed">
                  ฟิลด์นี้สำหรับระบุหรือเลือกผู้ตรวจประเมิน (Auditor) จากระบบ หรือกรอกชื่อผู้ตรวจในขณะลงพื้นที่
                </div>
              )}

              {/* Specific Config for NUMBER (Unit & Min/Max & Placeholder) */}
              {metaFieldForm.type === "number" && (
                <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-200 space-y-2.5">
                  <div>
                    <label className="block text-xs font-bold text-emerald-950 mb-1">
                      หน่วยของตัวเลข
                    </label>
                    <input
                      type="text"
                      value={metaFieldForm.unit || ""}
                      onChange={(e) => setMetaFieldForm({ ...metaFieldForm, unit: e.target.value })}
                      placeholder="ระบุหน่วย เช่น คน, ชิ้น, °C"
                      className="w-full text-xs sm:text-sm font-semibold py-2 px-3 rounded-lg border border-emerald-200 outline-none focus:border-[#0F6659] bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-emerald-950 mb-1">
                      ข้อความแนะนำในช่อง (Placeholder)
                    </label>
                    <input
                      type="text"
                      value={metaFieldForm.placeholder || ""}
                      onChange={(e) => setMetaFieldForm({ ...metaFieldForm, placeholder: e.target.value })}
                      placeholder="เช่น ระบุจำนวนพนักงาน..."
                      className="w-full text-xs sm:text-sm font-semibold py-2 px-3 rounded-lg border border-emerald-200 outline-none focus:border-[#0F6659] bg-white"
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

              {/* Enabled / Visible Toggle Switch */}
              <div 
                onClick={() => setMetaFieldForm(prev => ({ ...prev, enabled: prev.enabled === false ? true : false }))}
                className="flex items-center justify-between p-3 sm:p-3.5 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer hover:bg-slate-100/80 transition-colors select-none"
              >
                <div className="flex-1 min-w-0 pr-3">
                  <span className="text-xs sm:text-sm font-bold text-slate-800 block leading-tight">
                    เปิดใช้งานฟิลด์นี้ (Enabled)
                  </span>
                  <span className="text-[10px] sm:text-[11px] text-slate-400 font-normal block mt-0.5">
                    หากปิดใช้งาน ฟิลด์นี้จะไม่แสดงให้ผู้ตรวจเห็นในแบบฟอร์ม
                  </span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={metaFieldForm.enabled !== false}
                  onClick={(e) => {
                    e.stopPropagation();
                    setMetaFieldForm(prev => ({ ...prev, enabled: prev.enabled === false ? true : false }));
                  }}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full p-0.5 transition-colors duration-200 ease-in-out outline-none focus:ring-2 focus:ring-[#0F6659]/20 ${
                    metaFieldForm.enabled !== false ? 'bg-[#0F6659]' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                      metaFieldForm.enabled !== false ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Required Toggle Switch */}
              <div 
                onClick={() => setMetaFieldForm(prev => ({ ...prev, required: !prev.required }))}
                className="flex items-center justify-between p-3 sm:p-3.5 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer hover:bg-slate-100/80 transition-colors select-none"
              >
                <div className="flex-1 min-w-0 pr-3">
                  <span className="text-xs sm:text-sm font-bold text-slate-800 block leading-tight">
                    บังคับกรอกข้อมูล (Required)
                  </span>
                  <span className="text-[10px] sm:text-[11px] text-slate-400 font-normal block mt-0.5">
                    ผู้ตรวจต้องระบุข้อมูลนี้ก่อนจึงจะเริ่มตรวจข้อคำถามได้
                  </span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={metaFieldForm.required}
                  onClick={(e) => {
                    e.stopPropagation();
                    setMetaFieldForm(prev => ({ ...prev, required: !prev.required }));
                  }}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full p-0.5 transition-colors duration-200 ease-in-out outline-none focus:ring-2 focus:ring-[#0F6659]/20 ${
                    metaFieldForm.required ? 'bg-[#0F6659]' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                      metaFieldForm.required ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
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
                  : deleteTarget.type === "metaField"
                  ? "ยืนยันการลบฟิลด์ข้อมูลการตรวจ?"
                  : deleteTarget.type === "scoringCategory"
                  ? "ยืนยันการลบหมวดคะแนน?"
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
                ) : deleteTarget.type === "metaField" ? (
                  <>
                    คุณต้องการลบฟิลด์ข้อมูล <strong className="text-slate-800">"{deleteTarget.label || `ข้อ ${deleteTarget.idx}`}"</strong> (ข้อ {deleteTarget.idx}) ออกจากข้อมูลการตรวจใช่หรือไม่?
                  </>
                ) : deleteTarget.type === "scoringCategory" ? (
                  <>
                    คุณต้องการลบหมวดคะแนน <strong className="text-slate-800">"{deleteTarget.catName}"</strong> ใช่หรือไม่?
                    {deleteTarget.count > 0 && (
                      <span className="block mt-2 text-xs text-amber-800 bg-amber-50 p-2.5 rounded-xl border border-amber-200 text-left leading-relaxed">
                        ⚠️ มีข้อคำถามที่ผูกกับหมวดนี้อยู่ <strong className="font-bold text-rose-600">{deleteTarget.count} ข้อ</strong> โดยระบบจะย้ายข้อคำถามเหล่านี้ไปยังหมวดคะแนนอื่นโดยอัตโนมัติ
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    คุณต้องการลบข้อคำถาม <strong className="text-slate-800">ข้อ {deleteTarget.itemIdx}</strong> ใช่หรือไม่?
                    <span className={`block mt-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 text-xs text-left ${
                      deleteTarget.text ? "text-slate-700 font-medium" : "text-slate-400 italic"
                    }`}>
                      {deleteTarget.text ? `"${deleteTarget.text}"` : "(ยังไม่ได้ระบุข้อความคำถาม)"}
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

      {/* 🌟 7. FIELD TYPE SELECT MODAL (Non-scored Type 1) */}
      <FieldTypeSelectModal
        isOpen={Boolean(fieldTypeModalTarget)}
        onClose={() => setFieldTypeModalTarget(null)}
        onSelectType={handleSelectFieldType}
      />

      {/* 🌟 8. GRID CONFIG MODAL (Grid Builder) */}
      {gridModalTarget && (
        <GridConfigModal
          isOpen={true}
          onClose={() => setGridModalTarget(null)}
          initialConfig={gridModalTarget.initialConfig}
          initialTitle={gridModalTarget.initialTitle}
          onSave={handleSaveGridConfig}
        />
      )}

      {/* 🌟 9. TOP FLOATING TOAST (Dynamic Fresh Mint for success / Soft Rose for warning & error) */}
      {toastMessage && typeof document !== "undefined" && createPortal(
        <div className={`fixed top-5 left-1/2 -translate-x-1/2 z-[999999] pointer-events-none flex items-center gap-3 px-5 py-3 rounded-2xl backdrop-blur-md shadow-xl text-xs sm:text-sm font-bold animate-in fade-in slide-in-from-top-4 duration-200 ${
          toastMessage.isError
            ? "bg-rose-50/95 text-rose-950 border border-rose-300 shadow-rose-600/15 ring-1 ring-rose-400/20"
            : "bg-emerald-50/95 text-emerald-950 border border-emerald-300 shadow-emerald-600/15 ring-1 ring-emerald-400/20"
        }`}>
          <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 shadow-xs text-white ${
            toastMessage.isError ? "bg-rose-600" : "bg-emerald-600"
          }`}>
            {toastMessage.isError ? (
              <AlertTriangle size={15} strokeWidth={2.5} />
            ) : (
              <CheckCircle2 size={16} strokeWidth={2.5} />
            )}
          </div>
          <span className="tracking-tight">{toastMessage.text || toastMessage}</span>
        </div>,
        document.body
      )}
    </div>
  );
}