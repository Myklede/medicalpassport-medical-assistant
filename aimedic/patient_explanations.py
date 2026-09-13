"""Bilingual, source-linked education; never modifies measurements or risk scores.

General mechanisms are conditional, not a claim about this patient's blood flow.
The seven-day research rule is neither an infection threshold nor a waiting period.
"""
VERSION = "pwc-patient-explanation-v2"
SOURCES = {
    "diabetes_circulation": {
        "url": "https://www.niddk.nih.gov/health-information/professionals/diabetes-discoveries-practice/diabetes-peripheral-arterial-disease-and-foot-ulcers",
        "scope": "General links between diabetes, reduced circulation, oxygen/nutrient delivery and wound healing; not individual perfusion assessment.",
    },
    "diabetes_immunity": {
        "url": "https://www.cdc.gov/diabetes/diabetes-complications/diabetes-immune-system.html",
        "scope": "High blood sugar can impair the body's ability to fight infection and heal wounds.",
    },
    "diabetes_foot_care": {
        "url": "https://www.niddk.nih.gov/health-information/diabetes/overview/preventing-problems/foot-problems",
        "scope": "Foot checks, existing care plans, and promptly contacting a clinician for a nonhealing diabetic foot sore.",
    },
    "a1c_meaning": {
        "url": "https://www.cdc.gov/diabetes/diabetes-testing/prediabetes-a1c-test.html",
        "scope": "HbA1c reflects average blood sugar over about three months; targets depend on the individual.",
    },
    "glucose_monitoring": {
        "url": "https://www.cdc.gov/diabetes/diabetes-testing/monitoring-blood-sugar.html",
        "scope": "Blood sugar monitoring according to the individual's care plan.",
    },
}

TEXT = {
    "en": {
        "pending_model": "Your photo and visit details have been saved. Your recorded health history is available for context, but the image analysis is waiting for the model to become available. No wound size, tissue estimate or healing trend has been produced for this capture.",
        "pending_why": "The explanation below comes from your recorded health history and general wound-care education. The saved photograph has not yet supplied visual findings to combine with that history.",
        "retry_saved": "Keep this saved capture and retry its analysis when the service is ready; you do not need to upload the same photo again. Continue your existing care plan while waiting.",
        "single_image": "This first photo has been analyzed together with your recorded health history. The current wound estimates can be reviewed now; a later photo is needed to measure the healing rate.",
        "reported_symptoms": "Warning symptoms were reported. They matter even if the photo looks unchanged or cannot be assessed.",
        "insufficient_data": "There is not enough reliable information to tell whether the wound is healing or getting worse.",
        "stagnation": "The available wound measurements have changed very little across the recorded visits. It may need a closer look to understand why progress is slow.",
        "worsening": "The measurements show a larger wound area or more yellow or dark-looking material. A clinician should check whether this is a real change or a difference in the photographs.",
        "historical_review": "An earlier visit showed a concerning change. The latest visit does not trigger a new change warning, but that earlier change still needs review.",
        "possible_scab": "The clinician-reported dry scab and measured changes may fit with a scab forming during repair. A photograph cannot confirm normal healing.",
        "no_new_flag": "The available comparison did not trigger a new warning. This does not prove the wound is healing normally or rule out infection.",
        "diabetes_why": "Over time, high blood sugar can damage blood vessels, including small vessels, and reduce blood flow. Less oxygen and fewer nutrients may reach the skin to help it repair. High blood sugar can also make infection-fighting cells work less well. These are possible effects of diabetes, not proof that they are happening in this wound.",
        "neuropathy_why": "Your history records neuropathy. Reduced sensation can make pressure or a new injury harder to notice; it is useful to review protection from repeated pressure alongside the measured changes.",
        "vascular_why": "Your history records impaired peripheral circulation. Your clinician can assess whether oxygen delivery is limiting repair; a photo cannot measure blood flow or establish the cause.",
        "stagnant_why": "Because the recorded image measurements have stayed nearly unchanged, these baseline factors are reasons to review slow repair with your clinician, not proof that glucose or circulation caused it.",
        "general_why": "Skin repair needs an adequate blood supply and protection from repeated pressure or injury. A larger area or a change in color can have several causes; the pictures cannot identify the cause on their own.",
        "scab_why": "A dry scab can look dark in a photo. The dark-tissue image label cannot by itself distinguish a healing scab from tissue that needs medical attention.",
        "uncertain_why": "Lighting, camera distance, unclear images or missing visits can change the measurements. A missing score means the system could not judge the trend, not that the risk is zero.",
        "risk_consequence": "A wound that stays open may take longer to heal. If an infection develops and is not treated, it can spread into deeper tissue and become harder to treat. This result does not show that an infection is present or predict that it will happen.",
        "uncertain_consequence": "Unclear information can hide a real change or make a harmless difference look worse. Waiting for a better app result should not delay care if the wound or your symptoms are worsening.",
        "stable_consequence": "The current measurements cannot guarantee recovery. New pain, redness or drainage still needs attention, even after an unchanged or improving picture.",
        "check": "Check for new redness, warmth, swelling, pain or drainage. Record changes and share them with your care team; for a foot wound, check the rest of the foot too.",
        "glucose": "Check and record blood sugar as agreed with your diabetes care team. Discuss readings outside your personal targets; do not change insulin or other medicine based on this result.",
        "a1c_review": "Ask your clinician to review the recorded HbA1c and whether home blood sugar checks are appropriate. The app does not diagnose diabetes from this value.",
        "pressure": "If the wound is on the foot, follow the pressure-relief plan already prescribed by your clinician (offloading). Ask the team how to avoid pressure safely; do not start a new device or treatment on your own.",
        "existing_plan": "Follow the wound-care and dressing plan your clinician gave you. Do not cut away dark or yellow tissue yourself.",
        "capture": "If your care team requests photos, use similar lighting, angle and distance. Share the dates and originals; a better photo does not replace an examination.",
        "care_symptoms": "Contact your clinician or an urgent-care service now for an in-person assessment of the reported warning symptoms. Do not wait for another upload or for day seven.",
        "care_change": "Contact your wound-care clinician or home-health nurse promptly about the slow or worsening trend. For a diabetic foot sore that has not begun healing after a few days, call your doctor or foot specialist right away; do not wait for day seven.",
        "care_general_change": "Contact your wound-care clinician or nurse about the persistent or worsening changes. Seek prompt care if redness spreads, pain increases, pus appears or you develop a fever.",
        "care_monitor": "Contact your care team if the wound is not improving. Seek prompt care for spreading redness, increasing pain, pus or fever, regardless of the app score.",
        "care_monitor_diabetes": "If a foot sore has not started healing after a few days, call your doctor or foot specialist right away. Do not wait for day seven. Seek prompt care for spreading redness, increasing pain, pus or fever, regardless of the app score.",
        "measurement_note": "Color labels are image estimates, not confirmed tissue findings. Yellow material (slough) is not automatically pus; dark material is not automatically dead tissue (necrosis). New repair tissue is called granulation tissue, but color alone cannot confirm it.",
        "rule_note": "The seven-day/5% rule is an unvalidated research prompt. There is no proven seven-day point at which these image changes mean an infection will occur.",
        "safety_note": "This research decision-support tool does not diagnose infection, replace a doctor's visit or choose treatment. Scores are not proven probabilities. A clinician needs to assess the wound and your overall health.",
    },
    "vi": {
        "pending_model": "Ảnh và thông tin lần chụp của bạn đã được lưu. Hệ thống có tiền sử sức khỏe để tham khảo, nhưng đang chờ mô hình sẵn sàng để phân tích ảnh. Lần chụp này chưa có số đo diện tích, ước tính mô hoặc nhận định tiến triển từ ảnh.",
        "pending_why": "Phần giải thích dưới đây dựa trên tiền sử đã ghi nhận và kiến thức chăm sóc vết thương nói chung. Ảnh đã lưu chưa cung cấp kết quả trực quan để kết hợp với tiền sử đó.",
        "retry_saved": "Giữ lần chụp đã lưu và bấm phân tích lại khi dịch vụ sẵn sàng; bạn không cần tải lại cùng ảnh. Trong khi chờ, tiếp tục kế hoạch chăm sóc đã được hướng dẫn.",
        "single_image": "Ảnh đầu tiên đã được phân tích cùng tiền sử sức khỏe đã ghi nhận của bạn. Bạn có thể xem ước tính vết thương hiện tại; cần ảnh ở lần tiếp theo để đo tốc độ hồi phục.",
        "reported_symptoms": "Bạn đã báo có triệu chứng cần chú ý. Những triệu chứng này vẫn quan trọng dù ảnh có vẻ không đổi hoặc không đánh giá được.",
        "insufficient_data": "Chưa có đủ thông tin đáng tin cậy để biết vết thương đang lành hay xấu đi.",
        "stagnation": "Các số đo vết thương hiện có thay đổi rất ít qua các lần theo dõi đã lưu. Cần xem xét kỹ hơn để tìm hiểu vì sao tiến triển chậm.",
        "worsening": "Số đo cho thấy diện tích lớn hơn hoặc phần có màu vàng hay sẫm tăng lên. Nhân viên y tế cần kiểm tra xem đó là thay đổi thật hay do cách chụp ảnh.",
        "historical_review": "Một lần theo dõi trước có thay đổi cần chú ý. Lần mới nhất không tạo cảnh báo thay đổi mới, nhưng thay đổi trước đó vẫn cần được xem lại.",
        "possible_scab": "Lớp mày khô do bác sĩ ghi nhận và các số đo có thể phù hợp với quá trình đóng mày khi da hồi phục. Ảnh không xác nhận được vết thương đang lành bình thường.",
        "no_new_flag": "Lần so sánh hiện có không tạo cảnh báo mới. Điều này không chứng minh vết thương đang lành bình thường và không loại trừ nhiễm trùng.",
        "diabetes_why": "Đường huyết cao kéo dài có thể làm tổn thương mạch máu, kể cả các vi mạch nhỏ, và giảm lượng máu lưu thông. Da có thể nhận ít oxy và chất dinh dưỡng hơn để hồi phục. Đường huyết cao cũng có thể khiến các tế bào chống nhiễm trùng hoạt động kém hơn. Đây là những ảnh hưởng có thể có của đái tháo đường, không phải kết luận chúng đang xảy ra ở vết thương này.",
        "neuropathy_why": "Hồ sơ ghi nhận bệnh lý thần kinh ngoại biên. Giảm cảm giác có thể khiến bạn khó nhận ra chỗ tì đè hoặc tổn thương mới; cần xem lại việc bảo vệ vết thương khỏi áp lực lặp lại cùng với các số đo theo dõi.",
        "vascular_why": "Hồ sơ ghi nhận tuần hoàn ngoại biên suy giảm. Bác sĩ có thể đánh giá liệu việc đưa oxy đến mô có đang hạn chế hồi phục hay không; ảnh không đo được dòng máu hoặc xác định nguyên nhân.",
        "stagnant_why": "Vì các số đo từ ảnh gần như không đổi, những yếu tố nền này là lý do để cùng bác sĩ xem lại tiến triển chậm, không phải bằng chứng rằng đường huyết hay tuần hoàn đã gây ra tình trạng đó.",
        "general_why": "Da cần được cung cấp đủ máu và tránh bị tì đè hoặc tổn thương lặp lại để hồi phục. Diện tích tăng hoặc đổi màu có thể do nhiều nguyên nhân; chỉ ảnh chụp không xác định được nguyên nhân.",
        "scab_why": "Mày khô có thể trông sẫm màu trên ảnh. Nhãn mô sẫm màu của hệ thống không tự phân biệt được mày đang lành với mô cần được bác sĩ kiểm tra.",
        "uncertain_why": "Ánh sáng, khoảng cách chụp, ảnh không rõ hoặc thiếu lần theo dõi có thể làm số đo thay đổi. Không có điểm đánh giá nghĩa là hệ thống chưa đánh giá được, không phải nguy cơ bằng không.",
        "risk_consequence": "Vết thương còn hở có thể mất nhiều thời gian hơn để lành. Nếu nhiễm trùng xuất hiện mà không được điều trị, nó có thể lan xuống mô sâu hơn và khó điều trị hơn. Kết quả này không cho biết đã có nhiễm trùng và không dự đoán chắc chắn điều đó sẽ xảy ra.",
        "uncertain_consequence": "Thông tin không rõ có thể che khuất thay đổi thật hoặc khiến khác biệt không đáng lo trông nghiêm trọng hơn. Đừng trì hoãn đi khám để chờ ứng dụng đánh giá tốt hơn nếu vết thương hoặc triệu chứng đang xấu đi.",
        "stable_consequence": "Các số đo hiện tại không bảo đảm vết thương sẽ hồi phục. Đau, đỏ hoặc chảy dịch mới xuất hiện vẫn cần được chú ý, dù ảnh trước đó không đổi hoặc có vẻ cải thiện.",
        "check": "Theo dõi xem có đỏ, nóng, sưng, đau hoặc chảy dịch mới xuất hiện không. Ghi lại để báo cho nhóm chăm sóc; nếu vết thương ở bàn chân, kiểm tra cả những vùng còn lại của bàn chân.",
        "glucose": "Đo và ghi lại đường huyết theo kế hoạch đã thống nhất với nhóm điều trị đái tháo đường. Trao đổi khi kết quả ngoài mục tiêu riêng của bạn; không tự đổi liều insulin hoặc thuốc khác dựa trên kết quả này.",
        "a1c_review": "Nhờ bác sĩ xem lại HbA1c đã ghi nhận và xem bạn có cần đo đường huyết tại nhà không. Ứng dụng không chẩn đoán đái tháo đường từ chỉ số này.",
        "pressure": "Nếu vết thương ở bàn chân, làm theo kế hoạch giảm tì đè đã được bác sĩ chỉ định (offloading). Hỏi nhóm chăm sóc cách tránh đè lên vết thương an toàn; không tự dùng thiết bị hay bắt đầu cách điều trị mới.",
        "existing_plan": "Làm theo hướng dẫn chăm sóc và thay băng của bác sĩ. Không tự cắt bỏ phần mô sẫm màu hoặc màu vàng.",
        "capture": "Nếu nhóm chăm sóc yêu cầu chụp ảnh, giữ ánh sáng, góc và khoảng cách tương tự. Gửi kèm ngày chụp và ảnh gốc; ảnh rõ hơn không thay thế việc khám trực tiếp.",
        "care_symptoms": "Liên hệ bác sĩ hoặc cơ sở khám cấp thiết ngay để được khám trực tiếp những triệu chứng đã báo. Đừng chờ tải thêm ảnh hoặc chờ đến ngày thứ bảy.",
        "care_change": "Sớm liên hệ bác sĩ chăm sóc vết thương hoặc điều dưỡng chăm sóc tại nhà về tiến triển chậm hay xấu đi. Nếu bạn có đái tháo đường và vết loét bàn chân chưa bắt đầu lành sau vài ngày, gọi bác sĩ hoặc chuyên gia bàn chân ngay; đừng chờ đến ngày thứ bảy.",
        "care_general_change": "Liên hệ bác sĩ hoặc điều dưỡng chăm sóc vết thương về những thay đổi kéo dài hay xấu đi. Đi khám sớm nếu đỏ lan rộng, đau tăng, xuất hiện mủ hoặc sốt.",
        "care_monitor": "Liên hệ nhóm chăm sóc nếu vết thương không cải thiện. Đi khám sớm khi đỏ lan rộng, đau tăng, có mủ hoặc sốt, bất kể điểm trên ứng dụng.",
        "care_monitor_diabetes": "Nếu vết loét bàn chân chưa bắt đầu lành sau vài ngày, gọi bác sĩ hoặc chuyên gia bàn chân ngay. Đừng chờ đến ngày thứ bảy. Đi khám sớm khi đỏ lan rộng, đau tăng, có mủ hoặc sốt, bất kể điểm trên ứng dụng.",
        "measurement_note": "Các nhãn màu là ước tính từ ảnh, không phải kết luận về mô. Phần màu vàng (slough, mô vàng) không mặc nhiên là mủ; phần sẫm màu không mặc nhiên là mô chết (necrosis, hoại tử). Mô mới giúp vết thương hồi phục gọi là mô hạt (granulation), nhưng màu sắc không đủ để xác nhận.",
        "rule_note": "Quy tắc bảy ngày/5% chỉ là gợi ý nghiên cứu chưa được kiểm chứng. Không có mốc bảy ngày đã được chứng minh rằng những thay đổi trên ảnh này sẽ dẫn đến nhiễm trùng.",
        "safety_note": "Công cụ hỗ trợ quyết định nghiên cứu này không chẩn đoán nhiễm trùng, không thay thế buổi khám và không chọn phương pháp điều trị. Điểm số không phải xác suất đã được kiểm chứng. Bác sĩ cần đánh giá vết thương cùng tình trạng sức khỏe của bạn.",
    },
}


def build_patient_explanation(assessment, profile):
    """Select explanations from existing facts; never infer a new diagnosis/risk."""
    flags = assessment["risk_alerts"]
    current = [f for f in flags if f.get("scope") == "latest"]
    symptoms = any(f["rule_id"] == "reported_clinical_warning_signs" for f in current)
    insufficient = assessment["Deterioration_Risk_Score"] is None
    new_stagnation = assessment.get("non_healing_trajectory", {})
    stall = assessment["stagnation"]["flagged"] or new_stagnation.get("persistent_unchanged", False)
    scab = assessment["scab_context"]["compatible_with_reported_scab"]
    diabetes = profile["has_diabetes_type_2"]
    high = profile["hba1c_level"] > assessment["rule_provenance"]["parameters"]["high_hba1c_gt"]
    single_image = assessment.get("single_visit_analysis", {}).get("available", False)
    pending = assessment.get("latest_analysis_status") == "pending_model"
    scenario = ("reported_symptoms" if symptoms else "pending_model" if pending else "single_image" if single_image else "insufficient_data" if insufficient else
                "stagnation" if stall else "worsening" if current else
                "historical_review" if flags else "possible_scab" if scab else "no_new_flag")
    care = ("care_symptoms" if symptoms else
            "care_change" if current and diabetes else
            "care_general_change" if current else "care_monitor_diabetes" if diabetes else "care_monitor")
    actions = [("check", ["diabetes_foot_care"]), ("existing_plan", ["diabetes_foot_care"])]
    if diabetes:
        actions.insert(0, ("glucose", ["glucose_monitoring"]))
    elif high:
        actions.insert(0, ("a1c_review", ["a1c_meaning"]))
    if diabetes or high:
        actions.append(("pressure", ["offloading_review"]))
    if pending:
        actions.append(("retry_saved", []))
    elif insufficient:
        actions.append(("capture", []))
    # Exact medical terms remain available to clinicians in the original metrics.
    # Both locales share the same scenario, facts, action IDs and evidence IDs.
    locales = {}
    for language, t in TEXT.items():
        why = t["diabetes_why"] if diabetes or high else t["scab_why"] if scab else t["general_why"]
        if pending:
            why = t["pending_why"] + " " + why
        elif insufficient:
            why = t["uncertain_why"] + (" " + why if diabetes or high else "")
        if profile.get("neuropathy_status") == "present":
            why += " " + t["neuropathy_why"]
        if profile.get("peripheral_vascular_status") == "impaired":
            why += " " + t["vascular_why"]
        if stall and (diabetes or high):
            why += " " + t["stagnant_why"]
        consequence = t["risk_consequence"] if current and not insufficient else t["uncertain_consequence"] if insufficient else t["stable_consequence"]
        if symptoms:
            consequence = t["risk_consequence"]
        hba1c = profile["hba1c_level"]
        baseline = (
                ("Type 2 diabetes is recorded. " if diabetes else "Diabetes is not recorded in this profile. ")
                + f"Recorded HbA1c: {hba1c:g}%. HbA1c reflects average blood sugar over about three months, not today's reading or blood flow at the wound."
                if language == "en" else
                ("Hồ sơ có ghi nhận đái tháo đường típ 2. " if diabetes else "Hồ sơ này chưa ghi nhận đái tháo đường. ")
                + f"HbA1c đã ghi nhận: {hba1c:g}%. HbA1c phản ánh đường huyết trung bình khoảng ba tháng, không phải đường huyết hôm nay hay lượng máu đến vết thương."
        )
        if profile.get("fpg_mg_dl") is not None:
            fpg = profile["fpg_mg_dl"]
            baseline += (f" Recorded fasting plasma glucose: {fpg:g} mg/dL; this is a historical measurement."
                         if language == "en" else f" Đường huyết lúc đói (FPG) đã ghi nhận: {fpg:g} mg/dL; đây là kết quả trong hồ sơ trước đó.")
        vascular = profile.get("peripheral_vascular_status", "unknown")
        neuropathy = profile.get("neuropathy_status", "unknown")
        vascular_label = {"normal": "không ghi nhận suy giảm", "impaired": "ghi nhận suy giảm", "unknown": "chưa xác định"}
        nerve_label = {"present": "có ghi nhận", "absent": "không ghi nhận", "unknown": "chưa xác định"}
        baseline += (f" Recorded peripheral vascular status: {vascular}; neuropathy: {neuropathy}."
                     if language == "en" else f" Tuần hoàn ngoại biên: {vascular_label[vascular]}; bệnh lý thần kinh ngoại biên: {nerve_label[neuropathy]}.")
        simple = t[scenario]
        if stall and not insufficient and not symptoms:
            duration = max(assessment["stagnation"]["elapsed_days"], new_stagnation.get("elapsed_days", 0))
            simple += f" This comparison spans {duration:g} days." if language == "en" else f" Chuỗi so sánh này kéo dài {duration:g} ngày."
        locales[language] = {
            "simple_explanation": simple, "baseline_context": baseline,
            "why_this_matters": why, "possible_consequences": consequence,
            "what_to_do": [{"action_id": key, "text": t[key], "evidence_ids": sources} for key, sources in actions],
            "when_to_seek_care": t[care], "measurement_note": t["measurement_note"],
            "rule_note": t["rule_note"] if stall else "", "safety_note": t["safety_note"],
        }
    return {"version": VERSION, "scenario": scenario, "default_language": "en", "locales": locales,
            "trigger_rule_ids": sorted({f["rule_id"] for f in flags}),
            "historical_findings_retained": any(f.get("scope") == "historical" for f in flags),
            "evidence_ids": sorted({"diabetes_foot_care", "infection_review", "cds_boundary"}
                | ({"diabetes_circulation", "diabetes_immunity", "a1c_meaning"} if diabetes or high else set())
                | {source for _, sources in actions for source in sources}),
            "clinical_validation": False, "mechanism_is_general_education": True}


def patient_narrative(explanation, language="en"):
    """A readable fallback for existing clients that render strings, not sections."""
    t = explanation["locales"][language]
    return " ".join(filter(None, (t["simple_explanation"], t["baseline_context"], t["why_this_matters"],
                                  t["possible_consequences"], t["rule_note"])))


def patient_guidance(explanation, language="en"):
    t = explanation["locales"][language]
    return " ".join([x["text"] for x in t["what_to_do"]] + [t["when_to_seek_care"], t["safety_note"]])
