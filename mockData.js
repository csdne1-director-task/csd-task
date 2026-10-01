/**
 * Mock Data สำหรับเปิดเทสหน้าเว็บบนเครื่อง Localhost ได้ทันทีโดยไม่ต้องต่อเน็ต/ชีท
 */
const MOCK_INITIAL_DATA = {
  status: "success",
  visitorCount: 1250,
  scriptOwnerEmail: "admin.pea@gmail.com",
  settings: {
    APP_TITLE: "ร่วมใจขับเคลื่อน กฟฉ.1",
    APP_SUBTITLE: "NE1 Enablers Monitoring Tool",
    ANNOUNCEMENT_TEXT: "ยินดีต้อนรับสู่ระบบติดตามและรายงานภารกิจ กฟฉ.1 ประจำปี 2569",
    ANNOUNCEMENT_ENABLED: "TRUE",
    HEADER_LINK_TITLE: "เว็บไซต์ฝ่าย กฟฉ.1",
    HEADER_LINK_URL: "https://pea.co.th",
    FOOTER_TEXT: "การไฟฟ้าส่วนภูมิภาค เขต 1 (ภาคตะวันออกเฉียงเหนือ) จังหวัดอุดรธานี",
    DEPARTMENTS: "แผนกบริหารยุทธศาสตร์, แผนกปฏิบัติการและบำรุงรักษา, แผนกบริการลูกค้า, แผนกวิศวกรรม, แผนกความปลอดภัย, แผนกบัญชีและการเงิน",
    departmentList: [
      "แผนกบริหารยุทธศาสตร์",
      "แผนกปฏิบัติการและบำรุงรักษา",
      "แผนกบริการลูกค้า",
      "แผนกวิศวกรรม",
      "แผนกความปลอดภัย",
      "แผนกบัญชีและการเงิน"
    ],
    CATEGORIES: "งานประจำตามแผนงาน, โครงการพิเศษ, รายงานตัวชี้วัด (KPI), แบบสำรวจ/ประเมิน, การพัฒนาทักษะ (Learning)",
    categoryList: [
      "งานประจำตามแผนงาน",
      "โครงการพิเศษ",
      "รายงานตัวชี้วัด (KPI)",
      "แบบสำรวจ/ประเมิน",
      "การพัฒนาทักษะ (Learning)"
    ],
    DRIVE_FOLDER_ID: "1_0_Hx4jJG1L7g3J87W8HLP-3g1Ppv6_b",
    DIRECTOR_PIN: "9999",
    ADMIN_PIN: "1234",
    LINE_TOKEN: "",
    LINE_GROUP_ID: ""
  },
  tasks: [
    {
      id: "T-1001",
      taskName: "รายงานสรุปตัวชี้วัดความพร้อมของระบบจำหน่ายไฟฟ้า ประจำไตรมาส 3",
      department: "แผนกปฏิบัติการและบำรุงรักษา",
      category: "รายงานตัวชี้วัด (KPI)",
      startDate: "01/10/2026",
      endDate: "05/10/2026",
      endDateRaw: new Date(2026, 9, 5).getTime(),
      priority: "🔥 ด่วนที่สุด",
      status: "กำลังดำเนินการ",
      progress: 75,
      actionLink: "https://drive.google.com/drive/folders/1_0_Hx4jJG1L7g3J87W8HLP-3g1Ppv6_b",
      docLink: "",
      directorNote: "ผอ. ขอให้เน้นสถิติ SAIFI/SAIDI ในพื้นที่เขตเศรษฐกิจสำคัญ",
      isPublished: true
    },
    {
      id: "T-1002",
      taskName: "สำรวจความพึงพอใจการให้บริการลูกค้า ภาคธุรกิจและอุตสาหกรรม",
      department: "แผนกบริการลูกค้า",
      category: "แบบสำรวจ/ประเมิน",
      startDate: "01/10/2026",
      endDate: "15/10/2026",
      endDateRaw: new Date(2026, 9, 15).getTime(),
      priority: "⚡ สำคัญ",
      status: "รอดำเนินการ",
      progress: 30,
      actionLink: "https://forms.google.com",
      docLink: "",
      directorNote: "เตรียมข้อมูลนำเสนอในที่ประชุม ผจก. ประจำเดือน",
      isPublished: true
    },
    {
      id: "T-1003",
      taskName: "จัดทำแผนซักซ้อมความปลอดภัยและการดับเพลิงประจำปี 2569",
      department: "แผนกความปลอดภัย",
      category: "งานประจำตามแผนงาน",
      startDate: "15/09/2026",
      endDate: "30/09/2026",
      endDateRaw: new Date(2026, 8, 30).getTime(),
      priority: "🔥 ด่วนที่สุด",
      status: "ล่าช้า",
      progress: 40,
      actionLink: "https://drive.google.com/drive/folders/1_0_Hx4jJG1L7g3J87W8HLP-3g1Ppv6_b",
      docLink: "",
      directorNote: "เลยกำหนดส่งแล้ว ขอให้หัวหน้าแผนกเร่งสรุปส่งด่วน",
      isPublished: true
    },
    {
      id: "T-1004",
      taskName: "โครงการฝึกอบรม AI และระบบอัตโนมัติสำหรับพนักงาน กฟฉ.1",
      department: "แผนกบริหารยุทธศาสตร์",
      category: "การพัฒนาทักษะ (Learning)",
      startDate: "01/10/2026",
      endDate: "25/10/2026",
      endDateRaw: new Date(2026, 9, 25).getTime(),
      priority: "📌 ปกติ",
      status: "กำลังดำเนินการ",
      progress: 60,
      actionLink: "",
      docLink: "https://pea.co.th",
      directorNote: "ประสานวิทยากรเรียบร้อยแล้ว",
      isPublished: true
    },
    {
      id: "T-1005",
      taskName: "ตรวจสอบและปรับปรุงสถานะสินทรัพย์อุปกรณ์ไฟฟ้า ประจำปี",
      department: "แผนกบัญชีและการเงิน",
      category: "งานประจำตามแผนงาน",
      startDate: "01/09/2026",
      endDate: "28/09/2026",
      endDateRaw: new Date(2026, 8, 28).getTime(),
      priority: "📌 ปกติ",
      status: "เสร็จสิ้น",
      progress: 100,
      actionLink: "",
      docLink: "https://pea.co.th",
      directorNote: "เสร็จสมบูรณ์เรียบร้อย",
      isPublished: true
    }
  ]
};
