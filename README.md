# Chi Tiêu Tracker

Ứng dụng web theo dõi chi tiêu theo tháng, gắn với **hạn mức**, **danh mục**, **hũ chi tiêu** (phân bổ theo “phong bì”), **khoản cố định** và tùy chọn **Credit Card**. Giao diện tiếng Việt, tối ưu mobile; dữ liệu lưu cục bộ (schema **v3**) và có thể **đồng bộ cloud** qua Supabase.

Đặc tả chi tiết từng tính năng: **[features.md](./features.md)**.

---

## Mục đích

Giúp người dùng **ghi lại từng khoản chi**, nhìn **tổng quan tháng** (đã chi so với hạn mức, số còn lại), **phân tích theo hũ / ngày / chu kỳ thẻ**, và **lặp lại các khoản cố định** khi sang tháng mới — không cần bảng tính hay app phức tạp.

---

## Đối tượng sử dụng

- **Cá nhân hoặc hộ gia đình** muốn kiểm soát chi tiêu hàng tháng bằng một con số hạn mức rõ ràng.
- Người quen dùng **VND**, nhập nhanh bằng **nghìn đồng** hoặc dán số đầy đủ (ví dụ `25.000.000`).
- Ai cần **nhiều tháng** lịch sử, **backup JSON**, và **đồng bộ giữa các thiết bị** (sau khi đăng nhập).

---

## Giá trị mang lại

| Giá trị | Mô tả ngắn |
|--------|------------|
| **Tự chủ dữ liệu** | Dữ liệu lưu trên trình duyệt (`localStorage`); export/import JSON; có thể bật đồng bộ cloud. |
| **Tư duy ngân sách** | Hạn mức tháng + hũ có giới hạn giúp thấy chỗ “tràn” sớm. |
| **Ít thao tác** | Thêm chi nhanh, gợi ý tên, lọc cố định / linh hoạt / theo ngày, báo cáo trực quan. |
| **Dự báo phân bổ** | Ước tính chi tiêu trung bình theo ngày/tuần (theo hạn mức và theo số tiền còn lại). |
| **Linh hoạt** | Danh mục và hũ tùy chỉnh; theme giao diện; PWA có thể “cài” như app trên màn hình chính. |

---

## Tính năng trong ứng dụng

### Màn hình tháng

- **Tiêu đề tháng**; URL hỗ trợ `?thang=YYYY-MM` (chia sẻ / bookmark tháng).
- **Menu bên** (trượt từ trái): ~60 tháng gần nhất (mới trước), trạng thái có/không dữ liệu, tổng chi; **vuốt** để xóa dữ liệu một tháng.
- **Đi tới tháng khác**: chọn `month` + nút «Mở tháng».
- **Tổng quan**: **Hạn mức**, **Đã chi**, **Còn lại** (định dạng ₫).
- **Chỉnh hạn mức tháng**: nhập **nghìn đồng** (×1.000); preview; chế độ xem / sửa (bút chì → xong / hủy).
- **Dự báo (icon i)**: trung bình/ngày và /tuần theo hạn mức tháng; phân bổ **số còn lại** theo ngày/tuần còn lại trong tháng.

### Thêm & quản lý khoản chi

- Form **Thêm khoản chi**:
  - **Tên khoản** (tùy chọn) — **gợi ý** từ 30 ngày gần nhất, cùng danh mục, sort theo tần suất.
  - **Danh mục** (bắt buộc).
  - **Số tiền** (nghìn đồng), có **preview** khi nhập.
  - **Cố định**: tạo mẫu lặp hàng tháng (tháng hiện tại/tương lai tự sinh khoản).
  - **Credit card** (khi bật trong Cài đặt): đánh dấu chi qua thẻ.
  - **Nâng cao**: **Ngày** + **Giờ** chi (một dòng; mặc định hôm nay).
- **Danh sách chi tiêu**:
  - Lọc **All / Cố định / Linh hoạt**.
  - Lọc **theo ngày** (lưới ngày trong tháng); thêm mới tự căn lọc theo ngày khoản; **sửa không đổi** bộ lọc ngày.
  - Tag **CĐ** cho cố định; dấu `*` nếu chưa chỉnh trong tháng.
  - **Sửa** qua modal (danh mục, tên, tiền, ngày/giờ, cố định, CC).
  - **Vuốt trái** để xóa (mobile).
- Trạng thái trống khi chưa có khoản chi.

### Hũ chi tiêu

- Hũ do bạn tạo trong **Cài đặt**: tên, màu (icon lợn), hạn mức, danh mục gắn kèm.
- Mỗi danh mục chỉ thuộc **một hũ**; gán qua picker **icon lợn + màu** (không dropdown thuần).
- Danh mục **chưa gắn hũ** gom vào hũ ảo **«Khác»** (chỉ hiển thị, không tạo thủ công).
- Khoản chi tự cộng vào hũ theo danh mục — không cần chọn hũ khi nhập.

### Báo cáo

Hai chế độ (tab):

- **Hũ**: biểu đồ tròn + danh sách tiến độ từng hũ; expand **hũ → danh mục → khoản chi** (3 cấp, inline). Khoản cùng tên được gộp; hiển thị tag **CĐ**, không hiện ngày/giờ.
- **Theo ngày**: phạm vi **Tháng này** hoặc **7 ngày**; biểu đồ cột; bấm cột → chi tiết khoản trong ngày.

### Báo cáo Credit Card (khi bật)

- Chu kỳ theo **ngày sao kê** (hạn thanh toán = chốt + 15 ngày).
- Tổng quan kỳ trước / kỳ hiện tại, đánh dấu **Đã thanh toán**.
- Pie theo danh mục, xu hướng tích lũy, danh sách giao dịch kỳ hiện tại (lọc khoản lớn > 1 triệu).

### Cài đặt

- **Hạn mức mặc định**: cho tháng chưa chỉnh riêng; UI xem (nhãn + sửa) / edit (input + ✓/✕).
- **Credit Card**: bật/tắt, chọn ngày sao kê.
- **Giao diện**: Dark, Light, Blue, Mint, Purple, Pink Pastel, Gray.
- **Danh mục**: thêm / sửa (tên, emoji, hũ) / xóa / kéo đổi thứ tự; giữ ít nhất một danh mục.
- **Hũ**: thêm / sửa modal (Lưu trên Hủy) / xóa / kéo đổi thứ tự.
- **Khoản cố định**: quản lý mẫu đồng bộ với khoản đánh dấu cố định khi nhập.
- **Dữ liệu**: **Export** JSON (chọn tháng + config); **Import** ghi đè local; **Xóa toàn bộ** (xác nhận kép).

### Menu tháng & đồng bộ

- **Đăng nhập** để đồng bộ (Supabase; tài khoản tạo sẵn phía backend).
- **Đồng bộ cloud**: merge local + remote theo timestamp; Realtime; flush trước khi đóng tab.
- Sau **import** backup: có thể ghi đè cloud bằng file vừa nhập.

### Kỹ thuật & trải nghiệm

| Hạng mục | Chi tiết |
|----------|----------|
| **Stack** | HTML, CSS, JS thuần — không build step |
| **Lưu trữ** | `localStorage` key `family-budget-v3`; chi theo `days[YYYY-MM-DD]`, meta tháng `months[YYYY-MM]` |
| **Migration** | Tự phát hiện dữ liệu v2 → dialog migrate sang v3 (nên export backup trước) |
| **PWA** | `site.webmanifest`, standalone, icon 192/512 |
| **Tiền tệ** | Nghìn đồng hoặc dán VND đầy đủ; hiển thị ₫ |
| **CDN** | Supabase JS client, font **Be Vietnam Pro** |

---

## Cấu trúc project

```
├── index.html          # UI
├── app.js              # Logic, lưu trữ, sync
├── styles.css          # Giao diện
├── site.webmanifest    # PWA
├── features.md         # Đặc tả tính năng chi tiết
├── assets/icons/       # Favicon & icon PWA
└── README.md
```

---

## Chạy thử nhanh

Mở `index.html` trong trình duyệt hoặc phục vụ thư mục bằng static server:

```bash
npx serve .
```

Đồng bộ cloud cần Supabase hợp lệ (URL/key trong `app.js` hoặc ghi đè qua `window.SUPABASE_URL` / `window.SUPABASE_PUBLISHABLE_KEY` khi tự host).

---

## Tài liệu liên quan

- **[features.md](./features.md)** — đặc tả đầy đủ: schema v3, luồng dữ liệu, quy tắc merge cloud, drill-down báo cáo, Credit Card, export/import, v.v.
