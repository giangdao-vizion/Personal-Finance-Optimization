# Chi Tiêu Tracker — Đặc tả tính năng

Tài liệu mô tả các tính năng và cách hoạt động của ứng dụng theo **code hiện tại** (`index.html`, `app.js`, `styles.css`). Cập nhật: schema dữ liệu **v3**, báo cáo **Hũ / Theo ngày**, **Credit Card**, đồng bộ **Supabase**.

---

## 1. Tổng quan

**Chi Tiêu Tracker** là PWA (Progressive Web App) theo dõi chi tiêu gia đình theo **tháng dương lịch**, chạy hoàn toàn trên trình duyệt (HTML/CSS/JS thuần).

| Khía cạnh | Mô tả |
|-----------|--------|
| Lưu trữ chính | `localStorage` key `family-budget-v3` |
| Đồng bộ tùy chọn | Supabase (bảng `family_budget_states`, id `shared-default`) |
| Đơn vị nhập liệu | **Nghìn đồng** (×1.000 VND) — xem mục 16 |
| Ngôn ngữ UI | Tiếng Việt |

**Hai màn hình chính**

- **Màn tháng** (`#view-month`): nhập chi, xem tổng quan, danh sách, báo cáo.
- **Cài đặt** (`#view-settings`): hạn mức mặc định, theme, danh mục, hũ, khoản cố định, Credit Card, backup dữ liệu.

**Menu phụ**

- **Side menu** (trượt từ trái): danh sách tháng, nhảy tháng, đăng nhập/đồng bộ cloud.

---

## 2. Mô hình dữ liệu (schema v3)

Dữ liệu app (`app`) gồm:

```
{
  schemaVersion: 3,
  dataUpdatedAt, configDataUpdatedAt, configNeedSync,
  months:  { "YYYY-MM": { income, incomeUserSet, dataUpdatedAt, needSync, deletedAt? } },
  days:    { "YYYY-MM-DD": { expenses: [...], dataUpdatedAt, needSync } },
  categories: [...],
  spendingJars: [...],
  fixedTemplates: [...],
  settings: { defaultLimit, themeMode, creditCard }
}
```

### 2.1. Chi tiêu theo ngày (`days`)

- Mỗi khoản chi nằm trong **shard ngày** `app.days["YYYY-MM-DD"].expenses`.
- Ngày của khoản xác định qua `dateTs` (Unix ms). Nếu thiếu, suy từ `id` hoặc gán ngày 01 của tháng khi migrate.
- Khi lưu tháng đang mở: `flushExpensesToDays` ghi `state.expenses` → các shard ngày tương ứng; xóa shard cũ trong tháng nếu khoản chuyển ngày.

### 2.2. Meta tháng (`months`)

- `income`: hạn mức chi tiêu tháng (VND).
- `incomeUserSet`: `true` nếu user đã chỉnh hạn mức tháng này (không dùng mặc định tự động).
- `deletedAt`: đánh dấu tháng đã xóa (soft delete meta).

### 2.3. Một khoản chi (`expense`)

| Trường | Ý nghĩa |
|--------|---------|
| `id` | Định danh duy nhất |
| `category` | Id danh mục |
| `name` | Tên tùy chọn (có thể trống → hiển thị tên danh mục) |
| `amount` | Số tiền VND (số nguyên) |
| `dateTs` | Thời điểm chi (tùy chọn) |
| `templateId` | Liên kết khoản cố định |
| `monthEdited` | Khoản cố định đã được chỉnh trong tháng này |
| `isCreditCard` | Đánh dấu chi qua thẻ (khi bật tính năng CC) |
| `deletedAt` | Soft delete — không hiển thị, vẫn giữ để merge/sync |
| `createdAt`, `updatedAt` | Timestamp |

### 2.4. Trạng thái UI tháng (`state`)

- Khi mở tháng: `state = buildMonthState(monthKey)` — gộp mọi khoản từ các `days` thuộc tháng.
- Trước lưu/sync: `flushActiveMonthIntoApp()` đẩy `state` ngược vào `months` + `days`.

### 2.5. Xóa mềm (tombstone)

- Xóa khoản, danh mục, hũ, mẫu cố định: gắn `deletedAt` thay vì xóa hẳn — phục vụ merge đa thiết bị.

---

## 3. Điều hướng và URL

### 3.1. Tham số `?thang=YYYY-MM`

- Mở app với tháng cụ thể, ví dụ `?thang=2026-05`.
- Đổi tháng → `history.pushState` cập nhật URL.
- Nút Back/Forward trình duyệt → khôi phục tháng từ history.
- Tham số không hợp lệ → bỏ qua, dùng tháng hiện tại.

### 3.2. Chuyển tháng

- **Side menu**: danh sách ~60 tháng gần nhất (mới trước), hoặc ô `type="month"` + nút «Mở tháng».
- Mỗi lần `openMonth(key)`:
  - Flush tháng cũ, load tháng mới.
  - Reset bộ lọc ngày, trạng thái expand báo cáo.
  - Gọi `syncFixedIntoMonth` (nếu tháng hiện tại/tương lai).
  - Nếu chưa `incomeUserSet` → áp `settings.defaultLimit`.

### 3.3. Cài đặt

- Nút bánh răng trên header tháng → ẩn màn tháng, hiện `#view-settings`.
- Nút đóng → quay lại tháng đang active (không đổi URL tháng).

---

## 4. Tổng quan tháng (Summary)

Thẻ **Tổng quan** hiển thị ba chỉ số:

| Chỉ số | Cách tính |
|--------|-----------|
| **Hạn mức** | `state.income` (VND) |
| **Đã chi** | Tổng `amount` mọi khoản chưa xóa trong tháng |
| **Còn lại** | Hạn mức − Đã chi (highlight đỏ nếu âm) |

### 4.1. Sửa hạn mức tháng

- Chế độ xem: số tiền + nút bút chì.
- Chế độ sửa: ẩn số, hiện ô nhập + preview + «Xong» / «Hủy».
- Lưu → `incomeUserSet = true` (tháng này không còn lấy mặc định tự động).
- Blur / Enter → lưu; Escape → hủy.

### 4.2. Dự báo phân bổ (icon **i** cạnh «Còn lại»)

Hai nhóm bảng:

1. **Dự kiến cho tháng** — trung bình/ngày và /tuần nếu chi đều **cả tháng** (theo số ngày trong tháng).
2. **Dự kiến chi tiêu còn lại** — trung bình/ngày và /tuần với số tiền **còn lại**, tính từ **hôm nay đến hết tháng** (hoặc từ đầu tháng nếu đang xem tháng tương lai).

Ghi chú động giải thích còn bao nhiêu ngày/tuần trong kỳ tính.

---

## 5. Thêm khoản chi

Form **Thêm khoản chi** (collapsible, mặc định mở):

| Trường | Quy tắc |
|--------|---------|
| Tên khoản | Tùy chọn, tối đa 120 ký tự |
| Danh mục | Bắt buộc, dropdown từ `categories` |
| Số tiền | Bắt buộc > 0, đơn vị nghìn đồng |
| **Cố định** | Tạo `fixedTemplate` + gắn `templateId` cho khoản |
| **Credit card** | Chỉ hiện khi bật trong Cài đặt; gắn `isCreditCard` |
| **Nâng cao → Ngày giờ** | `type="date"` + `type="time"` (bước 60s), một dòng; mặc định = hôm nay/giờ hiện tại |

**Sau khi lưu thành công**

- Form reset (tên, tiền, checkbox, ngày/giờ).
- **Bộ lọc ngày** danh sách chi tự căn theo **ngày của khoản vừa thêm** (`alignExpenseListDayFilterFromDayKey`).
- Lưu local ngay + đồng bộ cloud (nếu có).

### 5.1. Gợi ý tên khoản

- Khi **focus** ô tên (thêm hoặc sửa): dropdown gợi ý từ khoản **cùng danh mục** trong **30 ngày gần nhất**.
- Sắp xếp theo **tần suất** giảm dần, tie-break theo tên (locale `vi`).
- Đổi danh mục khi đang focus → refresh gợi ý.
- **Blur** → ẩn (delay ngắn để bấm được gợi ý).
- Bấm gợi ý → điền tên + ẩn list.

### 5.2. Preview số tiền

- Mọi ô «nghìn đồng» có dòng preview `= X ₫` khi nhập hợp lệ.

---

## 6. Danh sách chi tiêu

### 6.1. Hiển thị mỗi dòng

- Icon danh mục, tên (hoặc tên danh mục), số tiền.
- Khoản **cố định**: tag **CĐ**; nếu chưa chỉnh trong tháng (`!monthEdited`): dấu `*` — «Chưa chỉnh cho tháng này».
- Khoản **Credit card**: hiển thị tương ứng khi tính năng bật.
- Cuối list: hàng **Tổng chi (N khoản)** theo bộ lọc hiện tại.

### 6.2. Lọc loại khoản

Tab **All | Cố định | Linh hoạt**:

- **All**: mọi khoản.
- **Cố định**: có `templateId`.
- **Linh hoạt**: không có `templateId`.

### 6.3. Lọc theo ngày

- Nút **Ngày** → dialog chọn ngày trong tháng (lưới 1…31).
- Nút **✕** (bỏ lọc) — disabled khi chưa lọc.
- Chỉ hiển thị khoản có `dateTs` thuộc ngày đã chọn.
- **Sửa khoản** không đổi bộ lọc ngày (chỉ **thêm mới** mới căn lọc).

### 6.4. Sửa khoản

- Bấm dòng → modal sửa (tên, danh mục, tiền, ngày/giờ, cố định, CC).
- Lưu → cập nhật `state` + nếu có `templateId` thì cập nhật mẫu cố định và mọi bản sao tháng khác (`syncExpenseRowsFromTemplate`).
- Đánh dấu cố định mới từ modal: chỉ cho phép ở **tháng hiện tại hoặc tương lai**.

### 6.5. Xóa khoản — swipe

- Vuốt trái (~64px) → lộ nút xóa; xóa = soft delete (`deletedAt`).
- Vuốt một dòng → đóng swipe dòng khác.

### 6.6. Sắp xếp

- Theo `dateTs` giảm dần (mới trước), tie-break theo `id`.

---

## 7. Khoản chi cố định

### 7.1. Tạo

- Checkbox **Cố định** khi thêm chi, hoặc form **Thêm khoản cố định** trong Cài đặt (chỉ hiện khi đã có ít nhất một mẫu hoặc sau khi tạo lần đầu).

### 7.2. Tự sinh theo tháng (`syncFixedIntoMonth`)

- Khi mở tháng **≥ tháng hiện tại**: với mỗi `fixedTemplate` còn hiệu lực, nếu tháng chưa có bản live cũng chưa có tombstone → **tự thêm** một dòng chi.
- **Tháng quá khứ**: không tự bổ sung khoản còn thiếu.

### 7.3. Chỉnh sửa mẫu

- Sửa trong Cài đặt hoặc sửa dòng chi có `templateId` → cập nhật template + mọi dòng gắn `templateId` trên toàn app.
- Sửa trong tháng → `monthEdited = true` (bỏ dấu `*` review).

### 7.4. Xóa mẫu

- Soft delete template; các dòng chi liên kết xử lý theo logic tombstone/dedupe.

---

## 8. Hũ chi tiêu (Spending Jars)

### 8.1. Khái niệm

- **Hũ**: nhóm danh mục với **hạn mức riêng** và **màu** (icon lợn tiết kiệm).
- Mỗi **danh mục** chỉ thuộc **một hũ** tại một thời điểm (gán qua `spendingJars[].categoryIds` hoặc picker khi sửa danh mục).
- **Hũ ảo «Khác»** (`CONSOLIDATED_JAR_ID`): gom danh mục **chưa gắn hũ** — chỉ hiển thị, không tạo thủ công.

### 8.2. Cài đặt hũ

- Danh sách hũ: kéo thả (handle) để **đổi thứ tự**.
- Thêm / sửa modal: tên, màu (swatch), hạn mức (nghìn đồng), checkbox danh mục.
- Modal sửa: nút **Lưu** trên **Hủy**; có **Xóa hũ** (danh mục được gỡ khỏi hũ).

### 8.3. Gán hũ cho danh mục

- Khi thêm/sửa danh mục: **category jar picker** — radio với icon lợn + màu từng hũ, tùy chọn «Chưa gắn hũ (Khác)».
- Không dùng dropdown thuần.

### 8.4. Tiến độ hũ

- Chi của tháng cộng vào hũ theo danh mục khoản (không cần chọn hũ khi nhập).
- Hiển thị `đã chi / hạn mức`, thanh %; vượt hạn mức → màu cảnh báo.

---

## 9. Báo cáo

Collapsible **Báo cáo** trên màn tháng. Hai chế độ (tab):

### 9.1. Hũ

- Donut SVG + legend danh sách hũ (kể cả **Khác**).
- Mỗi hũ: `details` expand → danh sách **danh mục** (icon, tên, số tiền, % trong hũ).
- **Drill-down cấp 3**: expand danh mục → danh sách **khoản chi tháng**:
  - Gộp các khoản **cùng tên** (không phân biệt hoa thường).
  - Hiển thị: tên, tag **CĐ** (nếu cố định), số tiền — **không** hiển thị ngày/giờ.
- Trạng thái expand hũ/danh mục được nhớ trong phiên (`reportJarExpandedIds`, `reportJarCatExpandedKeys`); reset khi đổi tháng.

### 9.2. Theo ngày

- Khoảng: **Tháng này** (chỉ ngày ≤ hôm nay nếu đang xem tháng hiện tại) hoặc **7 ngày** gần nhất.
- Biểu đồ cột — bấm cột → panel chi tiết: danh sách khoản trong ngày đó (giống list chi tiêu).
- Tự scroll tới ngày đang chọn khi cần.

---

## 10. Credit Card

Bật trong **Cài đặt → Credit Card**.

### 10.1. Cài đặt

| Tùy chọn | Mô tả |
|----------|--------|
| Bật chi tiêu Credit card | Hiện checkbox khi thêm/sửa chi + báo cáo CC |
| Ngày sao kê | 1–31; ngày chốt kỳ trong tháng |
| Ngày đến hạn | Tự tính: **+15 ngày** sau ngày chốt kỳ |

Ghi chú UI: báo cáo CC theo **chu kỳ sao kê**, tách khỏi logic «tháng dương lịch» của báo cáo ngày — khoản CC vẫn nằm trong tổng **Đã chi** tháng dương lịch trên summary.

### 10.2. Chu kỳ sao kê

- **Kỳ đã chốt (previous)**: từ ngày sau chốt kỳ trước → ngày chốt gần nhất (đã qua).
- **Kỳ hiện tại (current)**: từ ngày sau chốt gần nhất → hôm nay.
- Nút **Đã thanh toán** trên kỳ trước → lưu `paidCycleEnds` (danh sách `cycleKey` = ngày chốt).

### 10.3. Báo cáo Credit Card (collapsible riêng)

1. **Tổng quan chu kỳ** — tổng kỳ trước (trạng thái thanh toán, hạn, đếm ngày) + tổng tạm tính kỳ hiện tại.
2. **Cơ cấu chi tiêu** — pie theo danh mục, chọn kỳ hiện tại / kỳ trước.
3. **Xu hướng** — đường tích lũy chi CC trong kỳ hiện tại.
4. **Giao dịch kỳ hiện tại** — list; tùy chọn «Chỉ khoản chi lớn (> 1.000.000đ)».

Chỉ khoản có `isCreditCard: true` và chưa xóa được tính trong báo cáo CC.

---

## 11. Cài đặt (chi tiết)

### 11.1. Hạn mức mặc định

- Chế độ xem: nhãn giá trị hoặc «Chưa đặt mặc định» + nút sửa.
- Chế độ sửa: ẩn nhãn, hiện input + ✓ / ✕ cùng hàng; hint nghìn đồng tách riêng phía dưới.
- `0` = chưa đặt. Lưu → `settings.defaultLimit`; tháng chưa `incomeUserSet` nhận giá trị này khi mở.

### 11.2. Giao diện

- Theme: Dark, Light, Blue, Mint, Purple, Pink Pastel, Gray — áp CSS variables toàn app; theme **không** đồng bộ cloud (chỉ local).

### 11.3. Danh mục chi tiêu

- Danh mục mặc định + thêm tùy chỉnh (tên, icon preset emoji, hũ).
- Kéo thả đổi thứ tự (ảnh hưởng dropdown).
- Sửa/xóa modal; **ít nhất một** danh mục. Xóa → mọi chi & cố định chuyển sang danh mục đầu tiên còn lại.

### 11.4. Khoản cố định (settings)

- Section ẩn cho đến khi có dữ liệu cố định; quản lý list + thêm mới.

### 11.5. Dữ liệu (collapsible)

| Hành động | Hành vi |
|-----------|---------|
| **Export** | Chọn một/nhiều tháng có dữ liệu; file JSON v3 gồm `days`, `months`, config, `exportedAt` |
| **Import** | Ghi đè **toàn bộ** local; mở tháng phù hợp sau import |
| **Xóa toàn bộ** | Xác nhận kép; xóa local storage |

**Sau import khi đã đăng nhập cloud**

- Đẩy file lên cloud (`forceLocal`) hoặc đặt cờ `pending-cloud-push` để lần đăng nhập sau ghi đè cloud cũ.

---

## 12. Side menu — tháng và cloud

### 12.1. Danh sách tháng

- ~60 tháng gần nhất, có nhãn trạng thái (có/không dữ liệu), tổng chi tháng.
- Vuốt trái → **xóa dữ liệu tháng** (meta + shard ngày trong tháng).
- Tháng đang xem: highlight `is-active`.

### 12.2. Đồng bộ Supabase (tùy chọn)

- **Đăng nhập** (email magic link / session) → bật nút «Đồng bộ cloud».
- **Push**: merge local + remote theo `updatedAt` / `dataUpdatedAt` từng ngày & tháng; không ghi đè mù quáng.
- **Pull / realtime**: `mergePayloadForCloud(local, remote)` — giữ khoản local mới hơn.
- Tháng đang mở: **pin snapshot** trước sync để không mất khoản vừa nhập.
- `visibilitychange` / `pagehide`: flush timer sync + `persistLocalNow` trước khi rời trang.
- Trạng thái hiển thị trong side menu (local / đã sync / lỗi).

---

## 13. Migration V2 → V3

- Nếu có `family-budget-v2` mà chưa có v3 → hiện **dialog chặn** UI cho đến khi migrate.
- Migrate: chuyển `months[].expenses` → `days[YYYY-MM-DD].expenses`; gợi ý export backup trước.
- Sau migrate: chỉ ghi `family-budget-v3`.

---

## 14. PWA

- `site.webmanifest`: `standalone`, icon 192/512, `theme_color` `#0c1014`.
- Meta Apple: `apple-mobile-web-app-capable`.
- Font: Be Vietnam Pro (Google Fonts).
- Có thể «Add to Home Screen» trên mobile.

---

## 15. Quy ước nhập tiền

Đơn vị mặc định: **nghìn đồng** (`VND_PER_INPUT_UNIT = 1000`).

| Nhập | Hiểu là |
|------|---------|
| `1500` | 1.500.000 ₫ |
| `25.000.000` hoặc `25000000` (định dạng VND) | 25.000.000 ₫ |
| `25,5` | 25.500 ₫ |

Preview và summary dùng `formatMoneyVND` / `formatMoneyVNDShort` (`250k`, `1,5tr`, …).

---

## 16. Phím tắt & accessibility

- **Escape**: đóng limit edit, settings limit edit, day picker, các modal đang mở.
- Modal: `role="dialog"`, `aria-modal`, backdrop click đóng (tùy dialog).
- `[hidden]` dùng `display: none !important` — tránh xung đột với layout flex.

---

## 17. Luồng dữ liệu tóm tắt

```
User nhập chi
  → state.expenses (RAM)
  → persistLocalNow / saveAppData
  → flushActiveMonthIntoApp
  → app.days[YYYY-MM-DD] + localStorage v3
  → [optional] merge + upsert Supabase
```

```
User mở tháng khác
  → flush tháng cũ
  → buildMonthState từ days
  → syncFixedIntoMonth (nếu ≥ tháng hiện tại)
  → renderAllViews
```

---

## 18. File liên quan

| File | Vai trò |
|------|---------|
| `index.html` | Cấu trúc UI, form, modal, side menu |
| `app.js` | Logic nghiệp vụ, lưu trữ, sync, render |
| `styles.css` | Theme, layout, swipe, báo cáo, settings |
| `site.webmanifest` | PWA manifest |

---

*Tài liệu phản ánh hành vi app tại thời điểm viết; khi đổi code nên cập nhật lại các mục tương ứng.*
