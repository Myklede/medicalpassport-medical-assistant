# Kiểm định HL7 FHIR International Patient Summary của MediPass

Ngày kiểm định: 10/09/2026

Phạm vi: code xuất FHIR JSON/PDF hiện tại, tám hồ sơ tổng hợp và các tình huống dữ liệu thiếu/bất lợi

Chuẩn đối chiếu: HL7 FHIR R4 4.0.1 + International Patient Summary (IPS) 2.0.1 STU 2

## Kết luận điều hành

**Sau đợt remediation ngày 10/09/2026, cả tám fixture tổng hợp đạt 0 error và 0 warning** với HL7 FHIR Validator 6.9.12, FHIR R4 4.0.1, package `hl7.fhir.uv.ips#2.0.1`, SNOMED international và terminology server `tx.fhir.org`. Kết quả máy xác nhận các file được kiểm tra thỏa profile/terminology gate đã cấu hình; nó không phải chứng nhận sản phẩm, clinician attestation hay bằng chứng rằng dữ liệu nguồn đã đầy đủ về lâm sàng.

Nhãn phù hợp vẫn là **“preliminary IPS export / bản xuất IPS sơ bộ, chưa được bác sĩ xác nhận”**. PDF là bản trình bày cho con người có đính kèm JSON; đối tượng đạt profile là FHIR document `Bundle`, không phải lớp trình bày PDF. Không nên suy rộng kết quả tám fixture thành “certified” hoặc “clinical-grade”.

Bốn nhóm lỗi profile trực tiếp của bản audit ban đầu đã được sửa:

1. `Composition.section.code.coding.display` dùng tiêu đề giao diện thay vì display chính thức của LOINC.
2. Laboratory `Observation` thiếu `performer`, trường có cardinality tối thiểu 1 trong profile IPS.
3. Dữ liệu nhân khẩu học rỗng được ghi thành primitive rỗng thay vì bỏ phần tử hoặc dùng Data Absent Reason.
4. Ít nhất mã ATC R03AC02 có display không đúng thuật ngữ chính thức (`Salbutamol (albuterol)` thay vì `salbutamol`).

Exporter hiện dùng `emptyReason=unavailable` khi mảng nguồn của section bắt buộc rỗng và narrative nói rõ điều này không khẳng định bệnh/thuốc/dị ứng không tồn tại. `nilknown` chỉ được phép dùng về sau khi schema lưu được một xác nhận known-none thực sự cùng người xác nhận/thời điểm. [HL7 IPS: Empty Sections and Missing Data](https://hl7.org/fhir/uv/ips/2.0.1/en/Empty-Sections-and-Missing-Data.html) và [HL7 List Empty Reasons](https://terminology.hl7.org/7.1.0/CodeSystem-list-empty-reason.html) phân biệt rõ các trường hợp này.

## Phạm vi và phương pháp

Kiểm định này phân biệt năm tầng. Một file chỉ có thể được gọi là phù hợp IPS khi các tầng áp dụng đều đạt:

| Tầng | Câu hỏi | Kết quả hiện tại |
| --- | --- | --- |
| JSON/FHIR cơ bản | JSON parse được, kiểu dữ liệu và reference hợp lệ? | **Đạt trên 8 fixture**, gồm tên/MRN/DOB rỗng |
| IPS profile | Bundle/Composition/resource có thỏa cardinality, invariant và slicing của IPS 2.0.1? | **Đạt validator gate trên 8 fixture** |
| Terminology | Code system, code và display có đúng LOINC/ATC/UCUM/SNOMED không? | **0 error/0 warning trên 8 fixture**; nhiều dữ liệu nguồn vẫn chỉ có text, không có LOINC/SNOMED |
| Creator obligations | Dữ liệu biết được có được populate đầy đủ, đặc biệt performer, code, ingredient, form, provenance không? | **Đạt một phần**; performer không biết dùng DAR, provenance/form/strength còn thiếu từ schema |
| An toàn ngữ nghĩa/vận hành | Trạng thái, thời gian, “không có/không biết”, privacy, attestation và versioning có đúng sự thật không? | **Đã giảm suy diễn**, nhưng chưa đủ cho sử dụng lâm sàng production |

Nguồn chuẩn chính là bản phát hành [IPS 2.0.1](https://hl7.org/fhir/uv/ips/en/), dựa trên FHIR R4 4.0.1. IPS được thiết kế là một tập dữ liệu tóm tắt tối thiểu, không toàn diện, phục vụ chăm sóc không lên kế hoạch và trao đổi xuyên biên giới. Ba section bắt buộc là Problems, Allergies/Intolerances và Medication Summary; Immunizations, Diagnostic Results, Procedures và Medical Devices là các section được khuyến nghị. [Cấu trúc IPS](https://hl7.org/fhir/uv/ips/en/Structure-of-the-International-Patient-Summary.html)

Kiểm định máy sử dụng FHIR Validator 6.9.12, gói `hl7.fhir.uv.ips#2.0.1`, FHIR `4.0.1`, SNOMED international và terminology server `https://tx.fhir.org`. Đây là validator do HL7 duy trì và repository mô tả nó là implementation chuẩn có thẩm quyền của FHIR core. [HL7-maintained FHIR Validator](https://github.com/hapifhir/org.hl7.fhir.core)

Lệnh chính:

```bash
java -Xmx4g -jar validator_cli.jar INPUT.json \
  -version 4.0.1 \
  -ig hl7.fhir.uv.ips#2.0.1 \
  -sct intl \
  -check-ips-codes \
  -tx https://tx.fhir.org
```

Chỉ dữ liệu giả/de-identified được dùng. Các fixture, validator JAR và OperationOutcome nằm trong `tmp/ips-audit/`, đã bị Git ignore.

## Kết quả FHIR Validator

### Sau remediation

| Fixture tổng hợp | Error | Warning | Kết quả |
| --- | ---: | ---: | --- |
| 5 hồ sơ seed | 0 | 0 | Pass |
| Ba section bắt buộc đều trống | 0 | 0 | Pass với `emptyReason=unavailable` |
| Thiếu MRN, tên và ngày sinh | 0 | 0 | Pass với omit identifier + Data Absent Reason |
| Đổi liều thuốc rồi ngừng liều mới | 0 | 0 | Pass; liều active cũ không còn bị xuất |

Validator vẫn trả các message mức `information`, chủ yếu về profile matching/vital-sign profiles và medication coding preferred binding; không có error hoặc warning. OperationOutcome tổng hợp được lưu tạm tại `tmp/ips-audit/all-remediated-terminology-outcome.json` và không commit.

### Trước remediation — bằng chứng audit ban đầu

| Fixture tổng hợp | Error | Warning khi chạy không có terminology server | Ghi chú chính |
| --- | ---: | ---: | --- |
| Không có dữ liệu ở ba section bắt buộc | 4 | 0 | 3 display LOINC sai + Composition slice lỗi dây chuyền |
| Đổi liều thuốc rồi ngừng | 9 | 15 | Display section, lab performer, cảnh báo terminology/vital |
| Thiếu MRN, tên, ngày sinh | 12 | 0 | Primitive rỗng; Patient và Composition không match slice |
| Seed patient Anh | 9 | 12 | Display section, display ATC, Medication/Composition slice dây chuyền |
| Seed patient Bảo | 7 | 13 | Display section và lab performer |
| Seed patient Linh | 7 | 11 | Display section |
| Seed patient Quỳnh | 8 | 13 | Display section và lab performer |
| Seed patient Tuấn | 9 | 15 | Display section và lab performer |

Các con số trên bao gồm lỗi dây chuyền: khi `Composition` có lỗi, validator không thể match entry đó vào slice `Bundle.entry:composition`. Vì vậy không được cộng mọi dòng lỗi như những nguyên nhân độc lập.

Hai lần kiểm định đầy đủ có terminology server xác nhận:

- Seed Anh: 9 errors, 5 warnings, 20 informational.
- Seed Tuấn: 10 errors, 8 warnings, 23 informational.

Để tìm lỗi ẩn, audit tạo các bản sao trong thư mục tạm và **chỉ** sửa bốn nhóm lỗi profile tối thiểu: display LOINC, lab performer bằng Data Absent Reason khi chưa rõ, primitive Patient bằng Data Absent Reason, và display ATC đã biết. Sau đó:

- Cả tám biến thể: 0 error trong kiểm định profile offline.
- Hai biến thể Anh/Tuấn kiểm tra trực tuyến: 0 error, mỗi file còn 5 best-practice warnings vì các vital-sign Observations không có performer.

Các thử nghiệm sửa tạm này là cơ sở cho remediation đã được đưa vào implementation và kiểm định lại ở bảng “Sau remediation” phía trên.

## Những phần đang làm đúng

| Thành phần | Đánh giá |
| --- | --- |
| Bundle | Có profile IPS 2.0.1, `type=document`, identifier, timestamp và Composition ở entry đầu |
| Composition | Dùng LOINC 60591-5, có subject, author, title, date, status `preliminary` và custodian |
| Required sections | Luôn có Problems, Allergies/Intolerances và Medications; có `emptyReason` khi không có entry |
| Narrative | Mọi section được đưa vào đều có XHTML `section.text`; dữ liệu nguồn được escape XML |
| References | Subject, author, section entry và Medication reference đều được đóng gói trong Bundle bằng `urn:uuid:` |
| Patient name | Với tên hợp lệ, `name.text` thỏa invariant tên đa văn hóa của IPS |
| Gender | `unspecified` được map thành FHIR `unknown`, thuộc required administrative-gender value set |
| Condition/lab code chưa map | Giữ `CodeableConcept.text` thay vì đoán code. Với binding example/preferred/extensible, IPS cho phép text-only khi nguồn có text nhưng không có code |
| Medication mapping | Chỉ map INN/ATC khi tên khớp alias đã duyệt; tên lạ được giữ nguyên, không tự bịa mã |
| Vital units | Các vital numeric đã dùng LOINC và UCUM cho huyết áp, nhịp tim, nhiệt độ, cân nặng và SpO₂ |
| Disclaimer | PDF ghi rõ sơ bộ, chưa clinician-attested, không dùng để tự thay đổi thuốc và cần bác sĩ/dược sĩ đối chiếu |
| API | Ownership check diễn ra trước export; response là `private, no-store`; JSON dùng `application/fhir+json` |

FHIR document bắt buộc là Bundle `document`, Composition đứng đầu và các resource được Composition reference phải nằm trong Bundle. Narrative section là nội dung an toàn quan trọng khi bên nhận không xử lý được dữ liệu máy. [FHIR R4 Documents](https://hl7.org/fhir/R4/documents.html), [IPS Bundle profile](https://hl7.org/fhir/uv/ips/en/StructureDefinition-Bundle-uv-ips.html), [IPS narrative guidance](https://hl7.org/fhir/uv/ips/en/Design-Conventions.html)

## Phát hiện ưu tiên và trạng thái remediation

Các tiểu mục dưới đây giữ lại chẩn đoán của **bản trước remediation** để truy vết. Số dòng và các câu “code hiện tại” trong phần chẩn đoán lịch sử không còn mô tả source mới nhất. Trạng thái source mới nhất:

| Phát hiện | Trạng thái hiện tại |
| --- | --- |
| Display LOINC của section | Đã dùng display chính thức và qua terminology validation |
| Auto-`nilknown` khi array rỗng | Đã thay bằng `unavailable`; narrative/PDF không khẳng định absence |
| Lab thiếu performer | Đã thêm explicit unknown performer + Data Absent Reason; cần schema lưu performer thật |
| Patient primitive rỗng | Đã omit identifier rỗng và dùng DAR cho name/DOB |
| Lab/procedure/plan status và thời gian bị suy diễn | Lab/procedure/plan dùng `unknown`; lab effective time dùng DAR; không còn UTC midnight giả |
| Allergy reaction giả | Đã bỏ `reaction` khi nguồn không có reaction |
| Medication đổi liều rồi ngừng | Đã reconcile theo identity + route, không còn dùng dose trong khóa supersession |
| ATC display không chính xác | Đã bỏ display không chắc chắn; giữ system/code và tên gốc/INN ở text/ingredient |
| Vital partial/malformed | Đã chọn latest hợp lệ theo từng loại; PDF và FHIR dùng cùng snapshot đã lọc; performer dùng DAR |
| Hard-code confidentiality `N` | Đã bỏ; production vẫn cần consent/redaction/security high-water mark |

### Các lỗi P0 của bản trước remediation

#### P0.1 — Display LOINC của section không hợp lệ — đã sửa

`lib/ips.ts:294-305` gán `coding.display = title`. Title là nhãn UI, không phải display của code system. Ví dụ:

| LOINC | Hiện tại | Display được validator chấp nhận |
| --- | --- | --- |
| 11450-4 | Problem List | Problem list - Reported |
| 48765-2 | Allergies and Intolerances | Allergies and adverse reactions Document |
| 10160-0 | Medication Summary | History of Medication use Narrative |
| 30954-2 | Diagnostic Results | Relevant diagnostic tests/laboratory data note |
| 47519-4 | History of Procedures | History of Procedures Document |
| 8716-3 | Vital Signs | Vital signs note |
| 18776-5 | Plan of Care | Plan of care note |

`section.title` có thể giữ tên thân thiện; `coding.display` phải là display chuẩn hoặc nên bỏ nếu không thể bảo đảm chính xác.

#### P0.2 — `nilknown` được suy ra từ “0 dòng database” — đã sửa

`lib/ips.ts:294-321` luôn dùng `nilknown` nếu required section không có reference. Code không có dữ liệu để biết danh sách đã được hỏi/đối chiếu hay chưa.

Hậu quả có thể xảy ra:

- Không tải được dữ liệu do lỗi backend nhưng FHIR nói “không có bệnh/dị ứng/thuốc đã biết”.
- Hồ sơ mới chưa hỏi dị ứng nhưng FHIR nói “no known allergy”.
- Conditions chung rỗng nhưng encounter có chẩn đoán dạng text; FHIR vẫn nói “nil known problems”.
- Thuốc đổi tên/đổi liều bị thuật toán bỏ khỏi active list; section có thể chuyển thành “nil known medications”.
- Dữ liệu bị redaction vì consent được trình bày như không có.

PDF hiện thận trọng hơn JSON ở phần dị ứng: `lib/ips-pdf.ts:430-434` nói không có entry nguồn và không chứng minh không có dị ứng. Vì vậy narrative/PDF và machine-readable `emptyReason=nilknown` đang mâu thuẫn về ý nghĩa.

Theo HL7, khi hệ thống nguồn đơn giản là không có thông tin, lựa chọn thường là `unavailable` hoặc `notasked`; `nilknown` chỉ dùng sau đánh giá hợp lý. [Empty Sections and Missing Data](https://hl7.org/fhir/uv/ips/2.0.1/en/Empty-Sections-and-Missing-Data.html), [List Empty Reasons](https://terminology.hl7.org/7.1.0/CodeSystem-list-empty-reason.html)

#### P0.3 — Laboratory Observation thiếu performer — đã sửa bằng fallback DAR

`lib/ips.ts:624-670` tạo lab Observation nhưng không có `performer`. Profile IPS 2.0.1 yêu cầu `Observation.performer` tối thiểu một phần tử; validator phát hiện 9 instance thiếu performer trong bốn fixture có lab. Performer là bên chịu trách nhiệm khẳng định kết quả là đúng. [Observation Results Laboratory/Pathology IPS](https://hl7.org/fhir/uv/ips/en/StructureDefinition-Observation-results-laboratory-pathology-uv-ips-definitions.html)

Giải pháp ưu tiên là lưu và reference phòng xét nghiệm/organization/practitioner thật. Nếu thực sự không biết, audit đã kiểm chứng mẫu `performer` có display “Unknown performer” và Data Absent Reason `unknown` loại bỏ lỗi cardinality/profile. Không được gán MediPass làm performer của xét nghiệm chỉ để qua validator.

#### P0.4 — Trường Patient rỗng tạo FHIR không hợp lệ — đã sửa

`lib/ips.ts:416-424` luôn serialize identifier value, name text và birthDate. Fixture thiếu dữ liệu tạo `"value":""`, `"text":""`, `"birthDate":""`; validator báo `ele-1`, empty value, Patient slice và Bundle patient slice lỗi.

API ghi patient mới có validation bắt buộc (`lib/portal-validation.ts:62-70`), nhưng endpoint export đọc dữ liệu lưu trữ rồi build trực tiếp (`app/api/portal/ips/route.ts:50-58`). Legacy/corrupt/imported data vẫn có thể lọt vào exporter.

HL7 quy định required primitive không biết phải dùng Data Absent Reason trên property sibling, ví dụ `_birthDate`; optional identifier thiếu thì bỏ hẳn, không xuất chuỗi rỗng. Audit đã kiểm chứng mẫu `_text` và `_birthDate` với DAR `unknown`: mọi lỗi Patient biến mất. [IPS missing required data](https://hl7.org/fhir/uv/ips/2.0.1/en/Empty-Sections-and-Missing-Data.html), [Patient IPS profile](https://hl7.org/fhir/uv/ips/en/StructureDefinition-Patient-uv-ips-definitions.html)

#### P0.5 — Một số trạng thái lâm sàng bị tự khẳng định — đã giảm thiểu, còn giới hạn schema

Các modifier/status có thể đảo ngược ý nghĩa của resource. Code hiện tại gán:

- mọi lab là `final` (`lib/ips.ts:636`), dù source model không có result status;
- mọi procedure là `completed` (`lib/ips.ts:683`), dù source chỉ có tên/result;
- mọi allergy là `active`, `unconfirmed`, `type=allergy` (`lib/ips.ts:505-524`);
- mọi condition có verification `unconfirmed` (`lib/ips.ts:471-479`);
- mọi MedicationStatement được xuất là `active` (`lib/ips.ts:586`).

Không được suy `final`, `completed`, `active`, `allergy` hoặc “đã xác nhận” khi nguồn không có trường tương ứng. IPS yêu cầu bên nhận phải diễn giải đúng modifier elements; một kết quả preliminary không tương đương final, medication stopped không tương đương active. [IPS General Principles](https://hl7.org/fhir/uv/ips/en/General-Principles.html)

### P1 — khoảng trống còn lại dù profile fixture đã qua validator

#### Thuốc

- `Medication.code` dùng WHO ATC làm coding duy nhất khi map được. IPS dùng SNOMED medicinal product/unknown làm binding chính dạng preferred; WHO ATC là additional candidate binding. ATC có thể bổ sung nhưng không nên là bằng chứng duy nhất cho một sản phẩm, hàm lượng và dạng bào chế cụ thể. [Medication IPS profile](https://hl7.org/fhir/uv/ips/en/StructureDefinition-Medication-uv-ips.html)
- INN hiện chỉ nằm trong `code.text`; không có `Medication.ingredient`, strength hoặc form dù catalog có thể biết một phần. IPS Creator có nghĩa vụ populate form/ingredient nếu biết.
- `effectivePeriod.start` dùng ngày encounter (`lib/ips.ts:592`), không phải thời gian bệnh nhân thực sự bắt đầu dùng thuốc. Profile định nghĩa effective là khoảng thời gian thuốc được/đã/sẽ được dùng. [MedicationStatement IPS](https://hl7.org/fhir/uv/ips/en/StructureDefinition-MedicationStatement-uv-ips-definitions.html)
- Thuật toán active list dùng khóa `name|dose|route` (`lib/ips.ts:128-147`). Một record mới “Metformin 1000 mg — stopped” không supersede record cũ “Metformin 500 mg — active”, nên bản tóm tắt có thể xuất thuốc cũ là active.
- Brand/generic alias, khác dấu câu, combo product và khác delivery device có thể tạo duplicate hoặc hợp nhất sai. Không được gọi ATC/INN là tương đương điều trị.

#### Dị ứng và bệnh nền

- Source schema không phân biệt allergy với intolerance, không có criticality, onset, recordedDate, source, verification workflow hoặc history/resolution.
- Nếu reaction trống, code vẫn tạo `reaction.manifestation.text="Reaction not recorded"` (`lib/ips.ts:526-534`). Điều này tạo một reaction event giả thay vì bỏ optional reaction và nói rõ thiếu dữ liệu ở narrative.
- IPS yêu cầu ít nhất current và relevant historical allergies/adverse reactions. Chỉ xuất mảng patient hiện tại có thể bỏ mất allergy đã resolved nhưng vẫn quan trọng.
- Condition code text-only có thể hợp lệ khi chưa map, nhưng khả năng machine translation/decision support thấp. Cần SNOMED CT/ICD mapping có provenance, không suy đoán.
- Encounter diagnosis đang là text riêng và không tham gia problem list. Nếu shared conditions rỗng nhưng encounter có diagnosis, required problem section có thể phát biểu sai là `nilknown`.

#### Xét nghiệm và vital signs

- Lab code chỉ là text; không có LOINC. Text-only có thể hợp lệ vì binding preferred, nhưng giảm interoperability.
- Numeric lab `valueQuantity` và reference range chỉ có `unit` text, thiếu UCUM `system`/`code` (`lib/ips.ts:365-389`, `653-656`). Hai đơn vị có tên giống nhau không bảo đảm cùng đại lượng/quy đổi.
- Ngày encounter bị biến thành `effectiveDateTime` lúc `00:00:00Z` (`lib/ips.ts:650`). Đây không phải collection/result time và có thể hiển thị thành ngày hôm trước ở timezone khác. Nếu chỉ biết ngày, dùng precision đúng của FHIR dateTime hoặc biểu diễn Data Absent Reason cho phần không biết; không bịa UTC midnight.
- Latest result dùng exact normalized test name (`lib/ips.ts:150-165`). “HbA1c”, “Hemoglobin A1c” và mã LOINC tương đương có thể bị xem là ba xét nghiệm khác nhau.
- Một kết quả amended/corrected/preliminary bị xuất thành final có thể dẫn đến bác sĩ dùng số liệu chưa hoàn tất.
- Vitals lấy toàn bộ từ encounter gần nhất có **bất kỳ** vital nào (`lib/ips.ts:186-235`); nếu visit mới chỉ có pulse, BP gần nhất ở visit trước biến mất.
- Malformed vital vẫn xuất trong PDF snapshot nhưng bị bỏ khỏi FHIR resource (`lib/ips.ts:706-710`, `758-760`). Nếu không còn reference, optional FHIR section bị bỏ hoàn toàn trong khi PDF vẫn hiển thị raw value.
- Vital Observations không có performer. Đây là best-practice warning ở validator; cần lưu nguồn đo hoặc DAR có chủ đích.

#### Procedure và plan

- Procedure deduplicate theo tên và chỉ giữ lần gần nhất (`lib/ips.ts:168-183`). Lặp lại phẫu thuật, dialysis hoặc thủ thuật ở vị trí khác có thể bị mất.
- `performedDateTime` được suy từ encounter date và bịa `00:00:00Z` (`lib/ips.ts:686`).
- CarePlan luôn `active`, period bắt đầu từ encounter date (`lib/ips.ts:822-830`) dù plan có thể đã hoàn tất, bị thay thế hoặc chỉ là lời dặn theo dõi.

#### Provenance, attestation, privacy và document lifecycle

- `status=preliminary` và không có attester là cách gắn nhãn an toàn cho demo; không được trình bày như clinician-signed IPS.
- Chỉ có Organization “MediPass Demo” làm author/custodian; không có Provenance phân biệt patient-reported, imported, clinician-authored và verified. IPS cho phép automated author nhưng provenance chi tiết cần thiết để đánh giá độ tin cậy. [IPS provenance guidance](https://hl7.org/fhir/uv/ips/en/Design-Conventions.html)
- `confidentiality='N'` bị hard-code (`lib/ips.ts:930`). Nội dung mental health, substance use hoặc sexual health không tự động là “normal confidentiality”. Cần security tags theo resource, Bundle high-water mark và chính sách consent/redaction.
- Redaction không được biến thành `nilknown`; dùng `withheld`/`masked` phù hợp và narrative không được rò rỉ dữ liệu đã che. HL7 nhấn mạnh privacy redaction có thể tăng rủi ro an toàn y tế. [IPS Privacy and Security](https://hl7.org/fhir/uv/ips/en/Privacy-and-Security-Considerations.html)
- Mỗi export tạo identifier mới. Điều này hợp lệ như document mới, nhưng chưa có persisted document registry, version/replacement chain, signature hoặc cách biết bản nào supersede bản nào. FHIR document là immutable và document identifier không được tái sử dụng. [FHIR R4 Documents](https://hl7.org/fhir/R4/documents.html)
- IPS khuyến nghị `$summary` bằng POST hoặc `$docref`; endpoint GET tùy chỉnh của MediPass không làm file sai chuẩn, nhưng không phải API interoperable chuẩn. [IPS Generation and Data Inclusion](https://hl7.org/fhir/uv/ips/en/Generation-and-Data-Inclusion.html)
- IPS là tài liệu thông tin, không phải medication order/CarePlan có thể thực thi trực tiếp. [IPS General Principles](https://hl7.org/fhir/uv/ips/en/General-Principles.html)

## Cách IPS phải hiển thị khi thiếu dữ liệu

### Ma trận quyết định cho section

| Tình trạng thật | Biểu diễn FHIR | Narrative/PDF phải nói | Không được làm |
| --- | --- | --- | --- |
| Đã hỏi/đối chiếu hợp lý và xác nhận không có mục nào | Required section + `emptyReason=nilknown`, hoặc resource SNOMED “no known …” phù hợp | “Đã đối chiếu: không ghi nhận … đã biết” + ai xác nhận/thời điểm | Suy từ mảng rỗng |
| Chưa từng hỏi | Required section + `emptyReason=notasked` | “Chưa thu thập/chưa hỏi” | `nilknown` |
| Không thể lấy thông tin, ví dụ bệnh nhân bất tỉnh/hệ thống nguồn không truy cập được | Required section + `emptyReason=unavailable` | “Không thể truy xuất tại thời điểm xuất” | “Không có” |
| Bị giữ lại vì privacy/consent | Required section + `emptyReason=withheld` hoặc coded DAR `masked` ở phần tử phù hợp | “Một số thông tin không được cung cấp theo quyền truy cập” nếu policy cho phép nói vậy | `nilknown`; để narrative rò rỉ nội dung |
| Công việc thu thập chưa bắt đầu | `emptyReason=notstarted` khi đúng workflow | “Thu thập chưa bắt đầu” | Dùng như alias chung cho unknown |
| Có một phần dữ liệu | `section.entry` cho dữ liệu biết được; narrative nói phạm vi/độ đầy đủ; **không có emptyReason** | “Dữ liệu có thể chưa đầy đủ; nguồn/thời điểm …” | Vừa `entry` vừa `emptyReason` |
| Optional section không có dữ liệu | Bỏ section | Có thể không hiển thị section hoặc UI ghi “không có dữ liệu nguồn” ngoài FHIR attested content | Bắt buộc tạo section trống không cần thiết |

`ips-comp-1` yêu cầu ba section bắt buộc phải có entry hoặc emptyReason; `cmp-2` không cho dùng emptyReason khi section có entry. Mọi section đã đưa vào phải có XHTML `section.text`. [IPS Composition definitions](https://hl7.org/fhir/uv/ips/en/StructureDefinition-Composition-uv-ips-definitions.html), [Empty Sections and Missing Data](https://hl7.org/fhir/uv/ips/2.0.1/en/Empty-Sections-and-Missing-Data.html)

### Ma trận quyết định cho element/resource

| Dữ liệu thiếu | Cách biểu diễn |
| --- | --- |
| Optional element không biết/không phù hợp | Bỏ element; không xuất chuỗi rỗng/null giả |
| Required primitive như birthDate không biết | Bỏ `birthDate`, dùng `_birthDate.extension` Data Absent Reason |
| Tên bệnh nhân không biết | Không dùng `name.text=""`; dùng HumanName với Data Absent Reason trên primitive (`_text`) theo policy đã qua validator, đồng thời narrative nói rõ unavailable |
| Administrative gender không biết | Dùng code `unknown` của required value set, như code hiện tại đang làm |
| MRN/identifier không có | Bỏ `identifier`; không dùng empty value. Cần cơ chế patient matching khác và cảnh báo identity confidence |
| Required coded element có text thật nhưng chưa map, binding example/preferred/extensible | Dùng `CodeableConcept.text` với text nguồn; không bịa code |
| Required coded element không có text lẫn code | Dùng exceptional code trong bound value set; nếu không có thì Data Absent Reason code phù hợp |
| Lab value không có | Không tạo `valueString=""`; dùng `Observation.dataAbsentReason` và status/time/source đúng sự thật |
| Lab performer không biết | Tốt nhất thu thập Organization/Practitioner thật; fallback validator-proven là Reference có display rõ “Unknown performer” và DAR `unknown` |
| Dữ liệu không được phép chia sẻ | DAR `masked`/`not-permitted` theo context, security tags và narrative đã redaction |

Ví dụ birthDate không biết:

```json
{
  "resourceType": "Patient",
  "_birthDate": {
    "extension": [{
      "url": "http://hl7.org/fhir/StructureDefinition/data-absent-reason",
      "valueCode": "unknown"
    }]
  }
}
```

Data Absent Reason phân biệt `unknown`, `asked-unknown`, `temp-unknown`, `not-asked`, `asked-declined`, `masked`, `not-applicable`, `unsupported`, `as-text`, `error`, `not-performed` và `not-permitted`. Chọn code theo sự thật và provenance, không dùng một code mặc định cho mọi trường hợp. [HL7 DataAbsentReason](https://terminology.hl7.org/en/CodeSystem-data-absent-reason.json.html)

## Threat model và tình huống bất lợi

Không thể chứng minh “mọi tình huống có thể xảy ra” chỉ bằng fixture. Bảng dưới là threat model hệ thống cho các failure mode có thể dự đoán từ schema và exporter hiện tại. `P0` là nguy cơ có thể làm sai nghĩa lâm sàng hoặc chặn conformance; `P1` là nguy cơ interoperability/độ tin cậy cao; `P2` là vận hành/UX cần kiểm soát.

| Nhóm | Tình huống bất lợi | Hành vi hiện tại | Mức | Kiểm soát yêu cầu |
| --- | --- | --- | --- | --- |
| Identity | Tên/DOB/MRN rỗng từ legacy/import | Primitive rỗng, invalid FHIR | P0 | Pre-export validation + DAR/omit đúng chuẩn |
| Identity | Hai bệnh nhân trùng MRN | Không có cross-record identity reconciliation | P0 | Identifier namespace thật, duplicate check, match confidence |
| Identity | Patient query đúng ID nhưng encounter chứa sai patient | Snapshot filter theo patient ID giúp giảm rủi ro | P1 | Referential integrity DB + test orphan/mismatch |
| Identity | Ngày sinh partial/ước tính | Source bắt YYYY-MM-DD chính xác | P1 | Cho phép precision phù hợp hoặc recorded estimate/provenance |
| Required sections | Database rỗng vì chưa hỏi | Tự phát `nilknown` | P0 | Lưu absence status + attester/time |
| Required sections | Supabase/RPC trả partial data | Có thể bị hiểu là không có | P0 | Fail closed; không export summary từ partial response |
| Required sections | Data bị privacy redaction | Có thể bị hiểu là không có | P0 | `withheld`/`masked`, security labels, safe narrative |
| Required sections | Có diagnosis text nhưng condition list rỗng | Problem section `nilknown` | P0 | Reconcile encounter diagnoses vào problem workflow |
| Allergy | Chưa ghi reaction | Tạo reaction event “Reaction not recorded” | P0 | Bỏ optional reaction; narrative/DAR đúng cấp |
| Allergy | Intolerance bị nhập như allergy | Hard-code `type=allergy` | P0 | Schema type + verified mapping |
| Allergy | Allergy resolved nhưng vẫn clinically relevant | Source không lưu history đầy đủ | P0 | Historical/relevant policy + clinicalStatus/verification |
| Allergy | Mâu thuẫn “NKA” và allergy cụ thể | Không có conflict detector | P0 | Chặn export/require reconciliation |
| Medication | Tăng liều rồi ngừng liều mới | Liều cũ có thể còn active | P0 | Medication identity + status event/reconciliation |
| Medication | Cùng thuốc brand/generic | Có thể duplicate | P1 | Product/ingredient identity, RxNorm/SNOMED/local code |
| Medication | ATC cùng nhóm nhưng sản phẩm khác form/strength | Dễ bị hiểu là tương đương | P0 | ATC chỉ bổ sung; ingredient/form/strength/route bắt buộc nếu biết |
| Medication | Unknown start/end date | Encounter date bị dùng làm start | P0 | Lưu effective period thật hoặc DAR/omit |
| Medication | Held/stopped/unknown status | Snapshot chỉ xuất active hoặc bỏ | P0 | Preserve modifier status and clinically relevant history |
| Medication | Combo product/excipient allergy | Catalog INN/ATC không đủ | P0 | Ingredient list, strength, form, device, excipient warning |
| Lab | Source không có status | Tự gán final | P0 | Lưu status; nếu unknown dùng valid exceptional status/policy |
| Lab | Performer thiếu | Invalid IPS profile | P0 | Organization/Practitioner reference hoặc validated DAR |
| Lab | Value thiếu/non-numeric/qualitative | Có thể thành valueString không chuẩn hóa | P1 | valueCodeableConcept/DAR; preserve original text |
| Lab | Unit local/ambiguous | Thiếu UCUM code | P0 | Normalize UCUM, giữ original unit, conversion provenance |
| Lab | Result amended/corrected sau export | Không có replacement tracking | P0 | status/version/provenance, supersession warning |
| Lab | Visit date khác collection/result date | Bịa midnight UTC | P0 | Lưu effective/issued riêng với đúng precision/timezone |
| Lab | Test aliases | Có thể duplicate/stale | P1 | LOINC identity + specimen/method context |
| Lab | Reference range khác tuổi/giới/method | Copy range nhưng thiếu context | P1 | Preserve source range, method/specimen/lab and comments |
| Vital | Latest visit chỉ có một vital | Các vital cũ hữu ích bị bỏ | P1 | Per-code latest logic hoặc encounter panel rõ ràng |
| Vital | Giá trị malformed | PDF/FHIR bất nhất | P0 | Validation, DAR/error state, single source for narrative/resource |
| Procedure | Lặp procedure cùng tên | Bị deduplicate | P1 | Preserve event identity/time/body site |
| Procedure | Status unknown | Tự gán completed | P0 | Lưu và map status; không suy diễn |
| Plan | Plan cũ/hết hiệu lực | Tự gán active | P0 | status/period/author/version thật |
| Narrative | Structured code khác narrative | Có thể đưa hai kết luận khác nhau | P0 | Generate both from same typed model; consistency tests |
| Language | Receiver không đọc tiếng nguồn | Không có `language`/translation metadata | P1 | Source-language narrative + tagged translation; giữ source of truth |
| Provenance | Patient tự khai bị hiểu là clinician xác nhận | Chỉ organization generator làm author | P0 | Resource provenance/source/verification + attester workflow |
| Privacy | Nội dung nhạy cảm nhưng confidentiality N | Hard-code N | P0 | Resource security tags + calculated Bundle high-water mark |
| Privacy | Redact resource nhưng narrative còn text | Chưa có redaction engine | P0 | Redact structured/narrative atomically, privacy tests |
| Lifecycle | Hai export gần nhau khác identifier, không biết bản mới | Không có registry/supersession | P1 | Persist metadata, version/relatesTo, immutable artifact storage |
| Concurrency | Record đổi trong lúc người dùng tải | Không có user-visible source version | P1 | Atomic snapshot + patient/encounter version manifest |
| Delivery | Bên nhận chỉ thấy PDF, không extract attachment | Không có tiêu chuẩn nhận PDF được tuyên bố | P2 | Cung cấp JSON riêng/QR secure link; gọi PDF là companion |
| API | FHIR client gọi `$summary` | Endpoint GET tùy chỉnh | P2 | Thêm standard operation sau khi artifact đạt chuẩn |
| Terminology | tx server/SNOMED unavailable | Không có release gate ổn định | P1 | Pinned packages/cache, offline structural + controlled terminology CI |
| Scale | Hồ sơ rất lớn/PDF nhiều trang | Chưa có relevance/size policy rõ | P2 | Deterministic relevance rules, limits, pagination only outside document |
| Security | Server secret bị lộ | Có thể truy cập vượt RLS | P0 | Rotate/revoke ngay; secrets manager; audit logs; không dùng lại key |

### Các invariant nghiệp vụ nên thêm

1. Không bao giờ sinh `nilknown` chỉ vì array rỗng.
2. `section.entry` và `section.emptyReason` loại trừ lẫn nhau.
3. Narrative section và resource references phải được tạo từ cùng một tập item sau validation.
4. Không xuất primitive chuỗi rỗng.
5. Không gán modifier/status không có trong nguồn.
6. Một medication status event mới phải supersede đúng product/ingredient identity, không phụ thuộc dose text.
7. Không có NKA cùng lúc với một allergy cụ thể chưa resolved.
8. Laboratory Observation phải có actual performer hoặc explicit DAR đã qua validator.
9. Numeric lab có unit đã chuẩn hóa phải có UCUM system/code; unit không map được phải giữ original và đánh dấu unmapped.
10. Mỗi export phải ghi rõ source versions, thời điểm snapshot, author, attestation và mức completeness.
11. Nếu đọc dữ liệu partial/lỗi, export phải thất bại; không chuyển lỗi kỹ thuật thành clinical absence.
12. Mọi artifact phát hành phải đạt zero validator errors với package/terminology version đã pin.

## Khoảng trống của source schema

Exporter không thể tạo IPS an toàn chỉ bằng sửa JSON nếu database không lưu các khái niệm cần thiết. `lib/portal-types.ts` hiện thiếu:

- absence state cho từng required section: known-none / not-asked / unavailable / withheld + assertedBy + assertedAt;
- terminology triplet `system/code/display` và original local code;
- source/provenance/verification cho condition, allergy, medication, lab và procedure;
- allergy type, clinical status, verification status, criticality, onset/history;
- medication product identity, ingredient(s), strength, form, start/end, status event, reason, source;
- lab LOINC, UCUM, status, effective/issued time, performer, specimen, method và report linkage;
- procedure status, performed time/period, body site và performer;
- document version, attester, consent/redaction/security labels và source record version manifest.

Vì vậy roadmap cần tách hai bước: (1) mở rộng schema và workflow nhập/reconciliation; (2) sửa mapper FHIR. Chỉ sửa formatter để validator xanh sẽ tạo “syntactic conformance” nhưng vẫn có thể sai lâm sàng.

## Điều kiện nghiệm thu trước khi đổi nhãn thành “HL7 FHIR IPS”

### Release blockers

1. Sửa mọi lỗi validator trực tiếp và thêm validator chính thức vào CI.
2. Thêm model absence state; không còn auto-`nilknown`.
3. Không còn hard-code clinical modifiers/status khi nguồn không biết.
4. Lưu/mapping lab performer; thêm LOINC/UCUM khi biết.
5. Sửa medication reconciliation theo identity, status timeline và effective period.
6. Bỏ reaction giả; lưu allergy/intolerance/status/criticality/provenance.
7. Pre-export validation phải fail closed nếu Supabase trả partial/corrupt data.
8. Narrative/PDF và structured Bundle phải qua consistency tests.

### Bộ fixture tối thiểu

- Known no allergies, unknown allergies, not asked, unavailable, withheld.
- Không có medication sau reconciliation; unknown medication; active/stopped/on-hold; dose change; brand/generic; combo drug.
- Condition active/resolved/refuted và encounter diagnosis chưa reconcile.
- Patient thiếu name/DOB/identifier; partial DOB; Unicode/CJK/Vietnamese names; duplicate MRN.
- Lab numeric/qualitative/no value, missing/unknown performer, preliminary/final/amended/corrected, UCUM mapped/unmapped, timezone/partial date.
- Procedure status/time unknown; repeated procedures.
- Malformed vital, partial vital panel, extreme numeric value.
- Redacted sensitive item, narrative redaction, security high-water mark.
- Broken/orphan/duplicate references, duplicate fullUrl, invalid UUID, Composition không đứng đầu.
- Concurrent edit/version conflict, partial Supabase read, terminology server unavailable, oversized record.

### Cổng kiểm định

- FHIR Validator: zero errors cho mọi fixture với `hl7.fhir.uv.ips#2.0.1` và terminology server kiểm soát.
- Không cho phép warning mới ngoài allowlist có lý do; mục tiêu loại warning vital performer.
- Unit/property tests cho invariant absence, reference integrity, narrative equality và medication supersession.
- Clinical review bởi bác sĩ/dược sĩ cho relevance rules, allergy/medication reconciliation và wording.
- Security/privacy review cho consent, redaction, logging, download/share và key management.
- Interoperability test với ít nhất hai consumer FHIR độc lập; không chỉ tự đọc file của chính MediPass.

## Ghi chú sản phẩm

- IPS không phải hồ sơ đầy đủ và không bảo đảm bác sĩ sẽ không yêu cầu xét nghiệm lại. Bác sĩ vẫn phải đánh giá recency, quality, method, clinical context và khả năng xác minh nguồn. [IPS Generation and Data Inclusion](https://hl7.org/fhir/uv/ips/en/Generation-and-Data-Inclusion.html)
- Narrative là fallback an toàn và source of truth khi trao đổi xuyên biên giới; translation có thể bổ sung nhưng bên nhận không được giả định luôn có bản dịch. [IPS Design Conventions](https://hl7.org/fhir/uv/ips/en/Design-Conventions.html)
- Current disclaimer và nhãn `preliminary` phải được giữ cho đến khi có clinician attestation/signature workflow.
- Secret Supabase có quyền cao đã từng được gửi trong hội thoại phải được rotate/revoke; báo cáo này không lặp lại secret đó.

## Nguồn chính

1. [HL7 International Patient Summary 2.0.1](https://hl7.org/fhir/uv/ips/en/)
2. [Structure of the International Patient Summary](https://hl7.org/fhir/uv/ips/en/Structure-of-the-International-Patient-Summary.html)
3. [Bundle (IPS) profile](https://hl7.org/fhir/uv/ips/en/StructureDefinition-Bundle-uv-ips.html)
4. [Composition (IPS) definitions](https://hl7.org/fhir/uv/ips/en/StructureDefinition-Composition-uv-ips-definitions.html)
5. [Empty Sections and Missing Data](https://hl7.org/fhir/uv/ips/2.0.1/en/Empty-Sections-and-Missing-Data.html)
6. [HL7 List Empty Reasons](https://terminology.hl7.org/7.1.0/CodeSystem-list-empty-reason.html)
7. [HL7 DataAbsentReason](https://terminology.hl7.org/en/CodeSystem-data-absent-reason.json.html)
8. [FHIR R4 Documents](https://hl7.org/fhir/R4/documents.html)
9. [IPS Design Conventions](https://hl7.org/fhir/uv/ips/en/Design-Conventions.html)
10. [Observation Results Laboratory/Pathology (IPS)](https://hl7.org/fhir/uv/ips/en/StructureDefinition-Observation-results-laboratory-pathology-uv-ips-definitions.html)
11. [Medication (IPS)](https://hl7.org/fhir/uv/ips/en/StructureDefinition-Medication-uv-ips.html)
12. [MedicationStatement (IPS)](https://hl7.org/fhir/uv/ips/en/StructureDefinition-MedicationStatement-uv-ips-definitions.html)
13. [IPS Privacy and Security Considerations](https://hl7.org/fhir/uv/ips/en/Privacy-and-Security-Considerations.html)
14. [HL7-maintained FHIR Validator](https://github.com/hapifhir/org.hl7.fhir.core)
