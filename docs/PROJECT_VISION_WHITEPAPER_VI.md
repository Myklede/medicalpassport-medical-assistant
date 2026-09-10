# Báo cáo khả thi khởi nghiệp & đề cương phát triển: MediPass & Precision Wound Care (PWC)

> Nguồn: nội dung định hướng do chủ dự án cung cấp ngày 10/09/2026 để lưu ngữ cảnh cho cộng tác viên và AI ở các phiên sau. Tài liệu này mô tả tầm nhìn, roadmap và lập luận due diligence; nó không khẳng định các chức năng đều đã được xây dựng hoặc các nhận định pháp lý/khoa học đã được chuyên gia xác minh. Trạng thái code thực tế nằm trong `README.md`, `AGENTS.md` và `docs/PORTAL_AUDIT.md`.

**Tên dự án:** MediPass — Nền Tảng Hộ Chiếu Y Tế Di Động & Giám Sát Vết Thương Bằng Trí Tuệ Nhân Tạo

**Mục tiêu tài liệu:** Bản Thuyết Minh Dự Án Khởi Nghiệp Y Tế (HealthTech Pitch Deck Whitepaper) & Thẩm Định Tính Khả Thi Đầu Tư (Due Diligence)

**Thời gian hoàn thiện:** Tháng 09/2026

**Địa bàn thử nghiệm ban đầu:** Buffalo, New York, Hoa Kỳ

## 1. Tầm nhìn chiến lược & định vị cốt lõi (Core Philosophy)

Điểm nghẽn nghiêm trọng nhất của hệ thống chăm sóc sức khỏe hiện đại không nằm ở việc thiếu thiết bị xét nghiệm, mà nằm ở sự đứt gãy thông tin y tế (Data Fragmentation) khi bệnh nhân chuyển viện, đổi bác sĩ hoặc di chuyển qua biên giới quốc gia:

- **Lãng phí tài chính và thời gian:** Bệnh nhân buộc phải làm lại các xét nghiệm máu, chẩn đoán hình ảnh từ đầu vì cơ sở y tế mới không thể hoặc không kịp trích lục hồ sơ từ cơ sở cũ.
- **Nguy cơ tử vong do thiếu dữ liệu cấp cứu:** Đội ngũ lâm sàng mới không nắm được tiền sử bệnh bẩm sinh hoặc tiền sử sốc phản vệ với thuốc (như dị ứng Penicillin), dễ dẫn đến phác đồ sai lầm trong các tình huống can thiệp khẩn cấp.

MediPass được định vị là Hộ chiếu Y tế Di động (Portable Medical Passport) do chính bệnh nhân làm chủ quyền riêng tư. Dữ liệu này không nằm thụ động trong kho dữ liệu cục bộ của từng bệnh viện, mà luôn sẵn sàng xuất trình để cung cấp ngữ cảnh lâm sàng cho các công cụ AI chuyên sâu (nhận diện vết thương, kiểm tra quyền lợi bảo hiểm) và kết nối điều trị liên viện, đa quốc gia.

## 2. Lộ trình phát triển 3 giai đoạn (3-Phase Roadmap)

### Phase 1: Nền tảng Hộ chiếu Y tế & Mạng lưới Cố vấn Y khoa (The Foundation & Wedge)

**Medical Passport Core:** Số hóa và phân loại có cấu trúc: Nhóm máu, bệnh bẩm sinh, tiền sử dị ứng, tiền sử điều trị và toàn bộ kết quả xét nghiệm cận lâm sàng (Lab panel).

**Mô hình Mạng lưới Tham vấn (Tele-advisor Platform):**

- Kết nối bệnh nhân với các bác sĩ tham vấn ngoài giờ nhằm cung cấp ý kiến chuyên môn thứ hai (Second Opinion).
- Cơ chế tài chính: Thu phí dịch vụ nền tảng phần mềm cố định (Platform Subscription Fee), tuyệt đối không trích hoa hồng viện phí. Bệnh nhân trả tiền dịch vụ để có thêm một phần tiền duy trì app.
- Thu thập dữ liệu lâm sàng thực chứng (Real-World Clinical Data) thông qua quy trình cam kết đồng thuận có cấu trúc (Informed Consent) để phục vụ phát triển AI ở giai đoạn tiếp theo.

**Mũi nhọn thâm nhập thị trường (The Wedge):** Tập trung giải quyết nỗi đau cấp tính của cộng đồng quốc tế và người mới định cư: Tra cứu tên thuốc tương đương giữa các quốc gia (VN ↔ Mỹ), cảnh báo trùng hoạt chất (Paracetamol/Tylenol), gắn nhãn phân định pháp lý rõ ràng (OTC vs. Rx Required).

### Phase 2: Trí tuệ nhân tạo giám sát vết thương đa phương thức & quản trị bảo hiểm

**AI Precision Wound Care:**

- Mô hình Thị giác máy tính (Computer Vision) phân đoạn các lớp mô tổn thương: Mô hoại tử đen (Necrotic), Mô sợi vàng (Slough), Mô hạt đỏ (Granulation).
- Cá nhân hóa theo bệnh nền (Multimodal Prediction): Tích hợp thông số từ Medical Passport (Đái tháo đường, chỉ số HbA1c, suy giãn tĩnh mạch, nhóm máu) để lượng hóa tốc độ phục hồi mô thực tế.
- Quy chuẩn độ chính xác: Vận hành theo khung Clinical Decision Support (CDS). Hệ thống chỉ đo đạc và cung cấp dữ liệu bằng chứng khách quan; thẩm quyền quyết định điều trị cuối cùng thuộc về bác sĩ chủ quản nhằm đảm bảo không bỏ sót nguy cơ (underreact) và không gây hoang mang (overreact).

**Insurance Policy Engine (Chống “Cháy Túi”):**

- Sử dụng kỹ thuật RAG (Retrieval-Augmented Generation) kết hợp truy vấn thời gian thực qua giao thức EDI 270/271 để đối soát hợp đồng bảo hiểm y tế.
- Báo động các thủ tục bắt buộc phải xin duyệt trước (Prior-Authorization) để loại bỏ nguy cơ hóa đơn bất ngờ (Surprise Medical Bills).

### Phase 3: Mạng lưới y tế xuyên biên giới & sổ bộ dữ liệu nghiên cứu (Global Health & RWE)

**Hộ chiếu Y tế Quốc tế (Global Interoperability):**

- Ánh xạ danh mục dược phẩm địa phương sang mã hoạt chất quốc tế INN và mã phân loại giải phẫu - điều trị - hóa học WHO ATC.
- Bệnh nhân khi đi khám tại bất kỳ quốc gia nào đều có thể xuất trình bản tóm tắt y tế khẩn cấp chuẩn HL7 FHIR International Patient Summary (IPS), giúp bác sĩ nước ngoài nắm bắt tiền sử bệnh lập tức mà không cần làm lại xét nghiệm từ đầu.

**Sổ bộ Dữ liệu Thực chứng (Longitudinal Real-World Evidence Registry):**

- Ẩn danh hóa các hồ sơ phục hồi vết thương kết hợp chỉ số xét nghiệm nền để hợp tác cung cấp dữ liệu cho các trung tâm nghiên cứu y sinh và các công ty dược phẩm (Biopharma).
- Phục vụ các nghiên cứu quan sát hồi cứu (Retrospective Observational Studies) nhằm phân tích mối liên hệ giữa các dấu ấn sinh học, nhóm máu, cơ địa miễn dịch với tốc độ liền sẹo, đóng góp vào R&D thuốc và vật liệu sinh học thế hệ mới.

## 3. Thiết kế hệ thống kỹ thuật: Pipeline đa phương thức (Multimodal AI)

Kiến trúc kỹ thuật được định hướng chuẩn hóa theo các tiêu chuẩn phần mềm lâm sàng quốc tế. Nội dung nguồn được cung cấp chưa kèm sơ đồ chi tiết cho phần này. Khi bổ sung sơ đồ, cần phân biệt rõ kiến trúc mục tiêu với các module đã chạy trong demo.

## 4. Tổng hợp các câu hỏi tử huyệt, tranh biện & cơ sở pháp lý

### Chủ đề 1: Mô hình kinh doanh môi giới y tế & nguồn thu từ bảo hiểm

**Chất vấn từ Hội đồng Giám khảo:** “Luật liên bang Mỹ và bang New York cấm triệt để việc chia hoa hồng chuyển viện. Bạn định thu tiền hoa hồng từ bác sĩ và tiền quảng cáo từ các hãng bảo hiểm như thế nào mà không vi phạm pháp luật?”

**Luận điểm ban đầu:** Nền tảng trung gian kết nối và hưởng phần trăm hoa hồng buổi khám. Sau đó đề xuất: Thu một khoản phí tiện ích nhỏ khi bệnh nhân đi khám; với bảo hiểm, thu tiền quảng cáo để đẩy gói bảo hiểm phù hợp lên đầu bảng xếp hạng.

**Cơ sở pháp lý & phân tích rủi ro:**

- Luật cấm chia sẻ thù lao y khoa: Đạo luật Chống hối lộ y tế liên bang (Anti-Kickback Statute - 42 U.S.C. § 1320a-7b(b)) và Luật Giáo dục Bang New York (NYS Education Law § 6509-a) nghiêm cấm hành vi nhận hoa hồng trực tiếp/gián tiếp để giới thiệu bệnh nhân, hoặc chia sẻ thù lao khám bệnh giữa bác sĩ và đơn vị công nghệ. Vi phạm khung này bị truy cứu trách nhiệm hình sự.
- Quy chế Môi giới Bảo hiểm: Theo Đạo luật Chăm sóc Giá cả phải chăng (ACA) và quy định của Bộ Dịch vụ Tài chính New York (NYS DFS), việc nhận thù lao phát sinh từ việc giới thiệu hợp đồng bảo hiểm bắt buộc phải có Giấy phép Môi giới Bảo hiểm (Licensed Insurance Broker). Việc thu tiền để ưu tiên thứ hạng hiển thị nhưng giới thiệu là “gợi ý khách quan” sẽ bị Ủy ban Thương mại Liên bang (FTC) xử phạt về hành vi lừa dối người tiêu dùng.

**Giải pháp chuẩn hóa bảo vệ dự án:**

- Áp dụng mô hình B2B Technology SaaS thuần túy: MediPass đóng vai trò nền tảng so sánh minh bạch. Nguồn thu hợp pháp duy nhất từ bảo hiểm không phải là “tiền đẩy lên top”, mà là chuyển đổi thành mô hình Lead Generation/B2B SaaS: Thu phí cố định của các hãng bảo hiểm khi họ muốn tích hợp cổng tra cứu trực tiếp vào hệ thống, và bắt buộc gắn nhãn rõ `[Sponsored / Được tài trợ]` cạnh tên gói bảo hiểm đó.
- Tính năng hỗ trợ bảo hiểm vận hành theo mô hình đối soát dữ liệu kỹ thuật minh bạch. Mọi vị trí hiển thị liên kết đối tác bắt buộc phải gắn nhãn rõ `[Sponsored Listing]`.

### Chủ đề 2: Thuyết phục bệnh viện chấp nhận sử dụng & đối đầu với Epic/Cerner

**Chất vấn:** “Hệ thống y tế Mỹ đã đầu tư hàng chục tỷ USD cho các hệ thống EMR như Epic và Cerner. Tại sao một bệnh viện lớn phải chấp nhận trích xuất hoặc đồng bộ dữ liệu vào Medical Passport của một startup vô danh thay vì dùng mạng lưới Care Everywhere có sẵn?”

**Luận điểm ban đầu:** Tận dụng uy tín của hệ sinh thái y tế địa phương tại thành phố Buffalo làm bàn đạp niềm tin; dùng giá trị của Big Data nghiên cứu và bài toán giảm phân mảnh thông tin để thuyết phục các cơ sở y tế hợp tác.

**Cơ sở pháp lý & phân tích rủi ro:** Bệnh viện vận hành dựa trên kiểm soát rủi ro pháp lý và tối ưu chi phí. Họ không tích hợp phần mềm bên ngoài chỉ dựa trên lời hứa dữ liệu tương lai, do chu kỳ đánh giá phần mềm y tế kéo dài 18–24 tháng với các rào cản bảo mật khắt khe.

**Giải pháp chuẩn hóa bảo vệ dự án:**

- Vũ khí pháp lý — Đạo luật 21st Century Cures Act: Căn cứ Quy tắc Chống Chặn Thông tin (ONC Information Blocking Rule - 45 CFR Part 171), luật liên bang quy định các nhà cung cấp EMR và bệnh viện phải mở cổng API chuẩn SMART on FHIR để bệnh nhân truy xuất và chia sẻ dữ liệu của mình sang ứng dụng họ lựa chọn. Nội dung nguồn nêu rằng bệnh viện cố tình cản trở có thể đối mặt án phạt từ OIG.
- Chiến lược tiếp cận: MediPass không yêu cầu bệnh viện cài phần mềm nội bộ. Ứng dụng cung cấp công cụ để người bệnh tự xác thực qua Patient Portal cá nhân và đồng bộ dữ liệu qua chuẩn FHIR.
- Triển khai tại địa phương: Bắt đầu thử nghiệm tại các cơ sở chăm sóc vết thương ngoại trú và phòng khám phục hồi chức năng ở Tây New York, đo lường mục tiêu giảm tỷ lệ tái nhập viện đối với bệnh nhân biến chứng bàn chân đái tháo đường.

### Chủ đề 3: Khai thác dữ liệu huấn luyện AI & chuẩn mực HIPAA

**Chất vấn:** “Bạn dự tính lấy dữ liệu bệnh nhân từ các phiên tham vấn ở Phase 1 để huấn luyện AI nhận diện vết thương ở Phase 2. Quy trình này được bảo đảm tính hợp pháp như thế nào?”

**Luận điểm ban đầu:** Đưa điều khoản sử dụng vào hợp đồng dịch vụ ban đầu; khi người dùng ký cam kết thì nền tảng có quyền sử dụng dữ liệu để huấn luyện thuật toán.

**Cơ sở pháp lý & phân tích rủi ro:**

- Quy tắc Quyền riêng tư của HIPAA (HIPAA Privacy Rule - 45 CFR § 164.508): Dữ liệu sức khỏe định danh cá nhân (PHI) thu thập trong điều trị không được tự động tái sử dụng để thương mại hóa thuật toán máy học nếu chỉ có một điều khoản chung.
- Dữ liệu đưa vào nghiên cứu y sinh cần phê duyệt đạo đức từ Hội đồng Thẩm định Chuyên môn (Institutional Review Board - IRB). Thiếu cơ chế đồng thuận phân tầng có thể khiến dữ liệu bất hợp pháp và không có giá trị khoa học.

**Giải pháp chuẩn hóa bảo vệ dự án:**

- Áp dụng kiến trúc Đồng thuận Phân tầng (Tiered Informed Consent):
  - Consent for Personal Care: Phục vụ hiển thị và quản lý sức khỏe cá nhân.
  - Consent for Model Improvement: Tùy chọn độc lập cho phép ẩn danh hóa dữ liệu phục vụ nghiên cứu và tinh chỉnh thuật toán.
- Chuẩn Ẩn danh hóa (Safe Harbor Method): Tẩy bỏ 18 trường thông tin định danh cá nhân theo 45 CFR § 164.514(b)(2) trước khi đưa thuộc tính hình thái tổn thương và chỉ số cận lâm sàng vào tập huấn luyện.

### Chủ đề 4: Trách nhiệm pháp lý khi AI dự đoán sai lệch (Medical Malpractice)

**Chất vấn:** “Nếu AI kết luận một vết thương đang tiến triển tốt nhưng thực chất dưới da đang có ổ áp-xe yếm khí khiến bệnh nhân bị nhiễm trùng hoại tử phải cưa chân, ai sẽ là người chịu trách nhiệm pháp lý trước tòa án: Đơn vị phát triển phần mềm, bác sĩ tham vấn, hay nhà sáng lập?”

**Luận điểm ban đầu:** AI không đưa ra phán quyết cuối cùng mà rà soát các trường hợp khả dĩ dựa trên bệnh nền, thuốc và vết thương để cung cấp thông tin cho bác sĩ ra quyết định.

**Cơ sở pháp lý & phân tích rủi ro:**

- Định chế Thiết bị Y tế Kỹ thuật số của FDA: Nếu phần mềm tự động chẩn đoán và hướng dẫn điều trị trực tiếp cho bệnh nhân, nó có thể bị xếp vào Phần mềm Thiết bị Y tế (SaMD) Class II hoặc III và cần quy trình chứng nhận phù hợp.
- Trách nhiệm Sản phẩm (Product Liability): Lỗi thuật toán hiển thị sai thông số lâm sàng, dẫn tới nhận định sai của bác sĩ, vẫn có thể làm doanh nghiệp công nghệ chịu trách nhiệm liên đới.

**Giải pháp chuẩn hóa bảo vệ dự án:**

- Thiết kế theo hướng dẫn FDA về Hỗ trợ Quyết định Lâm sàng (Non-Device Clinical Decision Support - CDS Guidance, tháng 09/2022) căn cứ 21st Century Cures Act.
- Phần mềm chỉ đo định lượng khách quan: diện tích tổn thương (cm²), tỷ lệ đổi màu mô (% mô hạt, mô hoại tử).
- Trình bày nguồn y văn đối chứng (Evidence-linked considerations) thay vì kết luận tình trạng bệnh.
- Thẩm quyền quyết định thuộc bác sĩ sau khi xem ảnh gốc và hồ sơ bệnh nhân.
- Tích hợp chấm điểm độ tin cậy (Uncertainty Estimation). Nếu ảnh thiếu sáng hoặc dấu hiệu phức tạp, chuyển sang trạng thái: “Độ bất định kỹ thuật cao — Yêu cầu kiểm tra trực tiếp bởi bác sĩ chuyên khoa.”

### Chủ đề 5: Cơ sở khoa học của việc dùng dữ liệu xét nghiệm cũ để nghiên cứu dược học

**Chất vấn:** “Làm sao bạn có thể dựa vào dữ liệu chụp ảnh điện thoại và hồ sơ xét nghiệm cũ để phục vụ mục tiêu nghiên cứu bào chế sinh phẩm y tế hay kháng thể mới?”

**Luận điểm ban đầu:** Hệ thống lưu chỉ số xét nghiệm trong quá khứ (nhóm máu, kháng thể, panel sinh hóa). Khi có vết thương, các ca phục hồi vượt trội được liên kết để tìm đặc tính sinh học chung phục vụ nghiên cứu.

**Cơ sở khoa học & phân tích rủi ro:**

- Biến gây nhiễu lâm sàng (Confounding Variables): Liền thương chịu ảnh hưởng lớn từ tuân thủ giải phóng áp lực tì đè (Offloading Compliance), dinh dưỡng, kỹ thuật chăm sóc vô khuẩn tại nhà. Dữ liệu thụ động không chuẩn hóa sẽ có độ nhiễu lớn.
- Tính thời điểm của dữ liệu sinh học: Chỉ số cận lâm sàng cũ không phản ánh chính xác trạng thái miễn dịch cấp tính tại thời điểm phát sinh tổn thương mới.

**Giải pháp chuẩn hóa bảo vệ dự án:**

- Định vị là Sổ bộ Dữ liệu Thực chứng Đa phương thức (Multimodal Longitudinal Real-World Evidence Registry).
- Triển khai Nghiên cứu Quan sát Hồi cứu (Retrospective Observational Study): Kết hợp chuỗi ảnh vết thương theo thời gian (Δ Area / Δt) với dữ liệu bảng có tính ổn định cao: HbA1c, bệnh lý vi mạch, phân nhóm máu và kháng thể tự miễn đã xác lập.
- Sản phẩm thương mại là tập dữ liệu phân tầng nguy cơ, hỗ trợ đơn vị dược phẩm tối ưu tuyển chọn ứng viên thử nghiệm lâm sàng (Cohort Selection for Clinical Trials).

### Chủ đề 6: Rủi ro tài chính & hóa đơn viện phí bất ngờ (15.000 USD Surprise Bill)

**Chất vấn:** “Hợp đồng bảo hiểm y tế tại Mỹ có hàng trăm điều khoản loại trừ. Nếu tính năng Check Policy bảo ‘được chi trả’ nhưng sau đó bệnh nhân nhận hóa đơn nợ 15.000 USD, công ty xử lý khủng hoảng này thế nào?”

**Luận điểm ban đầu:** Đây là tính năng cần thiết để người dùng giảm áp lực tài chính và cần được kiểm nghiệm nghiêm ngặt trước khi triển khai.

**Cơ sở pháp lý & phân tích rủi ro:** Đạo luật Không Hóa đơn Bất ngờ (No Surprises Act) bảo hộ bệnh nhân trước một số chi phí ngoài mạng lưới không báo trước. Cung cấp thông tin sai dẫn đến thiệt hại tài chính có thể tạo rủi ro kiện tụng về negligent misrepresentation.

**Giải pháp chuẩn hóa bảo vệ dự án:**

- Truy vấn Dữ liệu Giao dịch Chuẩn hóa (HIPAA EDI 270/271 Real-time Query), không dùng AI tạo sinh để suy diễn hợp đồng bảo hiểm.
- Truy xuất mức khấu trừ còn lại (Remaining Deductible), tỷ lệ đồng chi trả (Co-insurance/Co-pay) và trạng thái In-Network/Out-of-Network.
- Cảnh báo Tiền Duyệt Chi Phí (Prior-Authorization Flag): Nếu mã thủ tục cần phê duyệt trước, thông báo rõ phải nhận văn bản prior authorization trước khi thực hiện dịch vụ.
- Điều khoản Miễn trừ Trách nhiệm Tài chính (Financial Safe Harbor): “Kết quả là ước tính quyền lợi tại thời điểm tra cứu; nghĩa vụ chi trả cuối cùng căn cứ vào mã danh mục thủ tục (CPT codes) do cơ sở y tế đệ trình sau ca can thiệp.”

## 5. Mô hình doanh thu & chỉ số vận hành (Business Model & KPIs)

### Các chỉ số đo lường vận hành trọng yếu

- **North Star Metric (NSM):** Số lượt hồ sơ y tế được kết nối thành công và số ca tổn thương được theo dõi định lượng an toàn mỗi tuần.
- **Độ bao phủ dữ liệu dược học:** Tỷ lệ đối chiếu thành công các loại thuốc phổ biến giữa Việt Nam và Mỹ ≥ 85%.
- **Độ chính xác mô hình Computer Vision:**
  - Dice Coefficient ≥ 0,85 cho phân đoạn ranh giới vết thương.
  - Sai số tuyệt đối trung bình (MAE) đo diện tích tổn thương < 5% so với đo lâm sàng trực tiếp bằng thước chuyên dụng.

### Bản đồ cạnh tranh

#### 1. Cổng bệnh viện truyền thống — Epic MyChart, Oracle Cerner/HealtheLife

**Mô hình & lợi thế:** Chiếm phần lớn thị phần EMR tại Mỹ; liên kết trực tiếp hệ thống phòng khám và xét nghiệm nội địa.

**Khoảng trống:** Phân mảnh tài khoản khi đổi hệ thống; hạn chế với dữ liệu quốc tế; trả về nhiều biệt ngữ như BUN/eGFR/HbA1c; không hỗ trợ xử lý ảnh vết thương tại nhà.

**Cơ hội của MediPass:** Hồ sơ trung lập do bệnh nhân làm chủ qua SMART on FHIR; bản tóm tắt IPS/QR; giải thích xét nghiệm bằng ngôn ngữ dễ hiểu.

#### 2. Big Tech Health Vaults — Apple Health, Google Health Connect

**Mô hình & lợi thế:** Tích hợp hệ điều hành iOS/Android; bảo mật phần cứng cao.

**Khoảng trống:** Khu vườn khép kín; lưu trữ thụ động; thiếu công cụ đối chiếu biệt dược quốc tế và giao tiếp tại quầy thuốc.

**Cơ hội của MediPass:** Nền tảng web/iOS/Android; AI có ngữ cảnh bệnh nền cho đánh giá rủi ro vết thương; hỗ trợ câu giao tiếp “Say this to the pharmacist”.

#### 3. Tra cứu & quản lý dược — GoodRx, Medisafe

**Mô hình & lợi thế:** Giảm giá thuốc theo toa tại Mỹ; nhắc lịch uống thuốc trực quan.

**Khoảng trống:** Thiếu ngữ cảnh xuyên biên giới; không bóc tách OTC/Rx; không tích hợp bệnh cảnh lâm sàng.

**Cơ hội của MediPass:** Ánh xạ biệt dược Việt Nam sang generic Mỹ/RxNorm; gắn nhãn OTC/Rx và hướng dẫn cơ sở y tế; cảnh báo trùng hoạt chất và dị ứng chéo.

#### 4. AI giám sát vết thương — Swift Medical, Tissue Analytics/Net Health, Healthy.io/Minuteful

**Mô hình & lợi thế:** Dẫn đầu đo đạc vết thương cho bệnh viện/Home Health; tích hợp sâu vào workflow B2B.

**Khoảng trống:** Gói enterprise đắt và khép kín; có thể cần phần cứng/thước độc quyền; dữ liệu không kết hợp với tiền sử dị ứng và bệnh nền từ hồ sơ cá nhân.

**Cơ hội của MediPass:** Tiếp cận B2B2C chi phí thấp bằng camera điện thoại và sticker chuẩn màu/kích thước; Multimodal Fusion kết hợp diện tích mô với HbA1c và bệnh mạch máu từ Medical Passport.

## Ghi chú sử dụng tài liệu

- Khi AI khác tiếp tục code, phải đối chiếu roadmap này với trạng thái thực tế trong `docs/PORTAL_AUDIT.md` trước khi nói một chức năng đã hoàn thành.
- Không biến các lập luận pháp lý trong tài liệu thành tư vấn pháp lý; cần luật sư y tế/bảo hiểm tại Mỹ và New York xác minh trước pilot.
- Không dùng dữ liệu bệnh nhân thật cho nghiên cứu/model training chỉ dựa vào Terms of Service; cần consent, de-identification, governance và IRB phù hợp.
- Không quảng bá Wound Lab hiện tại là Computer Vision: bản demo hiện chỉ lưu ảnh/lịch sử và dùng safety rules trên dữ liệu khai báo.
