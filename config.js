/**
 * Configuration & Environment Setup
 * สามารถสลับระหว่างโหมดต่อ API จริง กับโหมด Mock Data บนเครื่อง Localhost
 */
const APP_CONFIG = {
  // นำ Web App URL ที่ได้จากการ Deploy Google Apps Script มาใส่ที่นี่
  // รูปแบบ: https://script.google.com/macros/s/AKfycb.../exec
  GAS_API_URL: "https://script.google.com/macros/s/AKfycbzmA9yuSo310oRlhShT3d16ThkJ864m2onA7qcrvr0YyuwUXLqiBiAA8xzKzGeD-wJT/exec",
  
  // เปิดใช้ Mock Data อัตโนมัติเมื่อรันบนเครื่อง Local หรือเมื่อยังไม่ได้ใส่ URL จริง
  USE_MOCK_FALLBACK: true,

  // รหัสเริ่มต้นหากยังไม่ได้ตั้งค่าใน Sheet
  DEFAULT_DIRECTOR_PIN: "9999",
  DEFAULT_ADMIN_PIN: "1234",
  DEFAULT_DRIVE_FOLDER_ID: "1_0_Hx4jJG1L7g3J87W8HLP-3g1Ppv6_b"
};
