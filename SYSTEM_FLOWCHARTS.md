# 📊 Q.S.C. System — ผังกระบวนการทำงานแยกตามเคส (System Flowcharts by Use Case)

> **เวอร์ชัน:** 2.6 (รองรับ N/A, ลายเซ็นและไฟล์ Storage, แชทไทม์ไลน์ CAP, และ กฎข้อวิกฤต)  
> **อัปเดตล่าสุด:** 25 สิงหาคม 2569

---

## 📑 สารบัญแผนภาพผังงาน (Flowcharts)

1. [Case 1: การวางแผนและนัดหมายตรวจ (Audit Scheduling Workflow)](#case-1-การวางแผนและนัดหมายตรวจ-audit-scheduling-workflow)
2. [Case 2: การตรวจสดหน้างาน การลงนาม N/A และ Auto-Sync (Live Audit & Signature Workflow)](#case-2-การตรวจสดหน้างาน-การลงนาม-na-และ-auto-sync-live-audit--signature-workflow)
3. [Case 3: การประเมินคะแนนแบบ Dynamic หัก N/A กฎข้อวิกฤต และเปิดตั๋ว CAP (Fair Scoring & CAP Workflow)](#case-3-การประเมินคะแนนแบบ-dynamic-หัก-na-กฎข้อวิกฤต-และเปิดตั๋ว-cap-fair-scoring--cap-workflow)
4. [Case 4: ลูปการแก้ไขข้อบกพร่องและห้องแชทอนุมัติ CAP (CAP Chat Remediation Workflow)](#case-4-ลูปการแก้ไขข้อบกพร่องและห้องแชทอนุมัติ-cap-cap-chat-remediation-workflow)
5. [Case 5: การจัดการสิทธิ์ รีเซ็ตรหัสผ่าน และประเภทสถานที่ของ Admin (Admin Management Workflow)](#case-5-การจัดการสิทธิ์-รีเซ็ตรหัสผ่าน-และประเภทสถานที่ของ-admin-admin-management-workflow)

---

## Case 1: การวางแผนและนัดหมายตรวจ (Audit Scheduling Workflow)
> **ผู้ใช้งาน:** QA Director / Admin / ผู้จัดการทีมตรวจ  
> **ตารางที่เกี่ยวข้อง:** `AUDIT_SCHEDULES`, `AUDIT_SCHEDULE_AUDITORS`, `LOCATIONS`, `SURVEY_FORMS`

```mermaid
flowchart TD
    Start(["เริ่มต้น: กำหนดแผนตรวจ"]) --> CreateSched["Admin / QA สร้างนัดหมายใหม่ (created_by NOT NULL)"]
    CreateSched --> SelectLoc["เลือกสาขาเป้าหมายจาก LOCATIONS"]
    SelectLoc --> SelectForm["เลือกแบบฟอร์มจาก SURVEY_FORMS (กรองเฉพาะ is_latest = TRUE)"]
    SelectForm --> SetDate["ระบุวันที่ เวลา และประเภท Announced / Spot / Undercover"]
    SetDate --> AssignAuditors["มอบหมายผู้ตรวจ 1 หรือหลายคนลง AUDIT_SCHEDULE_AUDITORS"]
    AssignAuditors --> SaveSched[("บันทึกนัดหมาย: Status = 'pending'")]

    SaveSched --> DecisionPending{"สถานะงานตรวจ?"}
    
    DecisionPending -->|"ยังไม่เริ่มตรวจ ('pending')"| CanEdit["✏️ อนุญาตแก้ไขวัน/เวลา/ผู้ตรวจ หรือ 🗑️ ลบนัดหมายได้"]
    CanEdit --> WaitDate["รอถึงกำหนดวันตรวจหน้างาน"]
    
    WaitDate --> StartAudit["ผู้ตรวจกดเริ่มตรวจหน้างาน"]
    StartAudit --> StatusInProgress[("อัปเดต Status = 'in_progress'")]
    
    StatusInProgress --> CompleteAudit["ผู้ตรวจส่งผลตรวจจริงเรียบร้อย"]
    CompleteAudit --> StatusCompleted[("อัปเดต Status = 'completed'")]
    StatusCompleted --> LockPermanently["🔒 ล็อกถาวร: ห้ามแก้ไขหรือลบทุกกรณี"]
    LockPermanently --> EndSched(["สิ้นสุดกระบวนการนัดหมาย"])

    style Start fill:#e0f2fe,stroke:#0284c7,stroke-width:2px
    style SaveSched fill:#fef3c7,stroke:#d97706,stroke-width:2px
    style LockPermanently fill:#fee2e2,stroke:#dc2626,stroke-width:2px
    style EndSched fill:#dcfce7,stroke:#16a34a,stroke-width:2px
```

---

## Case 2: การตรวจสดหน้างาน การลงนาม N/A และ Auto-Sync (Live Audit & Signature Workflow)
> **ผู้ใช้งาน:** ผู้ตรวจประเมินหน้างาน (Auditor) + ผู้รับการตรวจ (Auditee / Store Manager)  
> **ตารางที่เกี่ยวข้อง:** `AUDIT_DRAFTS`, `AUDIT_RECORDS`, `AUDIT_RESPONSES`, `AUDIT_RESPONSE_IMAGES`

```mermaid
flowchart TD
    StartAudit(["เริ่มต้น: ผู้ตรวจเปิดแอปตรวจหน้างาน"]) --> GPSDistance["อ่านพิกัด GPS บนเครื่องผู้ตรวจเพื่อคำนวณระยะทาง (แสดงสาขาใกล้สุด)"]
    GPSDistance --> BranchList["แสดงรายการสาขา: สาขาตรวจค้างอยู่บนสุด + สาขาอื่นเรียงตามระยะทางใกล้ไปไกล"]
    
    BranchList --> SelectBranch{"เลือกสาขาที่จะตรวจ"}
    
    SelectBranch -->|"มีงานตรวจค้างอยู่ (Draft)"| LoadDraft[("โหลด Draft เดิมจาก AUDIT_DRAFTS มาทำต่อทันที (ไม่เก็บพิกัดเริ่มซ้ำ)")]
    SelectBranch -->|"เริ่มตรวจรอบใหม่"| StepForm["เลือกแบบฟอร์ม ➔ ไปที่หน้า 3. รายละเอียดการตรวจ"]
    
    StepForm --> ClickStartBtn["ผู้ตรวจกดปุ่ม 'เริ่มตรวจข้อประเมิน >'"]
    ClickStartBtn --> CaptureStartGPS["📍 บันทึกพิกัดตอนเริ่ม: start_latitude, start_longitude, started_at ลง AUDIT_DRAFTS"]
    
    CaptureStartGPS --> QuestionScreen["หน้าจอแสดงข้อคำถามประเมิน (Step 4)"]
    LoadDraft --> QuestionScreen
    
    QuestionScreen --> UserAction{"การกระทำของผู้ตรวจ"}
    
    UserAction -->|"เลือก Pass / Fail / Scale"| AnswerAction["บันทึกคำตอบลง State"]
    UserAction -->|"เลือก 'ไม่เกี่ยวข้อง (N/A)'"| SetNAAction["ตั้งค่า is_na = TRUE ➔ ข้อนี้จะไม่ถูกคิดใน max_score"]
    UserAction -->|"คลิกซ้ำที่คำตอบเดิม"| ToggleUnselect["ยกเลิกการเลือก ➔ คืนค่าเป็นยังไม่ได้ตอบ"]
    UserAction -->|"ถ่ายรูปหลักฐาน (ปุ่มกล้อง)"| CompressPhoto["ย่อขนาดรูปในเครื่อง Client เหลือ ~200KB"]
    UserAction -->|"พิมพ์ข้อคิดเห็น (ปุ่มคอมเมนต์)"| AddComment["บันทึกข้อคิดเห็น/ข้อบกพร่องลง notes"]
    
    AnswerAction --> CheckFirstAns{"มีคำตอบอย่างน้อย 1 ข้อ?"}
    SetNAAction --> CheckFirstAns
    ToggleUnselect --> CheckFirstAns
    CompressPhoto --> CheckFirstAns
    AddComment --> CheckFirstAns
    
    CheckFirstAns -->|"ใช่"| AutoSync["⚡ Background Auto-Sync 600ms บันทึกลง AUDIT_DRAFTS"]
    CheckFirstAns -->|"ไม่ใช่/ล้างหมด"| HideBadge["ซ่อนป้าย Auto-synced และไม่ส่งเซิร์ฟเวอร์"]
    
    AutoSync --> ShowSynced["แสดงป้ายสถานะ '✓ Auto-synced'"]
    ShowSynced --> NextSection{"ตรวจครบทุกหมวดหรือยัง?"}
    
    NextSection -->|"ยังไม่ครบ"| QuestionScreen
    NextSection -->|"ครบทุกข้อแล้ว"| SignStep["✍️ หน้าสรุปและลงนาม (Signatures Screen)"]
    
    SignStep --> SignAction["ผู้ตรวจและผู้รับการตรวจร่วมลงนามผ่าน Signature Pad"]
    SignAction --> SaveStorage["เซิร์ฟเวอร์บันทึกไฟล์ภาพลายเซ็นลง Storage Folder (/uploads/signatures/)"]
    SaveStorage --> CaptureSignInfo["บันทึก Relative Path, auditee_user_id/name_text, signed_at"]
    
    CaptureSignInfo --> SummaryModal["เปิดป๊อปอัปสรุปผลคะแนนรวม (คำนวณหัก N/A) และรายการข้อตกเกณฑ์"]
    
    SummaryModal --> ConfirmSubmit{"กดยืนยันส่งผลตรวจรอบสุดท้าย?"}
    
    ConfirmSubmit -->|"ย้อนกลับไปแก้"| QuestionScreen
    ConfirmSubmit -->|"ยืนยันส่งจริง"| CaptureEndGPS["📍 บันทึกพิกัดตอนส่ง: อ่านค่า end_latitude, end_longitude และเวลา submitted_at"]
    
    CaptureEndGPS --> FinalSubmit[("บันทึกลง AUDIT_RECORDS + อัปเดต Cache last_score & last_audit_date ใน LOCATIONS")]
    FinalSubmit --> SaveImages[("บันทึกรูปภาพลง Storage และเก็บ Path ใน AUDIT_RESPONSE_IMAGES")]
    SaveImages --> DeleteDraft[("ลบแบบร่างออกจาก AUDIT_DRAFTS ทันที")]
    DeleteDraft --> LockAudit["🔒 ผลตรวจถูกล็อกถาวร ห้ามแก้ไข"]
    LockAudit --> EndAudit(["สิ้นสุดการตรวจหน้างาน"])

    style StartAudit fill:#e0f2fe,stroke:#0284c7,stroke-width:2px
    style SignStep fill:#fef3c7,stroke:#d97706,stroke-width:2px
    style CaptureEndGPS fill:#fef3c7,stroke:#d97706,stroke-width:2px
    style FinalSubmit fill:#dcfce7,stroke:#16a34a,stroke-width:2px
    style EndAudit fill:#dcfce7,stroke:#16a34a,stroke-width:2px
```

---

## Case 3: การประเมินคะแนนแบบ Dynamic หัก N/A กฎข้อวิกฤต และเปิดตั๋ว CAP (Fair Scoring & CAP Workflow)
> **ผู้ใช้งาน:** ระบบอัตโนมัติ (Backend Business Logic)  
> **ตารางที่เกี่ยวข้อง:** `AUDIT_RECORDS`, `AUDIT_RESPONSES`, `SURVEY_ITEMS`, `CAP_TASKS`

```mermaid
flowchart TD
    SubmitTrigger(["ผู้ตรวจกดยืนยันส่งผลตรวจ"]) --> CalcDynamicMax["คำนวณ max_score เฉพาะข้อที่ is_na == FALSE"]
    CalcDynamicMax --> CalcScore["คำนวณ total_score และ percentage_score = (total / max) * 100"]
    
    CalcScore --> CheckCritical{"มีข้อใดที่เป็น is_critical = TRUE แล้วตกเกณฑ์ (is_passed = FALSE) ไหม?"}
    
    CheckCritical -->|"🚨 มีข้อวิกฤตตก!"| ForceFail["บังคับ is_passed = FALSE และ has_critical_defect = TRUE ทันที (Auto-Fail แม้คะแนนรวมจะถึง 85%)"]
    
    CheckCritical -->|"ไม่มีข้อวิกฤตตก"| CheckPassingPercent{"คะแนนรวม >= PassingScore 85%?"}
    
    CheckPassingPercent -->|"ใช่"| PassAudit["กำหนด is_passed = TRUE: ผ่านเกณฑ์มาตรฐาน"]
    CheckPassingPercent -->|"ไม่ใช่"| NormalFail["กำหนด is_passed = FALSE: คะแนนไม่ถึงเกณฑ์"]
    
    ForceFail --> IterateResponses["วนตรวจสอบคำตอบทุกข้อใน AUDIT_RESPONSES"]
    PassAudit --> IterateResponses
    NormalFail --> IterateResponses
    
    IterateResponses --> CheckDefect{"มีข้อที่ไม่ผ่าน (is_passed = FALSE และ is_na = FALSE) ไหม?"}
    
    CheckDefect -->|"ผ่านทุกข้อ ไม่มีข้อบกพร่อง"| NoCap["บันทึกผลสำเร็จ ไม่ต้องเปิดตั๋ว CAP"]
    
    CheckDefect -->|"พบข้อไม่ผ่าน / Critical"| AutoCreateCap["สร้างตั๋วงานแก้ไข CAP_TASKS อัตโนมัติ"]
    
    AutoCreateCap --> SetCapFields["กำหนด: AuditRecordId, AuditResponseId, IssueItem, Status='OPEN'"]
    SetCapFields --> SetDeadline["คำนวณ SubmissionDeadline ตามข้อกำหนด เช่น ภายใน 3-7 วัน"]
    SetDeadline --> AssignStore["มอบหมาย AssignedTo ไปยังผู้รับตรวจ (ผู้จัดการสาขา)"]
    
    AssignStore --> NotifyAuditee["ส่งแจ้งเตือนไปยังผู้จัดการสาขาเพื่อเริ่มดำเนินการแก้ไข"]
    
    NotifyAuditee --> EndCapTrigger(["บันทึกผลตรวจและตั๋ว CAP สมบูรณ์"])
    NoCap --> EndCapTrigger

    style SubmitTrigger fill:#e0f2fe,stroke:#0284c7,stroke-width:2px
    style ForceFail fill:#fee2e2,stroke:#dc2626,stroke-width:3px
    style AutoCreateCap fill:#fee2e2,stroke:#dc2626,stroke-width:2px
    style EndCapTrigger fill:#dcfce7,stroke:#16a34a,stroke-width:2px
```

---

## Case 4: ลูปการแก้ไขข้อบกพร่องและห้องแชทอนุมัติ CAP (CAP Chat Remediation Workflow)
> **ผู้ใช้งาน:** ผู้จัดการสาขา (Auditee) ➔ เจ้าหน้าที่ QA / Auditor  
> **ตารางที่เกี่ยวข้อง:** `CAP_TASKS`, `CAP_TASK_IMAGES`, `CAP_TASK_COMMENTS`, `AUDIT_RESPONSE_IMAGES`

```mermaid
flowchart TD
    StartCAP(["เริ่มต้น: ผู้จัดการสาขาได้รับตั๋ว CAP (Status: OPEN)"]) --> ViewDetail["เปิดดูรายละเอียดข้อบกพร่องและรูปภาพตอนตรวจ (ดึงรูป BEFORE จาก AUDIT_RESPONSE_IMAGES ตรงๆ)"]
    
    ViewDetail --> BranchAction["สาขาดำเนินการปรับปรุงแก้ไขหน้างานจริง"]
    BranchAction --> TakePhoto["ถ่ายรูปหลักฐานหลังปรับปรุงเสร็จ"]
    
    TakePhoto --> UploadAfterImg[("อัปโหลดรูปลง Storage และบันทึกลง CAP_TASK_IMAGES")]
    UploadAfterImg --> ChatMsg[("พิมพ์ข้อความชี้แจงลง CAP_TASK_COMMENTS")]
    
    ChatMsg --> SubmitCapBtn["ผู้จัดการสาขากดปุ่ม 'ส่งมอบงานแก้ไข'"]
    SubmitCapBtn --> UpdateStatusSub[("อัปเดต CAP_TASKS: Status = 'SUBMITTED'")]
    
    UpdateStatusSub --> QAReview["เจ้าหน้าที่ QA / ผู้ตรวจ เปิดห้องแชทตรวจสอบหลักฐานเรียงตามเวลา"]
    
    QAReview --> QAInspect{"ผลการแก้ไขถูกต้องตามมาตรฐานหรือไม่?"}
    
    QAInspect -->|"ยังไม่เรียบร้อย / รูปไม่ชัด"| RejectAction["QA พิมพ์คอมเมนต์แจ้งจุดที่ต้องแก้เพิ่มในแชท"]
    RejectAction --> StatusRejected[("อัปเดต Status = 'REJECTED'")]
    StatusRejected --> NotifyBranchReject["ส่งแจ้งเตือนกลับไปยังสาขาให้แก้ไขซ้ำ (แสดงประวัติแชทต่อเนื่อง)"]
    NotifyBranchReject --> BranchAction
    
    QAInspect -->|"ผ่านเกณฑ์สมบูรณ์"| ApproveAction["QA กดปุ่ม 'อนุมัติและปิดงานแก้ไข'"]
    ApproveAction --> StatusClosed[("อัปเดต Status = 'CLOSED' ทันที")]
    StatusClosed --> RecordVerifier["บันทึก VerifiedBy และ ClosedAt"]
    RecordVerifier --> EndCAP(["ปิดตั๋วงานแก้ไข CAP สมบูรณ์ 100%"])

    style StartCAP fill:#fee2e2,stroke:#dc2626,stroke-width:2px
    style UpdateStatusSub fill:#fef3c7,stroke:#d97706,stroke-width:2px
    style StatusRejected fill:#fee2e2,stroke:#ef4444,stroke-width:2px
    style StatusClosed fill:#dcfce7,stroke:#16a34a,stroke-width:2px
    style EndCAP fill:#dcfce7,stroke:#16a34a,stroke-width:2px
```

---

## Case 5: การจัดการสิทธิ์ รีเซ็ตรหัสผ่าน และประเภทสถานที่ของ Admin (Admin Management Workflow)
> **ผู้ใช้งาน:** ผู้ดูแลระบบ (Admin)  
> **ตารางที่เกี่ยวข้อง:** `ROLES`, `PERMISSIONS`, `ROLE_PERMISSIONS`, `USERS`, `USER_LOCATIONS`, `LOCATIONS`, `LOCATION_TYPES`, `SURVEY_FORMS`

```mermaid
flowchart TD
    AdminLogin(["Admin เข้าสู่เมนูจัดการระบบ"]) --> AdminChoice{"เลือกฟังก์ชันที่ต้องการจัดการ"}
    
    %% สายที่ 1: จัดการบทบาทและสิทธิ์
    AdminChoice -->|"1. จัดการบทบาท (Roles)"| RoleMgmt["หน้าต่างจัดการ ROLES"]
    RoleMgmt --> CreateRole["สร้าง Role ใหม่ เช่น 'ผู้จัดการเขต Area QA'"]
    CreateRole --> CheckboxPerms["ติ๊กเลือก Checkbox สิทธิ์ตามหมวดหมู่ module"]
    CheckboxPerms --> SaveRolePerms[("บันทึกลง ROLE_PERMISSIONS")]
    
    %% สายที่ 2: จัดการผู้ใช้งานและรีเซ็ตรหัสผ่าน
    AdminChoice -->|"2. จัดการผู้ใช้ (Users)"| UserMgmt["หน้าต่างจัดการ USERS"]
    UserMgmt --> UserActionChoice{"เลือกการกระทำ"}
    
    UserActionChoice -->|"เพิ่มผู้ใช้ใหม่"| CreateUser["กรอก Username, รหัสผ่านเริ่มต้น, ชื่อ-นามสกุล, must_change_password = TRUE"]
    CreateUser --> ChooseScope{"เลือกขอบเขตสาขา Branch Scope"}
    ChooseScope -->|"ทุกสาขา"| ScopeAll["กำหนด branch_scope = 'ALL'"]
    ChooseScope -->|"เฉพาะสาขา (1 หรือหลายสาขา)"| ScopeSpecific["กำหนด branch_scope = 'SPECIFIC' และเลือกสาขาลง USER_LOCATIONS"]
    ScopeAll --> SaveUser[("บันทึกผู้ใช้ลงตาราง USERS")]
    ScopeSpecific --> SaveUser
    
    UserActionChoice -->|"รีเซ็ตรหัสผ่าน (Reset Password)"| ResetPwd["กดปุ่ม 'รีเซ็ตรหัสผ่าน' ที่บัญชีผู้ใช้"]
    ResetPwd --> InputNewPwd["กำหนดรหัสผ่านชั่วคราว + ตั้ง must_change_password = TRUE"]
    InputNewPwd --> SaveNewPwd[("อัปเดต password_hash ในตาราง USERS")]
    
    %% สายที่ 3: จัดการประเภทสถานที่ (Location Types)
    AdminChoice -->|"3. จัดการประเภทสถานที่"| LocTypeMgmt["หน้าต่างจัดการ LOCATION_TYPES"]
    LocTypeMgmt --> AddLocType["กดปุ่ม '➕ เพิ่มประเภทใหม่' เช่น ครัวกลาง (Cloud Kitchen)"]
    AddLocType --> SaveLocType[("บันทึกลงตาราง LOCATION_TYPES")]
    SaveLocType --> ShowDropdown["ประเภทใหม่จะโผล่ใน Dropdown หน้าสร้างสาขาอัตโนมัติ"]

    %% สายที่ 4: จัดการเวอร์ชันแบบฟอร์ม (Form Lineage)
    AdminChoice -->|"4. จัดการและแก้ไขแบบฟอร์ม"| FormMgmt["หน้าต่างจัดการ SURVEY_FORMS"]
    FormMgmt --> EditFormCheck{"ฟอร์มนี้เคยถูกใช้ตรวจไปแล้วหรือยัง?"}
    EditFormCheck -->|"ยังไม่เคยใช้ตรวจ"| DirectUpdate["อนุญาตให้ Update ข้อความคำถามทับได้โดยตรง"]
    EditFormCheck -->|"เคยใช้ตรวจแล้ว (มี AUDIT_RECORDS อ้างอิง)"| LineageUpdate["🔒 บังคับสร้างเวอร์ชันใหม่: ฟอร์มเดิม is_latest = FALSE, INSERT ฟอร์มใหม่ form_group_id เดิม"]
    DirectUpdate --> SaveForm[("บันทึกลง SURVEY_FORMS & SURVEY_ITEMS")]
    LineageUpdate --> SaveForm
    
    %% การเข้าใช้งานจริง
    SaveUser --> UserLogin["ผู้ใช้ทำการ Login เข้าสู่ระบบ"]
    SaveNewPwd --> UserLogin
    UserLogin --> CheckMustChange{"must_change_password == TRUE?"}
    CheckMustChange -->|"ใช่"| ForceChangePwdScreen["บังคับเปิดหน้าต่างตั้งรหัสผ่านใหม่ก่อนเข้าสู่ระบบ"]
    ForceChangePwdScreen --> SetNewPwd["ผู้ใช้ตั้งรหัสผ่านใหม่ส่วนตัว ➔ must_change_password = FALSE"]
    SetNewPwd --> TokenGen["ระบบสร้าง JWT Token พร้อม Roles, Permissions, Scope"]
    CheckMustChange -->|"ไม่ใช่"| TokenGen
    
    TokenGen --> RenderUI["Frontend ตรวจสอบสิทธิ์"]
    RenderUI --> FilterMenu["แสดงเฉพาะเมนูที่ได้รับสิทธิ์ตาม PERMISSIONS"]
    RenderUI --> FilterBranch["แสดงเฉพาะสาขาตาม branch_scope และ USER_LOCATIONS"]
    
    FilterMenu --> EndRBAC(["ผู้ใช้เข้าถึงระบบตามสิทธิ์ที่ถูกต้อง 100%"])
    FilterBranch --> EndRBAC
    ShowDropdown --> EndRBAC
    SaveForm --> EndRBAC

    style AdminLogin fill:#e0f2fe,stroke:#0284c7,stroke-width:2px
    style SaveRolePerms fill:#dcfce7,stroke:#16a34a,stroke-width:2px
    style SaveUser fill:#dcfce7,stroke:#16a34a,stroke-width:2px
    style LineageUpdate fill:#fef3c7,stroke:#d97706,stroke-width:2px
    style ForceChangePwdScreen fill:#fee2e2,stroke:#dc2626,stroke-width:2px
    style EndRBAC fill:#dcfce7,stroke:#16a34a,stroke-width:2px
```

---
*เอกสารผังงานกระบวนการนี้จัดทำขึ้นเพื่อใช้อ้างอิงการทำงานของทุกเคสในระบบ Q.S.C. System*
