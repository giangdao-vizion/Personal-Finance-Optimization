# Kế hoạch migrate sync cloud: 1 khoản chi = 1 dòng DB

Tài liệu này mô tả kế hoạch triển khai để thay mô hình **1 blob JSON toàn app** (`family_budget_states` / `shared-default`) bằng **mỗi khoản chi một row**, config **bảng riêng**, UI local-first, pull chủ yếu khi mở app — đồng thời giảm/tránh mất dữ liệu lịch sử và không làm chậm thao tác nhập.

Cập nhật theo thảo luận sản phẩm / kiến trúc hiện tại (`features.md`, `app.js`).

### Tiến độ triển khai

| Phase | Trạng thái | Ghi chú |
|-------|------------|---------|
| A — An toàn forceLocal / import / wipe | **Xong** | `cloudOverwriteWouldShrink`, confirm wipe/import cloud |
| B — Schema + backfill SQL | **Xong trên Supabase** | ~814 khoản live / 5 tháng; config OK |
| C — Dual-write expenses + UI | **Xong** | Local-first + queue `expenses` + spinner; verified add/edit lên DB |
| D — Parity + config dual-write | **Đang làm** | `runExpenseParityCheck` + dual-write bảng config; `SYNC_ENGINE=dual` |
| E–F | Chưa | Cắt blob sau khi parity ổn định |

---

## 1. Mục tiêu & nhu cầu cần đáp ứng

| Nhu cầu | Cách đáp ứng |
|--------|----------------|
| UI nhanh khi thêm/sửa khoản | Ghi local ngay → hiện list ngay; sync API chạy nền |
| User biết sync xong chưa | Icon loading / trạng thái trên đúng row khoản đó |
| Payload nhẹ | Chỉ upsert/delete đúng row đổi, không gửi cả lịch sử |
| Không sót dữ liệu lên cloud | Queue pending bền + retry + push trước khi pull |
| Multi-device cùng account | Pull + merge khi mở app (chấp nhận không realtime) |
| Xung đột cùng 1 khoản | Live vs live: `updated_at` mới hơn thắng; có xóa: tombstone thắng |
| Config tách khỏi chi tiêu | Bảng riêng (`month_meta`, categories, jars, templates, settings) |
| Không mất nhiều tháng lịch sử | Dual-write + parity + không cutover sớm + cấm ghi đè “bản nghèo” |

**Ngoài phạm vi giai đoạn đầu (cố ý):** realtime đa thiết bị, CRDT field-level merge.

---

## 2. Hiện trạng (điểm xuất phát)

- Cloud: bảng `family_budget_states`, **1 row** `id = shared-default`, cột `payload` = toàn bộ schema v3 (`months`, `days`, categories, …).
- Mỗi lần lưu khoản: merge + upsert **cả blob** (+ thường kéo lại) → chậm cuối tháng / khi lịch sử lớn.
- Local vẫn schema v3 theo ngày (`days[YYYY-MM-DD].expenses`) — flatten sang row DB là việc map, không đổi UX tháng.

---

## 3. Mô hình dữ liệu đích

### 3.1. Bảng `expenses` (chỉ khoản chi)

| Cột | Kiểu / ghi chú |
|-----|----------------|
| `id` | `text` PK — giữ id hiện tại của app |
| `user_id` | `uuid` — `auth.uid()`, RLS |
| `device_id` | `text` — id máy ổn định (localStorage) |
| `created_at` | `timestamptz` / ms |
| `updated_at` | `timestamptz` / ms — dùng LWW |
| `deleted_at` | nullable — soft delete |
| `day_key` | `YYYY-MM-DD` — index |
| `month_key` | `YYYY-MM` — index |
| `category` | text |
| `name` | text |
| `amount` | bigint (VND) |
| `date_ts` | bigint nullable |
| `template_id` | text nullable |
| `month_edited` | boolean nullable |
| `is_credit_card` | boolean nullable |
| `extra` | `jsonb` optional — field phụ / tương lai |

Index gợi ý: `(user_id, month_key)`, `(user_id, updated_at)`, `(user_id, day_key)`.

### 3.2. Config — bảng riêng (không chung bảng expenses)

| Bảng | Nội dung |
|------|----------|
| `month_meta` | PK `(user_id, month_key)`: income, income_user_set, deleted_at, updated_at, device_id |
| `categories` | id, user_id, fields danh mục, sort/order, deleted_at, updated_at, device_id |
| `spending_jars` | tương tự |
| `fixed_templates` | tương tự |
| `user_settings` | PK `user_id`: default_limit, credit_card JSON, updated_at, device_id — **theme vẫn local-only** như hiện tại |

Mỗi loại config sync độc lập (upsert theo id / theo month_key), payload nhỏ.

### 3.3. Trạng thái sync phía client (local)

Mỗi expense (và optionally từng entity config):

- `syncStatus`: `pending` | `syncing` | `synced` | `error`
- Queue bền trong localStorage / IndexedDB: danh sách id cần đẩy
- `device_id` sinh một lần, không đổi
- `last_pulled_at` (server time hoặc max `updated_at` đã kéo)

Blob `family_budget_states` giữ trong giai đoạn dual-write; sau cutover chỉ archive.

---

## 4. Hành vi sản phẩm (sau khi xong)

### 4.1. Thêm / sửa / xóa khoản

1. Cập nhật local + UI ngay (`syncStatus = pending` → hiện spinner nhỏ trên row).
2. Enqueue; worker tuần tự (hoặc serialize theo `id`) gọi upsert/delete row.
3. Thành công → `synced`, tắt spinner.
4. Lỗi mạng → `error`, giữ data local; tap / mở app / online → retry.

### 4.2. Mở app (multi-device)

Thứ tự **bắt buộc**:

```
load local
→ push toàn bộ queue pending (expenses + config dirty)
→ pull thay đổi từ cloud (updated_at > last_pulled_at; lần đầu = full user)
→ merge vào local
→ render
```

Không realtime / không poll định kỳ ở phase này.  
**Khuyến nghị nhẹ:** thêm 1 lần cùng luồng khi tab từ background → foreground (tránh tab mở cả ngày không bao giờ “mở lại”).

### 4.3. Xung đột

| Tình huống | Rule |
|------------|------|
| Hai bản live cùng `id` | `updated_at` lớn hơn thắng |
| Một bên có `deleted_at` | **Tombstone thắng** (không để edit cũ hồi sinh sau xóa) |
| Hai máy tạo hai khoản “giống nhau” khác `id` | Giữ cả hai (đúng model) |
| Đồng hồ lệch | Client set `updated_at` lúc user lưu; server có thể `GREATEST` nhưng không đảo ngược ý user nếu có thể |

---

## 5. Các phase triển khai

### Phase A — An toàn & nền tảng (trước khi đổi đường ghi)

**Mục tiêu:** không mất lịch sử vì import/wipe/`forceLocal`.

- [ ] Chặn upsert/ghi đè cloud khi local “nghèo hơn” remote rõ rệt (ít month_key / ít live expenses), trừ confirm rõ ràng.
- [ ] Import / xóa toàn bộ: confirm 2 bước; mặc định **không** xóa rows cloud.
- [ ] Export backup full trước mọi migrate môi trường thật.
- [ ] Feature flag: `SYNC_ENGINE = blob | dual | rows`.

**Exit criteria:** fixture “local 2 tháng + cloud 12 tháng” không bị shrink.

### Phase B — Schema Supabase + backfill

- [ ] Tạo bảng `expenses` + các bảng config (mục 3) + RLS `user_id = auth.uid()`.
- [ ] Script backfill: đọc blob → flatten `days[*].expenses` → insert `expenses`; map `month_meta` + config.
- [ ] Tombstone blob → `deleted_at`.
- [ ] Ghi nhận `device_id = 'backfill'` hoặc null cho dữ liệu migrate.

**Exit criteria (parity):** với mọi `month_key`:

- `count(live expenses rows) == count(live trong blob)`
- `count(tombstones gần đây cần giữ) >= kỳ vọng`
- Sample N id đầu/giữa/cuối khớp field cốt lõi (amount, category, day_key)

### Phase C — Client dual-write + UI trạng thái

- [ ] Sinh `device_id`; queue pending; UI spinner/error trên row.
- [ ] Add/edit/delete: local-first → upsert 1 row `expenses` (và config tables nếu đụng).
- [ ] Vẫn ghi blob **song song** (dual-write) cho đến Phase E.
- [ ] Mở app: push pending → pull rows (+ optionally vẫn pull blob để đối chiếu ở môi trường staging).
- [ ] Bỏ await sync trên đường nhập liệu (không chặn UI).

**Exit criteria:** nhập 20 khoản liên tiếp cảm giác tức thì; DevTools chỉ thấy request nhỏ theo từng id; không regress mất khoản trên 2 máy (mở lại app).

### Phase D — Dual-read / chạy song song giám sát

- [ ] Job hoặc chế độ debug: so blob vs rows theo tháng mỗi ngày.
- [ ] Mọi thiết bị production đã lên bản dual-write.
- [ ] Quan sát lỗi sync / queue tồn đọng.

**Exit criteria:** parity xanh liên tục khoảng thời gian đã chốt (ví dụ ≥ 7 ngày hoặc đủ tin cậy với số user thực tế); không có shrink.

### Phase E — Cutover

- [ ] Flag `SYNC_ENGINE = rows`: chỉ đọc/ghi tables; **ngừng ghi blob**.
- [ ] Giữ blob read-only / snapshot vài tuần.
- [ ] Rollback flag về `dual` hoặc `blob` nếu phát hiện lệch.

**Exit criteria:** checklist mục 7 pass trên staging + canary user.

### Phase F — Dọn dẹp

- [ ] Gỡ dual-write code path.
- [ ] Archive/drop blob khi hết cửa sổ rollback.
- [ ] Cập nhật `features.md` / README cho mô hình mới.
- [ ] Export/import: build JSON v3 từ rows (tương thích backup cũ nếu cần).

---

## 6. Ma trận rủi ro & phương án xử lý

| # | Rủi ro | Mức | Giảm / tránh |
|---|--------|-----|----------------|
| R1 | Backfill thiếu tháng / thiếu id | Cao | Script parity bắt buộc; không bật dual-write production khi fail; freeze ghi blob lúc backfill ngắn nếu cần |
| R2 | Cutover khi còn máy app cũ ghi blob | Cao | Dual-write đủ lâu; kiểm tra version; cắt blob chỉ khi không còn client cũ |
| R3 | Pull lúc mở app đè mất pending local | Cao | **Luôn push queue trước pull**; merge không thay thế cả store bằng remote mù quáng |
| R4 | “Delta” implement nhầm = vá thiếu rồi ghi đè blob | Cao | Phase rows: **không** đọc-sửa-ghi cả blob cho 1 khoản; chỉ upsert row theo `id` |
| R5 | Edit sau delete hồi sinh khoản | TB | Rule tombstone thắng; không LWW thuần khi một phía đã xóa |
| R6 | Đổi ngày khoản chi | TB | Cùng `id`: update `day_key`/`month_key` + fields; không insert id mới |
| R7 | Config lẫn / quên sync | TB | Bảng riêng + đánh dấu dirty riêng; mở app push config dirty cùng expenses |
| R8 | Queue mất khi clear site data | TB | Cảnh báo trong UI settings; khuyến nghị export; sau login pull full từ cloud khôi phục đã sync |
| R9 | Mở app lần đầu chậm (pull full) | TB | Cursor `updated_at`; cache local; lần sau chỉ delta; có thể kéo theo `month_key` gần trước |
| R10 | Spinner kẹt / user tưởng mất data | TB | Timeout → `error` + retry; data vẫn trên UI |
| R11 | Import backup nhỏ ghi đè cloud lớn | Cao | Confirm + so sánh số tháng/khoản; mặc định merge hoặc chặn force |
| R12 | Race nhiều request cùng `id` | TB | Serialize theo `id`; chỉ gửi bản `updated_at` mới nhất trong queue |
| R13 | RLS / user_id sai | Cao | Test với 2 user; không dùng `shared-default` cho expenses |
| R14 | Xóa tháng / wipe | Cao | Soft-delete `month_meta` + tombstone expenses theo prefix; wipe cloud cần confirm riêng |

---

## 7. Checklist kiểm tra sau mỗi phase / trước khi coi là xong

### 7.1. Không mất dữ liệu

- [ ] Số `month_key` có live expenses sau migrate ≥ trước migrate (cùng user).
- [ ] Với mỗi tháng mẫu (cũ / giữa / hiện tại): tổng tiền live khớp (±0) so baseline.
- [ ] N id ngẫu nhiên: amount, category, name, day_key, deleted_at khớp.
- [ ] Máy A offline thêm khoản → mở lại (có mạng): khoản có trên cloud và máy B sau khi B mở lại.
- [ ] Máy B xóa khoản → máy A mở lại: khoản biến mất (tombstone), không hồi sinh sau đó.
- [ ] Máy local chỉ 1–2 tháng + cloud đủ năm: sau mở app vẫn đủ năm trên local.
- [ ] Import backup nhỏ khi cloud lớn: **không** xóa cloud nếu user không confirm force.
- [ ] Wipe local khi đã login: cloud rows vẫn còn (trừ khi user chọn xóa cloud).

### 7.2. Đúng xung đột & multi-device

- [ ] Hai máy sửa cùng id (lệch vài giây): bản `updated_at` mới hơn thắng sau khi cả hai đã mở lại / sync.
- [ ] Một máy xóa, máy kia sửa bản cũ hơn: kết quả cuối = đã xóa.
- [ ] Không yêu cầu realtime: chấp nhận chỉ thấy nhau sau mở lại app (và optionally resume tab).

### 7.3. Không làm chậm app

- [ ] Thêm khoản: UI cập nhật < ~100ms cảm nhận (không chờ network).
- [ ] Request sync: body chỉ 1 expense (hoặc batch nhỏ pending), không full history.
- [ ] Sửa / xóa: tương tự; spinner chỉ trên row liên quan.
- [ ] Cuối tháng (nhiều khoản trong tháng): thời gian cảm nhận nhập **không** tệ hơn đầu tháng một cách đáng kể.
- [ ] Mở app lần 2+ trong ngày: pull incremental, không download toàn bộ lịch sử mỗi lần nếu không cần.
- [ ] localStorage/IndexedDB không bị block UI lâu (flush async nếu cần).

### 7.4. Config tách bảng

- [ ] Đổi hạn mức tháng / danh mục / hũ / template / CC settings: không ghi vào bảng `expenses`.
- [ ] Đổi config trên máy A → máy B mở lại: nhận đúng, expenses không bị rewrite hàng loạt.
- [ ] Theme đổi local không đẩy cloud (như hành vi hiện tại).

### 7.5. Vận hành & rollback

- [ ] Feature flag tắt rows → về dual/blob trong < thời gian đã chốt, không mất data đã dual-write.
- [ ] Backup blob + export JSON giữ được trước cutover.
- [ ] Log/metric staging: số pending tồn > N phút = 0 trong điều kiện mạng bình thường; cảnh báo nếu parity lệch.

---

## 8. Thứ tự làm việc đề xuất (tóm tắt điều phối)

```
A An toàn forceLocal/import     → gate shrink
B Schema + backfill + parity      → gate đếm tháng/khoản
C Dual-write + UI pending         → gate UX + 2 máy
D Giám sát parity                 → gate ổn định
E Cutover ngừng blob              → gate checklist 7
F Dọn code + docs                 → xong
```

Không gộp A+E hoặc B+E trong một PR. Không bỏ blob trước khi checklist 7.1 xanh.

---

## 9. Định nghĩa “xong”

Hệ thống được coi là hoàn tất khi:

1. Mỗi khoản chi trên cloud là một row có `id`, `updated_at`, `user_id`, `device_id` (và tombstone nếu đã xóa).
2. Config nằm hoàn toàn ở bảng riêng.
3. Nhập/sửa/xóa: UI trước, sync nền, có trạng thái trên row; không upload blob toàn app.
4. Multi-device: đồng bộ khi mở app theo thứ tự push → pull → merge; LWW + tombstone như mục 4.3.
5. Checklist mục 7 pass; có rollback flag; không còn phụ thuộc ghi blob cho dữ liệu mới.

---

## 10. Tài liệu liên quan

- `features.md` — schema v3 local & hành vi sync hiện tại (blob).
- `README.md` — tổng quan Supabase.
- Code tham chiếu: `getAppPayload`, `syncToSupabaseNow`, `mergePayloadForCloud`, `enableSupabaseSyncBySession` trong `app.js`.
