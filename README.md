# Chi Tiêu Tracker

Ứng dụng web theo dõi chi tiêu theo tháng, gắn với **hạn mức**, **danh mục**, **hũ chi tiêu** (phân bổ theo “phong bì”) và **khoản cố định**. Giao diện tiếng Việt, tối ưu dùng trên điện thoại; dữ liệu lưu cục bộ và có tùy chọn **đồng bộ cloud** qua Supabase.

---

## Mục đích

Giúp người dùng **ghi lại từng khoản chi**, nhìn **tổng quan tháng** (đã chi so với hạn mức, số còn lại), **phân tích theo danh mục / hũ / ngày**, và **lặp lại các khoản cố định** (tiền nhà, bảo hiểm, v.v.) khi sang tháng mới — không cần bảng tính hay app phức tạp.

---

## Đối tượng sử dụng

- **Cá nhân hoặc hộ gia đình** muốn kiểm soát chi tiêu hàng tháng bằng một con số hạn mức rõ ràng.
- Người quen dùng **VND**, nhập nhanh bằng **nghìn đồng** hoặc dán số đầy đủ (ví dụ `25.000.000`).
- Ai cần **nhiều tháng** lịch sử và **đồng bộ giữa các thiết bị** (sau khi đăng nhập).

---

## Giá trị mang lại

| Giá trị | Mô tả ngắn |
|--------|------------|
| **Tự chủ dữ liệu** | Dữ liệu lưu trên trình duyệt (local); có thể bật đồng bộ cloud khi cần. |
| **Tư duy ngân sách** | Hạn mức tháng + hũ có giới hạn giúp thấy chỗ “tràn” sớm. |
| **Ít thao tác** | Thêm chi nhanh, lọc cố định / linh hoạt, báo cáo trực quan (biểu đồ). |
| **Dự báo phân bổ** | Ước tính chi tiêu trung bình theo ngày/tuần (theo hạn mức và theo số tiền còn lại). |
| **Linh hoạt** | Danh mục và hũ tùy chỉnh; theme giao diện; PWA có thể “cài” như app trên màn hình chính. |

---

## Tính năng trong ứng dụng

### Màn hình tháng

- **Tiêu đề tháng** và **menu bên** chứa danh sách các tháng đã có dữ liệu (mới nhất trước), **chọn tháng** để xem hoặc nhập.
- **Đi tới tháng khác**: chọn `month` + nút mở tháng tương ứng.
- **Tổng quan tháng**: **Hạn mức**, **Đã chi**, **Còn lại** (định dạng ₫).
- **Chỉnh hạn mức tháng**: nhập theo **nghìn đồng** (×1.000); có gợi ý dán số đầy đủ; nút sửa / xong / hủy.
- **Thông tin “i” (dự báo)**:
  - Dự kiến gắn với **hạn mức ban đầu**: trung bình/ngày và /tuần trong tháng.
  - Dự kiến cho **số tiền còn lại**: phân bổ theo **ngày và tuần còn lại** trong tháng.

### Thêm & quản lý khoản chi

- Form **Thêm khoản chi**:
  - **Tên khoản** (tùy chọn).
  - **Danh mục** (bắt buộc).
  - **Số tiền** (nghìn đồng), có **preview** khi nhập.
  - **Cố định**: tháng sau tự có khoản tương tự; đổi số tiền trong danh sách chi có thể cập nhật mặc định tháng sau (theo gợi ý trong app).
  - **Nâng cao**: **Ngày chi** (mặc định theo tháng đang xem).
- **Danh sách chi tiêu**:
  - Lọc **All / Cố định / Linh hoạt**.
  - **Sửa** khoản qua hộp thoại (danh mục, tên, số tiền, ngày, cố định).
  - **Vuốt** (mobile) để lộ nút xóa tương tự pattern swipe-to-delete trên danh sách.
- Trạng thái **Chưa có khoản chi** khi danh sách trống.

### Hũ chi tiêu (tháng này)

- Khối **Hũ chi tiêu (tháng này)** (hiển thị khi có cấu hình phù hợp): tổng chi theo từng **hũ** do bạn tạo trong Cài đặt.
- Danh mục **chưa gắn hũ** được gom vào hũ ảo **“Tổng hợp”**.

### Báo cáo phân bổ chi tiêu tháng

- Chế độ **Biểu đồ**: biểu đồ **tròn** theo **danh mục**, kèm **chú giải**.
- Chế độ **Hũ**: biểu đồ tròn theo **hũ**; có thể **chạm vào một hũ** để **xem chi tiết phân rã theo danh mục trong hũ**, và **quay lại** “Tất cả hũ”.
- Chế độ **Theo ngày**:
  - Phạm vi **Tháng này** hoặc **7 ngày**.
  - Biểu đồ **cột** theo ngày + **đường xu hướng** (SVG); tooltip / nhãn ngắn trên cột.

### Cài đặt

- **Hạn mức chi tiêu mặc định**: áp cho các tháng **chưa** chỉnh hạn mức riêng; tháng đã chỉnh giữ nguyên.
- **Giao diện**: chọn **bộ màu** — Dark, Light, Blue, Mint, Purple, Pink Pastel, Gray.
- **Danh mục chi tiêu**:
  - Danh sách mặc định có sẵn; **thêm**, **sửa** (tên + **biểu tượng** emoji có sẵn), **xóa** (phải còn ít nhất một danh mục; khi xóa, khoản chi chuyển sang danh mục còn lại đầu tiên).
- **Quản lý Hũ chi tiêu**:
  - **Tên**, **màu** (swatches), **hạn mức** (nghìn đồng).
  - **Gắn danh mục** vào hũ (mỗi danh mục chỉ thuộc một hũ tại một thời điểm).
  - Thêm / sửa qua form và **modal sửa hũ**.
- **Khoản chi cố định**:
  - Danh sách **mẫu** đồng bộ với khoản đánh dấu cố định khi nhập chi.
  - Thêm / sửa trong Cài đặt; sửa có thể **cập nhật** các tháng đang dùng mẫu đó (theo logic app).

### Menu tháng & đồng bộ

- **Đăng nhập để đồng bộ**: hộp thoại email/mật khẩu (app **không** có đăng ký trong giao diện — chỉ tài khoản đã được tạo sẵn phía backend).
- **Đồng bộ cloud**: đẩy / kéo trạng thái với **Supabase**, có **merge** local và remote; khi đăng nhập có **đồng bộ** và **Realtime** để nhận thay đổi.
- Trạng thái văn bản: **đang dùng local** / gợi ý đồng bộ khi phù hợp.
- **Xóa toàn bộ dữ liệu một tháng** từ menu (có xác nhận); có thể dùng **vuốt** trên dòng tháng (tương tự danh sách chi).

### Kỹ thuật & trải nghiệm

- **Lưu trữ**: `localStorage` (phiên bản schema trong code).
- **PWA**: `site.webmanifest`, hiển thị **standalone**, icon cố định.
- **Tiền tệ**: nhập linh hoạt (nghìn đồng hoặc chuỗi giống VND); hiển thị **₫**.
- Phụ thuộc CDN: **Supabase JS client**, font Google **Be Vietnam Pro**.

---

## Chạy thử nhanh

Mở file `index.html` trong trình duyệt hoặc phục vụ thư mục project bằng bất kỳ **static server** nào (ví dụ `npx serve`). Đồng bộ cloud cần cấu hình Supabase hợp lệ (URL/key trong code hoặc ghi đè qua `window` nếu bạn tự host).
