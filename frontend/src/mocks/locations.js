export const INITIAL_UNITS = [
  { 
    name: "สาขาสยาม", fullName: "สาขาสยามพารากอน", distance: "0.4 กม.", region: "กรุงเทพฯ ตอนกลาง", lastScore: 76, 
    address: "989 ถ.พระราม 1 แขวงปทุมวัน เขตปทุมวัน กรุงเทพฯ", phone: "02-123-4567",
    history: [
      { date: "18 ส.ค. 2569", score: 76, auditor: "สมชาย ใจดี", status: "Action Required" },
      { date: "15 ก.ค. 2569", score: 88, auditor: "วิภา ทองคำ", status: "Passed" },
      { date: "2 มิ.ย. 2569", score: 71, auditor: "สมชาย ใจดี", status: "Action Required" },
      { date: "20 เม.ย. 2569", score: 80, auditor: "อรทัย พรหมมา", status: "Action Required" }
    ] 
  },
  { 
    name: "สาขาอารีย์", fullName: "สาขาอารีย์ ซอย 4", distance: "1.2 กม.", region: "กรุงเทพฯ เหนือ", lastScore: 91, 
    address: "12 ซ.อารีย์ 4 แขวงพญาไท เขตพญาไท กรุงเทพฯ", phone: "02-234-5678",
    history: [
      { date: "19 ส.ค. 2569", score: 91, auditor: "วิภา ทองคำ", status: "Passed" },
      { date: "10 ก.ค. 2569", score: 85, auditor: "วิภา ทองคำ", status: "Passed" },
      { date: "1 มิ.ย. 2569", score: 90, auditor: "สมชาย ใจดี", status: "Passed" }
    ] 
  },
  { 
    name: "สาขาเซ็นทรัลลาดพร้าว", fullName: "สาขาเซ็นทรัลพลาซา ลาดพร้าว", distance: "3.8 กม.", region: "กรุงเทพฯ เหนือ", lastScore: 58, 
    address: "1693 ถ.พหลโยธิน แขวงจตุจักร เขตจตุจักร กรุงเทพฯ", phone: "02-345-6789",
    history: [
      { date: "14 ส.ค. 2569", score: 58, auditor: "อรทัย พรหมมา", status: "Critical" },
      { date: "5 ก.ค. 2569", score: 62, auditor: "อรทัย พรหมมา", status: "Critical" },
      { date: "28 พ.ค. 2569", score: 55, auditor: "ณัฐวุฒิ ศรีสุข", status: "Critical" }
    ] 
  },
  { 
    name: "สาขาทองหล่อ 13", fullName: "สาขาทองหล่อ 13 มาร์เก็ต", distance: "2.1 กม.", region: "กรุงเทพฯ ตะวันออก", lastScore: 82, 
    address: "88 ซ.ทองหล่อ 10 แขวงคลองตันเหนือ เขตวัฒนา กรุงเทพฯ", phone: "02-456-7890",
    history: [
      { date: "9 ส.ค. 2569", score: 82, auditor: "ณัฐวุฒิ ศรีสุข", status: "Action Required" },
      { date: "2 ก.ค. 2569", score: 79, auditor: "สมชาย ใจดี", status: "Action Required" }
    ] 
  },
  { 
    name: "สาขาเชียงใหม่ นิมมาน", fullName: "สาขานิมมานเหมินท์ ซอย 9", distance: "145 กม.", region: "ภาคเหนือ", lastScore: 69, 
    address: "22 ถ.นิมมานเหมินท์ ต.สุเทพ อ.เมือง จ.เชียงใหม่", phone: "053-123-456",
    history: [
      { date: "3 ส.ค. 2569", score: 69, auditor: "กริช พร้อมพันธุ์", status: "Action Required" },
      { date: "20 มิ.ย. 2569", score: 73, auditor: "กริช พร้อมพันธุ์", status: "Action Required" }
    ] 
  },
  { 
    name: "โรงงานบางนา", fullName: "โรงงานผลิตและคลังสินค้าบางนา", distance: "12 กม.", region: "กรุงเทพฯ ตะวันออก", lastScore: 95, 
    address: "199 ถ.บางนา-ตราด กม.14 ต.บางแก้ว อ.บางพลี สมุทรปราการ", phone: "02-567-8901",
    history: [
      { date: "21 ส.ค. 2569", score: 95, auditor: "สมชาย ใจดี", status: "Passed" },
      { date: "1 ก.ค. 2569", score: 93, auditor: "สมชาย ใจดี", status: "Passed" }
    ] 
  },
  { 
    name: "สาขาเซ็นทรัลเวิลด์", fullName: "สาขาเซ็นทรัลเวิลด์ ชั้น 6", distance: "0.8 กม.", region: "กรุงเทพฯ ตอนกลาง", lastScore: 89, 
    address: "999/9 ถ.พระราม 1 แขวงปทุมวัน เขตปทุมวัน กรุงเทพฯ", phone: "02-646-1234",
    history: [
      { date: "12 ส.ค. 2569", score: 89, auditor: "วิภา ทองคำ", status: "Passed" },
      { date: "14 ก.ค. 2569", score: 92, auditor: "วิภา ทองคำ", status: "Passed" }
    ] 
  },
  { 
    name: "สาขาไอคอนสยาม", fullName: "สาขาไอคอนสยาม ริมแม่น้ำ", distance: "4.5 กม.", region: "กรุงเทพฯ ใต้", lastScore: 94, 
    address: "299 ถ.เจริญนคร แขวงคลองต้นไทร เขตคลองสาน กรุงเทพฯ", phone: "02-495-7000",
    history: [
      { date: "17 ส.ค. 2569", score: 94, auditor: "สมชาย ใจดี", status: "Passed" },
      { date: "10 ก.ค. 2569", score: 91, auditor: "สมชาย ใจดี", status: "Passed" }
    ] 
  },
  { 
    name: "สาขาเมกาบางนา", fullName: "สาขาเมกาบางนา ฟู้ดวอล์ค", distance: "15 กม.", region: "กรุงเทพฯ ตะวันออก", lastScore: 86, 
    address: "39 หมู่ 6 ถ.บางนา-ตราด ต.บางแก้ว อ.บางพลี สมุทรปราการ", phone: "02-105-1000",
    history: [
      { date: "8 ส.ค. 2569", score: 86, auditor: "ณัฐวุฒิ ศรีสุข", status: "Passed" }
    ] 
  },
  { 
    name: "สาขาพัทยา บีช", fullName: "สาขาเซ็นทรัลพัทยา บีช", distance: "120 กม.", region: "ภาคตะวันออก", lastScore: 78, 
    address: "333/99 หมู่ 9 ต.หนองปรือ อ.บางละมุง จ.ชลบุรี", phone: "038-932-555",
    history: [
      { date: "5 ส.ค. 2569", score: 78, auditor: "กริช พร้อมพันธุ์", status: "Action Required" }
    ] 
  },
  { 
    name: "สาขาขอนแก่น มะลิวัลย์", fullName: "สาขาขอนแก่น ถ.มะลิวัลย์", distance: "440 กม.", region: "ภาคตะวันออกเฉียงเหนือ", lastScore: 90, 
    address: "123 ถ.มะลิวัลย์ ต.ในเมือง อ.เมือง จ.ขอนแก่น", phone: "043-222-333",
    history: [
      { date: "1 ส.ค. 2569", score: 90, auditor: "อรทัย พรหมมา", status: "Passed" }
    ] 
  },
  { 
    name: "สาขาภูเก็ต ป่าตอง", fullName: "สาขาจังซีลอน ป่าตอง", distance: "850 กม.", region: "ภาคใต้", lastScore: 83, 
    address: "181 ถ.ราษฎร์อุทิศ 200 ปี ต.ป่าตอง อ.กะทู้ จ.ภูเก็ต", phone: "076-600-111",
    history: [
      { date: "28 ก.ค. 2569", score: 83, auditor: "สมชาย ใจดี", status: "Action Required" }
    ] 
  }
];
export const LOCATIONS = INITIAL_UNITS;
