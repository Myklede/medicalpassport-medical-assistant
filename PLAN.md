# MediPass — Kế hoạch sản phẩm

> Tài liệu nội bộ cho team. Mục đích: để mọi người hiểu **đang làm gì, không làm gì, và tại sao**.
> Không phải slide đi pitch.
>
> Cập nhật: 06/09/2026 · Trạng thái: nháp, sửa thoải mái

---

## Bước 1 — Nỗi đau & Người dùng tiên phong

### ICP (thu hẹp tối đa)

> **Du học sinh Việt Nam mới sang Mỹ, trong 3 tháng đầu, đang mang thuốc từ nhà và chưa có bác sĩ ở Mỹ.**

Không phải "người di chuyển giữa các quốc gia". Không phải "du học sinh". Là **nhóm trên**, hẹp nhất có thể.

Tại sao chọn nhóm này:

- **Tìm được ngay.** UB có hội sinh viên Việt Nam. Đi bộ tới được, không cần quảng cáo.
- **Nỗi đau cấp tính và có hạn định.** Trong 3 tháng đầu, thuốc mang theo hết dần, chưa có bảo hiểm ổn định, chưa có bác sĩ. Sau 6 tháng thì họ tự xoay được — nên phải bắt đúng cửa sổ này.
- **Chúng ta là họ.** Không phải đoán nỗi đau của người lạ.

### Không phải ICP (giai đoạn này)

| Nhóm | Vì sao chưa |
|---|---|
| Khách du lịch ngắn ngày | Ở quá ngắn, không kịp gặp vấn đề |
| Người Mỹ bản địa | Apple Health, MyChart đã phục vụ rồi |
| Người tị nạn / định cư | Nỗi đau nặng hơn nhiều, nhưng phải tiếp cận qua tổ chức — để Phase sau |
| Bệnh nhân mãn tính nặng | Rủi ro cao, cần độ chính xác mà ta chưa có |

### Jobs-to-be-Done

**JTBD-1 (chính — MVP xoay quanh cái này)**
> "Khi thuốc mang từ nhà sắp hết, tôi cần biết **ở Mỹ thuốc này tên gì**, trong vòng 2 phút, để tự ra hiệu thuốc mua mà không nhầm hoạt chất."

**JTBD-2**
> "Khi đi khám lần đầu ở Mỹ, tôi cần đưa bác sĩ **một trang tiếng Anh** tóm tắt tiền sử, để không phải giải thích bằng vốn tiếng Anh y khoa mình không có."

**JTBD-3**
> "Nếu tôi bất tỉnh, tôi cần người lạ **đọc được tôi dị ứng gì**, để không bị tiêm thứ có thể giết mình."

---

## Bước 2 — Phạm vi MVP

### Một giá trị cốt lõi

> **Tra tên thuốc tương ứng giữa Việt Nam và Mỹ.**

Chỉ một. Mọi thứ khác trong MVP tồn tại để phục vụ nó.

Lý do chọn cái này chứ không phải "lưu trữ hồ sơ": lưu trữ hồ sơ thì Apple Health, MyChart, cả file ảnh trong điện thoại đều làm được. Đối chiếu tên thuốc xuyên biên giới thì **chưa ai làm cho người Việt**, và nó là thứ gây đau ngay trong tuần đầu tiên.

### Ma trận ưu tiên (MoSCoW)

**MUST — thiếu là luồng chính không chạy**

- [x] Xem danh sách thuốc đang dùng
- [x] Tra tên thuốc VN → tên generic Mỹ + tên thương mại Mỹ
- [x] Cảnh báo **trùng hoạt chất** (2 thuốc khác tên cùng một hoạt chất)
- [x] Cảnh báo **dị ứng mở rộng** (dị ứng penicillin ⇒ cả amoxicillin, Augmentin)
- [x] Ghi rõ "chỉ mang tính tham khảo, dược sĩ là người xác nhận cuối"
- [ ] Thêm thuốc thủ công

**SHOULD — quan trọng, nhưng chưa cần để kiểm chứng giá trị**

- [ ] Medical passport: 1 trang tiếng Anh cho bác sĩ *(đã có bản đầu)*
- [ ] Lưu dị ứng, bệnh nền, kết quả xét nghiệm *(đã có)*
- [ ] Đăng nhập thật + phân quyền theo dòng dữ liệu — **hiện tại app KHÔNG có auth**
- [ ] Giải thích chỉ số xét nghiệm bằng lời thường

**COULD — để bản sau**

- [ ] Chụp ảnh vỏ thuốc → OCR trích hoạt chất
- [ ] Xuất PDF passport
- [ ] Thẻ cấp cứu xem được trên màn hình khoá
- [ ] Mở rộng sang nước thứ ba (Hàn, Nhật, Đức)
- [ ] Giao diện song ngữ Việt–Anh toàn app

**WON'T — KHÔNG làm trong giai đoạn này**

> Phần này quan trọng nhất tài liệu. Đọc kỹ trước khi ai đó đề xuất thêm tính năng.

| Không làm | Lý do |
|---|---|
| **Nhận dạng vết thương bằng AI** | Đây là **thiết bị y tế theo FDA** (SaMD), không phải một feature. Nhiều năm, tốn kém, cần đối tác lâm sàng + người phụ trách pháp lý. |
| **Mental health** | Rủi ro cao hơn nữa, kèm nghĩa vụ xử lý khủng hoảng. Không dành cho team 2 người. |
| **Check policy bảo hiểm** | Nỗi đau thật, nhưng phán quyết quyền lợi là vùng trách nhiệm pháp lý. Để sau. |
| **Cổng kết nối bệnh viện / vai manager** | Chu kỳ bán cho IT bệnh viện 12–24 tháng. Ta chưa có gì để đàm phán. |
| **Nhắc uống thuốc** | Medisafe, MyTherapy đã làm rất tốt. Không phải chỗ ta thắng. |

---

## Bước 3 — Lean PRD

### 3.1 Mục tiêu & chỉ số thành công

**Bản phát hành đầu giải quyết:** người mới sang không biết thuốc mình đang uống ở Mỹ tên là gì, và không biết hỏi ai.

| Chỉ số | Mục tiêu | Cách đo |
|---|---|---|
| **Task Completion Rate** | ≥ 70% | Người dùng tra được tên Mỹ của một thuốc họ đang mang, ≤ 2 phút, không cần hỏi ai |
| **Quay lại lần 2** | ≥ 25 / 50 người, trong 30 ngày | Event analytics |
| **Độ phủ bảng đối chiếu** | ≥ 80% | Số thuốc người dùng nhập mà tra ra kết quả / tổng số nhập |
| **Chỉ số ngược (cảnh báo)** | ≤ 20% | Tỷ lệ tra ra "không có kết quả" — cao nghĩa là bảng dữ liệu quá mỏng |

### 3.2 Luồng người dùng

**Luồng A — Tra thuốc (luồng chính, phải mượt nhất)**

```
Mở app
  → Màn Today: thấy ngay câu trả lời cho thuốc quan trọng nhất
  → Bấm "Medicines"
  → Thấy danh sách thuốc, mỗi dòng có: tên VN, hoạt chất, TÊN CẦN HỎI Ở MỸ, nhãn trạng thái
  → Bấm vào một thuốc
  → Đọc "About this medicine" + câu mẫu để nói ở quầy thuốc
```

**Luồng B — Đi khám**

```
Mở app → "For the doctor" → Đưa điện thoại cho lễ tân/bác sĩ
```

**Luồng C — Thêm thuốc mới**

```
Medicines → "Add" → Nhập tên trên vỏ hộp
  → Hệ thống tự tra
  → Nếu có kết quả: hiện tên Mỹ + cảnh báo trùng/dị ứng nếu có
  → Nếu không: ghi nhận lại để bổ sung vào bảng dữ liệu
```

> Luồng C quan trọng gấp đôi: vừa phục vụ người dùng, vừa **là cách ta thu thập dữ liệu thuốc còn thiếu**.

### 3.3 User Stories & Acceptance Criteria

**US-1 — Tra tên thuốc**

> Là một *du học sinh mới sang*, tôi muốn *xem thuốc mình đang uống ở Mỹ gọi là gì*, để *tự ra hiệu thuốc mua được*.

Acceptance Criteria:
- Nhập "Ventolin xịt" ⇒ hiện `albuterol`, kèm ProAir HFA / Ventolin HFA
- Khớp được cả khi gõ có dấu và không dấu
- Hiện rõ thuốc đó ở Mỹ **có cần đơn hay không**
- Không có kết quả ⇒ nói rõ "chưa có trong dữ liệu", **không đoán bừa**

**US-2 — Cảnh báo trùng hoạt chất**

> Là một *người mang nhiều loại thuốc*, tôi muốn *được cảnh báo khi hai thuốc thực chất là một*, để *không uống quá liều*.

Acceptance Criteria:
- Có cả Panadol và Efferalgan ⇒ hiện cảnh báo MAJOR
- Cảnh báo do hệ thống tự tính từ dữ liệu, **không viết cứng**
- Cảnh báo nằm ở vùng thị giác riêng, không lẫn trong danh sách

**US-3 — Dị ứng mở rộng**

> Là một *người dị ứng penicillin*, tôi muốn *biết ở Mỹ những thuốc nào cũng thuộc nhóm đó*, để *nói đúng với bác sĩ*.

Acceptance Criteria:
- Hồ sơ có dị ứng "Penicillin" ⇒ hiện "cũng bao gồm amoxicillin, Augmentin và ampicillin"
- Có câu mẫu tiếng Anh để nói ở phòng khám

**US-4 — Trang cho bác sĩ**

> Là một *người đi khám lần đầu*, tôi muốn *đưa bác sĩ một trang tiếng Anh*, để *không phải tự giải thích*.

Acceptance Criteria:
- Một màn hình, không cần cuộn quá 1 lần
- Thuốc ghi bằng **tên generic Mỹ**, kèm dòng nhỏ tên gốc VN
- Dị ứng nằm trên cùng, màu cảnh báo
- Ghi rõ "do bệnh nhân tự khai, chưa được cơ sở y tế xác nhận"

### 3.4 Rủi ro kỹ thuật cần làm PoC trước

| # | Giả định cần kiểm chứng | PoC | Nếu sai thì sao |
|---|---|---|---|
| **S-1** | Có thể map thuốc VN → Mỹ ở quy mô lớn qua RxNorm + mã ATC (WHO) | Lấy 100 thuốc bán chạy nhất VN, đo tỷ lệ map được | Nếu < 60%: phải làm thủ công lâu dài ⇒ chi phí vận hành cao |
| **S-2** | Có nguồn danh mục thuốc VN dùng được | Tìm dữ liệu công khai từ Cục Quản lý Dược | Nếu không có: phải tự dựng từ ảnh vỏ hộp người dùng gửi lên |
| **S-3** | OCR đọc được vỏ thuốc tiếng Việt | 30 ảnh thật, đo độ chính xác trích hoạt chất | Nếu thấp: bỏ tính năng chụp ảnh, chỉ nhập tay |
| **S-4** | Phân quyền theo dòng dữ liệu | Dựng RLS trên Supabase | **Hiện app chưa có auth nào cả** — đây là nợ kỹ thuật lớn nhất |

> **S-1 là rủi ro sống còn.** Nếu không map được ở quy mô, sản phẩm chỉ là một bảng tra cứu thủ công.
> Làm PoC này trước mọi thứ khác.

---

## Bước 4 — Lộ trình theo tầng

### NOW · 1–2 tháng (09–10/2026) — Kiểm chứng

- 15 cuộc phỏng vấn du học sinh **trước 12/09**
- UB Startup Boot Camp 12–13/09
- Hoàn thiện luồng A (tra thuốc) cho thật mượt
- Thêm thuốc thủ công + ghi nhận thuốc chưa có trong dữ liệu
- **PoC S-1**: đo độ phủ RxNorm + ATC trên 100 thuốc VN
- Giữ nguyên Cloudflare D1. **Không đổi backend lúc này.**

> Không làm gì khác. Mục tiêu duy nhất: biết luồng A có thực sự hữu ích không.

### NEXT · 3–6 tháng (11/2026 – 02/2027) — Tối ưu & giữ chân

- Sửa điểm nghẽn UX từ phản hồi thật
- Auth thật + RLS (chuyển Supabase)
- Medical passport hoàn chỉnh + xuất PDF
- Giải thích chỉ số xét nghiệm bằng lời thường
- Mở rộng bảng đối chiếu lên 300–500 thuốc
- Thẻ cấp cứu

### LATER · 6–12+ tháng (2027+) — Mở rộng

- OCR vỏ thuốc / đơn thuốc
- Nhập hồ sơ từ nhà cung cấp Mỹ (SMART on FHIR, Apple Health Records)
- Nước thứ ba: Hàn, Nhật, Trung
- Đối tác đầu tiên: UB Student Health Services hoặc một phòng khám cộng đồng ở Buffalo
- Vai manager cho cơ sở y tế *(chính là Phase 1 trong bản nháp cũ — nó thuộc về đây)*
- Bắt đầu bàn về bảo hiểm

---

## Bước 5 — Chỉ số & vòng lặp

### North Star Metric

> **Số lượt tra cứu được người dùng xác nhận là "đã giải quyết được vấn đề", mỗi tuần.**

Không phải số lượt tra cứu. Không phải số người đăng ký. Là số lần **người dùng thực sự tự xử lý được việc y tế của mình** nhờ app.

Đo bằng cách: sau khi tra cứu, hỏi một câu duy nhất — *"Bạn mua được thuốc này chưa?"* — Rồi / Chưa.

**Chỉ số ngược cần theo dõi:** tỷ lệ tra ra "không có kết quả". Nếu NSM tăng mà chỉ số này cũng tăng, nghĩa là ta đang phục vụ tốt một nhóm hẹp và bỏ rơi phần còn lại.

### Vòng lặp Build → Measure → Learn

**Build (2–4 tuần)** — đưa bản chạy được tới 30–50 du học sinh. Đủ dùng là được, không cần đẹp.

**Measure** — kết hợp hai nguồn:
- Event analytics: hoàn thành luồng, thời gian tra cứu, chỗ bỏ ngang
- **Phỏng vấn 1-1**: 5–8 người mỗi vòng. Con số nói *cái gì* xảy ra, phỏng vấn nói *tại sao*.

**Learn** — mỗi vòng trả lời đúng ba câu:
1. Người dùng bỏ ngang ở bước nào?
2. Tính năng nào không ai đụng tới? *(⇒ cắt)*
3. Họ hỏi cái gì mà app chưa có? *(⇒ ứng viên cho vòng sau)*

---

## Nguyên tắc làm việc

1. **Mỗi lúc chỉ một giá trị cốt lõi.** Ai đề xuất tính năng mới, hỏi lại: nó phục vụ luồng tra thuốc như thế nào?
2. **Không bịa dữ liệu y tế.** Không có trong bảng thì nói "chưa có", không đoán. Sai một lần là mất niềm tin vĩnh viễn.
3. **Chỉ dùng dữ liệu giả** cho tới khi có auth và phân quyền thật.
4. **Luôn ghi rõ "tham khảo — dược sĩ xác nhận".** Trên màn hình, không giấu trong điều khoản.
5. **Nói chuyện với người dùng mỗi tuần.** Không có tuần nào là ngoại lệ.

---

## Trạng thái hiện tại (06/09/2026)

**Đã có**
- Lưu trữ hồ sơ: 5 loại record, thêm/sửa/xoá mềm, upload file, audit log
- Medical passport (bản đầu)
- Đối chiếu tên thuốc VN↔US với 4 nhóm hoạt chất — `lib/medicine-matching.ts`
- Tự phát hiện trùng hoạt chất + dị ứng mở rộng
- Màn Medicines theo thiết kế mới — `app/medicines-view.tsx`

**Chưa có**
- Auth (đang chạy bằng một user demo cố định)
- Thêm thuốc thủ công qua màn Medicines
- Bảng đối chiếu quy mô thật (mới 4 nhóm)
- Bất kỳ người dùng thật nào

> Gạch đầu dòng cuối cùng là gạch quan trọng nhất.
